import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

import { stripeGet, stripeRequest, verifyStripeSignature } from '../_shared/stripe.ts';

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const toIso = (value?: number | null) => (value ? new Date(value * 1000).toISOString() : null);

async function resolvePlanId(priceId: string | null) {
  if (!priceId) return null;
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .or(`stripe_price_id.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function upsertSubscription(stripeSubscription: any) {
  const metadata = stripeSubscription.metadata ?? {};
  const userId = metadata.supabase_user_id ?? metadata.user_id ?? null;
  const subscriptionIdFromMetadata = metadata.subscription_id ?? null;

  const stripeSubscriptionId = stripeSubscription.id;
  const stripeCustomerId = typeof stripeSubscription.customer === 'string'
    ? stripeSubscription.customer
    : stripeSubscription.customer?.id ?? null;
  const priceId = stripeSubscription.items?.data?.[0]?.price?.id ?? null;
  const planId = metadata.plan_id ?? await resolvePlanId(priceId);

  let targetSubscriptionId = subscriptionIdFromMetadata ?? null;
  let existingPauseUsedPeriodStart: string | null | undefined;

  if (!targetSubscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id,pause_used_period_start')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      targetSubscriptionId = data.id as string;
      existingPauseUsedPeriodStart = data.pause_used_period_start ?? null;
    }
  }

  if (!targetSubscriptionId && userId) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id,pause_used_period_start,created_at,stripe_subscription_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      targetSubscriptionId = data.id as string;
      existingPauseUsedPeriodStart = data.pause_used_period_start ?? null;
    }
  }

  if (!targetSubscriptionId && userId) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: stripeSubscription.status,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_start: toIso(stripeSubscription.current_period_start),
        current_period_end: toIso(stripeSubscription.current_period_end),
        trial_ends_at: toIso(stripeSubscription.trial_end),
        canceled_at: toIso(stripeSubscription.canceled_at),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end ?? false,
      })
      .select('id')
      .single();
    if (error) throw error;
    targetSubscriptionId = data.id as string;
    existingPauseUsedPeriodStart = null;
  }

  if (!targetSubscriptionId) {
    console.warn('webhook: subscription row not found', {
      stripeSubscriptionId,
      userId,
    });
    return;
  }

  if (userId && stripeSubscriptionId) {
    const metadata = stripeSubscription.metadata ?? {};
    const needsUserId = metadata.supabase_user_id !== userId && metadata.user_id !== userId;
    const needsSubscriptionId = targetSubscriptionId
      && metadata.subscription_id !== targetSubscriptionId
      && metadata.supabase_subscription_id !== targetSubscriptionId;

    if (needsUserId || needsSubscriptionId) {
      const metadataPayload: Record<string, string> = {};
      if (needsUserId) {
        metadataPayload['metadata[supabase_user_id]'] = userId;
        metadataPayload['metadata[user_id]'] = userId;
      }
      if (needsSubscriptionId) {
        metadataPayload['metadata[subscription_id]'] = targetSubscriptionId;
        metadataPayload['metadata[supabase_subscription_id]'] = targetSubscriptionId;
      }

      try {
        await stripeRequest(`subscriptions/${stripeSubscriptionId}`, metadataPayload);
      } catch (metadataError) {
        console.warn('webhook: failed to sync subscription metadata', metadataError, {
          stripeSubscriptionId,
          userId,
          subscriptionId: targetSubscriptionId,
        });
      }
    }
  }

  if (existingPauseUsedPeriodStart === undefined) {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('pause_used_period_start')
      .eq('id', targetSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    existingPauseUsedPeriodStart = data?.pause_used_period_start ?? null;
  }

  const updatePayload: Record<string, unknown> = {
    stripe_subscription_id: stripeSubscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: stripeSubscription.status,
    current_period_start: toIso(stripeSubscription.current_period_start),
    current_period_end: toIso(stripeSubscription.current_period_end),
    trial_ends_at: toIso(stripeSubscription.trial_end),
    canceled_at: toIso(stripeSubscription.canceled_at),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const currentPeriodStartIso = toIso(stripeSubscription.current_period_start);
  if (
    currentPeriodStartIso
    && existingPauseUsedPeriodStart
    && existingPauseUsedPeriodStart !== currentPeriodStartIso
  ) {
    updatePayload.pause_used_period_start = null;
  }

  if (!stripeSubscription.pause_collection) {
    updatePayload.paused_at = null;
  }

  if (planId) {
    updatePayload.plan_id = planId;
  }

  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update(updatePayload)
    .eq('id', targetSubscriptionId);

  if (updateError) throw updateError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature header.' }, 400);
  }

  let event: any;
  try {
    const valid = await verifyStripeSignature(payload, signature, webhookSecret);
    if (!valid) {
      return json({ error: 'Invalid signature.' }, 400);
    }
    event = JSON.parse(payload);
  } catch (error) {
    console.error('stripe-webhook signature verification failed', error);
    return json({ error: 'Invalid payload.' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripeGet(`subscriptions/${session.subscription}`);
          await upsertSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await upsertSubscription(subscription);
        break;
      }
      default:
        break;
    }

    return json({ received: true });
  } catch (error) {
    console.error('stripe-webhook handler error', error, { event: event.type });
    return json({ error: (error as Error).message ?? 'Webhook processing failed.' }, 500);
  }
});
