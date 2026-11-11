import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} size={size - 4} color={color as string} />
  ),
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarItemStyle: { borderRadius: 20, marginVertical: 5, marginHorizontal: 4, overflow: 'hidden' },
        // Floating pill bar: lists add bottom padding so their last row stays reachable.
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: 16,
          bottom: insets.bottom + 10,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingBottom: 0,
          ...shadow,
        },
      }}
    >
      <Tabs.Screen name="home" options={tab('Trang chủ', 'home-outline', 'home')} />
      <Tabs.Screen name="tickets" options={tab('Vé của tôi', 'ticket-outline', 'ticket')} />
      <Tabs.Screen name="profile" options={tab('Tài khoản', 'person-outline', 'person')} />
    </Tabs>
  );
}
