-- Run this once in Supabase -> SQL Editor.
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

-- ===== Build 30: community wall, polls, leaderboard, link shortener (safe to re-run) =====

-- wall posts
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null,
  avatar text,
  body text not null check (char_length(body) between 1 and 280),
  likes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "read posts" on public.posts;
drop policy if exists "insert own post" on public.posts;
drop policy if exists "delete own post" on public.posts;
create policy "read posts" on public.posts for select to authenticated using (true);
create policy "insert own post" on public.posts for insert to authenticated with check (auth.uid() = user_id and likes = 0);
create policy "delete own post" on public.posts for delete to authenticated using (auth.uid() = user_id);
-- one post per 20 seconds per person
create or replace function public.posts_rate() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.posts where user_id = new.user_id and created_at > now() - interval '20 seconds') then
    raise exception 'Slow down: wait a few seconds between posts';
  end if;
  return new;
end $$;
drop trigger if exists posts_rate_t on public.posts;
create trigger posts_rate_t before insert on public.posts for each row execute function public.posts_rate();

create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "read own likes" on public.post_likes;
create policy "read own likes" on public.post_likes for select to authenticated using (auth.uid() = user_id);

create or replace function public.toggle_like(pid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare liked boolean; n integer;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if exists (select 1 from post_likes where post_id = pid and user_id = auth.uid()) then
    delete from post_likes where post_id = pid and user_id = auth.uid(); liked := false;
  else
    insert into post_likes(post_id, user_id) values (pid, auth.uid()); liked := true;
  end if;
  update posts set likes = (select count(*) from post_likes where post_id = pid) where id = pid returning likes into n;
  return jsonb_build_object('liked', liked, 'likes', coalesce(n, 0));
end $$;
grant execute on function public.toggle_like(bigint) to authenticated;

-- polls (created by the admin page)
create table if not exists public.polls (
  id bigint generated always as identity primary key,
  question text not null,
  options jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.polls enable row level security;
drop policy if exists "read polls" on public.polls;
create policy "read polls" on public.polls for select to authenticated using (true);

create table if not exists public.poll_votes (
  poll_id bigint not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice integer not null,
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists "read own vote" on public.poll_votes;
drop policy if exists "vote once" on public.poll_votes;
create policy "read own vote" on public.poll_votes for select to authenticated using (auth.uid() = user_id);
create policy "vote once" on public.poll_votes for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.poll_results(pid bigint) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(choice::text, n), '{}'::jsonb) from (select choice, count(*)::int n from poll_votes where poll_id = pid group by choice) t;
$$;
grant execute on function public.poll_results(bigint) to authenticated;

-- top inviters (people can hide themselves in Account -> Settings)
create or replace function public.top_inviters() returns table(name text, n integer)
language sql security definer set search_path = public as $$
  select coalesce(p.display_name, 'Member') as name, count(r.id)::int as n
  from public.profiles p join public.profiles r on r.referred_by = p.ref_code
  where coalesce(p.settings->>'hideBoard', 'false') <> 'true'
  group by p.id, p.display_name order by n desc, p.display_name limit 10;
$$;
grant execute on function public.top_inviters() to authenticated;

-- short links  (/s/<code>)
create table if not exists public.short_links (
  code text primary key check (code ~ '^[a-zA-Z0-9_-]{3,24}$'),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  user_id uuid not null references auth.users(id) on delete cascade,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.short_links enable row level security;
drop policy if exists "read short links" on public.short_links;
drop policy if exists "insert own link" on public.short_links;
drop policy if exists "delete own link" on public.short_links;
create policy "read short links" on public.short_links for select using (true);
create policy "insert own link" on public.short_links for insert to authenticated with check (auth.uid() = user_id and clicks = 0);
create policy "delete own link" on public.short_links for delete to authenticated using (auth.uid() = user_id);
-- at most 50 links per person
create or replace function public.links_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.short_links where user_id = new.user_id) >= 50 then raise exception 'You can keep up to 50 short links. Delete one first.'; end if;
  return new;
end $$;
drop trigger if exists links_cap_t on public.short_links;
create trigger links_cap_t before insert on public.short_links for each row execute function public.links_cap();
create or replace function public.link_click(c text) returns void
language sql security definer set search_path = public as $$ update public.short_links set clicks = clicks + 1 where code = c; $$;
grant execute on function public.link_click(text) to anon, authenticated;

-- ===== Build 31: image -> link tool (Supabase Storage, public bucket, per-user folders) =====
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true) on conflict (id) do nothing;

drop policy if exists "uploads read" on storage.objects;
create policy "uploads read" on storage.objects for select using (bucket_id = 'uploads');
drop policy if exists "uploads insert own" on storage.objects;
create policy "uploads insert own" on storage.objects for insert to authenticated with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "uploads delete own" on storage.objects;
create policy "uploads delete own" on storage.objects for delete to authenticated using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- tracks each upload so the tool can list/delete "my uploads" (the storage object itself is removed separately, from the browser)
create table if not exists public.image_links (
  path text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  size integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.image_links enable row level security;
drop policy if exists "read own image links" on public.image_links;
drop policy if exists "insert own image link" on public.image_links;
drop policy if exists "delete own image link" on public.image_links;
create policy "read own image links" on public.image_links for select to authenticated using (auth.uid() = user_id);
create policy "insert own image link" on public.image_links for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own image link" on public.image_links for delete to authenticated using (auth.uid() = user_id);
-- at most 30 uploaded images per person
create or replace function public.image_links_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.image_links where user_id = new.user_id) >= 30 then raise exception 'You can keep up to 30 uploaded images. Delete one first.'; end if;
  return new;
end $$;
drop trigger if exists image_links_cap_t on public.image_links;
create trigger image_links_cap_t before insert on public.image_links for each row execute function public.image_links_cap();

-- ===== Build 31: WhatsApp-style multi-emoji reactions on wall posts (one group, replaces the old heart-only like) =====
create table if not exists public.post_reactions (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','😮','😢','🙏','👍')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "read reactions" on public.post_reactions;
create policy "read reactions" on public.post_reactions for select to authenticated using (true);

-- tap an emoji: sets it, tapping the same one again removes it. keeps posts.likes as the total count (old column, still shown in a couple of places).
create or replace function public.react(pid bigint, e text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare existing text; counts jsonb; mine text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if e is null or e not in ('❤️','😂','😮','😢','🙏','👍') then raise exception 'bad emoji'; end if;
  select emoji into existing from post_reactions where post_id = pid and user_id = auth.uid();
  if existing is not null and existing = e then
    delete from post_reactions where post_id = pid and user_id = auth.uid(); mine := null;
  else
    insert into post_reactions (post_id, user_id, emoji) values (pid, auth.uid(), e)
    on conflict (post_id, user_id) do update set emoji = excluded.emoji, created_at = now();
    mine := e;
  end if;
  select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb) into counts from (select emoji, count(*)::int n from post_reactions where post_id = pid group by emoji) t;
  update posts set likes = (select count(*) from post_reactions where post_id = pid) where id = pid;
  return jsonb_build_object('counts', counts, 'mine', mine);
end $$;
grant execute on function public.react(bigint, text) to authenticated;
