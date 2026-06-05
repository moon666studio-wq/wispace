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
