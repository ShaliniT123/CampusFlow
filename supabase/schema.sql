create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  branch text not null,
  year integer not null check (year between 1 and 6),
  subjects text[] not null default '{}',
  phone text not null,
  email text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null,
  deadline timestamptz not null,
  reminder_time timestamptz,
  add_to_calendar boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_deadline_idx on public.tasks(deadline);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status text not null,
  response_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automations_user_id_idx on public.automations(user_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.automations enable row level security;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update using (auth.uid() = user_id);

drop policy if exists "Users can view their tasks" on public.tasks;
create policy "Users can view their tasks" on public.tasks for select using (auth.uid() = user_id);
drop policy if exists "Users can create their tasks" on public.tasks;
create policy "Users can create their tasks" on public.tasks for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their tasks" on public.tasks;
create policy "Users can update their tasks" on public.tasks for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their tasks" on public.tasks;
create policy "Users can delete their tasks" on public.tasks for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their automations" on public.automations;
create policy "Users can view their automations" on public.automations for select using (auth.uid() = user_id);
