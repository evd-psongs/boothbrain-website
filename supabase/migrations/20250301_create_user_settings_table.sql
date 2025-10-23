-- 20250301_create_user_settings_table.sql
-- Store per-user key/value settings, replacing organization-scoped table usage.

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now()),
  constraint user_settings_user_key unique (user_id, key)
);

create or replace function public.set_user_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger user_settings_updated_at
before update on public.user_settings
for each row execute procedure public.set_user_settings_updated_at();

alter table public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings' and policyname = 'User settings readable by owner'
  ) then
    execute 'create policy "User settings readable by owner" on public.user_settings for select using (user_id = auth.uid())';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings' and policyname = 'User settings writeable by owner'
  ) then
    execute 'create policy "User settings writeable by owner" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid())';
  end if;
end;
$$;
