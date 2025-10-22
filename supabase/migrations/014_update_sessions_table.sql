-- Ensure we have UUID generation available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Recreate sessions table with organization scoping and tighter policies
DROP TABLE IF EXISTS public.sessions CASCADE;

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc', NOW()) + INTERVAL '72 hours'),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON public.sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_organization ON public.sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON public.sessions(event_id);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sessions are viewable by everyone" ON public.sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Hosts can update their sessions" ON public.sessions;

CREATE POLICY "Members can read sessions" ON public.sessions
  FOR SELECT USING (is_organization_member(public.sessions.organization_id, auth.uid()));

CREATE POLICY "Members can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (
    host_user_id = auth.uid()
    AND is_organization_member(public.sessions.organization_id, auth.uid())
  );

CREATE POLICY "Hosts can update sessions" ON public.sessions
  FOR UPDATE USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Hosts can delete sessions" ON public.sessions
  FOR DELETE USING (host_user_id = auth.uid());

CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE public.sessions
  SET is_active = false
  WHERE expires_at < TIMEZONE('utc', NOW()) AND is_active = true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION join_session(session_code TEXT)
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
  FROM public.sessions
  WHERE code = session_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF session_row.is_active IS NOT TRUE OR session_row.expires_at < TIMEZONE('utc', NOW()) THEN
    RAISE EXCEPTION 'Session has expired';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, joined_at)
  VALUES (session_row.organization_id, auth.uid(), 'member', TIMEZONE('utc', NOW()))
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET current_organization_id = session_row.organization_id,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT session_row.id, session_row.organization_id, session_row.event_id, session_row.host_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION join_session(TEXT) TO authenticated;
