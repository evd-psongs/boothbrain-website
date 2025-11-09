/**
 * Database row types that match Supabase table schemas
 * These types represent the raw data structure from the database
 */

// ============== USER & AUTH TABLES ==============

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  last_seen_at: string | null;
};

export type SubscriptionPlanRow = {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  max_inventory_items: number | null;
  currency: string | null;
  price_cents: number | null;
  billing_interval_months: number | null;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  trial_ends_at: string | null;
  paused_at: string | null;
  pause_used_period_start: string | null;
  pause_allowance_used: boolean;
};

// ============== INVENTORY TABLES ==============

export type ItemRow = {
  id: string;
  owner_user_id: string;
  event_id: string | null;
  name: string;
  sku: string | null;
  price_cents: number;
  quantity: number;
  low_stock_threshold: number;
  image_paths: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type EventStagedItemRow = {
  id: string;
  owner_user_id: string;
  event_id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  quantity: number;
  low_stock_threshold: number;
  image_paths: string[];
  expected_release_at: string | null;
  status: 'staged' | 'released' | 'converted';
  notes: string | null;
  converted_item_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ItemImageRow = {
  id: string;
  item_id: string;
  path: string;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
};

// ============== ORDER TABLES ==============

export type OrderRow = {
  id: string;
  owner_user_id: string | null;
  session_id: string | null;
  event_id: string | null;
  status: string | null;
  payment_method: string | null;
  total_cents: number | null;
  tax_cents: number | null;
  tax_rate_bps: number | null;
  buyer_name: string | null;
  buyer_contact: string | null;
  description: string | null;
  deposit_taken: boolean | null;
  device_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type OrderItemRow = {
  id?: string;
  order_id: string | null;
  item_id: string | null;
  quantity: number | null;
  price_cents: number | null;
  item_name?: string | null;
  item_sku?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// Join query result type
export type OrderItemWithDetails = OrderItemRow & {
  items?: {
    name: string | null;
    sku: string | null;
  } | null;
};

// ============== EVENT TABLES ==============

export type EventRow = {
  id: string;
  owner_user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string | null;
  notes: string | null;
  checklist: Array<{
    id: string;
    title: string;
    done: boolean;
    phase: 'prep' | 'live' | 'post';
  }>;
  created_at: string | null;
  updated_at: string | null;
};

// ============== SESSION TABLES ==============

export type SessionRow = {
  id: string;
  code: string;
  organization_id?: string;
  event_id: string;
  host_user_id: string;
  host_device_id: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  requires_passphrase: boolean;
  approval_required: boolean;
  passphrase_salt?: string | null;
  passphrase_hash?: string | null;
};

export type SessionMemberRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  device_id: string;
  role: 'host' | 'assistant';
  joined_at: string;
  status: 'approved' | 'pending' | 'rejected';
  approved_at: string | null;
  approved_by: string | null;
  last_seen_at: string | null;
};

// ============== SETTINGS TABLES ==============

export type UserSettingsRow = {
  user_id: string;
  tax_rate_bps: number | null;
  currency: string;
  payment_methods: string[];
  paypal_qr_path: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PaymentLinkRow = {
  id: string;
  user_id: string;
  payment_method: string;
  link: string;
  label: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// ============== ERROR TYPES ==============

export type SupabaseError = {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
};

// ============== UTILITY TYPES ==============

/**
 * Type guard to check if an error is a Supabase error
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as SupabaseError).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isSupabaseError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// ============== REALTIME TYPES ==============

export type RealtimePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  errors: string[] | null;
  commit_timestamp: string;
};