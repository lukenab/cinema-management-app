import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Db } from 'mongodb';

import { confirmPaid, extendHold, getBooking, setPaymentStatus } from './bookings';
import { vnParts } from './cinema';
import { optionalEnv } from './env';
import { HttpError } from './http';
import type { PaymentDoc } from './models';

/** While the customer pays at the provider, the seats stay held at least this long. */
const PAYMENT_WINDOW_MS = 10 * 60_000;

const payments = (db: Db) => db.collection<PaymentDoc>('payments');

const vnpayConfig = () => ({
  tmnCode: optionalEnv('VNPAY_TMN_CODE'),
  secret: optionalEnv('VNPAY_HASH_SECRET'),
  url: optionalEnv('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
});

/**
 * VNPay is the payment gateway. PAYMENT_MODE=internal switches to CinePrime's own checkout page instead
 * (for environments without VNPay credentials); it is off unless that variable is set.
 */
export const isInternalCheckout = (): boolean => ['internal', 'fake'].includes(optionalEnv('PAYMENT_MODE'));

const vnpayReady = () => {
  const { tmnCode, secret } = vnpayConfig();
  return !!tmnCode && !!secret;
};

// ── VNPay signing ──────────────────────────────────────────────────────────

const encode = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

/** key=value pairs sorted by key with encoded values: the exact string VNPay signs. */
function signingString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${encode(params[k])}`)
    .join('&');
}

const hmac = (data: string, secret: string) => createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');

/** True when the query VNPay redirected back with carries a valid signature. */
export function verifyVnpay(query: Record<string, string>): boolean {
  const { secret } = vnpayConfig();
  const given = query.vnp_SecureHash;
  if (!secret || !given) return false;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType') params[k] = v;
  }
  const expected = Buffer.from(hmac(signingString(params), secret));
  const actual = Buffer.from(given.toLowerCase());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const stamp = (at: Date) => {
  const p = vnParts(at);
  return p.date.replace(/-/g, '') + p.time.replace(/:/g, '');
};

function vnpayUrl(p: { txnRef: string; amount: number; returnUrl: string; ip: string; createdAt: Date; expiresAt: Date }): string {
  const { tmnCode, secret, url } = vnpayConfig();
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(p.amount * 100),
    vnp_CreateDate: stamp(p.createdAt),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: p.ip,
    vnp_Locale: 'vn',
    vnp_OrderInfo: 'Thanh toan ve CinePrime',
    vnp_OrderType: 'other',
    vnp_ReturnUrl: p.returnUrl,
    vnp_TxnRef: p.txnRef,
    vnp_ExpireDate: stamp(p.expiresAt),
  };
  const data = signingString(params);
  return `${url}?${data}&vnp_SecureHash=${hmac(data, secret)}`;
}

const VNPAY_MESSAGES: Record<string, string> = {
  '07': 'Giao dịch bị nghi ngờ gian lận.',
  '09': 'Thẻ/tài khoản chưa đăng ký dịch vụ Internet Banking.',
  '10': 'Xác thực thông tin thẻ/tài khoản quá 3 lần.',
  '11': 'Đã hết thời gian chờ thanh toán.',
  '12': 'Thẻ/tài khoản bị khóa.',
  '13': 'Sai mật khẩu xác thực giao dịch (OTP).',
  '24': 'Bạn đã huỷ giao dịch.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng đang bảo trì.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
};
export const vnpayMessage = (code: string) => VNPAY_MESSAGES[code] ?? `Giao dịch không thành công (mã ${code}).`;

// ── Sessions ───────────────────────────────────────────────────────────────

export function paymentDto(p: PaymentDoc) {
  const expired = p.status === 'PENDING' && p.expiresAt <= new Date();
  return {
    paymentId: p._id,
    bookingId: p.bookingId,
    provider: p.provider,
    status: expired ? 'EXPIRED' : p.status,
    paymentUrl: p.status === 'PENDING' && !expired ? p.paymentUrl : undefined,
    amount: p.amount,
    currency: p.currency,
    expiresAt: p.expiresAt.toISOString(),
    failureMessage: p.failureMessage,
    bankCode: p.bankCode,
    cardType: p.cardType,
  };
}

/** The payment page URL for this request (the phone must be able to reach it, so it follows the host the app used). */
const publicBase = (request: Request) => optionalEnv('PUBLIC_BASE_URL') || new URL(request.url).origin;

const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

/** Starts (or returns the open) payment for a pending booking. */
export async function createSession(db: Db, request: Request, userId: string, bookingId: string, idempotencyKey?: string, appReturnUrl?: string) {
  const booking = await getBooking(db, bookingId, userId, false);
  if (!booking) throw new HttpError(404, 'Không tìm thấy đơn đặt vé.', 2504);
  if (booking.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'Đơn đặt vé không còn chờ thanh toán.', 2505);

  // One open payment per booking: a retry (same key or not) gets the same session, never a second charge.
  const open = await payments(db).findOne({ bookingId, status: 'PENDING', expiresAt: { $gt: new Date() } });
  if (open) return paymentDto(open);

  const now = new Date();
  const expiresAt = new Date(Math.max(booking.expiresAt.getTime(), now.getTime() + PAYMENT_WINDOW_MS));
  await extendHold(db, booking, expiresAt);
  await setPaymentStatus(db, bookingId, 'PENDING');

  const internal = isInternalCheckout();
  if (!internal && !vnpayReady()) throw new HttpError(503, 'Cổng thanh toán đang bảo trì. Vui lòng thử lại sau.', 2702);

  const id = randomUUID();
  // Neutral reference: VNPay shows it to the customer, and the booking code is only for paid tickets.
  const txnRef = `CP${Date.now().toString(36).toUpperCase()}${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const base = publicBase(request);
  const paymentUrl = internal
    ? `${base}/api/payments/checkout?paymentId=${id}`
    : vnpayUrl({ txnRef, amount: booking.total, returnUrl: `${base}/api/payments/vnpay/return`, ip: clientIp(request), createdAt: now, expiresAt });

  const doc: PaymentDoc = {
    _id: id,
    bookingId,
    userId,
    idempotencyKey,
    provider: internal ? 'INTERNAL' : 'VNPAY',
    status: 'PENDING',
    amount: booking.total,
    currency: 'VND',
    txnRef,
    paymentUrl,
    appReturnUrl,
    createdAt: now,
    expiresAt,
  };
  await payments(db).insertOne(doc);
  return paymentDto(doc);
}

/** The latest payment of one of the caller's bookings. */
export async function latestPayment(db: Db, bookingId: string, userId: string, isAdmin: boolean) {
  const p = await payments(db).find({ bookingId }).sort({ createdAt: -1 }).limit(1).next();
  if (!p || (p.userId !== userId && !isAdmin)) return null;
  return paymentDto(p);
}

export const findByTxnRef = (db: Db, txnRef: string) => payments(db).findOne({ txnRef });
export const findPayment = (db: Db, id: string) => payments(db).findOne({ _id: id });

export type SettleResult = { outcome: 'PAID' | 'FAILED' | 'LATE'; message?: string; bookingCode?: string; alreadySettled?: boolean; returnUrl?: string };

/** Records the provider's verdict. Safe to call twice: only the first call changes anything. */
export async function settlePayment(
  db: Db,
  payment: PaymentDoc,
  verdict: { success: boolean; message?: string; bankCode?: string; cardType?: string; transactionNo?: string },
): Promise<SettleResult> {
  const booking = await getBooking(db, payment.bookingId, payment.userId, false);
  const bookingCode = booking?.bookingCode;

  const claimed = await payments(db).findOneAndUpdate(
    { _id: payment._id, status: 'PENDING' },
    {
      $set: {
        status: verdict.success ? 'PAID' : 'FAILED',
        ...(verdict.success ? { paidAt: new Date() } : { failureMessage: verdict.message }),
        bankCode: verdict.bankCode,
        cardType: verdict.cardType,
        providerTransactionNo: verdict.transactionNo,
      },
    },
  );
  if (!claimed) {
    const current = await findPayment(db, payment._id);
    return { outcome: current?.status === 'PAID' ? 'PAID' : 'FAILED', message: current?.failureMessage, bookingCode, alreadySettled: true, returnUrl: payment.appReturnUrl };
  }

  if (!verdict.success) {
    await setPaymentStatus(db, payment.bookingId, 'FAILED');
    return { outcome: 'FAILED', message: verdict.message, bookingCode, returnUrl: payment.appReturnUrl };
  }
  const result = await confirmPaid(db, payment.bookingId);
  return result === 'CONFIRMED'
    ? { outcome: 'PAID', bookingCode, returnUrl: payment.appReturnUrl }
    : { outcome: 'LATE', message: 'Đã nhận thanh toán nhưng ghế đã được nhả. Vui lòng liên hệ hotline để được hoàn tiền.', bookingCode, returnUrl: payment.appReturnUrl };
}

// ── Result pages (shown in the in-app browser after paying) ─────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function htmlPage(opts: { title: string; message: string; tone: 'ok' | 'bad' | 'info'; body?: string; returnHref?: string; returnLabel?: string }): Response {
  const color = opts.tone === 'ok' ? '#1b873f' : opts.tone === 'bad' ? '#c62828' : '#0d4da3';
  const back = opts.returnHref ? `<a class="btn" href="${esc(opts.returnHref)}">${esc(opts.returnLabel ?? 'Quay lại ứng dụng')}</a>` : '';
  // Opens the app by itself when the browser allows it; the button is for browsers that only follow a tap.
  const auto = opts.returnHref ? `<script>setTimeout(function(){location.href=${JSON.stringify(opts.returnHref).replace(/</g, '\\u003c')}},400)</script>` : '';
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f3f5fa;margin:0;padding:24px;color:#1a2233}.card{max-width:420px;margin:48px auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center}
h1{font-size:22px;color:${color};margin:0 0 12px}p{line-height:1.5;margin:8px 0}.btn{display:block;margin:12px 0 0;padding:14px;border-radius:12px;background:#0d4da3;color:#fff;text-decoration:none;font-weight:600}.btn.alt{background:#fff;color:#0d4da3;border:1px solid #0d4da3}.btn.alt.bad{color:#c62828;border-color:#c62828}</style></head>
<body><div class="card"><h1>${esc(opts.title)}</h1><p>${esc(opts.message)}</p>${opts.body ?? ''}${back}${opts.returnHref ? '<p style="font-size:13px;color:#667">Nếu ứng dụng chưa tự mở, hãy bấm nút ở trên.</p>' : ''}</div>${auto}</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export { esc as escapeHtml };

/** The link back into the app, with the outcome (and a short note for the customer on a failure). */
const appLink = (base: string | undefined, status: string, notice?: string) => {
  const url = base || 'cineprime://payment-return';
  return `${url}${url.includes('?') ? '&' : '?'}status=${status}${notice ? `&notice=${encodeURIComponent(notice)}` : ''}`;
};

/**
 * What the browser sees after a payment is settled: a short result page that opens the app by itself
 * (the app then shows the ticket, or the payment screen with the reason) and has a button for browsers
 * that only follow a tap. A bare redirect is not used because Chrome refuses to launch an app from a
 * redirect that follows another site's scripts (such as the bank's OTP page) without a tap.
 */
export function settleResponse(r: SettleResult): Response {
  const notice =
    r.outcome === 'LATE'
      ? (r.message ?? '')
      : r.outcome === 'FAILED'
        ? (r.message ?? 'Giao dịch chưa hoàn tất.')
        : undefined;
  const href = appLink(r.returnUrl, r.outcome === 'PAID' ? 'success' : 'failed', notice);

  if (r.outcome === 'PAID') {
    return htmlPage({ title: 'Thanh toán thành công', message: 'Đang mở vé của bạn…', tone: 'ok', returnHref: href, returnLabel: 'Mở vé của tôi' });
  }
  if (r.outcome === 'LATE') return htmlPage({ title: 'Cần hỗ trợ hoàn tiền', message: r.message ?? '', tone: 'bad', returnHref: href });
  return htmlPage({ title: 'Thanh toán chưa thành công', message: r.message ?? 'Giao dịch chưa hoàn tất.', tone: 'bad', returnHref: href, returnLabel: 'Quay lại thanh toán' });
}

/** CinePrime's own checkout page (PAYMENT_MODE=internal): order summary with pay / cancel. */
export async function checkoutPage(db: Db, payment: PaymentDoc): Promise<Response> {
  const booking = await getBooking(db, payment.bookingId, payment.userId, false);
  const money = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
  const rows = booking
    ? [
        ['Phim', booking.movieName],
        ['Rạp', `${booking.clusterName} · ${booking.roomName}`],
        ['Suất', `${booking.startTime.slice(0, 5)} · ${booking.showDate.split('-').reverse().join('/')}`],
        ['Ghế', booking.seats.map((s) => s.seatCode).join(', ')],
        ...(booking.concessions.length ? [['Bắp nước', booking.concessions.map((c) => `${c.quantity}× ${c.itemName}`).join(', ')]] : []),
      ]
    : [];
  const table = rows.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const href = (action: string) => `?paymentId=${encodeURIComponent(payment._id)}&action=${action}`;
  return htmlPage({
    title: 'CinePrime Pay',
    message: `Mã giao dịch ${payment.txnRef}`,
    tone: 'info',
    body: `<style>.row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eef0f5;text-align:left;font-size:14px}.row span{color:#667}.total{font-size:26px;font-weight:800;margin:16px 0 4px;color:#1a2233}</style>
${table}<div class="total">${money(payment.amount)}</div><p style="font-size:13px;color:#667">Ghế được giữ đến ${esc(vnParts(payment.expiresAt).time.slice(0, 5))}.</p>
<a class="btn" href="${href('pay')}">Thanh toán ${money(payment.amount)}</a><a class="btn alt bad" href="${href('cancel')}">Huỷ giao dịch</a>`,
  });
}
