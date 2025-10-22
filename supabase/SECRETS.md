# Supabase & Stripe Secrets

Set the following environment variables before running Supabase edge functions or Stripe webhooks. All values belong in the Supabase dashboard under **Project Settings → API → Configuration → Functions** (or via the Supabase CLI using `supabase secrets set`).

| Key | Description | Source |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project REST endpoint | Supabase dashboard |
| `SUPABASE_ANON_KEY` | Public anon key used by edge functions | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key required by `_shared/clients.ts` | Supabase dashboard (never expose publicly) |
| `STRIPE_SECRET_KEY` | Stripe API key for the workspace | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `stripe-webhook` function | Output from `stripe webhook create` |
| `STRIPE_BILLING_PORTAL_WEBHOOK_SECRET` | Optional: signing secret if using a dedicated billing-portal webhook | Stripe dashboard |

## Applying Secrets

```bash
supabase secrets set \
  SUPABASE_URL="https://xyzcompany.supabase.co" \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..."
```

After updating secrets, redeploy the functions:

```bash
supabase functions deploy stripe-webhook stripe-create-checkout stripe-billing-portal
```

Keep these values in 1Password (or your vault of choice) and never check them into git. Document the most recent rotation date here:

- Service role key rotated: `TODO`
- Stripe secret rotated: `TODO`
- Webhook secret rotated: `TODO`

## Resetting your Stripe test workspace

If test payments return `401`/`400` errors or you want a clean slate:

1. In the Stripe dashboard (Test mode), rotate the **Secret key**, generate a new **Publishable key**, and remove any restricted keys you no longer need. Record the new values.  
2. Create fresh `Product`/`Price` objects that mirror the app’s tiers, then note each price id (monthly/yearly).  
3. Update Supabase secrets with the new keys:  
   ```bash
   supabase secrets set STRIPE_SECRET_KEY="sk_test_..." STRIPE_WEBHOOK_SECRET="whsec_..."
   ```  
   Redeploy the functions afterward.  
4. Refresh the Expo env in `.env.local` with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` and restart the dev server.  
5. Apply the new price ids to `subscription_plans`—run an UPDATE in the Supabase SQL editor or create a migration similar to `supabase/migrations/20250212_set_stripe_price_ids.sql`.  
6. Recreate the webhook endpoint in Stripe so it targets your Supabase deployment and paste the new signing secret back into Supabase.  
7. Run a $0.50 test checkout and confirm Stripe’s event log shows `200` responses from `stripe-webhook`.
