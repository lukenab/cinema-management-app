import { ObjectId } from "mongodb";
import { SignJWT, jwtVerify } from "jose";

import { getDb } from "./db";
import { requireEnv } from "./env";
import { HttpError } from "./http";
import type { Role, UserDoc } from "./models";

const ACCESS_TTL = "2h";
/** A token that expired up to a week ago can still be exchanged for a fresh one (the app calls /refresh). */
const REFRESH_GRACE_SECONDS = 7 * 24 * 3600;

const secret = () => new TextEncoder().encode(requireEnv("JWT_SECRET"));

export interface Session {
  user: UserDoc;
  accountId: string;
  role: Role;
}

export async function signToken(user: UserDoc): Promise<string> {
  return new SignJWT({
    accountId: user._id.toHexString(),
    // Same claim layout the app already decodes: space separated roles/permissions.
    scope: `ROLE_${user.role}`,
    tv: user.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.username)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

async function userFromClaims(
  payload: Record<string, unknown>,
): Promise<UserDoc> {
  if (
    typeof payload.accountId !== "string" ||
    !ObjectId.isValid(payload.accountId)
  ) {
    throw new HttpError(401, "Phiên đăng nhập không hợp lệ.");
  }
  const db = await getDb();
  const user = await db
    .collection<UserDoc>("users")
    .findOne({ _id: new ObjectId(payload.accountId) });
  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== payload.tv) {
    throw new HttpError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  }
  return user;
}

/** Validates the Bearer token and loads the account (so deactivated users are rejected immediately). */
export async function authenticate(request: Request): Promise<Session> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Vui lòng đăng nhập.");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret()));
  } catch {
    throw new HttpError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  }
  const user = await userFromClaims(payload);
  return { user, accountId: user._id.toHexString(), role: user.role };
}

/** The signed-in user if the request carries a valid token, otherwise null (for endpoints that personalise public data). */
export async function optionalSession(
  request: Request,
): Promise<Session | null> {
  if (!request.headers.get("authorization")) return null;
  try {
    return await authenticate(request);
  } catch {
    return null;
  }
}

export async function requireAdmin(request: Request): Promise<Session> {
  const session = await authenticate(request);
  if (session.role !== "ADMIN")
    throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
  return session;
}

/** Exchanges a valid or recently expired token for a new one. */
export async function refreshToken(token: string): Promise<string> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret(), {
      clockTolerance: REFRESH_GRACE_SECONDS,
    }));
  } catch {
    throw new HttpError(
      401,
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    );
  }
  return signToken(await userFromClaims(payload));
}
