import type { Db } from 'mongodb';

import { capacityOf, clusterNameOf, fromVn, roomOf, vnParts } from './cinema';
import type { MovieDoc, SeatLockDoc, ShowtimeDoc } from './models';

export const movieTitleOf = (m: Pick<MovieDoc, 'title' | 'originalTitle' | 'translations'>): string =>
  m.translations.find((t) => t.languageCode === 'vi')?.title || m.title || m.originalTitle;

/** Seats that cannot be bought right now (sold, or held and not yet expired), per showtime. */
async function unavailableCounts(db: Db, showtimeIds: number[]): Promise<Map<number, number>> {
  if (!showtimeIds.length) return new Map();
  const rows = await db
    .collection<SeatLockDoc>('seat_locks')
    .aggregate<{ _id: number; n: number }>([
      {
        $match: {
          showtimeId: { $in: showtimeIds },
          $or: [{ status: 'SOLD' }, { holdExpiresAt: { $gt: new Date() } }],
        },
      },
      { $group: { _id: '$showtimeId', n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

function showtimeDto(st: ShowtimeDoc, movie: MovieDoc | undefined, unavailable: number) {
  const start = vnParts(st.startAt);
  const end = vnParts(st.endAt);
  const total = capacityOf(roomOf(st.roomId)?.layout);
  return {
    showTimeId: st._id,
    movieId: st.movieId,
    movieName: movie ? movieTitleOf(movie) : '',
    moviePosterUrl: movie?.posterUrl,
    cinemaRoomId: st.roomId,
    cinemaRoomName: st.roomName,
    clusterId: st.clusterId,
    clusterName: clusterNameOf(st.clusterId),
    showDate: start.date,
    startTime: start.time,
    endTime: end.time,
    status: st.status,
    formatCode: st.format,
    audioLanguageCode: st.audioLanguageCode,
    subtitleLanguageCode: st.subtitleLanguageCode,
    totalSeats: total,
    availableSeats: Math.max(0, total - unavailable),
    price: st.seatPrices?.STANDARD ?? st.basePrice,
    seatPrices: st.seatPrices,
    generationRunId: st.generationRunId,
  };
}

async function toDtos(db: Db, showtimes: ShowtimeDoc[]) {
  const movieIds = [...new Set(showtimes.map((s) => s.movieId))];
  const [movies, counts] = await Promise.all([
    db.collection<MovieDoc>('movies').find({ _id: { $in: movieIds } }).toArray(),
    unavailableCounts(db, showtimes.map((s) => s._id)),
  ]);
  const byId = new Map(movies.map((m) => [m._id, m]));
  return showtimes.map((s) => showtimeDto(s, byId.get(s.movieId), counts.get(s._id) ?? 0));
}

/** Showtimes customers can still book for a movie, optionally for one day (Vietnam date) and one cinema. */
export async function listShowtimesByMovie(db: Db, movieId: number, date?: string, clusterId?: number) {
  const now = new Date();
  const from = date ? fromVn(date, 0) : now;
  const filter = {
    movieId,
    ...(clusterId ? { clusterId } : {}),
    status: 'ON_SALE' as const,
    startAt: date ? { $gte: from > now ? from : now, $lt: fromVn(date, 1440) } : { $gte: now },
  };
  const rows = await db.collection<ShowtimeDoc>('showtimes').find(filter).sort({ startAt: 1 }).limit(300).toArray();
  return toDtos(db, rows);
}

export async function getShowtimeDoc(db: Db, showtimeId: number): Promise<ShowtimeDoc | null> {
  return db.collection<ShowtimeDoc>('showtimes').findOne({ _id: showtimeId });
}

export async function getShowtimeDto(db: Db, showtimeId: number) {
  const st = await getShowtimeDoc(db, showtimeId);
  return st ? (await toDtos(db, [st]))[0] : null;
}

// ── Admin ──────────────────────────────────────────────────────────────────

/** Every showtime of one day at one cinema (any status), with how many seats are sold. */
export async function listShowtimesForAdmin(db: Db, date: string, clusterId?: number) {
  const rows = await db
    .collection<ShowtimeDoc>('showtimes')
    .find({ ...(clusterId ? { clusterId } : {}), startAt: { $gte: fromVn(date, 0), $lt: fromVn(date, 1440) } })
    .sort({ startAt: 1, roomId: 1 })
    .toArray();
  const dtos = await toDtos(db, rows);
  const sold = await db
    .collection<SeatLockDoc>('seat_locks')
    .aggregate<{ _id: number; n: number }>([
      { $match: { showtimeId: { $in: rows.map((r) => r._id) }, status: 'SOLD' } },
      { $group: { _id: '$showtimeId', n: { $sum: 1 } } },
    ])
    .toArray();
  const soldBy = new Map(sold.map((s) => [s._id, s.n]));
  return dtos.map((d) => ({ ...d, soldSeats: soldBy.get(d.showTimeId) ?? 0 }));
}

export interface BulkStatusResult {
  updated: number;
  skipped: { showTimeId: number; reason: string }[];
}

/**
 * Opens for sale, suspends, resumes or cancels showtimes. A showtime with sold tickets cannot be suspended or cancelled
 * (those customers would be left without a seat), and a cancelled showtime stays cancelled.
 */
export async function bulkSetStatus(db: Db, ids: number[], status: 'ON_SALE' | 'SUSPENDED' | 'CANCELLED'): Promise<BulkStatusResult> {
  const col = db.collection<ShowtimeDoc>('showtimes');
  const rows = await col.find({ _id: { $in: ids } }).toArray();
  const sold = await db
    .collection<SeatLockDoc>('seat_locks')
    .distinct('showtimeId', { showtimeId: { $in: ids }, status: 'SOLD' });
  const soldSet = new Set(sold);

  const result: BulkStatusResult = { updated: 0, skipped: [] };
  const apply: number[] = [];
  for (const st of rows) {
    if (st.status === 'CANCELLED' || st.status === 'COMPLETED') result.skipped.push({ showTimeId: st._id, reason: 'Suất chiếu đã đóng, không thể thay đổi.' });
    else if (st.status === status) result.skipped.push({ showTimeId: st._id, reason: 'Suất chiếu đã ở trạng thái này.' })
    else if (status === 'ON_SALE' && st.startAt <= new Date()) result.skipped.push({ showTimeId: st._id, reason: 'Suất chiếu đã bắt đầu.' });
    else if (status !== 'ON_SALE' && soldSet.has(st._id)) result.skipped.push({ showTimeId: st._id, reason: 'Suất chiếu đã có vé bán ra.' });
    else apply.push(st._id);
  }
  for (const id of ids) if (!rows.some((r) => r._id === id)) result.skipped.push({ showTimeId: id, reason: 'Không tìm thấy suất chiếu.' });

  if (apply.length) {
    await col.updateMany({ _id: { $in: apply } }, { $set: { status } });
    result.updated = apply.length;
    if (status === 'CANCELLED') {
      // Orders still waiting for payment lose their seats together with the showtime.
      await db.collection('bookings').updateMany({ showtimeId: { $in: apply }, status: 'PENDING_PAYMENT' }, { $set: { status: 'CANCELLED' } });
      await db.collection('seat_locks').deleteMany({ showtimeId: { $in: apply }, status: 'HELD' });
    }
  }
  return result;
}
