import { getEnv, normalizeProvider, sendJson } from './_payment-utils.js';

const getMidtransKeyMode = (key = '') => {
  const trimmedKey = String(key || '').trim();
  if (!trimmedKey) return 'missing';
  if (trimmedKey.startsWith('SB-Mid-server-')) return 'sandbox';
  if (trimmedKey.startsWith('Mid-server-')) return 'production';
  return 'unknown_prefix';
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const provider = normalizeProvider(getEnv('PAYMENT_PROVIDER') || getEnv('VITE_PAYMENT_PROVIDER') || 'manual');
  const midtransEnv = String(getEnv('MIDTRANS_ENV') || 'sandbox').toLowerCase();
  const serverKeyMode = getMidtransKeyMode(getEnv('MIDTRANS_SERVER_KEY'));

  return sendJson(res, 200, {
    ok: true,
    provider,
    midtransEnv,
    midtransServerKey: {
      present: Boolean(getEnv('MIDTRANS_SERVER_KEY')),
      mode: serverKeyMode
    },
    publicSiteUrlPresent: Boolean(getEnv('PUBLIC_SITE_URL')),
    supabaseServiceRolePresent: Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY')),
    hint: serverKeyMode !== 'missing' && serverKeyMode !== 'unknown_prefix' && serverKeyMode !== midtransEnv
      ? `MIDTRANS_ENV=${midtransEnv} but MIDTRANS_SERVER_KEY looks like ${serverKeyMode}.`
      : 'If checkout still says access denied, use Client Key and Server Key from the same Midtrans dashboard mode and merchant account.'
  });
}
