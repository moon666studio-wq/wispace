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

export const sendEmailNotification = async ({ to, subject, text, channel = 'email' }) => {
  const apiKey = compact(getEnv('RESEND_API_KEY'));
  const from = compact(getEnv('ORDER_NOTIFY_EMAIL_FROM') || 'WiSpace <onboarding@resend.dev>');
  const recipient = compact(to);
  if (!apiKey || !recipient) {
    return {
      channel,
      skipped: true,
      reason: `missing RESEND_API_KEY or ${channel}_recipient`
    };
  }

  const result = await postJson('https://api.resend.com/emails', {
    from,
    to: [recipient],
    subject,
    text
  }, {
    Authorization: `Bearer ${apiKey}`
  });
  return { channel, ...result };
};

export const sendAdminEmailNotification = async ({ subject, text }) => {
  const to = compact(getEnv('ORDER_NOTIFY_EMAIL_TO') || getEnv('ADMIN_NOTIFY_EMAIL'));
  return sendEmailNotification({ to, subject, text, channel: 'email_admin' });
};
