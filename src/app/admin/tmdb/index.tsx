import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Chip, EmptyView, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { formatShortDate } from '@/lib/format';
import { queryErrorMessage, useGetTmdbListQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { TmdbSearchItem } from '@/types/api';

type Kind = 'now-playing' | 'upcoming' | 'search';

export default function TmdbCatalog() {
  const [kind, setKind] = useState<Kind>('now-playing');
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Debounce the search box so typing does not hit TMDB on every key.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  const searching = kind === 'search';
  const list = useGetTmdbListQuery({ kind, page: searching ? 1 : page, q: query }, { skip: searching && query.length < 2 });

  const changeKind = (next: Kind) => {
    setKind(next);
    setPage(1);
  };

  const open = (item: TmdbSearchItem) =>
    item.alreadyImported && item.localMovieId ? router.push(`/admin/movies/${item.localMovieId}`) : router.push(`/admin/tmdb/${item.tmdbId}`);

  return (
    <Screen>
      <ScreenHeader title="Nhập phim từ TMDB" subtitle="Danh mục Việt Nam · chỉ xem trước, chưa tạo phim" />

      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Chip label="Đang chiếu" selected={kind === 'now-playing'} onPress={() => changeKind('now-playing')} />
          <Chip label="Sắp chiếu" selected={kind === 'upcoming'} onPress={() => changeKind('upcoming')} />
          <Chip label="Tìm kiếm" selected={kind === 'search'} onPress={() => changeKind('search')} />
        </View>
        {searching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
            <Ionicons name="search" size={16} color={colors.textFaint} />
            <TextInput value={text} onChangeText={setText} placeholder="Nhập tên phim (tối thiểu 2 ký tự)" placeholderTextColor={colors.textFaint} style={{ flex: 1, minHeight: 40, color: colors.text, fontSize: 14 }} autoFocus />
          </View>
        ) : null}
      </View>

      {searching && query.length < 2 ? (
        <EmptyView title="Nhập tên phim để tìm" message="Cần ít nhất 2 ký tự." />
      ) : list.isLoading ? (
        <LoadingView label="Đang tải danh mục TMDB…" />
      ) : list.error && !list.data?.length ? (
        <ErrorView message={queryErrorMessage(list.error)} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(i) => String(i.tmdbId)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { setPage(1); list.refetch(); }} tintColor={colors.primary} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (!searching && !list.isFetching && (list.data?.length ?? 0) > 0) setPage((p) => p + 1); }}
          ListEmptyComponent={<EmptyView title="Không có phim" message="Không tìm thấy phim phù hợp." />}
          ListFooterComponent={<View style={{ height: list.isFetching && (list.data?.length ?? 0) > 0 ? 80 : 0 }}>{list.isFetching && (list.data?.length ?? 0) > 0 ? <LoadingView /> : null}</View>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
            >
              <Poster uri={item.posterUrl} style={{ width: 54, aspectRatio: 2 / 3, borderRadius: 6 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <AppText numberOfLines={2} style={{ fontSize: 14, fontWeight: '700' }}>{item.title || item.originalTitle}</AppText>
                {item.originalTitle && item.originalTitle !== item.title ? <AppText numberOfLines={1} variant="caption">{item.originalTitle}</AppText> : null}
                <AppText variant="caption">{item.releaseDate ? `Khởi chiếu ${formatShortDate(item.releaseDate)}` : 'Chưa có ngày khởi chiếu'}</AppText>
                {item.alreadyImported ? <Badge label="Đã có trong hệ thống" tone="warning" /> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} style={{ alignSelf: 'center' }} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
