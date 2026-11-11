import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText, Badge, Button, Card, ErrorView, LoadingView, Screen } from '@/components/ui';
import { formatLongDate } from '@/lib/format';
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from '@/lib/labels';
import { queryErrorMessage, useGetAccountQuery, useGetProfileQuery, useRevokeSessionsMutation, useSetAccountStatusMutation } from '@/store/api';
import { colors, spacing } from '@/theme';

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="label">{label}</AppText>
      <AppText style={{ fontSize: 14 }}>{value || '—'}</AppText>
    </View>
  );
}

const GENDER: Record<string, string> = { Male: 'Nam', Female: 'Nữ', Other: 'Khác' };

export default function CustomerDetail() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const account = useGetAccountQuery(id);
  const profile = useGetProfileQuery(id);
  const [setStatus, statusState] = useSetAccountStatusMutation();
  const [revoke, revokeState] = useRevokeSessionsMutation();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const a = account.data;
  const manage = true;

  const confirm = (title: string, body: string, label: string, run: () => void, destructive = false) =>
    Alert.alert(title, body, [{ text: 'Huỷ', style: 'cancel' }, { text: label, style: destructive ? 'destructive' : 'default', onPress: run }]);

  const changeStatus = async (next: 'ACTIVE' | 'INACTIVE') => {
    setMessage(null);
    const res = await setStatus({ id, status: next });
    if ('error' in res) setMessage({ text: queryErrorMessage(res.error, 'Không thể đổi trạng thái tài khoản.'), ok: false });
    else setMessage({ text: next === 'ACTIVE' ? 'Đã kích hoạt lại tài khoản.' : 'Đã vô hiệu hóa tài khoản.', ok: true });
  };

  const revokeAll = async () => {
    setMessage(null);
    const res = await revoke(id);
    if ('error' in res) setMessage({ text: queryErrorMessage(res.error, 'Không thể thu hồi phiên đăng nhập.'), ok: false });
    else setMessage({ text: 'Đã thu hồi mọi phiên đăng nhập. Khách phải đăng nhập lại.', ok: true });
  };

  return (
    <Screen>
      <ScreenHeader title={a?.username ?? 'Khách hàng'} subtitle={a?.email} />
      {account.isLoading ? (
        <LoadingView />
      ) : account.error || !a ? (
        <ErrorView message={queryErrorMessage(account.error, 'Không tải được tài khoản.')} onRetry={account.refetch} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <Card style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText style={{ fontSize: 15, fontWeight: '700' }}>Tài khoản</AppText>
              <Badge label={ACCOUNT_STATUS_LABEL[a.status] ?? a.status} tone={ACCOUNT_STATUS_TONE[a.status] ?? 'neutral'} />
            </View>
            <Field label="Tên đăng nhập" value={a.username} />
            <Field label="Email" value={a.email} />
            <Field label="Đăng nhập gần nhất" value={a.lastLoginAt ? formatLongDate(a.lastLoginAt) : 'Chưa đăng nhập'} />
            <Field label="Ngày tạo" value={a.createdAt ? formatLongDate(a.createdAt) : undefined} />
          </Card>

          <Card style={{ gap: spacing.lg }}>
            <AppText style={{ fontSize: 15, fontWeight: '700' }}>Hồ sơ</AppText>
            {profile.isLoading ? (
              <LoadingView />
            ) : profile.data ? (
              <>
                <Field label="Họ và tên" value={profile.data.fullName} />
                <Field label="Số điện thoại" value={profile.data.phoneNumber} />
                <Field label="Ngày sinh" value={profile.data.dateOfBirth} />
                <Field label="Giới tính" value={profile.data.gender ? (GENDER[profile.data.gender] ?? profile.data.gender) : undefined} />
                <Field label="Hồ sơ" value={profile.data.profileCompleted ? 'Đã hoàn thiện' : 'Chưa hoàn thiện'} />
              </>
            ) : (
              <AppText variant="caption">Khách hàng chưa tạo hồ sơ.</AppText>
            )}
          </Card>

          {message ? <AppText variant="caption" style={{ color: message.ok ? colors.success : colors.danger }}>{message.text}</AppText> : null}

          {manage ? (
            <View style={{ gap: spacing.sm }}>
              {a.status === 'INACTIVE' ? (
                <Button title="Kích hoạt lại tài khoản" onPress={() => changeStatus('ACTIVE')} loading={statusState.isLoading} />
              ) : a.status === 'ACTIVE' ? (
                <Button
                  title="Vô hiệu hóa tài khoản"
                  variant="danger"
                  onPress={() => confirm('Vô hiệu hóa tài khoản?', `${a.username} sẽ không thể đăng nhập và đặt vé cho đến khi được kích hoạt lại.`, 'Vô hiệu hóa', () => changeStatus('INACTIVE'), true)}
                  loading={statusState.isLoading}
                />
              ) : null}
              <Button
                title="Thu hồi phiên đăng nhập"
                variant="secondary"
                onPress={() => confirm('Thu hồi phiên đăng nhập?', 'Khách sẽ bị đăng xuất khỏi mọi thiết bị.', 'Thu hồi', revokeAll)}
                loading={revokeState.isLoading}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
