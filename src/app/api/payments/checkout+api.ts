import { getDb } from '@/server/db';
import { HttpError, queryParam, route } from '@/server/http';
import { checkoutPage, findPayment, htmlPage, isInternalCheckout, settlePayment, settleResponse } from '@/server/payments';

/** CinePrime's own checkout page, used instead of VNPay when PAYMENT_MODE=internal. */
export const GET = route(async (request) => {
  if (!isInternalCheckout()) throw new HttpError(404, 'Không tìm thấy trang.');
  const db = await getDb();
  const payment = await findPayment(db, queryParam(request, 'paymentId') ?? '');
  if (!payment || payment.provider === 'VNPAY') throw new HttpError(404, 'Không tìm thấy giao dịch.');

  const action = queryParam(request, 'action');
  if ((action === 'pay' || action === 'cancel') && payment.status === 'PENDING' && payment.expiresAt > new Date()) {
    return settleResponse(
      await settlePayment(db, payment, {
        success: action === 'pay',
        message: action === 'pay' ? undefined : 'Bạn đã huỷ giao dịch.',
        bankCode: 'CINEPRIME',
        cardType: 'WALLET',
      }),
    );
  }
  if (payment.status !== 'PENDING' || payment.expiresAt <= new Date()) {
    return htmlPage({ title: 'Giao dịch đã đóng', message: 'Giao dịch này đã hoàn tất hoặc hết hạn.', tone: 'info' });
  }
  return checkoutPage(db, payment);
});
