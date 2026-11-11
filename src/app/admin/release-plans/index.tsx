import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, EmptyView, ErrorView, Input, LoadingView, Poster, Screen } from '@/components/ui';
import { formatShortDate, toIsoDate } from '@/lib/format';
import { PLAN_STATUS_LABEL, PLAN_STATUS_TONE } from '@/lib/labels';
import {
  queryErrorMessage,
  useCreateReleasePlansMutation,
  useDeleteReleasePlanMutation,
  useGetAdminClustersQuery,
  useGetAdminMoviesQuery,
  useGetReleasePlansQuery,
  useUpdateReleasePlanMutation,
} from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { ReleasePlan, ReleasePlanStatus } from '@/types/api';

const ACTION_LABEL: Record<ReleasePlanStatus, string> = { OPEN: 'Mở khai thác', SUSPENDED: 'Tạm ngưng', CLOSED: 'Đóng', PLANNED: 'Dự kiến' };
const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Release plans = the right to show a movie at a cinema for a period. OPEN makes the movie visible at that
 * cinema ("Sắp chiếu" until showtimes go on sale) and lets the scheduler create showtimes there.
 */
export default function ReleasePlans() {
  const params = useLocalSearchParams<{ movieId?: string }>();
  const [clusterFilter, setClusterFilter] = useState<number | undefined>(undefined);
  const [movieFilter, setMovieFilter] = useState<number | undefined>(params.movieId ? Number(params.movieId) : undefined);
  const plans = useGetReleasePlansQuery({ clusterId: clusterFilter, movieId: movieFilter });
  const clusters = useGetAdminClustersQuery();
  const movies = useGetAdminMoviesQuery('APPROVED');
  const [create, createState] = useCreateReleasePlansMutation();
  const [update] = useUpdateReleasePlanMutation();
  const [remove] = useDeleteReleasePlanMutation();

  const [showForm, setShowForm] = useState(!!params.movieId);
  const [formMovie, setFormMovie] = useState<number | undefined>(params.movieId ? Number(params.movieId) : undefined);
  const [formClusters, setFormClusters] = useState<number[]>([]);
  const [start, setStart] = useState(toIsoDate(new Date()));
  const [end, setEnd] = useState('');
  const [openNow, setOpenNow] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number, ReleasePlan[]>();
    (plans.data ?? []).forEach((p) => map.set(p.movieId, [...(map.get(p.movieId) ?? []), p]));
    return [...map.values()].map((list) => list.sort((a, b) => a.clusterId - b.clusterId));
  }, [plans.data]);

  const allClusterIds = (clusters.data ?? []).map((c) => c.clusterId);
  const toggleCluster = (id: number) => setFormClusters((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setMessage(null);
    if (!formMovie) return setMessage({ text: 'Chọn phim.', ok: false });
    if (!formClusters.length) return setMessage({ text: 'Chọn ít nhất một rạp.', ok: false });
    if (!isIso(start) || (end && !isIso(end))) return setMessage({ text: 'Ngày theo dạng YYYY-MM-DD.', ok: false });
    const res = await create({ movieId: formMovie, clusterIds: formClusters, showingStartDate: start, showingEndDate: end || undefined, status: openNow ? 'OPEN' : 'PLANNED' });
    if ('error' in res) return setMessage({ text: queryErrorMessage(res.error, 'Không tạo được kế hoạch.'), ok: false });
    const { created, skipped } = res.data;
    setMessage({
      ok: created.length > 0,
      text: `Đã tạo ${created.length} kế hoạch.${skipped.length ? ` Bỏ qua: ${skipped.map((s) => `${s.clusterName} (${s.reason})`).join('; ')}` : ''}`,
    });
    if (created.length) setFormClusters([]);
  };

  const move = async (plan: ReleasePlan, status: ReleasePlanStatus) => {
    setMessage(null);
    const res = await update({ planId: plan.planId, status });
    if ('error' in res) setMessage({ text: queryErrorMessage(res.error, 'Không cập nhật được kế hoạch.'), ok: false });
    else if (res.data.suspendedShowtimes) setMessage({ text: `Đã tạm dừng ${res.data.suspendedShowtimes} suất chiếu chưa bán vé của phim tại ${plan.clusterName}.`, ok: true });
  };

  const confirmMove = (plan: ReleasePlan, status: ReleasePlanStatus) => {
    if (status === 'OPEN') return void move(plan, status);
    Alert.alert(
      `${ACTION_LABEL[status]} kế hoạch?`,
      `${plan.movieTitle} tại ${plan.clusterName} sẽ ẩn với khách hàng và các suất chưa bán vé sẽ tạm dừng.${status === 'CLOSED' ? ' Kế hoạch đã đóng không mở lại được.' : ''}`,
      [{ text: 'Không', style: 'cancel' }, { text: ACTION_LABEL[status], style: 'destructive', onPress: () => void move(plan, status) }],
    );
  };

  const confirmDelete = (plan: ReleasePlan) =>
    Alert.alert('Xoá kế hoạch?', `${plan.movieTitle} tại ${plan.clusterName}. Chỉ xoá được khi chưa có suất chiếu.`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          const res = await remove(plan.planId);
          if ('error' in res) setMessage({ text: queryErrorMessage(res.error, 'Không xoá được kế hoạch.'), ok: false });
        },
      },
    ]);

  return (
    <Screen>
      <ScreenHeader title="Kế hoạch phát hành" subtitle="Quyền khai thác phim tại từng rạp" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={plans.isFetching} onRefresh={() => void plans.refetch()} tintColor={colors.primary} />}
        >
          <Card style={{ gap: spacing.md }}>
            <Pressable onPress={() => setShowForm((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showForm }}>
              <AppText style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>{showForm ? '− Đóng' : '+ Mở kế hoạch mới'}</AppText>
            </Pressable>
            {showForm ? (
              <View style={{ gap: spacing.md }}>
                <AppText variant="label">Phim đã duyệt</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {(movies.data ?? []).map((m) => {
                    const active = formMovie === m.movieId;
                    return (
                      <Pressable
                        key={m.movieId}
                        onPress={() => {
                          setFormMovie(m.movieId);
                          if (m.releaseDate && m.releaseDate > start) setStart(m.releaseDate);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{ width: 92, gap: 4, padding: 4, borderRadius: radius.sm, borderWidth: 2, borderColor: active ? colors.primary : 'transparent' }}
                      >
                        <Poster uri={m.thumbnailUrl ?? m.posterUrl} style={{ width: 80, aspectRatio: 2 / 3, borderRadius: 6 }} />
                        <AppText numberOfLines={2} style={{ fontSize: 12, fontWeight: active ? '800' : '500' }}>{m.title}</AppText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {!movies.isLoading && !(movies.data ?? []).length ? <AppText variant="caption">Chưa có phim đã duyệt. Duyệt phim ở mục Phim trước.</AppText> : null}

                <AppText variant="label">Rạp</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Chip label="Tất cả rạp" selected={formClusters.length === allClusterIds.length && allClusterIds.length > 0} onPress={() => setFormClusters(formClusters.length === allClusterIds.length ? [] : allClusterIds)} />
                  {(clusters.data ?? []).map((c) => (
                    <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={formClusters.includes(c.clusterId)} onPress={() => toggleCluster(c.clusterId)} />
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}><Input label="Từ ngày" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" /></View>
                  <View style={{ flex: 1 }}><Input label="Đến ngày (tuỳ chọn)" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Chip label="Mở khai thác ngay" selected={openNow} onPress={() => setOpenNow(true)} />
                  <Chip label="Chỉ lên kế hoạch" selected={!openNow} onPress={() => setOpenNow(false)} />
                </View>
                <Button title="Tạo kế hoạch" onPress={submit} loading={createState.isLoading} />
              </View>
            ) : null}
            {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Chip label="Mọi rạp" selected={clusterFilter === undefined} onPress={() => setClusterFilter(undefined)} />
            {(clusters.data ?? []).map((c) => (
              <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={clusterFilter === c.clusterId} onPress={() => setClusterFilter(c.clusterId)} />
            ))}
            {movieFilter ? <Chip label="× Bỏ lọc phim" onPress={() => setMovieFilter(undefined)} /> : null}
          </View>

          {plans.isLoading ? (
            <LoadingView />
          ) : plans.error ? (
            <ErrorView message={queryErrorMessage(plans.error)} onRetry={plans.refetch} />
          ) : !grouped.length ? (
            <EmptyView title="Chưa có kế hoạch phát hành" message="Mở kế hoạch để phim xuất hiện tại rạp và có thể xếp lịch chiếu." />
          ) : (
            grouped.map((list) => (
              <Card key={list[0].movieId} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Poster uri={list[0].posterUrl} style={{ width: 40, aspectRatio: 2 / 3, borderRadius: 4 }} />
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={2} style={{ fontSize: 15, fontWeight: '800' }}>{list[0].movieTitle}</AppText>
                    {list[0].releaseDate ? <AppText variant="caption">Khởi chiếu {formatShortDate(list[0].releaseDate)}</AppText> : null}
                  </View>
                </View>
                {list.map((p) => (
                  <View key={p.planId} style={{ gap: 6, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <AppText style={{ flex: 1, fontSize: 14, fontWeight: '700' }}>{p.clusterName}</AppText>
                      <Badge label={PLAN_STATUS_LABEL[p.status] ?? p.status} tone={PLAN_STATUS_TONE[p.status] ?? 'neutral'} />
                    </View>
                    <AppText variant="caption">
                      {formatShortDate(p.showingStartDate)} → {p.showingEndDate ? formatShortDate(p.showingEndDate) : 'chưa đặt ngày kết thúc'}
                    </AppText>
                    {p.allowedTransitions.length ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {p.allowedTransitions.map((t) => <Chip key={t} label={ACTION_LABEL[t]} onPress={() => confirmMove(p, t)} />)}
                        {p.status === 'PLANNED' ? <Chip label="Xoá" onPress={() => confirmDelete(p)} /> : null}
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
