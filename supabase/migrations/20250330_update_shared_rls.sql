-- Allow active session participants to access host-owned records

create or replace view public.session_shared_users as
select
  m.host_user_id,
  m.participant_user_id
from public.session_memberships m
where m.active is true
  and m.host_user_id is not null
  and m.participant_user_id is not null;

comment on view public.session_shared_users is 'Maps host users to active participant user ids while sessions are running.';

-- Items RLS -------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'Items accessible by session participants'
  ) then
    execute 'create policy "Items accessible by session participants" on public.items for select using (exists (select 1 from public.session_shared_users s where s.host_user_id = items.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'Items editable by session participants'
  ) then
    execute 'create policy "Items editable by session participants" on public.items for all using (exists (select 1 from public.session_shared_users s where s.host_user_id = items.owner_user_id and s.participant_user_id = auth.uid())) with check (exists (select 1 from public.session_shared_users s where s.host_user_id = items.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;
end $$;

-- Event staged inventory RLS ---------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Staged inventory accessible by session participants'
  ) then
    execute 'create policy "Staged inventory accessible by session participants" on public.event_staged_inventory for select using (exists (select 1 from public.session_shared_users s where s.host_user_id = event_staged_inventory.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Staged inventory editable by session participants'
  ) then
    execute 'create policy "Staged inventory editable by session participants" on public.event_staged_inventory for all using (exists (select 1 from public.session_shared_users s where s.host_user_id = event_staged_inventory.owner_user_id and s.participant_user_id = auth.uid())) with check (exists (select 1 from public.session_shared_users s where s.host_user_id = event_staged_inventory.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;
end $$;

-- Orders RLS -------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Orders accessible by session participants'
  ) then
    execute 'create policy "Orders accessible by session participants" on public.orders for select using (exists (select 1 from public.session_shared_users s where s.host_user_id = orders.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Orders editable by session participants'
  ) then
    execute 'create policy "Orders editable by session participants" on public.orders for all using (exists (select 1 from public.session_shared_users s where s.host_user_id = orders.owner_user_id and s.participant_user_id = auth.uid())) with check (exists (select 1 from public.session_shared_users s where s.host_user_id = orders.owner_user_id and s.participant_user_id = auth.uid()))';
  end if;
end $$;
