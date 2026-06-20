import { getEnv, normalizeAmount } from './_payment-utils.js';

export const DEFAULT_COURIER_RATES = [
  { label: 'JNE REG', code: 'JNE', service: 'REG', estimate: '2-4 hari', cost: 18000 },
  { label: 'J&T EZ', code: 'JNT', service: 'EZ', estimate: '2-4 hari', cost: 17000 },
  { label: 'SiCepat REG', code: 'SICEPAT', service: 'REG', estimate: '2-4 hari', cost: 16000 }
];

export const compact = (value = '') => String(value || '').trim();

export const normalizeCourierCode = (value = '') => String(value || '').trim().toUpperCase();

export const getShippingProvider = () => String(getEnv('SHIPPING_PROVIDER') || 'manual').trim().toLowerCase();

export const getShippingProviderKey = (provider = getShippingProvider()) => {
  if (provider === 'biteship') return getEnv('BITESHIP_API_KEY') || getEnv('SHIPPING_API_KEY');
  if (provider === 'rajaongkir') return getEnv('RAJAONGKIR_API_KEY') || getEnv('SHIPPING_API_KEY');
  if (provider === 'komerce') return getEnv('KOMERCE_API_KEY') || getEnv('SHIPPING_API_KEY');
  if (provider === 'binderbyte') return getEnv('BINDERBYTE_API_KEY') || getEnv('SHIPPING_API_KEY');
  return getEnv('SHIPPING_API_KEY');
};

export const getShippingBaseUrl = (provider = getShippingProvider()) => {
  if (provider === 'biteship') return String(getEnv('BITESHIP_BASE_URL') || 'https://api.biteship.com').replace(/\/$/, '');
  return String(getEnv('SHIPPING_API_BASE_URL') || '').replace(/\/$/, '');
};

export const hasShippingProviderKey = () => Boolean(
  getShippingProviderKey() ||
  getEnv('RAJAONGKIR_API_KEY') ||
  getEnv('KOMERCE_API_KEY') ||
  getEnv('BINDERBYTE_API_KEY') ||
  getEnv('SHIPPING_API_KEY')
);

export const requestShippingProviderJson = async ({ provider = getShippingProvider(), path, method = 'GET', body } = {}) => {
  const apiKey = getShippingProviderKey(provider);
  const baseUrl = getShippingBaseUrl(provider);
  if (!apiKey || !baseUrl || !path) {
    return { ok: false, status: 0, data: null, error: 'missing_shipping_provider_config' };
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
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
    error: response.ok ? '' : (data?.error || data?.message || data?.errors?.[0]?.message || text || 'shipping_provider_request_failed')
  };
};

export const normalizeBiteshipCourierCompany = (value = '') => {
  const normalized = compact(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['jnt', 'jandt', 'jet'].includes(normalized)) return 'jnt';
  if (['sicepat', 'sic'].includes(normalized)) return 'sicepat';
  if (normalized.includes('jne')) return 'jne';
  return normalized || 'jne';
};

export const normalizeBiteshipCourierType = (value = '') => {
  const normalized = compact(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('ez')) return 'ez';
  if (normalized.includes('reg')) return 'reg';
  return normalized || 'reg';
};

export const getServerShipperOrigin = () => ({
  contactName: getEnv('WISPACE_SHIPPER_NAME') || 'Admin WiSpace',
  contactPhone: getEnv('WISPACE_SHIPPER_PHONE') || '',
  contactEmail: getEnv('WISPACE_SHIPPER_EMAIL') || '',
  address: getEnv('WISPACE_SHIPPER_ADDRESS') || '',
  district: getEnv('WISPACE_SHIPPER_DISTRICT') || '',
  city: getEnv('WISPACE_SHIPPER_CITY') || '',
  province: getEnv('WISPACE_SHIPPER_PROVINCE') || '',
  postalCode: getEnv('WISPACE_SHIPPER_POSTAL_CODE') || ''
});

const getFallbackZoneMultiplier = (destination = {}) => {
  const text = [
    destination.city,
    destination.district,
    destination.province,
    destination.postalCode
  ].map(compact).join(' ').toLowerCase();
  if (!text) return 1;
  if (/(malang|surabaya|sidoarjo|gresik|kediri|blitar|jember|banyuwangi|pasuruan|probolinggo|madiun|jawa timur|jatim)/.test(text)) return 1.7;
  if (/(semarang|solo|surakarta|yogyakarta|jogja|sleman|bantul|magelang|purwokerto|tegal|pekalongan|jawa tengah|jateng|diy)/.test(text)) return 1.45;
  if (/(bandung|cimahi|garut|tasik|cirebon|sukabumi|sumedang|majalengka|kuningan|jawa barat|jabar)/.test(text)) return 1.2;
  if (/(jakarta|bogor|depok|tangerang|bekasi|jabodetabek)/.test(text)) return 1;
  if (/(bali|denpasar|badung|ntb|nusa tenggara|lombok)/.test(text)) return 2.1;
  if (/(sumatera|medan|palembang|padang|pekanbaru|lampung|aceh|jambi|bengkulu|batam)/.test(text)) return 2.3;
  if (/(kalimantan|banjarmasin|balikpapan|samarinda|pontianak|palangkaraya)/.test(text)) return 2.6;
  if (/(sulawesi|makassar|manado|palu|kendari|gorontalo)/.test(text)) return 2.8;
  if (/(papua|maluku|ambon|jayapura|sorong|ternate)/.test(text)) return 3.4;
  return 1.55;
};

export const getFallbackRates = ({ weightGram = 1000, destination = {} } = {}) => {
  const multiplier = Math.max(1, Math.ceil(normalizeAmount(weightGram || 1000) / 1000));
  const zoneMultiplier = getFallbackZoneMultiplier(destination);
  return DEFAULT_COURIER_RATES.map((rate) => ({
    ...rate,
    cost: Math.round((rate.cost * multiplier * zoneMultiplier) / 1000) * 1000,
    weightGram: normalizeAmount(weightGram || 1000),
    source: 'manual_fallback',
    estimate: zoneMultiplier > 1.6 ? '3-6 hari estimasi' : rate.estimate
  }));
};

export const createManualShipmentFallback = ({ orderId = '', courierCode = '', courierService = '', shippingCost = 0 } = {}) => ({
  provider: getShippingProvider(),
  shipmentId: orderId ? `MANUAL-${orderId}` : `MANUAL-${Date.now().toString(36).toUpperCase()}`,
  trackingNumber: '',
  labelUrl: '',
  courierCode: normalizeCourierCode(courierCode),
  courierService: courierService || normalizeCourierCode(courierCode),
  bookingStatus: 'manual_label_pending',
  paymentStatus: 'shipping_fee_held_by_wispace',
  shippingCost: normalizeAmount(shippingCost),
  summary: 'Ongkir sudah masuk pembayaran buyer dan ditahan di WiSpace. Resi otomatis aktif setelah provider ekspedisi disambungkan.',
  source: 'manual_fallback'
});

export const createProviderFailedShipment = ({ orderId = '', courierCode = '', courierService = '', shippingCost = 0, message = '' } = {}) => ({
  ...createManualShipmentFallback({ orderId, courierCode, courierService, shippingCost }),
  bookingStatus: 'shipment_booking_failed',
  summary: message || 'Provider shipment belum berhasil membuat resi/label. Order tetap bisa diproses manual.'
});
