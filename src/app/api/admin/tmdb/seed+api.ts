import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';
import { seedFromTmdb } from '@/server/movies';

const Body = z.object({
  nowCount: z.number().int().min(0).max(20).default(5),
  upcomingCount: z.number().int().min(0).max(20).default(5),
});

/** Demo data: imports and approves the newest TMDB movies with open release plans. Used by `npm run seed:tmdb`. */
export const POST = route(async (request) => {
  await requireAdmin(request);
  const { nowCount, upcomingCount } = await parseBody(request, Body);
  return ok(await seedFromTmdb(await getDb(), nowCount, upcomingCount));
});
