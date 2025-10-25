import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import type { SubscriptionPlanTier } from '@/types/auth';

const SESSION_STORAGE_KEY = 'boothbrain_current_session';
const DEVICE_ID_STORAGE_KEY = 'boothbrain_device_id';

const normalizePlanTier = (value: string | null | undefined): SubscriptionPlanTier => {
  if (value === 'pro' || value === 'enterprise' || value === 'free') {
    return value;
  }
  return 'free';
};

export type ActiveSession = {
  code: string;
  sessionId: string | null;
  hostUserId: string;
  eventId: string;
  hostDeviceId: string;
  createdAt: string;
  isHost: boolean;
  hostPlanTier: SubscriptionPlanTier;
  hostPlanPaused: boolean;
};

type SessionContextValue = {
  currentSession: ActiveSession | null;
  loading: boolean;
  error: string | null;
  createSession: () => Promise<ActiveSession>;
  joinSession: (code: string) => Promise<ActiveSession>;
  endSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  sharedOwnerId: string | null;
  sharedPlanTier: SubscriptionPlanTier;
  sharedPlanPaused: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const generateSessionCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const getDeviceId = async () => {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const fallback = `${Device.modelName ?? 'device'}_${Device.osName ?? 'os'}_${Date.now()}`.replace(/\s/g, '_');
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, fallback);
    return fallback;
  } catch (error) {
    console.warn('Failed to access device ID storage', error);
    return `device_${Date.now()}`;
  }
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!user) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          setCurrentSession(null);
          return;
        }

        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
          setCurrentSession(null);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<ActiveSession>;

        const createdAt = new Date(parsed.createdAt ?? 0);
        const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed > 72) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          setCurrentSession(null);
          return;
        }

        const hostPlanTier = normalizePlanTier(
          parsed.hostPlanTier ?? user?.subscription?.plan?.tier ?? 'free',
        );
        const hostPlanPaused =
          parsed.hostPlanPaused ?? Boolean(user?.subscription?.pausedAt ?? false);

        setCurrentSession({
          code: parsed.code ?? '',
          sessionId: parsed.sessionId ?? null,
          eventId: parsed.eventId ?? '',
          hostUserId: parsed.hostUserId ?? (user?.id ?? ''),
          hostDeviceId: parsed.hostDeviceId ?? '',
          createdAt: parsed.createdAt ?? new Date().toISOString(),
          isHost: Boolean(parsed.isHost),
          hostPlanTier,
          hostPlanPaused,
        });
      } catch (err: any) {
        console.error('Failed to restore session', err);
        setError('Failed to restore session');
        setCurrentSession(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [user]);

  const persistSession = useCallback(async (session: ActiveSession | null) => {
    if (session) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const createSession = useCallback(async (): Promise<ActiveSession> => {
    if (!user) {
      throw new Error('You must be signed in to start a session.');
    }
    setError(null);
    setLoading(true);

    try {
      const hostDeviceId = await getDeviceId();
      let code = generateSessionCode();
      let attempts = 0;

      while (attempts < 5) {
        const { data: existing } = await supabase.from('sessions').select('code').eq('code', code).maybeSingle();
        if (!existing) break;
        code = generateSessionCode();
        attempts += 1;
      }

      const eventId = `event_${code}_${Date.now()}`;

      const { data: inserted, error: insertError } = await supabase
        .from('sessions')
        .insert({
          code,
          event_id: eventId,
          host_user_id: user.id,
          host_device_id: hostDeviceId,
        })
        .select('id, event_id, host_device_id, created_at')
        .single();

      if (insertError) {
        throw insertError;
      }

      const sessionRow = inserted ?? null;

      const hostPlanTier = normalizePlanTier(user.subscription?.plan?.tier);
      const hostPlanPaused = Boolean(user.subscription?.pausedAt);

      const session: ActiveSession = {
        code,
        sessionId: sessionRow?.id ?? null,
        eventId: sessionRow?.event_id ?? eventId,
        hostUserId: user.id,
        hostDeviceId: sessionRow?.host_device_id ?? hostDeviceId,
        createdAt: sessionRow?.created_at ?? new Date().toISOString(),
        isHost: true,
        hostPlanTier,
        hostPlanPaused,
      };

      setCurrentSession(session);
      await persistSession(session);

      return session;
    } catch (err: any) {
      const message = err?.message ?? 'Failed to create session';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [user, persistSession]);

  const joinSession = useCallback(
    async (code: string): Promise<ActiveSession> => {
      if (!user) {
        throw new Error('You must be signed in to join a session.');
      }
      setError(null);
      setLoading(true);

      try {
        const normalizedCode = code.trim().toUpperCase();
        if (!normalizedCode) {
          throw new Error('Enter a session code to join.');
        }

        const { data, error: fetchError } = await supabase.rpc('join_session_simple', {
          session_code: normalizedCode,
        });

        if (fetchError) {
          throw fetchError;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          throw new Error('Session not found. Check the code and try again.');
        }

        const session: ActiveSession = {
          code: row.code,
          sessionId: row.session_id ?? null,
          eventId: row.event_id,
          hostUserId: row.host_user_id,
          hostDeviceId: row.host_device_id,
          createdAt: row.created_at,
          isHost: row.host_user_id === user.id,
          hostPlanTier: normalizePlanTier(row.host_plan_tier),
          hostPlanPaused: Boolean(row.host_plan_paused),
        };

        setCurrentSession(session);
        await persistSession(session);

        return session;
      } catch (err: any) {
        const message = err?.message ?? 'Failed to join session';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [user, persistSession],
  );

  const endSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (currentSession) {
        try {
          await supabase.rpc('leave_session', { session_code: currentSession.code });
        } catch {
          // ignore
        }
      }
      setCurrentSession(null);
      await persistSession(null);
    } finally {
      setLoading(false);
    }
  }, [persistSession, currentSession]);

  const refreshSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      const { data, error: fetchError } = await supabase.rpc('join_session_simple', {
        session_code: currentSession.code,
      });

      if (fetchError) {
        await endSession();
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        await endSession();
        return;
      }

      const session: ActiveSession = {
        code: row.code,
        sessionId: row.session_id ?? null,
        eventId: row.event_id,
        hostUserId: row.host_user_id,
        hostDeviceId: row.host_device_id,
        createdAt: row.created_at,
        isHost: user?.id === row.host_user_id,
        hostPlanTier: normalizePlanTier(row.host_plan_tier),
        hostPlanPaused: Boolean(row.host_plan_paused),
      };

      setCurrentSession(session);
      await persistSession(session);
    } catch (err: any) {
      console.error('Failed to refresh session', err);
      setError('Failed to refresh session');
    }
  }, [currentSession, user?.id, endSession, persistSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sharedOwnerId = currentSession ? currentSession.hostUserId : user?.id ?? null;
  const sharedPlanTier: SubscriptionPlanTier = currentSession
    ? currentSession.hostPlanTier
    : normalizePlanTier(user?.subscription?.plan?.tier);
  const sharedPlanPaused = currentSession ? currentSession.hostPlanPaused : Boolean(user?.subscription?.pausedAt);

  const value = useMemo<SessionContextValue>(
    () => ({
      currentSession,
      loading,
      error,
      createSession,
      joinSession,
      endSession,
      refreshSession,
      clearError,
      sharedOwnerId,
      sharedPlanTier,
      sharedPlanPaused,
    }),
    [
      currentSession,
      loading,
      error,
      createSession,
      joinSession,
      endSession,
      refreshSession,
      clearError,
      sharedOwnerId,
      sharedPlanTier,
      sharedPlanPaused,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}
