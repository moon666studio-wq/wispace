import { readJsonBody, sendJson } from './_payment-utils.js';
import { getShippingProvider, hasShippingProviderKey, normalizeCourierCode } from './_shipping-utils.js';

const compact = (value = '') => String(value || '').trim();

const manualTrackingStatus = ({ courier, trackingNumber }) => ({
  courier,
  trackingNumber,
  status: trackingNumber ? 'resi_dicatat' : 'menunggu_resi',
  statusLabel: trackingNumber ? 'Resi sudah dicatat' : 'Menunggu nomor resi',
  summary: trackingNumber
    ? 'Nomor resi sudah masuk. Tracking real-time akan aktif setelah API ekspedisi disambungkan.'
    : 'Nomor resi belum tersedia.',
  events: trackingNumber
    ? [
        {
          status: 'manual_input',
          label: 'Resi diinput manual',
          description: 'Band/admin sudah menyimpan nomor resi untuk order ini.',
          timestamp: new Date().toISOString()
        }
      ]
    : [],
  source: 'manual_fallback'
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const trackingNumber = compact(payload.trackingNumber || payload.resi || payload.awb);
    const courier = normalizeCourierCode(payload.courierCode || payload.courier || payload.expedition);
    const provider = getShippingProvider();

    if (!trackingNumber) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_tracking_number',
        message: 'trackingNumber wajib dikirim untuk cek resi.'
      });
    }

    if (!courier) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_courier',
        message: 'courierCode wajib dikirim untuk cek resi.'
      });
    }

    if (provider === 'manual' || !hasShippingProviderKey()) {
      return sendJson(res, 200, {
        ok: true,
        provider,
        mode: 'manual_fallback',
        tracking: manualTrackingStatus({ courier, trackingNumber }),
        message: 'Shipping tracking API belum diset. Menampilkan status resi manual WiSpace.'
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      mode: 'provider_not_implemented',
      tracking: manualTrackingStatus({ courier, trackingNumber }),
      message: 'Provider shipping sudah diset, tapi tracking API real belum diaktifkan. Fallback tracking tersedia untuk UI.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_tracking_payload',
      message: error?.message || 'Payload tracking tidak bisa dibaca.'
    });
  }
}
