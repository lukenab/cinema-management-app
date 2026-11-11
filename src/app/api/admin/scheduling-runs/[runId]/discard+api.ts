import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';
import { discardRun } from '@/server/scheduling';

/** Removes the run's showtimes that were never opened for sale. */
export const POST = route(async (request, { runId }) => {
  await requireAdmin(request);
  return ok(await discardRun(await getDb(), intParam(runId, 'Không tìm thấy lần tạo lịch.', 3202)));
});
