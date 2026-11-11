import { getDb } from '@/server/db';
import { route } from '@/server/http';
import { findByTxnRef, htmlPage, settlePayment, settleResponse, verifyVnpay, vnpayMessage } from '@/server/payments';

/**
 * VNPay sends the customer's browser back here. The signature proves the query really comes from VNPay,
 * so this is also where the payment is settled (VNPay's server-to-server IPN cannot reach a laptop).
 */
export const GET = route(async (request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams) as Record<string, string>;
  if (!verifyVnpay(query)) {
    return htmlPage({ title: 'Không xác thực được giao dịch', message: 'Dữ liệu trả về từ VNPay không hợp lệ.', tone: 'bad' });
  }

  const db = await getDb();
  const payment = await findByTxnRef(db, query.vnp_TxnRef ?? '');
  if (!payment) return htmlPage({ title: 'Không tìm thấy giao dịch', message: 'Giao dịch này không tồn tại.', tone: 'bad' });
  if (Number(query.vnp_Amount) !== payment.amount * 100) {
    return htmlPage({ title: 'Số tiền không khớp', message: 'Số tiền thanh toán không khớp với đơn đặt vé.', tone: 'bad' });
  }

  const code = query.vnp_ResponseCode ?? '';
  const success = code === '00' && (query.vnp_TransactionStatus ?? '00') === '00';
  return settleResponse(
    await settlePayment(db, payment, {
      success,
      message: success ? undefined : vnpayMessage(code),
      bankCode: query.vnp_BankCode,
      cardType: query.vnp_CardType,
      transactionNo: query.vnp_TransactionNo,
    }),
  );
});
