import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Chip, EmptyView, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { MOVIE_STATUS_LABEL, MOVIE_STATUS_TONE } from '@/lib/labels';
import { queryErrorMessage, useGetAdminMoviesQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { MovieStatus } from '@/types/api';

const FILTERS: { key: MovieStatus | undefined; label: string }[] = [
  { key: undefined, label: 'Tất cả' },
  { key: 'DRAFT', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'ARCHIVED', label: 'Lưu trữ' },
];

export default function AdminMovies() {
  const [status, setStatus] = useState<MovieStatus | undefined>(undefined);
  const { data, isLoading, isFetching, error, refetch } = useGetAdminMoviesQuery(status);

  return (
    <Screen>
      <ScreenHeader
        title="Phim"
        subtitle={data ? `${data.length} phim` : undefined}
        right={<Pressable onPress={() => router.push('/admin/tmdb')} accessibilityRole="button" accessibilityLabel="Nhập phim từ TMDB" hitSlop={10}><Ionicons name="add-circle" size={26} color={colors.primary} /></Pressable>}
      />
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {FILTERS.map((f) => <Chip key={f.label} label={f.label} selected={status === f.key} onPress={() => setStatus(f.key)} />)}
      </View>
      {isLoading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={queryErrorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(m) => String(m.movieId)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyView title="Chưa có phim nào" message="Nhập phim từ TMDB để bắt đầu." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/admin/movies/${item.movieId}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
            >
              <Poster uri={item.posterUrl ?? item.thumbnailUrl} style={{ width: 48, aspectRatio: 2 / 3, borderRadius: 6 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <AppText numberOfLines={2} style={{ fontSize: 14, fontWeight: '700' }}>{item.title}</AppText>
                <AppText variant="caption">
                  {item.releaseDate ?? 'Chưa có ngày'} · {item.durationMinutes ? `${item.durationMinutes} phút` : 'chưa có thời lượng'}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
                  <Badge label={MOVIE_STATUS_LABEL[item.status] ?? item.status} tone={MOVIE_STATUS_TONE[item.status] ?? 'neutral'} />
                  {item.status === 'APPROVED' ? (
                    <AppText variant="caption">{item.openPlans ?? 0} rạp khai thác · {item.upcomingShowtimes ?? 0} suất mở bán</AppText>
                  ) : null}
                  {item.status === 'DRAFT' && item.approvalProblems.length ? (
                    <AppText variant="caption" style={{ color: colors.warning }}>Thiếu {item.approvalProblems.length} thông tin</AppText>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} style={{ alignSelf: 'center' }} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
