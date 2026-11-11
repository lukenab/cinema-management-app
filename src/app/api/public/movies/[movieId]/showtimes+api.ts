import { isIsoDate } from '@/server/cinema';
import { getDb } from '@/server/db';
import { HttpError, intParam, intQuery, ok, queryParam, route } from '@/server/http';
import { listShowtimesByMovie } from '@/server/showtimes';

/** Bookable showtimes of a movie. `?date=YYYY-MM-DD` limits it to one day, `?clusterId=` to one cinema. */
export const GET = route(async (request, { movieId }) => {
  const id = intParam(movieId, 'Không tìm thấy phim.', 2002);
  const date = queryParam(request, 'date');
  if (date && !isIsoDate(date)) throw new HttpError(400, 'Ngày không hợp lệ.');
  return ok(await listShowtimesByMovie(await getDb(), id, date, intQuery(request, 'clusterId')));
});
