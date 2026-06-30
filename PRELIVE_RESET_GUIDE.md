# Pre-Live Data Reset Guide

Use `supabase-prelive-reset-test-data.sql` when you want to clean old test content before running `PRELIVE_CHECKLIST.md`.

## Before Running

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Copy the UUID for the accounts you want to keep:
   - real admin account
   - optional band test account
   - optional audience test account
4. Open `supabase-prelive-reset-test-data.sql`.
5. Uncomment and replace the `insert into keep_users` examples with real UUID/email values.

Example:

```sql
insert into keep_users (user_id, email)
values ('REAL-ADMIN-UUID-HERE', 'admin@wispace.my.id');
```

The script will refuse to run if `keep_users` is empty.

## What It Deletes

- old gigs and pamflets
- releases and tracks
- merch items
- articles, comments, reports
- payment requests and webhook events
- transactions, merch orders, shipment events
- audience library and notification reads
- subscriptions and support messages
- dummy band profiles/agreements except users in `keep_users`
- uploaded files in WiSpace app buckets that do not belong to kept users

## What It Does Not Delete By Default

- `auth.users`
- kept users in `admin_users`
- files whose first storage folder is a kept user UUID

## Recommended Flow

1. Backup Supabase first.
2. Run `supabase-prelive-reset-test-data.sql` with your keep list filled.
3. Confirm the result table shows expected row counts.
4. Run `PRELIVE_CHECKLIST.md` manually.
5. After the checklist passes, clean checklist test data again if needed.
6. Add real launch content.