// Ticket prices per cinema (Java: price_book + price_rate + PriceBookPricingService).
// A rate is chosen by day type (weekday / weekend), daypart of the start time and format; the seat
// type then multiplies the standard price. The result is copied onto the showtime when it is created.
import type { Db } from 'mongodb';

import { weekdayOf } from './cinema';
import { HttpError } from './http';
import type { Daypart, PriceBookDoc, PriceRate, SeatType } from './models';

export const DAYPARTS: { code: Daypart; label: string; from: number; to: number }[] = [
  { code: 'MORNING', label: 'Sáng (trước 12:00)', from: 0, to: 12 * 60 },
  { code: 'AFTERNOON', label: 'Chiều (12:00–17:00)', from: 12 * 60, to: 17 * 60 },
  { code: 'EVENING', label: 'Tối (17:00–22:00)', from: 17 * 60, to: 22 * 60 },
  { code: 'LATE_NIGHT', label: 'Khuya (từ 22:00)', from: 22 * 60, to: 24 * 60 + 1 },
];

export const daypartOf = (startMinutes: number): Daypart =>
  DAYPARTS.find((d) => startMinutes >= d.from && startMinutes < d.to)?.code ?? 'LATE_NIGHT';

/** Friday evening to Sunday counts as weekend, as most Vietnamese cinemas price it. */
export const isWeekend = (dateIso: string): boolean => {
  const day = weekdayOf(dateIso);
  return day === 0 || day === 5 || day === 6;
};

const round = (n: number) => Math.round(n / 1000) * 1000;

/** Seed prices; larger cinemas cost a little more. Weekend +15.000 ₫, 3D +20.000 ₫. */
function seedRates(level: number): PriceRate[] {
  const base: Record<Daypart, number> = { MORNING: 55_000, AFTERNOON: 65_000, EVENING: 80_000, LATE_NIGHT: 65_000 };
  const rates: PriceRate[] = [];
  for (const dayType of ['WEEKDAY', 'WEEKEND'] as const) {
    for (const format of ['2D', '3D']) {
      for (const d of DAYPARTS) {
        const price = base[d.code] + (dayType === 'WEEKEND' ? 15_000 : 0) + (format === '3D' ? 20_000 : 0) + level * 5_000;
        rates.push({ dayType, daypart: d.code, format, standardPrice: round(price) });
      }
    }
  }
  return rates;
}

export const DEFAULT_SEAT_MULTIPLIERS: Record<SeatType, number> = { STANDARD: 1, VIP: 1.2, COUPLE: 1.15 };

/** One price book per cinema; level 0..2 reflects cinema size. */
export function seedPriceBook(clusterId: number, level: number): PriceBookDoc {
  return { _id: clusterId, rates: seedRates(level), seatMultipliers: { ...DEFAULT_SEAT_MULTIPLIERS }, updatedAt: new Date() };
}

export async function getPriceBook(db: Db, clusterId: number): Promise<PriceBookDoc> {
  const book = await db.collection<PriceBookDoc>('price_books').findOne({ _id: clusterId });
  if (!book) throw new HttpError(404, 'Rạp chưa có bảng giá.', 3001);
  return book;
}

export interface ResolvedPrice {
  basePrice: number;
  seatPrices: Record<SeatType, number>;
  rateCode: string;
}

/** The price of a slot: the matching rate (same format, else 2D) times each seat multiplier. */
export function resolvePrice(book: PriceBookDoc, dateIso: string, startMinutes: number, format: string): ResolvedPrice {
  const dayType = isWeekend(dateIso) ? 'WEEKEND' : 'WEEKDAY';
  const daypart = daypartOf(startMinutes);
  const rate =
    book.rates.find((r) => r.dayType === dayType && r.daypart === daypart && r.format === format) ??
    book.rates.find((r) => r.dayType === dayType && r.daypart === daypart && r.format === '2D');
  if (!rate) throw new HttpError(409, `Bảng giá chưa có mức cho ${dayType}/${daypart}/${format}.`, 3002);
  const m = book.seatMultipliers;
  return {
    basePrice: rate.standardPrice,
    seatPrices: {
      STANDARD: round(rate.standardPrice * (m.STANDARD ?? 1)),
      VIP: round(rate.standardPrice * (m.VIP ?? 1)),
      COUPLE: round(rate.standardPrice * (m.COUPLE ?? 1)),
    },
    rateCode: `${dayType}-${daypart}-${rate.format}`,
  };
}

/** Price of one seat on a showtime; older showtimes (before price books) used fixed surcharges. */
export function seatPriceOf(showtime: { basePrice: number; seatPrices?: Record<SeatType, number> }, type: SeatType): number {
  if (showtime.seatPrices?.[type]) return showtime.seatPrices[type];
  const legacy: Record<SeatType, number> = { STANDARD: 0, VIP: 30_000, COUPLE: 20_000 };
  return showtime.basePrice + legacy[type];
}

export async function updatePriceBook(
  db: Db,
  clusterId: number,
  input: { rates: PriceRate[]; seatMultipliers: Record<SeatType, number> },
): Promise<PriceBookDoc> {
  await getPriceBook(db, clusterId);
  const doc: PriceBookDoc = {
    _id: clusterId,
    rates: input.rates.map((r) => ({ ...r, standardPrice: round(r.standardPrice) })),
    seatMultipliers: input.seatMultipliers,
    updatedAt: new Date(),
  };
  await db.collection<PriceBookDoc>('price_books').replaceOne({ _id: clusterId }, doc);
  return doc;
}
