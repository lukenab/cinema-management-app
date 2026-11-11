import { z } from 'zod';

import { quickBook } from '@/server/assistant';
import { authenticate } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';

const Body = z.object({
  showtimeId: z.number().int(),
  seatIds: z.array(z.number().int()).min(1).max(8),
  concessions: z
    .array(
      z.object({
        sellableType: z.enum(['SKU', 'COMBO']),
        sellableId: z.number().int(),
        quantity: z.number().int().min(1).max(10),
        selections: z.array(z.object({ groupCode: z.string(), skuIds: z.array(z.number().int()) })).optional(),
      }),
    )
    .max(10)
    .default([]),
});

/** "Đặt nhanh": holds the suggested seats and adds the combo, then the app opens the payment screen. */
export const POST = route(async (request) => {
  const session = await authenticate(request);
  const key = request.headers.get('idempotency-key')?.trim().slice(0, 100) || undefined;
  return ok(await quickBook(await getDb(), session, await parseBody(request, Body), key), 201);
});
