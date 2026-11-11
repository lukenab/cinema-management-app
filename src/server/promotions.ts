import type { Db } from 'mongodb';

import { getBooking, getEditableBooking, saveEdit } from './bookings';
import { HttpError } from './http';
import type { BookingDoc } from './models';

type Scope = 'TICKETS' | 'CONCESSIONS' | 'ORDER';

interface Offer {
  code: string;
  name: string;
  description: string;
  benefitScope: Scope;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  percentage?: number;
  fixedAmount?: number;
  maxDiscountAmount?: number;
  /** Minimum value of the part of the order the offer applies to. */
  minimumOrderAmount: number;
  /** How many paid bookings one customer may use this on. */
  perUserLimit?: number;
}

// The offers are part of the app's configuration (no admin screen manages them).
const OFFERS: Offer[] = [
  {
    code: 'WELCOME10',
    name: 'Chào bạn mới',
    description: 'Giảm 10% tổng đơn (tối đa 50.000 ₫) cho đơn từ 100.000 ₫. Mỗi tài khoản dùng một lần.',
    benefitScope: 'ORDER',
    discountType: 'PERCENTAGE',
    percentage: 10,
    maxDiscountAmount: 50_000,
    minimumOrderAmount: 100_000,
    perUserLimit: 1,
  },
  {
    code: 'VE15K',
    name: 'Giảm tiền vé',
    description: 'Giảm 15.000 ₫ cho đơn vé từ 150.000 ₫.',
    benefitScope: 'TICKETS',
    discountType: 'FIXED_AMOUNT',
    fixedAmount: 15_000,
    minimumOrderAmount: 150_000,
  },
  {
    code: 'BAPNUOC20',
    name: 'Giảm bắp nước',
    description: 'Giảm 20.000 ₫ khi mua bắp nước từ 60.000 ₫.',
    benefitScope: 'CONCESSIONS',
    discountType: 'FIXED_AMOUNT',
    fixedAmount: 20_000,
    minimumOrderAmount: 60_000,
  },
];

export const publicOffers = () =>
  OFFERS.map(({ perUserLimit: _limit, ...offer }) => ({ ...offer, validFrom: null, validUntil: null, currency: 'VND' }));

const money = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
const SCOPE_LABEL: Record<Scope, string> = { TICKETS: 'tiền vé', CONCESSIONS: 'bắp nước', ORDER: 'đơn hàng' };

/** The discount an offer gives on a booking right now, or why it does not apply. */
function evaluate(offer: Offer, b: Pick<BookingDoc, 'ticketSubtotal' | 'concessionSubtotal'>): { amount: number } | { error: string } {
  const base =
    offer.benefitScope === 'TICKETS' ? b.ticketSubtotal : offer.benefitScope === 'CONCESSIONS' ? b.concessionSubtotal : b.ticketSubtotal + b.concessionSubtotal;
  if (base < offer.minimumOrderAmount) {
    return { error: `Mã ${offer.code} áp dụng cho ${SCOPE_LABEL[offer.benefitScope]} từ ${money(offer.minimumOrderAmount)}.` };
  }
  let amount = offer.discountType === 'PERCENTAGE' ? Math.floor((base * (offer.percentage ?? 0)) / 100) : (offer.fixedAmount ?? 0);
  if (offer.maxDiscountAmount) amount = Math.min(amount, offer.maxDiscountAmount);
  return { amount: Math.min(amount, base) };
}

/**
 * Keeps the promotion on a booking consistent after its lines changed: the discount is recomputed,
 * or the code is dropped when the order no longer qualifies. Returns the code that was dropped, if any.
 */
export function syncPromotion(b: BookingDoc): string | undefined {
  if (!b.promotionCode) return undefined;
  const offer = OFFERS.find((o) => o.code === b.promotionCode);
  const result = offer ? evaluate(offer, b) : { error: 'gone' };
  if ('amount' in result) {
    b.promotionDiscountAmount = result.amount;
    return undefined;
  }
  const dropped = b.promotionCode;
  delete b.promotionCode;
  delete b.promotionDiscountAmount;
  return dropped;
}

export async function applyPromotion(db: Db, userId: string, bookingId: string, rawCode: string) {
  const b = await getEditableBooking(db, bookingId, userId);
  const code = rawCode.trim().toUpperCase();
  const offer = OFFERS.find((o) => o.code === code);
  if (!offer) throw new HttpError(400, 'Mã khuyến mãi không tồn tại hoặc đã hết hạn.', 2600);

  if (offer.perUserLimit) {
    const used = await db.collection<BookingDoc>('bookings').countDocuments({
      userId,
      promotionCode: code,
      status: 'CONFIRMED',
      _id: { $ne: bookingId },
    });
    if (used >= offer.perUserLimit) throw new HttpError(400, `Bạn đã sử dụng mã ${code}.`, 2602);
  }

  const result = evaluate(offer, b);
  if ('error' in result) throw new HttpError(400, result.error, 2601);

  b.promotionCode = code;
  b.promotionDiscountAmount = result.amount;
  return saveEdit(db, b);
}

export async function removePromotion(db: Db, userId: string, bookingId: string) {
  const b = await getEditableBooking(db, bookingId, userId);
  delete b.promotionCode;
  delete b.promotionDiscountAmount;
  return saveEdit(db, b);
}

/**
 * Every offer as it applies to this order right now: usable or not (with the reason) and what it would take off.
 * Lets the payment screen grey out codes instead of letting the customer find out by trying.
 */
export async function promotionOptions(db: Db, userId: string, bookingId: string) {
  const b = await getBooking(db, bookingId, userId, false);
  if (!b) throw new HttpError(404, 'Không tìm thấy đơn đặt vé.', 2504);

  const used = await db.collection<BookingDoc>('bookings').distinct('promotionCode', { userId, status: 'CONFIRMED', _id: { $ne: bookingId } });
  const usedCodes = new Set(used.filter((c): c is string => !!c));

  return OFFERS.map((offer) => {
    const { perUserLimit: _limit, ...info } = offer;
    const alreadyUsed = !!offer.perUserLimit && usedCodes.has(offer.code);
    const result = alreadyUsed ? { error: `Bạn đã sử dụng mã ${offer.code}.` } : evaluate(offer, b);
    return {
      ...info,
      validFrom: null,
      validUntil: null,
      currency: 'VND',
      eligible: 'amount' in result,
      reason: 'error' in result ? result.error : undefined,
      discountAmount: 'amount' in result ? result.amount : undefined,
      applied: b.promotionCode === offer.code,
    };
  });
}
