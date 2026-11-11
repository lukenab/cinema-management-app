import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';

import { CinemaPicker } from '@/components/CinemaPicker';
import { HeroCarousel } from '@/components/HeroCarousel';
import { MovieCard } from '@/components/MovieCard';
import { AppText, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { useCinema } from '@/hooks/use-cinema';
import { movieTitle } from '@/lib/labels';
import { queryErrorMessage, useGetPublicMoviesQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { DisplayStatus } from '@/types/api';

const TAB_BAR_SPACE = 96;

export default function HomeScreen() {
  const [tab, setTab] = useState<DisplayStatus>('NOW_SHOWING');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const { clusterId, isLoading: branchLoading, error: branchError, refetch: refetchBranch } = useCinema();
  // What is showing depends on the cinema, so wait until it is known.
  const movies = useGetPublicMoviesQuery(clusterId, { skip: branchLoading });

  const nowShowing = useMemo(() => (movies.data ?? []).filter((m) => (m.displayStatus ?? 'NOW_SHOWING') === 'NOW_SHOWING'), [movies.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (movies.data ?? [])
      .filter((m) => (m.displayStatus ?? 'NOW_SHOWING') === tab)
      .filter((m) => !q || (movieTitle(m) + ' ' + m.originalTitle).toLowerCase().includes(q));
  }, [movies.data, tab, search]);

  const refresh = () => {
    refetchBranch();
    movies.refetch();
  };

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={{ paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <CinemaPicker />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push('/quick-book')}
          accessibilityRole="button"
          accessibilityLabel="Đặt vé nhanh với trợ lý AI"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: pressed ? colors.primaryDark : colors.primary })}
        >
          <Ionicons name="sparkles" size={15} color={colors.onPrimary} />
          <AppText style={{ fontSize: 13, fontWeight: '700', color: colors.onPrimary }}>Đặt nhanh</AppText>
        </Pressable>
      </View>
      <HeroCarousel movies={nowShowing.slice(0, 8)} />

      <View style={{ paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Pressable onPress={() => setTab('NOW_SHOWING')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'NOW_SHOWING' }}>
          <AppText style={{ fontSize: 19, fontWeight: '800', color: tab === 'NOW_SHOWING' ? colors.primary : colors.textFaint }}>Đang chiếu</AppText>
        </Pressable>
        <Pressable onPress={() => setTab('COMING_SOON')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'COMING_SOON' }}>
          <AppText style={{ fontSize: 19, fontWeight: '800', color: tab === 'COMING_SOON' ? colors.primary : colors.textFaint }}>Sắp chiếu</AppText>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setSearching((v) => !v)} accessibilityRole="button" accessibilityLabel="Tìm phim" hitSlop={10}>
          <Ionicons name={searching ? 'close' : 'search'} size={20} color={colors.primary} />
        </Pressable>
      </View>

      {searching ? (
        <View style={{ marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên phim"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, minHeight: 40, color: colors.text, fontSize: 14 }}
            returnKeyType="search"
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      {movies.isLoading || branchLoading ? (
        <LoadingView />
      ) : movies.error || branchError ? (
        <ErrorView message={queryErrorMessage(movies.error ?? branchError)} onRetry={refresh} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => String(m.movieId)}
          numColumns={2}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => <MovieCard movie={item} onPress={() => router.push(`/movie/${item.movieId}`)} />}
          refreshControl={<RefreshControl refreshing={movies.isFetching} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyView
              title={search ? 'Không tìm thấy phim' : tab === 'NOW_SHOWING' ? 'Chưa có phim đang chiếu' : 'Chưa có phim sắp chiếu'}
              message={search ? 'Thử một tên phim khác.' : 'Rạp này chưa có phim. Thử chọn rạp khác hoặc kéo xuống để làm mới.'}
            />
          }
        />
      )}
    </Screen>
  );
}
