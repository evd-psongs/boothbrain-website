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
  requiresPassphrase: boolean;
  approvalRequired: boolean;
};

type CreateSessionOptions = {
  passphrase?: string;
  approvalRequired?: boolean;
};

type JoinSessionOptions = {
  passphrase?: string;
};

export type JoinSessionResult = {
  status: 'approved' | 'pending';
  session: ActiveSession | null;
  message?: string;
};

type SessionContextValue = {
  currentSession: ActiveSession | null;
  loading: boolean;
  error: string | null;
  createSession: (options?: CreateSessionOptions) => Promise<ActiveSession>;
  joinSession: (code: string, options?: JoinSessionOptions) => Promise<JoinSessionResult>;
  endSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  sharedOwnerId: string | null;
  sharedPlanTier: SubscriptionPlanTier;
  sharedPlanPaused: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SESSION_CODE_LENGTH = 12;

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
          requiresPassphrase: Boolean(parsed.requiresPassphrase),
          approvalRequired: parsed.approvalRequired ?? true,
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

  const createSession = useCallback(async (options?: CreateSessionOptions): Promise<ActiveSession> => {
    if (!user) {
      throw new Error('You must be signed in to start a session.');
    }
    setError(null);
    setLoading(true);

    try {
      const hostDeviceId = await getDeviceId();
      const trimmedPassphrase = options?.passphrase?.trim() ?? '';
      const approvalRequired = options?.approvalRequired ?? true;

      const { data, error: rpcError } = await supabase.rpc('create_session_secure', {
        host_device_identifier: hostDeviceId,
        passphrase: trimmedPassphrase.length ? trimmedPassphrase : null,
        require_host_approval: approvalRequired,
      });

      if (rpcError) {
        throw rpcError;
      }

      const sessionRow = (Array.isArray(data) ? data[0] : data) ?? null;

      if (!sessionRow) {
        throw new Error('Failed to create session.');
      }

      const hostPlanTier = normalizePlanTier(user.subscription?.plan?.tier);
      const hostPlanPaused = Boolean(user.subscription?.pausedAt);

      const session: ActiveSession = {
        code: sessionRow.code,
        sessionId: sessionRow.id ?? null,
        eventId: sessionRow.event_id,
        hostUserId: sessionRow.host_user_id ?? user.id,
        hostDeviceId: sessionRow.host_device_id ?? hostDeviceId,
        createdAt: sessionRow.created_at ?? new Date().toISOString(),
        isHost: true,
        hostPlanTier,
        hostPlanPaused,
        requiresPassphrase: Boolean(sessionRow.requires_passphrase),
        approvalRequired: Boolean(sessionRow.approval_required ?? true),
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
    async (code: string, options?: JoinSessionOptions): Promise<JoinSessionResult> => {
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

        const deviceId = await getDeviceId();
        const trimmedPassphrase = options?.passphrase?.trim() ?? '';

        const { data, error: fetchError } = await supabase.rpc('join_session_simple', {
          session_code: normalizedCode,
          client_device_id: deviceId,
          host_passphrase: trimmedPassphrase.length ? trimmedPassphrase : null,
        });

        if (fetchError) {
          setError(fetchError.message ?? 'Failed to join session');
          throw fetchError;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          throw new Error('Session not found. Check the code and try again.');
        }

        const joinStatus = (row.join_status ?? 'pending') as 'approved' | 'pending';

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
          requiresPassphrase: Boolean(row.requires_passphrase),
          approvalRequired: Boolean(row.approval_required ?? true),
        };

        if (joinStatus === 'approved') {
          setCurrentSession(session);
          await persistSession(session);
          return { status: 'approved', session };
        }

        return {
          status: 'pending',
          session: null,
          message: 'Join request sent to the host. You will appear once approved.',
        };
      } catch (err: any) {
        const message = err?.message ?? 'Failed to join session';
        setError(message);
        throw err;
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
        if (currentSession.isHost) {
          try {
            await supabase.from('sessions').delete().eq('code', currentSession.code);
          } catch {
            // ignore
          }
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
      const deviceId = await getDeviceId();
      const { data, error: fetchError } = await supabase.rpc('join_session_simple', {
        session_code: currentSession.code,
        client_device_id: deviceId,
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
        requiresPassphrase: Boolean(row.requires_passphrase),
        approvalRequired: Boolean(row.approval_required ?? true),
      };

      if (row.join_status && row.join_status !== 'approved') {
        await endSession();
        return;
      }

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
