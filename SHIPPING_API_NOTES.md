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

Flow target setelah provider ekspedisi aktif:

1. Buyer bayar `harga merch + ongkir` via Midtrans.
2. Webhook/provider paid membuat payment siap diaktifkan.
3. Setelah order merch aktif, WiSpace memanggil `/api/create-shipment`.
4. Provider ekspedisi membuat resi/label dengan ongkir ditagihkan ke akun WiSpace.
5. Band/admin tinggal cetak label dan kirim paket tanpa bayar ongkir lagi.
6. Payout band dihitung dari harga merch saja, ongkir tetap dana titipan untuk ekspedisi.

Endpoint serverless yang sudah disiapkan:

- `POST /api/shipping-rates`
  - Input: `originDistrict`, `originCity`, `originProvince`, `destinationDistrict`, `destinationCity`, `destinationProvince`, `weightGram`.
  - Output: daftar courier, service, estimasi, dan ongkir.
  - Jika `SHIPPING_PROVIDER=biteship`, endpoint mencoba membaca ongkir live Biteship untuk JNE, J&T, dan SiCepat.
  - Saat API key belum diset atau area belum kebaca, endpoint mengembalikan estimasi manual WiSpace berbasis berat dan zona kota.
  - Kalau harga Bogor/Malang tetap sama, cek response mode: biasanya masih `manual_fallback` / `provider_fallback`, bukan `provider_live`.
- `POST /api/shipping-track`
  - Input: `courierCode` dan `trackingNumber`.
  - Output: status ringkas dan event tracking.
  - Jika `SHIPPING_PROVIDER=biteship`, endpoint mencoba membaca tracking live dari Biteship.
  - Saat API key belum diset, endpoint mengembalikan status manual dari resi yang sudah diinput.
- `POST /api/create-shipment`
  - Input: order merch, origin, destination, courier, berat, dan ongkir yang sudah dibayar buyer.
  - Output: `shipmentId`, `trackingNumber`, `labelUrl`, `bookingStatus`, dan `paymentStatus`.
  - Jika `SHIPPING_PROVIDER=biteship`, endpoint mencoba membuat order shipment live agar label/resi bisa muncul.
  - Saat API key belum diset atau payload provider kurang lengkap, endpoint mencatat fallback manual tanpa memblokir order.
- `GET /api/shipping-health`
  - Output: provider aktif, status key, base URL, dan kelengkapan origin shipper server.
  - Pakai endpoint ini setelah isi env Vercel untuk cek apakah shipment API sudah siap.

Environment Vercel:

- `SHIPPING_PROVIDER=manual` untuk mode awal.
- Untuk live booking awal pakai `SHIPPING_PROVIDER=biteship`.
- Isi `BITESHIP_API_KEY` dari dashboard Biteship. Alternatif universal: `SHIPPING_API_KEY`.
- Opsional: `BITESHIP_BASE_URL=https://api.biteship.com`.
- Isi origin server/admin agar provider bisa bikin shipment jika merch dikirim dari WiSpace:
  - `WISPACE_SHIPPER_NAME`
  - `WISPACE_SHIPPER_PHONE`
  - `WISPACE_SHIPPER_EMAIL`
  - `WISPACE_SHIPPER_ADDRESS`
  - `WISPACE_SHIPPER_DISTRICT`
  - `WISPACE_SHIPPER_CITY`
  - `WISPACE_SHIPPER_PROVINCE`
  - `WISPACE_SHIPPER_POSTAL_CODE`
- Kalau merch dikirim langsung dari band, band tetap harus isi alamat origin lengkap di profile/merch supaya booking tidak jatuh ke fallback.
- Untuk cek ongkir live yang akurat, alamat asal dan tujuan sebaiknya punya kecamatan, kota, provinsi, dan kode pos.

Prioritas implementasi:

1. **Manual fulfillment stabil**
   - Buyer isi alamat lengkap.
   - Band/admin input nomor resi manual.
   - Audience bisa lihat status order dan resi.
2. **Cek ongkir server-side**
   - Endpoint `/api/shipping-rates`.
   - Input origin band/admin, destination buyer sampai level kecamatan/kota/provinsi, dan berat barang.
   - API key ekspedisi disimpan di Vercel server env.
3. **Tracking server-side**
   - Endpoint `/api/shipping-track`.
   - Input courier + tracking number.
   - Simpan event tracking agar admin/band/audience bisa lihat histori.
4. **Create shipment / label**
   - Endpoint `/api/create-shipment`.
   - Dijalankan setelah payment/order merch aktif.
   - Target: provider mengembalikan resi dan label cetak, ongkir ditagihkan ke akun WiSpace.
