// Release plans: the right to show an approved movie at one cinema for a period (Java: movie_availability).
// PLANNED → OPEN (customers see it, showtimes can be generated) → SUSPENDED (hidden, no new showtimes) → CLOSED.
import type { Db } from 'mongodb';

import { clusterNameOf, clusterOf } from './cinema';
import { HttpError } from './http';
import { reserveIds } from './ids';
import type { MovieDoc, ReleasePlanDoc, SeatLockDoc, ShowtimeDoc } from './models';
import { movieTitleOf } from './showtimes';

export type PlanStatus = ReleasePlanDoc['status'];

const plans = (db: Db) => db.collection<ReleasePlanDoc>('release_plans');

const NEXT: Record<PlanStatus, PlanStatus[]> = {
  PLANNED: ['OPEN', 'CLOSED'],
  OPEN: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function planDto(p: ReleasePlanDoc, movie?: MovieDoc) {
  return {
    planId: p._id,
    movieId: p.movieId,
    movieTitle: movie ? movieTitleOf(movie) : undefined,
    posterUrl: movie?.thumbnailUrl ?? movie?.posterUrl,
    releaseDate: movie?.releaseDate,
    clusterId: p.clusterId,
    clusterName: clusterNameOf(p.clusterId),
    status: p.status,
    showingStartDate: p.showingStartDate,
    showingEndDate: p.showingEndDate,
    note: p.note,
    allowedTransitions: NEXT[p.status],
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listPlans(db: Db, f: { clusterId?: number; movieId?: number; status?: PlanStatus }) {
  const filter: Record<string, unknown> = {};
  if (f.clusterId) filter.clusterId = f.clusterId;
  if (f.movieId) filter.movieId = f.movieId;
  if (f.status) filter.status = f.status;
  const rows = await plans(db).find(filter).sort({ showingStartDate: -1, clusterId: 1 }).limit(500).toArray();
  const movies = await db.collection<MovieDoc>('movies').find({ _id: { $in: [...new Set(rows.map((r) => r.movieId))] } }).toArray();
  const byId = new Map(movies.map((m) => [m._id, m]));
  return rows.map((r) => planDto(r, byId.get(r.movieId)));
}

export interface PlanInput {
  movieId: number;
  clusterIds: number[];
  showingStartDate: string;
  showingEndDate?: string;
  status: 'PLANNED' | 'OPEN';
  note?: string;
}

/** Creates one plan per cinema. A cinema that already has a plan for the movie is reported, not changed. */
export async function createPlans(db: Db, input: PlanInput) {
  const movie = await db.collection<MovieDoc>('movies').findOne({ _id: input.movieId });
  if (!movie) throw new HttpError(404, 'Không tìm thấy phim.', 2002);
  if (movie.status !== 'APPROVED') throw new HttpError(409, 'Chỉ phim đã duyệt mới được mở kế hoạch phát hành.', 3101);
  if (input.showingEndDate && input.showingEndDate < input.showingStartDate) {
    throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu.');
  }
  const created: ReturnType<typeof planDto>[] = [];
  const skipped: { clusterId: number; clusterName: string; reason: string }[] = [];
  const now = new Date();
  for (const clusterId of [...new Set(input.clusterIds)]) {
    if (!clusterOf(clusterId)) {
      skipped.push({ clusterId, clusterName: String(clusterId), reason: 'Rạp không tồn tại.' });
      continue;
    }
    if (await plans(db).findOne({ movieId: input.movieId, clusterId })) {
      skipped.push({ clusterId, clusterName: clusterNameOf(clusterId), reason: 'Rạp đã có kế hoạch cho phim này.' });
      continue;
    }
    const doc: ReleasePlanDoc = {
      _id: await reserveIds(db, 'release_plans', 1),
      movieId: input.movieId,
      clusterId,
      status: input.status,
      showingStartDate: input.showingStartDate,
      showingEndDate: input.showingEndDate,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await plans(db).insertOne(doc);
      created.push(planDto(doc, movie));
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
      skipped.push({ clusterId, clusterName: clusterNameOf(clusterId), reason: 'Rạp đã có kế hoạch cho phim này.' });
    }
  }
  return { created, skipped };
}

export interface PlanPatch {
  status?: PlanStatus;
  showingStartDate?: string;
  showingEndDate?: string | null;
  note?: string;
}

/**
 * Changes dates or moves the plan along its lifecycle. Suspending or closing also suspends the future
 * showtimes of that movie at that cinema that have no tickets sold (sold ones keep running).
 */
export async function updatePlan(db: Db, planId: number, patch: PlanPatch) {
  const plan = await plans(db).findOne({ _id: planId });
  if (!plan) throw new HttpError(404, 'Không tìm thấy kế hoạch phát hành.', 3102);
  const set: Partial<ReleasePlanDoc> = { updatedAt: new Date() };
  const unset: Record<string, ''> = {};

  if (patch.status && patch.status !== plan.status) {
    if (!NEXT[plan.status].includes(patch.status)) {
      throw new HttpError(409, `Không thể chuyển kế hoạch từ ${plan.status} sang ${patch.status}.`, 3103);
    }
    set.status = patch.status;
  }
  if (patch.showingStartDate) set.showingStartDate = patch.showingStartDate;
  if (patch.showingEndDate === null) unset.showingEndDate = '';
  else if (patch.showingEndDate) set.showingEndDate = patch.showingEndDate;
  if (patch.note !== undefined) set.note = patch.note;

  const start = set.showingStartDate ?? plan.showingStartDate;
  const end = patch.showingEndDate === null ? undefined : (set.showingEndDate ?? plan.showingEndDate);
  if (end && end < start) throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu.');

  await plans(db).updateOne({ _id: planId }, Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set });

  let suspendedShowtimes = 0;
  if (set.status === 'SUSPENDED' || set.status === 'CLOSED') {
    const future = await db
      .collection<ShowtimeDoc>('showtimes')
      .find({ movieId: plan.movieId, clusterId: plan.clusterId, startAt: { $gt: new Date() }, status: { $in: ['ON_SALE', 'SCHEDULED'] } }, { projection: { _id: 1 } })
      .toArray();
    const ids = future.map((f) => f._id);
    const sold = new Set(await db.collection<SeatLockDoc>('seat_locks').distinct('showtimeId', { showtimeId: { $in: ids }, status: 'SOLD' }));
    const toSuspend = ids.filter((id) => !sold.has(id));
    if (toSuspend.length) {
      const res = await db.collection<ShowtimeDoc>('showtimes').updateMany({ _id: { $in: toSuspend } }, { $set: { status: 'SUSPENDED' } });
      suspendedShowtimes = res.modifiedCount;
      await db.collection('bookings').updateMany({ showtimeId: { $in: toSuspend }, status: 'PENDING_PAYMENT' }, { $set: { status: 'CANCELLED' } });
      await db.collection('seat_locks').deleteMany({ showtimeId: { $in: toSuspend }, status: 'HELD' });
    }
  }
  const movie = await db.collection<MovieDoc>('movies').findOne({ _id: plan.movieId });
  return { ...planDto({ ...plan, ...set, ...(unset.showingEndDate === '' ? { showingEndDate: undefined } : {}) }, movie ?? undefined), suspendedShowtimes };
}

/** Only a plan that never produced a showtime can be deleted; otherwise it is closed. */
export async function deletePlan(db: Db, planId: number) {
  const plan = await plans(db).findOne({ _id: planId });
  if (!plan) throw new HttpError(404, 'Không tìm thấy kế hoạch phát hành.', 3102);
  const used = await db.collection<ShowtimeDoc>('showtimes').countDocuments({ movieId: plan.movieId, clusterId: plan.clusterId });
  if (used) throw new HttpError(409, 'Kế hoạch đã có suất chiếu, hãy đóng kế hoạch thay vì xoá.', 3104);
  await plans(db).deleteOne({ _id: planId });
  return { planId };
}

/** Open plans valid on `date` for these cinemas: key `${movieId}|${clusterId}`. */
export async function openPlansOn(db: Db, clusterIds: number[], movieIds: number[]) {
  const rows = await plans(db).find({ clusterId: { $in: clusterIds }, movieId: { $in: movieIds } }).toArray();
  return new Map(rows.map((r) => [`${r.movieId}|${r.clusterId}`, r]));
}

export const planCovers = (p: ReleasePlanDoc | undefined, date: string) =>
  !!p && p.status === 'OPEN' && p.showingStartDate <= date && (!p.showingEndDate || p.showingEndDate >= date);
