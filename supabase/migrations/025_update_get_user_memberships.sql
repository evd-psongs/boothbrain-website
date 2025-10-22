DROP FUNCTION IF EXISTS public.get_user_memberships(UUID);

CREATE FUNCTION public.get_user_memberships(target_user_id UUID)
RETURNS TABLE (
  member_id UUID,
  organization_id UUID,
  user_id UUID,
  role public.user_role,
  joined_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID,
  invitation_token TEXT,
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  organization public.organizations
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    om.id,
    om.organization_id,
    om.user_id,
    om.role,
    om.joined_at,
    om.invited_by,
    om.invitation_token,
    om.invitation_accepted_at,
    org
  FROM public.organization_members AS om
  JOIN public.organizations AS org ON org.id = om.organization_id
  WHERE om.user_id = target_user_id
  ORDER BY om.joined_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_memberships(UUID) TO authenticated;
