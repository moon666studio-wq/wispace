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
  fulfillment_mode text not null default 'band_ship',
  fulfillment_label text,
  consignment_status text,
  admin_stock_on_hand integer not null default 0,
  origin_shipping jsonb,
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
  payout_status text not null default 'available_next_cycle',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  checkout_ref text not null unique,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_name text,
  buyer_email text,
  seller_band_user_id uuid references auth.users(id) on delete set null,
  seller_band_slug text,
  seller_band_name text,
  payment_type text not null,
  product_title text not null,
  amount integer not null default 0,
  product_amount integer not null default 0,
  shipping_cost integer not null default 0,
  provider_invoice_id text,
  provider_checkout_url text,
  provider_status text,
  status text not null default 'waiting_admin_confirmation',
  proof_file_name text,
  proof_url text,
  proof_storage_path text,
  proof_status text,
  payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by text,
  rejected_at timestamptz,
  rejected_by text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.release_agreements (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.releases(id) on delete set null,
  release_title text not null,
  band_user_id uuid references auth.users(id) on delete set null,
  band_name text not null,
  band_slug text,
  signer_name text not null,
  signer_email text,
  agreement_version text not null default 'wispace-release-agreement-v1',
  agreement_text text not null,
  payout_bank_name text,
  payout_account_name text,
  payout_account_number text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_finance_reports (
  id uuid primary key default gen_random_uuid(),
  period_key text not null,
  band_user_id uuid references auth.users(id) on delete set null,
  band_slug text,
  band_name text not null,
  payout_bank_name text,
  payout_account_name text,
  payout_account_number text,
  cash_collected integer not null default 0,
  gross_amount integer not null default 0,
  shipping_collected integer not null default 0,
  platform_fee integer not null default 0,
  band_net integer not null default 0,
  transaction_count integer not null default 0,
  payout_status text not null default 'pending_review',
  generated_at timestamptz not null default now(),
  unique (period_key, band_slug)
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
  origin_shipping jsonb,
  fulfillment_mode text not null default 'band_ship',
  consignment_status text,
  tracking_number text,
  tracking_status text not null default 'pending',
  tracking_last_checked_at timestamptz,
  stock_restored boolean not null default false,
  stock_restored_at timestamptz,
  refund_requested_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
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

create table if not exists public.wispace_messages (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_contact text,
  subject text not null,
  body text not null,
  category text not null default 'lainnya',
  scope text not null default 'band',
  source text not null default 'user',
  target_band_slug text,
  target_band_name text,
  is_read boolean not null default false,
  replied boolean not null default false,
  last_reply text,
  parent_message_id uuid references public.wispace_messages(id) on delete set null,
  attachment_name text,
  attachment_url text,
  attachment_path text,
  attachment_type text,
  attachment_size integer not null default 0,
  attachment_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
add column if not exists is_active boolean not null default true,
add column if not exists fulfillment_mode text not null default 'band_ship',
add column if not exists fulfillment_label text,
add column if not exists consignment_status text,
add column if not exists admin_stock_on_hand integer not null default 0,
add column if not exists origin_shipping jsonb;

alter table if exists public.sales_transactions
add column if not exists order_id text,
add column if not exists payment_method text,
add column if not exists fulfillment_status text,
add column if not exists payout_status text not null default 'available_next_cycle',
add column if not exists payment_reference text,
add column if not exists paid_at timestamptz;

alter table if exists public.payment_requests
add column if not exists product_amount integer not null default 0,
add column if not exists shipping_cost integer not null default 0,
add column if not exists provider_invoice_id text,
add column if not exists provider_checkout_url text,
add column if not exists provider_status text,
add column if not exists payload jsonb not null default '{}'::jsonb,
add column if not exists proof_file_name text,
add column if not exists proof_url text,
add column if not exists proof_storage_path text,
add column if not exists proof_status text,
add column if not exists confirmed_by text,
add column if not exists rejected_by text,
add column if not exists rejection_reason text,
add column if not exists updated_at timestamptz not null default now();

alter table if exists public.merch_orders
add column if not exists order_id text,
add column if not exists shipping_cost integer not null default 0,
add column if not exists origin_shipping jsonb,
add column if not exists fulfillment_mode text not null default 'band_ship',
add column if not exists consignment_status text,
add column if not exists stock_restored boolean not null default false,
add column if not exists stock_restored_at timestamptz,
add column if not exists refund_requested_at timestamptz,
add column if not exists cancelled_at timestamptz,
add column if not exists refunded_at timestamptz,
add column if not exists resolved_at timestamptz,
add column if not exists resolution_note text;

alter table if exists public.monthly_finance_reports
add column if not exists cash_collected integer not null default 0,
add column if not exists shipping_collected integer not null default 0;

alter table if exists public.wispace_messages
add column if not exists sender_user_id uuid references auth.users(id) on delete set null,
add column if not exists sender_name text not null default 'WiSpace User',
add column if not exists sender_contact text,
add column if not exists subject text not null default 'Pesan WiSpace',
add column if not exists body text not null default '',
add column if not exists category text not null default 'lainnya',
add column if not exists scope text not null default 'band',
add column if not exists source text not null default 'user',
add column if not exists target_band_slug text,
add column if not exists target_band_name text,
add column if not exists is_read boolean not null default false,
add column if not exists replied boolean not null default false,
add column if not exists last_reply text,
add column if not exists parent_message_id uuid references public.wispace_messages(id) on delete set null,
add column if not exists attachment_name text,
add column if not exists attachment_url text,
add column if not exists attachment_path text,
add column if not exists attachment_type text,
add column if not exists attachment_size integer not null default 0,
add column if not exists attachment_status text,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

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

create index if not exists sales_transactions_payout_idx
on public.sales_transactions (payout_status, created_at desc);

create index if not exists sales_transactions_status_idx
on public.sales_transactions (status, created_at desc);

create index if not exists sales_transactions_fulfillment_idx
on public.sales_transactions (fulfillment_status, created_at desc);

create index if not exists payment_requests_status_idx
on public.payment_requests (status, submitted_at desc);

create index if not exists payment_requests_buyer_idx
on public.payment_requests (buyer_user_id, submitted_at desc);

create index if not exists payment_requests_seller_idx
on public.payment_requests (seller_band_user_id, submitted_at desc);

create index if not exists payment_requests_checkout_ref_idx
on public.payment_requests (checkout_ref);

create index if not exists payment_requests_provider_invoice_idx
on public.payment_requests (provider_invoice_id);

create index if not exists release_agreements_band_idx
on public.release_agreements (band_slug, signed_at desc);

create index if not exists monthly_finance_reports_period_idx
on public.monthly_finance_reports (period_key, generated_at desc);

create index if not exists merch_orders_transaction_idx
on public.merch_orders (transaction_id);

create index if not exists merch_orders_buyer_idx
on public.merch_orders (buyer_user_id, created_at desc);

create index if not exists merch_orders_seller_idx
on public.merch_orders (seller_band_user_id, created_at desc);

create index if not exists merch_orders_status_idx
on public.merch_orders (tracking_status, created_at desc);

create index if not exists merch_orders_resolution_idx
on public.merch_orders (stock_restored, resolved_at desc);

create index if not exists band_subscriptions_audience_idx
on public.band_subscriptions (audience_user_id, created_at desc);

create index if not exists band_update_notifications_band_idx
on public.band_update_notifications (band_slug, created_at desc);

create index if not exists audience_notification_reads_user_idx
on public.audience_notification_reads (audience_user_id, created_at desc);

create index if not exists wispace_messages_scope_idx
on public.wispace_messages (scope, created_at desc);

create index if not exists wispace_messages_target_band_idx
on public.wispace_messages (target_band_slug, created_at desc);

create index if not exists wispace_messages_sender_idx
on public.wispace_messages (sender_user_id, created_at desc);

create index if not exists shipment_events_order_idx
on public.shipment_tracking_events (merch_order_id, event_time desc);

alter table public.band_articles enable row level security;
alter table public.article_comments enable row level security;
alter table public.content_reports enable row level security;
alter table public.merch_items enable row level security;
alter table public.sales_transactions enable row level security;
alter table public.payment_requests enable row level security;
alter table public.admin_users enable row level security;
alter table public.release_agreements enable row level security;
alter table public.monthly_finance_reports enable row level security;
alter table public.merch_orders enable row level security;
alter table public.band_subscriptions enable row level security;
alter table public.band_update_notifications enable row level security;
alter table public.audience_notification_reads enable row level security;
alter table public.wispace_messages enable row level security;
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

drop policy if exists "Bands can update own transaction fulfillment" on public.sales_transactions;
create policy "Bands can update own transaction fulfillment"
on public.sales_transactions for update
using (auth.uid() = seller_band_user_id)
with check (auth.uid() = seller_band_user_id);

drop policy if exists "Admins can manage all transactions" on public.sales_transactions;
create policy "Admins can manage all transactions"
on public.sales_transactions for all
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

drop policy if exists "Audience can create own payment requests" on public.payment_requests;
create policy "Audience can create own payment requests"
on public.payment_requests for insert
with check (auth.uid() = buyer_user_id);

drop policy if exists "Payment participants can read payment requests" on public.payment_requests;
create policy "Payment participants can read payment requests"
on public.payment_requests for select
using (auth.uid() = buyer_user_id or auth.uid() = seller_band_user_id);

drop policy if exists "Admins can read all payment requests" on public.payment_requests;
create policy "Admins can read all payment requests"
on public.payment_requests for select
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update payment requests" on public.payment_requests;
create policy "Admins can update payment requests"
on public.payment_requests for update
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

drop policy if exists "Buyers can update own payment proof requests" on public.payment_requests;
create policy "Buyers can update own payment proof requests"
on public.payment_requests for update
using (
  auth.uid() = buyer_user_id
  and status in ('waiting_admin_confirmation', 'rejected')
)
with check (
  auth.uid() = buyer_user_id
  and status in ('waiting_admin_confirmation', 'rejected')
);

drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
using (auth.uid() = user_id);

drop policy if exists "Bands can read own release agreements" on public.release_agreements;
create policy "Bands can read own release agreements"
on public.release_agreements for select
using (auth.uid() = band_user_id);

drop policy if exists "Bands can insert own release agreements" on public.release_agreements;
create policy "Bands can insert own release agreements"
on public.release_agreements for insert
with check (auth.uid() = band_user_id);

do $$
begin
  if to_regclass('public.audience_library') is not null then
    execute $policy$
      drop policy if exists "Admins can manage audience library" on public.audience_library
    $policy$;
    execute $policy$
      create policy "Admins can manage audience library"
      on public.audience_library for all
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
      )
    $policy$;
  end if;
end $$;

drop policy if exists "Bands can read own finance reports" on public.monthly_finance_reports;
create policy "Bands can read own finance reports"
on public.monthly_finance_reports for select
using (auth.uid() = band_user_id);

drop policy if exists "Order participants can read merch orders" on public.merch_orders;
create policy "Order participants can read merch orders"
on public.merch_orders for select
using (auth.uid() = buyer_user_id or auth.uid() = seller_band_user_id);

drop policy if exists "Audience can create own merch orders" on public.merch_orders;
create policy "Audience can create own merch orders"
on public.merch_orders for insert
with check (auth.uid() = buyer_user_id);

drop policy if exists "Bands can update own merch orders" on public.merch_orders;
create policy "Bands can update own merch orders"
on public.merch_orders for update
using (auth.uid() = seller_band_user_id)
with check (auth.uid() = seller_band_user_id);

drop policy if exists "Admins can manage all merch orders" on public.merch_orders;
create policy "Admins can manage all merch orders"
on public.merch_orders for all
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

drop policy if exists "Admins can manage all wispace messages" on public.wispace_messages;
create policy "Admins can manage all wispace messages"
on public.wispace_messages for all
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

drop policy if exists "Message senders can read own messages" on public.wispace_messages;
create policy "Message senders can read own messages"
on public.wispace_messages for select
using (auth.uid() = sender_user_id);

drop policy if exists "Authenticated users can send wispace messages" on public.wispace_messages;
create policy "Authenticated users can send wispace messages"
on public.wispace_messages for insert
with check (
  auth.uid() = sender_user_id
  and scope in ('band', 'admin', 'audience')
);

drop policy if exists "Bands can read own band messages" on public.wispace_messages;
create policy "Bands can read own band messages"
on public.wispace_messages for select
using (
  scope = 'band'
  and (
    target_band_slug is null
    or target_band_slug = 'all'
    or exists (
      select 1 from public.band_profiles
      where band_profiles.slug = wispace_messages.target_band_slug
      and band_profiles.user_id = auth.uid()
    )
  )
);

drop policy if exists "Bands can update own band messages" on public.wispace_messages;
create policy "Bands can update own band messages"
on public.wispace_messages for update
using (
  scope = 'band'
  and (
    target_band_slug is null
    or target_band_slug = 'all'
    or exists (
      select 1 from public.band_profiles
      where band_profiles.slug = wispace_messages.target_band_slug
      and band_profiles.user_id = auth.uid()
    )
  )
)
with check (
  scope = 'band'
  and (
    target_band_slug is null
    or target_band_slug = 'all'
    or exists (
      select 1 from public.band_profiles
      where band_profiles.slug = wispace_messages.target_band_slug
      and band_profiles.user_id = auth.uid()
    )
  )
);

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
-- To enable real admin payment sync without service-role API, insert your admin auth user id:
-- insert into public.admin_users (user_id, email)
-- values ('YOUR_AUTH_USER_UUID', 'admin@wispace.my.id')
-- on conflict (user_id) do update set email = excluded.email;
