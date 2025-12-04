/**
 * Subscription Sync Service
 * Syncs RevenueCat subscription data to Supabase database
 *
 * Purpose:
 * - Convert RevenueCat CustomerInfo to Supabase subscription record
 * - Create or update subscription in database
 * - Handle subscription status mapping (trialing, active, canceled)
 */

import { CustomerInfo } from 'react-native-purchases';
import { supabase } from '@/lib/supabase';

/**
 * Sync RevenueCat subscription to Supabase
 * Called after successful purchase or when app starts
 *
 * @param userId - Supabase user ID
 * @param customerInfo - RevenueCat customer info
 * @throws Error if sync fails
 */
export async function syncSubscriptionToSupabase(
  userId: string,
  customerInfo: CustomerInfo
): Promise<void> {
  try {
    const proEntitlement = customerInfo.entitlements.active['pro'];

    if (!proEntitlement) {
      console.log('[SubscriptionSync] No active Pro entitlement found');
      return;
    }

    // Extract subscription details from entitlement
    // Use product identifier + user ID as unique key since originalTransactionId isn't available
    const productId = proEntitlement.productIdentifier;
    const periodType = proEntitlement.periodType; // 'NORMAL', 'INTRO', 'TRIAL', 'PREPAID'
    const expirationDate = proEntitlement.expirationDate;
    const willRenew = proEntitlement.willRenew;
    const unsubscribeDetectedAt = proEntitlement.unsubscribeDetectedAt;
    const originalPurchaseDate = proEntitlement.originalPurchaseDate;

    // Create a unique transaction ID from user + product + purchase date
    const transactionId = `${userId}_${productId}_${originalPurchaseDate}`;

    console.log('[SubscriptionSync] Syncing subscription:', {
      transactionId,
      productId,
      periodType,
      expirationDate,
      willRenew,
    });

    // Determine subscription status
    let status: string;
    if (periodType === 'TRIAL') {
      status = 'trialing';
    } else if (willRenew) {
      status = 'active';
    } else if (unsubscribeDetectedAt) {
      status = 'canceled';
    } else {
      status = 'active';
    }

    // Find Pro plan ID
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'pro')
      .single();

    if (planError || !plan) {
      console.error('[SubscriptionSync] Failed to find Pro plan:', planError);
      throw new Error('Pro subscription plan not found in database');
    }

    // Check if subscription already exists
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('apple_original_transaction_id', transactionId)
      .maybeSingle();

    // Prepare subscription data
    const subscriptionData = {
      user_id: userId,
      plan_id: plan.id,
      status,
      payment_platform: 'apple' as const,
      apple_original_transaction_id: transactionId,
      apple_product_id: productId,
      current_period_end: expirationDate,
      canceled_at: unsubscribeDetectedAt || null,
      trial_ends_at: periodType === 'TRIAL' ? expirationDate : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSubscription) {
      // Update existing subscription
      console.log('[SubscriptionSync] Updating existing subscription:', existingSubscription.id);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('[SubscriptionSync] Update failed:', updateError);
        throw updateError;
      }

      console.log('[SubscriptionSync] Subscription updated successfully');
    } else {
      // Create new subscription
      console.log('[SubscriptionSync] Creating new subscription');

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[SubscriptionSync] Insert failed:', insertError);
        throw insertError;
      }

      console.log('[SubscriptionSync] Subscription created successfully');
    }
  } catch (error) {
    console.error('[SubscriptionSync] Sync failed:', error);
    throw error;
  }
}

/**
 * Check if user has any Apple subscription
 * Used to determine if we need to check RevenueCat on app start
 *
 * @param userId - Supabase user ID
 * @returns True if user has Apple subscription record
 */
export async function hasAppleSubscription(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('payment_platform', 'apple')
      .maybeSingle();

    if (error) {
      console.error('[SubscriptionSync] Error checking Apple subscription:', error);
      return false;
    }

    return data !== null;
  } catch (error) {
    console.error('[SubscriptionSync] Failed to check Apple subscription:', error);
    return false;
  }
}
