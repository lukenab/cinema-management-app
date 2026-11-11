import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { intParam, ok, parseBody, route } from '@/server/http';
import { DAYPARTS, getPriceBook, updatePriceBook } from '@/server/pricing';

const dto = (b: Awaited<ReturnType<typeof getPriceBook>>) => ({
  clusterId: b._id,
  rates: b.rates,
  seatMultipliers: b.seatMultipliers,
  dayparts: DAYPARTS.map(({ code, label }) => ({ code, label })),
  updatedAt: b.updatedAt.toISOString(),
});

/** Ticket prices of a cinema: day type × daypart × format, and the seat-type multipliers. */
export const GET = route(async (request, { clusterId }) => {
  await requireAdmin(request);
  return ok(dto(await getPriceBook(await getDb(), intParam(clusterId, 'Không tìm thấy rạp.'))));
});

const Body = z.object({
  rates: z
    .array(
      z.object({
        dayType: z.enum(['WEEKDAY', 'WEEKEND']),
        daypart: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'LATE_NIGHT']),
        format: z.enum(['2D', '3D']),
        standardPrice: z.number().int().min(10_000, 'Giá vé tối thiểu 10.000 ₫.').max(1_000_000, 'Giá vé tối đa 1.000.000 ₫.'),
      }),
    )
    .min(1)
    .max(32),
  seatMultipliers: z.object({
    STANDARD: z.number().min(0.5).max(3),
    VIP: z.number().min(0.5).max(3),
    COUPLE: z.number().min(0.5).max(3),
  }),
});

/** Replaces the price book. Only new showtimes use it: existing ones keep the prices they were created with. */
export const PUT = route(async (request, { clusterId }) => {
  await requireAdmin(request);
  return ok(dto(await updatePriceBook(await getDb(), intParam(clusterId, 'Không tìm thấy rạp.'), await parseBody(request, Body))));
});
