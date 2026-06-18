import {
  getEnv,
  getProviderServerKeyName,
  normalizeAmount,
  normalizeProvider,
  readJsonBody,
  sendJson
} from './_payment-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const provider = normalizeProvider(payload.provider || getEnv('PAYMENT_PROVIDER') || 'manual');
    const checkoutRef = String(payload.checkoutRef || '').trim();
    const providerInvoiceId = String(payload.providerInvoiceId || '').trim();
    const refundAmount = normalizeAmount(payload.amount);

    if (!checkoutRef && !providerInvoiceId) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_refund_reference',
        message: 'checkoutRef atau providerInvoiceId wajib dikirim.'
      });
    }

    if (provider === 'manual') {
      return sendJson(res, 200, {
        ok: true,
        provider: 'manual',
        manualFallback: true,
        checkoutRef,
        providerInvoiceId,
        amount: refundAmount,
        providerStatus: 'manual_refund_review',
        message: 'Manual refund fallback aktif. Admin tandai review/refunded dari dashboard.'
      });
    }

    const serverKeyName = getProviderServerKeyName(provider);
    const serverKey = getEnv(serverKeyName);

    if (!serverKey) {
      return sendJson(res, 501, {
        ok: false,
        provider,
        error: 'missing_provider_secret',
        missingEnv: serverKeyName,
        manualFallback: true,
        message: `${serverKeyName} belum diset di Vercel server env.`
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      error: 'refund_provider_not_implemented',
      checkoutRef,
      providerInvoiceId,
      amount: refundAmount,
      message: 'Refund endpoint scaffold sudah ada, tapi request refund ke provider belum diaktifkan.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json',
      message: error?.message || 'Request body tidak bisa dibaca.'
    });
  }
}

