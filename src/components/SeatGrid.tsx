import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import type { Seat, SeatMapPosition } from '@/types/api';

import { AppText } from './ui';

const GAP = 4;
const MAX_CELL = 40;
const MIN_CELL = 30;
const LABEL_W = 22;

export const seatKey = (seat: Pick<Seat, 'seatCode' | 'row' | 'number'>) => seat.seatCode ?? `${seat.row}${seat.number}`;
export const isSeatSelectable = (seat: Seat) => seat.status === 'AVAILABLE';

type Item =
  | { kind: 'blank'; key: string; span: number }
  | { kind: 'seats'; key: string; seats: Seat[]; span: number };

/**
 * Builds rows of grid items from the room layout. Seats sharing a `seatGroupId`
 * (couple/sofa seats) are merged into a single item that is as wide as the
 * positions it occupies, so a couple seat reads as two joined seats.
 */
function buildRows(seats: Seat[], positions: SeatMapPosition[]): { label: string; items: Item[]; units: number }[] {
  const byCode = new Map(seats.map((s) => [seatKey(s), s]));
  const byRowNumber = new Map(seats.map((s) => [`${s.row}#${s.number}`, s]));
  const byGroup = new Map<string, Seat[]>();
  seats.forEach((s) => {
    if (s.seatGroupId) byGroup.set(s.seatGroupId, [...(byGroup.get(s.seatGroupId) ?? []), s]);
  });

  type Cell = { col: number; seat?: Seat; groupId?: string };
  const rows = new Map<number, { label: string; cells: Cell[] }>();

  if (positions.length) {
    positions.forEach((p) => {
      const row = rows.get(p.rowIndex) ?? { label: p.rowLabel, cells: [] };
      const seat =
        p.positionType === 'SEAT'
          ? (p.seatCode ? byCode.get(p.seatCode) : undefined) ?? byRowNumber.get(`${p.rowLabel}#${p.seatNumber}`)
          : undefined;
      row.cells.push({ col: p.columnIndex, seat, groupId: p.positionType === 'SEAT' ? p.seatGroupId : undefined });
      rows.set(p.rowIndex, row);
    });
  } else {
    seats.forEach((s) => {
      const key = s.row.charCodeAt(0);
      const row = rows.get(key) ?? { label: s.row, cells: [] };
      row.cells.push({ col: s.number, seat: s, groupId: s.seatGroupId });
      rows.set(key, row);
    });
  }

  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rowIndex, row]) => {
      const cells = row.cells.sort((a, b) => a.col - b.col);
      const items: Item[] = [];
      let i = 0;
      while (i < cells.length) {
        const cell = cells[i];
        const gid = cell.groupId ?? cell.seat?.seatGroupId;
        if (gid) {
          // Collect the consecutive positions belonging to the same group.
          let j = i;
          while (j < cells.length && (cells[j].groupId ?? cells[j].seat?.seatGroupId) === gid) j++;
          const span = j - i;
          const members = (byGroup.get(gid) ?? [])
            .slice()
            .sort((a, b) => a.number - b.number);
          items.push({ kind: 'seats', key: `${rowIndex}-${gid}-${i}`, seats: members.length ? members : cell.seat ? [cell.seat] : [], span: Math.max(span, members[0]?.colSpan ?? 1) });
          i = j;
        } else if (cell.seat) {
          items.push({ kind: 'seats', key: `${rowIndex}-${i}`, seats: [cell.seat], span: Math.max(1, cell.seat.colSpan ?? 1) });
          i += 1;
        } else {
          items.push({ kind: 'blank', key: `${rowIndex}-${i}`, span: 1 });
          i += 1;
        }
      }
      return { label: row.label, items, units: items.reduce((n, it) => n + it.span, 0) };
    });
}

function seatStyle(seats: Seat[], selected: boolean) {
  const first = seats[0];
  const unavailable = seats.some((s) => s.status !== 'AVAILABLE');
  if (selected) return { backgroundColor: colors.seatSelected, borderColor: colors.seatSelected, text: colors.onPrimary };
  if (unavailable) {
    return seats.every((s) => s.reservedByMe)
      ? { backgroundColor: colors.seatMine, borderColor: colors.seatMine, text: colors.text }
      : { backgroundColor: colors.seatBooked, borderColor: colors.seatBooked, text: colors.textFaint };
  }
  if (first.type === 'VIP') return { backgroundColor: colors.seatVip, borderColor: colors.seatVipBorder, text: colors.text };
  if (first.type === 'COUPLE') return { backgroundColor: colors.seatCouple, borderColor: colors.seatCoupleBorder, text: colors.text };
  if (first.type === 'ACCESSIBLE') return { backgroundColor: colors.primarySoft, borderColor: colors.primary, text: colors.text };
  return { backgroundColor: colors.seatAvailable, borderColor: colors.seatAvailableBorder, text: colors.text };
}

interface Props {
  seats: Seat[];
  positions: SeatMapPosition[];
  selectedIds: Set<number>;
  onToggle: (seat: Seat) => void;
}

export function SeatGrid({ seats, positions, selectedIds, onToggle }: Props) {
  const { width } = useWindowDimensions();
  const rows = useMemo(() => buildRows(seats, positions), [seats, positions]);

  const units = Math.max(1, ...rows.map((r) => r.units));
  const available = width - spacing.lg * 2 - LABEL_W * 2 - GAP * 2;
  const cell = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((available - GAP * (units - 1)) / units)));
  const rowWidth = units * cell + (units - 1) * GAP;
  const itemWidth = (span: number) => span * cell + (span - 1) * GAP;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg }}
    >
      <View style={{ gap: GAP + 2, alignItems: 'center' }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
            <AppText variant="caption" style={{ width: LABEL_W, textAlign: 'center', fontSize: 12, fontWeight: '600' }}>{row.label}</AppText>
            <View style={{ width: rowWidth, flexDirection: 'row', gap: GAP }}>
              {row.items.map((item) => {
                if (item.kind === 'blank' || !item.seats.length) return <View key={item.key} style={{ width: itemWidth(item.span), height: cell }} />;
                const group = item.seats;
                const selected = group.some((s) => selectedIds.has(s.seatId));
                const taken = group.some((s) => s.status !== 'AVAILABLE') && !group.every((s) => s.reservedByMe);
                const look = seatStyle(group, selected);
                const label = group.map((s) => seatKey(s)).join(' và ');
                return (
                  <Pressable
                    key={item.key}
                    disabled={taken || group.some((s) => !isSeatSelectable(s) && !s.reservedByMe)}
                    onPress={() => onToggle(group[0])}
                    accessibilityRole="button"
                    accessibilityLabel={`Ghế ${label}${group.length > 1 ? ' (ghế đôi)' : ''}, ${selected ? 'đang chọn' : taken ? 'đã bán' : 'còn trống'}`}
                    accessibilityState={{ selected, disabled: taken }}
                    style={[
                      styles.seat,
                      { width: itemWidth(item.span), height: cell, backgroundColor: look.backgroundColor, borderColor: look.borderColor },
                    ]}
                  >
                    {group.map((s, idx) => (
                      <View key={s.seatId} style={[styles.half, idx > 0 && { borderLeftWidth: 1, borderLeftColor: look.borderColor }]}>
                        <AppText style={[styles.seatText, { color: look.text, fontSize: taken ? 14 : cell < 34 ? 10 : 12 }]}>{taken ? '×' : s.number}</AppText>
                      </View>
                    ))}
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" style={{ width: LABEL_W, textAlign: 'center', fontSize: 12, fontWeight: '600' }}>{row.label}</AppText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function SeatLegend() {
  const items: { label: string; bg: string; border: string; mark?: string }[] = [
    { label: 'Ghế thường', bg: colors.seatAvailable, border: colors.seatAvailableBorder },
    { label: 'VIP', bg: colors.seatVip, border: colors.seatVipBorder },
    { label: 'Ghế đôi', bg: colors.seatCouple, border: colors.seatCoupleBorder },
    { label: 'Đang chọn', bg: colors.seatSelected, border: colors.seatSelected },
    { label: 'Đã bán', bg: colors.seatBooked, border: colors.seatBooked, mark: '×' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.lg, rowGap: spacing.sm, paddingHorizontal: spacing.lg }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, backgroundColor: it.bg, borderColor: it.border, alignItems: 'center', justifyContent: 'center' }}>
            {it.mark ? <AppText style={{ fontSize: 11, color: colors.textFaint, lineHeight: 13 }}>{it.mark}</AppText> : null}
          </View>
          <AppText variant="caption" style={{ fontSize: 12 }}>{it.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: { borderRadius: radius.sm - 2, borderWidth: 1.5, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  seatText: { fontWeight: '700', textAlign: 'center' },
});
