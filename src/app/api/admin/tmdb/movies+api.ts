import { requireAdmin } from '@/server/auth';
import { tmdbCatalogue } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { HttpError, ok, queryParam, route } from '@/server/http';

/** TMDB lists for Vietnam (`?list=now-playing|upcoming&page=`) or a title search (`?q=`). */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const q = queryParam(request, 'q')?.trim();
  const page = Math.min(20, Math.max(1, Number(queryParam(request, 'page')) || 1));
  if (q !== undefined) {
    if (q.length < 2) throw new HttpError(400, 'Nhập ít nhất 2 ký tự để tìm phim.');
    return ok(await tmdbCatalogue(await getDb(), 'search', 1, q));
  }
  const list = queryParam(request, 'list') === 'upcoming' ? 'upcoming' : 'now-playing';
  return ok(await tmdbCatalogue(await getDb(), list, page));
});
