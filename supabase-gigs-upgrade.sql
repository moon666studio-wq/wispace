alter table public.gigs
  add column if not exists htm text,
  add column if not exists cp text,
  add column if not exists request_type text not null default 'free',
  add column if not exists approved_at date,
  add column if not exists approved_until date,
  add column if not exists exclusive_fee integer not null default 30000,
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists band_id uuid;

alter table public.gigs
  drop constraint if exists gigs_request_type_check;

alter table public.gigs
  add constraint gigs_request_type_check
  check (request_type in ('free', 'exclusive'));

alter table public.gigs
  drop constraint if exists gigs_payment_status_check;

alter table public.gigs
  add constraint gigs_payment_status_check
  check (payment_status in ('not_required', 'awaiting_payment', 'paid', 'refunded', 'cancelled'));

update public.gigs
set
  request_type = case
    when genre like '%::request=exclusive%' then 'exclusive'
    else coalesce(request_type, 'free')
  end,
  htm = coalesce(
    htm,
    nullif(split_part(split_part(genre, '::htm=', 2), '::', 1), '')
  ),
  cp = coalesce(
    cp,
    nullif(split_part(split_part(genre, '::cp=', 2), '::', 1), '')
  )
where genre like '%::request=%';

update public.gigs
set approved_until = current_date + interval '10 days'
where status in ('approved', 'approved_free', 'approved_exclusive')
  and approved_until is null;

update public.gigs
set approved_at = coalesce(approved_at, created_at::date, current_date)
where status in ('approved', 'approved_free', 'approved_exclusive')
  and approved_at is null;

update public.gigs
set payment_status = case
  when request_type = 'exclusive' and status = 'approved_waiting_payment' then 'awaiting_payment'
  when request_type = 'exclusive' and status in ('paid_waiting_activation', 'approved_exclusive') then 'paid'
  else 'not_required'
end
where payment_status is null
   or payment_status = 'not_required';

update public.gigs
set activated_at = coalesce(activated_at, approved_at::timestamptz, now())
where status = 'approved_exclusive'
  and activated_at is null;

create index if not exists gigs_status_payment_idx
on public.gigs (status, payment_status, created_at desc);
