import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase configuration missing. Define EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

// iOS-specific optimizations for Expo Go
const isIOS = Platform.OS === 'ios';
const isDevelopment = __DEV__;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Reduce session refresh interval on iOS in development
    ...(isIOS && isDevelopment && {
      sessionRefreshIntervalMs: 120000, // 2 minutes instead of default
    }),
  },
  // Add global fetch options for iOS
  global: {
    ...(isIOS && {
      fetch: (url, init) => {
        // Add timeout to all fetch requests on iOS
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for individual requests

        return fetch(url, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    }),
  },
});
