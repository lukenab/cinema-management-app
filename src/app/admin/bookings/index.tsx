import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Chip, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatLongDate, formatMoney, formatTime } from '@/lib/format';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from '@/lib/labels';
import { queryErrorMessage, useGetAllBookingsQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';

const FILTERS: { key?: string; label: string }[] = [
  { label: 'Tất cả' },
  { key: 'CONFIRMED', label: 'Đã thanh toán' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { key: 'CLOSED', label: 'Đã đóng' },
];

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={{ fontSize: 13 }}>{value}</AppText>
    </View>
  );
}

export default function AdminBookings() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [text]);

  const list = useGetAllBookingsQuery({ page, status, q: q || undefined });
  const totalPages = list.data?.totalPages ?? 1;

  return (
    <Screen>
      <ScreenHeader title="Đặt vé" subtitle={list.data ? `${list.data.totalElements} đơn · chỉ xem` : 'Chỉ xem'} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput value={text} onChangeText={setText} placeholder="Tìm theo mã đặt vé hoặc tên phim" placeholderTextColor={colors.textFaint} style={{ flex: 1, minHeight: 40, color: colors.text, fontSize: 14 }} autoCapitalize="none" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FILTERS.map((f) => <Chip key={f.label} label={f.label} selected={status === f.key} onPress={() => { setStatus(f.key); setPage(0); }} />)}
        </View>
      </View>

      {list.isLoading ? (
        <LoadingView />
      ) : list.error ? (
        <ErrorView message={queryErrorMessage(list.error)} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={list.data?.content ?? []}
          keyExtractor={(b) => b.bookingId}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyView title="Không có đơn đặt vé" message="Không có đơn nào phù hợp với bộ lọc." />}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md }}>
                <Button title="Trước" variant="secondary" disabled={page === 0} onPress={() => setPage((p) => Math.max(0, p - 1))} style={{ minHeight: 38 }} />
                <AppText variant="caption">Trang {page + 1}/{totalPages}</AppText>
                <Button title="Sau" variant="secondary" disabled={page + 1 >= totalPages} onPress={() => setPage((p) => p + 1)} style={{ minHeight: 38 }} />
              </View>
            ) : (
              <View />
            )
          }
          renderItem={({ item }) => {
            const expanded = open === item.bookingId;
            return (
              <Pressable
                onPress={() => setOpen(expanded ? null : item.bookingId)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                  <AppText style={{ fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>{item.bookingCode}</AppText>
                  <Badge label={BOOKING_STATUS_LABEL[item.status] ?? item.status} tone={BOOKING_STATUS_TONE[item.status] ?? 'neutral'} />
                </View>
                <AppText numberOfLines={1} style={{ fontSize: 13 }}>{item.movieName}</AppText>
                <AppText variant="caption">{formatLongDate(item.showDate)} · {formatTime(item.startTime)} · {item.cinemaRoomName}</AppText>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="caption">{item.customerName ? `${item.customerName} · ` : ''}{item.seats.map((s) => s.seatCode).join(', ')}</AppText>
                  <AppText style={{ fontWeight: '700' }}>{formatMoney(item.total, item.currency)}</AppText>
                </View>

                {expanded ? (
                  <View style={{ gap: 4, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Line label="Tiền vé" value={formatMoney(item.ticketSubtotal, item.currency)} />
                    {item.concessions.map((c) => <Line key={c.itemCode} label={`${c.quantity} × ${c.itemName}${c.options ? ` (${c.options})` : ''}`} value={formatMoney(c.finalAmount, item.currency)} />)}
                    {item.discount ? <Line label={`Giảm giá${item.promotionCode ? ` (${item.promotionCode})` : ''}`} value={`− ${formatMoney(item.discount, item.currency)}`} /> : null}
                    <Line label="Tạo lúc" value={formatLongDate(item.createdAt)} />
                    {item.paidAt ? <Line label="Thanh toán lúc" value={formatLongDate(item.paidAt)} /> : null}
                    {item.concessionPickupCode ? <Line label="Mã nhận bắp nước" value={item.concessionPickupCode} /> : null}
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
