import { normalizeAmount, readJsonBody, sendJson } from './_payment-utils.js';
import { compact, getFallbackRates, getServerShipperOrigin, getShippingProvider, hasShippingProviderKey, normalizeBiteshipCourierCompany, requestShippingProviderJson } from './_shipping-utils.js';

const BITESHIP_COURIERS = 'jne,jnt,sicepat';

const normalizeFallbackMessage = ({ provider = 'shipping', message = '', error = '' } = {}) => {
  const rawText = compact(message || error);
  const normalized = rawText.toLowerCase();

  if (normalized.includes('no sufficient balance') || normalized.includes('insufficient balance')) {
    return 'Ongkir live dari provider lagi tidak tersedia. WiSpace pakai estimasi sementara dulu.';
  }

  if (normalized.includes('area') && normalized.includes('not found')) {
    return 'Lokasi pengiriman belum kebaca penuh. Isi kecamatan, kota, dan kode pos lebih lengkap dulu ya.';
  }

  if (normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return 'Ongkir live belum bisa dibaca dari provider. WiSpace pakai estimasi sementara dulu.';
  }

  if (provider === 'biteship') {
    return 'Ongkir live dari Biteship belum bisa dibaca. WiSpace pakai estimasi sementara dulu.';
  }

  return rawText || 'Ongkir live belum bisa dibaca. WiSpace pakai estimasi sementara dulu.';
};

const getBiteshipAreaQuery = (address = {}) => [
  address.district,
  address.city,
  address.province,
  address.postalCode
].map(compact).filter(Boolean).join(' ');

const resolveBiteshipAreaId = async (address = {}) => {
  if (compact(address.areaId || address.area_id)) return compact(address.areaId || address.area_id);
  const query = getBiteshipAreaQuery(address);
  if (!query) return '';

  const result = await requestShippingProviderJson({
    provider: 'biteship',
    path: `/v1/maps/areas?countries=ID&input=${encodeURIComponent(query)}&type=single`
  });
  const areas = result.data?.areas || result.data?.data || [];
  const firstArea = Array.isArray(areas) ? areas[0] : areas;
  return compact(firstArea?.id || firstArea?.area_id || firstArea?.areaId);
};

const mapBiteshipPricingToRate = (pricing = {}, weightGram = 1000) => {
  const courierCode = normalizeBiteshipCourierCompany(pricing.courier_code || pricing.courier_company || pricing.company);
  const service = compact(pricing.courier_service_code || pricing.service_code || pricing.type || pricing.courier_type || pricing.courier_service_name).toUpperCase();
  const courierName = compact(pricing.courier_name || pricing.courier_code || courierCode).toUpperCase();
  const duration = compact(pricing.duration || pricing.shipment_duration || pricing.estimate || pricing.etd);
  const durationUnit = compact(pricing.duration_unit || pricing.shipment_duration_unit);
  return {
    label: `${courierName} ${service || 'REG'}`.trim(),
    code: courierCode.toUpperCase(),
    service: service || 'REG',
    estimate: duration ? `${duration}${durationUnit ? ` ${durationUnit}` : ''}` : 'Estimasi provider',
    cost: normalizeAmount(pricing.price || pricing.total_price || pricing.cost || pricing.rate),
    weightGram: normalizeAmount(weightGram || 1000),
    source: 'biteship',
    providerRateId: compact(pricing.id || pricing.rate_id || pricing.pricing_id)
  };
};

const fetchBiteshipRates = async ({ origin, destination, weightGram }) => {
  const originAreaId = await resolveBiteshipAreaId(origin);
  const destinationAreaId = await resolveBiteshipAreaId(destination);
  if (!originAreaId || !destinationAreaId) {
    return {
      ok: false,
      status: 422,
      rates: [],
      error: 'biteship_area_not_found',
      message: 'Area origin/tujuan belum kebaca provider. Isi kecamatan/kota/kode pos lebih lengkap.'
    };
  }

  const result = await requestShippingProviderJson({
    provider: 'biteship',
    path: '/v1/rates/couriers',
    method: 'POST',
    body: {
      origin_area_id: originAreaId,
      destination_area_id: destinationAreaId,
      couriers: BITESHIP_COURIERS,
      items: [
        {
          name: 'WiSpace Merchandise',
          description: 'Merchandise order from WiSpace',
          value: 100000,
          quantity: 1,
          weight: normalizeAmount(weightGram || 1000) || 1000
        }
      ]
    }
  });
  const pricing = result.data?.pricing || result.data?.data?.pricing || result.data?.rates || [];
  return {
    ok: result.ok,
    status: result.status,
    rates: Array.isArray(pricing)
      ? pricing.map((item) => mapBiteshipPricingToRate(item, weightGram)).filter((rate) => rate.cost > 0)
      : [],
    error: result.error,
    message: result.error || ''
  };
};

const withServerOriginFallback = (origin = {}) => {
  const serverOrigin = getServerShipperOrigin();
  return {
    ...serverOrigin,
    ...Object.fromEntries(Object.entries(origin || {}).filter(([, value]) => compact(value)))
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const payload = await readJsonBody(req);
    const destination = {
      ...(payload.destination || {}),
      district: compact(payload.destinationDistrict || payload.destination?.district),
      city: compact(payload.destinationCity || payload.destination?.city),
      province: compact(payload.destinationProvince || payload.destination?.province),
      postalCode: compact(payload.destinationPostalCode || payload.destination?.postalCode)
    };
    const rawOrigin = {
      ...(payload.origin || {}),
      district: compact(payload.originDistrict || payload.origin?.district),
      city: compact(payload.originCity || payload.origin?.city),
      province: compact(payload.originProvince || payload.origin?.province),
      postalCode: compact(payload.originPostalCode || payload.origin?.postalCode)
    };
    const origin = withServerOriginFallback(rawOrigin);
    const destinationCity = destination.city;
    const destinationDistrict = destination.district;
    const destinationProvince = destination.province;
    const originCity = origin.city;
    const originDistrict = origin.district;
    const originProvince = origin.province;
    const weightGram = normalizeAmount(payload.weightGram || payload.weight || 1000) || 1000;
    const provider = getShippingProvider();

    if (!destinationCity) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing_destination_city',
        message: 'destinationCity wajib dikirim untuk cek ongkir.'
      });
    }

    const fallbackRates = getFallbackRates({ weightGram, destination });
    if (provider === 'manual' || !hasShippingProviderKey()) {
      return sendJson(res, 200, {
        ok: true,
        provider,
        mode: 'manual_fallback',
        originCity,
        originDistrict,
        originProvince,
        destinationCity,
        destinationDistrict,
        destinationProvince,
        weightGram,
        rates: fallbackRates,
        message: 'Shipping API belum diset. Menggunakan estimasi ongkir manual WiSpace.'
      });
    }

    if (provider === 'biteship') {
      const biteshipResult = await fetchBiteshipRates({ origin, destination, weightGram });
      if (biteshipResult.ok && biteshipResult.rates.length) {
        return sendJson(res, 200, {
          ok: true,
          provider,
          mode: 'provider_live',
          originCity,
          originDistrict,
          originProvince,
          destinationCity,
          destinationDistrict,
          destinationProvince,
          weightGram,
          rates: biteshipResult.rates,
          message: 'Ongkir live dari Biteship berhasil dibaca.'
        });
      }

      return sendJson(res, 200, {
        ok: false,
        provider,
        mode: 'provider_fallback',
        originCity,
        originDistrict,
        originProvince,
        destinationCity,
        destinationDistrict,
        destinationProvince,
        weightGram,
        rates: fallbackRates,
        message: normalizeFallbackMessage({
          provider,
          message: biteshipResult.message,
          error: biteshipResult.error
        }),
        providerError: biteshipResult.error || '',
        providerMessage: biteshipResult.message || ''
      });
    }

    return sendJson(res, 200, {
      ok: false,
      provider,
      mode: 'provider_not_implemented',
      originCity,
      originDistrict,
      originProvince,
      destinationCity,
      destinationDistrict,
      destinationProvince,
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
