import {
  getEnv,
  mapProviderStatusToWispace,
  normalizeProvider,
  readJsonBody,
  sendJson
} from './_payment-utils.js';

const extractProviderStatus = (provider, payload = {}) => {
  if (provider === 'midtrans') return payload.transaction_status || payload.fraud_status || payload.status;
  if (provider === 'xendit') return payload.status || payload.event;
  return payload.status || payload.providerStatus;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const provider = normalizeProvider(payload.provider || getEnv('PAYMENT_PROVIDER') || 'manual');
    const providerStatus = extractProviderStatus(provider, payload);
    const wispaceStatus = mapProviderStatusToWispace(providerStatus);
    const serviceRoleReady = Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY'));

    return sendJson(res, 202, {
      ok: true,
      provider,
      providerStatus: providerStatus || 'unknown',
      wispaceStatus,
      serviceRoleReady,
      writeEnabled: false,
      message: serviceRoleReady
        ? 'Webhook diterima. DB write belum diaktifkan sampai signature verification dan service role flow dikunci.'
        : 'Webhook diterima sebagai dry-run. Set SUPABASE_SERVICE_ROLE_KEY di Vercel server env sebelum update DB otomatis.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json',
      message: error?.message || 'Webhook body tidak bisa dibaca.'
    });
  }
}

