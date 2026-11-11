import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './ui';

/** Compact top bar: back arrow, title (+ optional subtitle) and an optional right-hand element. */
export function ScreenHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: React.ReactNode; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={12} style={{ padding: spacing.sm }}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontSize: 16, fontWeight: '700' }}>{title}</AppText>
        {subtitle ? <AppText numberOfLines={1} variant="caption">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}
