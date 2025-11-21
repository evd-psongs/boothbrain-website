import { useCallback } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { buildAuthUser } from '@/lib/auth/authUserBuilder';
import type { AuthUser, SignInData, SignUpData } from '@/types/auth';
import { checkNetworkConnectivity } from '@/utils/networkCheck';
import { withTimeout, withRetry, getTimeout } from '@/utils/asyncHelpers';

const isIOS = Platform.OS === 'ios';
const isDevelopment = __DEV__;

type AuthOperationsConfig = {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setUser: (user: AuthUser | null) => void;
};

/**
 * Hook providing auth operations (sign up, sign in, sign out, etc.)
 */
export function useAuthOperations({
  setLoading,
  setError,
  setSession,
  setUser,
}: AuthOperationsConfig) {
  const signUp = useCallback(
    async (data: SignUpData) => {
      setError(null);
      setLoading(true);

      try {
        const { data: response, error: signUpError } = await supabase.auth.signUp({
          email: data.email.toLowerCase().trim(),
          password: data.password,
          options: {
            data: {
              full_name: data.fullName?.trim(),
              business_name: data.businessName?.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;
        if (!response.user) throw new Error('Registration failed. Please try again.');

        setSession(response.session);
        if (response.session?.user) {
          const authUser = await buildAuthUser(response.session.user);
          setUser(authUser);
        }
      } catch (err: any) {
        console.error('Sign up error:', err);
        setError(err?.message ?? 'Failed to create account');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading, setSession, setUser]
  );

  const signIn = useCallback(
    async (data: SignInData) => {
      setError(null);
      setLoading(true);

      try {
        const { data: response, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email.toLowerCase().trim(),
          password: data.password,
        });

        if (signInError) throw signInError;
        if (!response.session) throw new Error('Sign in failed. Please check your credentials.');

        setSession(response.session);
        const authUser = await buildAuthUser(response.session.user);
        setUser(authUser);

        return { data: response, error: null };
      } catch (err: any) {
        console.error('Sign in error:', err);
        const message = err?.message ?? 'Failed to sign in';
        setError(message);
        return { data: null, error: err };
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading, setSession, setUser]
  );

  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      setSession(null);
      setUser(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err?.message ?? 'Failed to sign out');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setSession, setUser]);

  const resetPassword = useCallback(
    async (email: string) => {
      setError(null);
      setLoading(true);

      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.toLowerCase().trim()
        );
        if (resetError) throw resetError;
      } catch (err: any) {
        console.error('Password reset error:', err);
        setError(err?.message ?? 'Failed to send reset email');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      setError(null);
      setLoading(true);

      try {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
      } catch (err: any) {
        console.error('Password update error:', err);
        setError(err?.message ?? 'Failed to update password');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setError, setLoading]
  );

  const refreshSession = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const hasNetwork = await checkNetworkConnectivity();
      if (!hasNetwork) {
        throw new Error('No internet connection. Please check your network.');
      }

      const sessionFetchFn = () =>
        withTimeout(
          supabase.auth.refreshSession(),
          getTimeout('session', Platform.OS, isDevelopment),
          'Timed out while refreshing session.'
        );

      const { data, error: refreshError } = isIOS && isDevelopment
        ? await sessionFetchFn()
        : await withRetry(sessionFetchFn);

      if (refreshError) throw refreshError;
      if (!data.session) throw new Error('Failed to refresh session');

      setSession(data.session);
      const authUser = await buildAuthUser(data.session.user);
      setUser(authUser);
    } catch (err: any) {
      console.error('Session refresh error:', err);

      // On iOS timeout, don't show error
      if (isIOS && err?.message?.includes('Timed out')) {
        console.warn('Session refresh timed out on iOS');
      } else {
        setError(err?.message ?? 'Failed to refresh session');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading, setSession, setUser]);

  return {
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
  };
}