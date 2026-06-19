create table if not exists public.wispace_picks (
  id text primary key default 'homepage',
  youtube_url text,
  title text not null default 'WiSpace Video Review',
  band_name text not null default 'WiSpace',
  review text not null default 'Isi link YouTube dan review singkat dari admin. Kalau link kosong, homepage otomatis pakai random pick dari rilisan dan gigs.',
  thumbnail text,
  is_published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.wispace_picks enable row level security;

drop policy if exists "Homepage pick is readable by everyone" on public.wispace_picks;
create policy "Homepage pick is readable by everyone"
on public.wispace_picks for select
using (true);

drop policy if exists "Admins can manage homepage pick" on public.wispace_picks;
create policy "Admins can manage homepage pick"
on public.wispace_picks for all
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

insert into public.wispace_picks (id, is_published)
values ('homepage', false)
on conflict (id) do nothing;
