// A scheduling run: build candidates → score → select (Legacy Greedy), then save the chosen showtimes as
// SCHEDULED with prices from each cinema's price book, and keep a report of what was chosen and why the
// rest was not. Publishing the run opens its showtimes for sale.
import type { Db } from 'mongodb';

import { addDays, clusterNameOf, fromVn, roomOf, vnParts } from '../cinema';
import { HttpError } from '../http';
import { reserveIds } from '../ids';
import type { GenerationRunDoc, MovieDoc, PriceBookDoc, ShowtimeDoc, SkipReason } from '../models';
import { resolvePrice } from '../pricing';
import { openPlansOn } from '../releasePlans';
import { movieTitleOf } from '../showtimes';
import { buildCandidates } from './candidates';
import { scoreAndRank } from './scorer';
import { select } from './selector';
import { DEFAULT_POLICY, type Fixed, type Rejection, type SchedulingPolicy } from './types';

export { DEFAULT_POLICY } from './types';

const runs = (db: Db) => db.collection<GenerationRunDoc>('generation_runs');
const SAMPLES_PER_REASON = 40;
const MAX_EXCLUSIONS = 300;

export interface RunInput {
  startDate: string;
  endDate: string;
  clusterIds: number[];
  movieIds: number[];
  policy?: Partial<SchedulingPolicy>;
  publish: boolean;
}

export async function runScheduling(db: Db, input: RunInput, createdBy: string) {
  const started = Date.now();
  const days = Math.round((Date.parse(input.endDate) - Date.parse(input.startDate)) / 86_400_000) + 1;
  if (days < 1) throw new HttpError(400, 'Ngày kết thúc phải từ ngày bắt đầu trở đi.');
  if (days > 14) throw new HttpError(400, 'Mỗi lần chỉ tạo tối đa 14 ngày.');
  const policy: SchedulingPolicy = { ...DEFAULT_POLICY, ...input.policy };

  const movies = await db
    .collection<MovieDoc>('movies')
    .find({ _id: { $in: input.movieIds }, status: 'APPROVED' })
    .toArray();
  if (!movies.length) throw new HttpError(409, 'Chưa chọn phim đã duyệt nào.', 3201);
  const moviesById = new Map(movies.map((m) => [m._id, m]));
  const plans = await openPlansOn(db, input.clusterIds, movies.map((m) => m._id));

  // Showtimes already in the range (late shows of the day before included) block rooms and count to quotas.
  const existing = await db
    .collection<ShowtimeDoc>('showtimes')
    .find({
      clusterId: { $in: input.clusterIds },
      status: { $ne: 'CANCELLED' },
      startAt: { $gte: fromVn(addDays(input.startDate, -1), 0), $lt: fromVn(addDays(input.endDate, 1), 360) },
    })
    .toArray();
  const fixed: Fixed[] = existing.map((s) => ({ movieId: s.movieId, clusterId: s.clusterId, roomId: s.roomId, date: vnParts(s.startAt).date, start: s.startAt.getTime(), end: s.endAt.getTime() }));

  const now = new Date();
  const built = buildCandidates({ startDate: input.startDate, days, clusterIds: input.clusterIds, movies, plans, fixed, policy, now });
  const ranked = scoreAndRank(built.candidates, moviesById);
  const { selected, rejected } = select(ranked, fixed, policy);
  const allRejected: Rejection[] = [...built.rejections, ...rejected];

  // Save the chosen showtimes with the price of their slot.
  const books = new Map(
    (await db.collection<PriceBookDoc>('price_books').find({ _id: { $in: input.clusterIds } }).toArray()).map((b) => [b._id, b]),
  );
  const runId = await reserveIds(db, 'generation_runs', 1);
  const firstId = selected.length ? await reserveIds(db, 'showtimes', selected.length) : 0;
  const status = input.publish ? 'ON_SALE' : 'SCHEDULED';
  const docs: ShowtimeDoc[] = selected
    .sort((a, b) => a.start - b.start || a.roomId - b.roomId)
    .map((c, i) => {
      const movie = moviesById.get(c.movieId)!;
      const book = books.get(c.clusterId);
      const price = book ? resolvePrice(book, c.date, c.startMinutes, c.format) : null;
      const vi = movie.originalLanguage === 'vi';
      return {
        _id: firstId + i,
        movieId: c.movieId,
        clusterId: c.clusterId,
        roomId: c.roomId,
        roomName: roomOf(c.roomId)?.name ?? `Phòng ${c.roomId}`,
        startAt: new Date(c.start),
        endAt: new Date(c.end),
        format: c.format,
        audioLanguageCode: vi ? 'vi' : movie.originalLanguage || 'en',
        subtitleLanguageCode: vi ? undefined : 'vi',
        basePrice: price?.basePrice ?? 75_000,
        seatPrices: price?.seatPrices,
        priceRateCode: price?.rateCode,
        generationRunId: runId,
        status,
        createdAt: now,
      };
    });
  if (docs.length) await db.collection<ShowtimeDoc>('showtimes').insertMany(docs);

  // Report.
  const tally = <T extends string | number>(items: T[]) => {
    const m = new Map<T, number>();
    items.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
    return m;
  };
  const rejectedByReason = Object.fromEntries(tally(allRejected.map((r) => r.reason))) as Partial<Record<SkipReason, number>>;
  const excludedByReason = Object.fromEntries(tally(built.exclusions.map((e) => e.reason))) as Partial<Record<SkipReason, number>>;
  const candidatesPerMovie = tally([...selected, ...allRejected.map((r) => r.candidate)].map((c) => c.movieId));
  const selectedPerMovie = tally(selected.map((c) => c.movieId));
  const candidatesPerCluster = tally([...selected, ...allRejected.map((r) => r.candidate)].map((c) => c.clusterId));
  const selectedPerCluster = tally(selected.map((c) => c.clusterId));
  const selectedPerDay = tally(selected.map((c) => c.date));

  // A few rejections per reason, best scores first: enough to see why good slots were not taken.
  const samples: GenerationRunDoc['rejectionSamples'] = [];
  const byReason = new Map<SkipReason, Rejection[]>();
  for (const r of allRejected) {
    const list = byReason.get(r.reason);
    if (list) list.push(r);
    else byReason.set(r.reason, [r]);
  }
  for (const list of byReason.values()) {
    list
      .sort((a, b) => b.candidate.score - a.candidate.score)
      .slice(0, SAMPLES_PER_REASON)
      .forEach((r) => samples.push({ movieId: r.candidate.movieId, clusterId: r.candidate.clusterId, roomId: r.candidate.roomId, startAt: new Date(r.candidate.start), format: r.candidate.format, score: r.candidate.score, reason: r.reason }));
  }

  const byStart = new Map(selected.map((c) => [`${c.roomId}|${c.start}`, c]));
  const run: GenerationRunDoc = {
    _id: runId,
    algorithm: 'LEGACY_GREEDY',
    status: 'COMPLETED',
    startDate: input.startDate,
    endDate: input.endDate,
    clusterIds: input.clusterIds,
    movieIds: movies.map((m) => m._id),
    policy: { ...policy },
    summary: {
      candidates: selected.length + allRejected.length,
      selected: selected.length,
      rejected: allRejected.length,
      excluded: built.exclusions.length,
      durationMs: Date.now() - started,
    },
    rejectedByReason,
    excludedByReason,
    perMovie: movies.map((m) => ({
      movieId: m._id,
      title: movieTitleOf(m),
      candidates: candidatesPerMovie.get(m._id) ?? 0,
      selected: selectedPerMovie.get(m._id) ?? 0,
      rejected: (candidatesPerMovie.get(m._id) ?? 0) - (selectedPerMovie.get(m._id) ?? 0),
    })),
    perCluster: input.clusterIds.map((id) => ({
      clusterId: id,
      name: clusterNameOf(id),
      candidates: candidatesPerCluster.get(id) ?? 0,
      selected: selectedPerCluster.get(id) ?? 0,
      rejected: (candidatesPerCluster.get(id) ?? 0) - (selectedPerCluster.get(id) ?? 0),
    })),
    perDay: Array.from({ length: days }, (_, i) => addDays(input.startDate, i)).map((date) => ({ date, selected: selectedPerDay.get(date) ?? 0 })),
    rejectionSamples: samples,
    exclusions: built.exclusions.slice(0, MAX_EXCLUSIONS),
    selectedSamples: docs.map((d) => {
      const c = byStart.get(`${d.roomId}|${d.startAt.getTime()}`)!;
      return { showtimeId: d._id, score: c.score, daypart: c.breakdown.daypart, expectedAttendance: c.breakdown.expectedAttendance, capacity: c.capacity };
    }),
    showtimeIds: docs.map((d) => d._id),
    ...(input.publish ? { publishedAt: now } : {}),
    createdBy,
    createdAt: now,
  };
  await runs(db).insertOne(run);
  return runDetail(db, run);
}

// ── Reading, publishing, discarding ─────────────────────────────────────────

function runSummaryDto(r: GenerationRunDoc, titles: Map<number, string>) {
  return {
    runId: r._id,
    algorithm: r.algorithm,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
    clusters: r.clusterIds.map((id) => ({ clusterId: id, name: clusterNameOf(id) })),
    movies: r.movieIds.map((id) => ({ movieId: id, title: titles.get(id) ?? `#${id}` })),
    summary: r.summary,
    published: !!r.publishedAt,
    publishedAt: r.publishedAt?.toISOString(),
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

async function titlesOf(db: Db, ids: number[]) {
  const movies = await db.collection<MovieDoc>('movies').find({ _id: { $in: [...new Set(ids)] } }).toArray();
  return new Map(movies.map((m) => [m._id, movieTitleOf(m)]));
}

export async function listRuns(db: Db, limit = 30) {
  const rows = await runs(db).find({}, { projection: { rejectionSamples: 0, exclusions: 0, selectedSamples: 0, showtimeIds: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  const titles = await titlesOf(db, rows.flatMap((r) => r.movieIds));
  return rows.map((r) => runSummaryDto(r as GenerationRunDoc, titles));
}

async function runDetail(db: Db, r: GenerationRunDoc) {
  const titles = await titlesOf(db, [...r.movieIds, ...r.rejectionSamples.map((s) => s.movieId), ...r.exclusions.map((e) => e.movieId)]);
  const showtimes = await db
    .collection<ShowtimeDoc>('showtimes')
    .find({ generationRunId: r._id }, { projection: { status: 1 } })
    .toArray();
  const statusCount: Record<string, number> = {};
  showtimes.forEach((s) => (statusCount[s.status] = (statusCount[s.status] ?? 0) + 1));
  const at = (d: Date) => {
    const p = vnParts(d);
    return { date: p.date, time: p.time.slice(0, 5) };
  };
  return {
    ...runSummaryDto(r, titles),
    policy: r.policy,
    rejectedByReason: r.rejectedByReason,
    excludedByReason: r.excludedByReason,
    perMovie: r.perMovie,
    perCluster: r.perCluster,
    perDay: r.perDay ?? [],
    showtimeStatus: statusCount,
    rejectionSamples: r.rejectionSamples.map((s) => ({
      ...s,
      ...at(s.startAt),
      startAt: s.startAt.toISOString(),
      movieTitle: titles.get(s.movieId),
      clusterName: clusterNameOf(s.clusterId),
      roomName: roomOf(s.roomId)?.name,
    })),
    exclusions: r.exclusions.map((e) => ({ ...e, movieTitle: titles.get(e.movieId), clusterName: clusterNameOf(e.clusterId) })),
    selectedSamples: r.selectedSamples ?? [],
    error: r.error,
  };
}

export async function getRun(db: Db, runId: number) {
  const r = await runs(db).findOne({ _id: runId });
  if (!r) throw new HttpError(404, 'Không tìm thấy lần tạo lịch.', 3202);
  return runDetail(db, r);
}

/** Opens the run's showtimes for sale (only those still scheduled and in the future). */
export async function publishRun(db: Db, runId: number) {
  const r = await runs(db).findOne({ _id: runId });
  if (!r) throw new HttpError(404, 'Không tìm thấy lần tạo lịch.', 3202);
  if (r.status !== 'COMPLETED') throw new HttpError(409, 'Lần tạo lịch này không còn hiệu lực.', 3203);
  const res = await db
    .collection<ShowtimeDoc>('showtimes')
    .updateMany({ generationRunId: runId, status: 'SCHEDULED', startAt: { $gt: new Date() } }, { $set: { status: 'ON_SALE' } });
  await runs(db).updateOne({ _id: runId }, { $set: { publishedAt: new Date() } });
  return { ...(await getRun(db, runId)), opened: res.modifiedCount };
}

/** Removes the run's showtimes that were never opened for sale. */
export async function discardRun(db: Db, runId: number) {
  const r = await runs(db).findOne({ _id: runId });
  if (!r) throw new HttpError(404, 'Không tìm thấy lần tạo lịch.', 3202);
  const res = await db.collection<ShowtimeDoc>('showtimes').deleteMany({ generationRunId: runId, status: 'SCHEDULED' });
  const left = await db.collection<ShowtimeDoc>('showtimes').countDocuments({ generationRunId: runId });
  if (!left) await runs(db).updateOne({ _id: runId }, { $set: { status: 'DISCARDED' } });
  return { ...(await getRun(db, runId)), removed: res.deletedCount };
}
