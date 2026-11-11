import { randomUUID } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';

import { clusterNameOf, layoutOfRoom, type LayoutSeat, vnParts } from './cinema';
import { HttpError } from './http';
import type { BookingDoc, MovieDoc, SeatLockDoc, ShowtimeDoc } from './models';
import { seatPriceOf } from './pricing';
import { getShowtimeDoc, movieTitleOf } from './showtimes';

/** Mobile hold policy: how long chosen seats are kept while the customer pays. */
export const HOLD_TTL_SECONDS = 480;
export const MAX_SEATS_PER_BOOKING = 8;

export const holdPolicy = () => ({ channel: 'MOBILE' as const, ttlSeconds: HOLD_TTL_SECONDS, maxSeatsPerBooking: MAX_SEATS_PER_BOOKING });

const locks = (db: Db) => db.collection<SeatLockDoc>('seat_locks');
const bookings = (db: Db) => db.collection<BookingDoc>('bookings');

// ── Seat map ───────────────────────────────────────────────────────────────

export async function seatMap(db: Db, showtimeId: number, accountId?: string) {
  const showtime = await getShowtimeDoc(db, showtimeId);
  if (!showtime) throw new HttpError(404, 'Không tìm thấy suất chiếu.', 2501);

  const now = new Date();
  const taken = new Map((await locks(db).find({ showtimeId }).toArray()).map((l) => [l.seatId, l]));
  const layout = layoutOfRoom(showtime.roomId);

  const seats = layout.map((s) => {
    const lock = taken.get(s.seatId);
    const held = lock?.status === 'HELD' && !!lock.holdExpiresAt && lock.holdExpiresAt > now;
    const status = lock?.status === 'SOLD' ? 'BOOKED' : held ? 'LOCKED' : 'AVAILABLE';
    return {
      seatId: s.seatId,
      seatCode: s.seatCode,
      seatGroupId: s.seatGroupId,
      row: s.row,
      number: s.number,
      type: s.type,
      status,
      price: seatPriceOf(showtime, s.type),
      reservedByMe: status !== 'AVAILABLE' && !!accountId && lock?.userId === accountId,
    };
  });

  const positions = layout.map((s) => ({
    rowIndex: s.rowIndex,
    columnIndex: s.number - 1,
    rowLabel: s.row,
    positionType: 'SEAT' as const,
    seatNumber: s.number,
    seatCode: s.seatCode,
    seatType: s.type,
    seatGroupId: s.seatGroupId,
  }));

  return { seats, positions };
}

// ── Pricing ────────────────────────────────────────────────────────────────

/** Recomputes every amount of a booking from its lines. Concessions and promotions call this too. */
export function reprice(b: Pick<BookingDoc, 'seats' | 'concessions' | 'serviceFee' | 'promotionDiscountAmount'>) {
  const ticketSubtotal = b.seats.reduce((sum, s) => sum + s.finalPrice, 0);
  const concessionSubtotal = b.concessions.reduce((sum, c) => sum + c.finalAmount, 0);
  const subtotal = ticketSubtotal + concessionSubtotal;
  const discount = Math.min(subtotal, b.promotionDiscountAmount ?? 0);
  return { ticketSubtotal, concessionSubtotal, subtotal, discount, total: subtotal + b.serviceFee - discount };
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

/** Frees the seats of a booking. */
export async function releaseSeats(db: Db, bookingId: string) {
  await locks(db).deleteMany({ bookingId, status: 'HELD' });
}

/** A pending booking whose hold ran out becomes EXPIRED (checked whenever a booking is read). */
async function expireIfNeeded(db: Db, b: BookingDoc): Promise<BookingDoc> {
  if (b.status !== 'PENDING_PAYMENT' || b.expiresAt > new Date()) return b;
  const res = await bookings(db).updateOne(
    { _id: b._id, status: 'PENDING_PAYMENT', expiresAt: { $lte: new Date() } },
    { $set: { status: 'EXPIRED' } },
  );
  if (res.modifiedCount) await releaseSeats(db, b._id);
  return { ...b, status: 'EXPIRED' };
}

export async function cancelPendingForShowtime(db: Db, userId: string, showtimeId: number) {
  const pending = await bookings(db).find({ userId, showtimeId, status: 'PENDING_PAYMENT' }).toArray();
  for (const b of pending) {
    await bookings(db).updateOne({ _id: b._id, status: 'PENDING_PAYMENT' }, { $set: { status: 'CANCELLED' } });
    await releaseSeats(db, b._id);
  }
}

/** Turns held seats into sold seats once payment succeeds. */
export async function markSeatsSold(db: Db, bookingId: string) {
  await locks(db).updateMany({ bookingId }, { $set: { status: 'SOLD' }, $unset: { holdExpiresAt: '' } });
}

/** Gives a booking more time (e.g. while the customer pays at the provider) and keeps its seat holds in step. */
export async function extendHold(db: Db, b: BookingDoc, until: Date): Promise<BookingDoc> {
  if (b.expiresAt >= until) return b;
  await bookings(db).updateOne({ _id: b._id, status: 'PENDING_PAYMENT' }, { $set: { expiresAt: until } });
  await locks(db).updateMany({ bookingId: b._id, status: 'HELD' }, { $set: { holdExpiresAt: until } });
  return { ...b, expiresAt: until };
}

export async function setPaymentStatus(db: Db, bookingId: string, paymentStatus: BookingDoc['paymentStatus']) {
  await bookings(db).updateOne({ _id: bookingId, status: 'PENDING_PAYMENT' }, { $set: { paymentStatus } });
}

const PICKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPickupCode = () => {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((n) => PICKUP_ALPHABET[n % PICKUP_ALPHABET.length]).join('');
};

/**
 * Payment succeeded: the booking becomes CONFIRMED and its seats SOLD. If the hold had already lapsed,
 * the seats are taken again when still free; otherwise the booking stays as it is and the result is LATE
 * (the money arrived but the seats are gone, so it needs a manual refund).
 */
export async function confirmPaid(db: Db, bookingId: string): Promise<'CONFIRMED' | 'LATE'> {
  const b = await bookings(db).findOne({ _id: bookingId });
  if (!b) return 'LATE';
  if (b.status === 'CONFIRMED') return 'CONFIRMED';

  const set: Partial<BookingDoc> = {
    status: 'CONFIRMED',
    paymentStatus: 'SUCCEEDED',
    paidAt: new Date(),
    ...(b.concessions.length ? { concessionPickupCode: newPickupCode() } : {}),
  };

  if (b.status === 'PENDING_PAYMENT') {
    const res = await bookings(db).updateOne({ _id: b._id, status: 'PENDING_PAYMENT' }, { $set: set });
    if (res.modifiedCount) await markSeatsSold(db, b._id);
    return 'CONFIRMED';
  }

  // EXPIRED / CANCELLED: try to win the seats back.
  const seatIds = b.seats.map((s) => s.showtimeSeatId);
  await locks(db).deleteMany({ showtimeId: b.showtimeId, seatId: { $in: seatIds }, status: 'HELD', holdExpiresAt: { $lte: new Date() } });
  try {
    await locks(db).insertMany(
      seatIds.map((seatId) => ({ _id: new ObjectId(), showtimeId: b.showtimeId, seatId, bookingId: b._id, userId: b.userId, status: 'SOLD' as const })),
      { ordered: false },
    );
  } catch (e) {
    await locks(db).deleteMany({ bookingId: b._id });
    if (!isDuplicateKey(e)) throw e;
    await bookings(db).updateOne({ _id: b._id }, { $set: { paymentStatus: 'SUCCEEDED', paidAt: new Date() } });
    return 'LATE';
  }
  await bookings(db).updateOne({ _id: b._id }, { $set: set });
  return 'CONFIRMED';
}

// ── Editing a pending booking (concessions, promotion) ──────────────────────

/**
 * The caller's booking, ready to be edited: it must still be waiting for payment and no payment
 * session may be open (the amount sent to the provider must not change under it).
 */
export async function getEditableBooking(db: Db, bookingId: string, userId: string): Promise<BookingDoc> {
  const b = await getBooking(db, bookingId, userId, false);
  if (!b) throw new HttpError(404, 'Không tìm thấy đơn đặt vé.', 2504);
  if (b.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'Đơn đặt vé không còn ở trạng thái chờ thanh toán.', 2505);
  const open = await db.collection('payments').findOne({ bookingId, status: 'PENDING', expiresAt: { $gt: new Date() } });
  if (open) throw new HttpError(409, 'Đang có giao dịch thanh toán chưa hoàn tất. Vui lòng hoàn tất hoặc chờ giao dịch hết hạn.', 2506);
  return b;
}

/** Re-prices the booking from its lines and saves the result. */
export async function saveEdit(db: Db, b: BookingDoc): Promise<BookingDoc> {
  const priced: BookingDoc = { ...b, ...reprice(b) };
  const set: Record<string, unknown> = {
    concessions: priced.concessions,
    ticketSubtotal: priced.ticketSubtotal,
    concessionSubtotal: priced.concessionSubtotal,
    subtotal: priced.subtotal,
    discount: priced.discount,
    total: priced.total,
  };
  const unset: Record<string, ''> = {};
  if (priced.promotionCode) {
    set.promotionCode = priced.promotionCode;
    set.promotionDiscountAmount = priced.promotionDiscountAmount ?? 0;
  } else {
    unset.promotionCode = '';
    unset.promotionDiscountAmount = '';
  }
  const res = await bookings(db).updateOne(
    { _id: b._id, status: 'PENDING_PAYMENT' },
    Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
  );
  if (!res.matchedCount) throw new HttpError(409, 'Đơn đặt vé không còn ở trạng thái chờ thanh toán.', 2505);
  return priced;
}

// ── DTOs ───────────────────────────────────────────────────────────────────

/**
 * The code is what the customer shows at the cinema, so it is only revealed once the order is paid
 * (admins see it on every order).
 */
export function bookingDto(b: BookingDoc, opts: { revealCode?: boolean } = {}) {
  return {
    bookingId: b._id,
    bookingCode: opts.revealCode || b.status === 'CONFIRMED' ? b.bookingCode : undefined,
    status: b.status,
    paymentStatus: b.paymentStatus,
    showtimeId: b.showtimeId,
    movieId: b.movieId,
    movieName: b.movieName,
    posterUrl: b.posterUrl,
    cinemaClusterId: b.clusterId,
    cinemaClusterName: clusterNameOf(b.clusterId),
    cinemaRoomId: b.roomId,
    cinemaRoomName: b.roomName,
    showDate: b.showDate,
    startTime: b.startTime,
    endTime: b.endTime,
    formatCode: b.formatCode,
    audioLanguageCode: b.audioLanguageCode,
    subtitleLanguageCode: b.subtitleLanguageCode,
    ageRatingCode: b.ageRatingCode,
    seats: b.seats,
    concessions: b.concessions,
    ticketSubtotal: b.ticketSubtotal,
    concessionSubtotal: b.concessionSubtotal,
    subtotal: b.subtotal,
    serviceFee: b.serviceFee,
    discount: b.discount,
    total: b.total,
    currency: b.currency,
    promotionCode: b.promotionCode,
    promotionDiscountAmount: b.promotionDiscountAmount,
    concessionPickupCode: b.concessionPickupCode,
    expiresAt: b.expiresAt.toISOString(),
    paidAt: b.paidAt?.toISOString(),
    createdAt: b.createdAt.toISOString(),
  };
}

const confirmationDto = (b: BookingDoc) => ({
  bookingId: b._id,
  holdId: b._id,
  lockedUntil: b.expiresAt.toISOString(),
  expiresAt: b.expiresAt.toISOString(),
  total: b.total,
  currency: b.currency,
});

// ── Queries ────────────────────────────────────────────────────────────────

/** The caller's own booking (admins may open any). Null when it does not exist or is not theirs. */
export async function getBooking(db: Db, bookingId: string, accountId: string, isAdmin: boolean) {
  const b = await bookings(db).findOne({ _id: bookingId });
  if (!b || (b.userId !== accountId && !isAdmin)) return null;
  return expireIfNeeded(db, b);
}

/**
 * What "Vé của tôi" shows, following cinema apps: tickets are paid bookings, split into upcoming and watched.
 * An order still being paid is not a ticket yet (`pending`), and cancelled / expired orders are not listed at all.
 */
export type TicketScope = 'upcoming' | 'watched' | 'pending';

export async function listMyBookings(db: Db, accountId: string, page: number, size: number, scope?: TicketScope) {
  const now = new Date();
  const filter: Record<string, unknown> =
    scope === 'upcoming'
      ? { userId: accountId, status: 'CONFIRMED', startAt: { $gte: now } }
      : scope === 'watched'
        ? { userId: accountId, status: 'CONFIRMED', startAt: { $lt: now } }
        : scope === 'pending'
          ? { userId: accountId, status: 'PENDING_PAYMENT', expiresAt: { $gt: now } }
          : { userId: accountId };
  const sort: Record<string, 1 | -1> = scope === 'upcoming' ? { startAt: 1 } : scope === 'watched' ? { startAt: -1 } : { createdAt: -1 };
  const [rows, total] = await Promise.all([
    bookings(db).find(filter).sort(sort).skip(page * size).limit(size).toArray(),
    bookings(db).countDocuments(filter),
  ]);
  const content = await Promise.all(rows.map((b) => expireIfNeeded(db, b)));
  const totalPages = Math.max(1, Math.ceil(total / size));
  return { content: content.map((b) => bookingDto(b)), number: page, size, totalElements: total, totalPages, last: page + 1 >= totalPages };
}

// ── Create ─────────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newBookingCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `CP${[...bytes].map((n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('')}`;
}

const isDuplicateKey = (e: unknown): boolean => (e as { code?: number } | null)?.code === 11000;

function validateSeats(layout: LayoutSeat[], seatIds: number[]) {
  const byId = new Map(layout.map((s) => [s.seatId, s]));
  const unique = [...new Set(seatIds)];
  if (unique.length !== seatIds.length) throw new HttpError(400, 'Danh sách ghế bị trùng.');
  if (!unique.length) throw new HttpError(400, 'Vui lòng chọn ít nhất một ghế.');
  if (unique.length > MAX_SEATS_PER_BOOKING) {
    throw new HttpError(400, `Mỗi lần đặt vé được chọn tối đa ${MAX_SEATS_PER_BOOKING} ghế.`);
  }
  const chosen = unique.map((id) => {
    const seat = byId.get(id);
    if (!seat) throw new HttpError(400, 'Ghế không tồn tại trong phòng chiếu.');
    return seat;
  });
  // A couple seat is sold as a pair.
  const groups = new Set(chosen.map((s) => s.seatGroupId).filter(Boolean));
  for (const group of groups) {
    const needed = layout.filter((s) => s.seatGroupId === group).length;
    if (chosen.filter((s) => s.seatGroupId === group).length !== needed) {
      throw new HttpError(400, 'Ghế đôi phải được chọn cả hai chỗ.');
    }
  }
  return chosen;
}

export async function createBooking(
  db: Db,
  user: { accountId: string },
  input: { showtimeId: number; seatIds: number[] },
  idempotencyKey?: string,
) {
  const userId = user.accountId;

  // Same key = same request retried: hand back the booking it already created.
  if (idempotencyKey) {
    const again = await bookings(db).findOne({ userId, idempotencyKey });
    if (again) return confirmationDto(await expireIfNeeded(db, again));
  }

  const showtime: ShowtimeDoc | null = await getShowtimeDoc(db, input.showtimeId);
  if (!showtime) throw new HttpError(404, 'Không tìm thấy suất chiếu.', 2501);
  if (showtime.status !== 'ON_SALE' || showtime.startAt <= new Date()) {
    throw new HttpError(409, 'Suất chiếu này đã đóng bán vé.', 2502);
  }
  const chosen = validateSeats(layoutOfRoom(showtime.roomId), input.seatIds);
  const movie = await db.collection<MovieDoc>('movies').findOne({ _id: showtime.movieId });

  // One unpaid booking per customer per showtime: starting over frees the earlier seats.
  await cancelPendingForShowtime(db, userId, showtime._id);

  const now = new Date();
  const bookingId = randomUUID();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_SECONDS * 1000);
  const seatIds = chosen.map((s) => s.seatId);

  // Holds that ran out are cleared first so those seats can be taken again.
  await locks(db).deleteMany({ showtimeId: showtime._id, seatId: { $in: seatIds }, status: 'HELD', holdExpiresAt: { $lte: now } });
  try {
    await locks(db).insertMany(
      seatIds.map((seatId) => ({
        _id: new ObjectId(),
        showtimeId: showtime._id,
        seatId,
        bookingId,
        userId,
        status: 'HELD' as const,
        holdExpiresAt: expiresAt,
      })),
      { ordered: false },
    );
  } catch (e) {
    await releaseSeats(db, bookingId);
    if (isDuplicateKey(e)) throw new HttpError(409, 'Ghế bạn chọn vừa có người khác giữ. Vui lòng chọn ghế khác.', 2503);
    throw e;
  }

  const seats = chosen.map((s) => {
    const price = seatPriceOf(showtime, s.type);
    return { showtimeSeatId: s.seatId, seatCode: s.seatCode, seatType: s.type, unitPrice: price, finalPrice: price };
  });
  const start = vnParts(showtime.startAt);
  const draft = { seats, concessions: [] as BookingDoc['concessions'], serviceFee: 0 };

  const booking: BookingDoc = {
    _id: bookingId,
    bookingCode: newBookingCode(),
    userId,
    idempotencyKey,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'NOT_STARTED',
    showtimeId: showtime._id,
    movieId: showtime.movieId,
    movieName: movie ? movieTitleOf(movie) : '',
    posterUrl: movie?.posterUrl,
    clusterId: showtime.clusterId,
    clusterName: clusterNameOf(showtime.clusterId),
    roomId: showtime.roomId,
    roomName: showtime.roomName,
    showDate: start.date,
    startTime: start.time,
    endTime: vnParts(showtime.endAt).time,
    formatCode: showtime.format,
    audioLanguageCode: showtime.audioLanguageCode,
    subtitleLanguageCode: showtime.subtitleLanguageCode,
    ageRatingCode: movie?.ageRating?.ratingCode,
    startAt: showtime.startAt,
    ...draft,
    ...reprice(draft),
    currency: 'VND',
    expiresAt,
    createdAt: now,
  };
  if (!idempotencyKey) delete booking.idempotencyKey;

  try {
    await bookings(db).insertOne(booking);
  } catch (e) {
    await releaseSeats(db, bookingId);
    if (isDuplicateKey(e) && idempotencyKey) {
      // A parallel retry with the same key won the race.
      const winner = await bookings(db).findOne({ userId, idempotencyKey });
      if (winner) return confirmationDto(winner);
    }
    throw e;
  }
  return confirmationDto(booking);
}

// ── Admin ──────────────────────────────────────────────────────────────────

export interface AdminBookingFilter {
  page: number;
  size: number;
  status?: 'CONFIRMED' | 'PENDING_PAYMENT' | 'CLOSED';
  q?: string;
  clusterId?: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every customer's bookings (read-only), newest first, with the customer's username. */
export async function listAllBookings(db: Db, f: AdminBookingFilter) {
  const filter: Record<string, unknown> = {};
  if (f.clusterId) filter.clusterId = f.clusterId;
  if (f.status === 'CLOSED') filter.status = { $in: ['CANCELLED', 'EXPIRED'] };
  else if (f.status) filter.status = f.status;
  if (f.q) {
    const rx = new RegExp(escapeRegex(f.q), 'i');
    filter.$or = [{ bookingCode: rx }, { movieName: rx }];
  }
  const [rows, total] = await Promise.all([
    bookings(db).find(filter).sort({ createdAt: -1 }).skip(f.page * f.size).limit(f.size).toArray(),
    bookings(db).countDocuments(filter),
  ]);
  const fresh = await Promise.all(rows.map((b) => expireIfNeeded(db, b)));

  const ids = [...new Set(fresh.map((b) => b.userId))].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const users = await db.collection('users').find({ _id: { $in: ids } }, { projection: { username: 1 } }).toArray();
  const names = new Map(users.map((u) => [u._id.toHexString(), u.username as string]));

  const totalPages = Math.max(1, Math.ceil(total / f.size));
  return {
    content: fresh.map((b) => ({ ...bookingDto(b, { revealCode: true }), customerName: names.get(b.userId) })),
    number: f.page,
    size: f.size,
    totalElements: total,
    totalPages,
    last: f.page + 1 >= totalPages,
  };
}
