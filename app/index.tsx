import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { useTheme } from '@/providers/ThemeProvider';

export default function IndexScreen() {
  const router = useRouter();
  const { user, loading } = useSupabaseAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/auth/sign-in');
    }
  }, [loading, user, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
