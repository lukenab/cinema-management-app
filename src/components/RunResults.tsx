import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Badge, Card, Chip, Poster } from '@/components/ui';
import { formatMoney, formatShortDate } from '@/lib/format';
import { SHOWTIME_STATUS_LABEL, SHOWTIME_STATUS_TONE, SKIP_REASON_LABEL } from '@/lib/labels';
import { colors, radius, spacing } from '@/theme';
import type { MovieOutcome, SchedulingMovieResult, SchedulingRunDetail, SchedulingShowtime } from '@/types/api';

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const shortCinema = (name: string) => name.replace('CinePrime ', '');

const OUTCOME: Record<MovieOutcome, { tone: 'success' | 'warning' | 'danger'; label: (n: number) => string }> = {
  CREATED: { tone: 'success', label: (n) => `Đã tạo ${n} suất` },
  PARTIAL: { tone: 'warning', label: (n) => `Tạo một phần · ${n} suất` },
  NONE: { tone: 'danger', label: () => 'Không tạo được suất' },
};

function CinemaLine({ c, rangeStart }: { c: SchedulingMovieResult['clusters'][number]; rangeStart: string }) {
  const ok = c.selected > 0;
  const parts = [
    c.from ? `Khai thác ${c.from > rangeStart ? `từ ${formatShortDate(c.from)}` : 'từ đầu khoảng ngày'}${c.to ? ` đến ${formatShortDate(c.to)}` : ''}` : '',
    !ok ? (c.rejected ? `${c.rejected} ứng viên đều bị loại, xem mục Lý do bị loại` : c.excludedReason ? (SKIP_REASON_LABEL[c.excludedReason] ?? c.excludedReason) : 'không xếp được suất nào') : '',
  ].filter(Boolean);
  return (
    <View style={{ gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={ok ? colors.success : colors.warning} />
        <AppText style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>{shortCinema(c.name)}</AppText>
        <AppText style={{ fontSize: 13, fontWeight: '700', color: ok ? colors.text : colors.warning }}>{c.selected} suất</AppText>
      </View>
      {parts.length ? <AppText variant="caption" style={{ marginLeft: 24 }}>{parts.join(' · ')}</AppText> : null}
    </View>
  );
}

// How a showtime's status shows on its time chip: on sale (green), waiting to be opened (grey), paused (amber).
const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  ON_SALE: { bg: '#E3F4EA', border: colors.success, text: colors.success },
  SCHEDULED: { bg: colors.surfaceAlt, border: colors.border, text: colors.text },
  SUSPENDED: { bg: '#FDF0DC', border: colors.warning, text: colors.warning },
  CANCELLED: { bg: '#FDE7E5', border: colors.danger, text: colors.danger },
  COMPLETED: { bg: colors.surfaceAlt, border: colors.border, text: colors.textMuted },
};
const statusStyle = (status: string) => STATUS_STYLE[status] ?? STATUS_STYLE.SCHEDULED;

/** One showtime as a chip: start time, room and format; the colour tells whether it is on sale. */
function TimeChip({ s }: { s: SchedulingShowtime }) {
  const st = statusStyle(s.status);
  return (
    <View
      accessible
      accessibilityLabel={`${s.startTime} đến ${s.endTime}, ${s.roomName}, ${s.format}, ${SHOWTIME_STATUS_LABEL[s.status] ?? s.status}, ${formatMoney(s.price)}`}
      style={{ minWidth: 66, alignItems: 'center', paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: st.border, backgroundColor: st.bg }}
    >
      <AppText style={{ fontSize: 15, fontWeight: '800', color: st.text }}>{s.startTime}</AppText>
      <AppText style={{ fontSize: 10, color: colors.textMuted }}>{s.roomName.replace('Phòng ', 'P')} · {s.format}</AppText>
    </View>
  );
}

/** One card per movie: did it get showtimes, at which cinema, on which day, and at what times. */
export function MovieResults({ r }: { r: SchedulingRunDetail }) {
  const created = r.movieResults.filter((m) => m.selected > 0).length;

  // Showtimes by movie and day, and a count of each status per movie.
  const byMovieDay = useMemo(() => {
    const map = new Map<string, SchedulingShowtime[]>();
    for (const s of r.showtimes) {
      const key = `${s.movieId}|${s.date}`;
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [r.showtimes]);
  const statusByMovie = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const s of r.showtimes) {
      const counts = map.get(s.movieId) ?? {};
      counts[s.status] = (counts[s.status] ?? 0) + 1;
      map.set(s.movieId, counts);
    }
    return map;
  }, [r.showtimes]);

  // Which movie/day shows its times: the first one that has showtimes, until the admin taps another (or the same to close).
  const firstMovie = r.movieResults.find((m) => m.days.some((d) => d.selected > 0));
  const first = firstMovie
    ? { movieId: firstMovie.movieId, date: firstMovie.days.find((d) => d.selected > 0)!.date }
    : null;
  const [picked, setPicked] = useState<{ movieId: number; date: string } | 'closed' | null>(null);
  const open = picked === 'closed' ? null : (picked ?? first);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText style={{ fontSize: 15, fontWeight: '700' }}>Kết quả theo phim</AppText>
        <AppText variant="caption">
          {created}/{r.movieResults.length} phim đã được tạo suất
          {r.movieResults.length - created ? `, ${r.movieResults.length - created} phim chưa có suất nào` : ''}. Bấm một ngày để xem giờ chiếu.
        </AppText>
      </View>
      {r.movieResults.map((m, i) => {
        const outcome = OUTCOME[m.outcome];
        const counts = statusByMovie.get(m.movieId) ?? {};
        const statusLine = (['ON_SALE', 'SCHEDULED', 'SUSPENDED', 'CANCELLED'] as const)
          .filter((k) => counts[k])
          .map((k) => `${counts[k]} ${(SHOWTIME_STATUS_LABEL[k] ?? k).toLowerCase()}`)
          .join(' · ');
        const shown = open && open.movieId === m.movieId ? (byMovieDay.get(`${m.movieId}|${open.date}`) ?? []) : [];
        return (
          <View key={m.movieId} style={{ gap: spacing.sm, paddingTop: i ? spacing.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Poster uri={m.posterUrl} style={{ width: 36, aspectRatio: 2 / 3, borderRadius: 4 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText numberOfLines={2} style={{ fontSize: 14, fontWeight: '800' }}>{m.title}</AppText>
                <View style={{ flexDirection: 'row' }}>
                  <Badge label={outcome.label(m.selected)} tone={outcome.tone} />
                </View>
                {statusLine ? <AppText variant="caption">{statusLine}</AppText> : null}
              </View>
            </View>
            <View style={{ gap: spacing.xs }}>
              {m.clusters.filter((c) => c.applicable).map((c) => <CinemaLine key={c.clusterId} c={c} rangeStart={r.startDate} />)}
              {m.clusters.some((c) => !c.applicable) ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Ionicons name="remove-circle-outline" size={16} color={colors.textFaint} />
                  <AppText variant="caption" style={{ flex: 1 }}>
                    {m.clusters.every((c) => !c.applicable)
                      ? 'Không rạp nào có kế hoạch khai thác trong khoảng ngày này'
                      : `Không có kế hoạch khai thác: ${m.clusters.filter((c) => !c.applicable).map((c) => shortCinema(c.name)).join(', ')}`}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {m.days.map((d) => {
                const active = open?.movieId === m.movieId && open.date === d.date;
                return (
                  <Pressable
                    key={d.date}
                    disabled={!d.selected}
                    onPress={() => setPicked(active ? 'closed' : { movieId: m.movieId, date: d.date })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !d.selected }}
                    accessibilityLabel={`${formatShortDate(d.date)}: ${d.selected} suất${d.selected ? ', bấm để xem giờ chiếu' : ''}`}
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: spacing.sm,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.primary : d.selected ? colors.primarySoft : colors.surfaceAlt,
                    }}
                  >
                    <AppText style={{ fontSize: 12, fontWeight: d.selected ? '700' : '400', color: active ? colors.onPrimary : d.selected ? colors.primary : colors.textFaint }}>
                      {dm(d.date)} · {d.selected}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            {shown.length && open ? (
              <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
                <AppText style={{ fontSize: 13, fontWeight: '800' }}>Giờ chiếu ngày {formatShortDate(open.date)} · {shown.length} suất</AppText>
                {r.clusters.map((c) => {
                  const rows = shown.filter((s) => s.clusterId === c.clusterId);
                  if (!rows.length) return null;
                  return (
                    <View key={c.clusterId} style={{ gap: 4 }}>
                      <AppText variant="caption" style={{ fontWeight: '700', color: colors.text }}>{shortCinema(c.name)} · {rows.length} suất</AppText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {rows.map((s) => <TimeChip key={s.showTimeId} s={s} />)}
                      </View>
                    </View>
                  );
                })}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {[...new Set(shown.map((s) => s.status))].map((k) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: statusStyle(k).border, backgroundColor: statusStyle(k).bg }} />
                      <AppText variant="caption">{SHOWTIME_STATUS_LABEL[k] ?? k}</AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function ShowtimeRow({ s }: { s: SchedulingShowtime }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 }}>
      <View style={{ width: 92 }}>
        <AppText style={{ fontSize: 14, fontWeight: '800' }}>{s.startTime}</AppText>
        <AppText variant="caption">đến {s.endTime}</AppText>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText numberOfLines={1} style={{ fontSize: 13, fontWeight: '600' }}>{s.movieTitle}</AppText>
        <AppText variant="caption">{s.roomName} · {s.format} · {formatMoney(s.price)}</AppText>
      </View>
      <Badge label={SHOWTIME_STATUS_LABEL[s.status] ?? s.status} tone={SHOWTIME_STATUS_TONE[s.status] ?? 'neutral'} />
    </View>
  );
}

/** The showtimes the run created: pick a day, then see them by cinema (filter by cinema or movie if needed). */
export function ShowtimeList({ r }: { r: SchedulingRunDetail }) {
  const dates = r.perDay.map((d) => d.date);
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    r.showtimes.forEach((s) => map.set(s.date, (map.get(s.date) ?? 0) + 1));
    return map;
  }, [r.showtimes]);
  const firstWithShows = dates.find((d) => countByDay.get(d)) ?? dates[0];

  const [pickedDay, setDay] = useState<string | null>(null);
  const [cinema, setCinema] = useState<number | null>(null);
  const [movie, setMovie] = useState<number | null>(null);
  const day = pickedDay ?? firstWithShows;

  const visible = r.showtimes.filter((s) => s.date === day && (cinema === null || s.clusterId === cinema) && (movie === null || s.movieId === movie));
  const groups = r.clusters
    .map((c) => ({ ...c, rows: visible.filter((s) => s.clusterId === c.clusterId) }))
    .filter((g) => g.rows.length);
  const moviesWithShows = r.movieResults.filter((m) => m.selected > 0);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText style={{ fontSize: 15, fontWeight: '700' }}>Suất chiếu đã tạo</AppText>
        <AppText variant="caption">{r.showtimes.length} suất, chọn ngày để xem từng suất theo rạp.</AppText>
      </View>

      {!r.showtimes.length ? (
        <AppText variant="caption">
          {r.status === 'DISCARDED' ? 'Lần tạo này đã bị huỷ, các suất chưa mở bán đã được xoá.' : 'Lần tạo này không có suất nào.'}
        </AppText>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {dates.map((d) => (
              <Chip key={d} label={`${dm(d)} (${countByDay.get(d) ?? 0})`} selected={d === day} onPress={() => setDay(d)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Chip label="Tất cả rạp" selected={cinema === null} onPress={() => setCinema(null)} />
            {r.clusters.map((c) => (
              <Chip key={c.clusterId} label={shortCinema(c.name)} selected={cinema === c.clusterId} onPress={() => setCinema(c.clusterId)} />
            ))}
          </View>
          {moviesWithShows.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              <Chip label="Tất cả phim" selected={movie === null} onPress={() => setMovie(null)} />
              {moviesWithShows.map((m) => (
                <Chip key={m.movieId} label={m.title} selected={movie === m.movieId} onPress={() => setMovie(m.movieId)} />
              ))}
            </ScrollView>
          ) : null}

          {groups.length ? (
            groups.map((g) => (
              <View key={g.clusterId} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Ionicons name="location" size={14} color={colors.primary} />
                  <AppText style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.primary }}>{g.name}</AppText>
                  <AppText variant="caption">{g.rows.length} suất</AppText>
                </View>
                {g.rows.map((s) => <ShowtimeRow key={s.showTimeId} s={s} />)}
              </View>
            ))
          ) : (
            <AppText variant="caption">Không có suất nào trong ngày {formatShortDate(day)} với bộ lọc này.</AppText>
          )}
          {r.showtimesTruncated ? <AppText variant="caption" style={{ color: colors.warning }}>Danh sách đã được rút gọn ở {r.showtimes.length} suất đầu tiên.</AppText> : null}
        </>
      )}
    </Card>
  );
}
