import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';
import { publishRun } from '@/server/scheduling';

/** Opens the run's showtimes for sale. */
export const POST = route(async (request, { runId }) => {
  await requireAdmin(request);
  return ok(await publishRun(await getDb(), intParam(runId, 'Không tìm thấy lần tạo lịch.', 3202)));
});
