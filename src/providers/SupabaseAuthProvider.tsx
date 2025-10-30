import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { AuthUser, Profile, SignInData, SignUpData, Subscription } from '@/types/auth';
import { isPauseAllowanceUsed } from '@/utils/subscriptionPause';
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

// Use shorter timeouts on iOS to prevent infinite loading
const getTimeout = (type: 'session' | 'profile' | 'subscription') => {
  if (isIOS && isDevelopment) {
    // Shorter timeouts for iOS in development
    switch (type) {
      case 'session': return 3000; // 3s for initial session check
      case 'profile': return 5000; // 5s for profile
      case 'subscription': return 5000; // 5s for subscription
      default: return 5000;
    }
  }
  // Regular timeouts for other platforms
  return 10000;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelay = 500
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on timeout errors or if we're on the last attempt
      if (error.message?.includes('Timed out') || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const fetchFn = () => withTimeout(
      supabase.from('profiles').select('*').eq('id', userId).single(),
      getTimeout('profile'),
      'Timed out while loading profile.',
    );

    const { data, error } = isIOS && isDevelopment
      ? await fetchFn()  // No retry on iOS in dev for faster failure
      : await withRetry(fetchFn);

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name ?? null,
      avatarUrl: data.avatar_url ?? null,
      phone: data.phone ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      onboardingCompleted: Boolean(data.onboarding_completed),
      lastSeenAt: data.last_seen_at ?? null,
    };
  } catch (error: any) {
    // On iOS timeout, return null instead of throwing to allow app to load
    if (isIOS && error.message?.includes('Timed out')) {
      console.warn('Profile fetch timed out on iOS, continuing with null profile');
      return null;
    }
    throw error;
  }
}

async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const columns = `
    id,
    status,
    current_period_start,
    current_period_end,
    canceled_at,
    trial_ends_at,
    paused_at,
    pause_used_period_start,
    plan_id,
    plans:plan_id (
      id,
      name,
      tier,
      max_inventory_items,
      price_cents
    )
  `;

  try {
    const fetchFn = () => withTimeout(
      supabase
        .from('subscriptions')
        .select(columns)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getTimeout('subscription'),
      'Timed out while loading subscription.',
    );

    const { data, error } = isIOS && isDevelopment
      ? await fetchFn()  // No retry on iOS in dev for faster failure
      : await withRetry(fetchFn);

    if (error) {
      if (error.message?.includes('column subscriptions.user_id')) {
        console.warn('Skipping subscription lookup (missing user_id column).');
        return null;
      }
      throw error;
    }

    if (!data) return null;

    const raw = data as any;
    const planRow = Array.isArray(raw?.plans) ? raw.plans[0] : raw.plans;
    const pauseUsedPeriodStart: string | null = raw.pause_used_period_start ?? null;
    const currentPeriodStart: string | null = raw.current_period_start ?? null;

    const pauseAllowanceUsed = isPauseAllowanceUsed(currentPeriodStart, pauseUsedPeriodStart);

    return {
      id: raw.id,
      userId,
      status: raw.status,
      currentPeriodStart,
      currentPeriodEnd: raw.current_period_end,
      canceledAt: raw.canceled_at,
      trialEndsAt: raw.trial_ends_at,
      pausedAt: raw.paused_at,
      pauseUsedPeriodStart,
      pauseAllowanceUsed,
      plan: planRow
        ? {
            id: planRow.id as string,
            name: planRow.name as string,
            tier: planRow.tier as 'free' | 'pro' | 'enterprise',
            maxInventoryItems: (planRow.max_inventory_items ?? null) as number | null,
            currency: 'USD',
            priceCents: (planRow.tier === 'pro' ? 2700 : planRow.price_cents ?? null) as number | null,
            billingIntervalMonths: planRow.tier === 'pro' ? 3 : null,
          }
        : null,
    };
  } catch (error: any) {
    // On iOS timeout, return null instead of throwing to allow app to load
    if (isIOS && error.message?.includes('Timed out')) {
      console.warn('Subscription fetch timed out on iOS, continuing with null subscription');
      return null;
    }
    throw error;
  }
}

async function buildAuthUser(supabaseUser: User): Promise<AuthUser> {
  const [profile, subscription] = await Promise.all([
    fetchProfile(supabaseUser.id),
    fetchSubscription(supabaseUser.id),
  ]);

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? undefined,
    profile,
    subscription,
  };
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializingRef = useRef(true);

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
          getTimeout('session'),
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
      } catch (err: any) {
        console.error('Failed to initialize auth session', err);

        // On iOS timeout, don't show error - just let the user try to login
        if (isIOS && err?.message?.includes('Timed out')) {
          console.warn('Session check timed out on iOS, proceeding without session');
          setError(null); // Don't show timeout error on iOS
        } else {
          setError(err?.message ?? 'Failed to load session');
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
        } catch (err: any) {
          console.error('Failed to load user after auth change', err);
          setError(err?.message ?? 'Failed to load account data');
        }
      } else if (!initializingRef.current) {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    setError(null);
    setLoading(true);

    try {
      const { data: response, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (response.user) {
        const authUser = await buildAuthUser(response.user);
        setUser(authUser);
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to sign up';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (data: SignInData) => {
    setError(null);
    setLoading(true);

    try {
      const { data: response, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) {
        throw signInError;
      }

      if (!response.session || !response.user) {
        throw new Error('Invalid credentials');
      }

      const authUser = await buildAuthUser(response.user);
      setUser(authUser);
      setSession(response.session);
    } catch (err: any) {
      const message = err?.message ?? 'Failed to sign in';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
      setUser(null);
      setSession(null);
    } catch (err: any) {
      const message = err?.message ?? 'Failed to sign out';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        throw resetError;
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to send reset email';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw updateError;
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to update password';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const getSessionFn = () => withTimeout(
        supabase.auth.getSession(),
        getTimeout('session'),
        'Timed out while checking the current session.',
      );

      const {
        data: getData,
        error: getError,
      } = isIOS && isDevelopment
        ? await getSessionFn()
        : await withRetry(getSessionFn);

      if (getError) {
        throw getError;
      }

      let nextSession = getData.session ?? null;

      if (!nextSession?.user) {
        const refreshFn = () => withTimeout(
          supabase.auth.refreshSession(),
          getTimeout('session'),
          'Timed out while refreshing the session.',
        );

        const {
          data: refreshData,
          error: refreshError,
        } = isIOS && isDevelopment
          ? await refreshFn()
          : await withRetry(refreshFn);

        if (refreshError) {
          throw refreshError;
        }
        nextSession = refreshData.session ?? null;
      }

      setSession(nextSession);

      if (nextSession?.user) {
        const authUser = await buildAuthUser(nextSession.user);
        setUser(authUser);
      } else {
        setUser(null);
      }
    } catch (err: any) {
      const message = err?.message ?? 'Failed to refresh session';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
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
