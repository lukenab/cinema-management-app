import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Chip, EmptyView, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatShortDate } from '@/lib/format';
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from '@/lib/labels';
import { queryErrorMessage, useSearchAccountsQuery } from '@/store/api';
import { colors, radius, spacing } from '@/theme';

const STATUS_FILTERS: { key?: string; label: string }[] = [
  { label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Hoạt động' },
  { key: 'INACTIVE', label: 'Vô hiệu hóa' },
];

export default function Customers() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(text.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [text]);

  const list = useSearchAccountsQuery({ query: query || undefined, status, page });
  const totalPages = list.data?.totalPages ?? 1;

  return (
    <Screen>
      <ScreenHeader title="Tài khoản khách hàng" subtitle={list.data ? `${list.data.totalElements} tài khoản` : undefined} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput value={text} onChangeText={setText} placeholder="Tìm theo tên đăng nhập hoặc email" placeholderTextColor={colors.textFaint} style={{ flex: 1, minHeight: 40, color: colors.text, fontSize: 14 }} autoCapitalize="none" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => <Chip key={f.label} label={f.label} selected={status === f.key} onPress={() => { setStatus(f.key); setPage(1); }} />)}
        </View>
      </View>

      {list.isLoading ? (
        <LoadingView />
      ) : list.error ? (
        <ErrorView message={queryErrorMessage(list.error)} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={list.data?.data ?? []}
          keyExtractor={(a) => a.accountId}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyView title="Không có tài khoản" message="Thử từ khóa hoặc bộ lọc khác." />}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md }}>
                <Button title="Trước" variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} style={{ minHeight: 38 }} />
                <AppText variant="caption">Trang {page}/{totalPages}</AppText>
                <Button title="Sau" variant="secondary" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} style={{ minHeight: 38 }} />
              </View>
            ) : (
              <View />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/admin/customers/${encodeURIComponent(item.accountId)}`)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <AppText style={{ color: colors.primary, fontWeight: '800' }}>{(item.username ?? '?').charAt(0).toUpperCase()}</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText numberOfLines={1} style={{ fontSize: 14, fontWeight: '700' }}>{item.username}</AppText>
                <AppText numberOfLines={1} variant="caption">{item.email}</AppText>
                {item.createdAt ? <AppText variant="caption" style={{ fontSize: 11 }}>Tham gia {formatShortDate(item.createdAt)}</AppText> : null}
              </View>
              <Badge label={ACCOUNT_STATUS_LABEL[item.status] ?? item.status} tone={ACCOUNT_STATUS_TONE[item.status] ?? 'neutral'} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
