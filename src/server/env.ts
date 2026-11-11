import { HttpError } from './http';

// Server-only module: dynamic process.env access is fine here (nothing is inlined into the app bundle).
/* eslint-disable expo/no-dynamic-env-var */

/** Server-only configuration. Never prefix these with EXPO_PUBLIC_ (that would bundle them into the app). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new HttpError(500, `Máy chủ chưa cấu hình ${name}.`);
  return value;
}

export const optionalEnv = (name: string, fallback = ''): string => process.env[name] || fallback;
