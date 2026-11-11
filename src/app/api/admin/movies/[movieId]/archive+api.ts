import { requireAdmin } from '@/server/auth';
import { archiveMovie } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';

/** Takes the movie out of circulation: closes its release plans and cancels unsold future showtimes. */
export const POST = route(async (request, { movieId }) => {
  await requireAdmin(request);
  return ok(await archiveMovie(await getDb(), intParam(movieId, 'Không tìm thấy phim.', 2002)));
});
