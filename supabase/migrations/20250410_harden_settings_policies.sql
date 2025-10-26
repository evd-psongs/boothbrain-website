-- 20250410_harden_settings_policies.sql
-- Reinstate scoped RLS on the shared settings table so only organization admins can mutate data.

alter table if exists public.settings enable row level security;

-- Remove permissive development policies.
drop policy if exists "Settings readable by everyone" on public.settings;
drop policy if exists "Settings insertable by everyone" on public.settings;
drop policy if exists "Settings updatable by everyone" on public.settings;

-- Recreate the organization-scoped policies used by the application code.
drop policy if exists "Settings readable by members" on public.settings;
create policy "Settings readable by members" on public.settings
  for select
  using (is_organization_member(settings.organization_id, auth.uid()));

drop policy if exists "Settings insertable by admins" on public.settings;
create policy "Settings insertable by admins" on public.settings
  for insert
  with check (is_organization_admin(settings.organization_id, auth.uid()));

drop policy if exists "Settings updatable by admins" on public.settings;
create policy "Settings updatable by admins" on public.settings
  for update
  using (is_organization_admin(settings.organization_id, auth.uid()))
  with check (is_organization_admin(settings.organization_id, auth.uid()));

