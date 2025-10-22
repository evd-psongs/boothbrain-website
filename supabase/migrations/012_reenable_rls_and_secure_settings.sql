-- Re-enable row level security across core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Harden settings table for per-organization configuration
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Ensure we do not duplicate the legacy primary key
ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_pkey;

-- Enforce uniqueness per organization/key pair
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'settings_organization_key_unique'
  ) THEN
    ALTER TABLE public.settings
      ADD CONSTRAINT settings_organization_key_unique UNIQUE (organization_id, key);
  END IF;
END$$;

-- Replace permissive settings policies with organization-scoped rules
DROP POLICY IF EXISTS "Settings readable by everyone" ON public.settings;
DROP POLICY IF EXISTS "Settings insertable by everyone" ON public.settings;
DROP POLICY IF EXISTS "Settings updatable by everyone" ON public.settings;
DROP POLICY IF EXISTS "Settings readable by members" ON public.settings;
DROP POLICY IF EXISTS "Settings insertable by admins" ON public.settings;
DROP POLICY IF EXISTS "Settings updatable by admins" ON public.settings;

CREATE POLICY "Settings readable by members" ON public.settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = public.settings.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Settings insertable by admins" ON public.settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = public.settings.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Settings updatable by admins" ON public.settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = public.settings.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = public.settings.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Ensure legacy settings rows without organization scope do not linger
ALTER TABLE public.settings REPLICA IDENTITY FULL;
DELETE FROM public.settings WHERE organization_id IS NULL;

ALTER TABLE public.settings
  ALTER COLUMN organization_id SET NOT NULL;
