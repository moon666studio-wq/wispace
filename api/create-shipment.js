import { normalizeAmount, readJsonBody, sendJson } from './_payment-utils.js';
import { createManualShipmentFallback, getShippingProvider, hasShippingProviderKey, normalizeCourierCode } from './_shipping-utils.js';

const compact = (value = '') => String(value || '').trim();

const getAddressSummary = (address = {}) => [
  address.address,
  address.district,
  address.city,
  address.province,
  address.postalCode
].map(compact).filter(Boolean).join(', ');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const orderId = compact(payload.orderId || payload.checkoutRef);
    const courierCode = normalizeCourierCode(payload.courierCode || payload.courier);
    const courierService = compact(payload.courierService || payload.courier);
    const shippingCost = normalizeAmount(payload.shippingCost);
    const origin = payload.origin || {};
    const destination = payload.destination || {};
    const recipient = payload.recipient || {};
    const weightGram = normalizeAmount(payload.weightGram || payload.weight || 1000) || 1000;
    const provider = getShippingProvider();
    const fallbackShipment = createManualShipmentFallback({ orderId, courierCode, courierService, shippingCost });

    const errors = [];
    if (!orderId) errors.push('orderId wajib dikirim.');
    if (!courierCode) errors.push('courierCode wajib dikirim.');
    if (!compact(recipient.name)) errors.push('Nama penerima wajib dikirim.');
    if (!compact(recipient.phone)) errors.push('Nomor HP penerima wajib dikirim.');
    if (!getAddressSummary(origin)) errors.push('Alamat origin wajib dikirim.');
    if (!getAddressSummary(destination)) errors.push('Alamat tujuan wajib dikirim.');
    if (weightGram <= 0) errors.push('Berat barang wajib lebih dari 0 gram.');

    if (errors.length) {
      return sendJson(res, 400, {
        ok: false,
        error: 'invalid_shipment_payload',
        errors,
        shipment: fallbackShipment
      });
    }

    if (provider === 'manual' || !hasShippingProviderKey()) {
      return sendJson(res, 200, {
        ok: true,
        provider,
        mode: 'manual_fallback',
        shipment: fallbackShipment,
        message: 'Shipment API belum diset. Ongkir ditahan WiSpace dan resi/label masih manual.'
      });
    }

    return sendJson(res, 501, {
      ok: false,
      provider,
      mode: 'provider_not_implemented',
      shipment: fallbackShipment,
      message: 'Provider shipping sudah diset, tapi create shipment real belum diaktifkan. Fallback shipment tersedia untuk UI.'
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_shipment_request',
      message: error?.message || 'Payload shipment tidak bisa dibaca.'
    });
  }
}
