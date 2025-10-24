-- 20250325_remove_pro_trial.sql
-- Remove the 14-day free trial from the Pro subscription plan.

UPDATE subscription_plans
SET
  trial_period_days = NULL,
  updated_at = TIMEZONE('utc', NOW())
WHERE tier = 'pro';
