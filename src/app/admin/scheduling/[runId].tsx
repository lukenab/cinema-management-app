import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { MovieResults, ShowtimeList } from '@/components/RunResults';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatShortDate } from '@/lib/format';
import { SKIP_REASON_LABEL } from '@/lib/labels';
import { queryErrorMessage, useDiscardSchedulingRunMutation, useGetSchedulingRunQuery, usePublishSchedulingRunMutation } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { SkipReason } from '@/types/api';

/** One row of a single-series bar list: label, value in text ink, a thin bar in the primary hue. */
function BarRow({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ gap: 3 }} accessible accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <AppText numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>{label}</AppText>
        <AppText style={{ fontSize: 13, fontWeight: '700' }}>{value.toLocaleString('vi-VN')}</AppText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
      </View>
      {detail ? <AppText variant="caption">{detail}</AppText> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={{ fontSize: 22, fontWeight: '800' }}>{value}</AppText>
    </View>
  );
}

/** Report of one scheduling run: what was chosen, and for everything else, why not. */
export default function RunReport() {
  const { runId: raw } = useLocalSearchParams<{ runId: string }>();
  const runId = Number(raw);
  const report = useGetSchedulingRunQuery(runId);
  const [publish, publishState] = usePublishSchedulingRunMutation();
  const [discard, discardState] = useDiscardSchedulingRunMutation();
  const [reason, setReason] = useState<SkipReason | undefined>(undefined);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const r = report.data;
  if (report.isLoading) return <Screen><LoadingView /></Screen>;
  if (report.error || !r) return <Screen><ErrorView message={queryErrorMessage(report.error, 'Không tải được báo cáo.')} onRetry={report.refetch} /></Screen>;

  const scheduled = r.showtimeStatus.SCHEDULED ?? 0;
  const rejected = Object.entries(r.rejectedByReason).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [SkipReason, number][];
  const excluded = Object.entries(r.excludedByReason).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [SkipReason, number][];
  const maxRejected = Math.max(0, ...rejected.map(([, n]) => n));
  const maxDay = Math.max(0, ...r.perDay.map((d) => d.selected));
  const samples = r.rejectionSamples.filter((s) => !reason || s.reason === reason).slice(0, 30);

  const doPublish = async () => {
    setMessage(null);
    const res = await publish(runId);
    setMessage('error' in res ? { text: queryErrorMessage(res.error, 'Không mở bán được.'), ok: false } : { text: `Đã mở bán ${res.data.opened ?? 0} suất chiếu.`, ok: true });
  };
  const doDiscard = () =>
    Alert.alert('Huỷ lần tạo lịch?', `Xoá ${scheduled} suất chưa mở bán của lần tạo này.`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Xoá suất',
        style: 'destructive',
        onPress: async () => {
          const res = await discard(runId);
          setMessage('error' in res ? { text: queryErrorMessage(res.error, 'Không huỷ được.'), ok: false } : { text: `Đã xoá ${res.data.removed ?? 0} suất chiếu.`, ok: true });
        },
      },
    ]);

  return (
    <Screen>
      <ScreenHeader title={`Báo cáo tạo lịch #${r.runId}`} subtitle={`${formatShortDate(r.startDate)} → ${formatShortDate(r.endDate)} · ${r.algorithm}`} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={report.isFetching} onRefresh={() => void report.refetch()} tintColor={colors.primary} />}
      >
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText style={{ flex: 1, fontSize: 15, fontWeight: '700' }}>Tổng quan</AppText>
            <Badge
              label={r.status === 'DISCARDED' ? 'Đã huỷ' : scheduled ? `${scheduled} suất chờ mở bán` : 'Đã mở bán'}
              tone={r.status === 'DISCARDED' ? 'neutral' : scheduled ? 'warning' : 'success'}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Stat label="Ứng viên" value={r.summary.candidates.toLocaleString('vi-VN')} />
            <Stat label="Được chọn" value={r.summary.selected.toLocaleString('vi-VN')} />
            <Stat label="Bị loại" value={r.summary.rejected.toLocaleString('vi-VN')} />
            <Stat label="Không đủ điều kiện (phim·rạp·ngày)" value={r.summary.excluded.toLocaleString('vi-VN')} />
          </View>
          <AppText variant="caption">
            {r.movieResults.filter((m) => m.selected > 0).length}/{r.movieResults.length} phim đã có suất · {r.clusters.map((c) => c.name.replace('CinePrime ', '')).join(', ')} · chạy trong {r.summary.durationMs} ms · tạo bởi {r.createdBy}
          </AppText>
          <AppText variant="caption">
            Chính sách: mỗi {String(r.policy.timeSlotIntervalMinutes)} phút một mốc, dọn phòng {String(r.policy.cleanupMinutes)} phút, cùng phim cách nhau ≥{' '}
            {String(r.policy.sameMovieStaggerMinutes)} phút, tối đa {Math.round(Number(r.policy.maximumRoomShare) * 100)}% phòng cùng lúc.
          </AppText>
          {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}
          {scheduled && r.status !== 'DISCARDED' ? (
            <View style={{ gap: spacing.sm }}>
              <Button title={`Mở bán ${scheduled} suất`} onPress={doPublish} loading={publishState.isLoading} />
              <Button title="Huỷ lần tạo này" variant="danger" onPress={doDiscard} loading={discardState.isLoading} />
            </View>
          ) : null}
          <Button title="Xem lịch chiếu" variant="secondary" onPress={() => router.push({ pathname: '/admin/schedule', params: { date: r.startDate } })} />
        </Card>

        <MovieResults r={r} />

        <ShowtimeList r={r} />

        <Card style={{ gap: spacing.md }}>
          <AppText style={{ fontSize: 15, fontWeight: '700' }}>Suất được chọn theo ngày</AppText>
          {r.perDay.map((d) => <BarRow key={d.date} label={formatShortDate(d.date)} value={d.selected} max={maxDay} />)}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <AppText style={{ fontSize: 15, fontWeight: '700' }}>Theo rạp</AppText>
          {r.perCluster.map((c) => (
            <BarRow key={c.clusterId} label={c.name} value={c.selected} max={Math.max(...r.perCluster.map((x) => x.selected), 0)} detail={`${c.selected}/${c.candidates} ứng viên được chọn · ${c.rejected} bị loại`} />
          ))}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <AppText style={{ fontSize: 15, fontWeight: '700' }}>Lý do bị loại</AppText>
          {rejected.length ? rejected.map(([k, n]) => <BarRow key={k} label={SKIP_REASON_LABEL[k] ?? k} value={n} max={maxRejected} />) : <AppText variant="caption">Không có ứng viên bị loại.</AppText>}
          {excluded.length ? (
            <>
              <AppText style={{ fontSize: 14, fontWeight: '700', marginTop: spacing.sm }}>Không đủ điều kiện (phim · rạp · ngày)</AppText>
              {excluded.map(([k, n]) => (
                <View key={k} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AppText style={{ flex: 1, fontSize: 13 }}>{SKIP_REASON_LABEL[k] ?? k}</AppText>
                  <AppText style={{ fontSize: 13, fontWeight: '700' }}>{n}</AppText>
                </View>
              ))}
            </>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <AppText style={{ fontSize: 15, fontWeight: '700' }}>Mẫu ứng viên bị loại (điểm cao nhất)</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Chip label="Tất cả" selected={!reason} onPress={() => setReason(undefined)} />
            {rejected.map(([k]) => <Chip key={k} label={SKIP_REASON_LABEL[k] ?? k} selected={reason === k} onPress={() => setReason(k)} />)}
          </View>
          {samples.map((s, i) => (
            <View key={`${s.roomId}-${s.date}-${s.time}-${i}`} style={{ paddingVertical: spacing.xs, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, gap: 2 }}>
              <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: '700' }}>{s.time} {formatShortDate(s.date)} · {s.movieTitle}</AppText>
              <AppText variant="caption">
                {s.clusterName.replace('CinePrime ', '')} · {s.roomName} · {s.format} · điểm {s.score.toFixed(3)} · {SKIP_REASON_LABEL[s.reason] ?? s.reason}
              </AppText>
            </View>
          ))}
          {r.exclusions.length ? (
            <>
              <AppText style={{ fontSize: 14, fontWeight: '700', marginTop: spacing.sm }}>Phim không đủ điều kiện</AppText>
              {r.exclusions.slice(0, 20).map((e, i) => (
                <AppText key={`${e.movieId}-${e.clusterId}-${e.date}-${i}`} variant="caption">
                  {formatShortDate(e.date)} · {e.movieTitle} · {e.clusterName.replace('CinePrime ', '')}: {SKIP_REASON_LABEL[e.reason] ?? e.reason}
                </AppText>
              ))}
            </>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
