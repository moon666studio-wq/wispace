import { normalizeAmount, readJsonBody, sendJson } from './_payment-utils.js';
import { getFallbackRates, getShippingProvider, hasShippingProviderKey } from './_shipping-utils.js';

const compact = (value = '') => String(value || '').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const destinationCity = compact(payload.destinationCity || payload.destination?.city);
    const originCity = compact(payload.originCity || payload.origin?.city);
    const weightGram = normalizeAmount(payload.weightGram || payload.weight || 1000) || 1000;
    const provider = getShippingProvider();

    if (!destinationCity) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_destination_city',
        message: 'destinationCity wajib dikirim untuk cek ongkir.'
      });
    }

    const fallbackRates = getFallbackRates({ weightGram });
    if (provider === 'manual' || !hasShippingProviderKey()) {
      return sendJson(res, 200, {
        ok: true,
        provider,
        mode: 'manual_fallback',
        originCity,
        destinationCity,
        weightGram,
        rates: fallbackRates,
        message: 'Shipping API belum diset. Menggunakan estimasi ongkir manual WiSpace.'
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      mode: 'provider_not_implemented',
      originCity,
      destinationCity,
      weightGram,
      rates: fallbackRates,
      message: 'Provider shipping sudah diset, tapi integrasi API real belum diaktifkan. Fallback rates tersedia untuk UI.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_shipping_payload',
      message: error?.message || 'Payload ongkir tidak bisa dibaca.'
    });
  }
}
