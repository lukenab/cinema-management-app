import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, Badge, Button, Card, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { useCinema } from '@/hooks/use-cinema';
import { formatLongDate, formatMoney, formatTime } from '@/lib/format';
import { showtimeFormatLabel } from '@/lib/labels';
import { queryErrorMessage, useGetBookingQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';

/** A paid ticket: the QR code (the booking code) is what the gate scans; the code is printed under it too. */
export default function Ticket() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const booking = useGetBookingQuery(bookingId);
  const { cinemas } = useCinema();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (booking.isLoading) return <Screen><LoadingView /></Screen>;
  if (booking.error || !booking.data) return <Screen><ErrorView message={queryErrorMessage(booking.error, 'Không tải được vé này.')} onRetry={booking.refetch} /></Screen>;
  const b = booking.data;
  const confirmed = b.status === 'CONFIRMED';
  const cinema = cinemas.find((c) => c.clusterId === b.cinemaClusterId);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={12} style={{ padding: spacing.sm }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="heading" style={{ flex: 1 }}>{confirmed ? 'Vé của bạn' : 'Đơn đặt vé'}</AppText>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Poster uri={b.posterUrl} style={{ width: 84, aspectRatio: 2 / 3, borderRadius: 6 }} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText numberOfLines={3} style={{ fontSize: 18, fontWeight: '800', lineHeight: 23 }}>{b.movieName}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
                {b.ageRatingCode ? <Badge label={b.ageRatingCode} tone="warning" /> : null}
                <AppText variant="caption" style={{ fontWeight: '700' }}>{showtimeFormatLabel(b)}</AppText>
              </View>
              <AppText style={{ fontSize: 14, fontWeight: '700' }}>
                {formatTime(b.startTime)}{b.endTime ? ` ~ ${formatTime(b.endTime)}` : ''} · {formatLongDate(b.showDate)}
              </AppText>
              <AppText variant="caption">{[b.cinemaClusterName, b.cinemaRoomName].filter(Boolean).join(' · ')}</AppText>
              {cinema?.address ? <AppText variant="caption">{cinema.address}</AppText> : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {b.seats.map((s) => <Badge key={s.showtimeSeatId} label={`Ghế ${s.seatCode}`} tone="info" />)}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' }} />

          {confirmed && b.bookingCode ? (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
              <AppText variant="caption" style={{ textAlign: 'center' }}>Đưa mã QR này cho nhân viên soát vé để vào rạp</AppText>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Mã QR của vé, mã đặt vé ${b.bookingCode}`}
                style={{ padding: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
              >
                <QRCode value={b.bookingCode} size={200} quietZone={4} />
              </View>
              <AppText selectable style={{ fontSize: 24, fontWeight: '800', letterSpacing: 4, color: colors.text }}>{b.bookingCode}</AppText>
            </View>
          ) : (
            <View style={{ alignItems: 'center', padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
              <AppText variant="caption" style={{ textAlign: 'center' }}>Mã vé sẽ hiển thị sau khi bạn thanh toán thành công.</AppText>
            </View>
          )}

          {confirmed ? (
            <View style={{ gap: 4 }}>
              <AppText variant="caption">• Vui lòng có mặt trước giờ chiếu ít nhất 15 phút.</AppText>
              {b.ageRatingCode && b.ageRatingCode !== 'P' && b.ageRatingCode !== 'K' ? (
                <AppText variant="caption">• Phim {b.ageRatingCode}: mang theo giấy tờ tùy thân để xác minh độ tuổi khi cần.</AppText>
              ) : null}
            </View>
          ) : null}
        </Card>

        {b.concessions.length ? (
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="heading">Bắp nước</AppText>
            {b.concessions.map((c) => (
              <View key={c.itemCode} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="body">{c.quantity} × {c.itemName}{c.options ? ` (${c.options})` : ''}</AppText>
              </View>
            ))}
            {b.concessionPickupCode ? (
              <View style={{ marginTop: spacing.xs }}>
                <AppText variant="label">Mã nhận bắp nước tại quầy</AppText>
                <AppText variant="title" style={{ letterSpacing: 3 }}>{b.concessionPickupCode}</AppText>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption">Tổng tiền</AppText>
            <AppText variant="heading" style={{ color: colors.gold }}>{formatMoney(b.total, b.currency)}</AppText>
          </View>
          {b.discount && b.promotionCode ? <AppText variant="caption">Đã giảm {formatMoney(b.discount, b.currency)} với mã {b.promotionCode}</AppText> : null}
          {b.paidAt ? <AppText variant="caption">Thanh toán lúc {formatLongDate(b.paidAt)}</AppText> : null}
        </Card>

        {b.status === 'PENDING_PAYMENT' ? <Button title="Tiếp tục thanh toán" onPress={() => router.replace(`/booking/${bookingId}/checkout`)} /> : null}
        <Button title="Xong" variant="secondary" onPress={() => router.replace('/tickets')} />
      </ScrollView>
    </Screen>
  );
}
