import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { MOCK_MEMBER_TIER, SUPPORT_EMAIL, SUPPORT_HOTLINE } from '@/lib/config';
import { formatShortDate } from '@/lib/format';
import { useAppDispatch, useAppSelector } from '@/store';
import { useGetMyAccountQuery, useGetProfileQuery } from '@/store/api';
import { signOut } from '@/store/authSlice';
import { colors, radius, spacing } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const GENDER: Record<string, string> = { Male: 'Nam', Female: 'Nữ', Other: 'Khác' };

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <AppText variant="caption" style={{ width: 92 }}>{label}</AppText>
      <AppText style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{value || '—'}</AppText>
    </View>
  );
}

function LinkRow({ icon, label, value, onPress }: { icon: IconName; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <AppText style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{label}</AppText>
      {value ? <AppText style={{ color: colors.primary, fontSize: 14 }}>{value}</AppText> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

export default function ProfileTab() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const profile = useGetProfileQuery(user?.accountId ?? '', { skip: !user });
  const account = useGetMyAccountQuery(undefined, { skip: !user });

  const displayName = profile.data?.fullName || user?.username || '';
  const joined = account.data?.createdAt ? formatShortDate(account.data.createdAt) : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}>
        <AppText variant="title">Tài khoản</AppText>

        {user ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <AppText style={{ fontSize: 26, fontWeight: '800', color: colors.primary }}>{displayName.charAt(0).toUpperCase() || '?'}</AppText>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText numberOfLines={1} style={{ fontSize: 18, fontWeight: '800' }}>{displayName}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFF3E3', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 }}>
                  <Ionicons name="ribbon" size={14} color={colors.accent} />
                  <AppText style={{ fontSize: 12, fontWeight: '700', color: colors.gold }}>{MOCK_MEMBER_TIER}</AppText>
                </View>
                <AppText variant="caption">{joined ? `Tham gia từ ${joined}` : 'Thành viên CinePrime'}</AppText>
              </View>
            </Card>

            {profile.data?.profileCompleted === false ? (
              <Card style={{ gap: spacing.sm, borderColor: colors.warning, backgroundColor: '#FFF8EB' }}>
                <AppText style={{ fontWeight: '700', color: colors.warning }}>Hồ sơ chưa hoàn thiện</AppText>
                <AppText variant="caption" style={{ color: colors.warning }}>Bổ sung họ tên, số điện thoại, ngày sinh và giới tính để đặt vé.</AppText>
                <Button title="Hoàn thiện hồ sơ" onPress={() => router.push('/complete-profile')} style={{ minHeight: 40 }} />
              </Card>
            ) : null}

            <Card style={{ gap: spacing.md }}>
              <AppText style={{ fontSize: 15, fontWeight: '700' }}>Thông tin cá nhân</AppText>
              <InfoRow icon="person-outline" label="Tên đăng nhập" value={user.username} />
              <InfoRow icon="mail-outline" label="Email" value={account.data?.email} />
              <InfoRow icon="call-outline" label="Điện thoại" value={profile.data?.phoneNumber} />
              <InfoRow icon="calendar-outline" label="Ngày sinh" value={profile.data?.dateOfBirth ? formatShortDate(profile.data.dateOfBirth) : undefined} />
              <InfoRow icon="male-female-outline" label="Giới tính" value={profile.data?.gender ? (GENDER[profile.data.gender] ?? profile.data.gender) : undefined} />
            </Card>

            <Card style={{ paddingVertical: spacing.xs }}>
              <LinkRow icon="ticket-outline" label="Vé của tôi" onPress={() => router.navigate('/tickets')} />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <LinkRow icon="call" label="Hotline" value={SUPPORT_HOTLINE} onPress={() => Linking.openURL(`tel:${SUPPORT_HOTLINE.replace(/\s/g, '')}`)} />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <LinkRow icon="mail" label="Email hỗ trợ" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
            </Card>

            <Pressable onPress={() => dispatch(signOut())} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: spacing.md }}>
              <AppText style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Đăng xuất</AppText>
            </Pressable>
          </>
        ) : (
          <>
            <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={28} color={colors.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <AppText style={{ fontSize: 17, fontWeight: '800' }}>Chào mừng đến với CinePrime</AppText>
                <AppText variant="caption" style={{ textAlign: 'center' }}>Đăng nhập để đặt vé và xem lại vé của bạn.</AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' }}>
                <Button title="Đăng nhập" onPress={() => router.push('/login')} style={{ flex: 1, minHeight: 42 }} />
                <Button title="Đăng ký" variant="secondary" onPress={() => router.push('/register')} style={{ flex: 1, minHeight: 42 }} />
              </View>
            </Card>

            <Card style={{ paddingVertical: spacing.xs }}>
              <LinkRow icon="call" label="Hotline" value={SUPPORT_HOTLINE} onPress={() => Linking.openURL(`tel:${SUPPORT_HOTLINE.replace(/\s/g, '')}`)} />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <LinkRow icon="mail" label="Email hỗ trợ" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
