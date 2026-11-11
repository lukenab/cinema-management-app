import { z } from 'zod';

import { requireAdmin } from '@/server/auth';
import { getAdminMovie, updateMovie } from '@/server/adminMovies';
import { isIsoDate } from '@/server/cinema';
import { getDb } from '@/server/db';
import { HttpError, intParam, ok, parseBody, route } from '@/server/http';

export const GET = route(async (request, { movieId }) => {
  await requireAdmin(request);
  const movie = await getAdminMovie(await getDb(), intParam(movieId, 'Không tìm thấy phim.', 2002));
  if (!movie) throw new HttpError(404, 'Không tìm thấy phim.', 2002);
  return ok(movie);
});

const Patch = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên phim.').max(200).optional(),
  synopsis: z.string().trim().min(10, 'Nội dung tối thiểu 10 ký tự.').max(3000).optional(),
  tagline: z.string().trim().max(300).optional(),
  durationMinutes: z.number().int().min(30, 'Thời lượng tối thiểu 30 phút.').max(300, 'Thời lượng tối đa 300 phút.').optional(),
  releaseDate: z.string().refine(isIsoDate, 'Ngày khởi chiếu không hợp lệ.').optional(),
  ageRatingCode: z.enum(['P', 'K', 'T13', 'T16', 'T18']).optional(),
  trailerUrl: z.string().url('Link trailer không hợp lệ.').nullable().optional(),
  formats: z.array(z.enum(['2D', '3D'])).optional(),
  priorityOverride: z.number().int().min(0).max(100).nullable().optional(),
});

/** Edit the movie's details (checked before approval, still editable afterwards). */
export const PATCH = route(async (request, { movieId }) => {
  await requireAdmin(request);
  return ok(await updateMovie(await getDb(), intParam(movieId, 'Không tìm thấy phim.', 2002), await parseBody(request, Patch)));
});
