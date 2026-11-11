import { getDb } from '@/server/db';
import { HttpError, intParam, intQuery, ok, route } from '@/server/http';
import { getPublicMovie } from '@/server/movies';

export const GET = route(async (request, { movieId }) => {
  const movie = await getPublicMovie(await getDb(), intParam(movieId, 'Không tìm thấy phim.', 2002), intQuery(request, 'clusterId'));
  if (!movie) throw new HttpError(404, 'Không tìm thấy phim.', 2002);
  return ok(movie);
});
