import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, Input, LoadingView, Poster, Screen } from '@/components/ui';
import { formatShortDate, parseIsoDate, toIsoDate } from '@/lib/format';
import {
  queryErrorMessage,
  useGetAdminClustersQuery,
  useGetSchedulingEligibilityQuery,
  useGetSchedulingRunsQuery,
  useRunSchedulingMutation,
} from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { MovieEligibility } from '@/types/api';

const LENGTHS = [1, 3, 7, 14];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
};

/**
 * Where a schedulable movie may be shown: cinemas that start on the same day are grouped, e.g.
 * "Cả 3 rạp đã chọn" or "Ninh Kiều, Cái Răng (từ 13/11/2026); Bình Thủy".
 */
function windowsText(m: MovieEligibility, rangeStart: string, chosenCount: number) {
  const byStart = new Map<string, string[]>();
  for (const c of m.clusters) byStart.set(c.from, [...(byStart.get(c.from) ?? []), c.name.replace('CinePrime ', '')]);
  return [...byStart.entries()]
    .map(([from, names]) => {
      const who = names.length === chosenCount && chosenCount > 1 ? `cả ${chosenCount} rạp đã chọn` : names.join(', ');
      return from > rangeStart ? `${who} (từ ${formatShortDate(from)})` : who;
    })
    .join('; ');
}

/**
 * "Tạo suất chiếu tự động" (Legacy Greedy): pick dates, cinemas and movies. Only movies with an open release
 * plan at a chosen cinema inside the chosen dates can be picked; the others are locked with the reason.
 * The result opens as a report; showtimes stay unsold until published.
 */
export default function Scheduling() {
  const params = useLocalSearchParams<{ movieId?: string }>();
  const clusters = useGetAdminClustersQuery();
  const runs = useGetSchedulingRunsQuery();
  const [run, runState] = useRunSchedulingMutation();

  const [start, setStart] = useState(toIsoDate(new Date()));
  const [days, setDays] = useState(7);
  const [pickedClusters, setClusterIds] = useState<number[] | null>(null);
  const [pickedMovies, setMovieIds] = useState<number[] | null>(null);
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState('');

  // Until the admin changes it: every cinema.
  const clusterIds = pickedClusters ?? (clusters.data ?? []).map((c) => c.clusterId);
  const validStart = ISO.test(start) && !Number.isNaN(Date.parse(start));
  const endDate = validStart ? addDays(start, days - 1) : '';
  const checkable = validStart && clusterIds.length > 0;

  const eligibility = useGetSchedulingEligibilityQuery(
    { startDate: start, endDate, clusterIds },
    { skip: !checkable },
  );
  // Selectable movies first; the locked ones follow, each with its reason.
  const list = useMemo(
    () => [...(eligibility.data ?? [])].sort((a, b) => Number(b.eligible) - Number(a.eligible)),
    [eligibility.data],
  );
  const eligibleIds = useMemo(() => list.filter((m) => m.eligible).map((m) => m.movieId), [list]);
  const lockedCount = list.length - eligibleIds.length;

  // Until the admin changes it: the movie from the link, otherwise every movie that can be scheduled.
  // A movie that stops being eligible (other dates or cinemas) drops out of the selection by itself.
  const movieIds = (pickedMovies ?? (params.movieId ? [Number(params.movieId)] : eligibleIds)).filter((id) =>
    eligibleIds.includes(id),
  );

  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async () => {
    setError('');
    if (!validStart) return setError('Ngày bắt đầu theo dạng YYYY-MM-DD.');
    if (!clusterIds.length) return setError('Chọn ít nhất một rạp.');
    if (!movieIds.length) return setError('Chọn ít nhất một phim đủ điều kiện.');
    const res = await run({ startDate: start, endDate, clusterIds, movieIds, publish });
    if ('error' in res) return setError(queryErrorMessage(res.error, 'Không tạo được lịch chiếu.'));
    router.push(`/admin/scheduling/${res.data.runId}`);
  };

  return (
    <Screen>
      <ScreenHeader title="Tạo suất chiếu tự động" subtitle="Thuật toán Legacy Greedy" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={runs.isFetching} onRefresh={() => void runs.refetch()} tintColor={colors.primary} />}
        >
          <Card style={{ gap: spacing.md }}>
            <AppText variant="label">Khoảng ngày</AppText>
            <Input value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" label="Từ ngày" />
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {LENGTHS.map((n) => <Chip key={n} label={`${n} ngày`} selected={days === n} onPress={() => setDays(n)} />)}
            </View>
            {validStart ? <AppText variant="caption">Từ {formatShortDate(start)} đến {formatShortDate(endDate)}</AppText> : null}

            <AppText variant="label">Rạp</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {(clusters.data ?? []).map((c) => (
                <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={clusterIds.includes(c.clusterId)} onPress={() => toggle(clusterIds, setClusterIds, c.clusterId)} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="label" style={{ flex: 1 }}>
                Phim ({movieIds.length}/{eligibleIds.length} đủ điều kiện đã chọn)
              </AppText>
              {eligibleIds.length ? (
                <Pressable onPress={() => setMovieIds(movieIds.length === eligibleIds.length ? [] : eligibleIds)} hitSlop={8} accessibilityRole="button">
                  <AppText style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{movieIds.length === eligibleIds.length ? 'Bỏ chọn' : 'Chọn tất cả'}</AppText>
                </Pressable>
              ) : null}
            </View>
            <AppText variant="caption">
              Chỉ phim đã có kế hoạch phát hành đang khai thác tại rạp đã chọn, trùng khoảng ngày, mới được xếp suất.
            </AppText>

            {!checkable ? (
              <AppText variant="caption" style={{ color: colors.warning }}>
                {!validStart ? 'Nhập ngày bắt đầu hợp lệ để xem phim đủ điều kiện.' : 'Chọn ít nhất một rạp để xem phim đủ điều kiện.'}
              </AppText>
            ) : eligibility.isLoading ? (
              <LoadingView />
            ) : eligibility.error ? (
              <AppText variant="caption" style={{ color: colors.danger }}>{queryErrorMessage(eligibility.error, 'Không kiểm tra được điều kiện của phim.')}</AppText>
            ) : null}

            {list.map((m) => {
              const active = movieIds.includes(m.movieId);
              if (!m.eligible) {
                return (
                  <View
                    key={m.movieId}
                    accessible
                    accessibilityState={{ disabled: true }}
                    accessibilityLabel={`${m.title}, chưa đủ điều kiện. ${m.message ?? ''}`}
                    style={{ gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Ionicons name="lock-closed" size={18} color={colors.textFaint} />
                      <Poster uri={m.posterUrl} style={{ width: 32, aspectRatio: 2 / 3, borderRadius: 4, opacity: 0.6 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.textMuted }}>{m.title}</AppText>
                        <AppText variant="caption" style={{ color: colors.warning }}>{m.message}</AppText>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => router.push({ pathname: '/admin/release-plans', params: { movieId: String(m.movieId) } })}
                      accessibilityRole="button"
                      hitSlop={6}
                      style={{ alignSelf: 'flex-start', marginLeft: 26 }}
                    >
                      <AppText style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Mở kế hoạch phát hành →</AppText>
                    </Pressable>
                  </View>
                );
              }
              return (
                <Pressable
                  key={m.movieId}
                  onPress={() => toggle(movieIds, setMovieIds, m.movieId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.surface }}
                >
                  <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? colors.primary : colors.textFaint} />
                  <Poster uri={m.posterUrl} style={{ width: 32, aspectRatio: 2 / 3, borderRadius: 4 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>{m.title}</AppText>
                    <AppText variant="caption">{m.durationMinutes ? `${m.durationMinutes} phút` : 'chưa có thời lượng (tạm tính 120 phút)'} · khai thác: {windowsText(m, start, clusterIds.length)}</AppText>
                  </View>
                </Pressable>
              );
            })}
            {lockedCount ? (
              <AppText variant="caption">{lockedCount} phim bị khoá vì chưa đủ điều kiện. Mở kế hoạch phát hành rồi quay lại, hoặc đổi rạp và khoảng ngày.</AppText>
            ) : null}

            <AppText variant="label">Sau khi tạo</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip label="Xem báo cáo rồi mở bán" selected={!publish} onPress={() => setPublish(false)} />
              <Chip label="Mở bán ngay" selected={publish} onPress={() => setPublish(true)} />
            </View>
            {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
            <Button title="Tạo suất chiếu" onPress={submit} loading={runState.isLoading} disabled={!movieIds.length} />
            <AppText variant="caption">
              Suất được xếp trong giờ mở cửa của từng rạp, cách nhau 15 phút dọn phòng; suất đã có được giữ nguyên nên chạy lại không bị trùng.
            </AppText>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">Lịch sử tạo lịch</AppText>
            {(runs.data ?? []).length === 0 && !runs.isLoading ? <AppText variant="caption">Chưa có lần tạo nào.</AppText> : null}
            {(runs.data ?? []).map((r) => (
              <Pressable
                key={r.runId}
                onPress={() => router.push(`/admin/scheduling/${r.runId}`)}
                accessibilityRole="button"
                style={({ pressed }) => ({ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4, opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <AppText style={{ flex: 1, fontSize: 14, fontWeight: '700' }}>#{r.runId} · {formatShortDate(r.startDate)} → {formatShortDate(r.endDate)}</AppText>
                  <Badge
                    label={r.status === 'DISCARDED' ? 'Đã huỷ' : r.published ? 'Đã mở bán' : 'Chờ mở bán'}
                    tone={r.status === 'DISCARDED' ? 'neutral' : r.published ? 'success' : 'warning'}
                  />
                </View>
                <AppText variant="caption">
                  {r.summary.selected} suất được chọn / {r.summary.candidates} ứng viên · {r.clusters.length} rạp · {r.movies.length} phim
                </AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
