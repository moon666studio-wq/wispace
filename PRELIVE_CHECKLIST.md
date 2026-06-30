# WiSpace Pre-Live Checklist

Run this after Supabase SQL hardening is applied and before switching payments to production.

## 1. Smoke checks
- Open https://wispace.my.id and confirm home loads without login.
- Confirm logo uses `/brand/logo-wispace-biru.svg` and favicon loads.
- Confirm `/api/payment-health` returns `ok: true`.
- Confirm `/api/shipping-health` returns `ok: true`.

## 2. Auth and profile
- Create/login with an audience account.
- Create/login with a band account.
- Create or edit band profile.
- Upload band photo/cover.
- Confirm public band profile is readable while private fields stay owner-only.

## 3. Gigs
- Submit a free gig poster as a logged-in user.
- Submit an exclusive gig poster as a logged-in user.
- Confirm the row has `band_id` in Supabase.
- Confirm non-owner cannot update another user's gig.
- Confirm admin can approve/remove gigs.

## 4. Releases and audio
- Create a release with cover and preview track.
- Confirm preview file lands in `release-previews`.
- Confirm full audio lands in `release-audio`.
- Confirm public users can read release metadata and previews.
- Confirm only owner/buyer/free-full policy can access private audio.

## 5. Merch and orders
- Create a merch item as a band account.
- Confirm public users can see active merch.
- Checkout merch as an audience account.
- Confirm `payment_requests`, `sales_transactions`, and `merch_orders` rows are created.
- Confirm band can see only related orders.

## 6. Payment sandbox
- Keep Midtrans in sandbox until this section passes.
- Create a sandbox payment.
- Complete payment in Midtrans sandbox.
- Confirm webhook updates `payment_requests` status.
- Confirm related order/library/transaction state updates as expected.
- Confirm failed/expired payment states are handled.

## 7. Shipping
- Calculate shipping rate for at least three destination cities.
- Create shipment for a test merch order.
- Confirm tracking number/status appears.
- Confirm fallback/manual handling is clear if provider fails.

## 8. Admin operations
- Confirm admin user exists in `public.admin_users`.
- Confirm admin can read content reports.
- Confirm admin can read payment requests and webhook events.
- Confirm admin can manage gigs, merch orders, and support messages.
- Confirm non-admin cannot read admin-only tables.

## 9. Launch switch
- Only after all sandbox tests pass, set Vercel production payment env:
  - `MIDTRANS_ENV=production`
  - `MIDTRANS_IS_PRODUCTION=true`
  - production `MIDTRANS_SERVER_KEY`
  - production `VITE_MIDTRANS_CLIENT_KEY`
- Redeploy production.
- Re-run `/api/payment-health` and a small real payment test.