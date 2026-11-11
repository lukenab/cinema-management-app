import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Badge, Button, Card, ErrorView, LoadingView, Screen } from '@/components/ui';
import { newIdempotencyKey } from '@/lib/apiClient';
import { API_URL } from '@/lib/config';
import { openPaidTicket } from '@/lib/navigation';
import { BOOKING_STATUS_LABEL } from '@/lib/labels';
import { formatCountdown, formatLongDate, formatMoney, formatTime } from '@/lib/format';
import { useCountdown } from '@/hooks/use-countdown';
import {
  queryErrorMessage,
  useApplyPromotionMutation,
  useCreatePaymentSessionMutation,
  useGetBookingQuery,
  useGetPromotionOptionsQuery,
  useLazyGetPaymentByBookingQuery,
  useRemovePromotionMutation,
} from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { PromotionOption } from '@/types/api';

// One idempotency key per booking so retrying "Pay" can never start a second charge.
const paymentKeys = new Map<string, string>();

const POLL_MS = 3000;
const POLL_WINDOW_MS = 60_000;

/**
 * The link the payment result page opens to bring the customer back. A build has its own scheme (cineprime://).
 * Expo Go does not register that scheme and only opens exp://<dev server>/--/…, and Linking.createURL drops the
 * dev server address whenever the app config has a scheme, so there the link is built from the API address
 * (in development the API is served by the same dev server).
 */
function appReturnUrl(bookingId: string): string {
  const query = `bookingId=${encodeURIComponent(bookingId)}`;
  // Only Expo Go running a development project has this config (the same test expo-linking uses).
  if (Constants.expoGoConfig?.developer) {
    return `exp://${new URL(API_URL).host}/--/payment-return?${query}`;
  }
  return `cineprime://payment-return?${query}`;
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <AppText variant={strong ? 'heading' : 'caption'} style={{ flex: 1 }}>{label}</AppText>
      <AppText variant={strong ? 'heading' : 'body'} style={tone ? { color: tone } : undefined}>{value}</AppText>
    </View>
  );
}

export default function Checkout() {
  const { bookingId, notice } = useLocalSearchParams<{ bookingId: string; notice?: string }>();
  const [polling, setPolling] = useState(false);
  const booking = useGetBookingQuery(bookingId, { pollingInterval: polling ? POLL_MS : 0, refetchOnFocus: true });
  const [createSession, sessionState] = useCreatePaymentSessionMutation();
  const [fetchPayment] = useLazyGetPaymentByBookingQuery();
  const [applyPromotion] = useApplyPromotionMutation();
  const [removePromotion] = useRemovePromotionMutation();

  const [promoMessage, setPromoMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [payMessage, setPayMessage] = useState('');
  const statusRef = useRef<string | undefined>(undefined);
  // False once this screen is gone (the payment page opened the app on the ticket): nothing below may touch it then.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const b = booking.data;
  const options = useGetPromotionOptionsQuery(bookingId, { skip: !b || b.status !== 'PENDING_PAYMENT' });
  // A note handed over by the payment result (e.g. "Bạn đã huỷ giao dịch"), until the customer tries again.
  const message = payMessage || (notice ? String(notice) : '');
  const remaining = useCountdown(b?.status === 'PENDING_PAYMENT' ? b.expiresAt : null);
  const holdExpired = b?.status === 'PENDING_PAYMENT' && remaining === 0;

  useEffect(() => {
    statusRef.current = b?.status;
  });

  // Polling gives up after a while; the backend stays the only source of truth for the outcome.
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => {
      setPolling(false);
      if (statusRef.current === 'PENDING_PAYMENT') {
        setPayMessage('Chưa nhận được xác nhận thanh toán. Nếu bạn đã thanh toán, vui lòng chờ giây lát rồi làm mới; nếu chưa, hãy thử lại.');
      }
    }, POLL_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [polling]);

  // Confirmed bookings go straight to the ticket.
  useEffect(() => {
    if (b?.status === 'CONFIRMED') openPaidTicket(bookingId);
  }, [b?.status, bookingId]);

  // Promotion messages fade out by themselves.
  useEffect(() => {
    if (!promoMessage) return;
    const timer = setTimeout(() => setPromoMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [promoMessage]);

  const pay = async () => {
    if (!b) return;
    setPayMessage('');
    router.setParams({ notice: undefined });
    let key = paymentKeys.get(bookingId);
    if (!key) {
      key = newIdempotencyKey();
      paymentKeys.set(bookingId, key);
    }
    const returnUrl = appReturnUrl(bookingId);
    const res = await createSession({ bookingId, idempotencyKey: key, returnUrl });
    if ('error' in res) {
      setPayMessage(queryErrorMessage(res.error, 'Không thể bắt đầu thanh toán. Ghế vẫn được giữ đến hết thời gian.'));
      return;
    }
    const session = res.data;
    if (!session.paymentUrl) {
      setPayMessage('Cổng thanh toán chưa phản hồi. Vui lòng thử lại.');
      paymentKeys.delete(bookingId);
      return;
    }

    // While the payment page is open, keep asking the server. Paid: show the ticket right away, so closing the
    // browser (or the page opening the app) lands on it. The browser itself cannot be closed from here on Android.
    let paid = false;
    const watcher = setInterval(async () => {
      const p = await fetchPayment(bookingId);
      if (!paid && p.data?.status === 'PAID') {
        paid = true;
        clearInterval(watcher);
        openPaidTicket(bookingId);
      }
    }, 2500);

    // The payment page opens the app with returnUrl when it is done; closing the browser also ends this call.
    try {
      await WebBrowser.openAuthSessionAsync(session.paymentUrl, returnUrl);
    } finally {
      clearInterval(watcher);
    }
    if (paid || !mountedRef.current) return;

    // Opening the app again proves nothing: always ask the backend for the final state.
    setPolling(true);
    const latest = await fetchPayment(bookingId);
    if (latest.data && (latest.data.status === 'FAILED' || latest.data.status === 'EXPIRED')) {
      paymentKeys.delete(bookingId);
      setPolling(false);
      setPayMessage(latest.data.failureMessage || 'Giao dịch chưa hoàn tất. Bạn có thể thử lại.');
    }
    booking.refetch();
  };

  /** Tap an offer to use it, tap it again to take it off. Choosing another one replaces the current one. */
  const toggleOffer = async (offer: PromotionOption) => {
    setPromoMessage(null);
    setPromoBusy(true);
    const res = offer.applied
      ? await removePromotion(bookingId)
      : await applyPromotion({ bookingId, promotionCode: offer.code, idempotencyKey: newIdempotencyKey() });
    setPromoBusy(false);
    if ('error' in res) setPromoMessage({ text: queryErrorMessage(res.error, 'Không thể cập nhật khuyến mãi.'), ok: false });
  };

  if (booking.isLoading) return <Screen><LoadingView /></Screen>;
  if (booking.error || !b) return <Screen><ErrorView message={queryErrorMessage(booking.error, 'Không tải được thông tin đặt vé.')} onRetry={booking.refetch} /></Screen>;

  const pending = b.status === 'PENDING_PAYMENT';
  const closed = ['EXPIRED', 'CANCELLED'].includes(b.status);
  const canEdit = pending && !holdExpired && !polling;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={12} style={{ padding: spacing.sm }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading" style={{ flex: 1 }}>Thanh toán</AppText>
        {pending && remaining != null ? <Badge label={`Giữ ghế ${formatCountdown(remaining)}`} tone={remaining < 60 ? 'danger' : 'warning'} /> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">{b.movieName}</AppText>
          <AppText variant="caption">{[b.cinemaClusterName, b.cinemaRoomName].filter(Boolean).join(' · ')}</AppText>
          <AppText variant="caption">{formatLongDate(b.showDate)} · {formatTime(b.startTime)}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
            {b.seats.map((s) => <Badge key={s.showtimeSeatId} label={s.seatCode} tone="info" />)}
          </View>
        </Card>

        {holdExpired || b.status === 'EXPIRED' ? (
          <Card style={{ gap: spacing.md, borderColor: colors.danger }}>
            <AppText variant="heading">Ghế của bạn đã được nhả</AppText>
            <AppText variant="caption">Đã hết thời gian giữ ghế trước khi thanh toán. Vui lòng chọn lại ghế.</AppText>
            <Button title="Về danh sách phim" onPress={() => router.replace('/home')} />
          </Card>
        ) : null}

        {polling && pending ? (
          <Card style={{ gap: spacing.sm }}>
            <LoadingView label="Đang kiểm tra thanh toán…" />
          </Card>
        ) : null}

        {pending && !holdExpired ? (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="heading">Bắp nước</AppText>
              <Button title={b.concessions.length ? 'Sửa' : 'Thêm'} variant="secondary" disabled={!canEdit} onPress={() => router.push(`/booking/${bookingId}/concessions?edit=1`)} style={{ minHeight: 40 }} />
            </View>
            {b.concessions.length ? (
              b.concessions.map((c) => <Row key={c.itemCode} label={`${c.quantity} × ${c.itemName}${c.options ? ` (${c.options})` : ''}`} value={formatMoney(c.finalAmount, b.currency)} />)
            ) : (
              <AppText variant="caption">Đặt trước bắp nước và nhận tại quầy khi đến rạp.</AppText>
            )}
          </Card>
        ) : b.concessions.length ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading">Bắp nước</AppText>
            {b.concessions.map((c) => <Row key={c.itemCode} label={`${c.quantity} × ${c.itemName}${c.options ? ` (${c.options})` : ''}`} value={formatMoney(c.finalAmount, b.currency)} />)}
          </Card>
        ) : null}

        {pending && !holdExpired ? (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="heading">Khuyến mãi</AppText>
            {(() => {
              const applied = options.data?.find((o) => o.applied);
              return applied ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
                  <Ionicons name="pricetag" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>Đang áp dụng: {applied.code}</AppText>
                    <AppText variant="caption">Giảm {formatMoney(b.discount, b.currency)} cho đơn này</AppText>
                  </View>
                  <Button title="Gỡ" variant="ghost" onPress={() => toggleOffer(applied)} loading={promoBusy} disabled={!canEdit} style={{ minHeight: 36 }} />
                </View>
              ) : (
                <AppText variant="caption">Chọn một mã để áp dụng cho đơn này.</AppText>
              );
            })()}
            {options.isLoading ? <LoadingView /> : null}
            {(options.data ?? []).map((o) => {
              const usable = o.eligible || o.applied;
              return (
                <Pressable
                  key={o.code}
                  onPress={() => toggleOffer(o)}
                  disabled={!canEdit || promoBusy || !usable}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o.applied, disabled: !usable }}
                  accessibilityLabel={`${o.code}. ${usable ? o.description : o.reason}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: o.applied ? 2 : 1,
                    borderColor: o.applied ? colors.primary : colors.border,
                    backgroundColor: o.applied ? colors.primarySoft : colors.surface,
                    opacity: usable ? 1 : 0.55,
                  }}
                >
                  <Ionicons name={o.applied ? 'checkmark-circle' : usable ? 'ellipse-outline' : 'lock-closed-outline'} size={22} color={o.applied ? colors.primary : colors.textFaint} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontSize: 14, fontWeight: '800' }}>{o.code} · {o.name}</AppText>
                    <AppText variant="caption" style={usable ? undefined : { color: colors.danger }}>{usable ? o.description : o.reason}</AppText>
                  </View>
                  {o.discountAmount ? <AppText style={{ fontSize: 14, fontWeight: '700', color: colors.success }}>− {formatMoney(o.discountAmount, o.currency)}</AppText> : null}
                </Pressable>
              );
            })}
            {promoMessage ? <AppText variant="caption" style={{ color: promoMessage.ok ? colors.success : colors.danger }}>{promoMessage.text}</AppText> : null}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <Row label="Vé" value={formatMoney(b.ticketSubtotal, b.currency)} />
          {b.concessionSubtotal ? <Row label="Bắp nước" value={formatMoney(b.concessionSubtotal, b.currency)} /> : null}
          {b.serviceFee ? <Row label="Phí dịch vụ" value={formatMoney(b.serviceFee, b.currency)} /> : null}
          {b.discount ? <Row label={`Giảm giá${b.promotionCode ? ` (${b.promotionCode})` : ''}`} value={`− ${formatMoney(b.discount, b.currency)}`} tone={colors.success} /> : null}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />
          <Row label="Tổng cộng" value={formatMoney(b.total, b.currency)} strong tone={colors.gold} />
        </Card>

        {closed && !holdExpired && b.status !== 'EXPIRED' ? (
          <Card><AppText variant="body">Đặt vé này đang ở trạng thái: {BOOKING_STATUS_LABEL[b.status]}.</AppText></Card>
        ) : null}

        {message ? <AppText variant="caption" style={{ color: colors.warning }}>{message}</AppText> : null}
      </ScrollView>

      {pending && !holdExpired ? (
        <View style={{ padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm }}>
          <Button title={`Thanh toán ${formatMoney(b.total, b.currency)} qua VNPay`} onPress={pay} loading={sessionState.isLoading} disabled={polling} />
          <AppText variant="caption" style={{ textAlign: 'center', fontSize: 11 }}>
            Bạn sẽ thanh toán trên trang VNPay, sau đó ứng dụng tự mở vé của bạn.
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}
