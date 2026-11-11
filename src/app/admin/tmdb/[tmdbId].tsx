import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { formatDuration, formatShortDate } from '@/lib/format';
import { queryErrorMessage, useGetTmdbDetailsQuery, useImportTmdbMovieMutation } from '@/store/api';
import { colors, spacing } from '@/theme';

/** Preview of a TMDB movie. Importing creates a draft with these fields filled in; the admin reviews and approves it next. */
export default function TmdbImportScreen() {
  const { tmdbId: raw } = useLocalSearchParams<{ tmdbId: string }>();
  const tmdbId = Number(raw);
  const details = useGetTmdbDetailsQuery(tmdbId);
  const [importMovie, importState] = useImportTmdbMovieMutation();
  const [error, setError] = useState('');

  const d = details.data;

  const run = async () => {
    setError('');
    const res = await importMovie({ tmdbId });
    if ('error' in res) {
      setError(queryErrorMessage(res.error, 'Không thể nhập phim.'));
      return;
    }
    router.replace(`/admin/movies/${res.data.movieId}`);
  };

  return (
    <Screen>
      <ScreenHeader title={d?.title ?? 'Xem trước phim'} subtitle={d?.originalTitle !== d?.title ? d?.originalTitle : undefined} />
      {details.isLoading ? (
        <LoadingView label="Đang tải thông tin từ TMDB…" />
      ) : details.error || !d ? (
        <ErrorView message={queryErrorMessage(details.error, 'Không tải được phim từ TMDB.')} onRetry={details.refetch} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Poster uri={d.posterUrl} style={{ width: 110, aspectRatio: 2 / 3, borderRadius: 8 }} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText style={{ fontSize: 16, fontWeight: '800' }}>{d.title}</AppText>
                {d.tagline ? <AppText variant="caption" style={{ fontStyle: 'italic' }}>{d.tagline}</AppText> : null}
                <AppText variant="caption">{d.releaseDate ? `Khởi chiếu ${formatShortDate(d.releaseDate)}` : 'Chưa có ngày khởi chiếu'}</AppText>
                <AppText variant="caption">{d.durationMinutes ? formatDuration(d.durationMinutes) : 'Chưa có thời lượng'}</AppText>
                {d.country ? <AppText variant="caption">{d.country}</AppText> : null}
                {d.popularityScore != null ? <AppText variant="caption">Độ phổ biến: {d.popularityScore}/100</AppText> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {d.ageRating ? <Badge label={d.ageRating.ratingCode} tone="warning" /> : null}
                  {d.genres.map((g) => <Badge key={g} label={g} tone="info" />)}
                </View>
              </View>
            </View>

            {d.warnings.length ? (
              <Card style={{ gap: spacing.xs, borderColor: colors.warning }}>
                {d.warnings.map((w) => <AppText key={w} variant="caption" style={{ color: colors.warning }}>{w}</AppText>)}
              </Card>
            ) : null}

            {d.overview ? (
              <Card style={{ gap: spacing.sm }}>
                <AppText style={{ fontSize: 15, fontWeight: '700' }}>Nội dung</AppText>
                <AppText variant="body">{d.overview}</AppText>
              </Card>
            ) : null}

            {d.cast.length ? (
              <Card style={{ gap: spacing.xs }}>
                <AppText style={{ fontSize: 15, fontWeight: '700' }}>Đạo diễn và diễn viên</AppText>
                <AppText variant="caption">
                  {d.cast.filter((c) => c.roleType === 'DIRECTOR').map((c) => `${c.fullName} (đạo diễn)`).concat(d.cast.filter((c) => c.roleType === 'ACTOR').slice(0, 6).map((c) => c.fullName)).join(', ')}
                </AppText>
              </Card>
            ) : null}

            {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
          </ScrollView>

          <View style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            {d.localMovieId ? (
              <Button title="Phim đã có trong hệ thống — mở" onPress={() => router.replace(`/admin/movies/${d.localMovieId}`)} />
            ) : (
              <>
                <AppText variant="caption">Phim được nhập ở trạng thái chờ duyệt. Bạn sẽ kiểm tra và duyệt ở bước tiếp theo; khách hàng chưa thấy phim.</AppText>
                <Button title="Nhập phim để duyệt" onPress={run} loading={importState.isLoading} />
              </>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}
