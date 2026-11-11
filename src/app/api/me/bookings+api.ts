import { z } from 'zod';

import { authenticate } from '@/server/auth';
import { createBooking, listMyBookings } from '@/server/bookings';
import { getDb } from '@/server/db';
import { ok, parseBody, queryParam, route } from '@/server/http';

const Body = z.object({
  showtimeId: z.number().int(),
  seatIds: z.array(z.number().int()).min(1, 'Vui lòng chọn ít nhất một ghế.'),
});

/** Holds the chosen seats and creates an unpaid booking. A repeated Idempotency-Key returns the same booking. */
export const POST = route(async (request) => {
  const session = await authenticate(request);
  const input = await parseBody(request, Body);
  const key = request.headers.get('idempotency-key')?.trim().slice(0, 100) || undefined;
  return ok(await createBooking(await getDb(), session, input, key), 201);
});

/** The customer's tickets: `?scope=upcoming|watched|pending`. */
export const GET = route(async (request) => {
  const session = await authenticate(request);
  const page = Math.max(0, Number(queryParam(request, 'page')) || 0);
  const size = Math.min(50, Math.max(1, Number(queryParam(request, 'size')) || 10));
  const scope = queryParam(request, 'scope');
  return ok(
    await listMyBookings(await getDb(), session.accountId, page, size, scope === 'upcoming' || scope === 'watched' || scope === 'pending' ? scope : undefined),
  );
});
