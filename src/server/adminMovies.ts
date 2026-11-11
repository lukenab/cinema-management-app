import type { Db } from "mongodb";

import { nextId } from "./ids";
import { HttpError } from "./http";
import type {
  BookingDoc,
  MovieDoc,
  MovieStatus,
  ReleasePlanDoc,
  ShowtimeDoc,
} from "./models";
import { fetchMovieDoc, tmdbPage } from "./tmdb";

const movies = (db: Db) => db.collection<MovieDoc>("movies");

const viTitle = (
  m: Pick<MovieDoc, "title" | "originalTitle" | "translations">,
) =>
  m.translations.find((t) => t.languageCode === "vi")?.title ||
  m.title ||
  m.originalTitle;

// ── TMDB catalogue ─────────────────────────────────────────────────────────

/** TMDB list / search results, each marked with whether the movie is already in the system. */
export async function tmdbCatalogue(
  db: Db,
  kind: "now-playing" | "upcoming" | "search",
  page: number,
  query?: string,
) {
  const items = await tmdbPage(
    kind === "now-playing" ? "now_playing" : kind,
    page,
    query,
  );
  const local = await movies(db)
    .find(
      { tmdbId: { $in: items.map((i) => i.id) } },
      { projection: { tmdbId: 1 } },
    )
    .toArray();
  const localByTmdb = new Map(local.map((m) => [m.tmdbId, m._id]));
  return items.map((i) => ({
    tmdbId: i.id,
    title: i.title,
    originalTitle: i.original_title ?? i.title,
    releaseDate: i.release_date || undefined,
    posterUrl: i.poster_path
      ? `https://image.tmdb.org/t/p/w185${i.poster_path}`
      : undefined,
    overview: i.overview || undefined,
    alreadyImported: localByTmdb.has(i.id),
    localMovieId: localByTmdb.get(i.id),
  }));
}

/** What would be imported, so the admin can check it first. Nothing is saved. */
export async function tmdbPreview(db: Db, tmdbId: number) {
  const doc = await fetchMovieDoc(tmdbId);
  const existing = await movies(db).findOne(
    { tmdbId },
    { projection: { _id: 1 } },
  );
  const warnings: string[] = [];
  if (!doc.durationMinutes)
    warnings.push(
      "TMDB chưa có thời lượng. Bạn cần nhập thời lượng trước khi duyệt phim.",
    );
  if (!doc.posterUrl) warnings.push("Phim chưa có poster.");
  if (!doc.synopsis) warnings.push("Phim chưa có nội dung mô tả.");
  return {
    tmdbId: doc.tmdbId,
    title: viTitle(doc),
    originalTitle: doc.originalTitle,
    originalLanguage: doc.originalLanguage,
    durationMinutes: doc.durationMinutes,
    releaseDate: doc.releaseDate,
    country: doc.country,
    posterUrl: doc.posterUrl,
    thumbnailUrl: doc.thumbnailUrl,
    backdropUrl: doc.backdropUrl,
    overview: doc.synopsis,
    tagline: doc.tagline,
    trailerUrl: doc.trailerUrl,
    genres: doc.genres.map((g) => g.name.replace(/^Phim\s+/i, "")),
    ageRating: doc.ageRating,
    cast: doc.cast.map((c) => ({
      tmdbId: c.personId,
      fullName: c.fullName,
      roleType: c.roleType,
      photoUrl: c.photoUrl,
    })),
    popularityScore: doc.popularityScore,
    warnings,
    localMovieId: existing?._id,
  };
}

// ── Local movies ───────────────────────────────────────────────────────────

/** What still blocks approval (empty = can be approved). */
function approvalProblems(
  m: Pick<
    MovieDoc,
    "durationMinutes" | "posterUrl" | "synopsis" | "releaseDate" | "ageRating"
  >,
): string[] {
  const problems: string[] = [];
  if (!m.durationMinutes) problems.push("Chưa có thời lượng phim.");
  if (!m.posterUrl) problems.push("Chưa có poster.");
  if (!m.synopsis) problems.push("Chưa có nội dung tóm tắt.");
  if (!m.releaseDate) problems.push("Chưa có ngày khởi chiếu.");
  if (!m.ageRating) problems.push("Chưa có phân loại độ tuổi.");
  return problems;
}

export function adminMovieDto(
  m: MovieDoc,
  stats?: { openPlans: number; upcomingShowtimes: number },
) {
  const vi = m.translations.find((t) => t.languageCode === "vi");
  return {
    movieId: m._id,
    tmdbId: m.tmdbId,
    title: viTitle(m),
    originalTitle: m.originalTitle,
    durationMinutes: m.durationMinutes,
    releaseDate: m.releaseDate,
    status: m.status,
    ageRating: m.ageRating
      ? {
          ratingCode: m.ageRating.ratingCode,
          code: m.ageRating.ratingCode,
          minAge: m.ageRating.minAge,
        }
      : undefined,
    posterUrl: m.posterUrl,
    thumbnailUrl: m.thumbnailUrl,
    backdropUrl: m.backdropUrl,
    trailerUrl: m.trailerUrl,
    synopsis: vi?.synopsis || m.synopsis,
    tagline: vi?.tagline || m.tagline,
    country: m.country,
    originalLanguage: m.originalLanguage,
    formats: m.formats ?? ["2D"],
    popularityScore: m.popularityScore,
    priorityOverride: m.priorityOverride,
    genres: m.genres.map((g) => ({
      genreId: g.genreId,
      genreName: g.name.replace(/^Phim\s+/i, ""),
    })),
    cast: m.cast
      .slice(0, 8)
      .map((c) => ({ fullName: c.fullName, roleType: c.roleType })),
    approvalProblems: approvalProblems(m),
    approvedAt: m.approvedAt?.toISOString(),
    createdAt: m.createdAt.toISOString(),
    openPlans: stats?.openPlans,
    upcomingShowtimes: stats?.upcomingShowtimes,
  };
}

async function statsOf(db: Db, ids: number[]) {
  const [plans, shows] = await Promise.all([
    db
      .collection<ReleasePlanDoc>("release_plans")
      .aggregate<{ _id: number; n: number }>([
        { $match: { movieId: { $in: ids }, status: "OPEN" } },
        { $group: { _id: "$movieId", n: { $sum: 1 } } },
      ])
      .toArray(),
    db
      .collection<ShowtimeDoc>("showtimes")
      .aggregate<{ _id: number; n: number }>([
        {
          $match: {
            movieId: { $in: ids },
            status: "ON_SALE",
            startAt: { $gt: new Date() },
          },
        },
        { $group: { _id: "$movieId", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const p = new Map(plans.map((r) => [r._id, r.n]));
  const s = new Map(shows.map((r) => [r._id, r.n]));
  return (id: number) => ({
    openPlans: p.get(id) ?? 0,
    upcomingShowtimes: s.get(id) ?? 0,
  });
}

export async function listAdminMovies(db: Db, status?: MovieStatus) {
  const rows = await movies(db)
    .find(status ? { status } : {})
    .sort({ _id: -1 })
    .toArray();
  const stats = await statsOf(
    db,
    rows.map((r) => r._id),
  );
  return rows.map((m) => adminMovieDto(m, stats(m._id)));
}

export async function getAdminMovie(db: Db, id: number) {
  const m = await movies(db).findOne({ _id: id });
  return m ? adminMovieDto(m, (await statsOf(db, [id]))(id)) : null;
}

/**
 * Imports a TMDB movie as a DRAFT with every field TMDB has filled in (Vietnamese text, runtime, age rating,
 * cast, trailer, popularity). The admin checks / corrects it and approves it; nobody sees it before that.
 */
export async function importMovie(db: Db, tmdbId: number) {
  const existing = await movies(db).findOne({ tmdbId });
  if (existing)
    throw new HttpError(409, "Phim này đã có trong hệ thống.", 2010, {
      movieId: existing._id,
    });
  const doc = await fetchMovieDoc(tmdbId);
  const movie: MovieDoc = {
    ...doc,
    _id: await nextId(db, "movies"),
    status: "DRAFT",
    formats: ["2D"],
    createdAt: new Date(),
  };
  await movies(db).insertOne(movie);
  return adminMovieDto(movie, { openPlans: 0, upcomingShowtimes: 0 });
}

const AGE_RATINGS: Record<string, number> = {
  P: 0,
  K: 0,
  T13: 13,
  T16: 16,
  T18: 18,
};

export interface MoviePatch {
  title?: string;
  synopsis?: string;
  tagline?: string;
  durationMinutes?: number;
  releaseDate?: string;
  ageRatingCode?: string;
  trailerUrl?: string | null;
  formats?: string[];
  priorityOverride?: number | null;
}

/** Edits the movie's details (draft or approved). Title / synopsis / tagline are the Vietnamese texts. */
export async function updateMovie(db: Db, id: number, patch: MoviePatch) {
  const movie = await movies(db).findOne({ _id: id });
  if (!movie) throw new HttpError(404, "Không tìm thấy phim.", 2002);
  if (movie.status === "ARCHIVED")
    throw new HttpError(409, "Phim đã lưu trữ, không thể chỉnh sửa.", 2014);

  const next: MovieDoc = {
    ...movie,
    translations: movie.translations.map((t) => ({ ...t })),
  };
  let vi = next.translations.find((t) => t.languageCode === "vi");
  if (!vi) {
    vi = { languageCode: "vi" };
    next.translations.push(vi);
  }
  if (patch.title !== undefined) {
    vi.title = patch.title;
    next.title = patch.title;
  }
  if (patch.synopsis !== undefined) {
    vi.synopsis = patch.synopsis;
    next.synopsis = patch.synopsis;
  }
  if (patch.tagline !== undefined) {
    vi.tagline = patch.tagline || undefined;
    next.tagline = patch.tagline || undefined;
  }
  if (patch.durationMinutes !== undefined)
    next.durationMinutes = patch.durationMinutes;
  if (patch.releaseDate !== undefined) next.releaseDate = patch.releaseDate;
  if (patch.trailerUrl !== undefined)
    next.trailerUrl = patch.trailerUrl || undefined;
  if (patch.formats !== undefined)
    next.formats = [...new Set(["2D", ...patch.formats])].filter(
      (f) => f === "2D" || f === "3D",
    );
  if (patch.priorityOverride !== undefined)
    next.priorityOverride = patch.priorityOverride ?? undefined;
  if (patch.ageRatingCode !== undefined) {
    if (!(patch.ageRatingCode in AGE_RATINGS))
      throw new HttpError(400, "Phân loại độ tuổi không hợp lệ.");
    next.ageRating = {
      ratingCode: patch.ageRatingCode,
      minAge: AGE_RATINGS[patch.ageRatingCode],
    };
  }

  const { _id, ...rest } = next;
  const unset: Record<string, ""> = {};
  for (const k of ["tagline", "trailerUrl", "priorityOverride"] as const) {
    if (rest[k] === undefined) {
      unset[k] = "";
      delete rest[k];
    }
  }
  await movies(db).updateOne(
    { _id },
    Object.keys(unset).length ? { $set: rest, $unset: unset } : { $set: rest },
  );
  return getAdminMovie(db, id);
}

/** DRAFT → APPROVED once every required field is filled. Customers still only see it through an open release plan. */
export async function approveMovie(db: Db, id: number) {
  const movie = await movies(db).findOne({ _id: id });
  if (!movie) throw new HttpError(404, "Không tìm thấy phim.", 2002);
  if (movie.status !== "DRAFT")
    throw new HttpError(409, "Chỉ phim nháp mới cần duyệt.", 2015);
  const problems = approvalProblems(movie);
  if (problems.length)
    throw new HttpError(409, `Chưa thể duyệt: ${problems.join(" ")}`, 2011, {
      problems,
    });
  await movies(db).updateOne(
    { _id: id, status: "DRAFT" },
    { $set: { status: "APPROVED", approvedAt: new Date() } },
  );
  return getAdminMovie(db, id);
}

/** → ARCHIVED: cancels unsold future showtimes and closes its release plans. Not allowed while future tickets are sold. */
export async function archiveMovie(db: Db, id: number) {
  const movie = await movies(db).findOne({ _id: id });
  if (!movie) throw new HttpError(404, "Không tìm thấy phim.", 2002);
  if (movie.status === "ARCHIVED") return getAdminMovie(db, id);
  const booked = await db
    .collection<BookingDoc>("bookings")
    .countDocuments({
      movieId: id,
      status: "CONFIRMED",
      startAt: { $gt: new Date() },
    });
  if (booked)
    throw new HttpError(
      409,
      `Phim còn ${booked} đơn đặt vé cho suất chưa chiếu nên chưa thể lưu trữ.`,
      2013,
    );
  const future = {
    movieId: id,
    startAt: { $gt: new Date() },
    status: {
      $in: ["ON_SALE", "SCHEDULED", "SUSPENDED"] as ShowtimeDoc["status"][],
    },
  };
  const ids = (
    await db
      .collection<ShowtimeDoc>("showtimes")
      .find(future, { projection: { _id: 1 } })
      .toArray()
  ).map((s) => s._id);
  if (ids.length) {
    await db
      .collection<ShowtimeDoc>("showtimes")
      .updateMany({ _id: { $in: ids } }, { $set: { status: "CANCELLED" } });
    await db
      .collection("bookings")
      .updateMany(
        { showtimeId: { $in: ids }, status: "PENDING_PAYMENT" },
        { $set: { status: "CANCELLED" } },
      );
    await db
      .collection("seat_locks")
      .deleteMany({ showtimeId: { $in: ids }, status: "HELD" });
  }
  await db
    .collection<ReleasePlanDoc>("release_plans")
    .updateMany(
      { movieId: id, status: { $ne: "CLOSED" } },
      { $set: { status: "CLOSED", updatedAt: new Date() } },
    );
  await movies(db).updateOne({ _id: id }, { $set: { status: "ARCHIVED" } });
  return getAdminMovie(db, id);
}
