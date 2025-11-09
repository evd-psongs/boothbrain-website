import { supabase } from '@/lib/supabase';
import { getDeviceId } from './deviceIdService';
import type {
  ActiveSession,
  CreateSessionOptions,
  JoinSessionOptions,
  JoinSessionResult,
  SessionRow,
} from '@/types/session';
import type { SubscriptionPlanTier } from '@/types/auth';

/**
 * Normalizes a plan tier string to a valid SubscriptionPlanTier
 */
export function normalizePlanTier(value: string | null | undefined): SubscriptionPlanTier {
  if (value === 'pro' || value === 'enterprise' || value === 'free') {
    return value;
  }
  return 'free';
}

/**
 * Creates a new session
 * @param userId The user creating the session
 * @param userPlanTier The user's subscription plan tier
 * @param userPlanPaused Whether the user's subscription is paused
 * @param options Session creation options
 * @returns The created session
 */
export async function createSessionApi(
  userId: string,
  userPlanTier: SubscriptionPlanTier | undefined,
  userPlanPaused: boolean,
  options?: CreateSessionOptions
): Promise<ActiveSession> {
  const hostDeviceId = await getDeviceId();
  const trimmedPassphrase = options?.passphrase?.trim() ?? '';
  const approvalRequired = options?.approvalRequired ?? true;

  const { data, error } = await supabase.rpc('create_session_secure', {
    host_device_identifier: hostDeviceId,
    passphrase: trimmedPassphrase.length ? trimmedPassphrase : null,
    require_host_approval: approvalRequired,
  });

  if (error) {
    throw error;
  }

  const sessionRow = (Array.isArray(data) ? data[0] : data) as SessionRow | null;

  if (!sessionRow) {
    throw new Error('Failed to create session.');
  }

  const hostPlanTier = normalizePlanTier(userPlanTier);
  const hostPlanPaused = userPlanPaused;

  return {
    code: sessionRow.code,
    sessionId: sessionRow.id ?? null,
    eventId: sessionRow.event_id,
    hostUserId: sessionRow.host_user_id ?? userId,
    hostDeviceId: sessionRow.host_device_id ?? hostDeviceId,
    createdAt: sessionRow.created_at ?? new Date().toISOString(),
    isHost: true,
    hostPlanTier,
    hostPlanPaused,
    requiresPassphrase: Boolean(sessionRow.requires_passphrase),
    approvalRequired: Boolean(sessionRow.approval_required ?? true),
  };
}

/**
 * Joins an existing session
 * @param code The session code to join
 * @param userId The user joining the session
 * @param options Join options
 * @returns The join result
 */
export async function joinSessionApi(
  code: string,
  userId: string,
  options?: JoinSessionOptions
): Promise<JoinSessionResult> {
  const deviceId = await getDeviceId();
  const trimmedCode = code.trim().toUpperCase();
  const trimmedPassphrase = options?.passphrase?.trim() ?? '';

  const { data, error } = await supabase.rpc('join_session_secure', {
    p_code: trimmedCode,
    p_device_identifier: deviceId,
    p_passphrase: trimmedPassphrase.length ? trimmedPassphrase : null,
  });

  if (error) {
    if (error.message?.includes('Invalid passphrase')) {
      throw new Error('Invalid passphrase. Please check and try again.');
    }
    if (error.message?.includes('requires host approval')) {
      return {
        status: 'pending',
        session: null,
        message: 'Waiting for host approval. Please ask the host to approve your request.',
      };
    }
    throw error;
  }

  const sessionRow = (Array.isArray(data) ? data[0] : data) as SessionRow | null;

  if (!sessionRow) {
    throw new Error('Session not found or expired.');
  }

  const hostPlanTier = normalizePlanTier(sessionRow.host_plan_tier);
  const hostPlanPaused = sessionRow.host_plan_paused ?? false;

  const session: ActiveSession = {
    code: sessionRow.code,
    sessionId: sessionRow.id ?? null,
    eventId: sessionRow.event_id,
    hostUserId: sessionRow.host_user_id ?? '',
    hostDeviceId: sessionRow.host_device_id ?? '',
    createdAt: sessionRow.created_at ?? new Date().toISOString(),
    isHost: false,
    hostPlanTier,
    hostPlanPaused,
    requiresPassphrase: Boolean(sessionRow.requires_passphrase),
    approvalRequired: Boolean(sessionRow.approval_required ?? true),
  };

  return {
    status: 'approved',
    session,
  };
}

/**
 * Ends the current session
 * @param sessionId The session ID to end
 * @param userId The user ending the session
 */
export async function endSessionApi(
  sessionId: string | null,
  userId: string
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      is_active: false,
    })
    .eq('id', sessionId)
    .eq('host_user_id', userId);

  if (error) {
    console.error('Failed to end session:', error);
    // Don't throw - allow local session to be cleared even if DB update fails
  }
}

/**
 * Refreshes session information from the database
 * @param sessionId The session ID to refresh
 * @returns The updated session or null if not found
 */
export async function refreshSessionApi(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }

  return data as SessionRow;
}