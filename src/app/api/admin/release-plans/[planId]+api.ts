import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { isIsoDate } from '@/server/cinema';
import { getDb } from '@/server/db';
import { intParam, ok, parseBody, route } from '@/server/http';
import { deletePlan, updatePlan } from '@/server/releasePlans';

const Patch = z.object({
  status: z.enum(['PLANNED', 'OPEN', 'SUSPENDED', 'CLOSED']).optional(),
  showingStartDate: z.string().refine(isIsoDate, 'Ngày bắt đầu không hợp lệ.').optional(),
  showingEndDate: z.string().refine(isIsoDate, 'Ngày kết thúc không hợp lệ.').nullable().optional(),
  note: z.string().trim().max(300).optional(),
});

export const PATCH = route(async (request, { planId }) => {
  await requireAdmin(request);
  return ok(await updatePlan(await getDb(), intParam(planId, 'Không tìm thấy kế hoạch phát hành.', 3102), await parseBody(request, Patch)));
});

export const DELETE = route(async (request, { planId }) => {
  await requireAdmin(request);
  return ok(await deletePlan(await getDb(), intParam(planId, 'Không tìm thấy kế hoạch phát hành.', 3102)));
});
