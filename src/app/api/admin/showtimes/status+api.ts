import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';
import { bulkSetStatus } from '@/server/showtimes';

const Body = z.object({
  showtimeIds: z.array(z.number().int()).min(1, 'Chưa chọn suất chiếu.').max(500),
  status: z.enum(['ON_SALE', 'SUSPENDED', 'CANCELLED']),
});

/** Open for sale, suspend or cancel showtimes. Returns how many changed and which were skipped (and why). */
export const PATCH = route(async (request) => {
  await requireAdmin(request);
  const { showtimeIds, status } = await parseBody(request, Body);
  return ok(await bulkSetStatus(await getDb(), showtimeIds, status));
});
