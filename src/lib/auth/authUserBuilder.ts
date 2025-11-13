import { User } from '@supabase/supabase-js';
import type { AuthUser } from '@/types/auth';
import { fetchProfile } from './profileService';
import { fetchSubscription } from './subscriptionService';

/**
 * Builds a complete AuthUser object by fetching profile and subscription data
 * @param supabaseUser The Supabase user object
 * @returns The complete AuthUser object
 */
export async function buildAuthUser(supabaseUser: User): Promise<AuthUser> {
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