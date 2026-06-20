import { normalizeAmount, readJsonBody, sendJson } from './_payment-utils.js';
import {
  compact,
  createManualShipmentFallback,
  createProviderFailedShipment,
  getServerShipperOrigin,
  getShippingProvider,
  hasShippingProviderKey,
  normalizeBiteshipCourierCompany,
  normalizeBiteshipCourierType,
  normalizeCourierCode,
  requestShippingProviderJson
} from './_shipping-utils.js';

const getAddressSummary = (address = {}) => [
  address.address,
  address.district,
  address.city,
  address.province,
  address.postalCode
].map(compact).filter(Boolean).join(', ');

const getOriginWithServerFallback = (origin = {}) => {
  const serverOrigin = getServerShipperOrigin();
  return {
    ...serverOrigin,
    ...Object.fromEntries(Object.entries(origin || {}).filter(([, value]) => compact(value)))
  };
};

const getPhoneDigits = (value = '') => compact(value).replace(/[^\d+]/g, '');

const buildBiteshipOrderPayload = ({ payload, orderId, courierCode, courierService, origin, destination, recipient, weightGram }) => {
  const item = payload.item || {};
  const originAddress = getAddressSummary(origin);
  const destinationAddress = getAddressSummary(destination);
  const providerErrors = [];
  if (!compact(origin.contactName)) providerErrors.push('Nama kontak origin wajib diisi.');
  if (!getPhoneDigits(origin.contactPhone || origin.phone)) providerErrors.push('Nomor HP origin wajib diisi.');
  if (!originAddress) providerErrors.push('Alamat origin wajib diisi.');
  if (!compact(origin.postalCode)) providerErrors.push('Kode pos origin wajib diisi.');
  if (!compact(destination.postalCode)) providerErrors.push('Kode pos tujuan wajib diisi.');

  return {
    providerErrors,
    body: {
      shipper_contact_name: compact(origin.contactName) || 'Admin WiSpace',
      shipper_contact_phone: getPhoneDigits(origin.contactPhone || origin.phone),
      shipper_contact_email: compact(origin.contactEmail || origin.email),
      shipper_organization: compact(origin.organization || origin.bandName || 'WiSpace'),
      origin_contact_name: compact(origin.contactName) || 'Admin WiSpace',
      origin_contact_phone: getPhoneDigits(origin.contactPhone || origin.phone),
      origin_address: originAddress,
      origin_postal_code: compact(origin.postalCode),
      destination_contact_name: compact(recipient.name),
      destination_contact_phone: getPhoneDigits(recipient.phone),
      destination_address: destinationAddress,
      destination_postal_code: compact(destination.postalCode),
      courier_company: normalizeBiteshipCourierCompany(courierCode),
      courier_type: normalizeBiteshipCourierType(courierService),
      delivery_type: 'now',
      order_note: compact(payload.note || destination.note || `WiSpace order ${orderId}`),
      metadata: {
        wispace_order_id: orderId,
        wispace_merch_order_id: payload.merchOrderId || ''
      },
      items: [
        {
          name: compact(item.name) || 'WiSpace Merchandise',
          description: compact(item.sellerBandName) || 'WiSpace merch order',
          value: normalizeAmount(item.value || item.price || payload.productAmount || 100000) || 100000,
          quantity: normalizeAmount(item.quantity || 1) || 1,
          weight: weightGram
        }
      ]
    }
  };
};

const getBiteshipTrackingNumber = (data = {}) => compact(
  data.courier?.waybill_id ||
  data.courier?.tracking_id ||
  data.courier_waybill_id ||
  data.waybill_id ||
  data.tracking_number
);

const getBiteshipLabelUrl = (data = {}) => compact(
  data.courier?.link ||
  data.label_url ||
  data.waybill_url ||
  data.receipt_url
);

const createBiteshipShipment = async ({ payload, orderId, courierCode, courierService, shippingCost, origin, destination, recipient, weightGram }) => {
  const normalizedOrigin = getOriginWithServerFallback(origin);
  const { providerErrors, body } = buildBiteshipOrderPayload({
    payload,
    orderId,
    courierCode,
    courierService,
    origin: normalizedOrigin,
    destination,
    recipient,
    weightGram
  });
  if (providerErrors.length) {
    return {
      ok: false,
      status: 422,
      shipment: createProviderFailedShipment({ orderId, courierCode, courierService, shippingCost, message: providerErrors.join(' ') }),
      message: providerErrors.join(' ')
    };
  }

  const result = await requestShippingProviderJson({
    provider: 'biteship',
    path: '/v1/orders',
    method: 'POST',
    body
  });
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      shipment: createProviderFailedShipment({ orderId, courierCode, courierService, shippingCost, message: result.error }),
      message: result.error || 'Biteship belum berhasil membuat shipment.'
    };
  }

  const data = result.data || {};
  const trackingNumber = getBiteshipTrackingNumber(data);
  const labelUrl = getBiteshipLabelUrl(data);
  return {
    ok: true,
    status: result.status,
    shipment: {
      provider: 'biteship',
      shipmentId: compact(data.id || data.order_id || orderId),
      trackingNumber,
      labelUrl,
      courierCode: normalizeCourierCode(courierCode),
      courierService: courierService || normalizeCourierCode(courierCode),
      bookingStatus: trackingNumber || labelUrl ? 'shipment_booking_ready' : 'shipment_booking_created',
      paymentStatus: 'charged_to_wispace_provider_account',
      shippingCost: normalizeAmount(shippingCost),
      summary: trackingNumber
        ? 'Biteship berhasil membuat shipment. Resi sudah tersedia.'
        : 'Biteship membuat order shipment, label/resi belum tersedia di response awal.',
      source: 'biteship',
      rawStatus: data.status || data.order_status || ''
    },
    message: trackingNumber || labelUrl
      ? 'Shipment Biteship berhasil dibuat. Label/resi sudah masuk.'
      : 'Shipment Biteship dibuat, tapi label/resi belum tersedia di response awal.'
  };
};

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
    const originForValidation = getOriginWithServerFallback(origin);
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
    if (!getAddressSummary(originForValidation)) errors.push('Alamat origin wajib dikirim.');
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

    if (provider === 'biteship') {
      const shipmentResult = await createBiteshipShipment({
        payload,
        orderId,
        courierCode,
        courierService,
        shippingCost,
        origin,
        destination,
        recipient,
        weightGram
      });
      return sendJson(res, 200, {
        ok: shipmentResult.ok,
        provider,
        mode: shipmentResult.ok ? 'provider_live' : 'provider_fallback',
        shipment: shipmentResult.shipment,
        message: shipmentResult.message
      });
    }

    return sendJson(res, 200, {
      ok: false,
      provider,
      mode: 'provider_not_implemented',
      shipment: createProviderFailedShipment({ orderId, courierCode, courierService, shippingCost, message: 'Provider shipping belum punya adapter create shipment.' }),
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
