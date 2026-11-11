import { z } from 'zod';

import { authenticate } from '@/server/auth';
import { bookingDto } from '@/server/bookings';
import { setConcessions } from '@/server/concessions';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';

const Body = z.object({
  items: z
    .array(
      z.object({
        sellableType: z.enum(['SKU', 'COMBO']),
        sellableId: z.number().int(),
        quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1.').max(10, 'Mỗi món tối đa 10.'),
        selections: z.array(z.object({ groupCode: z.string(), skuIds: z.array(z.number().int()) })).optional(),
      }),
    )
    .max(20),
});

/** Replaces the concessions of a pending booking (an empty list removes them). */
export const PUT = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  const { items } = await parseBody(request, Body);
  return ok(bookingDto(await setConcessions(await getDb(), session.accountId, bookingId, items)));
});
