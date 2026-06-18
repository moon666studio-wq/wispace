# WiSpace Payment Gateway Scaffold

This note keeps the next payment-gateway work explicit and safe.

## Current Mode

- The app still uses manual transfer + proof upload.
- Admin confirms paid from the Admin Payment panel.
- Manual fallback should stay available even after a gateway is added.

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

## API Routes To Build Later

1. `POST /api/create-payment`
   - Input: `checkoutRef`, buyer data, product amount, shipping cost, product metadata.
   - Creates a provider invoice/transaction.
   - Stores `provider_invoice_id`, `provider_checkout_url`, and `provider_status` in `payment_requests`.

2. `POST /api/payment-webhook`
   - Verifies provider signature.
   - Maps provider status to WiSpace status:
     - `settlement` / `paid` -> `paid`
     - `expire` / `expired` -> `rejected` or `expired`
     - `refund` -> `refunded`
   - Activates library/order only after a trusted paid status.

3. `POST /api/refund-payment`
   - Admin-only.
   - Requests refund to provider.
   - Marks order `refund_requested` then `refunded` after provider confirms.

## Ledger Rules

- Buyer payment total = product amount + shipping cost.
- WiSpace 20% fee is calculated from product amount only.
- Band net = product amount - WiSpace fee.
- Shipping is recorded separately and is not band/WiSpace revenue.

