import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/auth';
import { withTimeout, withRetry, getTimeout } from '@/utils/asyncHelpers';

const isIOS = Platform.OS === 'ios';
const isDevelopment = __DEV__;

/**
 * Fetches a user's profile from the database
 * @param userId The user ID to fetch the profile for
 * @returns The user's profile or null if not found
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const fetchFn = async () => {
      const queryPromise = (async () => {
        return await supabase.from('profiles').select('*').eq('id', userId).single();
      })();

      const result = await withTimeout(
        queryPromise,
        getTimeout('profile', Platform.OS, isDevelopment),
        'Timed out while loading profile.'
      );
      return result;
    };

    const result = isIOS && isDevelopment
      ? await fetchFn() // No retry on iOS in dev for faster failure
      : await withRetry(fetchFn);

    const { data, error } = result as { data: any; error: any };

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name ?? null,
      avatarUrl: data.avatar_url ?? null,
      phone: data.phone ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      onboardingCompleted: Boolean(data.onboarding_completed),
      lastSeenAt: data.last_seen_at ?? null,
    };
  } catch (error: any) {
    // On iOS timeout, return null instead of throwing to allow app to load
    if (isIOS && error.message?.includes('Timed out')) {
      console.warn('Profile fetch timed out on iOS, continuing with null profile');
      return null;
    }
    throw error;
  }
}

/**
 * Updates a user's profile in the database
 * @param userId The user ID to update
 * @param updates The profile fields to update
 * @returns The updated profile or null on error
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'fullName' | 'avatarUrl' | 'phone'>>
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.fullName,
        avatar_url: updates.avatarUrl,
        phone: updates.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name ?? null,
      avatarUrl: data.avatar_url ?? null,
      phone: data.phone ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      onboardingCompleted: Boolean(data.onboarding_completed),
      lastSeenAt: data.last_seen_at ?? null,
    };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return null;
  }
}