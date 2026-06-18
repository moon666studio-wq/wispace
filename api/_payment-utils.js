const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export const getEnv = (key) => globalThis.process?.env?.[key] || '';

export const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
};

export const readJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  let rawBody = '';
  for await (const chunk of req) rawBody += chunk.toString();
  return rawBody.trim() ? JSON.parse(rawBody) : {};
};

export const normalizeProvider = (provider = '') => {
  const nextProvider = String(provider || '').toLowerCase().trim();
  return ['manual', 'midtrans', 'xendit'].includes(nextProvider) ? nextProvider : 'manual';
};

export const normalizeAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
};

export const validateCheckoutPayload = (payload = {}) => {
  const checkoutRef = String(payload.checkoutRef || '').trim();
  const paymentType = String(payload.paymentType || payload.type || 'order').trim();
  const productTitle = String(payload.productTitle || '').trim();
  const amount = normalizeAmount(payload.amount);
  const productAmount = normalizeAmount(payload.productAmount || payload.grossAmount || amount);
  const shippingCost = normalizeAmount(payload.shippingCost);
  const buyerEmail = String(payload.buyerEmail || '').trim();

  const errors = [];
  if (!checkoutRef) errors.push('checkoutRef wajib dikirim.');
  if (!productTitle) errors.push('productTitle wajib dikirim.');
  if (amount <= 0) errors.push('amount harus lebih dari 0.');
  if (productAmount <= 0) errors.push('productAmount harus lebih dari 0.');
  if (shippingCost > amount) errors.push('shippingCost tidak boleh lebih besar dari amount.');

  return {
    ok: errors.length === 0,
    errors,
    checkout: {
      checkoutRef,
      paymentType,
      productTitle,
      amount,
      productAmount,
      shippingCost,
      buyerEmail,
      buyerName: String(payload.buyerName || '').trim(),
      sellerBandName: String(payload.sellerBandName || '').trim(),
      sellerBandSlug: String(payload.sellerBandSlug || '').trim()
    }
  };
};

export const getProviderServerKeyName = (provider) => ({
  midtrans: 'MIDTRANS_SERVER_KEY',
  xendit: 'XENDIT_SECRET_KEY',
  manual: ''
}[provider] || '');

export const mapProviderStatusToWispace = (providerStatus = '') => {
  const normalizedStatus = String(providerStatus || '').toLowerCase();
  if (['settlement', 'capture', 'paid', 'paid_status', 'success'].includes(normalizedStatus)) return 'paid';
  if (['expire', 'expired', 'deny', 'failure', 'failed', 'void'].includes(normalizedStatus)) return 'rejected';
  if (['refund', 'refunded', 'partial_refund'].includes(normalizedStatus)) return 'refunded';
  if (['pending', 'challenge', 'waiting'].includes(normalizedStatus)) return 'waiting_admin_confirmation';
  return 'provider_status_unmapped';
};

