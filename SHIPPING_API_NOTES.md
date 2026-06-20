# WiSpace Shipping API Notes

Catatan awal integrasi ekspedisi untuk order merchandise:

- Simpan order merch di `merch_orders` setelah payment sukses.
- Simpan `courier_code`, `courier_service`, `shipping_cost`, dan `tracking_number`.
- Tracking status ditarik berkala dari API ekspedisi, lalu disimpan ke `shipment_tracking_events`.
- UI audience menampilkan status kiriman dari `tracking_status` dan event terbaru.
- UI band menampilkan daftar order merch yang perlu diproses dan nomor resi yang sudah diinput.

Opsi API yang bisa dipertimbangkan:

- RajaOngkir atau Komerce API untuk cek ongkir dan tracking lokal Indonesia.
- BinderByte atau API agregator serupa untuk tracking multi-ekspedisi.
- Plugin payment/shipping custom via backend serverless supaya API key tidak bocor di frontend.

Flow MVP:

1. Audience klik buy merch.
2. Isi alamat dan pilih ekspedisi.
3. Payment sukses.
4. Transaksi masuk `sales_transactions` dengan split 80/20.
5. Order masuk `merch_orders`.
6. Band input resi.
7. Sistem fetch tracking dan update `shipment_tracking_events`.

Endpoint serverless yang sudah disiapkan:

- `POST /api/shipping-rates`
  - Input: `originCity`, `destinationCity`, `weightGram`.
  - Output: daftar courier, service, estimasi, dan ongkir.
  - Saat API key belum diset, endpoint mengembalikan estimasi manual WiSpace.
- `POST /api/shipping-track`
  - Input: `courierCode` dan `trackingNumber`.
  - Output: status ringkas dan event tracking.
  - Saat API key belum diset, endpoint mengembalikan status manual dari resi yang sudah diinput.

Environment Vercel:

- `SHIPPING_PROVIDER=manual` untuk mode awal.
- Nanti bisa diganti ke provider yang dipilih, misalnya `rajaongkir`, `komerce`, atau `binderbyte`.
- Isi salah satu key sesuai provider: `RAJAONGKIR_API_KEY`, `KOMERCE_API_KEY`, `BINDERBYTE_API_KEY`, atau `SHIPPING_API_KEY`.

Prioritas implementasi:

1. **Manual fulfillment stabil**
   - Buyer isi alamat lengkap.
   - Band/admin input nomor resi manual.
   - Audience bisa lihat status order dan resi.
2. **Cek ongkir server-side**
   - Endpoint `/api/shipping-rates`.
   - Input origin band/admin, destination buyer, berat barang.
   - API key ekspedisi disimpan di Vercel server env.
3. **Tracking server-side**
   - Endpoint `/api/shipping-track`.
   - Input courier + tracking number.
   - Simpan event tracking agar admin/band/audience bisa lihat histori.
