import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { AuthUser, SignInData, SignUpData } from '@/types/auth';
import { getErrorMessage } from '@/types/database';
import { withTimeout, withRetry, getTimeout } from '@/utils/asyncHelpers';
import { buildAuthUser } from '@/lib/auth/authUserBuilder';
import { useAuthOperations } from '@/hooks/useAuthOperations';
import {
  initializeRevenueCat,
  logoutRevenueCat,
  addCustomerInfoUpdateListener,
  getCustomerInfo,
} from '@/lib/purchases/revenuecatService';
import { syncSubscriptionToSupabase } from '@/lib/purchases/subscriptionSync';

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (data: SignInData) => Promise<{ data: { session: Session | null } | null; error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isIOS = Platform.OS === 'ios';
const isDevelopment = __DEV__;

// Removed fetchProfile - now imported from @/lib/auth/profileService
// Removed fetchSubscription - now imported from @/lib/auth/subscriptionService
// Removed buildAuthUser - now imported from @/lib/auth/authUserBuilder

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(true);
  const customerInfoListenerCleanup = useRef<(() => void) | null>(null);

  // Use extracted auth operations hook
  const { signUp, signIn, signOut, resetPassword, updatePassword, refreshSession } =
    useAuthOperations({
      setLoading,
      setError,
      setSession,
      setUser,
    });

  useEffect(() => {
    const init = async () => {
      try {
        // On iOS in development (Expo Go), skip blocking session check
        // and rely on onAuthStateChange to set session asynchronously
        if (isIOS && isDevelopment) {
          console.log('📱 iOS Dev mode: Fast startup, session will load via onAuthStateChange');
          setLoading(false);
          initializingRef.current = false;
          return;
        }

        // Try to get cached session first for fast startup (works for both iOS and Android)
        const cachedSessionStr = await AsyncStorage.getItem('sb-auth-token').catch(() => null);
        if (cachedSessionStr) {
          try {
            const cachedData = JSON.parse(cachedSessionStr);
            // Handle both { currentSession: ... } format and raw Session object
            const cachedSession = cachedData.currentSession || cachedData;

            if (cachedSession?.access_token && cachedSession?.user) {
              console.log('📱 Found cached session in AsyncStorage');

              // IMPORTANT: Initialize Supabase client with the session!
              // Just setting React state isn't enough for the SDK to know we're logged in.
              const { error: restoreError } = await supabase.auth.setSession(cachedSession);

              if (restoreError) {
                console.warn('Failed to restore session to Supabase client:', restoreError.message);

                // Fallback: Try to use the refresh token directly
                if (cachedSession.refresh_token) {
                  console.log('🔄 Attempting to restore via refresh token...');
                  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                    refresh_token: cachedSession.refresh_token,
                  });

                  if (!refreshError && refreshData.session) {
                    // Update the cached session with the new one
                    setSession(refreshData.session);
                    await AsyncStorage.setItem('sb-auth-token', JSON.stringify(refreshData.session));

                    // Initialize RevenueCat for iOS
                    if (Platform.OS === 'ios') {
                      try {
                        await initializeRevenueCat(refreshData.session.user.id);
                      } catch (error) {
                        console.error('RevenueCat: Initialization failed on cache restore', error);
                      }
                    }

                    // We have a valid session now, so we can proceed to load the user
                    const authUser = await buildAuthUser(refreshData.session.user);
                    setUser(authUser);
                    setLoading(false);
                    initializingRef.current = false;
                    return;
                  } else {
                    console.warn('❌ Refresh token restore failed:', refreshError?.message);
                  }
                }
              }

              // Set cached session immediately for fast UI response
              setSession(cachedSession);
              setLoading(false);

              // Initialize RevenueCat for iOS (with cached session)
              if (Platform.OS === 'ios') {
                try {
                  await initializeRevenueCat(cachedSession.user.id);
                } catch (error) {
                  console.error('RevenueCat: Initialization failed on cache restore', error);
                }
              }

              // Try to refresh the session in background (Silent Token Refresh with timeout)
              try {
                const refreshResult = await withTimeout(
                  supabase.auth.refreshSession(),
                  getTimeout('session', Platform.OS, isDevelopment),
                  'Token refresh timed out'
                );

                if (refreshResult.data?.session) {
                  // Token refresh succeeded - user stays logged in
                  console.log('✅ Silent token refresh succeeded');
                  setSession(refreshResult.data.session);
                  const authUser = await buildAuthUser(refreshResult.data.session.user);
                  setUser(authUser);

                  // Update cache with fresh session
                  await AsyncStorage.setItem('sb-auth-token', JSON.stringify(refreshResult.data.session));
                } else if (refreshResult.error) {
                  console.warn('Token refresh failed:', refreshResult.error.message);
                  // Keep cached session - user can continue using app
                }
              } catch (refreshErr) {
                // Refresh timed out or failed - keep using cached session
                console.warn('Silent refresh failed, keeping cached session:', getErrorMessage(refreshErr));
                // User stays logged in with cached data
              }

              initializingRef.current = false;
              return; // Exit early with cached session
            }
          } catch (err) {
            console.warn('Failed to parse cached session:', err);
          }
        }

        // Normal flow for Android or no cached session
        const sessionFetchFn = () => withTimeout(
          supabase.auth.getSession(),
          getTimeout('session', Platform.OS, isDevelopment),
          'Timed out while checking the current session.',
        );

        const {
          data: { session: initialSession },
          error: sessionError,
        } = await withRetry(sessionFetchFn);

        if (sessionError) {
          throw sessionError;
        }

        setSession(initialSession);

        if (initialSession?.user) {
          const authUser = await buildAuthUser(initialSession.user);
          setUser(authUser);
        }
      } catch (err) {
        console.error('Failed to initialize auth session', err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        initializingRef.current = false;
      }
    };

    void init();
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);

      // Manually sync session to AsyncStorage for Expo Go persistence
      if (newSession) {
        try {
          await AsyncStorage.setItem('sb-auth-token', JSON.stringify(newSession));
        } catch (e) {
          console.warn('Failed to save session to storage', e);
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          await AsyncStorage.removeItem('sb-auth-token');
        } catch (e) {
          console.warn('Failed to remove session from storage', e);
        }

        // Logout RevenueCat on sign out
        if (Platform.OS === 'ios') {
          // Clean up listener before logout
          if (customerInfoListenerCleanup.current) {
            customerInfoListenerCleanup.current();
            customerInfoListenerCleanup.current = null;
          }
          await logoutRevenueCat();
        }
      }

      if (newSession?.user) {
        try {
          // Initialize RevenueCat for iOS users
          if (Platform.OS === 'ios') {
            try {
              await initializeRevenueCat(newSession.user.id);

              // Clean up old listener if exists (prevent memory leak)
              if (customerInfoListenerCleanup.current) {
                customerInfoListenerCleanup.current();
                customerInfoListenerCleanup.current = null;
              }

              // Setup listener for purchase updates and store cleanup function
              const cleanup = addCustomerInfoUpdateListener(async (customerInfo) => {
                console.log('[Auth] RevenueCat customer info updated');
                try {
                  await syncSubscriptionToSupabase(newSession.user.id, customerInfo);

                  // Refresh user data to reflect new subscription
                  const authUser = await buildAuthUser(newSession.user);
                  setUser(authUser);
                } catch (syncErr) {
                  console.error('[Auth] Failed to sync subscription after update:', syncErr);
                }
              });

              // Store cleanup function to prevent memory leaks
              customerInfoListenerCleanup.current = cleanup;

              // Sync existing subscription if any
              const customerInfo = await getCustomerInfo();
              await syncSubscriptionToSupabase(newSession.user.id, customerInfo);
            } catch (revenueCatErr) {
              console.error('[Auth] RevenueCat setup failed:', revenueCatErr);
              // Don't block login if RevenueCat fails
            }
          }

          const authUser = await buildAuthUser(newSession.user);
          setUser(authUser);
        } catch (err) {
          console.error('Failed to load user after auth change', err);
          setError(getErrorMessage(err));
        }
      } else if (!initializingRef.current) {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();

      // Clean up RevenueCat listener on unmount
      if (customerInfoListenerCleanup.current) {
        customerInfoListenerCleanup.current();
        customerInfoListenerCleanup.current = null;
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      error,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshSession,
      clearError,
    }),
    [user, session, loading, error, signUp, signIn, signOut, resetPassword, updatePassword, refreshSession, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}
