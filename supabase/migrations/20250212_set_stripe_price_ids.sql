-- Set Stripe price identifiers for Standard (quarterly) and Pro (annual) plans in test mode

UPDATE subscription_plans
SET
  stripe_price_id = 'price_1SKBehPkMHyN5aKkFROkvPDt',
  updated_at = NOW()
WHERE tier = 'pro';

UPDATE subscription_plans
SET
  stripe_price_id_yearly = 'price_1SKBf6PkMHyN5aKkxoJ5iADk',
  updated_at = NOW()
WHERE tier = 'enterprise';
