import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '@/theme';

// ── Layout ─────────────────────────────────────────────────────────────────

export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Typography ─────────────────────────────────────────────────────────────

type Variant = 'title' | 'heading' | 'body' | 'caption' | 'label';

const variantStyles: Record<Variant, TextStyle> = {
  title: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text },
  heading: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  body: { fontSize: font.size.md, color: colors.text },
  caption: { fontSize: font.size.sm, color: colors.textMuted },
  label: { fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
};

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[variantStyles[variant], style]} />;
}

// ── Controls ───────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        inactive && styles.buttonDisabled,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: colors.primary }, variant === 'ghost' && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<string, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
};

export function Input({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        {...rest}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
      />
      {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const bg = { neutral: colors.surfaceAlt, success: '#E3F4EA', warning: '#FDF0DC', danger: '#FDE7E5', info: colors.primarySoft }[tone];
  const fg = { neutral: colors.textMuted, success: colors.success, warning: colors.warning, danger: colors.danger, info: colors.primary }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── States ─────────────────────────────────────────────────────────────────

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <AppText variant="caption" style={{ marginTop: spacing.md }}>{label}</AppText> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={{ textAlign: 'center' }}>Đã có lỗi xảy ra</AppText>
      <AppText variant="caption" style={{ textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }}>{message}</AppText>
      {onRetry ? <Button title="Thử lại" onPress={onRetry} variant="secondary" style={{ minWidth: 140 }} /> : null}
    </View>
  );
}

export function EmptyView({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
      {message ? <AppText variant="caption" style={{ textAlign: 'center', marginTop: spacing.sm }}>{message}</AppText> : null}
    </View>
  );
}

// ── Media ──────────────────────────────────────────────────────────────────

export function Poster({ uri, style }: { uri?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.surfaceAlt, overflow: 'hidden' }, style]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  button: { minHeight: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: font.size.md, fontWeight: font.weight.semibold },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: font.size.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.medium },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: font.size.xs, fontWeight: font.weight.bold },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
