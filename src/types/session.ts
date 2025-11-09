import type { SubscriptionPlanTier } from './auth';

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

export type CreateSessionOptions = {
  passphrase?: string;
  approvalRequired?: boolean;
};

export type JoinSessionOptions = {
  passphrase?: string;
};

export type JoinSessionResult = {
  status: 'approved' | 'pending';
  session: ActiveSession | null;
  message?: string;
};

export type SessionRow = {
  id?: string | null;
  code: string;
  event_id: string;
  host_user_id?: string;
  host_device_id?: string;
  created_at?: string;
  requires_passphrase?: boolean;
  approval_required?: boolean;
  host_plan_tier?: string;
  host_plan_paused?: boolean;
  is_active?: boolean;
};

export const SESSION_CODE_LENGTH = 12;