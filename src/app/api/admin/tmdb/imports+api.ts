import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { importMovie } from '@/server/adminMovies';
import { getDb } from '@/server/db';
import { ok, parseBody, route } from '@/server/http';

const Body = z.object({ tmdbId: z.number().int().positive() });

/** Imports a TMDB movie as a draft with its fields filled in; the admin reviews and approves it. */
export const POST = route(async (request) => {
  await requireAdmin(request);
  const { tmdbId } = await parseBody(request, Body);
  return ok(await importMovie(await getDb(), tmdbId), 201);
});
