-- Reinforce session security with approval workflow and join attempt auditing

-- Ensure pgcrypto is available for secure hashing utilities
create extension if not exists "pgcrypto";

-- Extend sessions table with security configuration columns
alter table public.sessions
  add column if not exists requires_passphrase boolean not null default false,
  add column if not exists passphrase_salt text,
  add column if not exists passphrase_hash text,
  add column if not exists approval_required boolean not null default true,
  add column if not exists last_failed_join_at timestamptz,
  add column if not exists last_security_alert_at timestamptz;

update public.sessions
set approval_required = coalesce(approval_required, true)
where approval_required is null;

-- Track request lifecycle details on session memberships
alter table public.session_memberships
  add column if not exists status text,
  add column if not exists device_id text,
  add column if not exists passphrase_verified boolean,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists denied_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

update public.session_memberships
set
  status = case
    when active is true then 'approved'
    else 'pending'
  end,
  passphrase_verified = coalesce(passphrase_verified, active),
  requested_at = coalesce(requested_at, joined_at, last_seen_at, timezone('utc', now())),
  approved_at = case
    when active is true then coalesce(approved_at, joined_at, last_seen_at, timezone('utc', now()))
    else approved_at
  end,
  denied_at = case
    when active is false and status = 'denied' then denied_at
    else null
  end,
  last_attempt_at = coalesce(last_attempt_at, last_seen_at, joined_at, timezone('utc', now()));

update public.session_memberships
set active = (status = 'approved');

alter table public.session_memberships
  alter column status set default 'pending',
  alter column passphrase_verified set default false,
  alter column requested_at set default timezone('utc', now()),
  alter column last_attempt_at set default timezone('utc', now());

update public.session_memberships
set passphrase_verified = true,
    approved_at = coalesce(approved_at, joined_at, last_seen_at, timezone('utc', now()))
where status = 'approved';

alter table public.session_memberships
  alter column status set not null,
  add constraint session_memberships_status_check check (status in ('pending', 'approved', 'denied'));

-- Audit join attempts to support rate limiting and host alerts
create table if not exists public.session_join_attempts (
  id uuid primary key default gen_random_uuid(),
  session_code text not null,
  host_user_id uuid references auth.users (id),
  participant_user_id uuid references auth.users (id),
  device_id text,
  client_ip inet,
  attempted_at timestamptz not null default timezone('utc', now()),
  outcome text not null check (outcome in (
    'approved',
    'pending',
    'denied',
    'invalid_code',
    'invalid_passphrase',
    'passphrase_required',
    'rate_limited',
    'session_closed',
    'session_expired',
    'error'
  )),
  detail text
);

create index if not exists idx_session_join_attempts_participant
  on public.session_join_attempts (participant_user_id, attempted_at desc);

create index if not exists idx_session_join_attempts_device
  on public.session_join_attempts (device_id, attempted_at desc)
  where device_id is not null;

create index if not exists idx_session_join_attempts_code
  on public.session_join_attempts (session_code, attempted_at desc);

create index if not exists idx_session_join_attempts_ip
  on public.session_join_attempts (client_ip, attempted_at desc)
  where client_ip is not null;

comment on table public.session_join_attempts is
  'Historical record of join attempts used for rate limiting and host security insights.';

alter table public.session_join_attempts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'session_join_attempts'
      and policyname = 'Join attempts viewable by participant'
  ) then
    execute 'create policy "Join attempts viewable by participant" on public.session_join_attempts for select using (participant_user_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'session_join_attempts'
      and policyname = 'Join attempts viewable by host'
  ) then
    execute 'create policy "Join attempts viewable by host" on public.session_join_attempts for select using (host_user_id = auth.uid())';
  end if;
end;
$$;

grant select on table public.session_join_attempts to authenticated;

-- Replace join_session_simple with secure, rate-limited flow
drop function if exists public.join_session_simple(text);
drop function if exists public.join_session_simple(text, text, text);

create function public.join_session_simple(
  session_code text,
  client_device_id text default null,
  host_passphrase text default null
)
returns table (
  code text,
  session_id uuid,
  event_id text,
  host_user_id uuid,
  host_device_id text,
  created_at timestamptz,
  host_plan_tier text,
  host_plan_paused boolean,
  requires_passphrase boolean,
  approval_required boolean,
  join_status text
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
  membership_row public.session_memberships%rowtype;
  membership_exists boolean := false;
  join_status_value text := 'pending';
  attempt_outcome text := 'error';
  attempt_detail text := null;
  ip_address inet := null;
  effective_device_id text := null;
  raw_headers text;
  headers jsonb;
  hashed_passphrase text;
  user_attempts integer := 0;
  device_attempts integer := 0;
  ip_attempts integer := 0;
  rate_window interval := interval '1 minute';
  per_user_limit integer := 5;
  per_device_limit integer := 4;
  per_ip_limit integer := 20;
  now_utc timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized_code := upper(trim(session_code));
  if length(normalized_code) = 0 then
    raise exception 'Session code missing';
  end if;

  effective_device_id := nullif(trim(coalesce(client_device_id, '')), '');

  begin
    raw_headers := current_setting('request.headers', true);
    if raw_headers is not null then
      headers := raw_headers::jsonb;
      if headers ? 'x-real-ip' then
        ip_address := nullif(headers->>'x-real-ip', '')::inet;
      elsif headers ? 'x-forwarded-for' then
        ip_address := nullif(split_part(headers->>'x-forwarded-for', ',', 1), '')::inet;
      end if;
    end if;
  exception when others then
    ip_address := null;
  end;

  select count(*)
  into user_attempts
  from public.session_join_attempts
  where participant_user_id = auth.uid()
    and attempted_at > now_utc - rate_window
    and outcome <> 'approved';

  if user_attempts >= per_user_limit then
    insert into public.session_join_attempts (
      session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
    ) values (
      normalized_code, null, auth.uid(), effective_device_id, ip_address, 'rate_limited', 'per_user'
    );
    raise exception 'Too many join attempts. Try again shortly.' using hint = 'rate_limited';
  end if;

  if effective_device_id is not null then
    select count(*)
    into device_attempts
    from public.session_join_attempts
    where device_id = effective_device_id
      and attempted_at > now_utc - rate_window
      and outcome <> 'approved';

    if device_attempts >= per_device_limit then
      insert into public.session_join_attempts (
        session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
      ) values (
        normalized_code, null, auth.uid(), effective_device_id, ip_address, 'rate_limited', 'per_device'
      );
      raise exception 'Too many join attempts from this device. Wait a moment and try again.' using hint = 'rate_limited';
    end if;
  end if;

  if ip_address is not null then
    select count(*)
    into ip_attempts
    from public.session_join_attempts
    where client_ip = ip_address
      and attempted_at > now_utc - rate_window
      and outcome <> 'approved';

    if ip_attempts >= per_ip_limit then
      insert into public.session_join_attempts (
        session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
      ) values (
        normalized_code, null, auth.uid(), effective_device_id, ip_address, 'rate_limited', 'per_ip'
      );
      raise exception 'Too many join attempts from your network. Try again soon.' using hint = 'rate_limited';
    end if;
  end if;

  select *
  into session_row
  from public.sessions as s
  where upper(trim(s.code)) = normalized_code
  limit 1;

  if not found then
    insert into public.session_join_attempts (
      session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
    ) values (
      normalized_code, null, auth.uid(), effective_device_id, ip_address, 'invalid_code', 'code_not_found'
    );
    raise exception 'Session not found. Check the code and try again.' using hint = 'invalid_code';
  end if;

  if session_row.is_active is not true then
    insert into public.session_join_attempts (
      session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
    ) values (
      session_row.code, session_row.host_user_id, auth.uid(), effective_device_id, ip_address, 'session_closed', 'inactive'
    );
    raise exception 'Session is not active.' using hint = 'inactive_session';
  end if;

  if session_row.expires_at is not null and session_row.expires_at < now_utc then
    insert into public.session_join_attempts (
      session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
    ) values (
      session_row.code, session_row.host_user_id, auth.uid(), effective_device_id, ip_address, 'session_expired', 'expired'
    );
    raise exception 'Session has expired.' using hint = 'session_expired';
  end if;

  select *
  into membership_row
  from public.session_memberships
  where session_code = session_row.code
    and participant_user_id = auth.uid()
  limit 1
  for update;

  membership_exists := found;

  if session_row.requires_passphrase and not (membership_exists and membership_row.passphrase_verified is true) then
    if host_passphrase is null or length(trim(host_passphrase)) = 0 then
      update public.sessions
      set last_failed_join_at = now_utc
      where id = session_row.id;

      insert into public.session_join_attempts (
        session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
      ) values (
        session_row.code, session_row.host_user_id, auth.uid(), effective_device_id, ip_address, 'passphrase_required', 'missing'
      );

      raise exception 'This session requires a passphrase.' using hint = 'passphrase_required';
    end if;

    hashed_passphrase := encode(pgcrypto.digest(coalesce(session_row.passphrase_salt, '') || trim(host_passphrase), 'sha256'), 'hex');
    if hashed_passphrase is distinct from session_row.passphrase_hash then
      update public.sessions
      set last_failed_join_at = now_utc
      where id = session_row.id;

      insert into public.session_join_attempts (
        session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
      ) values (
        session_row.code, session_row.host_user_id, auth.uid(), effective_device_id, ip_address, 'invalid_passphrase', 'mismatch'
      );

      raise exception 'Incorrect passphrase.' using hint = 'invalid_passphrase';
    end if;
  end if;

  if not membership_exists then
    insert into public.session_memberships (
      session_code,
      host_user_id,
      participant_user_id,
      device_id,
      requested_at,
      approved_at,
      denied_at,
      last_attempt_at,
      status,
      passphrase_verified,
      active
    ) values (
      session_row.code,
      session_row.host_user_id,
      auth.uid(),
      effective_device_id,
      now_utc,
      case when session_row.approval_required then null else now_utc end,
      null,
      now_utc,
      case when session_row.approval_required then 'pending' else 'approved' end,
      true,
      case when session_row.approval_required then false else true end
    )
    returning * into membership_row;
  else
    update public.session_memberships
    set
      device_id = coalesce(effective_device_id, device_id),
      last_attempt_at = now_utc,
      requested_at = coalesce(requested_at, now_utc),
      passphrase_verified = true
    where id = membership_row.id
    returning * into membership_row;
  end if;

  if membership_row.status = 'denied' then
    insert into public.session_join_attempts (
      session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
    ) values (
      session_row.code, session_row.host_user_id, auth.uid(), effective_device_id, ip_address, 'denied', 'host_denied'
    );
    raise exception 'Your join request was denied by the host.' using hint = 'join_denied';
  end if;

  if membership_row.status = 'pending' and session_row.approval_required is false then
    update public.session_memberships
    set
      status = 'approved',
      approved_at = now_utc,
      active = true
    where id = membership_row.id
    returning * into membership_row;
  end if;

  if membership_row.status = 'approved' then
    update public.session_memberships
    set
      active = true,
      last_seen_at = now_utc,
      approved_at = coalesce(approved_at, now_utc),
      passphrase_verified = true
    where id = membership_row.id;
    join_status_value := 'approved';
    attempt_outcome := 'approved';
  else
    update public.session_memberships
    set
      active = false,
      passphrase_verified = true
    where id = membership_row.id;
    join_status_value := 'pending';
    attempt_outcome := 'pending';
    attempt_detail := 'awaiting_host';
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

  insert into public.session_join_attempts (
    session_code,
    host_user_id,
    participant_user_id,
    device_id,
    client_ip,
    outcome,
    detail
  ) values (
    session_row.code,
    session_row.host_user_id,
    auth.uid(),
    effective_device_id,
    ip_address,
    attempt_outcome,
    attempt_detail
  );

  return query
  select
    session_row.code,
    session_row.id,
    session_row.event_id,
    session_row.host_user_id,
    session_row.host_device_id,
    session_row.created_at,
    plan_tier,
    paused,
    session_row.requires_passphrase,
    session_row.approval_required,
    join_status_value;
end;
$$;

grant execute on function public.join_session_simple(text, text, text) to authenticated;

-- Force PostgREST to reload the updated function signature
select pg_notify('pgrst', 'reload schema');

-- Host-controlled approval responses
drop function if exists public.resolve_session_join_request(uuid, boolean);
drop function if exists public.resolve_session_join_request(uuid, boolean, text);

create function public.resolve_session_join_request(
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
  from public.session_memberships
  where id = membership_id
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
    where id = membership_row.id;
    outcome_value := 'approved';
    detail_value := 'host_approved';
  else
    update public.session_memberships
    set
      status = 'denied',
      denied_at = now_utc,
      approved_at = null,
      active = false
    where id = membership_row.id;
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

-- Host security insights
drop function if exists public.get_session_security_overview(text);

create function public.get_session_security_overview(target_session_code text default null)
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
    select *
    into session_row
    from public.sessions
    where host_user_id = auth.uid()
    order by created_at desc
    limit 1;
  else
    select *
    into session_row
    from public.sessions
    where host_user_id = auth.uid()
      and upper(trim(code)) = normalized_code
    order by created_at desc
    limit 1;
  end if;

  if not found then
    raise exception 'Session not found for current host.';
  end if;

  return query
  with pending as (
    select count(*) as count_pending
    from public.session_memberships
    where session_code = session_row.code
      and host_user_id = auth.uid()
      and status = 'pending'
  ),
  attempts as (
    select
      count(*) filter (where outcome in (
        'invalid_code',
        'invalid_passphrase',
        'passphrase_required',
        'session_closed',
        'session_expired',
        'denied'
      )) as failures,
      count(*) filter (where outcome = 'rate_limited') as throttled,
      max(attempted_at) filter (where outcome in (
        'invalid_code',
        'invalid_passphrase',
        'passphrase_required',
        'session_closed',
        'session_expired',
        'denied'
      )) as last_failure
    from public.session_join_attempts
    where session_code = session_row.code
      and attempted_at >= window_start
  )
  select
    session_row.code,
    pending.count_pending,
    coalesce(attempts.failures, 0),
    coalesce(attempts.throttled, 0),
    attempts.last_failure
  from pending, attempts;
end;
$$;

grant execute on function public.get_session_security_overview(text) to authenticated;

-- High-entropy session code generator for clients
drop function if exists public.generate_session_code(integer);

create function public.generate_session_code(code_length integer default 12)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  target_length integer := greatest(8, least(code_length, 32));
  raw_bytes bytea := pgcrypto.gen_random_bytes(target_length);
  idx integer := 0;
  output text := '';
begin
  if code_length is null then
    target_length := 12;
    raw_bytes := pgcrypto.gen_random_bytes(target_length);
  end if;

  for idx in 0 .. target_length - 1 loop
    output := output || substr(alphabet, (get_byte(raw_bytes, idx) % length(alphabet)) + 1, 1);
  end loop;

  return output;
end;
$$;

grant execute on function public.generate_session_code(integer) to authenticated;

-- Server-side helper to create secure sessions with hashed passphrases
drop function if exists public.create_session_secure(text, text, boolean);

create function public.create_session_secure(
  host_device_identifier text,
  passphrase text default null,
  require_host_approval boolean default true
)
returns table (
  id uuid,
  code text,
  event_id text,
  host_user_id uuid,
  host_device_id text,
  created_at timestamptz,
  requires_passphrase boolean,
  approval_required boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt integer := 0;
  max_attempts integer := 8;
  generated_code text;
  normalized_device text;
  passphrase_salt text := null;
  passphrase_hash text := null;
  requires_pass boolean := false;
  event_identifier text;
  inserted_row public.sessions%rowtype;
  approval_flag boolean := coalesce(require_host_approval, true);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  normalized_device := nullif(trim(coalesce(host_device_identifier, '')), '');
  if normalized_device is null then
    raise exception 'Host device identifier required';
  end if;

  loop
    attempt := attempt + 1;
    generated_code := public.generate_session_code(12);
    exit when not exists (
      select 1 from public.sessions where upper(trim(code)) = generated_code
    ) or attempt >= max_attempts;
  end loop;

  if exists (select 1 from public.sessions where upper(trim(code)) = generated_code) then
    raise exception 'Unable to allocate session code. Try again.';
  end if;

  event_identifier := concat(
    'event_',
    generated_code,
    '_',
    floor(extract(epoch from timezone('utc', now())) * 1000)::bigint
  );

  if passphrase is not null and length(trim(passphrase)) > 0 then
    requires_pass := true;
    passphrase_salt := encode(pgcrypto.gen_random_bytes(16), 'hex');
    passphrase_hash := encode(pgcrypto.digest(passphrase_salt || trim(passphrase), 'sha256'), 'hex');
  end if;

  insert into public.sessions (
    code,
    event_id,
    host_user_id,
    host_device_id,
    requires_passphrase,
    passphrase_salt,
    passphrase_hash,
    approval_required
  ) values (
    generated_code,
    event_identifier,
    auth.uid(),
    normalized_device,
    requires_pass,
    passphrase_salt,
    passphrase_hash,
    approval_flag
  )
  returning * into inserted_row;

  return query
  select
    inserted_row.id,
    inserted_row.code,
    inserted_row.event_id,
    inserted_row.host_user_id,
    inserted_row.host_device_id,
    inserted_row.created_at,
    inserted_row.requires_passphrase,
    inserted_row.approval_required;
end;
$$;

grant execute on function public.create_session_secure(text, text, boolean) to authenticated;

-- Pending join requests for host review
drop function if exists public.list_pending_session_requests(text);

create function public.list_pending_session_requests(target_session_code text default null)
returns table (
  id uuid,
  session_code text,
  participant_user_id uuid,
  requested_at timestamptz,
  device_id text,
  status text,
  participant_email text,
  participant_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(target_session_code, '')));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    sm.id,
    sm.session_code,
    sm.participant_user_id,
    sm.requested_at,
    sm.device_id,
    sm.status,
    au.email,
    coalesce(p.full_name, '') as participant_name
  from public.session_memberships sm
  join public.sessions s on s.code = sm.session_code
  left join auth.users au on au.id = sm.participant_user_id
  left join public.profiles p on p.id = sm.participant_user_id
  where s.host_user_id = auth.uid()
    and sm.status = 'pending'
    and (normalized_code = '' or upper(trim(sm.session_code)) = normalized_code)
  order by sm.requested_at asc;
end;
$$;

grant execute on function public.list_pending_session_requests(text) to authenticated;
