import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

import { stripeRequest, createStripeCustomer } from '../_shared/stripe.ts';
import { requireUserMatch } from '../_shared/auth.ts';

type CheckoutRequest = {
  planTier?: string;
  userId?: string;
  interval?: 'monthly' | 'yearly' | null;
  successUrl?: string | null;
  cancelUrl?: string | null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const fallbackBaseUrl = (Deno.env.get('STRIPE_RETURN_BASE_URL') ?? 'https://boothbrain.app').replace(/\/$/, '');

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function fetchPlan(tier: string) {
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('id, tier, stripe_price_id, stripe_price_id_yearly, trial_period_days')
    .eq('tier', tier)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function fetchSupabaseUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user ?? null;
}

async function ensureStripeCustomer(userId: string, existingCustomerId: string | null) {
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const user = await fetchSupabaseUser(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const customer = await createStripeCustomer({
    email: user.email ?? undefined,
    name: user.user_metadata?.full_name ?? undefined,
    'metadata[supabase_user_id]': user.id,
  });

  return customer.id as string;
}

async function upsertSubscription(
  userId: string,
  planId: string,
  stripeCustomerId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_id, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'incomplete',
        stripe_customer_id: stripeCustomerId,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;
    return inserted.id as string;
  }

  const updates: Record<string, unknown> = {
    status: 'incomplete',
  };
  if (data.plan_id !== planId) {
    updates.plan_id = planId;
  }
  if (!data.stripe_customer_id) {
    updates.stripe_customer_id = stripeCustomerId;
  }

  if (Object.keys(updates).length) {
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(updates)
      .eq('id', data.id);
    if (updateError) throw updateError;
  }

  return data.id as string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { planTier, userId, interval, successUrl, cancelUrl } = (await req.json()) as CheckoutRequest;

    if (!planTier || !userId) {
      return json({ error: 'planTier and userId are required.' }, 400);
    }

    try {
      await requireUserMatch(req, userId);
    } catch (authError) {
      const status = (authError as { status?: number })?.status ?? 401;
      return json({ error: (authError as Error).message ?? 'Unauthorized' }, status);
    }

    const plan = await fetchPlan(planTier);
    if (!plan) {
      return json({ error: `Plan ${planTier} not found.` }, 404);
    }

    const priceId = (interval === 'yearly'
      ? plan.stripe_price_id_yearly ?? plan.stripe_price_id
      : plan.stripe_price_id) ?? null;

    if (!priceId) {
      return json({ error: `Plan ${planTier} is missing Stripe price configuration.` }, 400);
    }

    const { data: subscriptionRow, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    const stripeCustomerId = await ensureStripeCustomer(userId, subscriptionRow?.stripe_customer_id ?? null);
    const subscriptionId = await upsertSubscription(userId, plan.id as string, stripeCustomerId);

    const finalSuccessUrl = successUrl ?? `${fallbackBaseUrl}/billing/success`;
    const finalCancelUrl = cancelUrl ?? `${fallbackBaseUrl}/billing/cancel`;

    const params: Record<string, string | number | boolean> = {
      mode: 'subscription',
      customer: stripeCustomerId,
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      allow_promotion_codes: true,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      'metadata[supabase_user_id]': userId,
      'metadata[plan_tier]': plan.tier,
      'metadata[plan_id]': plan.id as string,
      'metadata[subscription_id]': subscriptionId,
      'subscription_data[metadata][supabase_user_id]': userId,
      'subscription_data[metadata][plan_tier]': plan.tier,
      'subscription_data[metadata][plan_id]': plan.id as string,
      'subscription_data[metadata][subscription_id]': subscriptionId,
    };

    if (typeof plan.trial_period_days === 'number') {
      params['subscription_data[trial_period_days]'] = plan.trial_period_days;
    }

    const session = await stripeRequest('checkout/sessions', params);

    return json({ url: session.url as string });
  } catch (error) {
    console.error('stripe-create-checkout error', error);
    return json({ error: (error as Error).message ?? 'Failed to start checkout.' }, 500);
  }
});
