import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { intParam, ok, route } from '@/server/http';
import { getRun } from '@/server/scheduling';

/** Full report of one run: counts per reason, per movie / cinema / day, and sample rejections. */
export const GET = route(async (request, { runId }) => {
  await requireAdmin(request);
  return ok(await getRun(await getDb(), intParam(runId, 'Không tìm thấy lần tạo lịch.', 3202)));
});
