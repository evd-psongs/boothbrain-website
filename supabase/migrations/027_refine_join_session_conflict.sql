CREATE OR REPLACE FUNCTION public.join_session(session_code TEXT)
RETURNS TABLE (
  session_id UUID,
  organization_id UUID,
  event_id TEXT,
  host_user_id UUID
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
  WHERE s.code = session_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF session_row.is_active IS NOT TRUE OR session_row.expires_at < TIMEZONE('utc', NOW()) THEN
    RAISE EXCEPTION 'Session has expired';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (session_row.organization_id, auth.uid(), 'member', TIMEZONE('utc', NOW()))
  ON CONFLICT ON CONSTRAINT organization_members_organization_id_user_id_key DO NOTHING;

  UPDATE public.profiles
  SET current_organization_id = session_row.organization_id,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT session_row.id, session_row.organization_id, session_row.event_id, session_row.host_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_session(TEXT) TO authenticated;
