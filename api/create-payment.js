import {
  getEnv,
  getProviderServerKeyName,
  normalizeProvider,
  readJsonBody,
  sendJson,
  validateCheckoutPayload
} from './_payment-utils.js';
import { Buffer } from 'node:buffer';

const getMidtransSnapBaseUrl = () => {
  const mode = String(getEnv('MIDTRANS_ENV') || '').toLowerCase();
  const isProduction = String(getEnv('MIDTRANS_IS_PRODUCTION') || '').toLowerCase() === 'true' || mode === 'production';
  return isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
};

const getMidtransEnvironmentName = () => (
  getMidtransSnapBaseUrl().includes('sandbox') ? 'sandbox' : 'production'
);

const validateMidtransServerKey = (serverKey) => {
  const environment = getMidtransEnvironmentName();
  const key = String(serverKey || '').trim();
  if (environment === 'sandbox' && !key.startsWith('SB-Mid-server-')) {
    return {
      ok: false,
      environment,
      error: 'midtrans_server_key_environment_mismatch',
      message: 'MIDTRANS_ENV=sandbox but MIDTRANS_SERVER_KEY is not a Sandbox Server Key. Use key that starts with SB-Mid-server-.'
    };
  }
  if (environment === 'production' && key.startsWith('SB-Mid-server-')) {
    return {
      ok: false,
      environment,
      error: 'midtrans_server_key_environment_mismatch',
      message: 'MIDTRANS_ENV=production but MIDTRANS_SERVER_KEY is a Sandbox Server Key. Use Production Server Key or switch MIDTRANS_ENV=sandbox.'
    };
  }
  return { ok: true, environment };
};

const clampText = (value = '', maxLength = 50) => String(value || '').trim().slice(0, maxLength);

const getPublicSiteUrl = () => {
  const rawUrl = String(getEnv('PUBLIC_SITE_URL') || getEnv('VERCEL_PROJECT_PRODUCTION_URL') || '').trim().replace(/\/$/, '');
  if (!rawUrl) return '';
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
};

const createMidtransSnapTransaction = async (checkout, serverKey) => {
  const baseUrl = getMidtransSnapBaseUrl();
  const productAmount = Number(checkout.productAmount || checkout.amount || 0);
  const shippingCost = Number(checkout.shippingCost || 0);
  const itemDetails = [
    {
      id: `${checkout.checkoutRef}-item`.slice(0, 50),
      price: productAmount,
      quantity: 1,
      name: clampText(checkout.productTitle || 'WiSpace Order')
    }
  ];

  if (shippingCost > 0) {
    itemDetails.push({
      id: `${checkout.checkoutRef}-shipping`.slice(0, 50),
      price: shippingCost,
      quantity: 1,
      name: 'Ongkir'
    });
  }

  const siteUrl = getPublicSiteUrl();
  const snapPayload = {
    transaction_details: {
      order_id: checkout.checkoutRef,
      gross_amount: checkout.amount
    },
    item_details: itemDetails,
    customer_details: {
      first_name: clampText(checkout.buyerName || 'Audience WiSpace', 255),
      email: checkout.buyerEmail || undefined
    },
    custom_field1: checkout.paymentType,
    custom_field2: checkout.sellerBandSlug || checkout.sellerBandName || '',
    custom_field3: 'wispace'
  };

  if (siteUrl) {
    snapPayload.callbacks = {
      finish: `${siteUrl}/?payment=${encodeURIComponent(checkout.checkoutRef)}&status=finish`,
      unfinish: `${siteUrl}/?payment=${encodeURIComponent(checkout.checkoutRef)}&status=unfinish`,
      error: `${siteUrl}/?payment=${encodeURIComponent(checkout.checkoutRef)}&status=error`
    };
  }

  const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(snapPayload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const rawError = data?.error_messages?.join(', ') || data?.message || 'midtrans_snap_request_failed';
    const isAccessDenied = String(rawError).toLowerCase().includes('access denied');
    return {
      ok: false,
      status: response.status,
      data,
      error: isAccessDenied
        ? `${rawError}. Check that MIDTRANS_ENV matches the key mode and Client Key/Server Key come from the same Midtrans merchant account.`
        : rawError
    };
  }

  return {
    ok: true,
    status: response.status,
    data,
    providerCheckoutUrl: data.redirect_url || '',
    providerInvoiceId: data.token || '',
    providerStatus: 'gateway_ready'
  };
};

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

    if (provider === 'midtrans') {
      const keyValidation = validateMidtransServerKey(serverKey);
      if (!keyValidation.ok) {
        return sendJson(res, 400, {
          ok: false,
          provider,
          error: keyValidation.error,
          manualFallback: true,
          checkoutRef: validation.checkout.checkoutRef,
          providerStatus: 'gateway_key_mismatch',
          midtransEnvironment: keyValidation.environment,
          message: keyValidation.message
        });
      }

      const snapResult = await createMidtransSnapTransaction(validation.checkout, serverKey);
      if (!snapResult.ok) {
        return sendJson(res, 502, {
          ok: false,
          provider,
          error: snapResult.error,
          manualFallback: true,
          checkoutRef: validation.checkout.checkoutRef,
          providerStatus: 'gateway_error',
          providerResponse: snapResult.data,
          message: 'Midtrans belum berhasil membuat checkout. Request tetap bisa fallback manual di frontend.'
        });
      }

      return sendJson(res, 200, {
        ok: true,
        provider,
        manualFallback: false,
        checkoutRef: validation.checkout.checkoutRef,
        amount: validation.checkout.amount,
        productAmount: validation.checkout.productAmount,
        shippingCost: validation.checkout.shippingCost,
        providerStatus: snapResult.providerStatus,
        providerInvoiceId: snapResult.providerInvoiceId,
        providerCheckoutUrl: snapResult.providerCheckoutUrl,
        transactionToken: snapResult.providerInvoiceId,
        message: 'Midtrans Snap checkout siap.'
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      error: 'provider_not_implemented',
      manualFallback: true,
      checkoutRef: validation.checkout.checkoutRef,
      message: 'Provider ini belum diimplementasikan. Manual fallback tetap aktif.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json',
      message: error?.message || 'Request body tidak bisa dibaca.'
    });
  }
}
