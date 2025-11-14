import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { AuthUser, SignInData, SignUpData } from '@/types/auth';
import { getErrorMessage } from '@/types/database';
import { withTimeout, withRetry, getTimeout } from '@/utils/asyncHelpers';
import { buildAuthUser } from '@/lib/auth/authUserBuilder';
import { useAuthOperations } from '@/hooks/useAuthOperations';
import { authenticateWithBiometrics, shouldUseBiometrics } from '@/utils/biometrics';

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (data: SignInData) => Promise<void>;
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

        // On iOS production or Android: try to get cached session first for fast startup
        if (isIOS) {
          const cachedSessionStr = await AsyncStorage.getItem('sb-auth-token').catch(() => null);
          if (cachedSessionStr) {
            try {
              const cachedSession = JSON.parse(cachedSessionStr);
              if (cachedSession?.currentSession) {
                // Set cached session immediately for fast UI response
                setSession(cachedSession.currentSession);
                setLoading(false);

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
                  } else if (refreshResult.error) {
                    console.warn('Token refresh failed:', refreshResult.error.message);
                    // Keep cached session - user can continue using app
                  }
                } catch (refreshErr) {
                  // Refresh timed out or failed - keep using cached session
                  console.warn('Silent refresh failed, keeping cached session:', getErrorMessage(refreshErr));
                  // User stays logged in with cached data
                  // They'll get a fresh token when they perform an action that requires auth
                }

                initializingRef.current = false;
                return; // Exit early with cached session
              }
            } catch (err) {
              console.warn('Failed to parse cached session:', err);
            }
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
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
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
    };
  }, []);

  // Biometric authentication on app resume
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      // When app comes to foreground and user is logged in
      if (nextAppState === 'active' && session && user) {
        const useBiometrics = await shouldUseBiometrics();

        if (useBiometrics) {
          // Temporarily hide sensitive content
          const tempSession = session;
          const tempUser = user;
          setSession(null);
          setUser(null);

          const result = await authenticateWithBiometrics();

          if (result.success) {
            // Restore session
            setSession(tempSession);
            setUser(tempUser);

            // Attempt silent token refresh to keep session alive (with timeout)
            try {
              const refreshResult = await withTimeout(
                supabase.auth.refreshSession(),
                getTimeout('session', Platform.OS, isDevelopment),
                'Token refresh timed out after biometric auth'
              );

              if (refreshResult.data?.session) {
                setSession(refreshResult.data.session);
                const authUser = await buildAuthUser(refreshResult.data.session.user);
                setUser(authUser);
              }
            } catch (err) {
              console.warn('Background refresh failed after biometric auth:', getErrorMessage(err));
              // Keep the cached session even if refresh fails
              setSession(tempSession);
              setUser(tempUser);
            }
          } else {
            // Biometric auth failed - sign out for security
            console.warn('Biometric authentication failed:', result.error);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
          }
        }
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [session, user]);

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
