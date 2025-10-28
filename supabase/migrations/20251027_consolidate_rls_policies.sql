-- 20251027_consolidate_rls_policies.sql
-- Consolidate row level security policies and wrap auth helpers in SELECT
-- statements to satisfy Supabase performance linting.

-- Items ----------------------------------------------------------------------
drop policy if exists "View organization items" on public.items;
drop policy if exists "View legacy items without org" on public.items;
drop policy if exists "Items accessible by owner" on public.items;
drop policy if exists "Items readable by owner" on public.items;
drop policy if exists "Items accessible by session participants" on public.items;
drop policy if exists "Items editable by owner" on public.items;
drop policy if exists "Items editable by session participants" on public.items;
drop policy if exists "Items writeable by owner" on public.items;
drop policy if exists "Manage organization items" on public.items;
drop policy if exists "Manage legacy items" on public.items;
drop policy if exists "Insert organization items" on public.items;
drop policy if exists "Enable insert for all users" on public.items;
drop policy if exists "Enable update for all users" on public.items;
drop policy if exists "Enable delete for all users" on public.items;
drop policy if exists "Delete organization items" on public.items;

create policy "Items select access" on public.items
  for select using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.items.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_member(public.items.organization_id, (select auth.uid()))
  );

create policy "Items insert access" on public.items
  for insert with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.items.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.items.organization_id, (select auth.uid()))
  );

create policy "Items update access" on public.items
  for update using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.items.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.items.organization_id, (select auth.uid()))
  )
  with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.items.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.items.organization_id, (select auth.uid()))
  );

create policy "Items delete access" on public.items
  for delete using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.items.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.items.organization_id, (select auth.uid()))
  );

-- Orders ---------------------------------------------------------------------
drop policy if exists "View organization orders" on public.orders;
drop policy if exists "View legacy orders without org" on public.orders;
drop policy if exists "Orders accessible by owner" on public.orders;
drop policy if exists "Orders readable by owner" on public.orders;
drop policy if exists "Orders accessible by session participants" on public.orders;
drop policy if exists "Orders editable by owner" on public.orders;
drop policy if exists "Orders editable by session participants" on public.orders;
drop policy if exists "Orders writeable by owner" on public.orders;
drop policy if exists "Manage organization orders" on public.orders;
drop policy if exists "Insert organization orders" on public.orders;
drop policy if exists "Enable insert for all users" on public.orders;
drop policy if exists "Enable update for all users" on public.orders;
drop policy if exists "Enable delete for all users" on public.orders;
drop policy if exists "Delete organization orders" on public.orders;

create policy "Orders select access" on public.orders
  for select using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.orders.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_member(public.orders.organization_id, (select auth.uid()))
  );

create policy "Orders insert access" on public.orders
  for insert with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.orders.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.orders.organization_id, (select auth.uid()))
  );

create policy "Orders update access" on public.orders
  for update using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.orders.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.orders.organization_id, (select auth.uid()))
  )
  with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.orders.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.orders.organization_id, (select auth.uid()))
  );

create policy "Orders delete access" on public.orders
  for delete using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.orders.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
    or public.is_organization_admin(public.orders.organization_id, (select auth.uid()))
  );

-- Order items ----------------------------------------------------------------
drop policy if exists "View order items" on public.order_items;
drop policy if exists "Manage order items" on public.order_items;
drop policy if exists "Enable read access for all users" on public.order_items;
drop policy if exists "Enable insert for all users" on public.order_items;

create policy "Order items select access" on public.order_items
  for select using (
    exists (
      select 1
      from public.orders ord
      where ord.id = public.order_items.order_id
        and (
          ord.owner_user_id = (select auth.uid())
          or public.is_organization_member(ord.organization_id, (select auth.uid()))
          or exists (
            select 1
            from public.session_shared_users s
            where s.host_user_id = ord.owner_user_id
              and s.participant_user_id = (select auth.uid())
          )
        )
    )
  );

create policy "Order items insert access" on public.order_items
  for insert with check (
    exists (
      select 1
      from public.orders ord
      where ord.id = public.order_items.order_id
        and (
          ord.owner_user_id = (select auth.uid())
          or public.is_organization_admin(ord.organization_id, (select auth.uid()))
          or exists (
            select 1
            from public.session_shared_users s
            where s.host_user_id = ord.owner_user_id
              and s.participant_user_id = (select auth.uid())
          )
        )
    )
  );

create policy "Order items update access" on public.order_items
  for update using (
    exists (
      select 1
      from public.orders ord
      where ord.id = public.order_items.order_id
        and (
          ord.owner_user_id = (select auth.uid())
          or public.is_organization_admin(ord.organization_id, (select auth.uid()))
          or exists (
            select 1
            from public.session_shared_users s
            where s.host_user_id = ord.owner_user_id
              and s.participant_user_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.orders ord
      where ord.id = public.order_items.order_id
        and (
          ord.owner_user_id = (select auth.uid())
          or public.is_organization_admin(ord.organization_id, (select auth.uid()))
          or exists (
            select 1
            from public.session_shared_users s
            where s.host_user_id = ord.owner_user_id
              and s.participant_user_id = (select auth.uid())
          )
        )
    )
  );

create policy "Order items delete access" on public.order_items
  for delete using (
    exists (
      select 1
      from public.orders ord
      where ord.id = public.order_items.order_id
        and (
          ord.owner_user_id = (select auth.uid())
          or public.is_organization_admin(ord.organization_id, (select auth.uid()))
          or exists (
            select 1
            from public.session_shared_users s
            where s.host_user_id = ord.owner_user_id
              and s.participant_user_id = (select auth.uid())
          )
        )
    )
  );

-- Event staged inventory -----------------------------------------------------
drop policy if exists "Event staged inventory selectable by owner" on public.event_staged_inventory;
drop policy if exists "Event staged inventory readable by owner" on public.event_staged_inventory;
drop policy if exists "Event staged inventory modifiable by owner" on public.event_staged_inventory;
drop policy if exists "Event staged inventory writeable by owner" on public.event_staged_inventory;
drop policy if exists "Staged inventory accessible by session participants" on public.event_staged_inventory;
drop policy if exists "Staged inventory editable by session participants" on public.event_staged_inventory;

create policy "Event staged inventory select access" on public.event_staged_inventory
  for select using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.event_staged_inventory.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

create policy "Event staged inventory insert access" on public.event_staged_inventory
  for insert with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.event_staged_inventory.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

create policy "Event staged inventory update access" on public.event_staged_inventory
  for update using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.event_staged_inventory.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.event_staged_inventory.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

create policy "Event staged inventory delete access" on public.event_staged_inventory
  for delete using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.event_staged_inventory.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

-- Events ---------------------------------------------------------------------
drop policy if exists "Events accessible by owner" on public.events;
drop policy if exists "Events editable by owner" on public.events;
drop policy if exists "Events accessible by session participants" on public.events;
drop policy if exists "Events editable by session participants" on public.events;

create policy "Events select access" on public.events
  for select using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.events.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

create policy "Events insert access" on public.events
  for insert with check (
    owner_user_id = (select auth.uid())
  );

create policy "Events update access" on public.events
  for update using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.events.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.events.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

create policy "Events delete access" on public.events
  for delete using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1
      from public.session_shared_users s
      where s.host_user_id = public.events.owner_user_id
        and s.participant_user_id = (select auth.uid())
    )
  );

-- Sessions -------------------------------------------------------------------
drop policy if exists "Members can read sessions" on public.sessions;
drop policy if exists "Members can create sessions" on public.sessions;
drop policy if exists "Hosts can update sessions" on public.sessions;
drop policy if exists "Hosts can delete sessions" on public.sessions;
drop policy if exists "Sessions accessible by host" on public.sessions;
drop policy if exists "Sessions editable by host" on public.sessions;

create policy "Sessions select access" on public.sessions
  for select using (host_user_id = (select auth.uid()));

create policy "Sessions insert access" on public.sessions
  for insert with check (host_user_id = (select auth.uid()));

create policy "Sessions update access" on public.sessions
  for update using (host_user_id = (select auth.uid()))
  with check (host_user_id = (select auth.uid()));

create policy "Sessions delete access" on public.sessions
  for delete using (host_user_id = (select auth.uid()));

-- Session memberships --------------------------------------------------------
drop policy if exists "Session memberships viewable by self" on public.session_memberships;
drop policy if exists "Session memberships manageable by host" on public.session_memberships;

create policy "Session memberships select access" on public.session_memberships
  for select using (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  );

create policy "Session memberships insert access" on public.session_memberships
  for insert with check (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  );

create policy "Session memberships update access" on public.session_memberships
  for update using (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  )
  with check (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  );

create policy "Session memberships delete access" on public.session_memberships
  for delete using (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  );

-- Session join attempts ------------------------------------------------------
drop policy if exists "Join attempts viewable by participant" on public.session_join_attempts;
drop policy if exists "Join attempts viewable by host" on public.session_join_attempts;

create policy "Session join attempts select access" on public.session_join_attempts
  for select using (
    participant_user_id = (select auth.uid())
    or host_user_id = (select auth.uid())
  );

-- Events session helpers already handled above --------------------------------

-- Subscriptions --------------------------------------------------------------
drop policy if exists "View organization subscriptions" on public.subscriptions;
drop policy if exists "Subscriptions accessible by owner" on public.subscriptions;
drop policy if exists "Subscriptions readable by owner" on public.subscriptions;
drop policy if exists "Subscriptions writeable by owner" on public.subscriptions;

create policy "Subscriptions select access" on public.subscriptions
  for select using (
    user_id = (select auth.uid())
    or public.is_organization_member(public.subscriptions.organization_id, (select auth.uid()))
  );

create policy "Subscriptions insert access" on public.subscriptions
  for insert with check (
    user_id = (select auth.uid())
    or public.is_organization_admin(public.subscriptions.organization_id, (select auth.uid()))
  );

create policy "Subscriptions update access" on public.subscriptions
  for update using (
    user_id = (select auth.uid())
    or public.is_organization_admin(public.subscriptions.organization_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_organization_admin(public.subscriptions.organization_id, (select auth.uid()))
  );

create policy "Subscriptions delete access" on public.subscriptions
  for delete using (
    user_id = (select auth.uid())
    or public.is_organization_admin(public.subscriptions.organization_id, (select auth.uid()))
  );

-- User settings --------------------------------------------------------------
drop policy if exists "User settings readable by owner" on public.user_settings;
drop policy if exists "User settings writeable by owner" on public.user_settings;

create policy "User settings select access" on public.user_settings
  for select using (user_id = (select auth.uid()));

create policy "User settings insert access" on public.user_settings
  for insert with check (user_id = (select auth.uid()));

create policy "User settings update access" on public.user_settings
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "User settings delete access" on public.user_settings
  for delete using (user_id = (select auth.uid()));

-- Profiles -------------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;

create policy "Profiles select access" on public.profiles
  for select using (id = (select auth.uid()));

create policy "Profiles update access" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Organizations --------------------------------------------------------------
drop policy if exists "View organizations user belongs to" on public.organizations;
drop policy if exists "Create organization" on public.organizations;
drop policy if exists "Insert organizations" on public.organizations;

create policy "Organizations select access" on public.organizations
  for select using (
    public.is_organization_member(public.organizations.id, (select auth.uid()))
  );

create policy "Organizations insert access" on public.organizations
  for insert with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
  );

-- Organization members -------------------------------------------------------
drop policy if exists "View organization members" on public.organization_members;
drop policy if exists "Members can view organization roster" on public.organization_members;
drop policy if exists "Add organization members" on public.organization_members;
drop policy if exists "Insert organization members" on public.organization_members;
drop policy if exists "Admins can add organization members" on public.organization_members;
drop policy if exists "Update organization members" on public.organization_members;
drop policy if exists "Admins can update organization members" on public.organization_members;

create policy "Organization members select access" on public.organization_members
  for select using (
    public.organization_members.user_id = (select auth.uid())
    or public.is_organization_member(public.organization_members.organization_id, (select auth.uid()))
  );

create policy "Organization members insert access" on public.organization_members
  for insert with check (
    public.is_organization_admin(public.organization_members.organization_id, (select auth.uid()))
    or (
      public.organization_members.user_id = (select auth.uid())
      and exists (
        select 1
        from public.organizations
        where public.organizations.id = public.organization_members.organization_id
          and public.organizations.created_by = (select auth.uid())
      )
    )
  );

create policy "Organization members update access" on public.organization_members
  for update using (
    public.is_organization_admin(public.organization_members.organization_id, (select auth.uid()))
  )
  with check (
    public.is_organization_admin(public.organization_members.organization_id, (select auth.uid()))
  );

create policy "Organization members delete access" on public.organization_members
  for delete using (
    public.is_organization_admin(public.organization_members.organization_id, (select auth.uid()))
  );

-- Billing info ---------------------------------------------------------------
drop policy if exists "View organization billing" on public.billing_info;

create policy "Billing info select access" on public.billing_info
  for select using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = public.billing_info.organization_id
        and om.user_id = (select auth.uid())
        and om.role in ('owner', 'admin')
    )
  );

-- Usage tracking -------------------------------------------------------------
drop policy if exists "View organization usage" on public.usage_tracking;

create policy "Usage tracking select access" on public.usage_tracking
  for select using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = public.usage_tracking.organization_id
        and om.user_id = (select auth.uid())
    )
  );

-- Settings -------------------------------------------------------------------
drop policy if exists "Settings readable by everyone" on public.settings;
drop policy if exists "Settings insertable by everyone" on public.settings;
drop policy if exists "Settings updatable by everyone" on public.settings;
drop policy if exists "Settings readable by members" on public.settings;
drop policy if exists "Settings insertable by admins" on public.settings;
drop policy if exists "Settings updatable by admins" on public.settings;

create policy "Settings select access" on public.settings
  for select using (
    public.is_organization_member(public.settings.organization_id, (select auth.uid()))
  );

create policy "Settings insert access" on public.settings
  for insert with check (
    public.is_organization_admin(public.settings.organization_id, (select auth.uid()))
  );

create policy "Settings update access" on public.settings
  for update using (
    public.is_organization_admin(public.settings.organization_id, (select auth.uid()))
  )
  with check (
    public.is_organization_admin(public.settings.organization_id, (select auth.uid()))
  );

-- Functions ------------------------------------------------------------------
create or replace function public.leave_session(session_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  session_row public.sessions%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  normalized_code := upper(trim(session_code));

  select *
  into session_row
  from public.sessions
  where upper(trim(code)) = normalized_code
  limit 1;

  if not found then
    return;
  end if;

  if session_row.host_user_id = (select auth.uid()) then
    delete from public.session_memberships sm
    where sm.session_code = session_row.code;

    delete from public.sessions s
    where s.id = session_row.id;

    return;
  end if;

  delete from public.session_memberships sm
  where sm.session_code = session_row.code
    and sm.participant_user_id = (select auth.uid());
end;
$$;

create or replace function public.generate_session_code(code_length integer default 12)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  target_length integer := greatest(8, least(code_length, 32));
  raw_bytes bytea := extensions.gen_random_bytes(target_length);
  output text := '';
begin
  if code_length is null then
    target_length := 12;
    raw_bytes := extensions.gen_random_bytes(target_length);
  end if;

  for i in 0 .. target_length - 1 loop
    output := output || substr(alphabet, (get_byte(raw_bytes, i) % length(alphabet)) + 1, 1);
  end loop;

  return output;
end;
$$;
