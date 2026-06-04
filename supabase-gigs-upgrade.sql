alter table public.gigs
  add column if not exists htm text,
  add column if not exists cp text,
  add column if not exists request_type text not null default 'free',
  add column if not exists approved_until date,
  add column if not exists band_id uuid;

alter table public.gigs
  drop constraint if exists gigs_request_type_check;

alter table public.gigs
  add constraint gigs_request_type_check
  check (request_type in ('free', 'exclusive'));

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
