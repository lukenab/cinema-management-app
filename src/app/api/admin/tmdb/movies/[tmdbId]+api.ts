import { requireAdmin } from '@/server/auth';
import { tmdbPreview } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';

/** What an import would fill in (nothing is saved). */
export const GET = route(async (request, { tmdbId }) => {
  await requireAdmin(request);
  return ok(await tmdbPreview(await getDb(), intParam(tmdbId, 'Không tìm thấy phim trên TMDB.')));
});
