import { stripeRequest, stripeGet } from '../_shared/stripe.ts';

type PauseAction = 'pause' | 'resume';

type PauseRequest = {
  action?: PauseAction;
  userId?: string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const toIso = (value?: number | null) => (value ? new Date(value * 1000).toISOString() : null);

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

type SubscriptionRow = {
  id: string;
  stripe_subscription_id: string | null;
  status: string | null;
  paused_at: string | null;
  pause_used_period_start: string | null;
};

async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/subscriptions`);
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('select', 'id,stripe_subscription_id,status,paused_at,pause_used_period_start');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      ...restHeaders,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to load subscription.');
  }

  const body = (await response.json()) as SubscriptionRow[];
  if (!Array.isArray(body) || !body.length) return null;
  return body[0] ?? null;
}

async function updateSubscription(id: string, payload: Record<string, unknown>): Promise<void> {
  const url = new URL(`${supabaseUrl}/rest/v1/subscriptions`);
  url.searchParams.set('id', `eq.${id}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...restHeaders,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to update subscription.');
  }
}

Deno.serve(async (req) => {
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

    const subscription = await fetchSubscription(userId);
    if (!subscription || !subscription.stripe_subscription_id) {
      return json({ error: 'Stripe subscription not configured.' }, 400);
    }

    const stripeSubscription = await stripeGet(`subscriptions/${subscription.stripe_subscription_id}`);
    const currentPeriodStartIso = toIso(stripeSubscription.current_period_start);

    const parseIso = (value?: string | null) => (value ? Date.parse(value) : null);
    const pauseUsedThisPeriod = Boolean(
      currentPeriodStartIso
      && parseIso(subscription.pause_used_period_start) === parseIso(currentPeriodStartIso),
    );

    if (action === 'pause') {
      if (stripeSubscription.pause_collection) {
        return json({ error: 'Subscription is already paused.' }, 400);
      }
      if (pauseUsedThisPeriod) {
        return json({ error: 'Pause allowance used for this billing period.' }, 400);
      }

      await stripeRequest(`subscriptions/${subscription.stripe_subscription_id}`, {
        'pause_collection[behavior]': 'keep_as_draft',
      });
    } else {
      if (!stripeSubscription.pause_collection) {
        return json({ error: 'Subscription is not paused.' }, 400);
      }

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

    await updateSubscription(subscription.id, updatePayload);

    return json({ status: updatedSubscription.status });
  } catch (error) {
    console.error('stripe-manage-pause error', error);
    return json({ error: (error as Error).message ?? 'Failed to update subscription pause state.' }, 500);
  }
});
