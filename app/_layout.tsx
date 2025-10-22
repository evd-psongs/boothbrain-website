import { Stack } from 'expo-router';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { SupabaseAuthProvider } from '@/providers/SupabaseAuthProvider';
import { SessionProvider } from '@/providers/SessionProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SupabaseAuthProvider>
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </SupabaseAuthProvider>
    </ThemeProvider>
  );
}
