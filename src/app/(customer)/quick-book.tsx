import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { CinemaPicker } from '@/components/CinemaPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, Chip, EmptyView, Poster, Screen } from '@/components/ui';
import { useCinema } from '@/hooks/use-cinema';
import { newIdempotencyKey } from '@/lib/apiClient';
import { formatMoney, nextDays } from '@/lib/format';
import { useAppSelector } from '@/store';
import { queryErrorMessage, useGetQuickBookingSuggestionsMutation, useQuickBookMutation } from '@/store/api';
import { colors, radius, spacing } from '@/theme';
import type { QuickBookingOption, QuickBookingResult } from '@/types/api';

const DAYS = nextDays(3);
const IDEAS = ['Tối nay 2 người, phim gì cũng được', 'Xả stress sau giờ làm, khoảng 19h', 'Đi một mình buổi chiều', 'Cả nhà 4 người, phim nhẹ nhàng'];
const PARTY = [undefined, 1, 2, 3, 4, 5, 6] as const;
const SEAT_LABEL = { STANDARD: 'Thường', VIP: 'VIP', COUPLE: 'Ghế đôi' } as const;

function OptionCard({ option, onBook, busy }: { option: QuickBookingOption; onBook: () => void; busy: boolean }) {
  const seatTypes = [...new Set(option.seats.map((s) => SEAT_LABEL[s.type]))].join(', ');
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Poster uri={option.movie.posterUrl} style={{ width: 72, aspectRatio: 2 / 3, borderRadius: 6 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText numberOfLines={2} style={{ fontSize: 16, fontWeight: '800' }}>{option.movie.title}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
            {option.movie.ageRatingCode ? <Badge label={option.movie.ageRatingCode} tone="warning" /> : null}
            {option.movie.durationMinutes ? <AppText variant="caption">{option.movie.durationMinutes} phút</AppText> : null}
          </View>
          <AppText style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>
            {option.startTime} – {option.endTime} · {option.format}
          </AppText>
          <AppText variant="caption">{option.roomName} · còn {option.seatsLeft} ghế</AppText>
        </View>
      </View>

      {option.summary ? <AppText style={{ fontSize: 14, lineHeight: 20 }}>{option.summary}</AppText> : null}
      {option.reason ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Ionicons name="sparkles" size={14} color={colors.primary} style={{ marginTop: 2 }} />
          <AppText variant="caption" style={{ flex: 1, color: colors.primary }}>{option.reason}</AppText>
        </View>
      ) : null}

      <View style={{ gap: 6, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <AppText style={{ fontSize: 14, flex: 1 }}>
            Ghế {option.seats.map((s) => s.seatCode).join(', ')} <AppText variant="caption">({seatTypes}{option.seatsAdjacent ? ', liền nhau' : ''})</AppText>
          </AppText>
          <AppText style={{ fontSize: 14, fontWeight: '700' }}>{formatMoney(option.ticketTotal)}</AppText>
        </View>
        {option.combos.map((c) => (
          <View key={c.code} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <AppText style={{ fontSize: 14, flex: 1 }}>
              {c.quantity} × {c.name}
              {c.options ? <AppText variant="caption"> ({c.options})</AppText> : null}
            </AppText>
            <AppText style={{ fontSize: 14, fontWeight: '700' }}>{formatMoney(c.unitPrice * c.quantity)}</AppText>
          </View>
        ))}
      </View>

      <Button title={`Đặt nhanh · ${formatMoney(option.total)}`} onPress={onBook} loading={busy} />
      <Pressable onPress={() => router.push(`/movie/${option.movie.movieId}`)} accessibilityRole="link" style={{ alignSelf: 'center' }} hitSlop={8}>
        <AppText style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Xem thông tin phim</AppText>
      </Pressable>
    </Card>
  );
}

export default function QuickBookScreen() {
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  const { clusterId } = useCinema();
  const [ask, askState] = useGetQuickBookingSuggestionsMutation();
  const [book] = useQuickBookMutation();
  const [text, setText] = useState('');
  const [date, setDate] = useState(DAYS[0].iso);
  const [party, setParty] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<QuickBookingResult | null>(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<number | null>(null);

  const submit = async (message = text) => {
    const value = message.trim();
    if (value.length < 2) {
      setError('Hãy cho biết bạn muốn xem lúc nào, đi mấy người.');
      return;
    }
    if (!clusterId) return;
    setError('');
    setResult(null);
    const res = await ask({ message: value, clusterId, date, partySize: party });
    if ('error' in res) setError(queryErrorMessage(res.error, 'Chưa gợi ý được lúc này. Vui lòng thử lại.'));
    else setResult(res.data);
  };

  const quickBook = async (option: QuickBookingOption) => {
    setError('');
    setBooking(option.showtimeId);
    const res = await book({
      showtimeId: option.showtimeId,
      seatIds: option.seats.map((s) => s.seatId),
      concessions: option.combos.map(({ sellableType, sellableId, quantity, selections }) => ({ sellableType, sellableId, quantity, selections })),
      idempotencyKey: newIdempotencyKey(),
    });
    setBooking(null);
    if ('error' in res) {
      setError(`${queryErrorMessage(res.error, 'Không đặt được suất này.')} Bấm "Gợi ý lại" để chọn ghế khác.`);
      return;
    }
    router.push(`/booking/${res.data.bookingId}/checkout`);
  };

  return (
    <Screen>
      <ScreenHeader title="Đặt vé nhanh" subtitle="Trợ lý AI chọn suất, ghế đẹp và combo cho bạn" />
      {!signedIn ? (
        <View style={{ flex: 1 }}>
          <EmptyView title="Đăng nhập để đặt vé nhanh" message="Trợ lý sẽ giữ ghế và chuẩn bị đơn cho bạn sau khi đăng nhập." />
          <View style={{ padding: spacing.lg }}><Button title="Đăng nhập" onPress={() => router.push('/login')} /></View>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: spacing.md }}>
              <CinemaPicker />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {DAYS.map((d) => (
                  <Chip key={d.iso} label={`${d.label} ${d.date}`} selected={date === d.iso} onPress={() => setDate(d.iso)} />
                ))}
              </View>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">Số người</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {PARTY.map((n) => (
                    <Chip key={String(n)} label={n === undefined ? 'Tự nhận biết' : String(n)} selected={party === n} onPress={() => setParty(n)} />
                  ))}
                </View>
              </View>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Ví dụ: tối nay khoảng 8 giờ, 2 người, muốn xem gì đó vui vui"
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={300}
                style={{ minHeight: 80, textAlignVertical: 'top', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 14 }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {IDEAS.map((idea) => (
                  <Chip key={idea} label={idea} onPress={() => { setText(idea); void submit(idea); }} />
                ))}
              </View>
              <Button title={result ? 'Gợi ý lại' : 'Gợi ý cho tôi'} onPress={() => submit()} loading={askState.isLoading} />
              {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
            </View>

            {result ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} style={{ marginTop: 2 }} />
                  <AppText style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{result.reply}</AppText>
                </View>
                {result.options.map((o) => (
                  <OptionCard key={o.showtimeId} option={o} busy={booking === o.showtimeId} onBook={() => quickBook(o)} />
                ))}
                {result.options.length ? (
                  <AppText variant="caption" style={{ textAlign: 'center' }}>
                    Bấm Đặt nhanh để giữ ghế {result.partySize} người. Bạn vẫn có thể đổi bắp nước ở bước thanh toán.
                  </AppText>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
