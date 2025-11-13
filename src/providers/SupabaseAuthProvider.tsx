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
import { checkNetworkConnectivity } from '@/utils/networkCheck';

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
        // On iOS, check network connectivity first to avoid hanging
        if (isIOS && isDevelopment) {
          const isConnected = await checkNetworkConnectivity();
          if (!isConnected) {
            console.warn('Network not reachable on iOS, skipping auth initialization');
            setLoading(false);
            initializingRef.current = false;
            return;
          }
        }

        // On iOS, try to get cached session first for faster startup
        if (isIOS && isDevelopment) {
          // Check if we have a cached session without waiting for network
          const cachedSessionStr = await AsyncStorage.getItem('sb-auth-token').catch(() => null);
          if (cachedSessionStr) {
            try {
              const cachedSession = JSON.parse(cachedSessionStr);
              if (cachedSession?.currentSession) {
                // Set cached session immediately for fast UI response
                setSession(cachedSession.currentSession);
                setLoading(false);

                // Then verify session in background
                supabase.auth.getSession().then(({ data: { session } }) => {
                  if (session) {
                    setSession(session);
                    return buildAuthUser(session.user);
                  } else {
                    // Clear invalid cached session
                    setSession(null);
                    setUser(null);
                  }
                }).then(authUser => {
                  if (authUser) setUser(authUser);
                }).catch(err => {
                  console.warn('Background session refresh failed:', err);
                });

                initializingRef.current = false;
                return; // Exit early with cached session
              }
            } catch {}
          }
        }

        // Normal flow for non-iOS or no cached session
        const sessionFetchFn = () => withTimeout(
          supabase.auth.getSession(),
          getTimeout('session', Platform.OS, isDevelopment),
          'Timed out while checking the current session.',
        );

        const {
          data: { session: initialSession },
          error: sessionError,
        } = isIOS && isDevelopment
          ? await sessionFetchFn()  // No retry on iOS for faster failure
          : await withRetry(sessionFetchFn);

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
        const errorMessage = getErrorMessage(err);

        // On iOS timeout, don't show error - just let the user try to login
        if (isIOS && errorMessage.includes('Timed out')) {
          console.warn('Session check timed out on iOS, proceeding without session');
          setError(null); // Don't show timeout error on iOS
        } else {
          setError(errorMessage);
        }
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
