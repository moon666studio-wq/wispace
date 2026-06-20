import { sendJson } from './_payment-utils.js';
import { compact, getServerShipperOrigin, getShippingBaseUrl, getShippingProvider, getShippingProviderKey, hasShippingProviderKey } from './_shipping-utils.js';

const maskValue = (value = '') => {
  const text = compact(value);
  if (!text) return '';
  if (text.length <= 8) return 'present';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const provider = getShippingProvider();
  const providerKey = getShippingProviderKey(provider);
  const origin = getServerShipperOrigin();
  const missingOriginFields = [
    ['WISPACE_SHIPPER_PHONE', origin.contactPhone],
    ['WISPACE_SHIPPER_ADDRESS', origin.address],
    ['WISPACE_SHIPPER_CITY', origin.city],
    ['WISPACE_SHIPPER_POSTAL_CODE', origin.postalCode]
  ].filter(([, value]) => !compact(value)).map(([key]) => key);

  return sendJson(res, 200, {
    ok: true,
    provider,
    baseUrl: getShippingBaseUrl(provider),
    providerKeyPresent: hasShippingProviderKey(),
    providerKeyPreview: maskValue(providerKey),
    originReady: missingOriginFields.length === 0,
    missingOriginFields,
    supportedLiveProvider: provider === 'biteship',
    hint: provider === 'biteship'
      ? 'Set SHIPPING_PROVIDER=biteship, BITESHIP_API_KEY, dan WISPACE_SHIPPER_* di Vercel Production.'
      : 'Mode manual aktif. Ganti SHIPPING_PROVIDER=biteship untuk live booking shipment.'
  });
}
