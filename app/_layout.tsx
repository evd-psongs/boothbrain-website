import { useEffect } from 'react';
import { Stack } from 'expo-router';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { SupabaseAuthProvider } from '@/providers/SupabaseAuthProvider';
import { SessionProvider } from '@/providers/SessionProvider';
import { ensureSentry, isSentryEnabled, withSentryWrap } from '@/lib/monitoring';

function RootLayout() {
  useEffect(() => {
    if (isSentryEnabled) {
      void ensureSentry();
    }
  }, []);

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

export default isSentryEnabled ? withSentryWrap(RootLayout) : RootLayout;
