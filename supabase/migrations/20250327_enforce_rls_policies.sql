-- 20250327_enforce_rls_policies.sql
-- Harden row level security on user-owned tables to ensure app clients can only touch their own data.

alter table if exists items enable row level security;
alter table if exists event_staged_inventory enable row level security;
alter table if exists subscriptions enable row level security;
alter table if exists orders enable row level security;
alter table if exists user_settings enable row level security;

-- Items ----------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'Items readable by owner'
  ) then
    execute 'create policy "Items readable by owner" on public.items for select using (owner_user_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'Items writeable by owner'
  ) then
    execute 'create policy "Items writeable by owner" on public.items for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())';
  end if;
end $$;

-- Event staged inventory ------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Event staged inventory readable by owner'
  ) then
    execute 'create policy "Event staged inventory readable by owner" on public.event_staged_inventory for select using (owner_user_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Event staged inventory writeable by owner'
  ) then
    execute 'create policy "Event staged inventory writeable by owner" on public.event_staged_inventory for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())';
  end if;
end $$;

-- Orders ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Orders readable by owner'
  ) then
    execute 'create policy "Orders readable by owner" on public.orders for select using (owner_user_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Orders writeable by owner'
  ) then
    execute 'create policy "Orders writeable by owner" on public.orders for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())';
  end if;
end $$;

-- Subscriptions --------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Subscriptions readable by owner'
  ) then
    execute 'create policy "Subscriptions readable by owner" on public.subscriptions for select using (user_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Subscriptions writeable by owner'
  ) then
    execute 'create policy "Subscriptions writeable by owner" on public.subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;

-- User settings --------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'User settings readable by owner'
  ) then
    execute 'create policy "User settings readable by owner" on public.user_settings for select using (user_id = auth.uid())';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'User settings writeable by owner'
  ) then
    execute 'create policy "User settings writeable by owner" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end $$;
