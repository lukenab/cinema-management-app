import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { AppText, Button, EmptyView, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { useCountdown } from '@/hooks/use-countdown';
import { formatCountdown, formatLongDate, formatMoney, formatTime } from '@/lib/format';
import { useAppSelector } from '@/store';
import { queryErrorMessage, useGetMyBookingsQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { BookingDetail } from '@/types/api';

type Tab = 'upcoming' | 'watched';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming', label: 'Phim sắp xem' },
  { key: 'watched', label: 'Phim đã xem' },
];

/** An order that is still being paid is not a ticket yet: it is a short-lived reminder above the list. */
function PendingOrder({ booking }: { booking: BookingDetail }) {
  const remaining = useCountdown(booking.expiresAt ?? null);
  if (remaining === 0) return null;
  return (
    <Pressable
      onPress={() => router.push(`/booking/${booking.bookingId}/checkout`)}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 })}
    >
      <Ionicons name="time-outline" size={22} color={colors.primary} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>Đơn đang chờ thanh toán</AppText>
        <AppText numberOfLines={1} variant="caption">{booking.movieName} · giữ ghế còn {formatCountdown(remaining ?? 0)}</AppText>
      </View>
      <AppText style={{ color: colors.primary, fontWeight: '700' }}>Thanh toán</AppText>
    </Pressable>
  );
}

function TicketCard({ booking, watched }: { booking: BookingDetail; watched: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/booking/${booking.bookingId}/ticket`)}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : watched ? 0.8 : 1 })}
    >
      <Poster uri={booking.posterUrl} style={{ width: 64, aspectRatio: 2 / 3, borderRadius: 6 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <AppText numberOfLines={2} style={{ fontSize: 15, fontWeight: '800' }}>{booking.movieName}</AppText>
        <AppText variant="caption">{formatLongDate(booking.showDate)} · {formatTime(booking.startTime)}</AppText>
        <AppText variant="caption">{[booking.cinemaClusterName, booking.cinemaRoomName].filter(Boolean).join(' · ')}</AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.xs }}>
          <AppText variant="caption" style={{ flex: 1 }}>Ghế {booking.seats.map((s) => s.seatCode).join(', ')}</AppText>
          <AppText style={{ fontWeight: '700' }}>{formatMoney(booking.total, booking.currency)}</AppText>
        </View>
        <AppText variant="label" style={{ color: colors.textFaint }}>Mã {booking.bookingCode}</AppText>
      </View>
    </Pressable>
  );
}

export default function TicketsTab() {
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  const [tab, setTab] = useState<Tab>('upcoming');

  const tickets = useGetMyBookingsQuery({ scope: tab, page: 0, size: 30 }, { skip: !signedIn });
  const pending = useGetMyBookingsQuery({ scope: 'pending', page: 0, size: 1 }, { skip: !signedIn });

  // The screen stays mounted inside the tab bar, so reload whenever it comes back into view.
  const refetchTickets = tickets.refetch;
  const refetchPending = pending.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      void refetchTickets();
      void refetchPending();
    }, [signedIn, refetchTickets, refetchPending]),
  );

  const waiting = tab === 'upcoming' ? pending.data?.content[0] : undefined;

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <AppText variant="title">Vé của tôi</AppText>
      </View>
      {!signedIn ? (
        <View style={{ flex: 1 }}>
          <EmptyView title="Đăng nhập để xem vé" message="Vé điện tử của bạn sẽ hiển thị tại đây." />
          <View style={{ padding: spacing.lg, paddingBottom: 110 }}><Button title="Đăng nhập" onPress={() => router.push('/login')} /></View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.key }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 3, borderBottomColor: tab === t.key ? colors.primary : 'transparent', marginBottom: -1 }}
              >
                <AppText style={{ fontSize: 15, fontWeight: '700', color: tab === t.key ? colors.primary : colors.textFaint }}>{t.label}</AppText>
              </Pressable>
            ))}
          </View>

          {tickets.isLoading ? (
            <LoadingView />
          ) : tickets.error ? (
            <ErrorView message={queryErrorMessage(tickets.error)} onRetry={tickets.refetch} />
          ) : (
            <FlatList
              data={tickets.data?.content ?? []}
              keyExtractor={(b) => b.bookingId}
              contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1, paddingBottom: 110 }}
              refreshControl={<RefreshControl refreshing={tickets.isFetching} onRefresh={() => { void tickets.refetch(); void pending.refetch(); }} tintColor={colors.primary} />}
              ListHeaderComponent={waiting ? <PendingOrder booking={waiting} /> : undefined}
              ListEmptyComponent={
                tab === 'upcoming' ? (
                  <EmptyView title="Chưa có vé sắp xem" message="Vé đã thanh toán cho các suất chưa chiếu sẽ hiển thị tại đây." />
                ) : (
                  <EmptyView title="Chưa có phim đã xem" message="Vé của các suất đã chiếu sẽ được lưu tại đây." />
                )
              }
              renderItem={({ item }) => <TicketCard booking={item} watched={tab === 'watched'} />}
            />
          )}
        </>
      )}
    </Screen>
  );
}
