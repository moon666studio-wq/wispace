-- WiSpace pre-live test data reset.
-- Purpose: clean old test content/transactions before running PRELIVE_CHECKLIST.md.
-- Run this in Supabase SQL Editor only after reviewing the keep list below.
--
-- IMPORTANT:
-- 1. Take a Supabase backup first.
-- 2. Replace the UUID/email placeholders in keep_users.
-- 3. This script does NOT delete auth.users by default.
-- 4. Storage object rows are deleted from storage.objects; Supabase will remove the related objects.

begin;

-- -----------------------------------------------------------------------------
-- 0. Fill this keep list before running.
-- -----------------------------------------------------------------------------
create temporary table keep_users (
  user_id uuid primary key,
  email text
) on commit drop;

-- Keep your real admin account. Replace UUID/email.
-- insert into keep_users (user_id, email)
-- values ('00000000-0000-0000-0000-000000000000', 'admin@wispace.my.id');

-- Optional: keep one band test account. Replace UUID/email or delete this line.
-- insert into keep_users (user_id, email)
-- values ('11111111-1111-1111-1111-111111111111', 'band-test@example.com');

-- Optional: keep one audience test account. Replace UUID/email or delete this line.
-- insert into keep_users (user_id, email)
-- values ('22222222-2222-2222-2222-222222222222', 'audience-test@example.com');

-- Safety guard: do not run if keep_users is empty.
do $$
begin
  if not exists (select 1 from keep_users) then
    raise exception 'keep_users is empty. Add at least your admin auth user UUID before running this reset.';
  end if;
end $$;

-- Keep admin rows for kept users, remove admin rows for deleted/dummy users.
delete from public.admin_users
where user_id not in (select user_id from keep_users);

-- -----------------------------------------------------------------------------
-- 1. Transaction/order/payment/support cleanup.
-- -----------------------------------------------------------------------------
delete from public.shipment_tracking_events;
delete from public.merch_orders;
delete from public.payment_webhook_events;
delete from public.payment_requests;
delete from public.sales_transactions;
delete from public.monthly_finance_reports;
delete from public.release_agreements;
delete from public.audience_library;
delete from public.audience_notification_reads;
delete from public.band_subscriptions;
delete from public.wispace_messages;
delete from public.content_reports;

-- -----------------------------------------------------------------------------
-- 2. Public interaction/content cleanup.
-- -----------------------------------------------------------------------------
delete from public.article_comments;
delete from public.band_update_notifications;
delete from public.band_articles;
delete from public.merch_items;
delete from public.release_tracks;
delete from public.releases;

-- Legacy single-track MVP table, if present.
do $$
begin
  if to_regclass('public.tracks') is not null then
    execute 'delete from public.tracks';
  end if;
end $$;

-- Gigs/pamflet cleanup.
delete from public.gigs;

-- Reset homepage pick to neutral unpublished state, but keep the row.
insert into public.wispace_picks (id, is_published)
values ('homepage', false)
on conflict (id) do update set
  youtube_url = null,
  title = 'WiSpace Video Review',
  band_name = 'WiSpace',
  review = 'Isi link YouTube dan review singkat dari admin. Kalau link kosong, homepage otomatis pakai random pick dari rilisan dan gigs.',
  thumbnail = null,
  is_published = false,
  updated_by = null,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 3. Band profile cleanup.
-- Keep profiles/agreements only for users in keep_users.
-- -----------------------------------------------------------------------------
delete from public.band_agreements
where user_id not in (select user_id from keep_users);

delete from public.band_profiles
where user_id not in (select user_id from keep_users);

-- -----------------------------------------------------------------------------
-- 4. Storage cleanup.
-- This removes uploaded test files in app buckets. Keep only files whose first
-- folder segment is a kept auth UUID. If you want a fully empty storage reset,
-- remove the foldername keep condition below.
-- -----------------------------------------------------------------------------
delete from storage.objects
where bucket_id in ('band-assets', 'release-previews', 'release-audio')
  and coalesce((storage.foldername(name))[1], '') not in (
    select user_id::text from keep_users
  );

-- Optional full storage wipe for app buckets. Uncomment only if you want to
-- remove even files belonging to kept admin/band/audience test users.
-- delete from storage.objects
-- where bucket_id in ('band-assets', 'release-previews', 'release-audio');

-- -----------------------------------------------------------------------------
-- 5. Verification output.
-- -----------------------------------------------------------------------------
select 'admin_users' as table_name, count(*) as remaining_rows from public.admin_users
union all select 'band_profiles', count(*) from public.band_profiles
union all select 'band_agreements', count(*) from public.band_agreements
union all select 'gigs', count(*) from public.gigs
union all select 'releases', count(*) from public.releases
union all select 'release_tracks', count(*) from public.release_tracks
union all select 'merch_items', count(*) from public.merch_items
union all select 'band_articles', count(*) from public.band_articles
union all select 'article_comments', count(*) from public.article_comments
union all select 'payment_requests', count(*) from public.payment_requests
union all select 'sales_transactions', count(*) from public.sales_transactions
union all select 'merch_orders', count(*) from public.merch_orders
union all select 'audience_library', count(*) from public.audience_library
union all select 'wispace_messages', count(*) from public.wispace_messages
union all select 'storage_app_objects', count(*) from storage.objects where bucket_id in ('band-assets', 'release-previews', 'release-audio')
order by table_name;

commit;