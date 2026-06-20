import { getEnv, normalizeProvider, sendJson } from './_payment-utils.js';

const getMidtransEndpoint = (midtransEnv) => (
  midtransEnv === 'production'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const provider = normalizeProvider(getEnv('PAYMENT_PROVIDER') || getEnv('VITE_PAYMENT_PROVIDER') || 'manual');
  const midtransEnv = String(getEnv('MIDTRANS_ENV') || 'sandbox').toLowerCase();

  return sendJson(res, 200, {
    ok: true,
    provider,
    midtransEnv,
    snapEndpoint: getMidtransEndpoint(midtransEnv),
    midtransServerKey: {
      present: Boolean(String(getEnv('MIDTRANS_SERVER_KEY') || '').trim())
    },
    midtransClientKey: {
      present: Boolean(String(getEnv('VITE_MIDTRANS_CLIENT_KEY') || '').trim())
    },
    publicSiteUrlPresent: Boolean(getEnv('PUBLIC_SITE_URL')),
    supabaseServiceRolePresent: Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY')),
    hint: 'If checkout says access denied, verify Client Key and Server Key are copied from the same Midtrans dashboard mode/account selected by MIDTRANS_ENV.'
  });
}
