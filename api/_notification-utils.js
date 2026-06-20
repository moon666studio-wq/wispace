import { getEnv, normalizeAmount } from './_payment-utils.js';

export const compact = (value = '') => String(value || '').trim();

export const formatCurrency = (value) => `Rp ${normalizeAmount(value).toLocaleString('id-ID')}`;

export const postJson = async (url, payload, headers = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? '' : (data?.message || data?.error || text || 'request_failed')
  };
};

export const sendAdminEmailNotification = async ({ subject, text }) => {
  const apiKey = compact(getEnv('RESEND_API_KEY'));
  const to = compact(getEnv('ORDER_NOTIFY_EMAIL_TO') || getEnv('ADMIN_NOTIFY_EMAIL'));
  const from = compact(getEnv('ORDER_NOTIFY_EMAIL_FROM') || 'WiSpace <onboarding@resend.dev>');
  if (!apiKey || !to) {
    return {
      channel: 'email',
      skipped: true,
      reason: 'missing RESEND_API_KEY or ORDER_NOTIFY_EMAIL_TO'
    };
  }

  const result = await postJson('https://api.resend.com/emails', {
    from,
    to: [to],
    subject,
    text
  }, {
    Authorization: `Bearer ${apiKey}`
  });
  return { channel: 'email', ...result };
};
