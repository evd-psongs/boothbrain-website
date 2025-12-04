-- Migration: Add Apple In-App Purchase fields to subscriptions table
-- Date: 2025-12-04
-- Purpose: Support Apple IAP and multi-platform payment providers

-- Add Apple IAP fields to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_product_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_platform TEXT DEFAULT 'stripe' CHECK (payment_platform IN ('stripe', 'apple', 'google'));

-- Create index for faster lookups by Apple transaction ID
CREATE INDEX IF NOT EXISTS idx_subscriptions_apple_transaction
  ON subscriptions(apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

-- Create index for payment platform filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_platform
  ON subscriptions(payment_platform);

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.payment_platform IS 'Payment provider: stripe (web), apple (iOS IAP), google (Android IAP)';
COMMENT ON COLUMN subscriptions.apple_original_transaction_id IS 'Apple originalTransactionId - unique identifier for the subscription lifecycle';
COMMENT ON COLUMN subscriptions.apple_product_id IS 'Apple product ID purchased (e.g., boothbrain_pro_quarterly)';

-- Add unique constraint to prevent duplicate Apple subscriptions
-- Note: Using partial unique index to allow multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_apple_unique
  ON subscriptions(user_id, apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
