-- Harden organization_members policies to avoid recursive RLS evaluation
-- and ensure multi-tenant scoping works as intended.

-- Ensure helper functions execute with a safe search path and bypass row security
ALTER FUNCTION public.is_organization_member(UUID, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_organization_member(UUID, UUID)
  SET row_security = off;

ALTER FUNCTION public.is_organization_admin(UUID, UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_organization_admin(UUID, UUID)
  SET row_security = off;

ALTER FUNCTION public.get_user_current_organization(UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_current_organization(UUID)
  SET row_security = off;

-- Replace existing organization_members policies that referenced the table
-- recursively (causing infinite recursion errors at runtime).
DROP POLICY IF EXISTS "View organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Add organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Insert organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Update organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view organization roster" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can add organization members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can update organization members" ON public.organization_members;

CREATE POLICY "Members can view organization roster" ON public.organization_members
  FOR SELECT USING (
    -- Always allow users to see their own membership row
    organization_members.user_id = auth.uid()
    OR
    -- Allow users to view other members when they belong to the same organization
    public.is_organization_member(organization_members.organization_id, auth.uid())
  );

CREATE POLICY "Admins can add organization members" ON public.organization_members
  FOR INSERT WITH CHECK (
    -- Organization owners/admins can manage membership
    public.is_organization_admin(organization_members.organization_id, auth.uid())
    OR
    (
      -- Allow creators to seed the initial owner record when organizations are
      -- provisioned through the client fallback path (no members exist yet).
      organization_members.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.organizations
        WHERE organizations.id = organization_members.organization_id
          AND organizations.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can update organization members" ON public.organization_members
  FOR UPDATE USING (
    public.is_organization_admin(organization_members.organization_id, auth.uid())
  )
  WITH CHECK (
    public.is_organization_admin(organization_members.organization_id, auth.uid())
  );
