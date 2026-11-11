import { requireAdmin } from '@/server/auth';
import { approveMovie } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';

/** DRAFT → APPROVED. The movie is still hidden until a release plan opens it at a cinema. */
export const POST = route(async (request, { movieId }) => {
  await requireAdmin(request);
  return ok(await approveMovie(await getDb(), intParam(movieId, 'Không tìm thấy phim.', 2002)));
});
