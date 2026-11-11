import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Input, Screen } from '@/components/ui';
import { useAppDispatch } from '@/store';
import { queryErrorMessage, useRegisterMutation, type ApiQueryError } from '@/store/api';
import { signIn } from '@/store/authSlice';
import { colors, spacing } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signingIn, setSigningIn] = useState(false);
  const [register, registerState] = useRegisterMutation();

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (form.username.trim().length < 5) next.username = 'Tối thiểu 5 ký tự';
    else if (!/^[a-zA-Z0-9_]+$/.test(form.username.trim())) next.username = 'Chỉ gồm chữ cái, chữ số và dấu gạch dưới';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Email không hợp lệ';
    if (form.password.length < 8) next.password = 'Tối thiểu 8 ký tự';
    if (form.password !== form.confirm) next.confirm = 'Mật khẩu nhập lại không khớp';
    setErrors(next);
    if (Object.keys(next).length) return;

    const username = form.username.trim();
    const res = await register({ username, email: form.email.trim(), password: form.password });
    if ('error' in res) {
      const error = res.error as ApiQueryError;
      const message = queryErrorMessage(error, 'Đăng ký không thành công.');
      const field = (error.result as { field?: string } | undefined)?.field;
      setErrors(field && ['username', 'email', 'password'].includes(field) ? { [field]: message } : { general: message });
      return;
    }

    // Signed in straight away: the route guard then leaves the auth screens.
    setSigningIn(true);
    try {
      await dispatch(signIn({ username, password: form.password })).unwrap();
    } catch {
      setSigningIn(false);
      router.replace('/login');
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
            <AppText variant="title">Tạo tài khoản</AppText>
            <AppText variant="caption">Điền thông tin để bắt đầu đặt vé.</AppText>
          </View>

          <Input label="Tên đăng nhập" value={form.username} onChangeText={set('username')} error={errors.username} />
          <Input label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoComplete="email" error={errors.email} />
          <Input label="Mật khẩu" value={form.password} onChangeText={set('password')} secureTextEntry error={errors.password} />
          <Input label="Nhập lại mật khẩu" value={form.confirm} onChangeText={set('confirm')} secureTextEntry error={errors.confirm} />
          {errors.general ? <AppText variant="caption" style={{ color: colors.danger }}>{errors.general}</AppText> : null}
          <Button title="Tạo tài khoản" onPress={submit} loading={registerState.isLoading || signingIn} />

          <Pressable onPress={() => router.back()}>
            <AppText variant="caption" style={{ textAlign: 'center' }}>Quay lại đăng nhập</AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
