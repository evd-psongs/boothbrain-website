import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import type { SubscriptionPlanTier } from '@/types/auth';
import type {
  ActiveSession,
  CreateSessionOptions,
  JoinSessionOptions,
  JoinSessionResult,
} from '@/types/session';
import { getErrorMessage } from '@/types/database';
import { restoreSession, persistSession, clearStoredSession } from '@/lib/session/sessionStorage';
import { normalizePlanTier } from '@/lib/session/sessionApi';
import { useSessionOperations } from '@/hooks/useSessionOperations';

export type { ActiveSession, JoinSessionResult } from '@/types/session';
export { SESSION_CODE_LENGTH } from '@/types/session';

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuth();
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use extracted session operations hook
  const { createSession, joinSession, endSession, refreshSession, clearError } =
    useSessionOperations({
      user,
      currentSession,
      setCurrentSession,
      setLoading,
      setError,
    });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!user) {
          await clearStoredSession();
          setCurrentSession(null);
          return;
        }

        const restoredSession = await restoreSession();
        if (restoredSession) {
          // Update host plan information if this is the host's session
          if (restoredSession.isHost && restoredSession.hostUserId === user.id) {
            const updatedSession: ActiveSession = {
              ...restoredSession,
              hostPlanTier: normalizePlanTier(user.subscription?.plan?.tier),
              hostPlanPaused: false,
            };
            setCurrentSession(updatedSession);
            await persistSession(updatedSession);
          } else {
            setCurrentSession(restoredSession);
          }
        } else {
          setCurrentSession(null);
        }
      } catch (err) {
        console.error('Failed to restore session', err);
        setError(getErrorMessage(err));
        setCurrentSession(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [user]);

  const sharedOwnerId = currentSession ? currentSession.hostUserId : user?.id ?? null;
  const sharedPlanTier: SubscriptionPlanTier = currentSession
    ? currentSession.hostPlanTier
    : normalizePlanTier(user?.subscription?.plan?.tier);
  const sharedPlanPaused = currentSession ? currentSession.hostPlanPaused : false;

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
