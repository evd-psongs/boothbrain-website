# RevenueCat Webhook Deployment Guide

**Last Updated:** 2025-12-06
**Status:** 🟢 Active - Ready to deploy
**Purpose:** Deploy and configure RevenueCat webhook for subscription sync

This guide explains how to deploy and configure the RevenueCat webhook for server-side subscription sync.

## What is the Webhook For?

The webhook provides **backup sync** for subscriptions:
- Syncs subscriptions even when the app isn't running
- Handles renewals, cancellations, and expirations server-side
- Provides redundancy in case the in-app listener fails

**Note:** The in-app listener (Phase 5) handles most cases. The webhook is for reliability and server-side validation.

---

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Supabase project linked (`supabase link --project-ref YOUR_PROJECT_REF`)
- RevenueCat account with BoothBrain project configured

---

## Step 1: Deploy the Edge Function

From your project root, run:

```bash
supabase functions deploy revenuecat-webhook
```

You should see output like:
```
Deploying revenuecat-webhook (project ref: your-project-ref)
Deployed: https://your-project.supabase.co/functions/v1/revenuecat-webhook
```

**Save this URL** - you'll need it for RevenueCat configuration.

---

## Step 2: Set Environment Variables (Optional)

The webhook needs the `SUPABASE_SERVICE_ROLE_KEY` to write to the database.

**Option A: Via Supabase Dashboard**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Edge Functions**
4. Click **Manage Secrets**
5. Add secret:
   - Key: `REVENUECAT_WEBHOOK_SECRET` (optional - for signature verification)
   - Value: (get from RevenueCat dashboard if enabled)

**Option B: Via CLI**
```bash
# Set webhook secret (optional)
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

**Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

---

## Step 3: Configure RevenueCat Webhook

1. **Go to RevenueCat Dashboard**
   - Navigate to your project
   - Click **Integrations** → **Webhooks**

2. **Add Webhook URL**
   - URL: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
   - Replace `your-project` with your actual Supabase project ref

3. **Select Events to Send**
   - ✅ `INITIAL_PURCHASE`
   - ✅ `RENEWAL`
   - ✅ `CANCELLATION`
   - ✅ `EXPIRATION`
   - ✅ `BILLING_ISSUE`

4. **Optional: Enable Signature Verification**
   - If you want extra security, enable webhook signing in RevenueCat
   - Copy the webhook secret
   - Set it as `REVENUECAT_WEBHOOK_SECRET` in Supabase (Step 2)

5. **Save Configuration**

---

## Step 4: Test the Webhook

RevenueCat provides a test button in the dashboard:

1. In RevenueCat → Webhooks → Your webhook
2. Click **Send Test Event**
3. Select event type: `INITIAL_PURCHASE`
4. Click **Send**

**Check Logs:**
```bash
supabase functions logs revenuecat-webhook
```

You should see:
```
[RevenueCat Webhook] Received event: INITIAL_PURCHASE
[RevenueCat Webhook] Processing: { appUserId: '...', productId: '...', ... }
[RevenueCat Webhook] Subscription created successfully
```

---

## Step 5: Verify Database Updates

After a test event (or real purchase), check your database:

```sql
SELECT
  id,
  user_id,
  status,
  payment_platform,
  apple_product_id,
  current_period_end,
  created_at,
  updated_at
FROM subscriptions
WHERE payment_platform = 'apple'
ORDER BY updated_at DESC
LIMIT 5;
```

You should see subscription records with:
- `payment_platform` = `'apple'`
- `status` = `'active'`, `'trialing'`, `'canceled'`, etc.
- `apple_product_id` = `'boothbrain_pro_quarterly'` (or your product ID)

---

## Webhook Event Flow

**When a subscription event occurs:**

1. **RevenueCat** detects event (purchase, renewal, cancel, etc.)
2. **RevenueCat sends webhook** to your Supabase function
3. **Edge function processes event:**
   - Extracts user ID, product ID, status
   - Maps event type to subscription status
   - Creates unique transaction ID
4. **Database updated:**
   - Existing subscription? → Update
   - New subscription? → Insert
5. **Next app launch:**
   - User data refreshes
   - Pro features reflect new status

---

## Webhook Events Reference

| Event Type | Description | Resulting Status |
|------------|-------------|------------------|
| `INITIAL_PURCHASE` | First-time purchase | `trialing` or `active` |
| `RENEWAL` | Subscription renewed | `active` |
| `CANCELLATION` | User cancelled (still active until expiration) | `canceled` |
| `EXPIRATION` | Subscription expired | `canceled` |
| `BILLING_ISSUE` | Payment failed | `past_due` |

---

## Troubleshooting

### Webhook Not Firing

**Check RevenueCat Configuration:**
- Is the webhook URL correct?
- Are the right events selected?
- Is the webhook enabled?

**Check Supabase Logs:**
```bash
supabase functions logs revenuecat-webhook --tail
```

### Database Not Updating

**Check Function Logs for Errors:**
```bash
supabase functions logs revenuecat-webhook
```

**Common Issues:**
- `Pro plan not found` → Run migrations to create subscription_plans
- `Insert failed` → Check RLS policies (webhook uses service role, should bypass RLS)
- `Missing app_user_id` → RevenueCat not sending user ID (check event payload)

### Signature Verification Failing

If you enabled signature verification:
- Ensure `REVENUECAT_WEBHOOK_SECRET` is set correctly
- Check RevenueCat dashboard for the correct secret
- Uncomment signature verification code in webhook function

---

## Redeployment

After making changes to the webhook function:

```bash
supabase functions deploy revenuecat-webhook
```

Changes deploy immediately - no downtime.

---

## Production Checklist

Before going live:

- [ ] Webhook deployed and URL configured in RevenueCat
- [ ] Test event sent and verified in database
- [ ] Real sandbox purchase tested (see APPLE_IAP_IMPLEMENTATION_PLAN.md)
- [ ] Logs show successful processing
- [ ] Database subscriptions table updated correctly
- [ ] Environment variables set (if using signature verification)

---

## Alternative: Manual Deployment

If you don't have Supabase CLI, you can deploy via the dashboard:

1. Go to Supabase Dashboard → Edge Functions
2. Click **Create New Function**
3. Name: `revenuecat-webhook`
4. Copy/paste the code from `supabase/functions/revenuecat-webhook/index.ts`
5. Click **Deploy**

---

## Summary

- ✅ Webhook provides server-side backup for subscription sync
- ✅ Handles 5 key events (purchase, renewal, cancel, expiration, billing issue)
- ✅ Updates Supabase database automatically
- ✅ Works alongside in-app listener for redundancy
- ✅ Optional signature verification for extra security

**Next:** Test the complete flow with sandbox purchases (Phase 7)
