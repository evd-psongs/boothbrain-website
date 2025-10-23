import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/providers/ThemeProvider';

const TAB_ICON_MAP = {
  home: 'home',
  sale: 'shopping-bag',
  inventory: 'box',
  orders: 'shopping-bag',
  reports: 'bar-chart-2',
  settings: 'settings',
} as const;

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName = TAB_ICON_MAP[route.name as keyof typeof TAB_ICON_MAP] ?? 'circle';
          return <Feather name={iconName} color={color} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="sale" options={{ title: 'Sale' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
