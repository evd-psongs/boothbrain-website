-- Recovery Codes Table for 2FA Account Recovery
-- Created: 2024-12-04
-- Purpose: Store hashed recovery codes for users to bypass 2FA if they lose access to authenticator app

-- Create recovery_codes table
CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique recovery codes (prevent duplicate hashes)
  CONSTRAINT unique_code_hash UNIQUE (code_hash)
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id
  ON recovery_codes(user_id);

-- Create index for unused codes (for faster validation during login)
CREATE INDEX IF NOT EXISTS idx_recovery_codes_unused
  ON recovery_codes(user_id, used_at)
  WHERE used_at IS NULL;

-- Add comments for documentation
COMMENT ON TABLE recovery_codes IS 'Stores hashed 2FA recovery codes for account recovery when user loses access to authenticator app';
COMMENT ON COLUMN recovery_codes.user_id IS 'User who owns these recovery codes';
COMMENT ON COLUMN recovery_codes.code_hash IS 'Bcrypt hash of the recovery code (never store plaintext)';
COMMENT ON COLUMN recovery_codes.used_at IS 'Timestamp when code was used (NULL = unused)';
COMMENT ON COLUMN recovery_codes.created_at IS 'When the recovery code was generated';

-- Enable Row Level Security
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own unused recovery codes
CREATE POLICY "Users can view their own unused recovery codes"
  ON recovery_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own recovery codes
CREATE POLICY "Users can insert their own recovery codes"
  ON recovery_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update (mark as used) their own recovery codes
CREATE POLICY "Users can update their own recovery codes"
  ON recovery_codes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own recovery codes
CREATE POLICY "Users can delete their own recovery codes"
  ON recovery_codes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Helper function: Get count of unused recovery codes for user
CREATE OR REPLACE FUNCTION get_unused_recovery_code_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM recovery_codes
    WHERE user_id = p_user_id
      AND used_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION get_unused_recovery_code_count IS 'Returns count of unused recovery codes for a user';

-- Helper function: Mark recovery code as used
CREATE OR REPLACE FUNCTION mark_recovery_code_used(p_code_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  UPDATE recovery_codes
  SET used_at = NOW()
  WHERE code_hash = p_code_hash
    AND used_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN v_rows_updated > 0;
END;
$$;

COMMENT ON FUNCTION mark_recovery_code_used IS 'Marks a recovery code as used. Returns true if code was found and marked, false otherwise.';
