import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView, Screen } from '@/components/ui';
import { openPaidTicket } from '@/lib/navigation';

/**
 * Where the payment page sends the customer back into the app. It only decides which screen to show:
 * the ticket after a success, the payment screen (with the reason) otherwise. The order itself was already
 * settled on the server; both screens re-read it.
 */
export default function PaymentReturn() {
  const { bookingId, status, notice } = useLocalSearchParams<{ bookingId?: string; status?: string; notice?: string }>();

  useEffect(() => {
    if (!bookingId) {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } else if (status === 'success') {
      openPaidTicket(bookingId);
    } else {
      router.dismissTo({ pathname: '/booking/[bookingId]/checkout', params: { bookingId, notice } });
    }
  }, [bookingId, status, notice]);

  return (
    <Screen>
      <LoadingView label="Đang mở vé của bạn…" />
    </Screen>
  );
}
