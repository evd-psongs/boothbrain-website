/**
 * Plan Cache
 * Caches subscription plan IDs to avoid repeated database queries
 *
 * The Pro plan ID never changes, so we can safely cache it in memory
 * This eliminates unnecessary database queries on every purchase/sync
 */

import { supabase } from '@/lib/supabase';

// In-memory cache for plan IDs
const planCache = new Map<string, string>();

/**
 * Get Pro plan ID (with caching)
 *
 * @returns Pro plan UUID from database
 * @throws Error if Pro plan not found
 */
export async function getProPlanId(): Promise<string> {
  // Check cache first
  const cached = planCache.get('pro');
  if (cached) {
    console.log('[PlanCache] Using cached Pro plan ID');
    return cached;
  }

  // Fetch from database
  console.log('[PlanCache] Fetching Pro plan ID from database');
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('tier', 'pro')
    .single();

  if (planError || !plan) {
    console.error('[PlanCache] Failed to find Pro plan:', planError);
    throw new Error('Pro subscription plan not found in database');
  }

  // Cache for future use
  planCache.set('pro', plan.id);
  console.log('[PlanCache] Cached Pro plan ID:', plan.id);

  return plan.id;
}

/**
 * Clear plan cache
 * Useful for testing or if plan IDs change
 */
export function clearPlanCache(): void {
  planCache.clear();
  console.log('[PlanCache] Cache cleared');
}
