import { requireAdmin } from '@/server/auth';
import { listAdminMovies } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { ok, queryParam, route } from '@/server/http';

/** Every movie in the system; `?status=DRAFT|APPROVED|ARCHIVED` filters. */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const status = queryParam(request, 'status');
  return ok(await listAdminMovies(await getDb(), status === 'DRAFT' || status === 'APPROVED' || status === 'ARCHIVED' ? status : undefined));
});
