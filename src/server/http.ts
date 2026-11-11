import { z } from 'zod';

/** Error that is turned into the `{ code, message, result }` envelope the app already understands. */
export class HttpError extends Error {
  status: number;
  code: number;
  result?: unknown;

  constructor(status: number, message: string, code = status, result?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.result = result;
  }
}

export const ok = (result: unknown = {}, status = 200): Response =>
  Response.json({ code: 200, message: 'OK', result }, { status });

export type RouteParams = Record<string, string>;
type Handler = (request: Request, params: RouteParams) => Promise<Response>;

/** Wraps a handler so thrown HttpErrors become JSON errors and anything else a generic 500. */
export const route =
  (handler: Handler) =>
  async (request: Request, params: RouteParams = {}): Promise<Response> => {
    try {
      return await handler(request, params);
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ code: e.code, message: e.message, result: e.result }, { status: e.status });
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, e);
      return Response.json({ code: 500, message: 'Máy chủ gặp lỗi. Vui lòng thử lại.' }, { status: 500 });
    }
  };

/** Reads and validates a JSON body. The first validation problem becomes the 400 message. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, issue?.message || 'Dữ liệu gửi lên không hợp lệ.', 400, { field: issue?.path.join('.') });
  }
  return parsed.data;
}

export const queryParam = (request: Request, name: string): string | undefined => {
  const v = new URL(request.url).searchParams.get(name);
  return v === null || v === '' ? undefined : v;
};

/** A numeric id from the URL; anything else is a 404 with `message`. */
export const intParam = (raw: string | undefined, message: string, code = 404): number => {
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) throw new HttpError(404, message, code);
  return id;
};

/** Optional positive integer from the query string (e.g. ?clusterId=2). */
export const intQuery = (request: Request, name: string): number | undefined => {
  const raw = queryParam(request, name);
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : undefined;
};
