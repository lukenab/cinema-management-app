import { optionalSession } from '@/server/auth';
import { seatMap } from '@/server/bookings';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';

/** Seat layout of the room and the state of every seat. Signed-in callers also see which seats they hold. */
export const GET = route(async (request, { showtimeId }) => {
  const id = intParam(showtimeId, 'Không tìm thấy suất chiếu.', 2501);
  const session = await optionalSession(request);
  return ok(await seatMap(await getDb(), id, session?.accountId));
});
