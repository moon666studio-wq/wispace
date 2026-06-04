-- WiSpace band identity persistence.
-- Run this in Supabase SQL Editor when you are ready to store band profiles
-- and signed agreements permanently per authenticated account.

create table if not exists public.band_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  headline text,
  city text,
  genre text,
  formed_year text,
  cp text,
  email text,
  instagram text,
  bio text,
  cover_name text,
  cover_preview text,
  photo_name text,
  photo_preview text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.band_agreements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  signature_name text not null,
  signed_at timestamptz not null default now(),
  accepted boolean not null default true
);

alter table public.band_profiles enable row level security;
alter table public.band_agreements enable row level security;

drop policy if exists "Band profiles are readable by everyone" on public.band_profiles;
create policy "Band profiles are readable by everyone"
on public.band_profiles for select
using (is_published = true or auth.uid() = user_id);

drop policy if exists "Bands can insert their own profile" on public.band_profiles;
create policy "Bands can insert their own profile"
on public.band_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "Bands can update their own profile" on public.band_profiles;
create policy "Bands can update their own profile"
on public.band_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Bands can read their own agreement" on public.band_agreements;
create policy "Bands can read their own agreement"
on public.band_agreements for select
using (auth.uid() = user_id);

drop policy if exists "Bands can insert their own agreement" on public.band_agreements;
create policy "Bands can insert their own agreement"
on public.band_agreements for insert
with check (auth.uid() = user_id);

drop policy if exists "Bands can update their own agreement" on public.band_agreements;
create policy "Bands can update their own agreement"
on public.band_agreements for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
