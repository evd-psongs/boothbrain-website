-- Demote enterprise tier to standard by aligning pricing/metadata with standard plan

UPDATE subscription_plans
SET
  tier = 'pro',
  name = 'Standard',
  description = 'Quarterly cadence for active vendors with one seasonal pause included',
  price_cents = 900,
  price_yearly_cents = NULL,
  features = jsonb_build_object(
    'csv_export', true,
    'analytics', true,
    'custom_branding', false,
    'api_access', false,
    'priority_support', false,
    'pause_allowance', 1,
    'billing_cycle', 'quarterly',
    'billing_note', 'Billed every 3 months ($27 total) or $9 month-to-month',
    'monthly_price', 9
  )
WHERE tier IN ('pro', 'enterprise');
