-- Ensure resolve_session_join_request avoids ambiguous column references

create or replace function public.resolve_session_join_request(
  membership_id uuid,
  approve boolean,
  note text default null
)
returns table (
  id uuid,
  session_code text,
  participant_user_id uuid,
  status text,
  approved_at timestamptz,
  denied_at timestamptz,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_row public.session_memberships%rowtype;
  now_utc timestamptz := timezone('utc', now());
  outcome_value text;
  detail_value text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into membership_row
  from public.session_memberships sm
  where sm.id = membership_id
  limit 1
  for update;

  if not found then
    raise exception 'Join request not found.';
  end if;

  if membership_row.host_user_id is distinct from auth.uid() then
    raise exception 'Not authorized to modify this request.';
  end if;

  if approve then
    update public.session_memberships
    set
      status = 'approved',
      approved_at = now_utc,
      denied_at = null,
      active = true
    where public.session_memberships.id = membership_row.id;
    outcome_value := 'approved';
    detail_value := 'host_approved';
  else
    update public.session_memberships
    set
      status = 'denied',
      denied_at = now_utc,
      approved_at = null,
      active = false
    where public.session_memberships.id = membership_row.id;
    outcome_value := 'denied';
    detail_value := case
      when note is not null and length(trim(note)) > 0 then trim(note)
      else 'host_denied'
    end;
  end if;

  insert into public.session_join_attempts (
    session_code,
    host_user_id,
    participant_user_id,
    device_id,
    client_ip,
    outcome,
    detail
  ) values (
    membership_row.session_code,
    membership_row.host_user_id,
    membership_row.participant_user_id,
    membership_row.device_id,
    null,
    outcome_value,
    detail_value
  );

  return query
  select
    sm.id,
    sm.session_code,
    sm.participant_user_id,
    sm.status,
    sm.approved_at,
    sm.denied_at,
    sm.active
  from public.session_memberships sm
  where sm.id = membership_row.id;
end;
$$;

grant execute on function public.resolve_session_join_request(uuid, boolean, text) to authenticated;
