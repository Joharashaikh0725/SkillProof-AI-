-- SkillProof AI database. Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1. Profiles (one row per user, created automatically when someone signs up)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text default 'College student',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', coalesce(new.raw_user_meta_data->>'role', 'College student'));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- 2. Reports (the whole report JSON lives in the "data" column)
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  challenge_id text not null,
  title text,
  avg numeric,
  data jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reports_user_idx on public.reports (user_id, created_at);
alter table public.reports enable row level security;

-- Every user can read, add, change and delete ONLY their own reports
create policy "reports: owner full access" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone with the link can read a report the owner has chosen to share
create policy "reports: public can read shared" on public.reports
  for select using (is_public = true);
