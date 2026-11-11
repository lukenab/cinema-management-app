import { jwtDecode } from 'jwt-decode';

export const KNOWN_ROLES = [
  'ROLE_SUPER_ADMIN',
  'ROLE_ADMIN',
  'ROLE_SYSTEM_ADMIN',
  'ROLE_PROGRAMMING_APPROVER',
  'ROLE_PROGRAMMING_OPERATOR',
  'ROLE_FINANCE_APPROVER',
  'ROLE_FINANCE_OFFICER',
  'ROLE_COMMERCIAL_APPROVER',
  'ROLE_COMMERCIAL_MANAGER',
  'ROLE_SECURITY_AUDITOR',
  'ROLE_BRANCH_MANAGER',
  'ROLE_EMPLOYEE',
  'ROLE_MEMBER',
] as const;

const ROLE_SET = new Set<string>(KNOWN_ROLES);

export interface SessionUser {
  username: string;
  accountId: string;
  roles: string[];
  permissions: string[];
  clusterIds: string[];
}

interface Claims {
  sub?: string;
  exp?: number;
  scope?: string;
  role?: string;
  accountId?: string;
  cinemaClusterIds?: unknown;
}

function toClusterIds(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.map(String).filter(Boolean);
  if (claim == null) return [];
  return String(claim).split(/[\s,]+/).filter(Boolean);
}

export function isTokenExpired(token: string, skewSeconds = 15): boolean {
  try {
    const { exp } = jwtDecode<Claims>(token);
    return !exp || exp * 1000 < Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

/** Role/permission names come from the token's space-separated `scope` claim. */
export function userFromToken(token: string): SessionUser | null {
  try {
    const claims = jwtDecode<Claims>(token);
    const authorities = (claims.scope ?? claims.role ?? '').split(' ').filter(Boolean);
    const username = claims.sub ?? '';
    return {
      username,
      accountId: claims.accountId ?? username,
      roles: authorities.filter((a) => ROLE_SET.has(a)),
      permissions: authorities.filter((a) => !ROLE_SET.has(a)),
      clusterIds: toClusterIds(claims.cinemaClusterIds),
    };
  } catch {
    return null;
  }
}

export const ADMIN_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_PROGRAMMING_APPROVER', 'ROLE_PROGRAMMING_OPERATOR'];

export type AppArea = 'customer' | 'admin' | 'unsupported';

export function areaForUser(user: SessionUser | null): AppArea {
  if (!user) return 'unsupported';
  if (user.roles.includes('ROLE_MEMBER')) return 'customer';
  if (user.roles.some((r) => ADMIN_ROLES.includes(r))) return 'admin';
  return 'unsupported';
}
