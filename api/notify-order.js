import { getEnv, readJsonBody, sendJson } from './_payment-utils.js';
import { compact, formatCurrency, postJson, sendAdminEmailNotification, sendEmailNotification } from './_notification-utils.js';

const normalizeStatus = (order = {}) => compact(order.paymentStatus || order.status || 'waiting_admin_confirmation');

const isShipmentStatus = (status = '') => [
  'shipment_booking_ready',
  'shipment_booking_created',
  'shipment_booking_failed',
  'processing',
  'processing_admin',
  'packing',
  'ready_to_ship',
  'shipped',
  'completed',
  'cancelled',
  'refund_requested',
  'refunded'
].includes(status);

const createOrderMessage = (order = {}) => {
  const status = normalizeStatus(order);
  const lines = [
    'WiSpace order baru',
    `Order: ${compact(order.checkoutRef) || '-'}`,
    `Tipe: ${compact(order.type || order.paymentType) || 'order'}`,
    `Produk: ${compact(order.productTitle) || '-'}`,
    `Seller: ${compact(order.sellerBandName) || '-'}`,
    `Buyer: ${compact(order.buyerName) || '-'} / ${compact(order.buyerEmail) || '-'}`,
    `Total: ${formatCurrency(order.amount)}`,
    `Status: ${status || 'waiting_admin_confirmation'}`,
    `Provider: ${compact(order.provider) || 'manual'} / ${compact(order.providerStatus) || 'pending'}`
  ];

  if (order.providerCheckoutUrl) lines.push(`Payment URL: ${order.providerCheckoutUrl}`);
  if (order.trackingNumber) lines.push(`Resi: ${compact(order.trackingNumber)}`);
  if (order.shipmentLabelUrl) lines.push(`Label: ${compact(order.shipmentLabelUrl)}`);
  if (order.shipmentBookingStatus) lines.push(`Shipment: ${compact(order.shipmentBookingStatus)}`);
  if (order.shippingPaymentStatus) lines.push(`Ongkir: ${compact(order.shippingPaymentStatus)}`);
  if (order.rejectionReason) lines.push(`Alasan: ${compact(order.rejectionReason)}`);
  if (order.shipmentMessage) lines.push(`Catatan shipment: ${compact(order.shipmentMessage)}`);
  if (order.shipping?.courier || order.shipping?.city) {
    lines.push(`Kirim: ${compact(order.shipping?.courier) || '-'} / ${compact(order.shipping?.city) || '-'}`);
  }

  return lines.join('\n');
};

const sendWebhookNotification = async (order, message) => {
  const webhookUrl = compact(getEnv('ORDER_NOTIFY_WEBHOOK_URL'));
  if (!webhookUrl) return { channel: 'webhook', skipped: true, reason: 'missing ORDER_NOTIFY_WEBHOOK_URL' };

  const result = await postJson(webhookUrl, {
    event: 'wispace.order.created',
    message,
    order
  });
  return { channel: 'webhook', ...result };
};

const sendAdminOrderEmailNotification = async (order, message) => {
  const status = normalizeStatus(order);
  const result = await sendAdminEmailNotification({
    subject: `${isShipmentStatus(status) ? 'Update order WiSpace' : 'Order baru WiSpace'} - ${compact(order.checkoutRef) || 'checkout'}`,
    text: message
  });
  return result;
};

const sendBandOrderEmailNotification = async (order, message) => {
  const sellerBandEmail = compact(order.sellerBandEmail || order.bandEmail || order.sellerEmail);
  if (!sellerBandEmail) {
    return { channel: 'email_band', skipped: true, reason: 'missing sellerBandEmail' };
  }

  const status = normalizeStatus(order);
  const subjectPrefix = status === 'paid'
    ? 'Order paid WiSpace'
    : status === 'provider_paid_pending_activation'
      ? 'Payment masuk WiSpace'
      : status === 'shipment_booking_ready' || status === 'ready_to_ship'
        ? 'Label/resi WiSpace'
        : status === 'shipped'
          ? 'Order sudah dikirim'
          : status === 'processing' || status === 'processing_admin' || status === 'packing'
            ? 'Order sedang diproses'
            : status === 'cancelled'
              ? 'Order dibatalkan'
              : status === 'refund_requested'
                ? 'Order minta refund'
                : status === 'refunded'
                  ? 'Order refunded'
        : status === 'shipment_booking_failed'
          ? 'Booking shipment perlu dicek'
          : 'Order baru WiSpace';
  const bandNote = status === 'paid'
    ? 'Payment sudah paid. Cek dashboard WiSpace untuk proses order, cetak label/resi, atau aktivasi akses digital.'
    : status === 'shipment_booking_ready' || status === 'ready_to_ship'
      ? 'Label/resi sudah siap. Buka dashboard order untuk cetak label dan lanjut kirim paket.'
      : status === 'shipped'
        ? 'Order sudah ditandai terkirim. Buyer akan menerima update resi dari WiSpace.'
        : status === 'processing' || status === 'processing_admin' || status === 'packing'
          ? 'Order sedang diproses fulfillment. Lanjut update status atau isi resi kalau paket sudah dikirim.'
          : status === 'cancelled'
            ? 'Order dibatalkan. Pastikan komunikasi dengan buyer dan cek stok/payout di dashboard.'
            : status === 'refund_requested'
              ? 'Buyer/admin menandai order ini untuk review refund. Cek detail order dan lanjutkan komunikasi.'
              : status === 'refunded'
                ? 'Order sudah ditandai refunded. Cek stok dan histori payout di dashboard.'
      : status === 'shipment_booking_failed'
        ? 'Booking shipment belum berhasil. Cek alamat asal/tujuan, nomor HP, kode pos, dan kurir aktif.'
        : 'Order masuk. Tunggu payment paid/konfirmasi admin sebelum kirim barang atau anggap akses final.';
  return sendEmailNotification({
    to: sellerBandEmail,
    channel: 'email_band',
    subject: `${subjectPrefix} - ${compact(order.productTitle) || compact(order.checkoutRef) || 'checkout'}`,
    text: [
      message,
      '',
      'Catatan untuk band:',
      bandNote
    ].join('\n')
  });
};

const sendBuyerOrderEmailNotification = async (order, message) => {
  const buyerEmail = compact(order.buyerEmail);
  if (!buyerEmail) {
    return { channel: 'email_buyer', skipped: true, reason: 'missing buyerEmail' };
  }

  const status = normalizeStatus(order);
  const subjectPrefix = status === 'paid'
    ? 'Payment diterima WiSpace'
    : status === 'provider_paid_pending_activation'
      ? 'Payment diterima gateway WiSpace'
      : status === 'processing' || status === 'processing_admin' || status === 'packing'
        ? 'Order sedang diproses'
        : status === 'shipment_booking_ready' || status === 'ready_to_ship'
          ? 'Order siap dikirim'
          : status === 'shipped'
            ? 'Order WiSpace sudah dikirim'
            : status === 'completed'
              ? 'Order WiSpace selesai'
              : status === 'cancelled'
                ? 'Order WiSpace dibatalkan'
                : status === 'refund_requested'
                  ? 'Refund order sedang direview'
                  : status === 'refunded'
                    ? 'Refund order selesai'
                    : status === 'rejected'
                      ? 'Payment WiSpace perlu dicek lagi'
                      : 'Order baru WiSpace';

  const buyerNote = status === 'paid'
    ? 'Payment kamu sudah dikonfirmasi. Order akan lanjut diproses oleh WiSpace atau band terkait.'
    : status === 'provider_paid_pending_activation'
      ? 'Payment dari gateway sudah masuk. Admin WiSpace akan verifikasi final sebelum order atau akses diaktifkan.'
      : status === 'processing' || status === 'processing_admin' || status === 'packing'
        ? 'Order kamu lagi diproses. Nanti kami kirim update lagi saat resi atau status kirim sudah siap.'
        : status === 'shipment_booking_ready' || status === 'ready_to_ship'
          ? `Shipment sudah siap.${order.trackingNumber ? ` Resi: ${compact(order.trackingNumber)}.` : ''}`
          : status === 'shipped'
            ? `Pesanan sudah dikirim.${order.trackingNumber ? ` Resi kamu: ${compact(order.trackingNumber)}.` : ''}`
            : status === 'completed'
              ? 'Order kamu sudah selesai. Terima kasih sudah belanja di WiSpace.'
              : status === 'cancelled'
                ? 'Order dibatalkan. Kalau kamu sudah transfer manual, cek email berikutnya atau hubungi admin WiSpace.'
                : status === 'refund_requested'
                  ? 'Refund order sedang direview oleh admin WiSpace. Kami kirim update lagi kalau sudah final.'
                  : status === 'refunded'
                    ? 'Refund order sudah ditandai selesai oleh admin WiSpace.'
                    : status === 'rejected'
                      ? `Payment belum bisa dikonfirmasi.${order.rejectionReason ? ` Alasan: ${compact(order.rejectionReason)}.` : ''}`
                      : order.providerCheckoutUrl
                        ? 'Silakan lanjutkan pembayaran lewat link checkout yang sudah disiapkan.'
                        : 'Order kamu sudah masuk. Kalau metode manual dipakai, tunggu instruksi berikutnya dari WiSpace.';

  const buyerLines = [
    message,
    '',
    'Catatan untuk buyer:',
    buyerNote
  ];

  if (order.providerCheckoutUrl && ['pending_payment', 'waiting_admin_confirmation', 'manual_pending', 'processing_payment'].includes(status)) {
    buyerLines.push(`Checkout: ${order.providerCheckoutUrl}`);
  }

  return sendEmailNotification({
    to: buyerEmail,
    channel: 'email_buyer',
    subject: `${subjectPrefix} - ${compact(order.productTitle) || compact(order.checkoutRef) || 'checkout'}`,
    text: buyerLines.join('\n')
  });
};

const sendWhatsAppNotification = async (order, message) => {
  const token = compact(getEnv('WHATSAPP_ACCESS_TOKEN'));
  const phoneNumberId = compact(getEnv('WHATSAPP_PHONE_NUMBER_ID'));
  const to = compact(getEnv('WHATSAPP_ADMIN_TO'));
  const version = compact(getEnv('WHATSAPP_GRAPH_API_VERSION') || 'v20.0');
  if (!token || !phoneNumberId || !to) {
    return {
      channel: 'whatsapp',
      skipped: true,
      reason: 'missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or WHATSAPP_ADMIN_TO'
    };
  }

  const result = await postJson(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      preview_url: Boolean(order.providerCheckoutUrl),
      body: message
    }
  }, {
    Authorization: `Bearer ${token}`
  });
  return { channel: 'whatsapp', ...result };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const order = payload.order || payload;
    const checkoutRef = compact(order.checkoutRef);
    if (!checkoutRef) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_checkout_ref',
        message: 'checkoutRef wajib dikirim untuk notifikasi order.'
      });
    }

    const message = createOrderMessage(order);
    const channels = await Promise.allSettled([
      sendWebhookNotification(order, message),
      sendAdminOrderEmailNotification(order, message),
      sendBandOrderEmailNotification(order, message),
      sendBuyerOrderEmailNotification(order, message),
      sendWhatsAppNotification(order, message)
    ]);
    const results = channels.map((channel) => (
      channel.status === 'fulfilled'
        ? channel.value
        : { channel: 'unknown', ok: false, error: channel.reason?.message || 'notification_failed' }
    ));

    return sendJson(res, 200, {
      ok: true,
      checkoutRef,
      sent: results.filter((result) => result.ok).length,
      skipped: results.filter((result) => result.skipped).length,
      results
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_notification_payload',
      message: error?.message || 'Payload notifikasi tidak bisa dibaca.'
    });
  }
}
