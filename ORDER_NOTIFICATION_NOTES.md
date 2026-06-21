# WiSpace Order Notification Notes

Endpoint:

- `POST /api/notify-order`
- Dipanggil otomatis setelah checkout masuk pending payment.
- Checkout tidak gagal kalau email/WA/webhook belum diset.
- `POST /api/payment-webhook` juga mengirim email admin dan band saat provider status menjadi paid, refunded, atau rejected.

## Email via Resend

Server-only Vercel env:

- `RESEND_API_KEY`
- `ORDER_NOTIFY_EMAIL_TO`
- `ORDER_NOTIFY_EMAIL_FROM`

Kalau `ORDER_NOTIFY_EMAIL_FROM` belum diset, endpoint pakai fallback `WiSpace <onboarding@resend.dev>`.
Untuk production, pakai domain email sendiri yang sudah diverifikasi di Resend.

Email yang dikirim:

- Admin: order baru setelah checkout dibuat.
- Admin: payment paid setelah Midtrans webhook verified dan payment request diupdate.
- Admin: payment rejected/refunded kalau provider mengirim status gagal/refund.
- Band: order baru setelah checkout dibuat, dikirim ke email band yang tersimpan di profile/data seller.
- Band: payment paid setelah Midtrans webhook verified, lalu email paid final setelah admin confirm order.
- Band: label/resi shipment setelah booking ekspedisi berhasil, termasuk link label kalau provider mengembalikan file label.

Email band hanya terkirim kalau profile band punya email atau payload order punya `sellerBandEmail`.

## WhatsApp Cloud API

Server-only Vercel env:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ADMIN_TO`
- `WHATSAPP_GRAPH_API_VERSION` optional, default `v20.0`

`WHATSAPP_ADMIN_TO` pakai format internasional tanpa plus, contoh `6281234567890`.

## Generic Webhook

Server-only Vercel env:

- `ORDER_NOTIFY_WEBHOOK_URL`

Ini bisa dipakai untuk Make, Zapier, n8n, Discord/Slack bridge, atau provider WA lokal.

## Shipping Next Step

Ekspedisi sebaiknya bertahap:

1. Manual dulu: buyer isi alamat, pilih courier estimasi, band/admin input resi.
2. Tambah API ongkir: endpoint serverless untuk cek tarif berdasarkan origin band/admin dan destination buyer.
3. Tambah API tracking: endpoint serverless untuk tarik status resi dan simpan ke `merch_orders` / tracking events.

API key ekspedisi wajib server-only di Vercel, jangan masuk `VITE_`.
