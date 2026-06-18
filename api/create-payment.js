import {
  getEnv,
  getProviderServerKeyName,
  normalizeProvider,
  readJsonBody,
  sendJson,
  validateCheckoutPayload
} from './_payment-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const provider = normalizeProvider(payload.provider || getEnv('PAYMENT_PROVIDER') || 'manual');
    const validation = validateCheckoutPayload(payload);

    if (!validation.ok) {
      return sendJson(res, 400, {
        ok: false,
        error: 'invalid_checkout_payload',
        details: validation.errors
      });
    }

    if (provider === 'manual') {
      return sendJson(res, 200, {
        ok: true,
        provider: 'manual',
        manualFallback: true,
        providerStatus: 'manual_pending',
        checkoutRef: validation.checkout.checkoutRef,
        amount: validation.checkout.amount,
        productAmount: validation.checkout.productAmount,
        shippingCost: validation.checkout.shippingCost,
        message: 'Manual payment fallback aktif. Buyer upload proof dan admin confirm paid.'
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
        message: `${serverKeyName} belum diset di Vercel server env. Jangan taruh secret di VITE env.`
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      error: 'provider_not_implemented',
      manualFallback: true,
      checkoutRef: validation.checkout.checkoutRef,
      message: 'Endpoint sudah siap menerima checkout, tapi integrasi provider belum diaktifkan supaya tidak charge uang beneran dulu.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json',
      message: error?.message || 'Request body tidak bisa dibaca.'
    });
  }
}

