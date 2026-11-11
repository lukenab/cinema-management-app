import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppText, Button, Chip, Input, Screen } from '@/components/ui';
import { useAppSelector } from '@/store';
import { queryErrorMessage, useUpdateProfileMutation } from '@/store/api';
import { colors, spacing } from '@/theme';

// Values are what the backend stores; labels are what the customer sees.
const GENDERS = [
  { value: 'Male', label: 'Nam' },
  { value: 'Female', label: 'Nữ' },
  { value: 'Other', label: 'Khác' },
];

/** Booking needs a complete profile (name, phone, date of birth, gender). */
export default function CompleteProfile() {
  const user = useAppSelector((s) => s.auth.user);
  const [update, state] = useUpdateProfileMutation();
  const [form, setForm] = useState({ fullName: '', phoneNumber: '', dob: '', gender: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validDob = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && date < new Date();
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!form.fullName.trim()) next.fullName = 'Vui lòng nhập họ tên';
    else if (form.fullName.trim().length > 50) next.fullName = 'Tối đa 50 ký tự';
    if (!/^(0|\+84)[0-9]{9,10}$/.test(form.phoneNumber.trim())) next.phoneNumber = 'Số điện thoại không hợp lệ (ví dụ 0901234567)';
    if (!validDob(form.dob.trim())) next.dob = 'Nhập theo định dạng YYYY-MM-DD';
    if (!form.gender) next.gender = 'Vui lòng chọn giới tính';
    setErrors(next);
    if (Object.keys(next).length || !user) return;

    const res = await update({
      accountId: user.accountId,
      body: { fullName: form.fullName.trim(), phoneNumber: form.phoneNumber.trim(), dateOfBirth: form.dob.trim(), gender: form.gender },
    });
    if ('error' in res) {
      const text = queryErrorMessage(res.error, 'Không thể lưu hồ sơ.');
      setErrors(text.toLowerCase().includes('phone') ? { phoneNumber: text } : { general: text });
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title">Hoàn thiện hồ sơ</AppText>
            <AppText variant="caption">Chúng tôi cần một vài thông tin trước khi bạn đặt vé.</AppText>
          </View>
          <Input label="Họ và tên" value={form.fullName} onChangeText={set('fullName')} autoCapitalize="words" error={errors.fullName} />
          <Input label="Số điện thoại" value={form.phoneNumber} onChangeText={set('phoneNumber')} keyboardType="phone-pad" error={errors.phoneNumber} />
          <Input label="Ngày sinh (YYYY-MM-DD)" value={form.dob} onChangeText={set('dob')} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="2000-01-31" error={errors.dob} />
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">Giới tính</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {GENDERS.map((g) => (
                <Chip key={g.value} label={g.label} selected={form.gender === g.value} onPress={() => set('gender')(g.value)} />
              ))}
            </View>
            {errors.gender ? <AppText variant="caption" style={{ color: colors.danger }}>{errors.gender}</AppText> : null}
          </View>
          {errors.general ? <AppText variant="caption" style={{ color: colors.danger }}>{errors.general}</AppText> : null}
          <Button title="Lưu và tiếp tục" onPress={submit} loading={state.isLoading} />
          <Button title="Huỷ" onPress={() => router.back()} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
