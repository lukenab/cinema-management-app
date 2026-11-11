import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CinemaPicker } from '@/components/CinemaPicker';
import { AppText, EmptyView, ErrorView, LoadingView, Poster, Screen } from '@/components/ui';
import { formatShortDate, formatTime, hasStarted, nextDays } from '@/lib/format';
import { ageRatingCode, languageLabel, movieSynopsis, movieTagline, movieTitle, showtimeFormatLabel } from '@/lib/labels';
import { useCinema } from '@/hooks/use-cinema';
import { queryErrorMessage, useGetPublicMovieQuery, useGetShowtimesByMovieQuery } from '@/store/api';
import { colors, radius, shadow, spacing } from '@/theme';
import type { CastMember, PublicMovie, Showtime } from '@/types/api';

const DAYS = nextDays(7);

type Tab = 'showtimes' | 'info';

interface CinemaGroup {
  clusterId: number | undefined;
  name: string;
  formats: { label: string; showtimes: Showtime[] }[];
}

function groupByCinema(list: Showtime[], preferred?: number): CinemaGroup[] {
  const map = new Map<string, { clusterId?: number; name: string; formats: Map<string, Showtime[]> }>();
  list
    .filter((s) => s.status === 'ON_SALE')
    .forEach((s) => {
      const key = String(s.clusterId ?? s.clusterName ?? 'unknown');
      const entry = map.get(key) ?? { clusterId: s.clusterId, name: s.clusterName ?? 'Rạp chiếu', formats: new Map() };
      const label = showtimeFormatLabel(s);
      entry.formats.set(label, [...(entry.formats.get(label) ?? []), s]);
      map.set(key, entry);
    });
  return [...map.values()]
    .map((e) => ({
      clusterId: e.clusterId,
      name: e.name,
      formats: [...e.formats.entries()].map(([label, showtimes]) => ({
        label,
        showtimes: showtimes.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      })),
    }))
    .sort((a, b) => Number(b.clusterId === preferred) - Number(a.clusterId === preferred) || a.name.localeCompare(b.name));
}

// ── Info tab pieces ────────────────────────────────────────────────────────

function openTrailer(url: string) {
  void WebBrowser.openBrowserAsync(url);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.sm }}>
      <AppText style={{ fontSize: 17, fontWeight: '800' }}>{title}</AppText>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <AppText style={{ width: 96, color: colors.textMuted, fontSize: 14 }}>{label}</AppText>
      <AppText style={{ flex: 1, fontSize: 14 }}>{value}</AppText>
    </View>
  );
}

function Person({ person }: { person: CastMember }) {
  return (
    <View style={{ width: 80, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {person.photoUrl ? (
          <Poster uri={person.photoUrl} style={{ width: 68, height: 68, borderRadius: 34 }} />
        ) : (
          <AppText style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>{person.fullName.charAt(0).toUpperCase()}</AppText>
        )}
      </View>
      <AppText numberOfLines={2} style={{ textAlign: 'center', fontSize: 12, lineHeight: 16 }}>{person.fullName}</AppText>
    </View>
  );
}

function PeopleRow({ people }: { people: CastMember[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
      {people.map((p) => <Person key={`${p.personId}-${p.roleType}`} person={p} />)}
    </ScrollView>
  );
}

function InfoTab({ m }: { m: PublicMovie }) {
  const [expanded, setExpanded] = useState(false);
  const synopsis = movieSynopsis(m);
  const genres = m.genres.map((g) => g.name ?? g.genreName).filter(Boolean) as string[];
  const directors = (m.cast ?? []).filter((c) => c.roleType?.toUpperCase() === 'DIRECTOR');
  const actors = (m.cast ?? []).filter((c) => c.roleType?.toUpperCase() !== 'DIRECTOR').slice(0, 15);
  const formats = m.formats ?? [];
  const tagline = movieTagline(m);

  return (
    <View>
      {synopsis ? (
        <Section title="Nội dung">
          {tagline ? <AppText style={{ fontStyle: 'italic', color: colors.textMuted }}>{tagline}</AppText> : null}
          <AppText numberOfLines={expanded ? undefined : 5} style={{ lineHeight: 22, color: colors.text }}>{synopsis}</AppText>
          {synopsis.length > 220 ? (
            <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center' }}>
              <AppText style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>{expanded ? 'Thu gọn' : 'Xem thêm'}</AppText>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      <Section title="Thông tin phim">
        <InfoRow label="Thể loại" value={genres.join(', ')} />
        <InfoRow label="Quốc gia" value={m.country} />
        <InfoRow label="Ngôn ngữ" value={languageLabel(m.originalLanguage)} />
        <InfoRow label="Định dạng" value={formats.join(', ')} />
        <InfoRow label="Khởi chiếu" value={m.releaseDate ? formatShortDate(m.releaseDate) : undefined} />
      </Section>

      {directors.length ? <Section title="Đạo diễn"><PeopleRow people={directors} /></Section> : null}
      {actors.length ? <Section title="Diễn viên"><PeopleRow people={actors} /></Section> : null}
    </View>
  );
}

// ── Header with backdrop ───────────────────────────────────────────────────

function Hero({ m }: { m: PublicMovie }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = Math.round(width * 0.56);
  const age = ageRatingCode(m.ageRating);

  return (
    <View style={{ backgroundColor: colors.surface }}>
      <View style={{ height, backgroundColor: colors.text }}>
        <Poster uri={m.backdropUrl ?? m.posterUrl ?? m.thumbnailUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 72 }} />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={8}
          style={{ position: 'absolute', top: insets.top + 8, left: spacing.md, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        {m.trailerUrl ? (
          <Pressable
            onPress={() => openTrailer(m.trailerUrl!)}
            accessibilityRole="button"
            accessibilityLabel="Xem trailer"
            style={({ pressed }) => ({ position: 'absolute', top: height / 2 - 28, left: width / 2 - 28, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="play" size={26} color={colors.primary} style={{ marginLeft: 3 }} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg }}>
        <Poster uri={m.posterUrl ?? m.thumbnailUrl} style={{ width: 100, aspectRatio: 2 / 3, marginTop: -44, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.surface, ...shadow }} />
        <View style={{ flex: 1, gap: spacing.sm, paddingTop: spacing.md }}>
          <AppText numberOfLines={3} style={{ fontSize: 18, fontWeight: '800', lineHeight: 24 }}>{movieTitle(m)}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
            {age ? (
              <View style={{ backgroundColor: colors.accent, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 }}>
                <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{age}</AppText>
              </View>
            ) : null}
            {m.durationMinutes ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={15} color={colors.accent} />
                <AppText variant="caption">{m.durationMinutes} phút</AppText>
              </View>
            ) : null}
            {m.releaseDate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                <AppText variant="caption">{formatShortDate(m.releaseDate)}</AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MovieDetail() {
  const { movieId: rawId } = useLocalSearchParams<{ movieId: string }>();
  const movieId = Number(rawId);
  const { clusterId, cinema } = useCinema();
  const [tab, setTab] = useState<Tab>('showtimes');
  const [date, setDate] = useState(DAYS[0].iso);

  const movie = useGetPublicMovieQuery({ movieId, clusterId });
  const showtimes = useGetShowtimesByMovieQuery({ movieId, date, clusterId }, { skip: !clusterId });
  // Only the chosen cinema's showtimes are listed; the picker above switches cinema.
  const groups = useMemo(() => groupByCinema(showtimes.data ?? [], clusterId), [showtimes.data, clusterId]);

  if (movie.isLoading) return <Screen><LoadingView /></Screen>;
  if (movie.error || !movie.data) {
    return <Screen><ErrorView message={queryErrorMessage(movie.error, 'Không tải được thông tin phim.')} onRetry={movie.refetch} /></Screen>;
  }

  const m = movie.data;
  const coming = m.displayStatus === 'COMING_SOON';

  const tabBar = (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {(['showtimes', 'info'] as Tab[]).map((t) => (
        <Pressable
          key={t}
          onPress={() => setTab(t)}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 3, borderBottomColor: tab === t ? colors.primary : 'transparent', marginBottom: -1 }}
        >
          <AppText style={{ fontSize: 15, fontWeight: '700', color: tab === t ? colors.primary : colors.textFaint }}>
            {t === 'showtimes' ? 'Suất chiếu' : 'Thông tin'}
          </AppText>
        </Pressable>
      ))}
    </View>
  );

  if (tab === 'info') {
    // Full-bleed backdrop: the screen draws under the status bar.
    return (
      <Screen edges={[]}>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <Hero m={m} />
          {tabBar}
          <View style={{ height: spacing.sm }} />
          <InfoTab m={m} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={12} style={{ padding: spacing.sm }}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
        </View>
        <AppText numberOfLines={2} style={{ textAlign: 'center', fontSize: 18, fontWeight: '800', paddingHorizontal: spacing.lg }}>{movieTitle(m)}</AppText>
      </View>
      {tabBar}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'flex-start' }}>
        <CinemaPicker />
      </View>

      {coming ? (
        <EmptyView
          title="Phim chưa mở bán vé"
          message={`${m.releaseDate ? `Khởi chiếu ${formatShortDate(m.releaseDate)}. ` : ''}${cinema?.clusterName ?? 'Rạp'} chưa mở bán suất chiếu cho phim này. Bạn có thể thử rạp khác.`}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <FlatList
            horizontal
            data={DAYS}
            keyExtractor={(d) => d.iso}
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs }}
            renderItem={({ item }) => {
              const active = item.iso === date;
              return (
                <Pressable
                  onPress={() => setDate(item.iso)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{ minWidth: 68, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: active ? colors.primary : 'transparent' }}
                >
                  <AppText style={{ fontSize: 12, color: active ? colors.onPrimary : colors.text }}>{item.label}</AppText>
                  <AppText style={{ fontSize: 16, fontWeight: '800', color: active ? colors.onPrimary : colors.text }}>{item.date}</AppText>
                </Pressable>
              );
            }}
          />

          {showtimes.isLoading ? (
            <View style={{ height: 160 }}><LoadingView /></View>
          ) : showtimes.error ? (
            <View style={{ height: 200 }}><ErrorView message={queryErrorMessage(showtimes.error)} onRetry={showtimes.refetch} /></View>
          ) : groups.length === 0 ? (
            <View style={{ height: 180 }}><EmptyView title="Không có suất chiếu trong ngày này" message="Vui lòng chọn ngày khác hoặc rạp khác." /></View>
          ) : (
            groups.map((g) => (
              <View key={String(g.clusterId ?? g.name)} style={{ backgroundColor: colors.surface, marginBottom: spacing.sm }}>
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
                  {g.formats.map((f) => (
                    <View key={f.label} style={{ gap: spacing.sm }}>
                      <AppText style={{ color: colors.textMuted, fontSize: 13 }}>{f.label}</AppText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {f.showtimes.map((st) => {
                          const past = hasStarted(st.showDate, st.startTime);
                          return (
                            <Pressable
                              key={st.showTimeId}
                              disabled={past}
                              onPress={() => router.push(`/booking/seats/${st.showTimeId}`)}
                              accessibilityRole="button"
                              accessibilityLabel={`Suất ${formatTime(st.startTime)}, ${st.cinemaRoomName}${past ? ', đã chiếu' : ''}`}
                              style={({ pressed }) => ({
                                minWidth: 64,
                                paddingVertical: spacing.sm + 2,
                                paddingHorizontal: spacing.md,
                                borderRadius: radius.sm,
                                borderWidth: 1,
                                borderColor: past ? colors.border : colors.seatAvailableBorder,
                                backgroundColor: past ? colors.surfaceAlt : pressed ? colors.primarySoft : colors.surface,
                                alignItems: 'center',
                              })}
                            >
                              <AppText style={{ fontSize: 15, color: past ? colors.textFaint : colors.text }}>{formatTime(st.startTime)}</AppText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
