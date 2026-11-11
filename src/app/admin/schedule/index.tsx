import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Chip, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatMoney, formatTime, nextDays } from '@/lib/format';
import { SHOWTIME_STATUS_LABEL, SHOWTIME_STATUS_TONE, showtimeFormatLabel } from '@/lib/labels';
import { queryErrorMessage, useBulkShowtimeStatusMutation, useGetAdminClustersQuery, useGetAdminShowtimesQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { AdminShowtime } from '@/types/api';

const DAYS = nextDays(14);

export default function AdminSchedule() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date && DAYS.some((d) => d.iso === params.date) ? params.date : DAYS[0].iso);
  const clusters = useGetAdminClustersQuery();
  const [picked, setClusterId] = useState<number | undefined>(undefined);
  const clusterId = picked ?? clusters.data?.[0]?.clusterId;
  const [open, setOpen] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const list = useGetAdminShowtimesQuery({ date, clusterId }, { skip: !clusterId });
  const [setStatus, statusState] = useBulkShowtimeStatusMutation();
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const scheduled = rows.filter((r) => r.status === 'SCHEDULED');

  const change = async (ids: number[], status: 'ON_SALE' | 'SUSPENDED' | 'CANCELLED') => {
    setMessage(null);
    const res = await setStatus({ showtimeIds: ids, status });
    if ('error' in res) setMessage({ text: queryErrorMessage(res.error, 'Không thể cập nhật suất chiếu.'), ok: false });
    else if (res.data.skipped.length) setMessage({ text: `${res.data.updated} suất đã cập nhật. ${res.data.skipped[0].reason}`, ok: res.data.updated > 0 });
    else {
      setOpen(null);
      if (ids.length > 1) setMessage({ text: `Đã cập nhật ${res.data.updated} suất.`, ok: true });
    }
  };

  const confirmCancel = (st: AdminShowtime) =>
    Alert.alert('Huỷ suất chiếu?', `${formatTime(st.startTime)} · ${st.movieName} · ${st.cinemaRoomName}. Các đơn chưa thanh toán sẽ bị huỷ. Suất đã có vé bán ra không thể huỷ.`, [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ suất', style: 'destructive', onPress: () => void change([st.showTimeId], 'CANCELLED') },
    ]);

  return (
    <Screen>
      <ScreenHeader title="Lịch chiếu" subtitle="Theo rạp và ngày" />
      <FlatList
        data={rows}
        keyExtractor={(s) => String(s.showTimeId)}
        refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {(clusters.data ?? []).map((c) => (
                <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={clusterId === c.clusterId} onPress={() => { setClusterId(c.clusterId); setOpen(null); }} />
              ))}
            </View>
            <FlatList
              horizontal
              data={DAYS}
              keyExtractor={(d) => d.iso}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
              renderItem={({ item }) => {
                const active = item.iso === date;
                return (
                  <Pressable
                    onPress={() => { setDate(item.iso); setOpen(null); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{ minWidth: 68, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: active ? colors.primary : colors.surface, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
                  >
                    <AppText style={{ fontSize: 12, color: active ? colors.onPrimary : colors.text }}>{item.label}</AppText>
                    <AppText style={{ fontSize: 15, fontWeight: '800', color: active ? colors.onPrimary : colors.text }}>{item.date}</AppText>
                  </Pressable>
                );
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Tạo suất tự động" variant="secondary" onPress={() => router.push('/admin/scheduling')} style={{ flex: 1, minHeight: 40 }} />
              {scheduled.length ? (
                <Button title={`Mở bán ${scheduled.length} suất`} onPress={() => change(scheduled.map((s) => s.showTimeId), 'ON_SALE')} loading={statusState.isLoading} style={{ flex: 1, minHeight: 40 }} />
              ) : null}
            </View>
            {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}
          </View>
        }
        ListEmptyComponent={
          list.isLoading || !clusterId ? (
            <LoadingView />
          ) : list.error ? (
            <ErrorView message={queryErrorMessage(list.error)} onRetry={list.refetch} />
          ) : (
            <EmptyView title="Chưa có suất chiếu" message="Rạp chưa có lịch ngày này. Dùng Tạo suất tự động để xếp lịch." />
          )
        }
        renderItem={({ item }) => {
          const expanded = open === item.showTimeId;
          const closed = item.status === 'CANCELLED' || item.status === 'COMPLETED';
          return (
            <Pressable
              onPress={() => setOpen(expanded ? null : item.showTimeId)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.xs, opacity: closed ? 0.6 : 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText style={{ fontSize: 16, fontWeight: '800', minWidth: 48 }}>{formatTime(item.startTime)}</AppText>
                <AppText numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{item.movieName}</AppText>
                <Badge label={SHOWTIME_STATUS_LABEL[item.status] ?? item.status} tone={SHOWTIME_STATUS_TONE[item.status] ?? 'neutral'} />
              </View>
              <AppText variant="caption">
                {item.cinemaRoomName} · {showtimeFormatLabel(item)} · {formatMoney(item.price)}
                {item.seatPrices?.VIP ? ` (VIP ${formatMoney(item.seatPrices.VIP)})` : ''} · đã bán {item.soldSeats}/{item.totalSeats}
                {item.generationRunId ? ` · lần tạo #${item.generationRunId}` : ''}
              </AppText>
              {expanded && !closed ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  {item.status === 'ON_SALE' ? (
                    <Button title="Tạm dừng bán" variant="secondary" onPress={() => change([item.showTimeId], 'SUSPENDED')} loading={statusState.isLoading} style={{ flex: 1, minHeight: 40 }} />
                  ) : (
                    <Button title={item.status === 'SCHEDULED' ? 'Mở bán' : 'Mở bán lại'} variant="secondary" onPress={() => change([item.showTimeId], 'ON_SALE')} loading={statusState.isLoading} style={{ flex: 1, minHeight: 40 }} />
                  )}
                  <Button title="Huỷ suất" variant="danger" onPress={() => confirmCancel(item)} style={{ flex: 1, minHeight: 40 }} />
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
