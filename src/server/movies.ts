import type { Db } from 'mongodb';

import { nextId } from './ids';
import { SEED_CLUSTERS } from './cinema';
import type { MovieDoc, ReleasePlanDoc, ShowtimeDoc } from './models';
import { createPlans } from './releasePlans';
import { fetchMovieDoc, listTmdb } from './tmdb';

const VN_TZ = 'Asia/Ho_Chi_Minh';

/** Today's date in Vietnam as YYYY-MM-DD. */
export const vnToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ }).format(new Date());

/** By release date only (used where no cinema is involved, e.g. TMDB seeding). */
export const displayStatusOf = (m: Pick<MovieDoc, 'releaseDate'>, today = vnToday()): 'NOW_SHOWING' | 'COMING_SOON' =>
  m.releaseDate && m.releaseDate > today ? 'COMING_SOON' : 'NOW_SHOWING';

/** movieId -> earliest upcoming on-sale showtime (at one cinema, or anywhere). */
async function nextShowtimes(db: Db, clusterId?: number, movieIds?: number[]): Promise<Map<number, Date>> {
  const rows = await db
    .collection<ShowtimeDoc>('showtimes')
    .aggregate<{ _id: number; next: Date }>([
      {
        $match: {
          status: 'ON_SALE',
          startAt: { $gte: new Date() },
          ...(clusterId ? { clusterId } : {}),
          ...(movieIds ? { movieId: { $in: movieIds } } : {}),
        },
      },
      { $group: { _id: '$movieId', next: { $min: '$startAt' } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.next]));
}

/**
 * Which approved movies customers see: a movie is listed at a cinema while its release plan there is OPEN
 * (and not past its end date). It is "Đang chiếu" once it has a showtime on sale there, otherwise "Sắp chiếu".
 */
async function visibleMovieIds(db: Db, clusterId?: number): Promise<Set<number>> {
  const today = vnToday();
  const plans = await db
    .collection<ReleasePlanDoc>('release_plans')
    .find({
      status: 'OPEN',
      ...(clusterId ? { clusterId } : {}),
      $or: [{ showingEndDate: { $exists: false } }, { showingEndDate: { $gte: today } }],
    }, { projection: { movieId: 1 } })
    .toArray();
  return new Set(plans.map((p) => p.movieId));
}

function toPublic(m: MovieDoc, next: Date | undefined, clusterId: number | undefined, detail: boolean) {
  const vi = m.translations.find((t) => t.languageCode === 'vi');
  const base = {
    movieId: m._id,
    originalTitle: m.originalTitle,
    title: vi?.title || m.title,
    posterUrl: m.posterUrl,
    thumbnailUrl: m.thumbnailUrl,
    backdropUrl: m.backdropUrl,
    trailerUrl: m.trailerUrl,
    releaseDate: m.releaseDate,
    synopsis: vi?.synopsis || m.synopsis,
    durationMinutes: m.durationMinutes,
    formats: m.formats ?? ['2D'],
    genres: m.genres.map((g) => {
      const name = g.name.replace(/^Phim\s+/i, ''); // TMDB's Vietnamese names read "Phim Hành Động"
      return { genreId: g.genreId, name, genreName: name };
    }),
    displayStatus: next ? ('NOW_SHOWING' as const) : ('COMING_SOON' as const),
    clusterId,
    nextShowtimeAt: next?.toISOString(),
    bookingAvailable: !!next,
    ageRating: m.ageRating ? { ratingCode: m.ageRating.ratingCode, code: m.ageRating.ratingCode, minAge: m.ageRating.minAge } : undefined,
  };
  if (!detail) return base;
  return { ...base, tagline: vi?.tagline || m.tagline, country: m.country, originalLanguage: m.originalLanguage, cast: m.cast, translations: m.translations };
}

export async function listPublicMovies(db: Db, clusterId?: number) {
  const ids = [...(await visibleMovieIds(db, clusterId))];
  const [movies, next] = await Promise.all([
    db.collection<MovieDoc>('movies').find({ _id: { $in: ids }, status: 'APPROVED' }).sort({ releaseDate: -1 }).toArray(),
    nextShowtimes(db, clusterId, ids),
  ]);
  return movies.map((m) => toPublic(m, next.get(m._id), clusterId, false));
}

export async function getPublicMovie(db: Db, movieId: number, clusterId?: number) {
  const movie = await db.collection<MovieDoc>('movies').findOne({ _id: movieId, status: 'APPROVED' });
  if (!movie) return null;
  // A movie opened by link stays readable even at a cinema that does not show it (it just has no showtimes).
  if (!(await visibleMovieIds(db)).has(movieId)) return null;
  const next = (await nextShowtimes(db, clusterId, [movieId])).get(movieId);
  return toPublic(movie, next, clusterId, true);
}

// ── TMDB seeding ───────────────────────────────────────────────────────────

export interface SeedResult {
  imported: { tmdbId: number; title: string; releaseDate?: string; bucket: string }[];
  existing: number;
  skipped: { tmdbId: number; title: string; reason: string }[];
}

/**
 * Demo data: imports the newest TMDB movies for Vietnam, approves them and opens a release plan at every
 * cinema (from the release date). Safe to run again.
 */
export async function seedFromTmdb(db: Db, nowCount: number, upcomingCount: number): Promise<SeedResult> {
  const movies = db.collection<MovieDoc>('movies');
  const today = vnToday();
  const result: SeedResult = { imported: [], existing: 0, skipped: [] };

  const buckets: { name: 'NOW_SHOWING' | 'COMING_SOON'; kind: 'now_playing' | 'upcoming'; wanted: number }[] = [
    { name: 'NOW_SHOWING', kind: 'now_playing', wanted: nowCount },
    { name: 'COMING_SOON', kind: 'upcoming', wanted: upcomingCount },
  ];

  for (const { name, kind, wanted } of buckets) {
    if (wanted <= 0) continue;
    let have = await movies.countDocuments({
      status: 'APPROVED',
      releaseDate: name === 'COMING_SOON' ? { $gt: today } : { $lte: today },
    });
    const candidates = await listTmdb(kind);
    // Upcoming: soonest first. Now playing: newest first (listTmdb already sorts newest first).
    if (name === 'COMING_SOON') candidates.reverse();

    for (const item of candidates) {
      if (have >= wanted) break;
      if (await movies.findOne({ tmdbId: item.id })) {
        result.existing++;
        continue;
      }
      try {
        const doc = await fetchMovieDoc(item.id);
        // TMDB's lists and Vietnam's release dates can disagree; the other bucket will pick it up.
        if (displayStatusOf(doc, today) !== name) continue;
        if (!doc.posterUrl || !doc.synopsis) {
          result.skipped.push({ tmdbId: item.id, title: doc.title, reason: 'thiếu poster hoặc nội dung' });
          continue;
        }
        const now = new Date();
        const movieId = await nextId(db, 'movies');
        await movies.insertOne({ ...doc, _id: movieId, status: 'APPROVED', formats: ['2D'], createdAt: now, approvedAt: now });
        await createPlans(db, {
          movieId,
          clusterIds: SEED_CLUSTERS.map((c) => c._id),
          showingStartDate: doc.releaseDate && doc.releaseDate > today ? doc.releaseDate : today,
          status: 'OPEN',
        });
        result.imported.push({ tmdbId: item.id, title: doc.title, releaseDate: doc.releaseDate, bucket: name });
        have++;
      } catch (e) {
        result.skipped.push({ tmdbId: item.id, title: item.title, reason: e instanceof Error ? e.message : 'lỗi không rõ' });
      }
    }
  }
  return result;
}
