import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4?target=deno';

import { stripeRequest, createStripeCustomer } from '../_shared/stripe.ts';
import { requireUserMatch } from '../_shared/auth.ts';
import { withMonitoring } from '../_shared/monitoring.ts';

type PortalRequest = {
  userId?: string;
  returnUrl?: string | null;
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

const sanitizeReturnUrl = (provided?: string | null) => {
  if (provided && /^https?:\/\//i.test(provided)) {
    return provided;
  }
  return `${fallbackBaseUrl}/billing/manage`;
};

async function ensureStripeCustomer(userId: string, existingCustomerId: string | null) {
  if (existingCustomerId) return existingCustomerId;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  const user = data?.user;
  if (!user) throw new Error('User not found.');

  const customer = await createStripeCustomer({
    email: user.email ?? undefined,
    name: user.user_metadata?.full_name ?? undefined,
    'metadata[supabase_user_id]': user.id,
  });

  const { error: updateError } = await supabaseAdmin
    .from('subscriptions')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', userId);
  if (updateError) throw updateError;

  return customer.id as string;
}

serve((req) =>
  withMonitoring({
    req,
    handler: async () => {
      if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200 });
      }

      if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
      }

      try {
        const { userId, returnUrl } = (await req.json()) as PortalRequest;

        if (!userId) {
          return json({ error: 'userId is required.' }, 400);
        }

        try {
          await requireUserMatch(req, userId);
        } catch (authError) {
          const status = (authError as { status?: number })?.status ?? 401;
          return json({ error: (authError as Error).message ?? 'Unauthorized' }, status);
        }

        const { data: subscription, error } = await supabaseAdmin
          .from('subscriptions')
          .select('id, stripe_customer_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!subscription) {
          return json({ error: 'Subscription not found.' }, 404);
        }

        const stripeCustomerId = await ensureStripeCustomer(userId, subscription.stripe_customer_id ?? null);

        const session = await stripeRequest('billing_portal/sessions', {
          customer: stripeCustomerId,
          return_url: sanitizeReturnUrl(returnUrl),
        });

        return json({ url: session.url as string });
      } catch (error) {
        console.error('stripe-billing-portal error', error);
        return json({ error: (error as Error).message ?? 'Failed to open billing portal.' }, 500);
      }
    },
  }),
);
