-- 20250322_create_event_staged_inventory.sql
-- Adds support for staging inventory against upcoming events prior to activation.

create extension if not exists "pgcrypto";

create table if not exists event_staged_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  event_id text not null,
  name text not null,
  sku text,
  price_cents bigint not null default 0,
  quantity bigint not null default 0,
  low_stock_threshold bigint not null default 0,
  image_paths text[] not null default '{}'::text[],
  status text not null default 'staged',
  expected_release_at timestamptz,
  notes text,
  converted_item_id uuid references items (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table event_staged_inventory is 'Inventory that has been staged for an upcoming event before being moved into live stock.';

create index if not exists idx_event_staged_inventory_owner on event_staged_inventory (owner_user_id);
create index if not exists idx_event_staged_inventory_event on event_staged_inventory (event_id);
create index if not exists idx_event_staged_inventory_status on event_staged_inventory (status);

alter table event_staged_inventory enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Event staged inventory selectable by owner'
  ) then
    execute 'create policy "Event staged inventory selectable by owner" on public.event_staged_inventory for select using (owner_user_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_staged_inventory'
      and policyname = 'Event staged inventory modifiable by owner'
  ) then
    execute 'create policy "Event staged inventory modifiable by owner" on public.event_staged_inventory for all using (owner_user_id = auth.uid())';
  end if;
end $$;

-- Keep status constrained to known phases without relying on a new enum for now.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_staged_inventory_status_check'
      and conrelid = 'event_staged_inventory'::regclass
  ) then
    alter table event_staged_inventory
      add constraint event_staged_inventory_status_check
      check (status in ('staged', 'released', 'converted'));
  end if;
end $$;
