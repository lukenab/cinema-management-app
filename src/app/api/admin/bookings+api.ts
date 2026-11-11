import { requireAdmin } from '@/server/auth';
import { listAllBookings } from '@/server/bookings';
import { getDb } from '@/server/db';
import { intQuery, ok, queryParam, route } from '@/server/http';

/** All bookings (read-only). Filters: `status` (CONFIRMED | PENDING_PAYMENT | CLOSED), `q` (code or movie), `clusterId`. */
export const GET = route(async (request) => {
  await requireAdmin(request);
  const status = queryParam(request, 'status');
  return ok(
    await listAllBookings(await getDb(), {
      page: Math.max(0, Number(queryParam(request, 'page')) || 0),
      size: Math.min(50, Math.max(1, Number(queryParam(request, 'size')) || 20)),
      status: status === 'CONFIRMED' || status === 'PENDING_PAYMENT' || status === 'CLOSED' ? status : undefined,
      q: queryParam(request, 'q')?.trim() || undefined,
      clusterId: intQuery(request, 'clusterId'),
    }),
  );
});
