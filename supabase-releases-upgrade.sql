-- WiSpace release, track, library, and storage foundation.
-- Run this in Supabase SQL Editor after band profile upgrade.

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  band_user_id uuid references auth.users(id) on delete set null,
  band_slug text,
  band_name text not null,
  title text not null,
  release_type text not null default 'album',
  price integer not null default 0,
  description text,
  cover_name text,
  cover_preview text,
  city text,
  genre text,
  signed_by text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.release_tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  title text not null,
  file_name text,
  file_size bigint not null default 0,
  audio_url text,
  price integer not null default 0,
  duration_seconds integer,
  free_full boolean not null default false,
  track_order integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.release_tracks
add column if not exists file_size bigint not null default 0;

create table if not exists public.audience_library (
  id uuid primary key default gen_random_uuid(),
  audience_user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.release_tracks(id) on delete set null,
  purchase_type text not null default 'album',
  access_type text not null default 'encrypted',
  redistribution_allowed boolean not null default false,
  purchased_at timestamptz not null default now()
);

create index if not exists releases_published_created_idx
on public.releases (is_published, created_at desc);

create index if not exists releases_band_slug_idx
on public.releases (band_slug);

create index if not exists release_tracks_release_idx
on public.release_tracks (release_id, track_order);

create index if not exists audience_library_user_idx
on public.audience_library (audience_user_id, purchased_at desc);

create unique index if not exists audience_library_album_unique_idx
on public.audience_library (audience_user_id, release_id)
where purchase_type = 'album' and track_id is null;

create unique index if not exists audience_library_track_unique_idx
on public.audience_library (audience_user_id, release_id, track_id)
where purchase_type = 'track' and track_id is not null;

alter table public.releases enable row level security;
alter table public.release_tracks enable row level security;
alter table public.audience_library enable row level security;

drop policy if exists "Published releases are readable by everyone" on public.releases;
create policy "Published releases are readable by everyone"
on public.releases for select
using (is_published = true or auth.uid() = band_user_id);

drop policy if exists "Bands can insert their own releases" on public.releases;
create policy "Bands can insert their own releases"
on public.releases for insert
with check (auth.uid() = band_user_id);

drop policy if exists "Bands can update their own releases" on public.releases;
create policy "Bands can update their own releases"
on public.releases for update
using (auth.uid() = band_user_id)
with check (auth.uid() = band_user_id);

drop policy if exists "Tracks are readable through published releases" on public.release_tracks;
create policy "Tracks are readable through published releases"
on public.release_tracks for select
using (
  exists (
    select 1 from public.releases
    where releases.id = release_tracks.release_id
    and (releases.is_published = true or releases.band_user_id = auth.uid())
  )
);

drop policy if exists "Bands can insert tracks into own releases" on public.release_tracks;
create policy "Bands can insert tracks into own releases"
on public.release_tracks for insert
with check (
  exists (
    select 1 from public.releases
    where releases.id = release_tracks.release_id
    and releases.band_user_id = auth.uid()
  )
);

drop policy if exists "Bands can update tracks in own releases" on public.release_tracks;
create policy "Bands can update tracks in own releases"
on public.release_tracks for update
using (
  exists (
    select 1 from public.releases
    where releases.id = release_tracks.release_id
    and releases.band_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.releases
    where releases.id = release_tracks.release_id
    and releases.band_user_id = auth.uid()
  )
);

drop policy if exists "Audience can read own library" on public.audience_library;
create policy "Audience can read own library"
on public.audience_library for select
using (auth.uid() = audience_user_id);

drop policy if exists "Audience can insert own library item" on public.audience_library;
create policy "Audience can insert own library item"
on public.audience_library for insert
with check (auth.uid() = audience_user_id);

insert into storage.buckets (id, name, public)
values
  ('band-assets', 'band-assets', true),
  ('release-audio', 'release-audio', false)
on conflict (id) do nothing;

drop policy if exists "Public can read band assets" on storage.objects;
create policy "Public can read band assets"
on storage.objects for select
using (bucket_id = 'band-assets');

drop policy if exists "Users can upload own band assets" on storage.objects;
create policy "Users can upload own band assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'band-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own band assets" on storage.objects;
create policy "Users can update own band assets"
on storage.objects for update
to authenticated
using (bucket_id = 'band-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'band-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies can be tightened later per asset type. During MVP:
-- - band-assets is public for covers, avatars, banners, merch images, and posters.
-- - release-audio is private; app should issue signed URLs for purchased users.
