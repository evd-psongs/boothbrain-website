import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/auth';

const PROFILE_COLUMNS = `
  id,
  email,
  full_name,
  avatar_url,
  phone,
  onboarding_completed,
  last_seen_at,
  created_at,
  updated_at
`;

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  onboarding_completed: boolean | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdates = {
  fullName?: string | null;
  phone?: string | null;
};

const mapProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name ?? null,
  avatarUrl: row.avatar_url ?? null,
  phone: row.phone ?? null,
  onboardingCompleted: Boolean(row.onboarding_completed),
  lastSeenAt: row.last_seen_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function updateProfile(userId: string, updates: ProfileUpdates): Promise<Profile> {
  const payload: Record<string, unknown> = {};

  if ('fullName' in updates) {
    payload.full_name = updates.fullName ?? null;
  }

  if ('phone' in updates) {
    payload.phone = updates.phone ?? null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Profile not found after update.');
  }

  return mapProfile(data as ProfileRow);
}
