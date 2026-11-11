import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { isIsoDate } from '@/server/cinema';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';
import { listRuns, runScheduling } from '@/server/scheduling';

/** History of showtime generation runs, newest first. */
export const GET = route(async (request) => {
  await requireAdmin(request);
  return ok(await listRuns(await getDb()));
});

const Body = z.object({
  startDate: z.string().refine(isIsoDate, 'Ngày bắt đầu không hợp lệ.'),
  endDate: z.string().refine(isIsoDate, 'Ngày kết thúc không hợp lệ.'),
  clusterIds: z.array(z.number().int()).min(1, 'Chọn ít nhất một rạp.'),
  movieIds: z.array(z.number().int()).min(1, 'Chọn ít nhất một phim.'),
  publish: z.boolean().default(false),
  policy: z
    .object({
      timeSlotIntervalMinutes: z.number().int().min(5).max(60),
      cleanupMinutes: z.number().int().min(0).max(60),
      sameMovieStaggerMinutes: z.number().int().min(0).max(120),
      maximumRoomShare: z.number().min(0.1).max(1),
      minimumCoverage: z.number().int().min(0).max(10),
    })
    .partial()
    .optional(),
});

/** Runs Legacy Greedy for the chosen movies, cinemas and dates and returns the report. */
export const POST = route(async (request) => {
  const session = await requireAdmin(request);
  return ok(await runScheduling(await getDb(), await parseBody(request, Body), session.user.username), 201);
});
