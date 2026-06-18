import {
  getEnv,
  getProviderServerKeyName,
  getSupabaseAdminConfig,
  mapProviderStatusToWispace,
  normalizeProvider,
  readJsonBody,
  sendJson,
  supabaseAdminRequest
} from './_payment-utils.js';
import crypto from 'node:crypto';

const extractProviderStatus = (provider, payload = {}) => {
  if (provider === 'midtrans') return payload.transaction_status || payload.fraud_status || payload.status;
  if (provider === 'xendit') return payload.status || payload.event;
  return payload.status || payload.providerStatus;
};

const extractCheckoutReference = (provider, payload = {}) => {
  if (provider === 'midtrans') return payload.order_id || payload.checkoutRef || payload.external_id;
  if (provider === 'xendit') return payload.external_id || payload.reference_id || payload.checkoutRef;
  return payload.checkoutRef || payload.order_id || payload.external_id || payload.reference_id;
};

const extractProviderInvoiceId = (provider, payload = {}) => {
  if (provider === 'midtrans') return payload.transaction_id || payload.payment_id || payload.providerInvoiceId;
  if (provider === 'xendit') return payload.id || payload.invoice_id || payload.providerInvoiceId;
  return payload.providerInvoiceId || payload.transaction_id || payload.id || '';
};

const verifyMidtransSignature = (payload = {}) => {
  const serverKey = getEnv(getProviderServerKeyName('midtrans'));
  if (!serverKey || !payload.signature_key || !payload.order_id || !payload.status_code || !payload.gross_amount) {
    return { verified: false, reason: 'missing_midtrans_signature_fields' };
  }
  const expectedSignature = crypto
    .createHash('sha512')
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest('hex');
  return {
    verified: expectedSignature === payload.signature_key,
    reason: expectedSignature === payload.signature_key ? 'verified' : 'invalid_midtrans_signature'
  };
};

const verifyXenditSignature = (req) => {
  const callbackToken = getEnv('XENDIT_CALLBACK_TOKEN');
  const receivedToken = req.headers['x-callback-token'] || req.headers['X-CALLBACK-TOKEN'];
  if (!callbackToken) return { verified: false, reason: 'missing_xendit_callback_token_env' };
  return {
    verified: receivedToken === callbackToken,
    reason: receivedToken === callbackToken ? 'verified' : 'invalid_xendit_callback_token'
  };
};

const verifyProviderWebhook = (provider, payload, req) => {
  if (provider === 'midtrans') return verifyMidtransSignature(payload);
  if (provider === 'xendit') return verifyXenditSignature(req);
  return { verified: false, reason: 'manual_webhook_dry_run_only' };
};

const getPaymentRequestByReference = async (checkoutRef, providerInvoiceId) => {
  const encodedRef = encodeURIComponent(checkoutRef || '');
  const encodedInvoice = encodeURIComponent(providerInvoiceId || '');
  if (checkoutRef) {
    const byRef = await supabaseAdminRequest(`payment_requests?select=id,checkout_ref,status,payload&checkout_ref=eq.${encodedRef}&limit=1`);
    if (byRef.ok && Array.isArray(byRef.data) && byRef.data[0]) return byRef.data[0];
  }
  if (providerInvoiceId) {
    const byInvoice = await supabaseAdminRequest(`payment_requests?select=id,checkout_ref,status,payload&provider_invoice_id=eq.${encodedInvoice}&limit=1`);
    if (byInvoice.ok && Array.isArray(byInvoice.data) && byInvoice.data[0]) return byInvoice.data[0];
  }
  return null;
};

const updatePaymentRequestFromWebhook = async ({ checkoutRef, providerInvoiceId, providerStatus, wispaceStatus, payload, verified }) => {
  const paymentRequest = await getPaymentRequestByReference(checkoutRef, providerInvoiceId);
  if (!paymentRequest?.id) {
    return {
      ok: false,
      status: 404,
      error: 'payment_request_not_found'
    };
  }

  const nextStatus = wispaceStatus === 'paid'
    ? 'provider_paid_pending_activation'
    : wispaceStatus === 'refunded'
      ? 'refunded'
      : wispaceStatus === 'rejected'
        ? 'rejected'
        : paymentRequest.status || 'waiting_admin_confirmation';
  const nextPayload = {
    ...(paymentRequest.payload && typeof paymentRequest.payload === 'object' ? paymentRequest.payload : {}),
    providerWebhook: {
      providerStatus,
      wispaceStatus,
      verified,
      receivedAt: new Date().toISOString(),
      payload
    }
  };

  const encodedId = encodeURIComponent(paymentRequest.id);
  return supabaseAdminRequest(`payment_requests?id=eq.${encodedId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: nextStatus,
      provider_invoice_id: providerInvoiceId || null,
      provider_status: providerStatus || null,
      payload: nextPayload,
      rejected_at: nextStatus === 'rejected' ? new Date().toISOString() : null,
      rejection_reason: nextStatus === 'rejected' ? `Provider status: ${providerStatus || 'unknown'}` : null,
      updated_at: new Date().toISOString()
    })
  });
};

const recordWebhookEvent = async ({ provider, checkoutRef, providerInvoiceId, providerStatus, wispaceStatus, verified, payload }) => {
  const insertResult = await supabaseAdminRequest('payment_webhook_events', {
    method: 'POST',
    body: JSON.stringify([{
      provider,
      checkout_ref: checkoutRef || null,
      provider_invoice_id: providerInvoiceId || null,
      provider_status: providerStatus || null,
      wispace_status: wispaceStatus || null,
      verified,
      payload
    }])
  });
  return insertResult;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const provider = normalizeProvider(payload.provider || getEnv('PAYMENT_PROVIDER') || 'manual');
    const signature = verifyProviderWebhook(provider, payload, req);
    const providerStatus = extractProviderStatus(provider, payload);
    const wispaceStatus = mapProviderStatusToWispace(providerStatus);
    const checkoutRef = extractCheckoutReference(provider, payload);
    const providerInvoiceId = extractProviderInvoiceId(provider, payload);
    const supabaseAdmin = getSupabaseAdminConfig();

    if (!signature.verified) {
      return sendJson(res, 202, {
        ok: true,
        provider,
        providerStatus: providerStatus || 'unknown',
        wispaceStatus,
        checkoutRef: checkoutRef || '',
        providerInvoiceId: providerInvoiceId || '',
        verified: false,
        writeEnabled: false,
        verificationReason: signature.reason,
        message: 'Webhook diterima sebagai dry-run. DB tidak diupdate sebelum signature/callback token valid.'
      });
    }

    if (!supabaseAdmin.ready) {
      return sendJson(res, 202, {
        ok: true,
        provider,
        providerStatus: providerStatus || 'unknown',
        wispaceStatus,
        checkoutRef: checkoutRef || '',
        providerInvoiceId: providerInvoiceId || '',
        verified: true,
        serviceRoleReady: false,
        writeEnabled: false,
        message: 'Webhook verified, tapi SUPABASE_URL/VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum lengkap di Vercel server env.'
      });
    }

    const eventResult = await recordWebhookEvent({
      provider,
      checkoutRef,
      providerInvoiceId,
      providerStatus,
      wispaceStatus,
      verified: signature.verified,
      payload
    });
    const updateResult = await updatePaymentRequestFromWebhook({
      checkoutRef,
      providerInvoiceId,
      providerStatus,
      wispaceStatus,
      payload,
      verified: signature.verified
    });

    return sendJson(res, updateResult.ok ? 200 : 202, {
      ok: true,
      provider,
      providerStatus: providerStatus || 'unknown',
      wispaceStatus,
      checkoutRef: checkoutRef || '',
      providerInvoiceId: providerInvoiceId || '',
      verified: true,
      serviceRoleReady: true,
      writeEnabled: updateResult.ok,
      eventLogged: eventResult.ok,
      paymentRequestUpdated: updateResult.ok,
      paymentRequestStatus: wispaceStatus === 'paid' ? 'provider_paid_pending_activation' : wispaceStatus,
      message: updateResult.ok
        ? 'Webhook verified dan payment_requests sudah diupdate. Aktivasi library/order tetap lewat admin confirm sampai fulfillment webhook dikunci.'
        : `Webhook verified, tapi payment request belum terupdate: ${updateResult.error || 'unknown_error'}`
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json',
      message: error?.message || 'Webhook body tidak bisa dibaca.'
    });
  }
}
