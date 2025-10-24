import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

import { stripeRequest, stripeGet } from '../_shared/stripe.ts';

type PauseAction = 'pause' | 'resume';

type PauseRequest = {
  action?: PauseAction;
  userId?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const toIso = (value?: number | null) => (value ? new Date(value * 1000).toISOString() : null);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { action, userId } = (await req.json()) as PauseRequest;

    if (action !== 'pause' && action !== 'resume') {
      return json({ error: "action must be 'pause' or 'resume'." }, 400);
    }

    if (!userId) {
      return json({ error: 'userId is required.' }, 400);
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, stripe_subscription_id, status')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!subscription || !subscription.stripe_subscription_id) {
      return json({ error: 'Stripe subscription not configured.' }, 400);
    }

    if (action === 'pause') {
      await stripeRequest(`subscriptions/${subscription.stripe_subscription_id}`, {
        'pause_collection[behavior]': 'keep_as_draft',
      });
    } else {
      await stripeRequest(`subscriptions/${subscription.stripe_subscription_id}`, {
        'pause_collection': '',
      });
    }

    const updatedSubscription = await stripeGet(`subscriptions/${subscription.stripe_subscription_id}`);

    const updatePayload: Record<string, unknown> = {
      status: updatedSubscription.status,
      current_period_start: toIso(updatedSubscription.current_period_start),
      current_period_end: toIso(updatedSubscription.current_period_end),
      canceled_at: toIso(updatedSubscription.canceled_at),
      cancel_at_period_end: updatedSubscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    };

    if (action === 'pause') {
      const nowIso = new Date().toISOString();
      updatePayload.paused_at = nowIso;
      updatePayload.pause_used_period_start =
        updatePayload.current_period_start ?? toIso(updatedSubscription.current_period_start) ?? nowIso;
    } else {
      updatePayload.paused_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(updatePayload)
      .eq('id', subscription.id);

    if (updateError) throw updateError;

    return json({ status: updatedSubscription.status });
  } catch (error) {
    console.error('stripe-manage-pause error', error);
    return json({ error: (error as Error).message ?? 'Failed to update subscription pause state.' }, 500);
  }
});
