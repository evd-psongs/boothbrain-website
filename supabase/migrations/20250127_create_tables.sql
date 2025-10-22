-- ============================================================================
-- BoothBrain multi-tenant bootstrap (legacy single-file setup)
-- ----------------------------------------------------------------------------
-- This script now mirrors the production schema so that running it in isolation
-- produces the same tables, columns, and policies that the Expo app expects.
-- We still recommend applying the full migrations, but this keeps the fallback
-- path compatible with Supabase auth + organizations.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums ----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
  END IF;
END$$;

-- Profiles -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  current_organization_id UUID
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_organization_id UUID;

-- Organizations --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT organization_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS settings JSONB;
ALTER TABLE organizations
  ALTER COLUMN settings SET DEFAULT '{}'::JSONB;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organization_slug_format;
ALTER TABLE organizations
  ADD CONSTRAINT organization_slug_format CHECK (slug ~ '^[a-z0-9-]+$');

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_current_org_fk;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_current_org_fk
  FOREIGN KEY (current_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Organization Members -------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  invited_by UUID REFERENCES profiles(id),
  invitation_token TEXT UNIQUE,
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (organization_id, user_id)
);

-- Subscriptions & Billing ----------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  price_yearly_cents INTEGER,
  max_orders_per_month INTEGER,
  max_inventory_items INTEGER,
  max_team_members INTEGER,
  max_events INTEGER,
  features JSONB DEFAULT '{}',
  stripe_price_id TEXT,
  stripe_price_id_yearly TEXT,
  trial_period_days INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trialing',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  payment_method_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS billing_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT,
  tax_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  orders_count INTEGER DEFAULT 0,
  inventory_items_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  team_members_count INTEGER DEFAULT 0,
  total_revenue_cents BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (organization_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT settings_organization_key_unique UNIQUE (organization_id, key)
);

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE settings
  ALTER COLUMN created_at SET DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE settings
  ALTER COLUMN updated_at SET DEFAULT TIMEZONE('utc', NOW());

ALTER TABLE settings
  DROP CONSTRAINT IF EXISTS settings_organization_key_unique;
ALTER TABLE settings
  ADD CONSTRAINT settings_organization_key_unique UNIQUE (organization_id, key);

ALTER TABLE settings
  DROP CONSTRAINT IF EXISTS settings_organization_id_fkey;
ALTER TABLE settings
  ADD CONSTRAINT settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Inventory & Orders ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  price_cents BIGINT NOT NULL,
  sku TEXT,
  quantity BIGINT NOT NULL DEFAULT 0,
  low_stock_threshold BIGINT NOT NULL DEFAULT 5,
  image_paths TEXT[] DEFAULT '{}'::TEXT[],
  event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS low_stock_threshold BIGINT;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS image_paths TEXT[];

ALTER TABLE items
  ALTER COLUMN low_stock_threshold SET DEFAULT 5;

ALTER TABLE items
  ALTER COLUMN image_paths SET DEFAULT '{}'::TEXT[];

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_organization_id_fkey;
ALTER TABLE items
  ADD CONSTRAINT items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE items
  DROP CONSTRAINT IF EXISTS items_created_by_fkey;
ALTER TABLE items
  ADD CONSTRAINT items_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_items_event_id ON items(event_id);
CREATE INDEX IF NOT EXISTS idx_items_organization ON items(organization_id);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL,
  total_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  tax_rate_bps BIGINT,
  event_id TEXT,
  buyer_name TEXT,
  buyer_contact TEXT,
  description TEXT,
  deposit_taken BOOLEAN NOT NULL DEFAULT FALSE,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_cents BIGINT;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_rate_bps BIGINT;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deposit_taken BOOLEAN;

ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE orders
  ALTER COLUMN tax_cents SET DEFAULT 0;
ALTER TABLE orders
  ALTER COLUMN deposit_taken SET DEFAULT FALSE;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_organization_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_created_by_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_device_id ON orders(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_organization ON orders(organization_id);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL,
  price_cents BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON order_items(item_id);

-- Sessions for device hand-off ------------------------------------------------
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_device_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (TIMEZONE('utc', NOW()) + INTERVAL '72 hours'),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_organization ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON sessions(event_id);

-- Functions & Triggers -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_info_updated_at ON billing_info;
CREATE TRIGGER update_billing_info_updated_at BEFORE UPDATE ON billing_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper functions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION is_organization_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_organization_admin(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = user_id
      AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_current_organization(user_id UUID)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM organization_members om
  WHERE om.user_id = user_id
  ORDER BY joined_at DESC
  LIMIT 1;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE sessions
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

-- Default data ---------------------------------------------------------------
INSERT INTO subscription_plans (tier, name, description, price_cents, price_yearly_cents, max_orders_per_month,
  max_inventory_items, max_team_members, max_events, features, trial_period_days, is_active)
VALUES
  ('free', 'Free', 'Perfect for trying out BoothBrain', 0, 0, 50, 25, 1, 1,
   '{"csv_export": false, "analytics": false, "custom_branding": false, "api_access": false}'::JSONB, 14, TRUE),
  ('pro', 'Pro', 'For growing businesses and regular vendors', 2900, 29900, 1000, 500, 5, 10,
   '{"csv_export": true, "analytics": true, "custom_branding": false, "api_access": false}'::JSONB, 14, TRUE),
  ('enterprise', 'Enterprise', 'For large teams and high-volume sellers', 9900, 99900, NULL, NULL, NULL, NULL,
   '{"csv_export": true, "analytics": true, "custom_branding": true, "api_access": true, "priority_support": true}'::JSONB, NULL, TRUE)
ON CONFLICT (tier) DO NOTHING;

-- Row Level Security ---------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Organizations policies -----------------------------------------------------
DROP POLICY IF EXISTS "View organizations user belongs to" ON organizations;
CREATE POLICY "View organizations user belongs to" ON organizations
  FOR SELECT USING (is_organization_member(organizations.id, auth.uid()));

DROP POLICY IF EXISTS "Create organization" ON organizations;
CREATE POLICY "Create organization" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Organization members policies ---------------------------------------------
DROP POLICY IF EXISTS "View organization members" ON organization_members;
CREATE POLICY "View organization members" ON organization_members
  FOR SELECT USING (is_organization_member(organization_members.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Add organization members" ON organization_members;
CREATE POLICY "Add organization members" ON organization_members
  FOR INSERT WITH CHECK (organization_members.user_id = auth.uid());

DROP POLICY IF EXISTS "Update organization members" ON organization_members;
CREATE POLICY "Update organization members" ON organization_members
  FOR UPDATE USING (is_organization_admin(organization_members.organization_id, auth.uid()));

-- Subscription plans (read-only public) -------------------------------------
DROP POLICY IF EXISTS "View active subscription plans" ON subscription_plans;
CREATE POLICY "View active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = TRUE);

-- Items policies -------------------------------------------------------------
DROP POLICY IF EXISTS "View organization items" ON items;
CREATE POLICY "View organization items" ON items
  FOR SELECT USING (is_organization_member(items.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Manage organization items" ON items;
CREATE POLICY "Manage organization items" ON items
  FOR ALL USING (is_organization_admin(items.organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(items.organization_id, auth.uid()));

-- Orders policies ------------------------------------------------------------
DROP POLICY IF EXISTS "View organization orders" ON orders;
CREATE POLICY "View organization orders" ON orders
  FOR SELECT USING (is_organization_member(orders.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Manage organization orders" ON orders;
CREATE POLICY "Manage organization orders" ON orders
  FOR ALL USING (is_organization_admin(orders.organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(orders.organization_id, auth.uid()));

-- Order items policies -------------------------------------------------------
DROP POLICY IF EXISTS "View order items" ON order_items;
CREATE POLICY "View order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND is_organization_member(orders.organization_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Manage order items" ON order_items;
CREATE POLICY "Manage order items" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND is_organization_admin(orders.organization_id, auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND is_organization_admin(orders.organization_id, auth.uid())
    )
  );

-- Sessions policies ----------------------------------------------------------
DROP POLICY IF EXISTS "Members can read sessions" ON sessions;
DROP POLICY IF EXISTS "Members can create sessions" ON sessions;
DROP POLICY IF EXISTS "Hosts can update sessions" ON sessions;
DROP POLICY IF EXISTS "Hosts can delete sessions" ON sessions;

CREATE POLICY "Members can read sessions" ON sessions
  FOR SELECT USING (is_organization_member(sessions.organization_id, auth.uid()));

CREATE POLICY "Members can create sessions" ON sessions
  FOR INSERT WITH CHECK (
    sessions.host_user_id = auth.uid()
    AND is_organization_member(sessions.organization_id, auth.uid())
  );

CREATE POLICY "Hosts can update sessions" ON sessions
  FOR UPDATE USING (sessions.host_user_id = auth.uid())
  WITH CHECK (sessions.host_user_id = auth.uid());

CREATE POLICY "Hosts can delete sessions" ON sessions
  FOR DELETE USING (sessions.host_user_id = auth.uid());

-- Settings policies ----------------------------------------------------------
DROP POLICY IF EXISTS "Settings readable by members" ON settings;
CREATE POLICY "Settings readable by members" ON settings
  FOR SELECT USING (is_organization_member(settings.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Settings insertable by admins" ON settings;
CREATE POLICY "Settings insertable by admins" ON settings
  FOR INSERT WITH CHECK (is_organization_admin(settings.organization_id, auth.uid()));

DROP POLICY IF EXISTS "Settings updatable by admins" ON settings;
CREATE POLICY "Settings updatable by admins" ON settings
  FOR UPDATE USING (is_organization_admin(settings.organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(settings.organization_id, auth.uid()));

-- Realtime publication -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE items, orders, order_items;
  ELSE
    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'items';
    IF NOT FOUND THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE items;
    END IF;

    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders';
    IF NOT FOUND THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    PERFORM 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_items';
    IF NOT FOUND THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;
  END IF;
END$$;

-- ============================================================================
-- End of bootstrap. For future upgrades, prefer running `npx supabase db push`
-- so new migrations (Stripe integration, improved RLS, etc.) are applied too.
-- ============================================================================
