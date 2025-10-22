import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { AuthUser, Profile, SignInData, SignUpData, Subscription } from '@/types/auth';

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

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

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
    plan_id,
    plans:plan_id (
      id,
      name,
      tier,
      max_inventory_items,
      price_cents
    )
  `;

  const { data, error } = await supabase
    .from('subscriptions')
    .select(columns)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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

  return {
    id: raw.id,
    userId,
    status: raw.status,
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    canceledAt: raw.canceled_at,
    trialEndsAt: raw.trial_ends_at,
    pausedAt: raw.paused_at,
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
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

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
        setError(err?.message ?? 'Failed to load session');
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
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw refreshError;
      }

      const refreshedSession = data.session ?? null;
      setSession(refreshedSession);

      if (refreshedSession?.user) {
        const authUser = await buildAuthUser(refreshedSession.user);
        setUser(authUser);
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
