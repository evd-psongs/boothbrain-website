CREATE OR REPLACE FUNCTION public.get_roster_profiles(target_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_organization_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email
  FROM public.organization_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = target_organization_id
    AND is_organization_member(target_organization_id, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_roster_profiles(UUID) TO authenticated;
