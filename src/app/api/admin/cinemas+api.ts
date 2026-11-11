import { requireAdmin } from '@/server/auth';
import { SEED_CLUSTERS, clusterDto } from '@/server/cinema';
import { ok, route } from '@/server/http';

/** Cinemas with rooms, hours and demand profile (scheduler inputs). */
export const GET = route(async (request) => {
  await requireAdmin(request);
  return ok(SEED_CLUSTERS.map((c) => clusterDto(c)));
});
