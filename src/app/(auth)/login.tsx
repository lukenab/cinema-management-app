import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Input, Screen } from '@/components/ui';
import { getErrorMessage } from '@/lib/apiClient';
import { areaForUser, userFromToken } from '@/lib/jwt';
import { useAppDispatch } from '@/store';
import { signIn } from '@/store/authSlice';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await dispatch(signIn({ username: username.trim(), password })).unwrap();
      // Customers return to what they were doing (e.g. seat selection); other areas start from "/".
      const area = areaForUser(userFromToken(token));
      if (area === 'customer' && router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(getErrorMessage(e, 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
            <AppText variant="label" style={{ color: colors.primary }}>CinePrime</AppText>
            <AppText variant="title">Chào mừng trở lại</AppText>
            <AppText variant="caption">Đăng nhập để đặt vé, thanh toán và xem vé của bạn.</AppText>
          </View>

          <Input label="Tên đăng nhập" value={username} onChangeText={setUsername} autoComplete="username" returnKeyType="next" />
          <Input label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
          {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}

          <Button title="Đăng nhập" onPress={submit} loading={loading} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs }}>
            <AppText variant="caption">Chưa có tài khoản?</AppText>
            <Link href="/register" asChild>
              <Pressable><AppText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Đăng ký ngay</AppText></Pressable>
            </Link>
          </View>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <AppText variant="caption" style={{ textAlign: 'center' }}>Tiếp tục với tư cách khách</AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
