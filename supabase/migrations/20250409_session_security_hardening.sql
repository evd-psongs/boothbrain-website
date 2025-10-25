-- Harden session security: enforce strong passphrases, upgrade hashing, and auto-approve hosts

create or replace function public.create_session_secure(
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
  trimmed_passphrase text := null;
  hashed_passphrase text := null;
  requires_pass boolean := false;
  event_identifier text;
  inserted_row public.sessions%rowtype;
  approval_flag boolean := coalesce(require_host_approval, true);
  min_passphrase_length constant integer := 8;
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
      select 1
      from public.sessions s
      where upper(trim(s.code)) = generated_code
    ) or attempt >= max_attempts;
  end loop;

  if exists (
    select 1
    from public.sessions s
    where upper(trim(s.code)) = generated_code
  ) then
    raise exception 'Unable to allocate session code. Try again.';
  end if;

  event_identifier := concat(
    'event_',
    generated_code,
    '_',
  floor(extract(epoch from timezone('utc', now())) * 1000)::bigint
  );

  trimmed_passphrase := nullif(trim(coalesce(passphrase, '')), '');
  if trimmed_passphrase is not null then
    if length(trimmed_passphrase) < min_passphrase_length then
      raise exception 'Passphrase must be at least % characters long.', min_passphrase_length;
    end if;
    requires_pass := true;
    hashed_passphrase := extensions.crypt(trimmed_passphrase, extensions.gen_salt('bf', 12));
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
    null,
    hashed_passphrase,
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

create or replace function public.join_session_simple(
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
  trimmed_passphrase text := null;
  hashed_passphrase text;
  user_attempts integer := 0;
  device_attempts integer := 0;
  ip_attempts integer := 0;
  rate_window interval := interval '1 minute';
  per_user_limit integer := 5;
  per_device_limit integer := 4;
  per_ip_limit integer := 20;
  now_utc timestamptz := timezone('utc', now());
  is_host boolean := false;
  needs_passphrase boolean := false;
  new_status text;
  new_active boolean;
  new_approved_at timestamptz;
  legacy_hash boolean := false;
  min_passphrase_length constant integer := 8;
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
  from public.session_join_attempts ja
  where ja.participant_user_id = auth.uid()
    and ja.attempted_at > now_utc - rate_window
    and ja.outcome <> 'approved';

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
    from public.session_join_attempts ja
    where ja.device_id = effective_device_id
      and ja.attempted_at > now_utc - rate_window
      and ja.outcome <> 'approved';

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
    from public.session_join_attempts ja
    where ja.client_ip = ip_address
      and ja.attempted_at > now_utc - rate_window
      and ja.outcome <> 'approved';

    if ip_attempts >= per_ip_limit then
      insert into public.session_join_attempts (
        session_code, host_user_id, participant_user_id, device_id, client_ip, outcome, detail
      ) values (
        normalized_code, null, auth.uid(), effective_device_id, ip_address, 'rate_limited', 'per_ip'
      );
      raise exception 'Too many join attempts from your network. Try again soon.' using hint = 'rate_limited';
    end if;
  end if;

  select s.*
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

  is_host := session_row.host_user_id = auth.uid();

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
  from public.session_memberships sm
  where sm.session_code = session_row.code
    and sm.participant_user_id = auth.uid()
  limit 1
  for update;

  membership_exists := found;

  needs_passphrase := session_row.requires_passphrase
    and not is_host
    and not (membership_exists and membership_row.passphrase_verified is true);

  if needs_passphrase then
    trimmed_passphrase := nullif(trim(coalesce(host_passphrase, '')), '');
    if trimmed_passphrase is null then
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

    if length(trimmed_passphrase) < min_passphrase_length then
      raise exception 'Passphrase must be at least % characters long.', min_passphrase_length;
    end if;

    legacy_hash := session_row.passphrase_salt is not null
      or (session_row.passphrase_hash is not null and length(session_row.passphrase_hash) = 64);

    if legacy_hash then
      hashed_passphrase := encode(extensions.digest(coalesce(session_row.passphrase_salt, '') || trimmed_passphrase, 'sha256'), 'hex');
    else
      hashed_passphrase := extensions.crypt(trimmed_passphrase, session_row.passphrase_hash);
    end if;

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
    new_status := case
      when is_host then 'approved'
      when session_row.approval_required then 'pending'
      else 'approved'
    end;
    new_active := (new_status = 'approved');
    new_approved_at := case when new_status = 'approved' then now_utc else null end;

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
      new_approved_at,
      null,
      now_utc,
      new_status,
      true,
      new_active
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

  if membership_row.status <> 'approved' and (is_host or session_row.approval_required is false) then
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
    attempt_detail := case when is_host then 'host_join' else null end;
  else
    update public.session_memberships
    set
      active = false,
      passphrase_verified = true
    where id = membership_row.id;
    join_status_value := 'pending';
    attempt_outcome := 'pending';
    attempt_detail := coalesce(attempt_detail, 'awaiting_host');
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
