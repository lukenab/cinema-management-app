import { View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { useAppDispatch } from '@/store';
import { signOut } from '@/store/authSlice';
import { spacing } from '@/theme';

export default function Unsupported() {
  const dispatch = useAppDispatch();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
        <AppText variant="title">Tài khoản chưa được hỗ trợ</AppText>
        <AppText variant="caption">
          Ứng dụng dành cho khách hàng và quản trị viên. Vui lòng dùng cổng web CinePrime cho loại tài khoản này.
        </AppText>
        <Button title="Đăng xuất" onPress={() => dispatch(signOut())} variant="secondary" />
      </View>
    </Screen>
  );
}
