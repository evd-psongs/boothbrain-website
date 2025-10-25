-- Ensure security overview returns integers for count columns

create or replace function public.get_session_security_overview(target_session_code text default null)
returns table (
  session_code text,
  pending_requests integer,
  recent_failed_attempts integer,
  recent_rate_limited integer,
  last_failed_attempt timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  session_row public.sessions%rowtype;
  window_start timestamptz := timezone('utc', now()) - interval '10 minutes';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized_code := upper(trim(coalesce(target_session_code, '')));

  if length(normalized_code) = 0 then
    select s.*
    into session_row
    from public.sessions as s
    where s.host_user_id = auth.uid()
    order by s.created_at desc
    limit 1;
  else
    select s.*
    into session_row
    from public.sessions as s
    where s.host_user_id = auth.uid()
      and upper(trim(s.code)) = normalized_code
    order by s.created_at desc
    limit 1;
  end if;

  if not found then
    raise exception 'Session not found for current host.';
  end if;

  return query
  with pending as (
    select count(*) as count_pending
    from public.session_memberships sm
    where sm.session_code = session_row.code
      and sm.host_user_id = auth.uid()
      and sm.status = 'pending'
  ),
  attempts as (
    select
      count(*) filter (where ja.outcome in (
        'invalid_code',
        'invalid_passphrase',
        'passphrase_required',
        'session_closed',
        'session_expired',
        'denied'
      )) as failures,
      count(*) filter (where ja.outcome = 'rate_limited') as throttled,
      max(ja.attempted_at) filter (where ja.outcome in (
        'invalid_code',
        'invalid_passphrase',
        'passphrase_required',
        'session_closed',
        'session_expired',
        'denied'
      )) as last_failure
    from public.session_join_attempts ja
    where ja.session_code = session_row.code
      and ja.attempted_at >= window_start
  )
  select
    session_row.code,
    coalesce(pending.count_pending, 0)::integer,
    coalesce(attempts.failures, 0)::integer,
    coalesce(attempts.throttled, 0)::integer,
    attempts.last_failure
  from pending, attempts;
end;
$$;

grant execute on function public.get_session_security_overview(text) to authenticated;
