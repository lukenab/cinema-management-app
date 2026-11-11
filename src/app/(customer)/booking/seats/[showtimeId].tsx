import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SeatGrid, SeatLegend, seatKey } from '@/components/SeatGrid';
import { AppText, Button, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { newIdempotencyKey } from '@/lib/apiClient';
import { formatLongDate, formatMoney, formatTime } from '@/lib/format';
import { useSeatMapRefresh } from '@/hooks/use-seat-map-refresh';
import { useAppSelector } from '@/store';
import {
  queryErrorMessage,
  useCreateBookingMutation,
  useGetProfileQuery,
  useGetSeatHoldPolicyQuery,
  useGetSeatMapQuery,
  useGetShowtimeQuery,
} from '@/store/api';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Seat } from '@/types/api';

export default function SeatSelection() {
  const { showtimeId: rawId } = useLocalSearchParams<{ showtimeId: string }>();
  const showtimeId = Number(rawId);
  const user = useAppSelector((s) => s.auth.user);
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');

  const showtime = useGetShowtimeQuery(showtimeId);
  const seatMap = useGetSeatMapQuery(showtimeId, { skip: !signedIn });
  const policy = useGetSeatHoldPolicyQuery(undefined, { skip: !signedIn });
  const profile = useGetProfileQuery(user?.accountId ?? '', { skip: !user });
  const [createBooking, createState] = useCreateBookingMutation();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  // The same seat selection must reuse its key so a retry can never create a second booking.
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  const refetchSeats = seatMap.refetch;
  const reload = useCallback(() => {
    void refetchSeats();
  }, [refetchSeats]);
  // Keeps the map current in the background; no status indicator (it carries no decision for the user).
  useSeatMapRefresh(signedIn, reload);

  const seats = useMemo(() => seatMap.data?.seats ?? [], [seatMap.data]);
  const maxSeats = policy.data?.maxSeatsPerBooking ?? 8;

  // Drop selections that someone else took in the meantime.
  const effectiveSelected = useMemo(() => {
    const free = new Set(seats.filter((s) => s.status === 'AVAILABLE').map((s) => s.seatId));
    return new Set([...selected].filter((id) => free.has(id)));
  }, [seats, selected]);

  const selectedSeats = useMemo(
    () => seats.filter((s) => effectiveSelected.has(s.seatId)).sort((a, b) => a.row.localeCompare(b.row) || a.number - b.number),
    [seats, effectiveSelected],
  );
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const toggle = (seat: Seat) => {
    setError('');
    const groupIds = seat.seatGroupId
      ? seats.filter((s) => s.seatGroupId === seat.seatGroupId && s.status === 'AVAILABLE').map((s) => s.seatId)
      : [seat.seatId];
    setSelected((prev) => {
      const next = new Set(prev);
      if (groupIds.some((id) => next.has(id))) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        if (next.size + groupIds.length > maxSeats) {
          setError(`Mỗi lần đặt vé được chọn tối đa ${maxSeats} ghế.`);
          return prev;
        }
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const needsProfile =
    (profile.error as { status?: number } | undefined)?.status === 404 || profile.data?.profileCompleted === false;

  const proceed = async () => {
    if (!effectiveSelected.size) return;
    if (needsProfile) {
      router.push('/complete-profile');
      return;
    }
    const seatIds = [...effectiveSelected].sort((a, b) => a - b);
    const signature = `${showtimeId}:${seatIds.join(',')}`;
    if (keyRef.current?.signature !== signature) keyRef.current = { signature, key: newIdempotencyKey() };

    setError('');
    const res = await createBooking({ showtimeId, seatIds, idempotencyKey: keyRef.current.key });
    if ('error' in res) {
      setError(queryErrorMessage(res.error, 'Không thể giữ ghế. Vui lòng thử lại.'));
      reload();
      return;
    }
    // Next step: food and drinks, then payment. Back returns here; the same seats reuse the same booking.
    router.push(`/booking/${res.data.bookingId}/concessions`);
  };

  const st = showtime.data;
  const hasSelection = selectedSeats.length > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={12} style={{ padding: spacing.sm }}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1}>{st?.movieName ?? 'Chọn ghế'}</AppText>
          {st ? (
            <AppText variant="caption" numberOfLines={1}>
              {[st.clusterName, st.cinemaRoomName, `${formatTime(st.startTime)} · ${formatLongDate(st.showDate)}`].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
        </View>
      </View>

      {!signedIn ? (
        <EmptyView title="Đăng nhập để chọn ghế" message="Ghế sẽ được giữ cho bạn trong lúc thanh toán nên chúng tôi cần biết tài khoản của bạn." />
      ) : seatMap.isLoading ? (
        <LoadingView label="Đang tải sơ đồ ghế…" />
      ) : seatMap.error ? (
        <ErrorView message={queryErrorMessage(seatMap.error)} onRetry={reload} />
      ) : !seatMap.data?.seats.length ? (
        <EmptyView title="Suất chiếu chưa có sơ đồ ghế" message="Vui lòng chọn suất chiếu khác." />
      ) : (
        <View style={{ flex: 1, justifyContent: 'flex-start', paddingTop: spacing.xl, gap: spacing.xl }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: '72%', height: 5, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.85 }} />
            <AppText variant="caption" style={{ fontSize: 11, letterSpacing: 3 }}>MÀN HÌNH</AppText>
          </View>
          <SeatGrid seats={seats} positions={seatMap.data.positions ?? []} selectedIds={effectiveSelected} onToggle={toggle} />
          <View style={{ gap: spacing.sm }}>
            <SeatLegend />
            <AppText variant="caption" style={{ textAlign: 'center', fontSize: 12, color: colors.textFaint }}>
              Mỗi lần đặt vé tối đa {maxSeats} ghế.
            </AppText>
          </View>
        </View>
      )}

      {signedIn ? (
        <View style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow }}>
          {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: 2 }}>
              {hasSelection ? (
                <>
                  <AppText variant="caption" numberOfLines={1}>
                    Ghế {selectedSeats.map((s) => seatKey(s)).join(', ')}
                  </AppText>
                  <AppText style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{formatMoney(total)}</AppText>
                </>
              ) : (
                <AppText variant="body" style={{ color: colors.textMuted }}>Chưa chọn ghế</AppText>
              )}
            </View>
            <Button
              title={needsProfile ? 'Bổ sung hồ sơ' : 'Tiếp tục'}
              onPress={proceed}
              loading={createState.isLoading}
              disabled={!hasSelection}
              style={{ minWidth: 150 }}
            />
          </View>
        </View>
      ) : (
        <View style={{ padding: spacing.lg }}>
          <Button title="Đăng nhập" onPress={() => router.push('/login')} />
        </View>
      )}
    </Screen>
  );
}
