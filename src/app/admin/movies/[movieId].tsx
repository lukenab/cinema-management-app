import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, ErrorView, Input, LoadingView, Poster, Screen } from '@/components/ui';
import { MOVIE_STATUS_LABEL, MOVIE_STATUS_TONE, ageRatingCode } from '@/lib/labels';
import { queryErrorMessage, useApproveMovieMutation, useArchiveMovieMutation, useGetAdminMovieQuery, useUpdateMovieMutation } from '@/store/api';
import { colors, spacing } from '@/theme';
import type { AdminMovie, AgeRatingCode } from '@/types/api';

const RATINGS: { code: AgeRatingCode; label: string }[] = [
  { code: 'P', label: 'P · Mọi lứa tuổi' },
  { code: 'K', label: 'K · Dưới 13 có người lớn' },
  { code: 'T13', label: 'T13' },
  { code: 'T16', label: 'T16' },
  { code: 'T18', label: 'T18' },
];

interface Form {
  title: string;
  synopsis: string;
  tagline: string;
  durationMinutes: string;
  releaseDate: string;
  trailerUrl: string;
  priorityOverride: string;
  ageRatingCode?: AgeRatingCode;
  has3D: boolean;
}

const formOf = (m: AdminMovie): Form => ({
  title: m.title ?? '',
  synopsis: m.synopsis ?? '',
  tagline: m.tagline ?? '',
  durationMinutes: m.durationMinutes ? String(m.durationMinutes) : '',
  releaseDate: m.releaseDate ?? '',
  trailerUrl: m.trailerUrl ?? '',
  priorityOverride: m.priorityOverride != null ? String(m.priorityOverride) : '',
  ageRatingCode: ageRatingCode(m.ageRating) as AgeRatingCode | undefined,
  has3D: m.formats.includes('3D'),
});

/**
 * Movie review: fields come pre-filled from TMDB; the admin corrects them, saves and approves. An approved
 * movie is still hidden until a release plan opens it at a cinema and showtimes are put on sale.
 */
export default function AdminMovieDetail() {
  const { movieId: raw } = useLocalSearchParams<{ movieId: string }>();
  const movieId = Number(raw);
  const movie = useGetAdminMovieQuery(movieId);
  const [update, updateState] = useUpdateMovieMutation();
  const [approve, approveState] = useApproveMovieMutation();
  const [archive, archiveState] = useArchiveMovieMutation();
  // null = untouched: the form shows the saved movie.
  const [edited, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const m = movie.data;
  const form = edited ?? (m ? formOf(m) : null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...(f ?? form!), [key]: value }));

  const save = async (): Promise<boolean> => {
    if (!form || !m) return false;
    setMessage(null);
    const minutes = Number(form.durationMinutes);
    if (form.durationMinutes && (!Number.isInteger(minutes) || minutes < 30 || minutes > 300)) {
      setMessage({ text: 'Thời lượng phải từ 30 đến 300 phút.', ok: false });
      return false;
    }
    if (form.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.releaseDate)) {
      setMessage({ text: 'Ngày khởi chiếu theo dạng YYYY-MM-DD.', ok: false });
      return false;
    }
    const priority = form.priorityOverride.trim() ? Number(form.priorityOverride) : null;
    if (priority !== null && (!Number.isInteger(priority) || priority < 0 || priority > 100)) {
      setMessage({ text: 'Độ ưu tiên từ 0 đến 100 (để trống = theo độ phổ biến TMDB).', ok: false });
      return false;
    }
    const res = await update({
      movieId,
      title: form.title.trim(),
      synopsis: form.synopsis.trim() || undefined,
      tagline: form.tagline.trim(),
      durationMinutes: form.durationMinutes ? minutes : undefined,
      releaseDate: form.releaseDate || undefined,
      ageRatingCode: form.ageRatingCode,
      trailerUrl: form.trailerUrl.trim() || null,
      formats: form.has3D ? ['2D', '3D'] : ['2D'],
      priorityOverride: priority,
    });
    if ('error' in res) {
      setMessage({ text: queryErrorMessage(res.error, 'Không thể lưu phim.'), ok: false });
      return false;
    }
    setMessage({ text: 'Đã lưu thông tin phim.', ok: true });
    return true;
  };

  const saveAndApprove = async () => {
    if (!(await save())) return;
    const res = await approve(movieId);
    setMessage('error' in res ? { text: queryErrorMessage(res.error, 'Chưa thể duyệt phim.'), ok: false } : { text: 'Đã duyệt phim. Bước tiếp theo: mở kế hoạch phát hành tại các rạp.', ok: true });
  };

  const confirmArchive = () =>
    Alert.alert('Lưu trữ phim?', 'Các kế hoạch phát hành sẽ đóng và suất chiếu chưa bán vé sẽ bị huỷ. Không thể lưu trữ khi còn vé đã bán cho suất sắp chiếu.', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Lưu trữ',
        style: 'destructive',
        onPress: async () => {
          const res = await archive(movieId);
          setMessage('error' in res ? { text: queryErrorMessage(res.error, 'Không thể lưu trữ phim.'), ok: false } : { text: 'Đã lưu trữ phim.', ok: true });
        },
      },
    ]);

  const editable = m?.status !== 'ARCHIVED';

  return (
    <Screen>
      <ScreenHeader title={m?.title ?? 'Phim'} subtitle={m && m.originalTitle !== m.title ? m.originalTitle : undefined} />
      {movie.isLoading ? (
        <LoadingView />
      ) : movie.error || !m || !form ? (
        <ErrorView message={queryErrorMessage(movie.error, 'Không tải được phim.')} onRetry={movie.refetch} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Poster uri={m.posterUrl ?? m.thumbnailUrl} style={{ width: 100, aspectRatio: 2 / 3, borderRadius: 8 }} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Badge label={MOVIE_STATUS_LABEL[m.status] ?? m.status} tone={MOVIE_STATUS_TONE[m.status] ?? 'neutral'} />
                <AppText variant="caption">TMDB #{m.tmdbId} · {m.country ?? 'chưa rõ quốc gia'}</AppText>
                <AppText variant="caption">Độ phổ biến (TMDB): {m.popularityScore ?? '—'}/100</AppText>
                {m.status === 'APPROVED' ? <AppText variant="caption">{m.openPlans ?? 0} rạp khai thác · {m.upcomingShowtimes ?? 0} suất mở bán</AppText> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {m.genres.map((g) => <Badge key={g.genreId} label={g.genreName ?? ''} tone="info" />)}
                </View>
              </View>
            </View>

            {m.status === 'DRAFT' ? (
              <Card style={{ gap: spacing.xs, borderColor: m.approvalProblems.length ? colors.warning : colors.success }}>
                <AppText style={{ fontSize: 14, fontWeight: '700' }}>{m.approvalProblems.length ? 'Cần bổ sung trước khi duyệt' : 'Đủ thông tin để duyệt'}</AppText>
                {m.approvalProblems.map((p) => <AppText key={p} variant="caption" style={{ color: colors.warning }}>• {p}</AppText>)}
                <AppText variant="caption">Thông tin được điền sẵn từ TMDB. Kiểm tra, sửa nếu cần rồi bấm Lưu và duyệt.</AppText>
              </Card>
            ) : null}

            <Card style={{ gap: spacing.md }}>
              <Input label="Tên phim (tiếng Việt)" value={form.title} onChangeText={(v) => set('title', v)} editable={editable} />
              <Input label="Khẩu hiệu" value={form.tagline} onChangeText={(v) => set('tagline', v)} editable={editable} />
              <Input label="Nội dung" value={form.synopsis} onChangeText={(v) => set('synopsis', v)} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} editable={editable} />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input label="Thời lượng (phút)" value={form.durationMinutes} onChangeText={(v) => set('durationMinutes', v)} keyboardType="number-pad" editable={editable} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Khởi chiếu (YYYY-MM-DD)" value={form.releaseDate} onChangeText={(v) => set('releaseDate', v)} editable={editable} />
                </View>
              </View>
              <Input label="Link trailer (YouTube)" value={form.trailerUrl} onChangeText={(v) => set('trailerUrl', v)} autoCapitalize="none" editable={editable} />
            </Card>

            <Card style={{ gap: spacing.md }}>
              <AppText style={{ fontSize: 15, fontWeight: '700' }}>Phân loại độ tuổi</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {RATINGS.map((r) => <Chip key={r.code} label={r.label} selected={form.ageRatingCode === r.code} onPress={() => editable && set('ageRatingCode', r.code)} />)}
              </View>
              <AppText style={{ fontSize: 15, fontWeight: '700' }}>Định dạng phát hành</AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Chip label="2D" selected />
                <Chip label="3D" selected={form.has3D} onPress={() => editable && set('has3D', !form.has3D)} />
              </View>
              <Input
                label="Độ ưu tiên xếp lịch (0–100, để trống = theo TMDB)"
                value={form.priorityOverride}
                onChangeText={(v) => set('priorityOverride', v)}
                keyboardType="number-pad"
                editable={editable}
              />
            </Card>

            {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}

            {m.status === 'DRAFT' ? (
              <Button title="Lưu và duyệt phim" onPress={saveAndApprove} loading={updateState.isLoading || approveState.isLoading} />
            ) : null}
            {editable ? <Button title="Lưu thay đổi" variant="secondary" onPress={() => void save()} loading={updateState.isLoading} /> : null}
            {m.status === 'APPROVED' ? (
              <>
                <Button title="Kế hoạch phát hành theo rạp" variant="secondary" onPress={() => router.push({ pathname: '/admin/release-plans', params: { movieId: String(movieId) } })} />
                <Button title="Tạo suất chiếu tự động" variant="secondary" onPress={() => router.push({ pathname: '/admin/scheduling', params: { movieId: String(movieId) } })} />
                <Button title="Lưu trữ phim" variant="danger" onPress={confirmArchive} loading={archiveState.isLoading} />
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
