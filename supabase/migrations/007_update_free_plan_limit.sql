-- Adjust free plan limits for the interim freemium experience
UPDATE subscription_plans
SET
  max_inventory_items = 3,
  max_orders_per_month = LEAST(COALESCE(max_orders_per_month, 50), 50),
  trial_period_days = 0
WHERE tier = 'free';
