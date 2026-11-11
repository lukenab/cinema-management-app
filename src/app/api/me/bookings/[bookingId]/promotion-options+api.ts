import { authenticate } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, route } from '@/server/http';
import { promotionOptions } from '@/server/promotions';

/** Offers with whether each can be used on this order, and the discount it would give. */
export const GET = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  return ok(await promotionOptions(await getDb(), session.accountId, bookingId));
});
