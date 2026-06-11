-- WiSpace commerce, article, merch, transaction, and shipment foundation.
-- Run this in Supabase SQL Editor after band profile and release upgrades.

create table if not exists public.band_articles (
  id uuid primary key default gen_random_uuid(),
  band_user_id uuid references auth.users(id) on delete set null,
  band_slug text,
  band_name text not null,
  title text not null,
  category text not null default 'Update Band',
  excerpt text not null,
  body text,
  genre text,
  city text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.band_articles(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_name text,
  reporter_email text,
  content_type text not null,
  target_id text not null,
  title text not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.merch_items (
  id uuid primary key default gen_random_uuid(),
  band_user_id uuid references auth.users(id) on delete set null,
  band_slug text,
  band_name text not null,
  name text not null,
  description text,
  price integer not null default 0,
  stock integer not null default 0,
  image_name text,
  image_preview text,
  genre text,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id text,
  buyer_user_id uuid references auth.users(id) on delete set null,
  seller_band_user_id uuid references auth.users(id) on delete set null,
  seller_band_slug text,
  seller_band_name text not null,
  buyer_name text,
  buyer_email text,
  product_type text not null,
  product_title text not null,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.release_tracks(id) on delete set null,
  merch_item_id uuid references public.merch_items(id) on delete set null,
  gig_id uuid references public.gigs(id) on delete set null,
  gross_amount integer not null default 0,
  platform_fee integer not null default 0,
  band_net integer not null default 0,
  revenue_share text not null default '80/20',
  payment_provider text,
  payment_method text,
  payment_reference text,
  fulfillment_status text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.sales_transactions(id) on delete cascade,
  order_id text,
  buyer_user_id uuid references auth.users(id) on delete set null,
  seller_band_user_id uuid references auth.users(id) on delete set null,
  merch_item_id uuid references public.merch_items(id) on delete set null,
  quantity integer not null default 1,
  shipping_recipient text,
  shipping_phone text,
  shipping_address text,
  shipping_city text,
  shipping_postal_code text,
  courier_code text,
  courier_service text,
  shipping_cost integer not null default 0,
  tracking_number text,
  tracking_status text not null default 'pending',
  tracking_last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.band_subscriptions (
  id uuid primary key default gen_random_uuid(),
  audience_user_id uuid references auth.users(id) on delete cascade,
  band_slug text not null,
  band_name text,
  created_at timestamptz not null default now(),
  unique (audience_user_id, band_slug)
);

create table if not exists public.band_update_notifications (
  id uuid primary key default gen_random_uuid(),
  band_slug text not null,
  band_name text,
  update_type text not null default 'update',
  title text not null,
  body text,
  source_id text,
  created_at timestamptz not null default now(),
  unique (band_slug, source_id)
);

create table if not exists public.audience_notification_reads (
  id uuid primary key default gen_random_uuid(),
  audience_user_id uuid references auth.users(id) on delete cascade,
  notification_id text not null,
  created_at timestamptz not null default now(),
  unique (audience_user_id, notification_id)
);

create table if not exists public.shipment_tracking_events (
  id uuid primary key default gen_random_uuid(),
  merch_order_id uuid not null references public.merch_orders(id) on delete cascade,
  status text not null,
  description text,
  location text,
  event_time timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.releases
add column if not exists is_active boolean not null default true;

alter table if exists public.release_tracks
add column if not exists is_active boolean not null default true;

alter table if exists public.merch_items
add column if not exists is_active boolean not null default true;

alter table if exists public.sales_transactions
add column if not exists order_id text,
add column if not exists payment_method text,
add column if not exists fulfillment_status text;

alter table if exists public.merch_orders
add column if not exists order_id text;

create index if not exists band_articles_published_idx
on public.band_articles (is_published, created_at desc);

create index if not exists article_comments_article_idx
on public.article_comments (article_id, created_at desc);

create index if not exists content_reports_status_idx
on public.content_reports (status, created_at desc);

create index if not exists merch_items_active_idx
on public.merch_items (is_active, created_at desc);

create index if not exists merch_items_band_slug_idx
on public.merch_items (band_slug);

create index if not exists sales_transactions_seller_idx
on public.sales_transactions (seller_band_slug, created_at desc);

create index if not exists sales_transactions_buyer_idx
on public.sales_transactions (buyer_user_id, created_at desc);

create index if not exists sales_transactions_gig_idx
on public.sales_transactions (gig_id, created_at desc);

create index if not exists merch_orders_transaction_idx
on public.merch_orders (transaction_id);

create index if not exists band_subscriptions_audience_idx
on public.band_subscriptions (audience_user_id, created_at desc);

create index if not exists band_update_notifications_band_idx
on public.band_update_notifications (band_slug, created_at desc);

create index if not exists audience_notification_reads_user_idx
on public.audience_notification_reads (audience_user_id, created_at desc);

create index if not exists shipment_events_order_idx
on public.shipment_tracking_events (merch_order_id, event_time desc);

alter table public.band_articles enable row level security;
alter table public.article_comments enable row level security;
alter table public.content_reports enable row level security;
alter table public.merch_items enable row level security;
alter table public.sales_transactions enable row level security;
alter table public.merch_orders enable row level security;
alter table public.band_subscriptions enable row level security;
alter table public.band_update_notifications enable row level security;
alter table public.audience_notification_reads enable row level security;
alter table public.shipment_tracking_events enable row level security;

drop policy if exists "Published articles are readable by everyone" on public.band_articles;
create policy "Published articles are readable by everyone"
on public.band_articles for select
using (is_published = true or auth.uid() = band_user_id);

drop policy if exists "Bands can manage own articles" on public.band_articles;
create policy "Bands can manage own articles"
on public.band_articles for all
using (auth.uid() = band_user_id)
with check (auth.uid() = band_user_id);

drop policy if exists "Published article comments are readable by everyone" on public.article_comments;
create policy "Published article comments are readable by everyone"
on public.article_comments for select
using (
  exists (
    select 1 from public.band_articles
    where band_articles.id = article_comments.article_id
    and band_articles.is_published = true
  )
);

drop policy if exists "Authenticated users can comment on articles" on public.article_comments;
create policy "Authenticated users can comment on articles"
on public.article_comments for insert
with check (auth.uid() = author_user_id);

drop policy if exists "Authenticated users can create content reports" on public.content_reports;
create policy "Authenticated users can create content reports"
on public.content_reports for insert
with check (auth.uid() = reporter_user_id);

drop policy if exists "Reporters can read own content reports" on public.content_reports;
create policy "Reporters can read own content reports"
on public.content_reports for select
using (auth.uid() = reporter_user_id);

drop policy if exists "Active merch is readable by everyone" on public.merch_items;
create policy "Active merch is readable by everyone"
on public.merch_items for select
using (is_active = true or auth.uid() = band_user_id);

drop policy if exists "Bands can manage own merch" on public.merch_items;
create policy "Bands can manage own merch"
on public.merch_items for all
using (auth.uid() = band_user_id)
with check (auth.uid() = band_user_id);

drop policy if exists "Users can read related transactions" on public.sales_transactions;
create policy "Users can read related transactions"
on public.sales_transactions for select
using (auth.uid() = buyer_user_id or auth.uid() = seller_band_user_id);

drop policy if exists "Audience can create own transactions" on public.sales_transactions;
create policy "Audience can create own transactions"
on public.sales_transactions for insert
with check (auth.uid() = buyer_user_id);

drop policy if exists "Order participants can read merch orders" on public.merch_orders;
create policy "Order participants can read merch orders"
on public.merch_orders for select
using (auth.uid() = buyer_user_id or auth.uid() = seller_band_user_id);

drop policy if exists "Audience can create own merch orders" on public.merch_orders;
create policy "Audience can create own merch orders"
on public.merch_orders for insert
with check (auth.uid() = buyer_user_id);

drop policy if exists "Audience can manage own subscriptions" on public.band_subscriptions;
create policy "Audience can manage own subscriptions"
on public.band_subscriptions for all
using (auth.uid() = audience_user_id)
with check (auth.uid() = audience_user_id);

drop policy if exists "Band updates are readable by everyone" on public.band_update_notifications;
create policy "Band updates are readable by everyone"
on public.band_update_notifications for select
using (true);

drop policy if exists "Bands can publish update notifications" on public.band_update_notifications;
create policy "Bands can publish update notifications"
on public.band_update_notifications for insert
with check (
  exists (
    select 1 from public.band_profiles
    where band_profiles.slug = band_update_notifications.band_slug
    and band_profiles.user_id = auth.uid()
  )
);

drop policy if exists "Audience can manage own notification reads" on public.audience_notification_reads;
create policy "Audience can manage own notification reads"
on public.audience_notification_reads for all
using (auth.uid() = audience_user_id)
with check (auth.uid() = audience_user_id);

drop policy if exists "Order participants can read shipment events" on public.shipment_tracking_events;
create policy "Order participants can read shipment events"
on public.shipment_tracking_events for select
using (
  exists (
    select 1 from public.merch_orders
    where merch_orders.id = shipment_tracking_events.merch_order_id
    and (merch_orders.buyer_user_id = auth.uid() or merch_orders.seller_band_user_id = auth.uid())
  )
);

-- Server-side integrations should insert/update payment and shipment status using a service role.
-- Client-side MVP can read its own purchases, band-side sales, and public catalog data.
