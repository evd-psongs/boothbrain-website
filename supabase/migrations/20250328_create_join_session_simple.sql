-- 20250327_create_join_session_simple.sql
-- Provide a simple, organization-free session join helper for the mobile client.

CREATE OR REPLACE FUNCTION public.join_session_simple(session_code TEXT)
RETURNS TABLE (
  code TEXT,
  event_id TEXT,
  host_user_id UUID,
  host_device_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_row public.sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO session_row
  FROM public.sessions AS s
  WHERE s.code = session_code
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF session_row.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  IF session_row.expires_at IS NOT NULL AND session_row.expires_at < TIMEZONE('utc', NOW()) THEN
    RAISE EXCEPTION 'Session has expired';
  END IF;

  RETURN QUERY
  SELECT session_row.code, session_row.event_id, session_row.host_user_id, session_row.host_device_id, session_row.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_session_simple(TEXT) TO authenticated;
