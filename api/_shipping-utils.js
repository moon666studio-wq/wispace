import { getEnv, normalizeAmount } from './_payment-utils.js';

export const DEFAULT_COURIER_RATES = [
  { label: 'JNE REG', code: 'JNE', service: 'REG', estimate: '2-4 hari', cost: 18000 },
  { label: 'J&T EZ', code: 'JNT', service: 'EZ', estimate: '2-4 hari', cost: 17000 },
  { label: 'SiCepat REG', code: 'SICEPAT', service: 'REG', estimate: '2-4 hari', cost: 16000 }
];

export const normalizeCourierCode = (value = '') => String(value || '').trim().toUpperCase();

export const getShippingProvider = () => String(getEnv('SHIPPING_PROVIDER') || 'manual').trim().toLowerCase();

export const hasShippingProviderKey = () => Boolean(
  getEnv('RAJAONGKIR_API_KEY') ||
  getEnv('KOMERCE_API_KEY') ||
  getEnv('BINDERBYTE_API_KEY') ||
  getEnv('SHIPPING_API_KEY')
);

export const getFallbackRates = ({ weightGram = 1000 } = {}) => {
  const multiplier = Math.max(1, Math.ceil(normalizeAmount(weightGram || 1000) / 1000));
  return DEFAULT_COURIER_RATES.map((rate) => ({
    ...rate,
    cost: rate.cost * multiplier,
    weightGram: normalizeAmount(weightGram || 1000),
    source: 'manual_fallback'
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
