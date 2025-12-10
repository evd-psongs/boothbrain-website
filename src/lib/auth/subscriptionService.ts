import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Subscription } from '@/types/auth';
import { withTimeout, withRetry, getTimeout } from '@/utils/asyncHelpers';

const isIOS = Platform.OS === 'ios';
const isDevelopment = __DEV__;

/**
 * Fetches a user's subscription from the database
 * @param userId The user ID to fetch the subscription for
 * @returns The user's subscription or null if not found
 */
export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const columns = `
    id,
    status,
    current_period_start,
    current_period_end,
    canceled_at,
    trial_ends_at,
    plan_id,
    payment_platform,
    apple_original_transaction_id,
    apple_product_id,
    plans:plan_id (
      id,
      name,
      tier,
      max_inventory_items,
      price_cents
    )
  `;

  try {
    const fetchFn = async () => {
      const queryPromise = (async () => {
        return await supabase
          .from('subscriptions')
          .select(columns)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      })();

      const result = await withTimeout(
        queryPromise,
        getTimeout('subscription', Platform.OS, isDevelopment),
        'Timed out while loading subscription.'
      );
      return result;
    };

    // iOS dev: no retry, fail fast to prevent infinite loading
    // Production & Android: retry with backoff for better reliability
    const result = isIOS && isDevelopment
      ? await fetchFn()
      : await withRetry(fetchFn, 1, 500); // Reduced to 1 retry (2 total attempts)

    const { data, error } = result as { data: any; error: any };

    if (error) {
      if (error.message?.includes('column subscriptions.user_id')) {
        console.warn('Skipping subscription lookup (missing user_id column).');
        return null;
      }
      throw error;
    }

    if (!data) return null;

    const raw = data as any;
    const planRow = Array.isArray(raw?.plans) ? raw.plans[0] : raw.plans;

    return {
      id: raw.id,
      userId,
      status: raw.status,
      currentPeriodStart: raw.current_period_start,
      currentPeriodEnd: raw.current_period_end,
      canceledAt: raw.canceled_at,
      trialEndsAt: raw.trial_ends_at,
      paymentPlatform: raw.payment_platform ?? 'stripe',
      appleOriginalTransactionId: raw.apple_original_transaction_id ?? null,
      appleProductId: raw.apple_product_id ?? null,
      plan: planRow
        ? {
            id: planRow.id as string,
            name: planRow.name as string,
            tier: planRow.tier as 'free' | 'pro' | 'enterprise',
            maxInventoryItems: (planRow.max_inventory_items ?? null) as number | null,
            currency: 'USD',
            priceCents: (planRow.tier === 'pro' ? 2700 : planRow.price_cents ?? null) as number | null,
            billingIntervalMonths: planRow.tier === 'pro' ? 3 : null,
          }
        : null,
    };
  } catch (error: any) {
    // On iOS dev timeout, return null instead of throwing to allow app to load
    if (isIOS && isDevelopment && error.message?.includes('Timed out')) {
      console.warn('[iOS Dev] Subscription fetch timed out, continuing with null subscription');
      return null;
    }
    throw error;
  }
}

/**
 * Checks if a subscription is active
 * @param subscription The subscription to check
 * @returns True if the subscription is active
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  // Apple IAP subscriptions - check expiration date
  if (subscription.paymentPlatform === 'apple') {
    const now = new Date();
    const expiresAt = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    // Active if current period hasn't expired yet
    return expiresAt ? expiresAt > now : false;
  }

  // Stripe subscriptions - use status field
  const activeStatuses = ['trialing', 'active', 'past_due'];
  return activeStatuses.includes(subscription.status || '');
}

/**
 * Gets the effective plan tier for a subscription
 * @param subscription The subscription to check
 * @returns The effective plan tier
 */
export function getEffectivePlanTier(subscription: Subscription | null): string {
  if (!subscription) return 'free';
  if (!isSubscriptionActive(subscription)) return 'free';

  return subscription.plan?.tier ?? 'free';
}