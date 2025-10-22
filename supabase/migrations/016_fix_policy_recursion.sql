-- Refresh RLS policies to use security-definer helpers and avoid recursive lookups

DROP POLICY IF EXISTS "View organizations user belongs to" ON public.organizations;
CREATE POLICY "View organizations user belongs to" ON public.organizations
  FOR SELECT USING (public.is_organization_member(public.organizations.id, auth.uid()));

DROP POLICY IF EXISTS "View organization members" ON public.organization_members;
CREATE POLICY "View organization members" ON public.organization_members
  FOR SELECT USING (public.is_organization_member(public.organization_members.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Add organization members" ON public.organization_members;
CREATE POLICY "Add organization members" ON public.organization_members
  FOR INSERT WITH CHECK (organization_members.user_id = auth.uid());

DROP POLICY IF EXISTS "Update organization members" ON public.organization_members;
CREATE POLICY "Update organization members" ON public.organization_members
  FOR UPDATE USING (public.is_organization_admin(public.organization_members.organization_id, auth.uid()));

DROP POLICY IF EXISTS "View organization items" ON public.items;
CREATE POLICY "View organization items" ON public.items
  FOR SELECT USING (public.is_organization_member(public.items.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Manage organization items" ON public.items;
CREATE POLICY "Manage organization items" ON public.items
  FOR ALL USING (public.is_organization_admin(public.items.organization_id, auth.uid()))
  WITH CHECK (public.is_organization_admin(public.items.organization_id, auth.uid()));

DROP POLICY IF EXISTS "View organization orders" ON public.orders;
CREATE POLICY "View organization orders" ON public.orders
  FOR SELECT USING (public.is_organization_member(public.orders.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Manage organization orders" ON public.orders;
CREATE POLICY "Manage organization orders" ON public.orders
  FOR ALL USING (public.is_organization_admin(public.orders.organization_id, auth.uid()))
  WITH CHECK (public.is_organization_admin(public.orders.organization_id, auth.uid()));

DROP POLICY IF EXISTS "View order items" ON public.order_items;
CREATE POLICY "View order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE public.orders.id = public.order_items.order_id
        AND public.is_organization_member(public.orders.organization_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Manage order items" ON public.order_items;
CREATE POLICY "Manage order items" ON public.order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE public.orders.id = public.order_items.order_id
        AND public.is_organization_admin(public.orders.organization_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE public.orders.id = public.order_items.order_id
        AND public.is_organization_admin(public.orders.organization_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Settings readable by members" ON public.settings;
CREATE POLICY "Settings readable by members" ON public.settings
  FOR SELECT USING (public.is_organization_member(public.settings.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Settings insertable by admins" ON public.settings;
CREATE POLICY "Settings insertable by admins" ON public.settings
  FOR INSERT WITH CHECK (public.is_organization_admin(public.settings.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Settings updatable by admins" ON public.settings;
CREATE POLICY "Settings updatable by admins" ON public.settings
  FOR UPDATE USING (public.is_organization_admin(public.settings.organization_id, auth.uid()))
  WITH CHECK (public.is_organization_admin(public.settings.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Members can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Members can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Hosts can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Hosts can delete sessions" ON public.sessions;

CREATE POLICY "Members can read sessions" ON public.sessions
  FOR SELECT USING (public.is_organization_member(sessions.organization_id, auth.uid()));

CREATE POLICY "Members can create sessions" ON public.sessions
  FOR INSERT WITH CHECK (
    sessions.host_user_id = auth.uid()
    AND public.is_organization_member(sessions.organization_id, auth.uid())
  );

CREATE POLICY "Hosts can update sessions" ON public.sessions
  FOR UPDATE USING (sessions.host_user_id = auth.uid())
  WITH CHECK (sessions.host_user_id = auth.uid());

CREATE POLICY "Hosts can delete sessions" ON public.sessions
  FOR DELETE USING (sessions.host_user_id = auth.uid());
