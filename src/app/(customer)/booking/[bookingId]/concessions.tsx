import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Button, Chip, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { useCountdown } from '@/hooks/use-countdown';
import { newIdempotencyKey } from '@/lib/apiClient';
import { formatCountdown, formatMoney } from '@/lib/format';
import { queryErrorMessage, useAttachConcessionsMutation, useGetBookingQuery, useGetConcessionCatalogQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { CatalogConcession, ComboComponent, ConcessionSelection } from '@/types/api';

type CartLine = { qty: number; selections: Record<string, number[]> };

const CATEGORY_LABEL: Record<string, string> = { COMBOS: 'Combo', POPCORN: 'Bắp', DRINKS: 'Nước uống', SNACKS: 'Đồ ăn nhẹ' };
const GROUP_LABEL: Record<string, string> = { DRINK: 'Nước uống' };

/** Product photos bundled with the app, keyed by the menu item's code. */
const PHOTO: Record<string, ImageSource> = {
  COMBO1: require('@/../assets/images/concessions/combo-solo.jpg'),
  COMBO2: require('@/../assets/images/concessions/combo-duo.jpg'),
  COMBO3: require('@/../assets/images/concessions/combo-party.jpg'),
  COMBO4: require('@/../assets/images/concessions/combo-hotdog.jpg'),
  COMBO5: require('@/../assets/images/concessions/combo-caramel.jpg'),
  'POP-M': require('@/../assets/images/concessions/popcorn.jpg'),
  'POP-L': require('@/../assets/images/concessions/popcorn.jpg'),
  COLA: require('@/../assets/images/concessions/soda.jpg'),
  SPRITE: require('@/../assets/images/concessions/soda.jpg'),
  ORANGE: require('@/../assets/images/concessions/orange.jpg'),
  WATER: require('@/../assets/images/concessions/water.jpg'),
  NACHOS: require('@/../assets/images/concessions/nachos.jpg'),
  HOTDOG: require('@/../assets/images/concessions/hotdog.jpg'),
};

const lineKey = (c: Pick<CatalogConcession, 'sellableType' | 'sellableId'>) => `${c.sellableType}:${c.sellableId}`;

function groupComponents(components: ComboComponent[]): Record<string, ComboComponent[]> {
  return components.reduce<Record<string, ComboComponent[]>>((acc, c) => {
    (acc[c.groupCode] ??= []).push(c);
    return acc;
  }, {});
}

function defaultSelections(item: CatalogConcession): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  Object.entries(groupComponents(item.components)).forEach(([group, options]) => {
    out[group] = options.slice(0, options[0]?.minSelect ?? 0).map((o) => o.allowedSkuId);
  });
  return out;
}

/** Rebuilds the option picks of a saved line from its "Coca-Cola, Sprite" text. */
function selectionsFromText(item: CatalogConcession, text?: string): Record<string, number[]> {
  const base = defaultSelections(item);
  if (!text) return base;
  const names = text.split(',').map((s) => s.trim());
  Object.entries(groupComponents(item.components)).forEach(([group, options]) => {
    const picked = options.filter((o) => names.includes(o.label)).map((o) => o.allowedSkuId);
    if (picked.length) base[group] = picked;
  });
  return base;
}

function selectionsValid(item: CatalogConcession, selections: Record<string, number[]>): boolean {
  return Object.entries(groupComponents(item.components)).every(([group, options]) => {
    const picked = selections[group] ?? [];
    return picked.length >= options[0].minSelect && picked.length <= options[0].maxSelect;
  });
}

function Stepper({ qty, name, onChange }: { qty: number; name: string; onChange: (delta: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable onPress={() => onChange(-1)} disabled={qty === 0} accessibilityRole="button" accessibilityLabel={`Bớt một ${name}`} hitSlop={8} style={{ padding: 6, opacity: qty === 0 ? 0.35 : 1 }}>
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <AppText style={{ minWidth: 26, textAlign: 'center', fontSize: 16, fontWeight: '700' }}>{qty}</AppText>
      <Pressable onPress={() => onChange(1)} accessibilityRole="button" accessibilityLabel={`Thêm một ${name}`} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="add" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default function ConcessionsScreen() {
  const { bookingId, edit } = useLocalSearchParams<{ bookingId: string; edit?: string }>();
  const booking = useGetBookingQuery(bookingId);
  const catalog = useGetConcessionCatalogQuery(
    { clusterId: booking.data?.cinemaClusterId ?? 0, showtimeId: booking.data?.showtimeId },
    { skip: !booking.data },
  );
  const [attach, attachState] = useAttachConcessionsMutation();

  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [category, setCategory] = useState('ALL');
  const [error, setError] = useState('');
  const keyRef = useRef<{ signature: string; key: string } | null>(null);
  const prefilled = useRef(false);

  const remaining = useCountdown(booking.data?.status === 'PENDING_PAYMENT' ? booking.data.expiresAt : null);
  const expired = booking.data ? booking.data.status !== 'PENDING_PAYMENT' || remaining === 0 : false;

  // Start from what the booking already contains.
  useEffect(() => {
    if (prefilled.current || !booking.data || !catalog.data) return;
    prefilled.current = true;
    const menu = catalog.data;
    const next: Record<string, CartLine> = {};
    booking.data.concessions.forEach((line) => {
      const match = menu.find((c) => c.code === line.itemCode);
      if (match) next[lineKey(match)] = { qty: line.quantity, selections: selectionsFromText(match, line.options) };
    });
    setCart(next);
  }, [booking.data, catalog.data]);

  const categories = useMemo(() => ['ALL', ...new Set((catalog.data ?? []).map((c) => c.category))], [catalog.data]);
  const items = useMemo(() => (catalog.data ?? []).filter((c) => category === 'ALL' || c.category === category), [catalog.data, category]);

  const seatCount = booking.data?.seats.length ?? 0;
  // The combo that fits the party size is highlighted: a pair gets the double combo.
  const suggestedCode = seatCount >= 2 ? 'COMBO2' : 'COMBO1';

  const cartTotal = (catalog.data ?? []).reduce((sum, c) => sum + (cart[lineKey(c)]?.qty ?? 0) * c.price, 0);
  const total = (booking.data?.ticketSubtotal ?? 0) + cartTotal;

  const change = (item: CatalogConcession, delta: number) => {
    setError('');
    setCart((prev) => {
      const key = lineKey(item);
      const current = prev[key] ?? { qty: 0, selections: defaultSelections(item) };
      const qty = Math.max(0, Math.min(10, current.qty + delta));
      const next = { ...prev };
      if (qty === 0) delete next[key];
      else next[key] = { ...current, qty };
      return next;
    });
  };

  const toggleOption = (item: CatalogConcession, group: string, option: ComboComponent) => {
    setCart((prev) => {
      const key = lineKey(item);
      const line = prev[key];
      if (!line) return prev;
      const picked = line.selections[group] ?? [];
      const max = option.maxSelect;
      let nextPicked: number[];
      if (picked.includes(option.allowedSkuId)) nextPicked = picked.filter((id) => id !== option.allowedSkuId);
      else if (max === 1) nextPicked = [option.allowedSkuId];
      else if (picked.length < max) nextPicked = [...picked, option.allowedSkuId];
      else return prev;
      return { ...prev, [key]: { ...line, selections: { ...line.selections, [group]: nextPicked } } };
    });
  };

  const proceed = async () => {
    if (expired) {
      router.replace('/home');
      return;
    }
    const lines = (catalog.data ?? []).filter((c) => cart[lineKey(c)]);
    const invalid = lines.find((c) => !selectionsValid(c, cart[lineKey(c)].selections));
    if (invalid) {
      setError(`Vui lòng chọn loại nước cho ${invalid.name}.`);
      return;
    }
    const itemsPayload = lines.map((c) => {
      const line = cart[lineKey(c)];
      const selections: ConcessionSelection[] | undefined = c.components.length
        ? Object.entries(line.selections).map(([groupCode, skuIds]) => ({ groupCode, skuIds }))
        : undefined;
      return { sellableType: c.sellableType, sellableId: c.sellableId, quantity: line.qty, ...(selections ? { selections } : {}) };
    });

    // Nothing chosen and nothing to clear: go straight on.
    if (itemsPayload.length || booking.data?.concessions.length) {
      const signature = JSON.stringify(itemsPayload);
      if (keyRef.current?.signature !== signature) keyRef.current = { signature, key: newIdempotencyKey() };
      const res = await attach({ bookingId, items: itemsPayload, idempotencyKey: keyRef.current.key });
      if ('error' in res) {
        setError(queryErrorMessage(res.error, 'Không thể cập nhật bắp nước.'));
        return;
      }
    }
    // Opened from the payment screen to edit: go back to it. Otherwise this is the step before it.
    if (edit) router.back();
    else router.push(`/booking/${bookingId}/checkout`);
  };

  const seatText = booking.data?.seats.map((s) => s.seatCode).join(', ') ?? '';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Chọn combo" />
      {booking.data && !expired && remaining != null ? (
        <View style={{ backgroundColor: remaining < 60 ? colors.danger : colors.accent, paddingVertical: 8, alignItems: 'center' }}>
          <AppText style={{ color: colors.onPrimary, fontSize: 14 }}>
            Thời gian giữ ghế: <AppText style={{ color: colors.onPrimary, fontWeight: '800' }}>{formatCountdown(remaining)}</AppText>
          </AppText>
        </View>
      ) : null}
      {expired ? (
        <View style={{ backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
          <AppText style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '700' }}>Đã hết thời gian giữ ghế. Vui lòng chọn lại ghế.</AppText>
        </View>
      ) : null}

      {booking.isLoading || catalog.isLoading ? (
        <LoadingView />
      ) : booking.error || catalog.error ? (
        <ErrorView message={queryErrorMessage(booking.error ?? catalog.error)} onRetry={() => { booking.refetch(); catalog.refetch(); }} />
      ) : (
        <>
          <View style={{ paddingVertical: spacing.sm }}>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(c) => c}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
              renderItem={({ item }) => <Chip label={item === 'ALL' ? 'Tất cả' : (CATEGORY_LABEL[item] ?? item)} selected={item === category} onPress={() => setCategory(item)} />}
            />
          </View>
          <FlatList
            data={items}
            keyExtractor={lineKey}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
            ListEmptyComponent={<EmptyView title="Chưa có món nào" message="Rạp chưa có bắp nước cho suất chiếu này." />}
            renderItem={({ item }) => {
              const line = cart[lineKey(item)];
              const suggested = item.code === suggestedCode;
              const groups = Object.entries(groupComponents(item.components)).filter(([, opts]) => opts.length > (opts[0]?.minSelect ?? 0));
              return (
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: suggested || line ? 1.5 : 1, borderColor: suggested || line ? colors.accent : colors.border, padding: spacing.md, gap: spacing.md }}>
                  {suggested ? (
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1E3', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent }}>
                      <Ionicons name="star" size={12} color={colors.gold} />
                      <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.gold }}>Gợi ý cho bạn</AppText>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {PHOTO[item.code] ? (
                      <Image source={PHOTO[item.code]} contentFit="cover" transition={150} style={{ width: 108, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }} />
                    ) : null}
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText numberOfLines={2} style={{ fontSize: 16, fontWeight: '800', lineHeight: 21 }}>{item.name}</AppText>
                      {item.description ? <AppText variant="caption" numberOfLines={2}>{item.description}</AppText> : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AppText style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formatMoney(item.price, item.currency)}</AppText>
                    <Stepper qty={line?.qty ?? 0} name={item.name} onChange={(d) => change(item, d)} />
                  </View>

                  {line && groups.length ? (
                    <View style={{ gap: spacing.sm }}>
                      {groups.map(([group, options]) => (
                        <View key={group} style={{ gap: spacing.xs }}>
                          <AppText variant="label">{GROUP_LABEL[group] ?? group.replace(/_/g, ' ')} · chọn {options[0].minSelect === options[0].maxSelect ? options[0].minSelect : `${options[0].minSelect}–${options[0].maxSelect}`}</AppText>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                            {options.map((o) => (
                              <Chip key={o.allowedSkuId} label={o.label} selected={(line.selections[group] ?? []).includes(o.allowedSkuId)} onPress={() => toggleOption(item, group, o)} />
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" numberOfLines={1}>{seatCount}× ghế: <AppText style={{ fontWeight: '700', fontSize: 13 }}>{seatText}</AppText></AppText>
              {error ? <AppText variant="caption" style={{ color: colors.danger }} numberOfLines={2}>{error}</AppText> : null}
              <AppText style={{ fontSize: 14 }}>Tổng cộng: <AppText style={{ fontSize: 20, fontWeight: '800', color: colors.gold }}>{formatMoney(total, booking.data?.currency)}</AppText></AppText>
            </View>
            <Button title={expired ? 'Chọn lại ghế' : 'Tiếp tục'} onPress={proceed} loading={attachState.isLoading} style={{ minWidth: 130 }} />
          </View>
        </>
      )}
    </Screen>
  );
}
