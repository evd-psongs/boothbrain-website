import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { SupabaseAuthProvider } from '@/providers/SupabaseAuthProvider';
import { SessionProvider } from '@/providers/SessionProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initializeCrashlytics } from '@/lib/services/firebase';
import { useCrashlyticsUser } from '@/hooks/useCrashlyticsUser';

function AppWithCrashlytics() {
  // Sync user authentication with Crashlytics
  useCrashlyticsUser();

  return (
    <SessionProvider>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize Firebase Crashlytics when app starts
    initializeCrashlytics();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SupabaseAuthProvider>
          <AppWithCrashlytics />
        </SupabaseAuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
