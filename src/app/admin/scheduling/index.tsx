import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, Input, LoadingView, Poster, Screen } from '@/components/ui';
import { formatShortDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { queryErrorMessage, useGetAdminClustersQuery, useGetAdminMoviesQuery, useGetSchedulingRunsQuery, useRunSchedulingMutation } from '@/store/api';
import { colors, radius, spacing } from '@/theme';

const LENGTHS = [1, 3, 7, 14];
const addDays = (iso: string, n: number) => {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
};

/**
 * "Tạo suất chiếu tự động" (Legacy Greedy): pick dates, cinemas and movies. Movies need an open release
 * plan at the cinema to get showtimes. The result opens as a report; showtimes stay unsold until published.
 */
export default function Scheduling() {
  const params = useLocalSearchParams<{ movieId?: string }>();
  const clusters = useGetAdminClustersQuery();
  const movies = useGetAdminMoviesQuery('APPROVED');
  const runs = useGetSchedulingRunsQuery();
  const [run, runState] = useRunSchedulingMutation();

  const [start, setStart] = useState(toIsoDate(new Date()));
  const [days, setDays] = useState(7);
  const [pickedClusters, setClusterIds] = useState<number[] | null>(null);
  const [pickedMovies, setMovieIds] = useState<number[] | null>(null);
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState('');

  const eligible = useMemo(() => (movies.data ?? []).filter((m) => (m.openPlans ?? 0) > 0), [movies.data]);

  // Until the admin changes them: every cinema; the movie from the link, otherwise every movie with an open plan.
  const clusterIds = pickedClusters ?? (clusters.data ?? []).map((c) => c.clusterId);
  const movieIds = pickedMovies ?? (params.movieId ? [Number(params.movieId)] : eligible.map((m) => m.movieId));

  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async () => {
    setError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return setError('Ngày bắt đầu theo dạng YYYY-MM-DD.');
    if (!clusterIds.length) return setError('Chọn ít nhất một rạp.');
    if (!movieIds.length) return setError('Chọn ít nhất một phim.');
    const res = await run({ startDate: start, endDate: addDays(start, days - 1), clusterIds, movieIds, publish });
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
            {/^\d{4}-\d{2}-\d{2}$/.test(start) ? (
              <AppText variant="caption">Từ {formatShortDate(start)} đến {formatShortDate(addDays(start, days - 1))}</AppText>
            ) : null}

            <AppText variant="label">Rạp</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {(clusters.data ?? []).map((c) => (
                <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={clusterIds.includes(c.clusterId)} onPress={() => toggle(clusterIds, setClusterIds, c.clusterId)} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="label" style={{ flex: 1 }}>Phim ({movieIds.length} đã chọn)</AppText>
              <Pressable onPress={() => setMovieIds(movieIds.length === eligible.length ? [] : eligible.map((m) => m.movieId))} hitSlop={8} accessibilityRole="button">
                <AppText style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{movieIds.length === eligible.length ? 'Bỏ chọn' : 'Chọn tất cả'}</AppText>
              </Pressable>
            </View>
            {movies.isLoading ? <LoadingView /> : null}
            {(movies.data ?? []).map((m) => {
              const active = movieIds.includes(m.movieId);
              const noPlan = !(m.openPlans ?? 0);
              return (
                <Pressable
                  key={m.movieId}
                  onPress={() => toggle(movieIds, setMovieIds, m.movieId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.surface }}
                >
                  <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? colors.primary : colors.textFaint} />
                  <Poster uri={m.thumbnailUrl ?? m.posterUrl} style={{ width: 32, aspectRatio: 2 / 3, borderRadius: 4 }} />
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>{m.title}</AppText>
                    <AppText variant="caption" style={noPlan ? { color: colors.warning } : undefined}>
                      {noPlan ? 'Chưa mở kế hoạch tại rạp nào' : `${m.openPlans} rạp · ${m.durationMinutes ?? '?'} phút · ưu tiên ${m.priorityOverride ?? m.popularityScore ?? 50}`}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}

            <AppText variant="label">Sau khi tạo</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip label="Xem báo cáo rồi mở bán" selected={!publish} onPress={() => setPublish(false)} />
              <Chip label="Mở bán ngay" selected={publish} onPress={() => setPublish(true)} />
            </View>
            {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
            <Button title="Tạo suất chiếu" onPress={submit} loading={runState.isLoading} />
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
