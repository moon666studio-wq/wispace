# WiSpace Payment Gateway Scaffold

This note keeps the next payment-gateway work explicit and safe.

## Current Mode

- The app still uses manual transfer + proof upload.
- Admin confirms paid from the Admin Payment panel.
- Manual fallback should stay available even after a gateway is added.
- Checkout frontend now calls `POST /api/create-payment` before saving the pending payment.
- If the API returns `provider_checkout_url`, the checkout modal shows a "Bayar via Gateway" link.
- If the API is unavailable or the provider is not ready, the request is still saved as manual fallback.

## Public Frontend Env

These can be exposed to Vite:

- `VITE_PAYMENT_PROVIDER=manual | midtrans | xendit`
- `VITE_PAYMENT_API_ENDPOINT=/api/create-payment`
- `VITE_MIDTRANS_CLIENT_KEY=...` for Midtrans Snap only

Do not put secret keys in any `VITE_` env.

## Server-Only Env

These must only live in Vercel/serverless env:

- `MIDTRANS_SERVER_KEY`
- `XENDIT_SECRET_KEY`
- webhook signing/verification secrets, if used by the provider

## API Routes

These routes now exist as safe scaffolds. They do not charge real money yet.

1. `POST /api/create-payment`
   - Input: `checkoutRef`, buyer data, product amount, shipping cost, product metadata.
   - Manual provider returns a manual fallback response.
   - Midtrans/Xendit currently check server secret availability and return `provider_not_implemented`.
   - Later: create a provider invoice/transaction and store `provider_invoice_id`, `provider_checkout_url`, and `provider_status` in `payment_requests`.

2. `POST /api/payment-webhook`
   - Verifies provider signature/callback token before any DB write.
   - Maps provider status to WiSpace status:
     - `settlement` / `paid` -> `paid`
     - `expire` / `expired` -> `rejected` or `expired`
     - `refund` -> `refunded`
   - With `SUPABASE_URL` or `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`, writes provider status to `payment_requests` and logs the callback in `payment_webhook_events`.
   - Trusted paid status becomes `provider_paid_pending_activation`; admin still confirms activation so Library/Order/ledger are created safely.
   - Without signature/token or service role env, webhook stays dry-run.

3. `POST /api/refund-payment`
   - Admin-only.
   - Manual provider returns a manual refund review response.
   - Midtrans/Xendit currently check server secret availability and return `refund_provider_not_implemented`.
   - Later: request refund to provider and mark order `refund_requested` then `refunded` after provider confirms.

## Next Implementation Locks

- Add Supabase service role only in Vercel server env.
- Make `/api/create-payment` write provider invoice data to `payment_requests`.
- Make `/api/payment-webhook` call the same internal activation logic currently handled by admin confirm, after provider integration is live-tested.
- Keep manual proof upload as fallback.

## Ledger Rules

- Buyer payment total = product amount + shipping cost.
- WiSpace 20% fee is calculated from product amount only.
- Band net = product amount - WiSpace fee.
- Shipping is recorded separately and is not band/WiSpace revenue.
