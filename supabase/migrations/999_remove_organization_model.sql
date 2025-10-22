-- 999_remove_organization_model.sql
-- Step 1: add user-centric ownership columns

alter table if exists subscriptions
  add column if not exists user_id uuid references auth.users (id);

alter table if exists items
  add column if not exists owner_user_id uuid;

alter table if exists orders
  add column if not exists owner_user_id uuid,
  add column if not exists session_id uuid;

alter table if exists sessions
  add column if not exists host_user_id uuid;

-- Step 2: backfill ownership using existing organization data
update subscriptions s
set user_id = coalesce(om.user_id, o.created_by)
from organizations o
left join organization_members om on om.organization_id = o.id and om.role = 'owner'
where s.organization_id = o.id
  and s.user_id is null;

update items i
set owner_user_id = coalesce(om.user_id, o.created_by)
from organizations o
left join organization_members om on om.organization_id = o.id and om.role = 'owner'
where i.organization_id = o.id
  and i.owner_user_id is null;

update orders ord
set owner_user_id = coalesce(om.user_id, o.created_by)
from organizations o
left join organization_members om on om.organization_id = o.id and om.role = 'owner'
where ord.organization_id = o.id
  and ord.owner_user_id is null;

update sessions sess
set host_user_id = coalesce(om.user_id, o.created_by)
from organizations o
left join organization_members om on om.organization_id = o.id and om.role = 'owner'
where sess.organization_id = o.id
  and sess.host_user_id is null;

-- Step 3: enforce not-null constraints only when safe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE user_id IS NULL) THEN
    ALTER TABLE subscriptions ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM items WHERE owner_user_id IS NULL) THEN
    ALTER TABLE items ALTER COLUMN owner_user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE owner_user_id IS NULL) THEN
    ALTER TABLE orders ALTER COLUMN owner_user_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE host_user_id IS NULL) THEN
    ALTER TABLE sessions ALTER COLUMN host_user_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: update RLS policies (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'items' AND policyname = 'Items accessible by owner'
  ) THEN
    EXECUTE 'create policy "Items accessible by owner" on public.items for select using (owner_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'items' AND policyname = 'Items editable by owner'
  ) THEN
    EXECUTE 'create policy "Items editable by owner" on public.items for all using (owner_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders accessible by owner'
  ) THEN
    EXECUTE 'create policy "Orders accessible by owner" on public.orders for select using (owner_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders editable by owner'
  ) THEN
    EXECUTE 'create policy "Orders editable by owner" on public.orders for all using (owner_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'Sessions accessible by host'
  ) THEN
    EXECUTE 'create policy "Sessions accessible by host" on public.sessions for select using (host_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'Sessions editable by host'
  ) THEN
    EXECUTE 'create policy "Sessions editable by host" on public.sessions for all using (host_user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Subscriptions accessible by owner'
  ) THEN
    EXECUTE 'create policy "Subscriptions accessible by owner" on public.subscriptions for select using (user_id = auth.uid())';
  END IF;
END $$;

-- Step 5: helper function example
create or replace function get_user_active_session(target_user_id uuid)
returns table (id uuid, code text, event_id text, host_user_id uuid, created_at timestamptz)
as $$
  select id, code, event_id, host_user_id, created_at
  from sessions
  where host_user_id = target_user_id
  order by created_at desc
  limit 1;
$$ language sql security definer;

-- Step 6: cleanup once application is updated (optional)
-- alter table subscriptions drop column organization_id;
-- alter table items drop column organization_id;
-- alter table orders drop column organization_id;
-- alter table sessions drop column organization_id;
-- drop table organization_members;
-- drop table organizations;
