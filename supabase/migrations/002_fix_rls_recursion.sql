-- =====================================================
-- FIX FOR INFINITE RECURSION IN RLS POLICIES
-- =====================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "View organization members" ON organization_members;
DROP POLICY IF EXISTS "View organization items" ON items;
DROP POLICY IF EXISTS "View organization orders" ON orders;

-- =====================================================
-- RECREATE POLICIES WITHOUT RECURSION
-- =====================================================

-- Organization members: Simplified policy without self-reference
CREATE POLICY "View organization members" ON organization_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id
      FROM organization_members AS om
      WHERE om.user_id = auth.uid()
    )
  );

-- Items: Check organization membership directly
CREATE POLICY "View organization items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = items.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Orders: Check organization membership directly
CREATE POLICY "View organization orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = orders.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Add INSERT policies for items
CREATE POLICY "Insert organization items" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Add UPDATE policies for items
CREATE POLICY "Update organization items" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Add DELETE policies for items (admin/owner only)
CREATE POLICY "Delete organization items" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = items.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Add INSERT policies for orders
CREATE POLICY "Insert organization orders" ON orders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = orders.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Add UPDATE policies for orders
CREATE POLICY "Update organization orders" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = orders.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin', 'member')
    )
  );

-- =====================================================
-- TEMPORARY: Allow items/orders without organization
-- (for backward compatibility during migration)
-- =====================================================

-- Allow viewing items without organization_id (legacy data)
CREATE POLICY "View legacy items without org" ON items
  FOR SELECT USING (
    organization_id IS NULL
  );

-- Allow viewing orders without organization_id (legacy data)
CREATE POLICY "View legacy orders without org" ON orders
  FOR SELECT USING (
    organization_id IS NULL
  );

-- =====================================================
-- Add missing policies for other operations
-- =====================================================

-- Allow users to insert their own profile (handled by trigger)
CREATE POLICY "Insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow organization owners/admins to update organization
CREATE POLICY "Update organization" ON organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Allow organization owners/admins to insert members
CREATE POLICY "Insert organization members" ON organization_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members AS existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = auth.uid()
      AND existing.role IN ('owner', 'admin')
    )
    OR
    -- Allow first member (owner) when creating organization
    NOT EXISTS (
      SELECT 1 FROM organization_members AS existing
      WHERE existing.organization_id = organization_members.organization_id
    )
  );

-- Allow organization owners/admins to update members
CREATE POLICY "Update organization members" ON organization_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members AS existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = auth.uid()
      AND existing.role IN ('owner', 'admin')
    )
  );

-- Allow users to insert organizations
CREATE POLICY "Insert organizations" ON organizations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- View subscriptions for your organizations
CREATE POLICY "View organization subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = subscriptions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- View billing info for organizations you admin
CREATE POLICY "View organization billing" ON billing_info
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = billing_info.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- View usage tracking for your organizations
CREATE POLICY "View organization usage" ON usage_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = usage_tracking.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );