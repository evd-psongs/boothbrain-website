-- Add join_session_secure as an alias for join_session_simple
-- The app code calls join_session_secure but the function is named join_session_simple

create or replace function public.join_session_secure(
  p_code text,
  p_device_identifier text default null,
  p_passphrase text default null
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
begin
  -- Simply delegate to join_session_simple with renamed parameters
  return query
  select *
  from public.join_session_simple(p_code, p_device_identifier, p_passphrase);
end;
$$;

grant execute on function public.join_session_secure(text, text, text) to authenticated;

comment on function public.join_session_secure(text, text, text) is 'Alias for join_session_simple - used by mobile app';
