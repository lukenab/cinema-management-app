import { authenticate } from '@/server/auth';
import { bookingDto, getBooking } from '@/server/bookings';
import { getDb } from '@/server/db';
import { HttpError, ok, route } from '@/server/http';

export const GET = route(async (request, { bookingId }) => {
  const session = await authenticate(request);
  const booking = await getBooking(await getDb(), bookingId, session.accountId, session.role === 'ADMIN');
  if (!booking) throw new HttpError(404, 'Không tìm thấy đơn đặt vé.', 2504);
  return ok(bookingDto(booking, { revealCode: session.role === 'ADMIN' }));
});
