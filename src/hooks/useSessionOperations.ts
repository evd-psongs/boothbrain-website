import { useCallback } from 'react';
import type { AuthUser } from '@/types/auth';
import type {
  ActiveSession,
  CreateSessionOptions,
  JoinSessionOptions,
  JoinSessionResult,
} from '@/types/session';
import { getErrorMessage } from '@/types/database';
import { persistSession, clearStoredSession } from '@/lib/session/sessionStorage';
import {
  createSessionApi,
  joinSessionApi,
  endSessionApi,
  refreshSessionApi,
  normalizePlanTier,
} from '@/lib/session/sessionApi';

type SessionOperationsConfig = {
  user: AuthUser | null;
  currentSession: ActiveSession | null;
  setCurrentSession: (session: ActiveSession | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

/**
 * Hook providing session operations (create, join, end, refresh)
 */
export function useSessionOperations({
  user,
  currentSession,
  setCurrentSession,
  setLoading,
  setError,
}: SessionOperationsConfig) {
  const createSession = useCallback(
    async (options?: CreateSessionOptions): Promise<ActiveSession> => {
      if (!user) {
        throw new Error('You must be signed in to start a session.');
      }

      setError(null);
      setLoading(true);

      try {
        const userPlanTier = user.subscription?.plan?.tier;
        const userPlanPaused = false;

        const session = await createSessionApi(
          user.id,
          userPlanTier,
          userPlanPaused,
          options
        );

        setCurrentSession(session);
        await persistSession(session);

        return session;
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [user, setCurrentSession, setError, setLoading]
  );

  const joinSession = useCallback(
    async (code: string, options?: JoinSessionOptions): Promise<JoinSessionResult> => {
      if (!user) {
        throw new Error('You must be signed in to join a session.');
      }

      setError(null);
      setLoading(true);

      try {
        const result = await joinSessionApi(code, user.id, options);

        if (result.status === 'approved' && result.session) {
          setCurrentSession(result.session);
          await persistSession(result.session);
        }

        return result;
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [user, setCurrentSession, setError, setLoading]
  );

  const endSession = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      if (currentSession && user) {
        await endSessionApi(currentSession.sessionId, user.id);
      }

      setCurrentSession(null);
      await clearStoredSession();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [currentSession, user, setCurrentSession, setError, setLoading]);

  const refreshSession = useCallback(async () => {
    if (!currentSession?.sessionId) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const refreshedData = await refreshSessionApi(currentSession.sessionId);

      if (!refreshedData) {
        // Session no longer exists
        setCurrentSession(null);
        await clearStoredSession();
        return;
      }

      const updated: ActiveSession = {
        ...currentSession,
        hostPlanTier: normalizePlanTier(refreshedData.host_plan_tier),
        hostPlanPaused: refreshedData.host_plan_paused ?? false,
      };

      setCurrentSession(updated);
      await persistSession(updated);
    } catch (err) {
      console.error('Failed to refresh session:', err);
      setError('Failed to refresh session');
    } finally {
      setLoading(false);
    }
  }, [currentSession, setCurrentSession, setError, setLoading]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    createSession,
    joinSession,
    endSession,
    refreshSession,
    clearError,
  };
}