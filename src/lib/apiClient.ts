import { API_URL } from "./config";
import { isTokenExpired } from "./jwt";
import { secureStorage } from "./secureStorage";

export class ApiError extends Error {
  status: number;
  code?: number;
  result?: unknown;

  constructor(
    message: string,
    status: number,
    code?: number,
    result?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.result = result;
  }
}

type AuthHandlers = {
  onTokenRefreshed?: (token: string) => void;
  onSessionExpired?: () => void;
};

let handlers: AuthHandlers = {};
export const setAuthHandlers = (next: AuthHandlers) => {
  handlers = next;
};

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip the Authorization header (public endpoints, login). */
  anonymous?: boolean;
  timeoutMs?: number;
}

const AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
];

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return query ? `${url}?${query}` : url;
}

/** Backend wraps payloads as { code, message, result }; some endpoints return the raw body. */
function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "result" in (body as Record<string, unknown>)
  ) {
    const { result } = body as { result?: T };
    if (result !== undefined && result !== null) return result;
  }
  return body as T;
}

async function rawFetch(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 20_000,
  );
  try {
    return await fetch(buildUrl(path, options.params), {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token && !options.anonymous
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...options.headers,
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

let refreshing: Promise<string | null> | null = null;

/** Token rotation: the backend accepts the current (possibly just-expired) token. */
async function refreshToken(current: string): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await rawFetch(
        "/api/auth/refresh",
        { method: "POST", body: { token: current }, anonymous: true },
        null,
      );
      if (!res.ok) return null;
      const body = await res.json();
      const next = unwrap<{ token?: string }>(body)?.token;
      if (!next) return null;
      accessToken = next;
      await secureStorage.setToken(next);
      handlers.onTokenRefreshed?.(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let token = accessToken;
  const skipRefresh = AUTH_PATHS.some((p) => path.startsWith(p));

  if (token && !options.anonymous && !skipRefresh && isTokenExpired(token, 0)) {
    token = (await refreshToken(token)) ?? token;
  }

  let response: Response;
  try {
    response = await rawFetch(path, options, token);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ApiError(
      aborted
        ? "Request timed out. Check your connection."
        : "Cannot reach the server. Check your connection.",
      0,
    );
  }

  if (response.status === 401 && token && !options.anonymous && !skipRefresh) {
    const next = await refreshToken(token);
    if (next) {
      response = await rawFetch(path, options, next);
    } else {
      handlers.onSessionExpired?.();
    }
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const envelope = (body && typeof body === "object" ? body : {}) as {
      message?: string;
      code?: number;
      result?: unknown;
    };
    throw new ApiError(
      envelope.message || `Request failed (${response.status})`,
      response.status,
      envelope.code,
      envelope.result,
    );
  }

  return unwrap<T>(body);
}

export const getErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  if (error instanceof ApiError) return error.message || fallback;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message || fallback;
  }
  return fallback;
};

/**
 * Random v4 UUID for Idempotency-Key headers. Keys only need to be unique per user and
 * operation (not secret), so Math.random is enough and avoids a native module.
 */
export const newIdempotencyKey = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
