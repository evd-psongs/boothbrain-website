-- Refresh session security helper functions with pgcrypto schema hints

create or replace function public.generate_session_code(code_length integer default 12)
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
