-- =====================================================
-- Phase 2 Monetization: Stripe Integration Support
-- =====================================================

-- Extend subscription_plans with trial metadata
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0;

-- Track whether subscription cancels at period end
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Track Stripe price interval (monthly/yearly) for analytics (optional)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS price_interval TEXT;

-- Seed/Update canonical plans with placeholders for Stripe price ids and trial lengths
UPDATE subscription_plans
SET
  trial_period_days = CASE tier
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 14
    WHEN 'enterprise' THEN 30
    ELSE trial_period_days
  END,
  stripe_price_id = CASE tier
    WHEN 'free' THEN NULL
    WHEN 'pro' THEN COALESCE(stripe_price_id, 'price_PRO_MONTHLY_PLACEHOLDER')
    WHEN 'enterprise' THEN COALESCE(stripe_price_id, 'price_ENTERPRISE_MONTHLY_PLACEHOLDER')
    ELSE stripe_price_id
  END,
  stripe_price_id_yearly = CASE tier
    WHEN 'free' THEN NULL
    WHEN 'pro' THEN COALESCE(stripe_price_id_yearly, 'price_PRO_YEARLY_PLACEHOLDER')
    WHEN 'enterprise' THEN COALESCE(stripe_price_id_yearly, 'price_ENTERPRISE_YEARLY_PLACEHOLDER')
    ELSE stripe_price_id_yearly
  END
WHERE tier IN ('free', 'pro', 'enterprise');

-- Helper function to get free plan id (raises if missing)
CREATE OR REPLACE FUNCTION get_default_free_plan_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_id UUID;
BEGIN
  SELECT id INTO plan_id FROM subscription_plans WHERE tier = 'free' LIMIT 1;
  IF plan_id IS NULL THEN
    RAISE EXCEPTION 'Free subscription plan is not configured';
  END IF;
  RETURN plan_id;
END;
$$;

-- Trigger function: ensure organizations always have a subscription row
CREATE OR REPLACE FUNCTION ensure_subscription_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_id UUID;
BEGIN
  plan_id := get_default_free_plan_id();

  INSERT INTO subscriptions (
    organization_id,
    plan_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    plan_id,
    'active',
    TIMEZONE('utc', NOW()),
    TIMEZONE('utc', NOW())
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_org_subscription ON organizations;
CREATE TRIGGER ensure_org_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_subscription_for_org();

-- Backfill existing organizations without a subscription row
INSERT INTO subscriptions (organization_id, plan_id, status, created_at, updated_at)
SELECT
  o.id,
  get_default_free_plan_id(),
  'active',
  TIMEZONE('utc', NOW()),
  TIMEZONE('utc', NOW())
FROM organizations o
LEFT JOIN subscriptions s ON s.organization_id = o.id
WHERE s.id IS NULL;

-- Index to speed up lookup by stripe ids
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON subscriptions (stripe_subscription_id);

