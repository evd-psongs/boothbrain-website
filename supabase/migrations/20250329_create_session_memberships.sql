-- Track active participants in a host's live session and expose helper functions

create table session_memberships (
  id uuid primary key default gen_random_uuid(),
  session_code text not null,
  host_user_id uuid not null references auth.users (id) on delete cascade,
  participant_user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  active boolean not null default true,
  unique (session_code, participant_user_id)
);

create index idx_session_memberships_host on session_memberships(host_user_id);
create index idx_session_memberships_participant on session_memberships(participant_user_id);

comment on table session_memberships is 'Maps participants to the host user who owns a session code.';

alter table session_memberships enable row level security;

create policy "Session memberships viewable by self" on public.session_memberships
  for select using (participant_user_id = auth.uid() or host_user_id = auth.uid());

create policy "Session memberships manageable by host" on public.session_memberships
  for all using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());

drop function if exists public.join_session_simple(text);

create function public.join_session_simple(session_code text)
returns table (
  code text,
  event_id text,
  host_user_id uuid,
  host_device_id text,
  created_at timestamptz,
  host_plan_tier text,
  host_plan_paused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  session_row public.sessions%rowtype;
  plan_tier text := 'free';
  paused boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized_code := upper(trim(session_code));
  if length(normalized_code) = 0 then
    raise exception 'Session code missing';
  end if;

  select *
  into session_row
  from public.sessions as s
  where upper(trim(s.code)) = normalized_code
  limit 1;

  if not found then
    raise exception 'Session not found';
  end if;

  if session_row.is_active is not true then
    raise exception 'Session is not active';
  end if;

  if session_row.expires_at is not null and session_row.expires_at < timezone('utc', now()) then
    raise exception 'Session has expired';
  end if;

  update public.session_memberships
  set last_seen_at = timezone('utc', now()),
      active = true
  where session_code = session_row.code
    and participant_user_id = auth.uid();

  if not found then
    insert into public.session_memberships (session_code, host_user_id, participant_user_id)
    values (session_row.code, session_row.host_user_id, auth.uid())
    on conflict (session_code, participant_user_id) do update
      set active = true,
          last_seen_at = excluded.last_seen_at;
  end if;

  select
    coalesce(plans.tier, 'free') as tier,
    coalesce(subs.paused_at is not null, false) as is_paused
  into plan_tier, paused
  from public.subscriptions subs
  left join public.subscription_plans plans on plans.id = subs.plan_id
  where subs.user_id = session_row.host_user_id
  order by subs.created_at desc
  limit 1;

  return query
  select
    session_row.code,
    session_row.event_id,
    session_row.host_user_id,
    session_row.host_device_id,
    session_row.created_at,
    plan_tier,
    paused;
end;
$$;

grant execute on function public.join_session_simple(text) to authenticated;

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
  if auth.uid() is null then
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

  if session_row.host_user_id = auth.uid() then
    delete from public.session_memberships
    where session_code = session_row.code;

    delete from public.sessions
    where id = session_row.id;

    return;
  end if;

  delete from public.session_memberships
  where session_code = session_row.code
    and participant_user_id = auth.uid();
end;
$$;

grant execute on function public.leave_session(text) to authenticated;

create or replace view public.session_shared_users as
select
  m.host_user_id,
  m.participant_user_id
from public.session_memberships m
where m.active is true
  and m.host_user_id is not null
  and m.participant_user_id is not null;

comment on view public.session_shared_users is 'Maps host users to active participant user ids while sessions are running.';
