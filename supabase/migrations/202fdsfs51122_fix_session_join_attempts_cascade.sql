-- =====================================================
-- FIX: Enable CASCADE DELETE for session_join_attempts
-- These were missed in the previous migration
-- =====================================================

-- Fix host_user_id constraint
ALTER TABLE public.session_join_attempts
DROP CONSTRAINT IF EXISTS session_join_attempts_host_user_id_fkey;

ALTER TABLE public.session_join_attempts
ADD CONSTRAINT session_join_attempts_host_user_id_fkey
FOREIGN KEY (host_user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Fix participant_user_id constraint
ALTER TABLE public.session_join_attempts
DROP CONSTRAINT IF EXISTS session_join_attempts_participant_user_id_fkey;

ALTER TABLE public.session_join_attempts
ADD CONSTRAINT session_join_attempts_participant_user_id_fkey
FOREIGN KEY (participant_user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'session_join_attempts CASCADE constraints updated!';
  RAISE NOTICE 'All user deletion constraints are now fully configured.';
END $$;
