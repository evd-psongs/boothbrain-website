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
  // Use individual try-catch blocks to allow partial success
  // This prevents the user from being logged out if profile/subscription fails to load
  const profilePromise = fetchProfile(supabaseUser.id).catch(err => {
    console.warn('Failed to load profile, continuing without it:', err);
    return null;
  });

  const subscriptionPromise = fetchSubscription(supabaseUser.id).catch(err => {
    console.warn('Failed to load subscription, continuing without it:', err);
    return null;
  });

  const [profile, subscription] = await Promise.all([
    profilePromise,
    subscriptionPromise,
  ]);

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? undefined,
    profile,
    subscription,
  };
}