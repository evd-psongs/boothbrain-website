DROP POLICY IF EXISTS "Add organization members" ON public.organization_members;
CREATE POLICY "Add organization members" ON public.organization_members
  FOR INSERT WITH CHECK (public.organization_members.user_id = auth.uid());
