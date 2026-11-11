import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { signOut } from '@/store/authSlice';
import { colors, radius, spacing } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuCard({ icon, title, description, onPress }: { icon: IconName; title: string; description: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText style={{ fontSize: 14, fontWeight: '700' }}>{title}</AppText>
        <AppText variant="caption">{description}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

export default function AdminHome() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: 2 }}>
          <AppText variant="label" style={{ color: colors.primary }}>CinePrime · Quản trị</AppText>
          <AppText variant="title">Xin chào, {user?.username}</AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Phim và lịch chiếu</AppText>
          <MenuCard icon="cloud-download-outline" title="Nhập phim từ TMDB" description="Tự điền thông tin phim, lưu thành bản chờ duyệt" onPress={() => router.push('/admin/tmdb')} />
          <MenuCard icon="film-outline" title="Phim" description="Kiểm tra, sửa và duyệt phim; lưu trữ phim hết khai thác" onPress={() => router.push('/admin/movies')} />
          <MenuCard icon="business-outline" title="Kế hoạch phát hành" description="Mở quyền khai thác phim tại từng rạp" onPress={() => router.push('/admin/release-plans')} />
          <MenuCard icon="git-network-outline" title="Tạo suất chiếu tự động" description="Chọn phim, rạp, ngày; xem báo cáo ứng viên" onPress={() => router.push('/admin/scheduling')} />
          <MenuCard icon="calendar-outline" title="Lịch chiếu" description="Mở bán, tạm dừng hoặc huỷ từng suất theo rạp" onPress={() => router.push('/admin/schedule')} />
          <MenuCard icon="pricetags-outline" title="Bảng giá vé" description="Giá theo ngày trong tuần, khung giờ, 2D/3D và hạng ghế" onPress={() => router.push('/admin/prices')} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Vận hành</AppText>
          <MenuCard icon="receipt-outline" title="Đặt vé" description="Theo dõi đơn đặt vé và thanh toán" onPress={() => router.push('/admin/bookings')} />
          <MenuCard icon="people-outline" title="Khách hàng" description="Tìm kiếm, vô hiệu hoá, thu hồi phiên đăng nhập" onPress={() => router.push('/admin/customers')} />
        </View>

        <Button title="Đăng xuất" variant="secondary" onPress={() => dispatch(signOut())} />
      </ScrollView>
    </Screen>
  );
}
