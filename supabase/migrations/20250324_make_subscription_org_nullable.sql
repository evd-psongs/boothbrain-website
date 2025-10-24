-- 20250324_make_subscription_org_nullable.sql
-- Allow subscriptions to be owned directly by users without requiring an organization.

ALTER TABLE subscriptions
  ALTER COLUMN organization_id DROP NOT NULL;
