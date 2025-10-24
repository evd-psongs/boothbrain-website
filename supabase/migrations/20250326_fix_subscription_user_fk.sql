-- 20250326_fix_subscription_user_fk.sql
-- Allow deleting auth users by cascading subscriptions.user_id.

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE;
