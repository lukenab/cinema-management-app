import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { useCinema } from '@/hooks/use-cinema';
import { colors, radius, spacing } from '@/theme';
import type { Cluster } from '@/types/api';

/** "08:30 – 23:30" for today. */
export function hoursToday(c?: Cluster): string | undefined {
  const h = c?.operatingHours?.find((o) => o.dayOfWeek === new Date().getDay());
  return h ? `${h.opensAt} – ${h.closesAt}` : undefined;
}

/** Shows the chosen cinema; tapping it opens the list of cinemas. */
export function CinemaPicker({ compact }: { compact?: boolean }) {
  const { cinemas, cinema, setCinema } = useCinema();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Rạp đang chọn: ${cinema?.clusterName ?? 'chưa chọn'}. Bấm để đổi rạp`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: compact ? 'center' : 'flex-start',
          paddingVertical: 6,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        })}
      >
        <Ionicons name="location" size={15} color={colors.primary} />
        <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.primary, maxWidth: 220 }}>
          {cinema?.clusterName ?? 'Chọn rạp'}
        </AppText>
        <Ionicons name="chevron-down" size={14} color={colors.primary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setOpen(false)} accessibilityLabel="Đóng" />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: insets.bottom + spacing.md, maxHeight: '75%' }}>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            <AppText style={{ fontSize: 18, fontWeight: '800' }}>Chọn rạp</AppText>
            <AppText variant="caption">Lịch chiếu và giá vé theo từng rạp.</AppText>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {cinemas.map((c) => {
              const active = c.clusterId === cinema?.clusterId;
              return (
                <Pressable
                  key={c.clusterId}
                  onPress={() => {
                    setCinema(c.clusterId);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primarySoft : colors.surface,
                  }}
                >
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.textFaint} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontSize: 15, fontWeight: '700' }}>{c.clusterName}</AppText>
                    <AppText variant="caption">{c.address}</AppText>
                    {hoursToday(c) ? <AppText variant="caption">Hôm nay mở cửa {hoursToday(c)}</AppText> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
