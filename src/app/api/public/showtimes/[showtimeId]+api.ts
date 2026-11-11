import { getDb } from '@/server/db';
import { HttpError, intParam, ok, route } from '@/server/http';
import { getShowtimeDto } from '@/server/showtimes';

export const GET = route(async (_request, { showtimeId }) => {
  const showtime = await getShowtimeDto(await getDb(), intParam(showtimeId, 'Không tìm thấy suất chiếu.', 2501));
  if (!showtime) throw new HttpError(404, 'Không tìm thấy suất chiếu.', 2501);
  return ok(showtime);
});
