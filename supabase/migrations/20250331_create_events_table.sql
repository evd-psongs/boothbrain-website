-- Central events table shared between hosts and participants

create table events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  location text,
  notes text,
  checklist jsonb default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_events_owner on events(owner_user_id);
create index idx_events_start on events(start_date);

comment on table events is 'Events owned by a user; session participants inherit access via session memberships.';

create trigger update_events_updated_at
  before update on events
  for each row
  execute function public.update_updated_at_column();

alter table events enable row level security;

create policy "Events accessible by owner" on public.events
  for select using (owner_user_id = auth.uid());

create policy "Events editable by owner" on public.events
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "Events accessible by session participants" on public.events
  for select using (exists (
    select 1 from public.session_shared_users s
    where s.host_user_id = events.owner_user_id
      and s.participant_user_id = auth.uid()
  ));

create policy "Events editable by session participants" on public.events
  for all using (exists (
    select 1 from public.session_shared_users s
    where s.host_user_id = events.owner_user_id
      and s.participant_user_id = auth.uid()
  )) with check (exists (
    select 1 from public.session_shared_users s
    where s.host_user_id = events.owner_user_id
      and s.participant_user_id = auth.uid()
  ));
