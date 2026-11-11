import { z } from 'zod';

import { authenticate } from '@/server/auth';
import { bookingDto } from '@/server/bookings';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';
import { applyPromotion, removePromotion } from '@/server/promotions';

const Body = z.object({ promotionCode: z.string().trim().min(1, 'Vui lòng nhập mã khuyến mãi.') });

/** Applies (or replaces) the order's promotion code. */
export const PUT = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  const { promotionCode } = await parseBody(request, Body);
  return ok(bookingDto(await applyPromotion(await getDb(), session.accountId, bookingId, promotionCode)));
});

export const DELETE = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  return ok(bookingDto(await removePromotion(await getDb(), session.accountId, bookingId)));
});
