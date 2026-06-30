-- WiSpace pre-live RLS and storage hardening.
-- Run after the existing supabase-*-upgrade.sql files.

-- Admin helper used by policies below.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
using (auth.uid() = user_id);

-- Legacy tracks table is still used by the frontend MVP upload flow.
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  band text not null,
  title text not null,
  url text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.tracks
add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
add column if not exists created_at timestamptz not null default now();

create index if not exists tracks_owner_created_idx
on public.tracks (owner_user_id, created_at desc);

alter table public.tracks enable row level security;

drop policy if exists "Tracks are readable by everyone" on public.tracks;
create policy "Tracks are readable by everyone"
on public.tracks for select
using (true);

drop policy if exists "Authenticated users can insert own legacy tracks" on public.tracks;
create policy "Authenticated users can insert own legacy tracks"
on public.tracks for insert
to authenticated
with check (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "Owners can update own legacy tracks" on public.tracks;
create policy "Owners can update own legacy tracks"
on public.tracks for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "Owners can delete own legacy tracks" on public.tracks;
create policy "Owners can delete own legacy tracks"
on public.tracks for delete
to authenticated
using (owner_user_id = auth.uid());

-- Gigs table existed before the upgrade file; make the base schema/policies idempotent.
create table if not exists public.gigs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  city text,
  genre text,
  date text,
  image text,
  image_path text,
  image_name text,
  image_type text,
  status text not null default 'pending',
  band_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.gigs
add column if not exists image_path text,
add column if not exists image_name text,
add column if not exists image_type text,
add column if not exists band_id uuid references auth.users(id) on delete set null,
add column if not exists updated_at timestamptz not null default now();

alter table public.gigs enable row level security;

create index if not exists gigs_public_status_created_idx
on public.gigs (status, created_at desc);

create index if not exists gigs_band_created_idx
on public.gigs (band_id, created_at desc);

drop policy if exists "Approved gigs are readable by everyone" on public.gigs;
create policy "Approved gigs are readable by everyone"
on public.gigs for select
using (
  status in ('approved', 'approved_free', 'approved_exclusive', 'paid_waiting_activation')
  or band_id = auth.uid()
  or exists (select 1 from public.admin_users where admin_users.user_id = auth.uid())
);

drop policy if exists "Authenticated users can submit gigs" on public.gigs;
create policy "Authenticated users can submit gigs"
on public.gigs for insert
to authenticated
with check (band_id is null or band_id = auth.uid());

drop policy if exists "Gig owners can update own pending gigs" on public.gigs;
create policy "Gig owners can update own pending gigs"
on public.gigs for update
to authenticated
using (band_id = auth.uid() and status in ('pending', 'removed'))
with check (band_id = auth.uid());

drop policy if exists "Admins can manage all gigs" on public.gigs;
create policy "Admins can manage all gigs"
on public.gigs for all
using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

-- Let authenticated owners clean up files they uploaded. Select/upload/update policies are in release upgrade.
drop policy if exists "Users can delete own band assets" on storage.objects;
create policy "Users can delete own band assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'band-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own release previews" on storage.objects;
create policy "Users can delete own release previews"
on storage.objects for delete
to authenticated
using (bucket_id = 'release-previews' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Bands can delete own private audio" on storage.objects;
create policy "Bands can delete own private audio"
on storage.objects for delete
to authenticated
using (bucket_id = 'release-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Optional: after you know your admin auth UUID, run this manually:
-- insert into public.admin_users (user_id, email)
-- values ('YOUR_AUTH_USER_UUID', 'admin@wispace.my.id')
-- on conflict (user_id) do update set email = excluded.email;