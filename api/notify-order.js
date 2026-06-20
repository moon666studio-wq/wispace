import { getEnv, readJsonBody, sendJson } from './_payment-utils.js';
import { compact, formatCurrency, postJson, sendAdminEmailNotification, sendEmailNotification } from './_notification-utils.js';

const createOrderMessage = (order = {}) => {
  const lines = [
    'WiSpace order baru',
    `Order: ${compact(order.checkoutRef) || '-'}`,
    `Tipe: ${compact(order.type || order.paymentType) || 'order'}`,
    `Produk: ${compact(order.productTitle) || '-'}`,
    `Seller: ${compact(order.sellerBandName) || '-'}`,
    `Buyer: ${compact(order.buyerName) || '-'} / ${compact(order.buyerEmail) || '-'}`,
    `Total: ${formatCurrency(order.amount)}`,
    `Status: ${compact(order.paymentStatus || order.status) || 'waiting_admin_confirmation'}`,
    `Provider: ${compact(order.provider) || 'manual'} / ${compact(order.providerStatus) || 'pending'}`
  ];

  if (order.providerCheckoutUrl) lines.push(`Payment URL: ${order.providerCheckoutUrl}`);
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
  const result = await sendAdminEmailNotification({
    subject: `Order baru WiSpace - ${compact(order.checkoutRef) || 'checkout'}`,
    text: message
  });
  return result;
};

const sendBandOrderEmailNotification = async (order, message) => {
  const sellerBandEmail = compact(order.sellerBandEmail || order.bandEmail || order.sellerEmail);
  if (!sellerBandEmail) {
    return { channel: 'email_band', skipped: true, reason: 'missing sellerBandEmail' };
  }

  const status = compact(order.paymentStatus || order.status);
  const subjectPrefix = status === 'paid'
    ? 'Order paid WiSpace'
    : status === 'provider_paid_pending_activation'
      ? 'Payment masuk WiSpace'
      : 'Order baru WiSpace';
  return sendEmailNotification({
    to: sellerBandEmail,
    channel: 'email_band',
    subject: `${subjectPrefix} - ${compact(order.productTitle) || compact(order.checkoutRef) || 'checkout'}`,
    text: [
      message,
      '',
      'Catatan untuk band:',
      status === 'paid'
        ? 'Payment sudah paid. Cek dashboard WiSpace untuk proses order, cetak label/resi, atau aktivasi akses digital.'
        : 'Order masuk. Tunggu payment paid/konfirmasi admin sebelum kirim barang atau anggap akses final.'
    ].join('\n')
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
