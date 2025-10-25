-- Fix join_session_simple ambiguity

drop function if exists public.join_session_simple(text);

create function public.join_session_simple(session_code text)
returns table (
  code text,
  session_id uuid,
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

  update public.session_memberships as sm
  set last_seen_at = timezone('utc', now()),
      active = true
  where sm.session_code = session_row.code
    and sm.participant_user_id = auth.uid();

  if not found then
    insert into public.session_memberships (session_code, host_user_id, participant_user_id)
    values (session_row.code, session_row.host_user_id, auth.uid())
    on conflict on constraint session_memberships_session_code_participant_user_id_key do update
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
    session_row.id,
    session_row.event_id,
    session_row.host_user_id,
    session_row.host_device_id,
    session_row.created_at,
    plan_tier,
    paused;
end;
$$;

grant execute on function public.join_session_simple(text) to authenticated;
