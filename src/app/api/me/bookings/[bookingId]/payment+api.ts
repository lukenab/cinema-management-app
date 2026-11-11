import { z } from 'zod';

import { authenticate } from '@/server/auth';
import { getDb } from '@/server/db';
import { HttpError, ok, parseBody, route } from '@/server/http';
import { createSession, latestPayment } from '@/server/payments';

/** The latest payment attempt of the order. */
export const GET = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  const payment = await latestPayment(await getDb(), bookingId, session.accountId, session.role === 'ADMIN');
  if (!payment) throw new HttpError(404, 'Chưa có giao dịch cho đơn đặt vé này.', 2701);
  return ok(payment);
});

// Only app links are accepted (Expo Go uses exp://, a build uses its own scheme), never an arbitrary web address.
const Body = z.object({
  returnUrl: z.string().max(300).regex(/^(exp|exps|cineprime):\/\//, 'Liên kết quay lại ứng dụng không hợp lệ.').optional(),
});

/** Starts paying the order and returns the page to open. Asking again returns the same open payment. */
export const POST = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  const { returnUrl } = await parseBody(request, Body);
  const key = request.headers.get('idempotency-key')?.trim().slice(0, 100) || undefined;
  return ok(await createSession(await getDb(), request, session.accountId, bookingId, key, returnUrl), 201);
});
