-- Run this once in Supabase → SQL Editor.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- create the profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), new.phone))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== Build 29 additions (run this whole file again; it is safe to re-run) =====
alter table public.profiles add column if not exists ref_code text;
alter table public.profiles add column if not exists referred_by text;
update public.profiles set ref_code = substr(md5(id::text), 1, 8) where ref_code is null;
create unique index if not exists profiles_ref_code_key on public.profiles(ref_code);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, ref_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), new.phone), substr(md5(new.id::text), 1, 8))
  on conflict (id) do nothing;
  return new;
end $$;

-- how many people joined with my invite link
create or replace function public.referral_count() returns integer
language sql security definer set search_path = public as $$
  select count(*)::int from public.profiles where referred_by = (select ref_code from public.profiles where id = auth.uid());
$$;

-- remember who invited me (only once, never myself)
create or replace function public.claim_referral(code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare mine text;
begin
  select ref_code into mine from public.profiles where id = auth.uid();
  if mine is null or code is null or code = mine or length(code) <> 8 then return false; end if;
  if not exists (select 1 from public.profiles where ref_code = code) then return false; end if;
  update public.profiles set referred_by = code where id = auth.uid() and referred_by is null;
  return found;
end $$;
grant execute on function public.referral_count() to authenticated;
grant execute on function public.claim_referral(text) to authenticated;

-- news from the owner, shown on every dashboard (written only by the admin page, which uses the service role)
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements for select to authenticated using (true);

-- help requests from users, read by the admin page
create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  subject text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
drop policy if exists "own ticket insert" on public.support_tickets;
drop policy if exists "own ticket read" on public.support_tickets;
create policy "own ticket insert" on public.support_tickets for insert to authenticated with check (auth.uid() = user_id);
create policy "own ticket read" on public.support_tickets for select to authenticated using (auth.uid() = user_id);
