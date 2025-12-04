/**
 * RevenueCat Webhook Handler
 * Handles subscription events from RevenueCat and syncs to Supabase
 *
 * Events handled:
 * - INITIAL_PURCHASE - New subscription created
 * - RENEWAL - Subscription renewed
 * - CANCELLATION - Subscription cancelled (but still active until expiration)
 * - EXPIRATION - Subscription expired
 * - BILLING_ISSUE - Payment failed
 *
 * Deployment:
 * supabase functions deploy revenuecat-webhook
 *
 * Environment variables required:
 * - REVENUECAT_WEBHOOK_SECRET (optional - for signature verification)
 * - SUPABASE_URL (auto-injected)
 * - SUPABASE_SERVICE_ROLE_KEY (set in Supabase dashboard)
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

// const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET'); // TODO: Implement signature verification
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    // Optional: Verify webhook signature
    // const signature = req.headers.get('X-RevenueCat-Signature');
    // if (REVENUECAT_WEBHOOK_SECRET && signature) {
    //   // TODO: Implement signature verification
    //   // RevenueCat doesn't provide HMAC signatures by default
    //   // You can enable this in RevenueCat dashboard
    // }

    const payload = await req.json();
    const event = payload.event;

    if (!event) {
      return json({ error: 'Missing event data' }, 400);
    }

    console.log('[RevenueCat Webhook] Received event:', event.type);

    // Extract event data
    const appUserId = event.app_user_id; // This is the Supabase user ID
    const productId = event.product_id;
    const eventType = event.type;
    const expirationDateMs = event.expiration_at_ms;
    const purchaseDateMs = event.purchased_at_ms;
    const isTrial = event.is_trial_period === 'true';
    const willRenew = event.auto_renew_status === 'true';

    if (!appUserId) {
      console.error('[RevenueCat Webhook] Missing app_user_id');
      return json({ error: 'Missing app_user_id' }, 400);
    }

    // Create transaction ID for logging/tracking
    // Note: We use user_id + product_id for lookups, not this transaction ID
    const purchaseDate = purchaseDateMs
      ? new Date(parseInt(purchaseDateMs)).toISOString()
      : new Date().toISOString();
    const transactionId = `${appUserId}_${productId}_${purchaseDate}`;

    // Convert timestamps
    const expirationDate = expirationDateMs
      ? new Date(parseInt(expirationDateMs)).toISOString()
      : null;

    // Determine subscription status based on event type
    // Note: This logic is duplicated from src/lib/purchases/subscriptionStatusMapper.ts
    // Edge functions can't import from src/, so we maintain sync manually
    let status: string;
    let canceledAt: string | null = null;

    switch (eventType) {
      case 'INITIAL_PURCHASE':
        status = isTrial ? 'trialing' : 'active';
        break;
      case 'RENEWAL':
        status = 'active';
        break;
      case 'CANCELLATION':
        status = 'canceled';
        canceledAt = new Date().toISOString();
        break;
      case 'EXPIRATION':
        status = 'canceled';
        break;
      case 'BILLING_ISSUE':
        status = 'past_due';
        break;
      default:
        status = willRenew ? 'active' : 'canceled';
    }

    console.log('[RevenueCat Webhook] Processing:', {
      appUserId,
      productId,
      eventType,
      status,
      transactionId,
    });

    // Get Pro plan ID
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'pro')
      .single();

    if (planError || !plan) {
      console.error('[RevenueCat Webhook] Failed to find Pro plan:', planError);
      return json({ error: 'Pro plan not found' }, 500);
    }

    // Check if subscription already exists for this user + product combination
    // We use user_id + apple_product_id as the unique key (not transaction_id)
    // This ensures one active subscription per product, with renewals updating the same record
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', appUserId)
      .eq('apple_product_id', productId)
      .eq('payment_platform', 'apple')
      .maybeSingle();

    // Prepare subscription data
    const subscriptionData = {
      user_id: appUserId,
      plan_id: plan.id,
      status,
      payment_platform: 'apple',
      apple_original_transaction_id: transactionId,
      apple_product_id: productId,
      current_period_end: expirationDate,
      canceled_at: canceledAt,
      trial_ends_at: isTrial ? expirationDate : null,
      updated_at: new Date().toISOString(),
    };

    if (existingSubscription) {
      // Update existing subscription
      console.log('[RevenueCat Webhook] Updating subscription:', existingSubscription.id);

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('[RevenueCat Webhook] Update failed:', updateError);
        return json({ error: 'Update failed' }, 500);
      }

      console.log('[RevenueCat Webhook] Subscription updated successfully');
    } else {
      // Create new subscription
      console.log('[RevenueCat Webhook] Creating new subscription');

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[RevenueCat Webhook] Insert failed:', insertError);
        return json({ error: 'Insert failed' }, 500);
      }

      console.log('[RevenueCat Webhook] Subscription created successfully');
    }

    return json({ received: true });
  } catch (error) {
    console.error('[RevenueCat Webhook] Error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});
