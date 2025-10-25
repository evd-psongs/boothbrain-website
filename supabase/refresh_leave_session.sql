-- Recreate leave_session so hosts fully remove the session when ending it
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
