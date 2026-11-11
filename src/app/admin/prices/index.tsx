import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Button, Card, Chip, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { queryErrorMessage, useGetAdminClustersQuery, useGetPriceBookQuery, useUpdatePriceBookMutation } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { PriceBook, PriceRate } from '@/types/api';

const DAY_TYPES: { key: PriceRate['dayType']; label: string }[] = [
  { key: 'WEEKDAY', label: 'Thứ 2 – Thứ 5' },
  { key: 'WEEKEND', label: 'Thứ 6 – Chủ nhật' },
];
const FORMATS: PriceRate['format'][] = ['2D', '3D'];
const SEATS: { key: keyof PriceBook['seatMultipliers']; label: string }[] = [
  { key: 'STANDARD', label: 'Ghế thường' },
  { key: 'VIP', label: 'Ghế VIP' },
  { key: 'COUPLE', label: 'Ghế đôi (mỗi chỗ)' },
];
const key = (r: Pick<PriceRate, 'dayType' | 'daypart' | 'format'>) => `${r.dayType}|${r.daypart}|${r.format}`;

function NumberCell({ value, onChange, width = 92 }: { value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType="numeric"
      style={{ width, minHeight: 38, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 14, textAlign: 'right' }}
    />
  );
}

/** Ticket prices of one cinema: day type × daypart × format, then a multiplier per seat type. */
export default function PriceBookScreen() {
  const clusters = useGetAdminClustersQuery();
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const clusterId = picked ?? clusters.data?.[0]?.clusterId;
  const book = useGetPriceBookQuery(clusterId ?? 0, { skip: !clusterId });
  const [save, saveState] = useUpdatePriceBookMutation();
  // Edits are kept per cinema; without edits the saved price book is shown.
  const [drafts, setDrafts] = useState<Record<number, { prices: Record<string, string>; mult: Record<string, string> }>>({});
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const saved = book.data
    ? {
        prices: Object.fromEntries(book.data.rates.map((r) => [key(r), String(r.standardPrice)])),
        mult: Object.fromEntries(Object.entries(book.data.seatMultipliers).map(([k, v]) => [k, String(v)])),
      }
    : { prices: {}, mult: {} };
  const draft = (clusterId && drafts[clusterId]) || saved;
  const { prices, mult } = draft;
  const edit = (change: (d: typeof draft) => typeof draft) => clusterId && setDrafts((all) => ({ ...all, [clusterId]: change(all[clusterId] ?? saved) }));
  const setPrices = (f: (p: Record<string, string>) => Record<string, string>) => edit((d) => ({ ...d, prices: f(d.prices) }));
  const setMult = (f: (m: Record<string, string>) => Record<string, string>) => edit((d) => ({ ...d, mult: f(d.mult) }));
  const setClusterId = (id: number) => {
    setPicked(id);
    setMessage(null);
  };

  const submit = async () => {
    if (!book.data || !clusterId) return;
    setMessage(null);
    const rates: PriceRate[] = [];
    for (const dayType of DAY_TYPES) {
      for (const d of book.data.dayparts) {
        for (const format of FORMATS) {
          const raw = prices[key({ dayType: dayType.key, daypart: d.code, format })];
          if (raw === undefined || raw === '') continue;
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 10_000) return setMessage({ text: `Giá ${dayType.label} · ${d.label} · ${format} không hợp lệ (tối thiểu 10.000 ₫).`, ok: false });
          rates.push({ dayType: dayType.key, daypart: d.code, format, standardPrice: Math.round(n) });
        }
      }
    }
    const m = { STANDARD: Number(mult.STANDARD), VIP: Number(mult.VIP), COUPLE: Number(mult.COUPLE) };
    if (Object.values(m).some((v) => !Number.isFinite(v) || v < 0.5 || v > 3)) return setMessage({ text: 'Hệ số ghế từ 0,5 đến 3.', ok: false });
    const res = await save({ clusterId, rates, seatMultipliers: m });
    if (!('error' in res)) setDrafts(({ [clusterId]: _done, ...rest }) => rest);
    setMessage('error' in res ? { text: queryErrorMessage(res.error, 'Không lưu được bảng giá.'), ok: false } : { text: 'Đã lưu. Bảng giá mới áp dụng cho các suất được tạo từ bây giờ.', ok: true });
  };

  return (
    <Screen>
      <ScreenHeader title="Bảng giá vé" subtitle="Theo rạp, ngày trong tuần, khung giờ và hạng ghế" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {(clusters.data ?? []).map((c) => (
              <Chip key={c.clusterId} label={c.clusterName.replace('CinePrime ', '')} selected={clusterId === c.clusterId} onPress={() => setClusterId(c.clusterId)} />
            ))}
          </View>

          {book.isLoading || !clusterId ? (
            <LoadingView />
          ) : book.error || !book.data ? (
            <ErrorView message={queryErrorMessage(book.error, 'Không tải được bảng giá.')} onRetry={book.refetch} />
          ) : (
            <>
              {DAY_TYPES.map((dt) => (
                <Card key={dt.key} style={{ gap: spacing.sm }}>
                  <AppText style={{ fontSize: 15, fontWeight: '700' }}>{dt.label}</AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppText variant="caption" style={{ flex: 1 }}>Khung giờ (giá ghế thường)</AppText>
                    {FORMATS.map((f) => <AppText key={f} variant="caption" style={{ width: 92, textAlign: 'right' }}>{f}</AppText>)}
                  </View>
                  {book.data!.dayparts.map((d) => (
                    <View key={d.code} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <AppText style={{ flex: 1, fontSize: 13 }}>{d.label}</AppText>
                      {FORMATS.map((f) => {
                        const k = key({ dayType: dt.key, daypart: d.code, format: f });
                        return <NumberCell key={k} value={prices[k] ?? ''} onChange={(v) => setPrices((p) => ({ ...p, [k]: v.replace(/[^0-9]/g, '') }))} />;
                      })}
                    </View>
                  ))}
                </Card>
              ))}

              <Card style={{ gap: spacing.sm }}>
                <AppText style={{ fontSize: 15, fontWeight: '700' }}>Hệ số theo hạng ghế</AppText>
                {SEATS.map((s) => {
                  const sample = Number(prices[key({ dayType: 'WEEKDAY', daypart: 'EVENING', format: '2D' })]) * Number(mult[s.key]);
                  return (
                    <View key={s.key} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontSize: 13 }}>{s.label}</AppText>
                        {Number.isFinite(sample) && sample > 0 ? <AppText variant="caption">Tối thường ngày 2D: {formatMoney(Math.round(sample / 1000) * 1000)}</AppText> : null}
                      </View>
                      <NumberCell width={72} value={mult[s.key] ?? ''} onChange={(v) => setMult((m) => ({ ...m, [s.key]: v.replace(',', '.') }))} />
                    </View>
                  );
                })}
              </Card>

              {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}
              <Button title="Lưu bảng giá" onPress={submit} loading={saveState.isLoading} />
              <AppText variant="caption">Suất chiếu đã tạo giữ nguyên giá lúc tạo, nên đổi bảng giá không ảnh hưởng vé đã bán.</AppText>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
