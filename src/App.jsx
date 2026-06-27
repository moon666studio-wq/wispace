import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured, supabaseOrigin } from './supabaseClient';
import { WISPACE_PICK_LABEL_OPTIONS, createEmptyWispacePick, getYoutubeThumbnail, getYoutubeVideoId, loadWispacePick, mapWispacePickFromRow, mapWispacePickToRow, saveWispacePick } from './wispacePickStorage';
// IMPOR IKON VEKTOR CYBER-LINE MINIMALIS (Poin 1)
import { Search, ShoppingBag, Radio, User, LogOut, FileText, DollarSign, ShieldCheck, Play, Pause, SkipBack, SkipForward, Bell } from 'lucide-react';

const fetchCloudData = async (user = null, options = {}) => {
  const { bootstrapOnly = false } = options;
  const baseRequests = [
    supabase.from('gigs').select('*').order('created_at', { ascending: false }),
    supabase.from('band_profiles').select('*').order('updated_at', { ascending: false }),
    supabase.from('releases').select('*, release_tracks(*)').order('created_at', { ascending: false }),
    supabase.from('band_articles').select('*').order('created_at', { ascending: false }),
    supabase.from('merch_items').select('*').order('created_at', { ascending: false }),
    supabase.from('wispace_picks').select('*').eq('id', 'homepage').maybeSingle()
  ];

  if (bootstrapOnly) {
    const [
      { data: gigsData },
      { data: bandProfilesData, error: bandProfilesError },
      { data: releasesData, error: releasesError },
      { data: articlesData, error: articlesError },
      { data: merchData, error: merchError },
      { data: wispacePickData, error: wispacePickError }
    ] = await Promise.all(baseRequests);

    return {
      gigsData: gigsData || loadPublicGigRegistry(),
      bandProfilesData: bandProfilesError ? loadPublicBandRegistry() : (bandProfilesData || []).map(mapBandProfileFromRow),
      releasesData: releasesError
        ? loadPublicReleaseRegistry()
        : (releasesData || []).filter((row) => row.is_active !== false).map(mapReleaseFromRow).filter((release) => release.trackCount > 0),
      articlesData: articlesError
        ? loadPublicArticleRegistry()
        : (articlesData || []).filter((row) => row.is_published !== false).map(mapArticleFromRow),
      merchData: merchError
        ? loadPublicMerchRegistry()
        : (merchData || []).filter((row) => row.is_active !== false).map(mapMerchFromRow),
      articleCommentsData: loadArticleComments(),
      saleTransactionsData: loadTransactionLedger(),
      audienceLibraryData: null,
      merchOrdersData: loadMerchOrders(),
      subscribedBandsData: [],
      notificationReadsData: [],
      updateNotificationsData: [],
      releaseAgreementsData: loadReleaseAgreementLedger(),
      messagesData: loadMessageLedger(),
      wispacePickData: wispacePickError ? loadWispacePick() : mapWispacePickFromRow(wispacePickData),
    };
  }

  const [
    { data: gigsData },
    { data: bandProfilesData, error: bandProfilesError },
    { data: releasesData, error: releasesError },
    { data: articlesData, error: articlesError },
    { data: merchData, error: merchError },
    { data: wispacePickData, error: wispacePickError },
    { data: commentsData, error: commentsError },
    { data: transactionsData, error: transactionsError },
    { data: audienceLibraryData, error: audienceLibraryError },
    { data: merchOrdersData, error: merchOrdersError },
    { data: subscriptionsData, error: subscriptionsError },
    { data: notificationReadsData, error: notificationReadsError },
    { data: updateNotificationsData, error: updateNotificationsError },
    { data: releaseAgreementsData, error: releaseAgreementsError },
    { data: messagesData, error: messagesError }
  ] = await Promise.all([
    ...baseRequests,
    supabase.from('article_comments').select('*').order('created_at', { ascending: false }),
    user?.id
      ? supabase.from('sales_transactions').select('*').order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    user?.id
      ? supabase.from('audience_library').select('*, releases(*, release_tracks(*)), release_tracks(*)').eq('audience_user_id', user.id).order('purchased_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    user?.id
      ? supabase.from('merch_orders').select('*, merch_items(name, band_name, band_slug, fulfillment_mode, consignment_status, admin_stock_on_hand, origin_shipping)').order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    user?.id
      ? supabase.from('band_subscriptions').select('*').eq('audience_user_id', user.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    user?.id
      ? supabase.from('audience_notification_reads').select('*').eq('audience_user_id', user.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    supabase.from('band_update_notifications').select('*').order('created_at', { ascending: false }).limit(100),
    user?.id
      ? supabase.from('release_agreements').select('*').order('signed_at', { ascending: false })
      : Promise.resolve({ data: null, error: null }),
    user?.id
      ? supabase.from('wispace_messages').select('*').order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: null, error: null })
  ]);

  return {
    gigsData: gigsData || loadPublicGigRegistry(),
    bandProfilesData: bandProfilesError ? loadPublicBandRegistry() : (bandProfilesData || []).map(mapBandProfileFromRow),
    releasesData: releasesError
      ? loadPublicReleaseRegistry()
      : (releasesData || []).filter((row) => row.is_active !== false).map(mapReleaseFromRow).filter((release) => release.trackCount > 0),
    articlesData: articlesError
      ? loadPublicArticleRegistry()
      : (articlesData || []).filter((row) => row.is_published !== false).map(mapArticleFromRow),
    merchData: merchError
      ? loadPublicMerchRegistry()
      : (merchData || []).filter((row) => row.is_active !== false).map(mapMerchFromRow),
    articleCommentsData: commentsError ? loadArticleComments() : mapArticleCommentsFromRows(commentsData || []),
    saleTransactionsData: !user?.id || transactionsError ? loadTransactionLedger() : (transactionsData || []).map(mapTransactionFromRow),
    audienceLibraryData: !user?.id || audienceLibraryError ? null : mapAudienceLibraryFromRows(audienceLibraryData || []),
    merchOrdersData: !user?.id || merchOrdersError ? loadMerchOrders() : (merchOrdersData || []).map(mapMerchOrderFromRow),
    subscribedBandsData: subscriptionsError ? [] : (subscriptionsData || []).map(mapBandSubscriptionFromRow),
    notificationReadsData: notificationReadsError ? [] : (notificationReadsData || []).map((row) => row.notification_id).filter(Boolean),
    updateNotificationsData: updateNotificationsError ? [] : (updateNotificationsData || []).map(mapBandUpdateNotificationFromRow),
    releaseAgreementsData: releaseAgreementsError ? loadReleaseAgreementLedger() : (releaseAgreementsData || []).map(mapReleaseAgreementFromRow),
    messagesData: !user?.id || messagesError ? loadMessageLedger() : (messagesData || []).map(mapMessageFromRow),
    wispacePickData: wispacePickError ? loadWispacePick() : mapWispacePickFromRow(wispacePickData),
  };
};

const createSlug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const encodeGigGenre = (genre, requestType, details = {}) => [
  genre || 'Indie',
  `request=${requestType}`,
  `date=${encodeURIComponent(details.date || '')}`,
  `htm=${encodeURIComponent(details.htm || '')}`,
  `cp=${encodeURIComponent(details.cp || '')}`
].join('::');
const getGigMeta = (gig, key, fallback = '') => {
  const meta = (gig?.genre || '').split('::').find((part) => part.startsWith(`${key}=`));
  if (!meta) return fallback;
  try {
    return decodeURIComponent(meta.slice(key.length + 1)) || fallback;
  } catch {
    return fallback;
  }
};
const getGigGenre = (gig) => (gig?.genre || 'Indie').split('::')[0] || 'Indie';
const getGigRequestType = (gig) => gig?.request_type || ((gig?.genre || '').includes('::request=exclusive') ? 'exclusive' : 'free');
const getGigHtm = (gig) => gig?.htm || getGigMeta(gig, 'htm', 'Info HTM menyusul');
const getGigCp = (gig) => gig?.cp || getGigMeta(gig, 'cp', 'CP menyusul');
const parseDisplayDate = (value) => {
  if (!value) return null;
  const rawValue = String(value);
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};
const formatDisplayDate = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  const parsedDate = parseDisplayDate(value);
  return parsedDate ? new Intl.DateTimeFormat('id-ID', options).format(parsedDate) : '';
};
const formatDateInputValue = (date = new Date()) => {
  const localDate = date instanceof Date ? date : parseDisplayDate(date) || new Date();
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const addDaysDateValue = (days = 10, baseDate = new Date()) => {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateInputValue(nextDate);
};
const getPublicRoutePath = (page, options = {}) => {
  if (page === 'explore') {
    const nextTab = options.exploreTab || 'rilisan';
    return `/explore?tab=${encodeURIComponent(nextTab)}`;
  }
  if (page === 'articles') return '/articles';
  if (page === 'merch_market') return '/merch';
  if (page === 'audience_profile') return '/me';
  if (page === 'audience_library') return '/library';
  if (page === 'audience_orders') return '/orders';
  if (page === 'message_center') return '/inbox';
  if (page === 'band_profile') {
    const nextTab = options.bandTab || 'profile';
    return `/studio?tab=${encodeURIComponent(nextTab)}`;
  }
  if (page === 'gig_manager') return '/studio/gigs';
  if (page === 'finance_dashboard') return '/studio/finance';
  return '/';
};
const ensureHeadElement = (selector, tagName, attributes = {}) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(tagName);
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    element.setAttribute(key, value);
  });
  return element;
};
const setHeadMeta = (selector, attributes = {}, content = '') => {
  const element = ensureHeadElement(selector, 'meta', attributes);
  element.setAttribute('content', content);
  return element;
};
const normalizeDateInputValue = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const parsedDate = parseDisplayDate(value);
  return parsedDate ? formatDateInputValue(parsedDate) : '';
};
const getGigDate = (gig) => {
  const rawDate = gig?.date || getGigMeta(gig, 'date', '');
  return formatDisplayDate(rawDate) || rawDate || 'Tanggal menyusul';
};
const getGigApprovedUntil = (gig) => gig?.approved_until ? formatDisplayDate(gig.approved_until) : '';
const getGigApprovedAt = (gig) => formatDisplayDate(gig?.approved_at || gig?.updated_at || gig?.created_at);
const isApprovedHomepageGig = (gig) => ['approved', 'approved_free', 'approved_exclusive'].includes(gig?.status);
const isGigExpired = (gig) => {
  const parsedDate = parseDisplayDate(gig?.approved_until);
  if (!parsedDate) return false;
  parsedDate.setHours(23, 59, 59, 999);
  return parsedDate < new Date();
};
const isVisibleApprovedHomepageGig = (gig) => isApprovedHomepageGig(gig) && !isGigExpired(gig);
const isGigEventPast = (gig) => {
  const parsedDate = parseDisplayDate(gig?.date || getGigMeta(gig, 'date', ''));
  if (!parsedDate) return false;
  parsedDate.setHours(23, 59, 59, 999);
  return parsedDate < new Date();
};
const extractPublicAssetPath = (publicUrl = '', bucket = PUBLIC_ASSET_BUCKET) => {
  if (!publicUrl || typeof publicUrl !== 'string') return '';
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return '';
  const rawPath = publicUrl.slice(markerIndex + marker.length).split('?')[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};
const getGigStatusLabel = (status = 'pending') => ({
  pending: 'PENDING REVIEW',
  approved: 'FREE LIVE',
  approved_free: 'FREE LIVE',
  approved_waiting_payment: 'APPROVED - BAYAR',
  paid_waiting_activation: 'PAID - WAIT ADMIN',
  approved_exclusive: 'EXCLUSIVE LIVE',
  rejected: 'REJECTED',
  removed: 'REMOVED'
}[status] || status.replaceAll('_', ' ').toUpperCase());
const getGigStatusColor = (status = 'pending') => ({
  approved: 'rgba(255,255,255,0.72)',
  approved_free: 'rgba(255,255,255,0.72)',
  approved_waiting_payment: 'rgba(255,255,255,0.72)',
  paid_waiting_activation: '#73BBC9',
  approved_exclusive: '#73BBC9',
  rejected: '#F1D4E5',
  removed: 'rgba(255,255,255,0.72)'
}[status] || 'rgba(255,255,255,0.72)');
const cleanupExpiredGigRecord = async (gig) => {
  const storagePath = gig?.image_path || extractPublicAssetPath(gig?.image);
  if (storagePath && isSupabaseConfigured) {
    const { error: removeAssetError } = await supabase.storage.from(PUBLIC_ASSET_BUCKET).remove([storagePath]);
    if (removeAssetError) {
      console.warn(`Gagal hapus asset pamflet ${gig?.id || ''}:`, removeAssetError.message);
    }
  }

  const richUpdatePayload = {
    status: 'removed',
    image: null,
    image_path: null,
    removed_at: new Date().toISOString(),
    removal_reason: 'event_date_passed'
  };
  const { error: richError } = await supabase.from('gigs').update(richUpdatePayload).eq('id', gig.id);
  if (!richError) return;
  if (!isMissingColumnError(richError)) {
    console.warn(`Gagal cleanup pamflet ${gig?.id || ''}:`, richError.message);
    return;
  }

  const { error: lightError } = await supabase
    .from('gigs')
    .update({ status: 'removed', image: null })
    .eq('id', gig.id);
  if (!lightError) return;
  if (!isMissingColumnError(lightError)) {
    console.warn(`Gagal cleanup ringan pamflet ${gig?.id || ''}:`, lightError.message);
    return;
  }

  const { error: fallbackError } = await supabase.from('gigs').update({ status: 'removed' }).eq('id', gig.id);
  if (fallbackError && !isMissingColumnError(fallbackError)) {
    console.warn(`Gagal fallback cleanup pamflet ${gig?.id || ''}:`, fallbackError.message);
  }
};
const normalizeFetchedGigs = async (rawGigs = []) => {
  const staleGigs = rawGigs.filter((gig) => gig?.status !== 'removed' && isGigEventPast(gig));
  if (!staleGigs.length) return rawGigs;

  await Promise.all(staleGigs.map((gig) => cleanupExpiredGigRecord(gig)));
  const staleGigIds = new Set(staleGigs.map((gig) => String(gig.id)));
  return rawGigs.filter((gig) => !staleGigIds.has(String(gig.id)));
};
const getMerchOrderStatusLabel = (status = 'order_paid_waiting_band') => ({
  order_paid_waiting_band: 'PAID - WAIT BAND',
  order_paid_waiting_admin: 'PAID - WAIT ADMIN',
  processing: 'DIPROSES BAND',
  processing_admin: 'DIPROSES WISPACE',
  packing: 'PACKING',
  ready_to_ship: 'SIAP KIRIM',
  shipped: 'DIKIRIM',
  completed: 'SELESAI',
  cancelled: 'DIBATALKAN',
  refund_requested: 'REFUND REVIEW',
  refunded: 'REFUNDED'
}[status] || status.replaceAll('_', ' ').toUpperCase());
const getMerchOrderStatusColor = (status = 'order_paid_waiting_band') => ({
  order_paid_waiting_band: 'rgba(255,255,255,0.72)',
  order_paid_waiting_admin: 'rgba(255,255,255,0.72)',
  processing: '#73BBC9',
  processing_admin: '#73BBC9',
  packing: '#73BBC9',
  ready_to_ship: '#73BBC9',
  shipped: 'rgba(255,255,255,0.72)',
  completed: 'rgba(255,255,255,0.72)',
  cancelled: '#F1D4E5',
  refund_requested: '#F1D4E5',
  refunded: '#F1D4E5'
}[status] || 'rgba(255,255,255,0.72)');
const getShipmentBookingLabel = (status = 'pending') => ({
  shipment_booking_pending: 'Menunggu booking',
  manual_label_pending: 'Label manual',
  shipment_booking_ready: 'Label siap',
  shipment_booking_failed: 'Booking gagal'
}[status] || String(status || 'pending').replaceAll('_', ' '));
const getMerchOrderStageSummary = (order = {}) => {
  if (order.trackingStatus === 'completed') {
    return { title: 'Selesai', note: 'Order sudah ditandai selesai.', color: 'rgba(255,255,255,0.72)' };
  }
  if (['cancelled', 'refunded'].includes(order.trackingStatus)) {
    return { title: order.trackingStatus === 'refunded' ? 'Refunded' : 'Dibatalkan', note: 'Order sudah final dan tidak diproses kirim.', color: '#F1D4E5' };
  }
  if (order.trackingStatus === 'shipped') {
    return { title: 'Paket dikirim', note: order.trackingNumber ? `Resi ${order.trackingNumber}` : 'Paket sudah masuk tahap kirim.', color: '#73BBC9' };
  }
  if (order.trackingNumber || order.shipmentLabelUrl || order.shipmentBookingStatus === 'shipment_booking_ready') {
    return { title: 'Label siap', note: 'Band/admin bisa cetak label dan lanjut kirim paket.', color: '#73BBC9' };
  }
  if (order.shipmentBookingStatus === 'manual_label_pending') {
    return { title: 'Label manual', note: 'Ongkir ditahan WiSpace. Resi masih perlu input manual sampai provider aktif.', color: 'rgba(255,255,255,0.72)' };
  }
  if (order.shipmentBookingStatus === 'shipment_booking_failed') {
    return { title: 'Booking gagal', note: 'Coba booking shipment ulang atau input resi manual.', color: '#F1D4E5' };
  }
  if (['processing', 'processing_admin', 'packing', 'ready_to_ship'].includes(order.trackingStatus)) {
    return { title: getMerchOrderStatusLabel(order.trackingStatus), note: 'Order sudah paid dan sedang diproses fulfillment.', color: '#73BBC9' };
  }
  return { title: 'Paid, tunggu label', note: 'Pembayaran masuk. Ongkir ditahan WiSpace sambil menunggu label/resi.', color: 'rgba(255,255,255,0.72)' };
};
const MERCH_ORDER_FLOW_STEPS = [
  { id: 'paid', label: 'PAID', statuses: ['order_paid_waiting_band', 'order_paid_waiting_admin', 'processing', 'processing_admin', 'packing', 'ready_to_ship', 'shipped', 'completed'] },
  { id: 'process', label: 'PROSES', statuses: ['processing', 'processing_admin', 'packing', 'ready_to_ship', 'shipped', 'completed'] },
  { id: 'pack', label: 'PACKING', statuses: ['packing', 'ready_to_ship', 'shipped', 'completed'] },
  { id: 'ship', label: 'KIRIM', statuses: ['ready_to_ship', 'shipped', 'completed'] },
  { id: 'done', label: 'SELESAI', statuses: ['completed'] }
];
const STOCK_RESTORE_ORDER_STATUSES = ['cancelled', 'refunded'];
const FINALIZED_ORDER_STATUSES = ['completed', 'cancelled', 'refunded'];
const getConsignmentStatusLabel = (status = 'waiting_stock_handover') => ({
  waiting_stock_handover: 'MENUNGGU STOK KE ADMIN',
  stock_received: 'STOK SUDAH DI ADMIN',
  stock_checked: 'STOK CEK ADMIN',
  stock_returned: 'STOK DIKEMBALIKAN'
}[status] || String(status || 'waiting_stock_handover').replaceAll('_', ' ').toUpperCase());
const getConsignmentStatusColor = (status = 'waiting_stock_handover') => ({
  waiting_stock_handover: 'rgba(255,255,255,0.72)',
  stock_received: 'rgba(255,255,255,0.72)',
  stock_checked: '#73BBC9',
  stock_returned: '#F1D4E5'
}[status] || 'rgba(255,255,255,0.72)');
const getMerchAvailableStock = (item = {}) => (
  item.fulfillmentMode === 'admin_consignment'
    ? item.consignmentStatus === 'stock_received'
      ? normalizePriceValue(item.adminStockOnHand || 0)
      : 0
    : normalizePriceValue(item.stock || 0)
);
const isMerchPurchasable = (item = {}) => getMerchAvailableStock(item) > 0;
const getShippingOriginMissingFields = (profile = {}) => ([
  ['CP / WhatsApp pengirim', profile.cp],
  ['Alamat asal pengiriman', profile.shipFromAddress],
  ['Kecamatan pengirim', profile.shipFromDistrict],
  ['Kota / kabupaten pengirim', profile.shipFromCity],
  ['Provinsi pengirim', profile.shipFromProvince],
  ['Kode pos pengirim', profile.shipFromPostalCode]
].filter(([, value]) => !String(value || '').trim()).map(([label]) => label));
const isShippingOriginReady = (profile = {}) => getShippingOriginMissingFields(profile).length === 0;
const getMerchShipmentLabelSummary = (order = {}) => {
  if (order.shipmentLabelUrl) {
    return { title: 'Label siap dicetak', note: 'Buka file label dari Biteship lalu print untuk ditempel di paket.', color: '#73BBC9' };
  }
  if (order.trackingNumber) {
    return { title: 'Resi tersedia', note: `Resi ${order.trackingNumber}. Label file belum tersedia, tapi nomor resi sudah bisa dipakai.`, color: '#73BBC9' };
  }
  if (order.shipmentBookingStatus === 'shipment_booking_failed') {
    return { title: 'Label gagal dibuat', note: 'Cek alamat asal/tujuan, nomor HP, kode pos, kurir aktif, lalu retry booking.', color: '#F1D4E5' };
  }
  if (order.shipmentBookingStatus === 'manual_label_pending') {
    return { title: 'Label manual', note: 'Provider belum membuat label otomatis. Input resi manual kalau paket sudah dikirim.', color: 'rgba(255,255,255,0.72)' };
  }
  return { title: 'Menunggu label', note: 'Setelah payment paid, sistem mencoba booking shipment ke ekspedisi.', color: 'rgba(255,255,255,0.72)' };
};
const getMerchTrackingLiveSummary = (order = {}) => {
  if (!order.trackingProviderLabel && !order.trackingProviderSummary && !order.trackingLastCheckedAt) return null;
  return {
    title: order.trackingProviderLabel || 'Tracking tersedia',
    note: order.trackingProviderSummary || 'Tracking live sudah kebaca dari provider.',
    status: order.trackingProviderStatus || '',
    checkedAt: order.trackingLastCheckedAt || '',
    source: order.trackingSource || ''
  };
};
const getReadinessColor = (status = 'todo') => ({
  ready: 'rgba(255,255,255,0.72)',
  scaffold: '#73BBC9',
  demo: 'rgba(255,255,255,0.72)',
  todo: '#F1D4E5'
}[status] || 'rgba(255,255,255,0.72)');
const getReadinessTint = (status = 'todo') => ({
  ready: 'rgba(241,212,229,0.08)',
  scaffold: 'rgba(115,187,201,0.10)',
  demo: 'rgba(241,212,229,0.06)',
  todo: 'rgba(241,212,229,0.10)'
}[status] || 'rgba(241,212,229,0.06)');
const getReadinessBorder = (status = 'todo') => ({
  ready: 'rgba(241,212,229,0.22)',
  scaffold: 'rgba(115,187,201,0.32)',
  demo: 'rgba(241,212,229,0.18)',
  todo: 'rgba(241,212,229,0.32)'
}[status] || 'rgba(241,212,229,0.18)');
const isMissingColumnError = (error) => {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('could not find') || message.includes('schema cache') || message.includes('does not exist');
};
const isDuplicateRowError = (error) => error?.code === '23505' || (error?.message || '').toLowerCase().includes('duplicate key');
const BAND_PROFILE_STORAGE_PREFIX = 'wispace_band_profile';
const BAND_AGREEMENT_STORAGE_PREFIX = 'wispace_band_agreement';
const BAND_ARTICLES_STORAGE_PREFIX = 'wispace_band_articles';
const BAND_MERCH_STORAGE_PREFIX = 'wispace_band_merch';
const BAND_SUBSCRIPTIONS_STORAGE_PREFIX = 'wispace_band_subscriptions';
const BAND_SUBSCRIBER_COUNT_PREFIX = 'wispace_band_subscriber_count';
const BAND_NOTIFICATIONS_STORAGE_PREFIX = 'wispace_band_notifications';
const BAND_UPDATE_FEED_STORAGE_PREFIX = 'wispace_band_update_feed';
const PUBLIC_BAND_REGISTRY_STORAGE_KEY = 'wispace_public_band_registry';
const PUBLIC_GIG_REGISTRY_STORAGE_KEY = 'wispace_public_gig_registry';
const PUBLIC_RELEASE_REGISTRY_STORAGE_KEY = 'wispace_public_release_registry';
const PUBLIC_ARTICLE_REGISTRY_STORAGE_KEY = 'wispace_public_article_registry';
const PUBLIC_MERCH_REGISTRY_STORAGE_KEY = 'wispace_public_merch_registry';
const PUBLIC_TRANSACTION_LEDGER_STORAGE_KEY = 'wispace_public_transaction_ledger';
const RELEASE_AGREEMENT_LEDGER_STORAGE_KEY = 'wispace_release_agreement_ledger';
const MONTHLY_FINANCE_REPORTS_STORAGE_KEY = 'wispace_monthly_finance_reports';
const PENDING_PAYMENTS_STORAGE_KEY = 'wispace_pending_payments';
const ARTICLE_COMMENTS_STORAGE_KEY = 'wispace_article_comments';
const CONTENT_REPORTS_STORAGE_KEY = 'wispace_content_reports';
const MERCH_ORDERS_STORAGE_KEY = 'wispace_merch_orders';
const MESSAGE_LEDGER_STORAGE_KEY = 'wispace_message_ledger';
const AUDIENCE_PROFILE_STORAGE_PREFIX = 'wispace_audience_profile';
const AUDIENCE_LIBRARY_STORAGE_PREFIX = 'wispace_audience_library';
const AUDIENCE_DOWNLOAD_LOG_STORAGE_PREFIX = 'wispace_audience_download_log';
const AUDIENCE_NOTIFICATION_READ_PREFIX = 'wispace_audience_notification_read';
const LOCAL_RESET_KEY_PREFIXES = [
  'wispace_'
];
const SQL_SETUP_PLAN = [
  {
    file: 'supabase-band-profile-upgrade.sql',
    title: 'Band profile + agreement',
    note: 'Wajib pertama supaya profile band, owner id, dan agreement musisi siap.'
  },
  {
    file: 'supabase-gigs-upgrade.sql',
    title: 'Gigs + pamflet',
    note: 'Untuk upload pamflet free/exclusive, status approve, tanggal tayang, dan pembayaran slot.'
  },
  {
    file: 'supabase-releases-upgrade.sql',
    title: 'Rilisan + library',
    note: 'Untuk album, track, audio URL, pembelian digital, dan library audience.'
  },
  {
    file: 'supabase-commerce-upgrade.sql',
    title: 'Commerce + merch + notif',
    note: 'Untuk merch order, transaksi 80/20, subscription, update notif, komentar, laporan, dan tracking.'
  }
];
const PAYMENT_FLOW_STEPS = [
  {
    title: 'Order created',
    status: 'pending_payment',
    note: 'Checkout bikin order id dan menunggu pembayaran.'
  },
  {
    title: 'Payment confirmed',
    status: 'waiting_admin_confirmation / paid',
    note: 'Buyer kirim request, admin confirm paid, lalu akses/order aktif. Gateway Midtrans/Xendit tahap berikutnya.'
  },
  {
    title: 'Access / fulfillment',
    status: 'library_active / order_paid_waiting_band',
    note: 'Digital masuk Library, merch masuk antrean proses band.'
  }
];
const PAYMENT_GATEWAY_PROVIDER = String(import.meta.env.VITE_PAYMENT_PROVIDER || 'manual').toLowerCase();
const PAYMENT_GATEWAY_API_ENDPOINT = import.meta.env.VITE_PAYMENT_API_ENDPOINT || '/api/create-payment';
const ORDER_NOTIFICATION_API_ENDPOINT = import.meta.env.VITE_ORDER_NOTIFICATION_API_ENDPOINT || '/api/notify-order';
const SHIPPING_RATES_API_ENDPOINT = import.meta.env.VITE_SHIPPING_RATES_API_ENDPOINT || '/api/shipping-rates';
const SHIPMENT_CREATE_API_ENDPOINT = import.meta.env.VITE_SHIPMENT_CREATE_API_ENDPOINT || '/api/create-shipment';
const SHIPMENT_TRACK_API_ENDPOINT = import.meta.env.VITE_SHIPMENT_TRACK_API_ENDPOINT || '/api/shipping-track';
const PAYMENT_GATEWAY_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '';
const PAYMENT_GATEWAY_WEBHOOK_PATH = '/api/payment-webhook';
const PAYMENT_GATEWAY_PROVIDER_OPTIONS = [
  {
    id: 'manual',
    title: 'Manual transfer',
    publicEnv: 'Tidak wajib',
    serverEnv: 'Tidak wajib',
    note: 'Mode aktif sekarang. Buyer upload proof, admin confirm paid.'
  },
  {
    id: 'midtrans',
    title: 'Midtrans Snap',
    publicEnv: 'VITE_PAYMENT_PROVIDER=midtrans + VITE_MIDTRANS_CLIENT_KEY',
    serverEnv: 'MIDTRANS_SERVER_KEY di Vercel/serverless',
    note: 'Butuh API create transaction dan webhook status settlement/expire/refund.'
  },
  {
    id: 'xendit',
    title: 'Xendit invoice',
    publicEnv: 'VITE_PAYMENT_PROVIDER=xendit + VITE_PAYMENT_API_ENDPOINT',
    serverEnv: 'XENDIT_SECRET_KEY di Vercel/serverless',
    note: 'Butuh API create invoice dan webhook paid/expired/refunded.'
  }
];
const WISPACE_MANUAL_PAYMENT_CHANNELS = [
  {
    title: 'Transfer Manual Admin',
    detail: 'Gunakan rekening/QRIS resmi WiSpace yang nanti ditampilkan admin.',
    note: 'Cantumkan Order ID di berita transfer.'
  },
  {
    title: 'Konfirmasi Bukti Bayar',
    detail: 'Kirim bukti pembayaran ke admin WiSpace atau channel support resmi.',
    note: 'Akses baru aktif setelah admin confirm paid.'
  }
];
const WISPACE_ADMIN_SHIPPING_ORIGIN = {
  address: 'Gudang/Admin WiSpace - silahkan hubungi admin untuk alamat kirim stok',
  district: '',
  city: 'Admin WiSpace',
  province: 'Indonesia',
  postalCode: '',
  contactName: 'Admin WiSpace',
  contactPhone: ''
};
const BAND_PHOTO_MAX_SIZE = 1 * 1024 * 1024;
const BAND_COVER_MAX_SIZE = 2 * 1024 * 1024;
const BAND_PREVIEW_MAX_CHARS = 3_250_000;
const PAYMENT_PROOF_MAX_SIZE = 2 * 1024 * 1024;
const SUPPORT_ATTACHMENT_MAX_SIZE = 4 * 1024 * 1024;
const FONT_STACK = "'Elms Sans', 'ElmsSans', 'Inter', 'Segoe UI', Arial, sans-serif";
const WISPACE_PLATFORM_RATE = 0.2;
const EXCLUSIVE_POSTER_SLOT_FEE = 30000;
const MINIMUM_PAYOUT_AMOUNT = 100000;
const RELEASE_AGREEMENT_VERSION = 'wispace-release-agreement-v1';
const WISPACE_LOGO_SRC = '/brand/logo-wispace-biru.svg';
const WISPACE_SITE_URL = 'https://wispace.my.id';
const WISPACE_DEFAULT_IMAGE = `${WISPACE_SITE_URL}/og-wispace.png`;
const PUBLIC_ASSET_BUCKET = 'band-assets';
const PUBLIC_PREVIEW_BUCKET = 'release-previews';
const PRIVATE_AUDIO_BUCKET = 'release-audio';
const AUTO_PREVIEW_SECONDS = 30;

const createClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const isUuidLike = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const normalizePriceValue = (value) => {
  const parsedValue = Number(String(value || '').replace(/[^\d]/g, ''));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};
const formatRupiahInput = (value) => {
  const amount = normalizePriceValue(value);
  return amount ? `Rp ${amount.toLocaleString('id-ID')}` : '';
};
const formatOptionalRupiahText = (value) => {
  const rawValue = String(value || '');
  return /\d/.test(rawValue) ? formatRupiahInput(rawValue) : rawValue;
};
const calculateRevenueSplit = (amount = 0) => {
  const grossAmount = normalizePriceValue(amount);
  const platformFee = Math.round(grossAmount * WISPACE_PLATFORM_RATE);
  const bandNet = Math.max(0, grossAmount - platformFee);
  return { grossAmount, platformFee, bandNet, revenueShare: '80/20' };
};

const MERCH_COURIER_OPTIONS = [
  { label: 'JNE REG', code: 'JNE', service: 'REG', estimate: '2-4 hari', cost: 18000 },
  { label: 'J&T EZ', code: 'JNT', service: 'EZ', estimate: '2-4 hari', cost: 17000 },
  { label: 'SiCepat REG', code: 'SICEPAT', service: 'REG', estimate: '2-4 hari', cost: 16000 }
];

const normalizeCourierOption = (option = {}) => ({
  label: option.label || `${option.code || 'KURIR'} ${option.service || ''}`.trim(),
  code: option.code || '',
  service: option.service || '',
  estimate: option.estimate || option.etd || '-',
  cost: normalizePriceValue(option.cost || option.price || 0),
  source: option.source || 'static'
});

const getCourierOption = (label = 'JNE REG', options = MERCH_COURIER_OPTIONS) => (
  options.find((option) => option.label === label) || MERCH_COURIER_OPTIONS.find((option) => option.label === label) || options[0] || MERCH_COURIER_OPTIONS[0]
);

const createEmptyAudienceProfile = () => ({
  displayName: '',
  city: '',
  favoriteGenre: '',
  contact: '',
  photoName: '',
  photoPreview: ''
});

const createEmptyCheckoutDraft = () => ({
  buyerName: '',
  buyerPhone: '',
  buyerEmail: '',
  recipientName: '',
  recipientPhone: '',
  address: '',
  district: '',
  city: '',
  province: '',
  postalCode: '',
  courier: 'JNE REG',
  shippingCost: getCourierOption('JNE REG').cost,
  shippingEstimate: getCourierOption('JNE REG').estimate,
  note: '',
  paymentProofName: '',
  paymentProofPreview: '',
  paymentProofUrl: '',
  paymentProofPath: '',
  paymentProofStatus: ''
});

const createCheckoutReference = (type = 'order') => `WSP-${String(type).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

const createEmptyBandProfile = () => ({
  name: '',
  slug: '',
  headline: '',
  city: '',
  genre: '',
  formedYear: '',
  cp: '',
  email: '',
  instagram: '',
  bio: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  shipFromAddress: '',
  shipFromDistrict: '',
  shipFromCity: '',
  shipFromProvince: '',
  shipFromPostalCode: '',
  coverName: '',
  coverPreview: '',
  photoName: '',
  photoPreview: '',
  isPublished: false
});

const readLocalJson = (key) => {
  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : null;
  } catch {
    return null;
  }
};

const getUserStorageKeys = (prefix, user) => {
  const keys = [];
  if (user?.id) keys.push(`${prefix}_${user.id}`);
  if (user?.email) keys.push(`${prefix}_${user.email}`);
  if (!keys.length) keys.push(`${prefix}_guest`);
  return [...new Set(keys)];
};

const loadUserScopedData = (prefix, user) => {
  if (typeof window === 'undefined') return null;
  for (const key of getUserStorageKeys(prefix, user)) {
    const value = readLocalJson(key);
    if (value) return value;
  }
  return null;
};

const loadPublicBandRegistry = () => {
  const registry = readLocalJson(PUBLIC_BAND_REGISTRY_STORAGE_KEY);
  return Array.isArray(registry) ? registry : [];
};

const savePublicBandRegistry = (profiles) => {
  window.localStorage.setItem(PUBLIC_BAND_REGISTRY_STORAGE_KEY, JSON.stringify(profiles));
};

const loadPublicGigRegistry = () => {
  const registry = readLocalJson(PUBLIC_GIG_REGISTRY_STORAGE_KEY);
  return Array.isArray(registry) ? registry : [];
};

const savePublicGigRegistry = (gigs) => {
  window.localStorage.setItem(PUBLIC_GIG_REGISTRY_STORAGE_KEY, JSON.stringify(gigs));
};

const loadPublicReleaseRegistry = () => {
  const registry = readLocalJson(PUBLIC_RELEASE_REGISTRY_STORAGE_KEY);
  return Array.isArray(registry) ? registry : [];
};

const savePublicReleaseRegistry = (releases) => {
  window.localStorage.setItem(PUBLIC_RELEASE_REGISTRY_STORAGE_KEY, JSON.stringify(releases));
};

const loadPublicArticleRegistry = () => {
  const registry = readLocalJson(PUBLIC_ARTICLE_REGISTRY_STORAGE_KEY);
  return Array.isArray(registry) ? registry : [];
};

const savePublicArticleRegistry = (articles) => {
  window.localStorage.setItem(PUBLIC_ARTICLE_REGISTRY_STORAGE_KEY, JSON.stringify(articles));
};

const loadPublicMerchRegistry = () => {
  const registry = readLocalJson(PUBLIC_MERCH_REGISTRY_STORAGE_KEY);
  return Array.isArray(registry) ? registry : [];
};

const savePublicMerchRegistry = (merch) => {
  window.localStorage.setItem(PUBLIC_MERCH_REGISTRY_STORAGE_KEY, JSON.stringify(merch));
};

const loadTransactionLedger = () => {
  const ledger = readLocalJson(PUBLIC_TRANSACTION_LEDGER_STORAGE_KEY);
  return Array.isArray(ledger) ? ledger : [];
};

const saveTransactionLedger = (transactions) => {
  window.localStorage.setItem(PUBLIC_TRANSACTION_LEDGER_STORAGE_KEY, JSON.stringify(transactions));
};

const loadReleaseAgreementLedger = () => {
  const agreements = readLocalJson(RELEASE_AGREEMENT_LEDGER_STORAGE_KEY);
  return Array.isArray(agreements) ? agreements : [];
};

const saveReleaseAgreementLedger = (agreements) => {
  window.localStorage.setItem(RELEASE_AGREEMENT_LEDGER_STORAGE_KEY, JSON.stringify(agreements));
};

const loadMonthlyFinanceReports = () => {
  const reports = readLocalJson(MONTHLY_FINANCE_REPORTS_STORAGE_KEY);
  return Array.isArray(reports) ? reports : [];
};

const saveMonthlyFinanceReports = (reports) => {
  window.localStorage.setItem(MONTHLY_FINANCE_REPORTS_STORAGE_KEY, JSON.stringify(reports));
};

const loadPendingPayments = () => {
  const payments = readLocalJson(PENDING_PAYMENTS_STORAGE_KEY);
  return Array.isArray(payments) ? payments : [];
};

const savePendingPayments = (payments) => {
  window.localStorage.setItem(PENDING_PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
};

const loadMerchOrders = () => {
  const orders = readLocalJson(MERCH_ORDERS_STORAGE_KEY);
  return Array.isArray(orders) ? orders : [];
};

const saveMerchOrders = (orders) => {
  window.localStorage.setItem(MERCH_ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

const DEFAULT_MESSAGE_LEDGER = [
  {
    id: 1,
    sender: 'Promotor Kolektif Timur',
    contact: '@kolektiftimur',
    subject: 'Undangan gig bulan depan',
    body: 'Halo, kami mau ngajak band kamu main di acara showcase independen bulan depan. Bisa diskusi jadwal?',
    scope: 'band',
    read: false,
    createdAt: 'Hari ini'
  }
];

const loadMessageLedger = () => {
  const ledger = readLocalJson(MESSAGE_LEDGER_STORAGE_KEY);
  return Array.isArray(ledger) ? ledger : DEFAULT_MESSAGE_LEDGER;
};

const saveMessageLedger = (messages) => {
  window.localStorage.setItem(MESSAGE_LEDGER_STORAGE_KEY, JSON.stringify(messages));
};

const loadArticleComments = () => {
  const comments = readLocalJson(ARTICLE_COMMENTS_STORAGE_KEY);
  return comments && typeof comments === 'object' && !Array.isArray(comments) ? comments : {};
};

const saveArticleComments = (comments) => {
  window.localStorage.setItem(ARTICLE_COMMENTS_STORAGE_KEY, JSON.stringify(comments));
};

const mapMessageFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  sender: row.sender_name || 'WiSpace',
  contact: row.sender_contact || '',
  subject: row.subject || 'Pesan WiSpace',
  body: row.body || '',
  category: row.category || 'lainnya',
  scope: row.scope || 'band',
  source: row.source || 'user',
  targetBandSlug: row.target_band_slug || '',
  targetBandName: row.target_band_name || '',
  read: Boolean(row.is_read),
  replied: Boolean(row.replied),
  lastReply: row.last_reply || '',
  parentMessageId: row.parent_message_id || '',
  attachmentName: row.attachment_name || '',
  attachmentUrl: row.attachment_url || '',
  attachmentPath: row.attachment_path || '',
  attachmentType: row.attachment_type || '',
  attachmentSize: Number(row.attachment_size || 0),
  attachmentStatus: row.attachment_status || '',
  createdAt: row.created_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at))
    : 'Baru saja',
  createdAtRaw: row.created_at || ''
});

const loadContentReports = () => {
  const reports = readLocalJson(CONTENT_REPORTS_STORAGE_KEY);
  return Array.isArray(reports) ? reports : [];
};

const saveContentReports = (reports) => {
  window.localStorage.setItem(CONTENT_REPORTS_STORAGE_KEY, JSON.stringify(reports));
};

const mapBandProfileFromRow = (row = {}) => ({
  ...createEmptyBandProfile(),
  name: row.name || '',
  slug: row.slug || createSlug(row.name || ''),
  headline: row.headline || '',
  city: row.city || '',
  genre: row.genre || '',
  formedYear: row.formed_year || '',
  cp: row.cp || '',
  email: row.email || '',
  instagram: row.instagram || '',
  bio: row.bio || '',
  bankName: row.bank_name || '',
  bankAccountName: row.bank_account_name || '',
  bankAccountNumber: row.bank_account_number || '',
  shipFromAddress: row.ship_from_address || '',
  shipFromDistrict: row.ship_from_district || '',
  shipFromCity: row.ship_from_city || '',
  shipFromProvince: row.ship_from_province || '',
  shipFromPostalCode: row.ship_from_postal_code || '',
  coverName: row.cover_name || '',
  coverPreview: row.cover_preview || '',
  photoName: row.photo_name || '',
  photoPreview: row.photo_preview || '',
  isPublished: Boolean(row.is_published),
  userId: row.user_id || '',
  updatedAt: row.updated_at || ''
});

const mapBandProfileToRow = (profile = {}, user) => ({
  user_id: user?.id,
  name: profile.name || '',
  slug: profile.slug || createSlug(profile.name || ''),
  headline: profile.headline || '',
  city: profile.city || '',
  genre: profile.genre || '',
  formed_year: profile.formedYear || '',
  cp: profile.cp || '',
  email: profile.email || '',
  instagram: profile.instagram || '',
  bio: profile.bio || '',
  bank_name: profile.bankName || '',
  bank_account_name: profile.bankAccountName || '',
  bank_account_number: profile.bankAccountNumber || '',
  ship_from_address: profile.shipFromAddress || '',
  ship_from_district: profile.shipFromDistrict || '',
  ship_from_city: profile.shipFromCity || '',
  ship_from_province: profile.shipFromProvince || '',
  ship_from_postal_code: profile.shipFromPostalCode || '',
  cover_name: profile.coverName || '',
  cover_preview: profile.coverPreview || '',
  photo_name: profile.photoName || '',
  photo_preview: profile.photoPreview || '',
  is_published: Boolean(profile.isPublished),
  updated_at: new Date().toISOString()
});

const mapReleaseFromRow = (row = {}) => {
  const tracks = Array.isArray(row.release_tracks) ? row.release_tracks : [];
  const activeTracks = tracks.filter((track) => track.is_active !== false);
  return {
    id: row.id || createClientId(),
    title: row.title || 'Rilisan WiSpace',
    price: row.price || '',
    description: row.description || '',
    coverPreview: row.cover_preview || '',
    coverName: row.cover_name || '',
    trackCount: activeTracks.length || (tracks.length ? 0 : row.track_count || 0),
    tracks: activeTracks
      .slice()
      .sort((firstTrack, secondTrack) => (firstTrack.track_order || 0) - (secondTrack.track_order || 0))
      .map((track) => ({
        id: track.id || createClientId(),
        title: track.title || track.file_name || 'Track WiSpace',
        fileName: track.file_name || '',
        size: track.file_size || 0,
        url: track.audio_url || '',
        audioPath: track.audio_path || '',
        previewUrl: track.preview_audio_url || '',
        previewPath: track.preview_audio_path || '',
        price: track.price || '',
        freeFull: Boolean(track.free_full)
      })),
    bandName: row.band_name || 'Band WiSpace',
    bandSlug: row.band_slug || createSlug(row.band_name || 'Band WiSpace'),
    city: row.city || 'Indonesia',
    genre: row.genre || 'Indie',
    signedBy: row.signed_by || row.band_name || 'Band WiSpace',
    releaseType: row.release_type || 'album',
    isActive: row.is_active !== false,
    bandUserId: row.band_user_id || '',
    updatedAt: row.updated_at || row.created_at || ''
  };
};

const mapMerchFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  bandName: row.band_name || 'Band WiSpace',
  bandSlug: row.band_slug || createSlug(row.band_name || 'Band WiSpace'),
  name: row.name || 'Merch WiSpace',
  description: row.description || '',
  price: row.price || '',
  stock: row.stock || 0,
  weightGram: Number(row.weight_gram || row.weightGram || 1000),
  imageName: row.image_name || '',
  imagePreview: row.image_preview || '',
  genre: row.genre || 'Indie',
  city: row.city || 'Indonesia',
  fulfillmentMode: row.fulfillment_mode || 'band_ship',
  fulfillmentLabel: row.fulfillment_mode === 'admin_consignment' ? 'STOK DI ADMIN WISPACE' : 'BAND KIRIM SENDIRI',
  consignmentStatus: row.consignment_status || '',
  adminStockOnHand: Number(row.admin_stock_on_hand || 0),
  originShipping: row.origin_shipping || null,
  destinationShipping: row.destination_shipping || null,
  isActive: row.is_active !== false,
  bandUserId: row.band_user_id || '',
  updatedAt: row.updated_at || row.created_at || ''
});

const mapArticleFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  bandName: row.band_name || 'Band WiSpace',
  bandSlug: row.band_slug || createSlug(row.band_name || 'Band WiSpace'),
  title: row.title || 'Artikel WiSpace',
  category: row.category || 'Update Band',
  excerpt: row.excerpt || '',
  body: row.body || '',
  genre: row.genre || 'Indie',
  city: row.city || 'Indonesia',
  createdAt: row.created_at
    ? new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '',
  updatedAt: row.updated_at || row.created_at || ''
});

const mapArticleCommentsFromRows = (rows = []) => rows.reduce((commentsByArticle, row = {}) => {
  if (!row.article_id) return commentsByArticle;
  const nextComment = {
    id: row.id || createClientId(),
    author: row.author_name || 'Audience WiSpace',
    body: row.body || '',
    createdAt: row.created_at
      ? new Date(row.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : ''
  };
  return {
    ...commentsByArticle,
    [row.article_id]: [...(commentsByArticle[row.article_id] || []), nextComment]
  };
}, {});

const mapTransactionFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  orderId: row.order_id || '',
  productType: row.product_type || 'order',
  productTitle: row.product_title || 'Transaksi WiSpace',
  sellerBandName: row.seller_band_name || 'WiSpace',
  sellerBandSlug: row.seller_band_slug || createSlug(row.seller_band_name || 'wispace'),
  sellerBandUserId: row.seller_band_user_id || '',
  buyerUserId: row.buyer_user_id || '',
  buyerName: row.buyer_name || 'Audience WiSpace',
  buyerEmail: row.buyer_email || '',
  grossAmount: Number(row.gross_amount || 0),
  platformFee: Number(row.platform_fee || 0),
  bandNet: Number(row.band_net || 0),
  revenueShare: row.revenue_share || '80/20',
  status: row.status || 'paid_settled',
  paymentStatus: row.status || 'paid',
  paymentMethod: row.payment_method || row.payment_provider || 'demo_checkout',
  fulfillmentStatus: row.fulfillment_status || '',
  payoutStatus: row.payout_status || 'available_next_cycle',
  gigId: row.gig_id || '',
  paidAt: row.paid_at || '',
  createdAt: row.created_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.created_at))
    : ''
});

const mapPaymentRequestFromRow = (row = {}) => {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id || payload.id || createClientId(),
    checkoutRef: row.checkout_ref || payload.checkoutRef || '',
    type: row.payment_type || payload.type || 'order',
    buyerUserId: row.buyer_user_id || payload.buyerUserId || '',
    buyerName: row.buyer_name || payload.buyerName || 'Audience WiSpace',
    buyerEmail: row.buyer_email || payload.buyerEmail || '',
    sellerBandUserId: row.seller_band_user_id || payload.sellerBandUserId || '',
    sellerBandSlug: row.seller_band_slug || payload.sellerBandSlug || '',
    sellerBandName: row.seller_band_name || payload.sellerBandName || 'Band WiSpace',
    productTitle: row.product_title || payload.productTitle || 'Checkout WiSpace',
    amount: Number(row.amount ?? payload.amount ?? 0),
    productAmount: Number(row.product_amount ?? payload.productAmount ?? payload.grossAmount ?? row.amount ?? payload.amount ?? 0),
    shippingCost: Number(row.shipping_cost ?? payload.shippingCost ?? payload.shipping?.shippingCost ?? 0),
    providerInvoiceId: row.provider_invoice_id || payload.providerInvoiceId || '',
    providerCheckoutUrl: row.provider_checkout_url || payload.providerCheckoutUrl || '',
    providerStatus: row.provider_status || payload.providerStatus || '',
    provider: payload.provider || PAYMENT_GATEWAY_PROVIDER || 'manual',
    paymentProofName: row.proof_file_name || payload.paymentProofName || '',
    paymentProofPreview: row.proof_url || payload.paymentProofPreview || '',
    paymentProofUrl: row.proof_url || payload.paymentProofUrl || payload.paymentProofPreview || '',
    paymentProofPath: row.proof_storage_path || payload.paymentProofPath || '',
    paymentProofStatus: row.proof_status || payload.paymentProofStatus || '',
    status: row.status || payload.status || 'waiting_admin_confirmation',
    paymentStatus: row.status || payload.paymentStatus || 'waiting_admin_confirmation',
    submittedAt: row.submitted_at || payload.submittedAt || row.created_at || '',
    confirmedAt: row.confirmed_at || payload.confirmedAt || '',
    confirmedBy: row.confirmed_by || payload.confirmedBy || '',
    rejectedAt: row.rejected_at || payload.rejectedAt || '',
    rejectedBy: row.rejected_by || payload.rejectedBy || '',
    rejectionReason: row.rejection_reason || payload.rejectionReason || '',
    createdAt: payload.createdAt || (row.created_at
      ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.created_at))
      : '')
  };
};

const mapPaymentWebhookEventFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  provider: row.provider || 'manual',
  checkoutRef: row.checkout_ref || '',
  providerInvoiceId: row.provider_invoice_id || '',
  providerStatus: row.provider_status || '',
  wispaceStatus: row.wispace_status || '',
  verified: Boolean(row.verified),
  payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
  receivedAt: row.received_at || row.created_at || '',
  receivedLabel: row.received_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.received_at))
    : ''
});

const mapReleaseAgreementFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  releaseId: row.release_id || '',
  releaseTitle: row.release_title || 'Rilisan WiSpace',
  bandUserId: row.band_user_id || '',
  bandName: row.band_name || 'Band WiSpace',
  bandSlug: row.band_slug || createSlug(row.band_name || 'band-wispace'),
  signerName: row.signer_name || row.signature_name || 'Penanggung Jawab',
  signerEmail: row.signer_email || '',
  agreementVersion: row.agreement_version || RELEASE_AGREEMENT_VERSION,
  agreementText: row.agreement_text || '',
  payoutBankName: row.payout_bank_name || '',
  payoutAccountName: row.payout_account_name || '',
  payoutAccountNumber: row.payout_account_number || '',
  signedAt: row.signed_at || row.created_at || new Date().toISOString(),
  createdAt: row.signed_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.signed_at))
    : ''
});

const mapAudienceLibraryFromRows = (rows = []) => rows
  .map((row = {}) => {
    const release = row.releases ? mapReleaseFromRow(row.releases) : null;
    if (!release) return null;

    const purchaseType = row.purchase_type || (row.track_id ? 'track' : 'album');
    const purchasedAt = row.purchased_at
      ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.purchased_at))
      : 'Baru saja';

    if (purchaseType === 'track') {
      const selectedTrack = release.tracks.find((track) => String(track.id) === String(row.track_id))
        || (row.release_tracks ? {
          id: row.release_tracks.id || row.track_id,
          title: row.release_tracks.title || row.release_tracks.file_name || 'Track WiSpace',
          fileName: row.release_tracks.file_name || '',
          size: row.release_tracks.file_size || 0,
          url: row.release_tracks.audio_url || '',
          audioPath: row.release_tracks.audio_path || '',
          previewUrl: row.release_tracks.preview_audio_url || '',
          previewPath: row.release_tracks.preview_audio_path || '',
          price: row.release_tracks.price || '',
          freeFull: Boolean(row.release_tracks.free_full)
        } : null);
      if (!selectedTrack) return null;

      return {
        ...release,
        id: `${release.id}-${selectedTrack.id}`,
        title: selectedTrack.title,
        price: selectedTrack.price,
        trackCount: 1,
        purchaseType: 'track',
        parentAlbumTitle: release.title,
        tracks: [selectedTrack],
        purchasedAt,
        paymentStatus: 'paid',
        accessType: row.access_type || 'encrypted_library'
      };
    }

    return {
      ...release,
      purchaseType: 'album',
      purchasedAt,
      paymentStatus: 'paid',
      accessType: row.access_type || 'encrypted_library'
    };
  })
  .filter(Boolean);

const mapMerchOrderFromRow = (row = {}) => ({
  id: row.id || createClientId(),
  transactionId: row.transaction_id || '',
  orderId: row.order_id || '',
  merchItemId: row.merch_item_id || '',
  buyerUserId: row.buyer_user_id || '',
  itemName: row.merch_items?.name || 'Merch WiSpace',
  sellerBandName: row.merch_items?.band_name || 'Band WiSpace',
  sellerBandSlug: row.merch_items?.band_slug || '',
  sellerBandUserId: row.seller_band_user_id || '',
  buyerName: row.shipping_recipient || 'Audience WiSpace',
  buyerEmail: row.buyer_email || '',
  recipientName: row.shipping_recipient || '',
  recipientPhone: row.shipping_phone || '',
  address: row.shipping_address || '',
  city: row.shipping_city || '',
  district: row.shipping_district || row.destination_shipping?.district || '',
  province: row.shipping_province || row.destination_shipping?.province || '',
  postalCode: row.shipping_postal_code || '',
  courier: row.courier_service || row.courier_code || 'Kurir belum dipilih',
  courierCode: row.courier_code || '',
  courierService: row.courier_service || '',
  shippingCost: Number(row.shipping_cost || 0),
  note: '',
  originShipping: row.origin_shipping || row.merch_items?.origin_shipping || null,
  destinationShipping: row.destination_shipping || null,
  weightGram: Number(row.weight_gram || row.payload?.weightGram || 1000),
  fulfillmentMode: row.fulfillment_mode || row.merch_items?.fulfillment_mode || 'band_ship',
  consignmentStatus: row.consignment_status || row.merch_items?.consignment_status || '',
  adminStockOnHand: Number(row.merch_items?.admin_stock_on_hand || 0),
  trackingNumber: row.tracking_number || '',
  trackingStatus: row.tracking_status || 'order_paid_waiting_band',
  shipmentProvider: row.shipment_provider || '',
  shipmentId: row.shipment_id || '',
  shipmentLabelUrl: row.shipment_label_url || '',
  shipmentBookingStatus: row.shipment_booking_status || '',
  shippingPaymentStatus: row.shipping_payment_status || '',
  trackingProviderStatus: '',
  trackingProviderLabel: '',
  trackingProviderSummary: '',
  trackingEvents: [],
  trackingLastCheckedAt: '',
  trackingSource: '',
  createdAt: row.created_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.created_at))
    : ''
});

const mapBandSubscriptionFromRow = (row = {}) => ({
  slug: row.band_slug || '',
  name: row.band_name || 'Band WiSpace',
  genre: row.genre || 'Indie',
  city: row.city || 'Indonesia',
  subscribedAt: row.created_at || new Date().toISOString()
});

const mapBandUpdateNotificationFromRow = (row = {}) => ({
  id: row.source_id || row.id || createClientId(),
  sourceId: row.source_id || row.id || '',
  targetId: String(row.source_id || '').replace(/^(release|merch|article|schedule)-/, ''),
  targetType: row.update_type || 'update',
  type: row.update_type || 'update',
  title: row.title || 'UPDATE BAND',
  body: row.body || '',
  bandName: row.band_name || 'Band WiSpace',
  bandSlug: row.band_slug || '',
  createdAt: row.created_at
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(row.created_at))
    : ''
});

const saveUserScopedData = (prefix, user, value) => {
  if (typeof window === 'undefined') return;
  try {
    const serializedValue = JSON.stringify(value);
    getUserStorageKeys(prefix, user).forEach((key) => {
      window.localStorage.setItem(key, serializedValue);
    });
  } catch (error) {
    console.warn('WiSpace local save skipped:', error);
  }
};

const getBandGlobalStorageKey = (prefix, slug) => `${prefix}_${slug || 'band-wispace'}`;

const loadBandGlobalData = (prefix, slug, fallbackValue) => {
  if (typeof window === 'undefined') return fallbackValue;
  const value = readLocalJson(getBandGlobalStorageKey(prefix, slug));
  return value ?? fallbackValue;
};

const saveBandGlobalData = (prefix, slug, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getBandGlobalStorageKey(prefix, slug), JSON.stringify(value));
  } catch (error) {
    console.warn('WiSpace band metric save skipped:', error);
  }
};

const cacheBandUpdateNotifications = (notifications = []) => {
  const groupedNotifications = notifications.reduce((groups, notification) => {
    if (!notification.bandSlug) return groups;
    return {
      ...groups,
      [notification.bandSlug]: [
        ...(groups[notification.bandSlug] || []),
        notification
      ]
    };
  }, {});

  Object.entries(groupedNotifications).forEach(([bandSlug, bandNotifications]) => {
    saveBandGlobalData(BAND_UPDATE_FEED_STORAGE_PREFIX, bandSlug, bandNotifications);
  });
};

const isImageTooLarge = (file, maxSize) => file.size > maxSize;

const formatFileSize = (size) => `${(size / (1024 * 1024)).toFixed(1)}MB`;

const clearFileInput = (event) => {
  event.target.value = '';
};

const createStorageSafeName = (name = 'asset') => (
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'asset'
);

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Gagal baca file.'));
  reader.readAsDataURL(file);
});

const loadImageDimensions = (src) => new Promise((resolve, reject) => {
  const previewImage = new Image();
  previewImage.onload = () => resolve({ width: previewImage.width, height: previewImage.height });
  previewImage.onerror = () => reject(new Error('Gagal baca ukuran gambar.'));
  previewImage.src = src;
});

const uploadPublicAsset = async (file, folder, user) => {
  const fallbackPreview = await readFileAsDataUrl(file);
  if (!isSupabaseConfigured || !user?.id) {
    return { publicUrl: fallbackPreview, fallbackPreview, stored: false, error: null, path: '' };
  }

  const safeName = createStorageSafeName(file.name || 'asset');
  const storagePath = `${user.id}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase
    .storage
    .from(PUBLIC_ASSET_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: true
    });

  if (error) {
    return { publicUrl: fallbackPreview, fallbackPreview, stored: false, error, path: storagePath };
  }

  const { data } = supabase.storage.from(PUBLIC_ASSET_BUCKET).getPublicUrl(storagePath);
  return {
    publicUrl: data?.publicUrl || fallbackPreview,
    fallbackPreview,
    stored: Boolean(data?.publicUrl),
    error: null,
    path: storagePath
  };
};

const isSupportedAudioFile = (file) => (
  file?.type === 'audio/mpeg' || /\.mp3$/i.test(file?.name || '')
);

const createPreviewFileName = (name = 'track.mp3') => {
  const baseName = name.replace(/\.[^.]+$/i, '').trim() || 'track';
  return `${createStorageSafeName(baseName)}-wispace-30s-preview.wav`;
};

const writeWavString = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const createThirtySecondWavBlob = (audioBuffer) => {
  const sampleRate = audioBuffer.sampleRate;
  const sampleCount = Math.max(1, Math.min(audioBuffer.length, Math.floor(sampleRate * AUTO_PREVIEW_SECONDS)));
  const channelCount = audioBuffer.numberOfChannels || 1;
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeWavString(view, 8, 'WAVE');
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeWavString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let outputOffset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let mixedSample = 0;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      mixedSample += audioBuffer.getChannelData(channelIndex)[sampleIndex] || 0;
    }
    const clampedSample = Math.max(-1, Math.min(1, mixedSample / channelCount));
    view.setInt16(outputOffset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true);
    outputOffset += bytesPerSample;
  }

  return new Blob([view], { type: 'audio/wav' });
};

const generateThirtySecondPreviewFile = async (file) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Browser ini belum mendukung auto preview audio.');
  }

  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const previewBlob = createThirtySecondWavBlob(audioBuffer);
    return new File([previewBlob], createPreviewFileName(file.name), { type: 'audio/wav' });
  } finally {
    if (audioContext.close) {
      await audioContext.close().catch(() => {});
    }
  }
};

const getTrackPreviewStatusLabel = (file = {}) => {
  if (file.previewStatus === 'auto_failed') return 'AUTO FAILED';
  if (file.previewUrl && file.previewStatus?.startsWith('auto_')) return 'AUTO PREVIEW';
  if (file.previewUrl) return 'PREVIEW READY';
  return 'NO PREVIEW';
};

const uploadPrivateAudio = async (file, folder, user) => {
  const localUrl = URL.createObjectURL(file);
  if (!isSupabaseConfigured || !user?.id) {
    return { url: localUrl, audioPath: '', stored: false, error: null };
  }

  const safeName = createStorageSafeName(file.name || 'track');
  const storagePath = `${user.id}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase
    .storage
    .from(PRIVATE_AUDIO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: true
    });

  if (error) {
    return { url: localUrl, audioPath: '', stored: false, error };
  }

  return { url: localUrl, audioPath: storagePath, stored: true, error: null };
};

const uploadPublicPreviewAudio = async (file, folder, user) => {
  const localUrl = URL.createObjectURL(file);
  if (!isSupabaseConfigured || !user?.id) {
    return { previewUrl: localUrl, previewPath: '', stored: false, error: null };
  }

  const safeName = createStorageSafeName(file.name || 'preview');
  const storagePath = `${user.id}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase
    .storage
    .from(PUBLIC_PREVIEW_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: true
    });

  if (error) {
    return { previewUrl: localUrl, previewPath: '', stored: false, error };
  }

  const { data } = supabase.storage.from(PUBLIC_PREVIEW_BUCKET).getPublicUrl(storagePath);
  return {
    previewUrl: data?.publicUrl || localUrl,
    previewPath: storagePath,
    stored: Boolean(data?.publicUrl),
    error: null
  };
};

const createSignedAudioUrl = async (audioPath) => {
  if (!isSupabaseConfigured || !audioPath) return '';
  const { data, error } = await supabase
    .storage
    .from(PRIVATE_AUDIO_BUCKET)
    .createSignedUrl(audioPath, 60 * 60);
  if (error) throw error;
  return data?.signedUrl || '';
};

const trimOversizedBandPreview = (profile) => ({
  ...profile,
  photoPreview: profile?.photoPreview?.length > BAND_PREVIEW_MAX_CHARS ? '' : profile?.photoPreview || '',
  coverPreview: profile?.coverPreview?.length > BAND_PREVIEW_MAX_CHARS ? '' : profile?.coverPreview || ''
});

export default function App() {
  // 1. STATE MANAGEMENT & SCROLL SENSOR
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTrack, setActiveTrack] = useState(null); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false); 
  const [authType, setAuthType] = useState(''); 
  const [hoveredCard] = useState(null);
  const [activeBanner, setActiveBanner] = useState(0); 
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [exploreTab, setExploreTab] = useState('rilisan');
  const [bandProfileTab, setBandProfileTab] = useState('profile');
  const [isViewingOwnBandProfile, setIsViewingOwnBandProfile] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [cloudAdminAccount, setCloudAdminAccount] = useState(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminFinanceFilter, setAdminFinanceFilter] = useState('all');
  const [adminFinanceMonth, setAdminFinanceMonth] = useState('all');
  const [adminShipmentFilter, setAdminShipmentFilter] = useState('active');
  const [adminActiveSection, setAdminActiveSection] = useState('payment');

  // STATE USER & ROLE MANAGEMENT
  const [userSession, setUserSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [hasSignedContract, setHasSignedContract] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [audienceProfile, setAudienceProfile] = useState(createEmptyAudienceProfile);
  
  // STATE INPUT AUTH & FORM
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // STATE FORM INPUT DATA SUNTIKAN
  const [newTitle, setNewTitle] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [trackBand, setTrackBand] = useState('');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackUrl, setTrackUrl] = useState('');

  // STATE BARU UNTUK POP-DRAWER DETAIL GIGS
  const [selectedGigDetail, setSelectedGigDetail] = useState(null);
  const [selectedPosterPreview, setSelectedPosterPreview] = useState(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null);
  const [selectedPaymentProofPreview, setSelectedPaymentProofPreview] = useState(null);
  const [selectedMerchDetail, setSelectedMerchDetail] = useState(null);
  const [selectedMerchOrderDetail, setSelectedMerchOrderDetail] = useState(null);
  const [shipmentBookingOrderId, setShipmentBookingOrderId] = useState('');
  const [shipmentTrackingOrderId, setShipmentTrackingOrderId] = useState('');
  const [midtransSnapLoading, setMidtransSnapLoading] = useState(false);
  const [selectedWispacePickDetail, setSelectedWispacePickDetail] = useState(null);
  const [wispacePickShouldAutoplay, setWispacePickShouldAutoplay] = useState(false);
  const midtransSnapLoaderRef = useRef(null);

  // UPDATE STATE FORM SUNTIK POSTER
  const [newDate, setNewDate] = useState('');
  const [newHtm, setNewHtm] = useState('');
  const [newCp, setNewCp] = useState('');
  const [newGigRequestType, setNewGigRequestType] = useState('free');
  const [newPosterImage, setNewPosterImage] = useState('');
  const [newPosterImagePath, setNewPosterImagePath] = useState('');
  const [newPosterName, setNewPosterName] = useState('');
  const [newPosterNotice, setNewPosterNotice] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState({
    title: '',
    venue: '',
    date: '',
    htm: '',
    cp: ''
  });
  const [bandScheduleItems, setBandScheduleItems] = useState([]);

  // STATE PAGE PROFILE BAND & UPLOAD ALBUM
  const [bandProfile, setBandProfile] = useState(createEmptyBandProfile);
  const [albumDraft, setAlbumDraft] = useState({
    title: '',
    price: '',
    description: '',
    coverName: '',
    coverPreview: '',
    audioFiles: [],
    freeTrackIndex: '',
    signature: '',
    accepted: false
  });
  const [albumItems, setAlbumItems] = useState(loadPublicReleaseRegistry);
  const [purchasedAlbums, setPurchasedAlbums] = useState([]);
  const [merchDraft, setMerchDraft] = useState({
    name: '',
    price: '',
    stock: '',
    weightGram: '500',
    fulfillmentMode: 'band_ship',
    description: '',
    imageName: '',
    imagePreview: ''
  });
  const [merchItems, setMerchItems] = useState([]);
  const [articleDraft, setArticleDraft] = useState({
    title: '',
    category: '',
    excerpt: '',
    body: ''
  });
  const [adminArticleDraft, setAdminArticleDraft] = useState({
    title: '',
    category: '',
    excerpt: '',
    body: ''
  });
  const [wispacePickDraft, setWispacePickDraft] = useState(loadWispacePick);
  const [adminMessageDraft, setAdminMessageDraft] = useState({
    targetBandSlug: 'all',
    category: 'payment',
    subject: '',
    body: ''
  });
  const [bandSupportDraft, setBandSupportDraft] = useState({
    category: 'payment',
    subject: '',
    body: '',
    attachmentName: '',
    attachmentUrl: '',
    attachmentPath: '',
    attachmentType: '',
    attachmentSize: 0,
    attachmentStatus: ''
  });
  const [articleItems, setArticleItems] = useState([]);
  const [articleComments, setArticleComments] = useState(loadArticleComments);
  const [articleCommentDrafts, setArticleCommentDrafts] = useState({});
  const [contentReports, setContentReports] = useState(loadContentReports);
  const [downloadLogs, setDownloadLogs] = useState([]);
  const [subscribedBands, setSubscribedBands] = useState([]);
  const [bandSubscriberCount, setBandSubscriberCount] = useState(0);
  const [bandNotifications, setBandNotifications] = useState([]);
  const [readSubscribedUpdateIds, setReadSubscribedUpdateIds] = useState([]);
  const [publicBandProfiles, setPublicBandProfiles] = useState(loadPublicBandRegistry);
  const [publicArticleItems, setPublicArticleItems] = useState(loadPublicArticleRegistry);
  const [publicMerchItems, setPublicMerchItems] = useState(loadPublicMerchRegistry);
  const [saleTransactions, setSaleTransactions] = useState(loadTransactionLedger);
  const [releaseAgreements, setReleaseAgreements] = useState(loadReleaseAgreementLedger);
  const [monthlyFinanceReports, setMonthlyFinanceReports] = useState(loadMonthlyFinanceReports);
  const [pendingPayments, setPendingPayments] = useState(loadPendingPayments);
  const [paymentWebhookEvents, setPaymentWebhookEvents] = useState([]);
  const [merchOrders, setMerchOrders] = useState(loadMerchOrders);
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [checkoutDraft, setCheckoutDraft] = useState(createEmptyCheckoutDraft);
  const [checkoutCourierOptions, setCheckoutCourierOptions] = useState(MERCH_COURIER_OPTIONS);
  const [checkoutShippingStatus, setCheckoutShippingStatus] = useState({ loading: false, message: '', mode: 'static' });
  const [showNotificationPopout, setShowNotificationPopout] = useState(false);
  const [showBandAdminPopout, setShowBandAdminPopout] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState(null);
  const [selectedReleaseDetail, setSelectedReleaseDetail] = useState(null);
  const [selectedMerchId, setSelectedMerchId] = useState(null);
  const [selectedLibraryTrackId, setSelectedLibraryTrackId] = useState(null);
  const [viewedBandSlug, setViewedBandSlug] = useState('');
  const [messageDraft, setMessageDraft] = useState({
    sender: '',
    contact: '',
    subject: '',
    body: ''
  });
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState(null);
  const [playerQueue, setPlayerQueue] = useState([]);
  const [playerQueueIndex, setPlayerQueueIndex] = useState(0);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [messages, setMessages] = useState(loadMessageLedger);

  // DATA REAL DARI CLOUD
  const [gigs, setGigs] = useState(loadPublicGigRegistry);
  const [gigExpiryDrafts, setGigExpiryDrafts] = useState({});
  const [loading, setLoading] = useState(() => {
    const hasPublicCache = loadPublicGigRegistry().length
      || loadPublicReleaseRegistry().length
      || loadPublicBandRegistry().length
      || loadPublicArticleRegistry().length
      || loadPublicMerchRegistry().length;
    return !hasPublicCache;
  });

  const audioRef = useRef(new Audio());
  const timerRef = useRef(null);
  const audioPreviewTimerRef = useRef(null);
  const restoredUserKeyRef = useRef('');

  const getStoredRole = useCallback((user) => {
    const roleById = user?.id ? window.localStorage.getItem(`wispace_role_${user.id}`) : null;
    const roleByEmail = user?.email ? window.localStorage.getItem(`wispace_role_${user.email}`) : null;
    return roleById || roleByEmail || null;
  }, []);
  const resolveUserRole = useCallback((user) => (
    user?.user_metadata?.role === 'musisi' ? 'musisi' : getStoredRole(user) || user?.user_metadata?.role || null
  ), [getStoredRole]);
  const persistUserRole = useCallback((role, user) => {
    if (user?.id) window.localStorage.setItem(`wispace_role_${user.id}`, role);
    if (user?.email) window.localStorage.setItem(`wispace_role_${user.email}`, role);
  }, []);
  const persistBandProfileLocal = useCallback((profile, user = userSession) => {
    saveUserScopedData(BAND_PROFILE_STORAGE_PREFIX, user, profile);
  }, [userSession]);
  const persistBandAgreementLocal = useCallback((agreement, user = userSession) => {
    saveUserScopedData(BAND_AGREEMENT_STORAGE_PREFIX, user, agreement);
  }, [userSession]);
  const persistBandArticlesLocal = useCallback((articles, user = userSession) => {
    saveUserScopedData(BAND_ARTICLES_STORAGE_PREFIX, user, articles);
  }, [userSession]);
  const persistBandMerchLocal = useCallback((merch, user = userSession) => {
    saveUserScopedData(BAND_MERCH_STORAGE_PREFIX, user, merch);
  }, [userSession]);
  const persistBandSubscriptionsLocal = useCallback((subscriptions, user = userSession) => {
    saveUserScopedData(BAND_SUBSCRIPTIONS_STORAGE_PREFIX, user, subscriptions);
  }, [userSession]);
  const persistAudienceProfileLocal = useCallback((profile, user = userSession) => {
    saveUserScopedData(AUDIENCE_PROFILE_STORAGE_PREFIX, user, profile);
  }, [userSession]);
  const persistAudienceLibraryLocal = useCallback((library, user = userSession) => {
    saveUserScopedData(AUDIENCE_LIBRARY_STORAGE_PREFIX, user, library);
  }, [userSession]);
  const persistAudienceDownloadLogLocal = useCallback((logs, user = userSession) => {
    saveUserScopedData(AUDIENCE_DOWNLOAD_LOG_STORAGE_PREFIX, user, logs);
  }, [userSession]);
  const persistSubscribedUpdateReadsLocal = useCallback((reads, user = userSession) => {
    saveUserScopedData(AUDIENCE_NOTIFICATION_READ_PREFIX, user, reads);
  }, [userSession]);

  const verifyCloudAdminAccount = useCallback(async (user = null) => {
    if (!isSupabaseConfigured || !user?.id) {
      setCloudAdminAccount(null);
      return false;
    }

    setAdminAuthLoading(true);
    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id,email,role')
      .eq('user_id', user.id)
      .limit(1);
    setAdminAuthLoading(false);

    if (error) {
      setCloudAdminAccount(null);
      if (!isMissingColumnError(error)) console.warn('Gagal cek admin_users:', error.message);
      return false;
    }

    const adminRow = Array.isArray(data) ? data[0] : data;
    if (!adminRow) {
      setCloudAdminAccount(null);
      return false;
    }

    setCloudAdminAccount(adminRow);
    setIsAdminUnlocked(true);
    setAdminError('');
    return true;
  }, []);

  const fetchAdminPaymentRequests = useCallback(async (user = null) => {
    if (!isSupabaseConfigured || !user?.id) return;
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (error) {
      if (!isMissingColumnError(error)) console.warn('Admin payment sync butuh akun di admin_users:', error.message);
      return;
    }
    const mappedPayments = (data || []).map(mapPaymentRequestFromRow);
    setPendingPayments(mappedPayments);
    savePendingPayments(mappedPayments);

    const { data: webhookData, error: webhookError } = await supabase
      .from('payment_webhook_events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(30);
    if (webhookError) {
      if (!isMissingColumnError(webhookError)) console.warn('Payment webhook events belum bisa disync:', webhookError.message);
      return;
    }
    setPaymentWebhookEvents((webhookData || []).map(mapPaymentWebhookEventFromRow));
  }, []);

  const publishBandUpdateNotification = useCallback((bandSlug, update) => {
    if (!bandSlug) return;
    const nextUpdate = {
      id: update.id || createClientId(),
      type: update.type || 'update',
      title: update.title || 'Update baru',
      body: update.body || '',
      bandName: update.bandName || bandProfile.name || signatureName || 'Band WiSpace',
      bandSlug,
      sourceId: update.sourceId || update.id || '',
      targetId: update.targetId || String(update.id || '').replace(/^(release|merch|article|schedule)-/, ''),
      targetType: update.targetType || update.type || 'update',
      createdAt: update.createdAt || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    const currentFeed = loadBandGlobalData(BAND_UPDATE_FEED_STORAGE_PREFIX, bandSlug, []);
    const nextFeed = [
      nextUpdate,
      ...currentFeed.filter((item) => String(item.id) !== String(nextUpdate.id))
    ].slice(0, 20);
    saveBandGlobalData(BAND_UPDATE_FEED_STORAGE_PREFIX, bandSlug, nextFeed);
    if (isSupabaseConfigured && userSession?.id) {
      void supabase
        .from('band_update_notifications')
        .upsert({
          band_slug: bandSlug,
          band_name: nextUpdate.bandName,
          update_type: nextUpdate.type,
          title: nextUpdate.title,
          body: nextUpdate.body,
          source_id: nextUpdate.id
        }, { onConflict: 'band_slug,source_id' })
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) console.warn('Gagal sync update subscriber:', error.message);
        });
    }
  }, [bandProfile.name, signatureName, userSession]);
  const publishPublicBandProfile = useCallback((profile) => {
    const profileSlug = profile.slug || createSlug(profile.name || signatureName || 'band-wispace');
    const publicProfile = {
      ...createEmptyBandProfile(),
      ...trimOversizedBandPreview(profile),
      slug: profileSlug,
      isPublished: true,
      updatedAt: new Date().toISOString()
    };

    setPublicBandProfiles((current) => {
      const nextProfiles = [
        publicProfile,
        ...current.filter((item) => item.slug !== profileSlug)
      ];
      savePublicBandRegistry(nextProfiles);
      return nextProfiles;
    });

    if (userSession?.id && publicProfile.name) {
      const bandProfileRow = mapBandProfileToRow(publicProfile, userSession);
      void supabase
        .from('band_profiles')
        .upsert(bandProfileRow, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error && isMissingColumnError(error)) {
            const legacyProfileRow = { ...bandProfileRow };
            delete legacyProfileRow.bank_name;
            delete legacyProfileRow.bank_account_name;
            delete legacyProfileRow.bank_account_number;
            delete legacyProfileRow.ship_from_address;
            delete legacyProfileRow.ship_from_district;
            delete legacyProfileRow.ship_from_city;
            delete legacyProfileRow.ship_from_province;
            delete legacyProfileRow.ship_from_postal_code;
            void supabase
              .from('band_profiles')
              .upsert(legacyProfileRow, { onConflict: 'user_id' })
              .then(({ error: legacyError }) => {
                if (legacyError && !isMissingColumnError(legacyError)) {
                  console.warn('Gagal sync band profile legacy ke Supabase:', legacyError.message);
                }
              });
            return;
          }
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync band profile ke Supabase:', error.message);
          }
        });
    }

    return publicProfile;
  }, [signatureName, userSession]);

  const publishPublicRelease = useCallback((release) => {
    const releaseId = release.id || createClientId();
    const publicRelease = {
      ...release,
      id: releaseId,
      bandSlug: release.bandSlug || bandProfile.slug || createSlug(release.bandName || bandProfile.name || signatureName || 'band-wispace'),
      bandUserId: release.bandUserId || userSession?.id || '',
      isPublished: true,
      updatedAt: new Date().toISOString()
    };
    publishBandUpdateNotification(publicRelease.bandSlug, {
      id: `release-${releaseId}`,
      type: 'release',
      title: 'RILISAN BARU',
      body: `${publicRelease.bandName || bandProfile.name || 'Band WiSpace'} upload ${publicRelease.title}.`,
      bandName: publicRelease.bandName || bandProfile.name || 'Band WiSpace',
      targetId: releaseId,
      targetType: 'release'
    });

    const localReleases = [
      publicRelease,
      ...loadPublicReleaseRegistry().filter((item) => String(item.id) !== String(releaseId))
    ];
    savePublicReleaseRegistry(localReleases);

    if (isSupabaseConfigured && userSession?.id && publicRelease.title) {
      const releaseRow = {
        id: releaseId,
        band_user_id: userSession.id,
        band_name: publicRelease.bandName || bandProfile.name || signatureName || 'Band WiSpace',
        band_slug: bandProfile.slug || createSlug(publicRelease.bandName || bandProfile.name || 'band-wispace'),
        title: publicRelease.title || 'Rilisan WiSpace',
        description: publicRelease.description || '',
        price: normalizePriceValue(publicRelease.price),
        release_type: publicRelease.releaseType || (publicRelease.trackCount === 1 ? 'single' : 'album'),
        genre: publicRelease.genre || bandProfile.genre || 'Indie',
        city: publicRelease.city || bandProfile.city || 'Indonesia',
        cover_name: publicRelease.coverName || '',
        cover_preview: publicRelease.coverPreview || '',
        signed_by: publicRelease.signedBy || signatureName || publicRelease.bandName || 'Band WiSpace',
        is_published: true,
        updated_at: new Date().toISOString()
      };

      const trackRows = (publicRelease.tracks || []).map((track, index) => ({
        id: track.id || createClientId(),
        release_id: releaseId,
        track_order: index + 1,
        title: track.title || `Track ${index + 1}`,
        file_name: track.fileName || track.title || '',
        file_size: track.size || 0,
        audio_url: track.url?.startsWith('blob:') ? '' : track.url || '',
        audio_path: track.audioPath || '',
        preview_audio_url: track.previewUrl?.startsWith('blob:') ? '' : track.previewUrl || '',
        preview_audio_path: track.previewPath || '',
        price: normalizePriceValue(track.price),
        free_full: Boolean(track.freeFull)
      }));

      void supabase.from('releases').upsert(releaseRow).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync rilisan ke Supabase:', error.message);
          return;
        }
        if (!error && trackRows.length) {
          void supabase.from('release_tracks').upsert(trackRows).then(({ error: trackError }) => {
            if (trackError && isMissingColumnError(trackError)) {
              const legacyTrackRows = trackRows.map((trackRow) => {
                const legacyTrackRow = { ...trackRow };
                delete legacyTrackRow.audio_path;
                delete legacyTrackRow.preview_audio_url;
                delete legacyTrackRow.preview_audio_path;
                return legacyTrackRow;
              });
              void supabase.from('release_tracks').upsert(legacyTrackRows).then(({ error: legacyTrackError }) => {
                if (legacyTrackError && !isMissingColumnError(legacyTrackError)) {
                  console.warn('Gagal sync track rilisan ke Supabase:', legacyTrackError.message);
                }
              });
              return;
            }
            if (trackError && !isMissingColumnError(trackError)) {
              console.warn('Gagal sync track rilisan ke Supabase:', trackError.message);
            }
          });
        }
      });
    }

    return publicRelease;
  }, [bandProfile.city, bandProfile.genre, bandProfile.name, bandProfile.slug, publishBandUpdateNotification, signatureName, userSession]);

  const publishPublicMerch = useCallback((item) => {
    const merchId = item.id || createClientId();
    const bandName = bandProfile.name || signatureName || item.bandName || 'Band WiSpace';
    const usesAdminConsignment = item.fulfillmentMode === 'admin_consignment';
    const publicItem = {
      ...item,
      id: merchId,
      bandName,
      bandSlug: bandProfile.slug || createSlug(bandName),
      bandUserId: item.bandUserId || userSession?.id || '',
      genre: bandProfile.genre || item.genre || 'Indie',
      city: bandProfile.city || item.city || 'Indonesia',
      fulfillmentMode: usesAdminConsignment ? 'admin_consignment' : 'band_ship',
      fulfillmentLabel: usesAdminConsignment ? 'STOK DI ADMIN WISPACE' : 'BAND KIRIM SENDIRI',
      consignmentStatus: usesAdminConsignment ? (item.consignmentStatus || 'waiting_stock_handover') : '',
      adminStockOnHand: usesAdminConsignment ? normalizePriceValue(item.adminStockOnHand || 0) : 0,
      weightGram: normalizePriceValue(item.weightGram || merchDraft.weightGram || 1000) || 1000,
      originShipping: usesAdminConsignment ? WISPACE_ADMIN_SHIPPING_ORIGIN : {
        address: bandProfile.shipFromAddress || item.originShipping?.address || '',
        district: bandProfile.shipFromDistrict || item.originShipping?.district || '',
        city: bandProfile.shipFromCity || item.originShipping?.city || bandProfile.city || '',
        province: bandProfile.shipFromProvince || item.originShipping?.province || '',
        postalCode: bandProfile.shipFromPostalCode || item.originShipping?.postalCode || '',
        contactName: bandName,
        contactPhone: bandProfile.cp || item.originShipping?.contactPhone || ''
      },
      updatedAt: new Date().toISOString()
    };
    publishBandUpdateNotification(publicItem.bandSlug, {
      id: `merch-${merchId}`,
      type: 'merch',
      title: 'MERCH BARU',
      body: `${publicItem.bandName} upload merch ${publicItem.name}.`,
      bandName: publicItem.bandName,
      targetId: merchId,
      targetType: 'merch'
    });
    const nextItems = [
      publicItem,
      ...loadPublicMerchRegistry().filter((registryItem) => String(registryItem.id) !== String(merchId))
    ];
    savePublicMerchRegistry(nextItems);
    setPublicMerchItems(nextItems);

    if (isSupabaseConfigured && userSession?.id && publicItem.name) {
      const merchRow = {
        id: merchId,
        band_user_id: userSession.id,
        band_name: publicItem.bandName,
        band_slug: publicItem.bandSlug,
        name: publicItem.name,
        description: publicItem.description || '',
        price: normalizePriceValue(publicItem.price),
        stock: normalizePriceValue(publicItem.stock),
        weight_gram: normalizePriceValue(publicItem.weightGram || 1000) || 1000,
        image_name: publicItem.imageName || '',
        image_preview: publicItem.imagePreview || '',
        genre: publicItem.genre || 'Indie',
        city: publicItem.city || 'Indonesia',
        fulfillment_mode: publicItem.fulfillmentMode || 'band_ship',
        fulfillment_label: publicItem.fulfillmentLabel || 'BAND KIRIM SENDIRI',
        consignment_status: publicItem.consignmentStatus || '',
        admin_stock_on_hand: normalizePriceValue(publicItem.adminStockOnHand || 0),
        origin_shipping: publicItem.originShipping || null,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      void supabase.from('merch_items').upsert(merchRow).then(async ({ error }) => {
        if (error && isMissingColumnError(error)) {
          const legacyMerchRow = { ...merchRow };
          delete legacyMerchRow.fulfillment_mode;
          delete legacyMerchRow.fulfillment_label;
          delete legacyMerchRow.consignment_status;
          delete legacyMerchRow.admin_stock_on_hand;
          delete legacyMerchRow.origin_shipping;
          delete legacyMerchRow.weight_gram;
          const { error: legacyError } = await supabase.from('merch_items').upsert(legacyMerchRow);
          if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync merch ke Supabase:', legacyError.message);
          return;
        }
        if (error) {
          console.warn('Gagal sync merch ke Supabase:', error.message);
        }
      });
    }

    return publicItem;
  }, [bandProfile.city, bandProfile.cp, bandProfile.genre, bandProfile.name, bandProfile.shipFromAddress, bandProfile.shipFromCity, bandProfile.shipFromDistrict, bandProfile.shipFromPostalCode, bandProfile.shipFromProvince, bandProfile.slug, merchDraft.weightGram, publishBandUpdateNotification, signatureName, userSession]);

  const publishPublicArticle = useCallback((article) => {
    const articleId = article.id || createClientId();
    const bandName = article.bandName || bandProfile.name || signatureName || 'Band WiSpace';
    const publicArticle = {
      ...article,
      id: articleId,
      bandName,
      bandSlug: article.bandSlug || bandProfile.slug || createSlug(bandName),
      genre: article.genre || bandProfile.genre || 'Indie',
      city: article.city || bandProfile.city || 'Indonesia',
      updatedAt: new Date().toISOString()
    };
    publishBandUpdateNotification(publicArticle.bandSlug, {
      id: `article-${articleId}`,
      type: 'article',
      title: 'ARTIKEL BARU',
      body: `${publicArticle.bandName} publish artikel ${publicArticle.title}.`,
      bandName: publicArticle.bandName,
      targetId: articleId,
      targetType: 'article'
    });
    const nextArticles = [
      publicArticle,
      ...loadPublicArticleRegistry().filter((registryArticle) => String(registryArticle.id) !== String(articleId))
    ];
    savePublicArticleRegistry(nextArticles);
    setPublicArticleItems(nextArticles);

    if (isSupabaseConfigured && userSession?.id && publicArticle.title) {
      const articleRow = {
        id: articleId,
        band_user_id: article.bandUserId || userSession.id,
        band_name: publicArticle.bandName,
        band_slug: publicArticle.bandSlug,
        title: publicArticle.title,
        category: publicArticle.category || 'Update Band',
        excerpt: publicArticle.excerpt || '',
        body: publicArticle.body || '',
        genre: publicArticle.genre || 'Indie',
        city: publicArticle.city || 'Indonesia',
        is_published: true,
        updated_at: new Date().toISOString()
      };

      void supabase.from('band_articles').upsert(articleRow).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync artikel ke Supabase:', error.message);
        }
      });
    }

    return publicArticle;
  }, [bandProfile.city, bandProfile.genre, bandProfile.name, bandProfile.slug, publishBandUpdateNotification, signatureName, userSession]);

  const exclusiveEventBanners = [
    ...gigs
      .filter((gig) => gig.status === 'approved_exclusive' && isVisibleApprovedHomepageGig(gig))
      .slice(0, 15)
      .map((gig, index) => ({
        id: `exclusive-${gig.id}`,
        title: gig.title,
        type: `EXCLUSIVE EVENT ${String(index + 1).padStart(2, '0')}`,
        image: gig.image || '',
        desc: `${gig.city || 'WiSpace'} / ${getGigDate(gig)} / ${getGigHtm(gig)}`,
        sourceGig: gig
      }))
  ].slice(0, 15);
  const currentExclusiveBannerIndex = exclusiveEventBanners[activeBanner] ? activeBanner : 0;
  const currentExclusiveBanner = exclusiveEventBanners[currentExclusiveBannerIndex];

  // RADAR STATUS LOGIN AUTOMATIC
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user || null;
      setUserSession(sessionUser);
      setUserRole(resolveUserRole(sessionUser));
      if (sessionUser) void verifyCloudAdminAccount(sessionUser).then((isAdmin) => {
        if (isAdmin) void fetchAdminPaymentRequests(sessionUser);
      });
      else setCloudAdminAccount(null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUserSession(sessionUser);
      setUserRole(resolveUserRole(sessionUser));
      if (sessionUser) void verifyCloudAdminAccount(sessionUser).then((isAdmin) => {
        if (isAdmin) void fetchAdminPaymentRequests(sessionUser);
      });
      else setCloudAdminAccount(null);
      if(!session) { setUserRole(null); setHasSignedContract(false); }
    });
    return () => subscription.unsubscribe();
  }, [fetchAdminPaymentRequests, resolveUserRole, verifyCloudAdminAccount]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const syncTime = () => setPlayerCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const syncDuration = () => setPlayerDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayerCurrentTime(0);
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (!userSession) {
      restoredUserKeyRef.current = '';
      return;
    }

    const restoreUserKey = userSession.id || userSession.email || 'guest';
    if (restoredUserKeyRef.current === restoreUserKey) return;
    restoredUserKeyRef.current = restoreUserKey;

    const restoreTimer = window.setTimeout(() => {
      const storedProfile = loadUserScopedData(BAND_PROFILE_STORAGE_PREFIX, userSession);
      const storedAgreement = loadUserScopedData(BAND_AGREEMENT_STORAGE_PREFIX, userSession);
      const storedArticles = loadUserScopedData(BAND_ARTICLES_STORAGE_PREFIX, userSession);
      const storedMerch = loadUserScopedData(BAND_MERCH_STORAGE_PREFIX, userSession);
      const storedSubscriptions = loadUserScopedData(BAND_SUBSCRIPTIONS_STORAGE_PREFIX, userSession);
      const storedAudienceProfile = loadUserScopedData(AUDIENCE_PROFILE_STORAGE_PREFIX, userSession);
      const storedAudienceLibrary = loadUserScopedData(AUDIENCE_LIBRARY_STORAGE_PREFIX, userSession);
      const storedAudienceDownloadLog = loadUserScopedData(AUDIENCE_DOWNLOAD_LOG_STORAGE_PREFIX, userSession);
      const storedNotificationReads = loadUserScopedData(AUDIENCE_NOTIFICATION_READ_PREFIX, userSession);

      if (storedProfile) {
        const safeStoredProfile = trimOversizedBandPreview(storedProfile);
        if (safeStoredProfile.photoPreview !== storedProfile.photoPreview || safeStoredProfile.coverPreview !== storedProfile.coverPreview) {
          persistBandProfileLocal(safeStoredProfile, userSession);
        }
        setBandProfile((current) => ({
          ...current,
          ...safeStoredProfile,
          slug: safeStoredProfile.slug || createSlug(safeStoredProfile.name || current.name || '')
        }));
      }

      if (storedAgreement?.accepted) {
        setHasSignedContract(true);
        setSignatureName((current) => current || storedAgreement.signatureName || storedProfile?.name || '');
        setUserRole('musisi');
        persistUserRole('musisi', userSession);
        if (storedProfile?.name || storedAgreement.signatureName) {
          publishPublicBandProfile({
            ...createEmptyBandProfile(),
            ...storedProfile,
            name: storedProfile?.name || storedAgreement.signatureName,
            slug: storedProfile?.slug || createSlug(storedProfile?.name || storedAgreement.signatureName)
          });
        }
      }

      if (Array.isArray(storedArticles)) {
        setArticleItems(storedArticles);
        storedArticles.forEach((article) => publishPublicArticle(article));
      }

      if (Array.isArray(storedMerch)) {
        setMerchItems(storedMerch);
        storedMerch.forEach((item) => publishPublicMerch(item));
      }

      if (Array.isArray(storedSubscriptions)) {
        setSubscribedBands(storedSubscriptions);
      }

      if (storedAudienceProfile) {
        setAudienceProfile({ ...createEmptyAudienceProfile(), ...storedAudienceProfile });
      }

      if (Array.isArray(storedAudienceLibrary)) {
        setPurchasedAlbums(storedAudienceLibrary);
      }

      if (Array.isArray(storedAudienceDownloadLog)) {
        setDownloadLogs(storedAudienceDownloadLog);
      }

      if (Array.isArray(storedNotificationReads)) {
        setReadSubscribedUpdateIds(storedNotificationReads);
      }

      if (isSupabaseConfigured && userSession?.id) {
        void fetchCloudData(userSession).then(({
          saleTransactionsData,
          audienceLibraryData,
          merchOrdersData,
          subscribedBandsData,
          notificationReadsData,
          updateNotificationsData,
          releaseAgreementsData,
          messagesData,
          wispacePickData
        }) => {
          setSaleTransactions(saleTransactionsData);
          setReleaseAgreements(releaseAgreementsData);
          setMessages(messagesData);
          setWispacePickDraft(wispacePickData);
          saveWispacePick(wispacePickData);
          saveMessageLedger(messagesData);
          if (audienceLibraryData?.length) {
            setPurchasedAlbums(audienceLibraryData);
            persistAudienceLibraryLocal(audienceLibraryData, userSession);
          }
          setMerchOrders(merchOrdersData);
          cacheBandUpdateNotifications(updateNotificationsData);
          if (subscribedBandsData.length) {
            setSubscribedBands(subscribedBandsData);
            persistBandSubscriptionsLocal(subscribedBandsData, userSession);
          }
          if (notificationReadsData.length) {
            setReadSubscribedUpdateIds(notificationReadsData);
            persistSubscribedUpdateReadsLocal(notificationReadsData, userSession);
          }
          saveTransactionLedger(saleTransactionsData);
          saveReleaseAgreementLedger(releaseAgreementsData);
          saveMerchOrders(merchOrdersData);
        });
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [persistAudienceLibraryLocal, persistAudienceDownloadLogLocal, persistBandProfileLocal, persistBandSubscriptionsLocal, persistSubscribedUpdateReadsLocal, persistUserRole, publishPublicArticle, publishPublicBandProfile, publishPublicMerch, userSession]);

  const stopAudioPlayback = () => {
    window.clearTimeout(audioPreviewTimerRef.current);
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setActiveTrack(null);
    setPlayerQueue([]);
    setPlayerQueueIndex(0);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert('Gagal logout: ' + error.message);
      return;
    }

    stopAudioPlayback();
    setShowAuthModal(false);
    setAuthType('');
    setAuthError('');
    setSearchTerm('');
    setIsSearchExpanded(false);
    setIsAdminUnlocked(false);
    setCloudAdminAccount(null);
    setAdminPassword('');
    setAdminError('');
    setUserRole(null);
    setHasSignedContract(false);
    setSignatureName('');
    setSubscribedBands([]);
    setReadSubscribedUpdateIds([]);
    setAudienceProfile(createEmptyAudienceProfile());
    setPurchasedAlbums([]);
    setDownloadLogs([]);
    setSelectedLibraryItemId(null);
    setSelectedReleaseId(null);
    setSelectedMerchId(null);
    setSelectedArticleId(null);
    if (`${window.location.pathname}${window.location.search}` !== '/') {
      window.history.pushState({ page: 'home' }, '', '/');
    }
    setActivePage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminUnlock = async (event) => {
    event.preventDefault();
    if (userSession?.id) {
      const isVerifiedAdmin = await verifyCloudAdminAccount(userSession);
      if (isVerifiedAdmin) {
        setAdminPassword('');
        void fetchAdminPaymentRequests(userSession);
        return;
      }
    }

    if (adminPassword === 'wispace2026') {
      setIsAdminUnlocked(true);
      setAdminPassword('');
      setAdminError('');
      void fetchAdminPaymentRequests(userSession);
      return;
    }

    setAdminError(userSession?.id
      ? 'Akun ini belum masuk tabel admin_users, atau password lokal salah bro.'
      : 'Login akun admin Supabase dulu, atau pakai password lokal buat testing.');
  };

  const closeAdminGate = () => {
    setSearchTerm('');
    if (window.location.pathname !== '/') {
      window.history.pushState({ page: 'home' }, '', '/');
    }
    setActivePage('home');
    setAdminPassword('');
    setAdminError('');
    setIsAdminUnlocked(false);
    setCloudAdminAccount(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetLocalTestingData = () => {
    const confirmed = window.confirm('Reset semua data testing lokal WiSpace di browser ini? Ini tidak menghapus data Supabase, file mp3/image di folder project, atau akun auth.');
    if (!confirmed) return;

    stopAudioPlayback();
    Object.keys(window.localStorage)
      .filter((key) => LOCAL_RESET_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => window.localStorage.removeItem(key));

    setGigs([]);
    setPublicBandProfiles([]);
    setAlbumItems([]);
    setArticleItems([]);
    setPublicArticleItems([]);
    setMerchItems([]);
    setPublicMerchItems([]);
    setArticleComments({});
    setContentReports([]);
    setSaleTransactions([]);
    setReleaseAgreements([]);
    setMonthlyFinanceReports([]);
    setPendingPayments([]);
    setMerchOrders([]);
    setPurchasedAlbums([]);
    setDownloadLogs([]);
    setSubscribedBands([]);
    setReadSubscribedUpdateIds([]);
    setBandNotifications([]);
    setBandSubscriberCount(0);
    setBandProfile(createEmptyBandProfile());
    setAudienceProfile(createEmptyAudienceProfile());
    setHasSignedContract(false);
    setSignatureName('');
    setSelectedGigDetail(null);
    setSelectedPosterPreview(null);
    setSelectedReleaseId(null);
    setSelectedMerchId(null);
    setSelectedArticleId(null);
    setActiveCheckout(null);
    setShowAuthModal(false);
    setShowNotificationPopout(false);
    setSearchTerm('');
    setActivePage('home');
    if (window.location.pathname !== '/') {
      window.history.pushState({ page: 'home' }, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetLocalTestingBucket = (bucket) => {
    const bucketLabels = {
      payments: 'payment request pending/rejected/paid lokal',
      commerce: 'ledger transaksi dan order merch lokal',
      library: 'library audience dan download log lokal akun ini',
      messages: 'message, notif, dan report konten lokal'
    };
    const confirmed = window.confirm(`Reset ${bucketLabels[bucket] || 'data testing lokal'}? Ini tidak menghapus data Supabase live.`);
    if (!confirmed) return;

    if (bucket === 'payments') {
      window.localStorage.removeItem(PENDING_PAYMENTS_STORAGE_KEY);
      setPendingPayments([]);
      setActiveCheckout(null);
      setSelectedPaymentDetail(null);
      setSelectedPaymentProofPreview(null);
      return;
    }

    if (bucket === 'commerce') {
      window.localStorage.removeItem(PUBLIC_TRANSACTION_LEDGER_STORAGE_KEY);
      window.localStorage.removeItem(MERCH_ORDERS_STORAGE_KEY);
      window.localStorage.removeItem(MONTHLY_FINANCE_REPORTS_STORAGE_KEY);
      setSaleTransactions([]);
      setMerchOrders([]);
      setMonthlyFinanceReports([]);
      setSelectedPaymentDetail(null);
      return;
    }

    if (bucket === 'library') {
      getUserStorageKeys(AUDIENCE_LIBRARY_STORAGE_PREFIX, userSession).forEach((key) => window.localStorage.removeItem(key));
      getUserStorageKeys(AUDIENCE_DOWNLOAD_LOG_STORAGE_PREFIX, userSession).forEach((key) => window.localStorage.removeItem(key));
      setPurchasedAlbums([]);
      setDownloadLogs([]);
      setSelectedLibraryItemId(null);
      setSelectedLibraryTrackId(null);
      stopAudioPlayback();
      return;
    }

    if (bucket === 'messages') {
      window.localStorage.removeItem(MESSAGE_LEDGER_STORAGE_KEY);
      window.localStorage.removeItem(CONTENT_REPORTS_STORAGE_KEY);
      getUserStorageKeys(AUDIENCE_NOTIFICATION_READ_PREFIX, userSession).forEach((key) => window.localStorage.removeItem(key));
      setMessages(DEFAULT_MESSAGE_LEDGER);
      setContentReports([]);
      setReadSubscribedUpdateIds([]);
      setBandNotifications([]);
      setShowNotificationPopout(false);
    }
  };

  // EARLY TRIGGER SCROLL SENSOR (80PX)
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) setIsScrolled(true);
      else { setIsScrolled(false); setIsSearchExpanded(false); }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FETCH DATABASE CLOUD
  const fetchData = async () => {
    const { gigsData, bandProfilesData, releasesData, articlesData, merchData, articleCommentsData, saleTransactionsData, audienceLibraryData, merchOrdersData, subscribedBandsData, notificationReadsData, updateNotificationsData, releaseAgreementsData, messagesData, wispacePickData } = await fetchCloudData(userSession);
    const normalizedGigs = await normalizeFetchedGigs(gigsData);
    setGigs(normalizedGigs);
    setPublicBandProfiles(bandProfilesData);
    setAlbumItems(releasesData);
    setPublicArticleItems(articlesData);
    setPublicMerchItems(merchData);
    setArticleComments(articleCommentsData);
    setSaleTransactions(saleTransactionsData);
    setReleaseAgreements(releaseAgreementsData);
    if (audienceLibraryData?.length) {
      setPurchasedAlbums(audienceLibraryData);
      persistAudienceLibraryLocal(audienceLibraryData, userSession);
    }
    setMerchOrders(merchOrdersData);
    setMessages(messagesData);
    setWispacePickDraft(wispacePickData);
    if (userSession?.id) {
      setSubscribedBands((current) => subscribedBandsData.length ? subscribedBandsData : current);
      setReadSubscribedUpdateIds((current) => notificationReadsData.length ? notificationReadsData : current);
    }
    savePublicGigRegistry(normalizedGigs);
    cacheBandUpdateNotifications(updateNotificationsData);
    savePublicBandRegistry(bandProfilesData);
    savePublicReleaseRegistry(releasesData);
    savePublicArticleRegistry(articlesData);
    savePublicMerchRegistry(merchData);
    saveArticleComments(articleCommentsData);
    saveTransactionLedger(saleTransactionsData);
    saveReleaseAgreementLedger(releaseAgreementsData);
    saveMerchOrders(merchOrdersData);
    saveMessageLedger(messagesData);
    saveWispacePick(wispacePickData);
    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      const { gigsData, bandProfilesData, releasesData, articlesData, merchData, articleCommentsData, saleTransactionsData, merchOrdersData, updateNotificationsData, messagesData, wispacePickData } = await fetchCloudData(null, { bootstrapOnly: true });
      if (!isActive) return;

      const normalizedGigs = await normalizeFetchedGigs(gigsData);
      if (!isActive) return;

      setGigs(normalizedGigs);
      setPublicBandProfiles(bandProfilesData);
      setAlbumItems(releasesData);
      setPublicArticleItems(articlesData);
      setPublicMerchItems(merchData);
      setArticleComments(articleCommentsData);
      setSaleTransactions(saleTransactionsData);
      setMerchOrders(merchOrdersData);
      setMessages(messagesData);
      setWispacePickDraft(wispacePickData);
      cacheBandUpdateNotifications(updateNotificationsData);
      savePublicGigRegistry(normalizedGigs);
      savePublicBandRegistry(bandProfilesData);
      savePublicReleaseRegistry(releasesData);
      savePublicArticleRegistry(articlesData);
      savePublicMerchRegistry(merchData);
      saveArticleComments(articleCommentsData);
      saveTransactionLedger(saleTransactionsData);
      saveMerchOrders(merchOrdersData);
      saveMessageLedger(messagesData);
      saveWispacePick(wispacePickData);
      setLoading(false);

      window.setTimeout(async () => {
        if (!isActive) return;
        const deferredCloudData = await fetchCloudData();
        if (!isActive) return;

        const deferredNormalizedGigs = await normalizeFetchedGigs(deferredCloudData.gigsData);
        if (!isActive) return;

        setGigs(deferredNormalizedGigs);
        setPublicBandProfiles(deferredCloudData.bandProfilesData);
        setAlbumItems(deferredCloudData.releasesData);
        setPublicArticleItems(deferredCloudData.articlesData);
        setPublicMerchItems(deferredCloudData.merchData);
        setArticleComments(deferredCloudData.articleCommentsData);
        setSaleTransactions(deferredCloudData.saleTransactionsData);
        setMerchOrders(deferredCloudData.merchOrdersData);
        setMessages(deferredCloudData.messagesData);
        setWispacePickDraft(deferredCloudData.wispacePickData);
        cacheBandUpdateNotifications(deferredCloudData.updateNotificationsData);
        savePublicGigRegistry(deferredNormalizedGigs);
        savePublicBandRegistry(deferredCloudData.bandProfilesData);
        savePublicReleaseRegistry(deferredCloudData.releasesData);
        savePublicArticleRegistry(deferredCloudData.articlesData);
        savePublicMerchRegistry(deferredCloudData.merchData);
        saveArticleComments(deferredCloudData.articleCommentsData);
        saveTransactionLedger(deferredCloudData.saleTransactionsData);
        saveMerchOrders(deferredCloudData.merchOrdersData);
        saveMessageLedger(deferredCloudData.messagesData);
        saveWispacePick(deferredCloudData.wispacePickData);
      }, 0);
    };

    loadInitialData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (exclusiveEventBanners.length === 0) return undefined;
    if (selectedGigDetail?.fromEventOverlay) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return undefined;
    }

    timerRef.current = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % exclusiveEventBanners.length);
    }, 6500);

    return () => window.clearInterval(timerRef.current);
  }, [exclusiveEventBanners.length, selectedGigDetail?.fromEventOverlay]);

  // LOGIKA AUTHENTICATION ASLI
  const handleDaftarAkun = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const normalizedEmail = authEmail.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: authPassword,
      options: {
        data: { role: userRole }
      }
    });
    setAuthLoading(false);
    if (error) setAuthError("Gagal join: " + error.message);
    else {
      persistUserRole(userRole, { email: normalizedEmail });
      alert("💥 SAKTI! Akun berhasil disuntik. CEK EMAIL LU SEKARANG buat klik link konfirmasi!");
      setShowAuthModal(false); setAuthEmail(''); setAuthPassword('');
    }
  };

  const handleLoginAkun = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const normalizedEmail = authEmail.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: authPassword });
    setAuthLoading(false);
    if (error) setAuthError("Gagal masuk moshpit: " + error.message);
    else {
      const savedRole = resolveUserRole(data.user);
      setShowAuthModal(false); setAuthEmail(''); setAuthPassword('');
      if (savedRole === 'musisi') {
        const storedAgreement = loadUserScopedData(BAND_AGREEMENT_STORAGE_PREFIX, data.user);
        const storedProfile = loadUserScopedData(BAND_PROFILE_STORAGE_PREFIX, data.user);
        setUserRole('musisi');
        persistUserRole('musisi', data.user);
        setHasSignedContract(Boolean(storedAgreement?.accepted));
        setSignatureName((current) => current || storedAgreement?.signatureName || '');
        if (storedAgreement?.accepted) {
          const loginBandSlug = storedProfile?.slug || createSlug(storedProfile?.name || storedAgreement?.signatureName || 'band-wispace');
          window.history.pushState({ page: 'band_public', slug: loginBandSlug }, '', `/band/${loginBandSlug}`);
          setIsViewingOwnBandProfile(true);
          setActivePage('band_public');
          return;
        }
        setActivePage('home');
        return;
      }
      if (savedRole === 'audience') {
        setUserRole('audience');
        persistUserRole('audience', data.user);
        setHasSignedContract(false);
        setSignatureName('');
        navigateInternalPage('audience_profile');
        return;
      }
      // Picu popup pemilihan takdir peran (Musisi / Audience) setelah login berhasil
      setTimeout(() => { setAuthType('pilih_peran'); setShowAuthModal(true); }, 500);
    }
  };

  const handleResendVerification = async () => {
    setAuthError('');
    const normalizedEmail = authEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError('Isi email dulu supaya link verifikasi bisa dikirim ulang.');
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
    setAuthLoading(false);

    if (error) setAuthError('Gagal kirim ulang verifikasi: ' + error.message);
    else setAuthError('Link verifikasi baru sudah dikirim. Cek inbox/spam email lu, bro.');
  };

  const handleRoleSelection = async (role) => {
    setUserRole(role);
    persistUserRole(role, userSession);
    if (userSession) {
      await supabase.auth.updateUser({ data: { role } });
    }

    if (role === 'musisi') {
      setAuthType('legalitas_musisi');
      return;
    }

    setShowAuthModal(false);
    setHasSignedContract(false);
    setSignatureName('');
    navigateInternalPage('audience_profile');
    alert('Selamat! Akun kasta Audience lu siap berburu rilisan!');
  };

  const handleAudienceProfileSave = (event) => {
    event.preventDefault();
    persistAudienceProfileLocal(audienceProfile);
    alert('Profil audience sudah diperbarui.');
  };

  const getBandProfileSlug = (profile = bandProfile) => (
    profile.slug || createSlug(profile.name || signatureName || 'band-wispace')
  );

  const getBandProfilePath = (profile = bandProfile) => `/band/${getBandProfileSlug(profile)}`;

  const openBandPublicProfile = (isOwnerView = false, profile = bandProfile) => {
    const bandPath = getBandProfilePath(profile);
    if (window.location.pathname !== bandPath) {
      window.history.pushState({ page: 'band_public', slug: getBandProfileSlug(profile) }, '', bandPath);
    }
    setShowAuthModal(false);
    setShowNotificationPopout(false);
    setShowBandAdminPopout(false);
    setViewedBandSlug(getBandProfileSlug(profile));
    setIsViewingOwnBandProfile(isOwnerView);
    setActivePage('band_public');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openBandWorkspace = (tab = 'profile') => {
    setBandProfileTab(tab);
    navigateInternalPage('band_profile', { bandTab: tab });
  };

  const openAudienceWorkspace = (page = 'audience_profile') => {
    navigateInternalPage(page);
  };

  const navigateInternalPage = (page, options = {}) => {
    const nextPath = getPublicRoutePath(page, options);
    const nextUrl = `${nextPath}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.pushState({ page, exploreTab: options.exploreTab || null }, '', nextUrl);
    }
    setSelectedGigDetail(null);
    setSelectedPosterPreview(null);
    setSelectedMerchDetail(null);
    setSelectedMerchId(null);
    if (!options.keepReleaseDetail) setSelectedReleaseId(null);
    setShowNotificationPopout(false);
    setShowBandAdminPopout(false);
    if (page !== 'articles') setSelectedArticleId(null);
    setActivePage(page);
    if (options.exploreTab) setExploreTab(options.exploreTab);
    if (options.bandTab) setBandProfileTab(options.bandTab);
    if (options.clearSearch) setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticleReader = (article) => {
    if (!article?.id) return;
    setSelectedArticleId(article.id);
    navigateInternalPage('articles');
  };

  const openReleaseDetail = (album) => {
    if (!album?.id) return;
    setSelectedReleaseId(album.id);
    navigateInternalPage('explore', { exploreTab: 'rilisan', keepReleaseDetail: true });
  };

  const openReleasePopup = (album) => {
    if (!album?.id) return;
    setSelectedReleaseDetail(album);
    setSelectedMerchDetail(null);
    setSelectedGigDetail(null);
    setSelectedPosterPreview(null);
  };

  const openMerchDetail = (item) => {
    if (!item?.id) return;
    setSelectedMerchId(item.id);
    setSelectedMerchDetail(item);
    setSelectedGigDetail(null);
    setSelectedPosterPreview(null);
  };

  const copyBandProfileLink = async () => {
    const profileUrl = `${window.location.origin}/band/${currentBandSlug}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      alert('Link profile band sudah dicopy bro.');
    } catch {
      window.prompt('Copy link profile band:', profileUrl);
    }
  };

  const handleBandSubscribeToggle = () => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError(`Join atau login dulu buat subscribe ${(displayBandProfile.name || signatureName || 'band ini').toUpperCase()} dan dapet notif update.`);
      return;
    }

    const bandSlug = currentBandSlug;
    const bandName = displayBandProfile.name || signatureName || 'Band WiSpace';
    const isSubscribed = subscribedBands.some((item) => item.slug === bandSlug);
    const subscribedAt = new Date().toISOString();
    const notificationCreatedAt = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const notificationId = `${bandSlug}-${subscribedAt}`;
    const nextSubscriptions = isSubscribed
      ? subscribedBands.filter((item) => item.slug !== bandSlug)
      : [
          {
            slug: bandSlug,
            name: bandName,
            genre: displayBandProfile.genre || 'Indie',
            city: displayBandProfile.city || 'Indonesia',
            subscribedAt
          },
          ...subscribedBands
        ];

    setSubscribedBands(nextSubscriptions);
    persistBandSubscriptionsLocal(nextSubscriptions);

    const currentCount = Number(loadBandGlobalData(BAND_SUBSCRIBER_COUNT_PREFIX, bandSlug, bandSubscriberCount)) || 0;
    const nextCount = isSubscribed ? Math.max(0, currentCount - 1) : currentCount + 1;
    const nextNotifications = isSubscribed
      ? bandNotifications
      : [
          {
            id: notificationId,
            type: 'subscribe',
            title: 'SUBSCRIBER BARU',
            body: `${audienceProfile.displayName || userSession.email?.split('@')[0] || 'Audience WiSpace'} subscribe ${bandName}.`,
            createdAt: notificationCreatedAt,
            read: false
          },
          ...bandNotifications
        ].slice(0, 12);

    setBandSubscriberCount(nextCount);
    setBandNotifications(nextNotifications);
    saveBandGlobalData(BAND_SUBSCRIBER_COUNT_PREFIX, bandSlug, nextCount);
    saveBandGlobalData(BAND_NOTIFICATIONS_STORAGE_PREFIX, bandSlug, nextNotifications);
    if (isSupabaseConfigured && userSession?.id) {
      if (isSubscribed) {
        void supabase
          .from('band_subscriptions')
          .delete()
          .eq('audience_user_id', userSession.id)
          .eq('band_slug', bandSlug)
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) console.warn('Gagal sync unsubscribe band:', error.message);
          });
      } else {
        void supabase
          .from('band_subscriptions')
          .upsert({
            audience_user_id: userSession.id,
            band_slug: bandSlug,
            band_name: bandName
          }, { onConflict: 'audience_user_id,band_slug' })
          .then(({ error }) => {
            if (error && !isMissingColumnError(error)) console.warn('Gagal sync subscribe band:', error.message);
          });
      }
    }
    alert(isSubscribed
      ? `Subscribe ke ${bandName} dibatalin bro.`
      : `Subscribed ke ${bandName}. Nanti update rilisan, gigs, artikel, dan merch bisa masuk notif.`);
  };

  const markBandNotificationsRead = () => {
    const nextNotifications = bandNotifications.map((notification) => ({ ...notification, read: true }));
    setBandNotifications(nextNotifications);
    saveBandGlobalData(BAND_NOTIFICATIONS_STORAGE_PREFIX, currentBandSlug, nextNotifications);
  };

  const handleContractSignature = (e) => {
    e.preventDefault();
    if(!signatureName.trim()) return alert("Ketik nama band lu sebagai tanda tangan digital sah!");
    const signedBandName = signatureName.trim();
    const signedAt = new Date().toISOString();
    setHasSignedContract(true);
    setUserRole('musisi');
    persistUserRole('musisi', userSession);
    persistBandAgreementLocal({
      signatureName: signedBandName,
      signedAt,
      accepted: true
    }, userSession);
    if (userSession) {
      supabase.auth.updateUser({ data: { role: 'musisi' } });
      void supabase
        .from('band_agreements')
        .upsert({
          user_id: userSession.id,
          signature_name: signedBandName,
          signed_at: signedAt,
          accepted: true
        }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync agreement ke Supabase:', error.message);
          }
        });
    }
    setBandProfile((current) => {
      const nextProfile = {
        ...current,
        name: current.name || signedBandName,
        slug: current.slug || createSlug(signedBandName),
        isPublished: true
      };
      persistBandProfileLocal(nextProfile, userSession);
      publishPublicBandProfile(nextProfile);
      return nextProfile;
    });
    setShowAuthModal(false);
    openBandPublicProfile(true, {
      ...bandProfile,
      name: bandProfile.name || signedBandName,
      slug: bandProfile.slug || createSlug(signedBandName)
    });
    alert(`⚡ KONTRAK SAH! Selamat datang Backstage, ${signedBandName.toUpperCase()}!`);
  };

  // SUBMIT SUNTIK DATA GIGS & LAGU
  const handleBandSubmit = async (e) => {
    e.preventDefault();
    if (!newPosterImage) {
      alert('Upload gambar pamflet dulu bro, biar admin bisa cek visual event-nya.');
      return;
    }

    const gigPayload = { 
      title: newTitle, 
      city: newCity, 
      genre: encodeGigGenre(newGenre, newGigRequestType, { date: newDate, htm: newHtm, cp: newCp }), 
      date: newDate,
      htm: newHtm,
      cp: newCp,
      request_type: newGigRequestType,
      image_path: newPosterImagePath || null,
      image: newPosterImage,
      status: 'pending' 
    };
    const { error: firstError } = await supabase.from('gigs').insert([gigPayload]);
    const error = isMissingColumnError(firstError)
      ? (await supabase.from('gigs').insert([{ title: gigPayload.title, city: gigPayload.city, genre: gigPayload.genre, date: gigPayload.date, image: gigPayload.image, status: gigPayload.status }])).error
      : firstError;
    if (error) alert(error.message);
    else { 
      setNewTitle(''); setNewCity(''); setNewGenre(''); setNewDate(''); setNewHtm(''); setNewCp('');
      setNewGigRequestType('free');
      setNewPosterImage('');
      setNewPosterImagePath('');
      setNewPosterName('');
      setNewPosterNotice('');
      setShowAuthModal(false); 
      alert(`Poster masuk antrean kurasi admin sebagai ${newGigRequestType === 'exclusive' ? 'exclusive slide' : 'free bulletin'}!`); 
      fetchData(); 
    }
  };

  const handleGigPosterImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('File pamflet harus gambar ya bro: JPG, PNG, atau WEBP.');
      clearFileInput(event);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB dulu bro, biar upload dan preview tetap ringan.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, newGigRequestType === 'exclusive' ? 'gigs/exclusive' : 'gigs/free', userSession);
      setNewPosterImage(uploadResult.publicUrl);
      setNewPosterImagePath(uploadResult.path || '');
      setNewPosterName(file.name);

      const dimensions = await loadImageDimensions(uploadResult.fallbackPreview);
      const ratio = dimensions.width / dimensions.height;
      const isExclusiveFit = ratio >= 1.6 && ratio <= 1.85;
      const isPosterFit = ratio >= 0.72 && ratio <= 0.85;
      const isCurrentFit = newGigRequestType === 'exclusive' ? isExclusiveFit : isPosterFit;
      setNewPosterNotice(isCurrentFit
        ? `Ukuran file kebaca ${dimensions.width} x ${dimensions.height}px. Rasio sudah cocok buat ${newGigRequestType === 'exclusive' ? 'exclusive slide' : 'free bulletin'}.`
        : `Ukuran file kebaca ${dimensions.width} x ${dimensions.height}px. Ideal ${newGigRequestType === 'exclusive' ? 'exclusive slide: 1920 x 1080 px / 16:9 landscape' : 'free bulletin: 1080 x 1440 px / 3:4 poster'}.`);
    } catch (error) {
      alert(`Gagal baca pamflet: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleScheduleSubmit = (event) => {
    event.preventDefault();
    const scheduleId = createClientId();
    const scheduleBandName = bandProfile.name || signatureName || 'Band WiSpace';
    const scheduleBandSlug = bandProfile.slug || createSlug(scheduleBandName);
    const nextSchedule = {
      id: scheduleId,
      ...scheduleDraft,
      bandName: scheduleBandName,
      bandSlug: scheduleBandSlug,
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    setBandScheduleItems((current) => [
      nextSchedule,
      ...current
    ]);
    publishBandUpdateNotification(scheduleBandSlug, {
      id: `schedule-${scheduleId}`,
      type: 'schedule',
      title: 'JADWAL MANGGUNG',
      body: `${scheduleBandName} update jadwal: ${scheduleDraft.title} di ${scheduleDraft.venue}.`,
      bandName: scheduleBandName,
      targetId: scheduleId,
      targetType: 'schedule'
    });
    setScheduleDraft({ title: '', venue: '', date: '', htm: '', cp: '' });
    alert('Jadwal manggung sudah masuk ke profil band.');
  };

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    const singleId = createClientId();
    const singleTrackId = createClientId();
    const singleRelease = {
      id: singleId,
      title: trackTitle,
      price: '',
      description: 'Single preview dari WiSpace radio.',
      coverPreview: bandProfile.photoPreview || bandProfile.coverPreview || '',
      coverName: bandProfile.photoName || bandProfile.coverName || '',
      trackCount: 1,
      releaseType: 'single',
      tracks: [{
        id: singleTrackId,
        title: trackTitle,
        fileName: '',
        size: 0,
        url: trackUrl,
        price: '',
        freeFull: false
      }],
      bandName: trackBand || bandProfile.name || signatureName || 'Band WiSpace',
      city: bandProfile.city || 'Indonesia',
      genre: bandProfile.genre || 'Indie',
      signedBy: bandProfile.name || signatureName || trackBand || 'Band WiSpace'
    };

    const { error } = await supabase.from('tracks').insert([{ band: trackBand, title: trackTitle, url: trackUrl }]);
    if (error) alert(error.message);
    else {
      const publicRelease = publishPublicRelease(singleRelease);
      setAlbumItems((current) => [
        publicRelease,
        ...current.filter((item) => String(item.id) !== String(publicRelease.id))
      ]);
      setTrackBand('');
      setTrackTitle('');
      setTrackUrl('');
      setShowAuthModal(false);
      alert('Single sudah masuk ke rilisan.');
    }
  };

  const recordPlatformIncome = useCallback((sale) => {
    const grossAmount = normalizePriceValue(sale.amount);
    const nextTransaction = {
      id: createClientId(),
      productType: sale.productType || 'platform_income',
      productTitle: sale.productTitle || 'Pemasukan WiSpace',
      sellerBandName: 'WiSpace',
      sellerBandSlug: 'wispace-admin',
      buyerName: audienceProfile.displayName || userSession?.email?.split('@')[0] || 'User WiSpace',
      buyerEmail: userSession?.email || '',
      grossAmount,
      platformFee: grossAmount,
      bandNet: 0,
      revenueShare: 'platform',
      status: sale.status || 'paid_settled',
      paymentStatus: sale.paymentStatus || 'demo_paid',
      payoutStatus: 'platform_income',
      orderId: sale.orderId || '',
      paymentMethod: sale.paymentMethod || 'demo_checkout',
      fulfillmentStatus: sale.fulfillmentStatus || 'platform_recorded',
      gigId: sale.gigId || '',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setSaleTransactions((current) => {
      const alreadyRecorded = nextTransaction.gigId && current.some((transaction) => (
        transaction.gigId === nextTransaction.gigId && transaction.productType === nextTransaction.productType
      ));
      if (alreadyRecorded) return current;

      const nextLedger = [nextTransaction, ...current];
      saveTransactionLedger(nextLedger);
      return nextLedger;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase.from('sales_transactions').insert([{
        id: nextTransaction.id,
        order_id: nextTransaction.orderId || null,
        buyer_user_id: userSession.id,
        seller_band_slug: nextTransaction.sellerBandSlug,
        seller_band_name: nextTransaction.sellerBandName,
        buyer_name: nextTransaction.buyerName,
        buyer_email: nextTransaction.buyerEmail,
        product_type: nextTransaction.productType,
        product_title: nextTransaction.productTitle,
        gig_id: sale.gigId || null,
        gross_amount: nextTransaction.grossAmount,
        platform_fee: nextTransaction.platformFee,
        band_net: nextTransaction.bandNet,
        revenue_share: nextTransaction.revenueShare,
        payment_method: nextTransaction.paymentMethod,
        fulfillment_status: nextTransaction.fulfillmentStatus,
        payout_status: nextTransaction.payoutStatus,
        status: nextTransaction.status,
        paid_at: nextTransaction.paidAt
      }]).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync pemasukan platform ke Supabase:', error.message);
        }
      });
    }

    return nextTransaction;
  }, [audienceProfile.displayName, userSession]);

  const updateGigStatus = async (id, updatePayload) => {
    const { error: firstError } = await supabase.from('gigs').update(updatePayload).eq('id', id);
    const error = isMissingColumnError(firstError) && updatePayload.status
      ? (await supabase.from('gigs').update({ status: updatePayload.status }).eq('id', id)).error
      : firstError;
    if (!error) {
      setGigs((current) => current.map((gig) => (
        gig.id === id ? { ...gig, ...updatePayload } : gig
      )));
    }
    return error;
  };

  const getGigExpiryDraftValue = (gigOrId) => {
    const gig = typeof gigOrId === 'object' ? gigOrId : gigs.find((item) => item.id === gigOrId);
    const id = typeof gigOrId === 'object' ? gigOrId.id : gigOrId;
    return gigExpiryDrafts[id] || normalizeDateInputValue(gig?.approved_until) || addDaysDateValue(10);
  };

  const updateGigExpiryDraft = (id, value) => {
    setGigExpiryDrafts((current) => ({ ...current, [id]: value }));
  };

  const handleGigModeration = async (id, status, approvedUntilOverride = '') => {
    const approvedUntilValue = approvedUntilOverride || addDaysDateValue(10);
    const approvedAt = formatDateInputValue(new Date());
    const updatePayload = status === 'approved_exclusive'
      ? { status, approved_at: approvedAt, approved_until: approvedUntilValue, payment_status: 'paid', activated_at: new Date().toISOString() }
      : status === 'approved_free'
        ? { status, approved_at: approvedAt, approved_until: approvedUntilValue, payment_status: 'not_required' }
        : status === 'approved_waiting_payment'
          ? { status, payment_status: 'awaiting_payment', exclusive_fee: EXCLUSIVE_POSTER_SLOT_FEE }
          : status === 'rejected'
            ? { status, payment_status: 'cancelled' }
            : { status };
    const error = await updateGigStatus(id, updatePayload);
    if (error) alert("Gagal update status pamflet: " + error.message);
    else {
      const message = status === 'approved_free'
        ? `Pamflet free live sampai ${formatDisplayDate(approvedUntilValue)}.`
        : status === 'approved_waiting_payment'
          ? `Konten exclusive disetujui. Pamflet belum tayang sampai user menyelesaikan pembayaran Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')}.`
        : status === 'approved_exclusive'
          ? `Pamflet exclusive live sampai ${formatDisplayDate(approvedUntilValue)}.`
          : 'Pamflet ditolak dan tidak akan tampil.';
      alert(message);
      fetchData();
    }
  };

  const handleGigExclusivePayment = async (gig) => {
    const confirmed = window.confirm(`Bayar slot exclusive Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} untuk "${gig.title}"? Ini demo payment dulu.`);
    if (!confirmed) return;

    const paymentReference = `demo-exclusive-${gig.id}-${createClientId().slice(0, 8)}`;
    const error = await updateGigStatus(gig.id, {
      status: 'paid_waiting_activation',
      payment_status: 'paid',
      payment_reference: paymentReference,
      exclusive_fee: EXCLUSIVE_POSTER_SLOT_FEE,
      paid_at: new Date().toISOString()
    });
    if (error) alert('Gagal update pembayaran pamflet: ' + error.message);
    else {
      recordPlatformIncome({
        productType: 'exclusive_poster',
        productTitle: gig.title || 'Pamflet Exclusive',
        amount: EXCLUSIVE_POSTER_SLOT_FEE,
        gigId: gig.id
      });
      alert('Pembayaran demo berhasil. Admin WiSpace akan mendapat status PAID dan bisa activate slot exclusive.');
      fetchData();
    }
  };

  const handleGigActivateExclusive = async (id, approvedUntilOverride = '') => {
    const approvedUntilValue = approvedUntilOverride || addDaysDateValue(10);
    const approvedAt = formatDateInputValue(new Date());
    const error = await updateGigStatus(id, {
      status: 'approved_exclusive',
      approved_at: approvedAt,
      approved_until: approvedUntilValue,
      payment_status: 'paid',
      activated_at: new Date().toISOString()
    });
    if (error) alert('Gagal activate pamflet exclusive: ' + error.message);
    else {
      alert(`Pamflet exclusive aktif sampai ${formatDisplayDate(approvedUntilValue)}.`);
      fetchData();
    }
  };

  const handleGigExpiryUpdate = async (gig) => {
    const approvedUntilValue = getGigExpiryDraftValue(gig);
    if (!approvedUntilValue) return alert('Isi tanggal habis tayang dulu bro.');
    const error = await updateGigStatus(gig.id, { approved_until: approvedUntilValue });
    if (error) alert('Gagal update tanggal habis pamflet: ' + error.message);
    else {
      alert(`Tanggal habis pamflet diset ke ${formatDisplayDate(approvedUntilValue)}.`);
      fetchData();
    }
  };

  const handleGigRemove = async (id) => {
    const confirmed = window.confirm('Remove pamflet ini dari tayangan publik WiSpace?');
    if (!confirmed) return;

    const { error } = await supabase.from('gigs').update({ status: 'removed' }).eq('id', id);
    if (error) alert('Gagal remove pamflet: ' + error.message);
    else {
      alert('Pamflet sudah diremove dari list free/exclusive.');
      fetchData();
    }
  };

  const handleBandPhotoImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Foto profile harus file gambar ya bro.');
      clearFileInput(event);
      return;
    }
    if (isImageTooLarge(file, BAND_PHOTO_MAX_SIZE)) {
      alert(`Foto profile maksimal ${formatFileSize(BAND_PHOTO_MAX_SIZE)} dulu bro. Compress/crop dulu biar tidak bikin halaman berat.`);
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'profiles/photos', userSession);
      setBandProfile((current) => {
        const nextProfile = { ...current, photoName: file.name, photoPreview: uploadResult.publicUrl };
        persistBandProfileLocal(nextProfile);
        return nextProfile;
      });
      if (uploadResult.error) alert(`Storage gagal, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import foto profile: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleAudiencePhotoImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Foto profile harus file gambar ya bro.');
      clearFileInput(event);
      return;
    }
    if (file.size > BAND_PHOTO_MAX_SIZE) {
      alert('Foto profile maksimal 1MB dulu bro, biar app tetap ringan.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'audience/photos', userSession);
      setAudienceProfile((current) => {
        const nextProfile = { ...current, photoName: file.name, photoPreview: uploadResult.publicUrl };
        persistAudienceProfileLocal(nextProfile);
        return nextProfile;
      });
      if (uploadResult.error) alert(`Storage gagal, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import foto profile: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleBandCoverImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Cover band harus file gambar ya bro.');
      clearFileInput(event);
      return;
    }
    if (isImageTooLarge(file, BAND_COVER_MAX_SIZE)) {
      alert(`Banner band maksimal ${formatFileSize(BAND_COVER_MAX_SIZE)} dulu bro. Idealnya 1600 x 600 px, JPG/WEBP yang sudah dikompres.`);
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'profiles/covers', userSession);
      setBandProfile((current) => {
        const nextProfile = { ...current, coverName: file.name, coverPreview: uploadResult.publicUrl };
        persistBandProfileLocal(nextProfile);
        return nextProfile;
      });
      if (uploadResult.error) alert(`Storage gagal, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import banner band: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleAlbumCoverImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Cover album harus file gambar ya bro.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'releases/covers', userSession);
      setAlbumDraft((current) => {
        if (current.coverPreview?.startsWith('blob:')) URL.revokeObjectURL(current.coverPreview);
        return { ...current, coverName: file.name, coverPreview: uploadResult.publicUrl };
      });
      if (uploadResult.error) alert(`Storage gagal, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import cover album: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleAlbumAudioImport = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const unsupportedFile = files.find((file) => !isSupportedAudioFile(file));
    if (unsupportedFile) {
      alert(`File ${unsupportedFile.name} belum didukung. Untuk WiSpace pakai MP3 saja dulu bro, supaya master WAV/hi-res band tetap aman.`);
      clearFileInput(event);
      return;
    }

    try {
      const uploadedFiles = await Promise.all(files.map(async (file) => {
        const uploadResult = await uploadPrivateAudio(file, 'releases/audio', userSession);
        let previewResult = {
          previewName: '',
          previewUrl: '',
          previewPath: '',
          previewStatus: 'auto_failed',
          previewError: ''
        };

        try {
          const previewFile = await generateThirtySecondPreviewFile(file);
          const previewUploadResult = await uploadPublicPreviewAudio(previewFile, 'releases/previews', userSession);
          previewResult = {
            previewName: previewFile.name,
            previewUrl: previewUploadResult.previewUrl,
            previewPath: previewUploadResult.previewPath,
            previewStatus: previewUploadResult.stored ? 'auto_stored' : previewUploadResult.error ? 'auto_fallback' : 'auto_local',
            previewError: previewUploadResult.error?.message || ''
          };
        } catch (previewError) {
          previewResult = {
            ...previewResult,
            previewError: previewError?.message || 'Auto preview gagal dibuat.'
          };
        }

        return {
          name: file.name,
          size: file.size,
          url: uploadResult.url,
          audioPath: uploadResult.audioPath,
          storageStatus: uploadResult.stored ? 'stored' : uploadResult.error ? 'fallback' : 'local',
          storageError: uploadResult.error?.message || '',
          ...previewResult,
          price: ''
        };
      }));

      setAlbumDraft((current) => {
        current.audioFiles.forEach((file) => {
          if (file.url?.startsWith('blob:')) URL.revokeObjectURL(file.url);
          if (file.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(file.previewUrl);
        });
        return {
          ...current,
          audioFiles: uploadedFiles,
          freeTrackIndex: ''
        };
      });

      const failedUploads = uploadedFiles.filter((file) => file.storageStatus === 'fallback');
      if (failedUploads.length) {
        alert(`${failedUploads.length} master audio belum masuk Storage, file lokal dipakai dulu. Cek policy bucket release-audio di Supabase.`);
      }
      const failedPreviews = uploadedFiles.filter((file) => ['auto_fallback', 'auto_failed'].includes(file.previewStatus));
      if (failedPreviews.length) {
        alert(`${failedPreviews.length} preview otomatis belum tersimpan permanen. Kalau auto preview gagal, upload preview manual 30 detik masih bisa dipakai sebagai cadangan.`);
      }
    } catch (error) {
      alert(`Gagal import audio: ${error.message}`);
    } finally {
      clearFileInput(event);
    }
  };

  const updateAlbumTrackPrice = (index, price) => {
    setAlbumDraft((current) => ({
      ...current,
      audioFiles: current.audioFiles.map((file, fileIndex) => (
        fileIndex === index ? { ...file, price } : file
      ))
    }));
  };

  const handleTrackPreviewImport = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSupportedAudioFile(file)) {
      alert('Preview track harus MP3 dulu bro.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicPreviewAudio(file, 'releases/previews', userSession);
      setAlbumDraft((current) => ({
        ...current,
        audioFiles: current.audioFiles.map((trackFile, fileIndex) => {
          if (fileIndex !== index) return trackFile;
          if (trackFile.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(trackFile.previewUrl);
          return {
            ...trackFile,
            previewName: file.name,
            previewUrl: uploadResult.previewUrl,
            previewPath: uploadResult.previewPath,
            previewStatus: uploadResult.stored ? 'manual_stored' : uploadResult.error ? 'manual_fallback' : 'manual_local',
            previewError: uploadResult.error?.message || ''
          };
        })
      }));
      if (uploadResult.error) alert(`Preview belum masuk Storage, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import preview track: ${error.message}`);
    } finally {
      clearFileInput(event);
    }
  };

  const handleMerchImageImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Foto merch harus file gambar ya bro.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'merch/images', userSession);
      setMerchDraft((current) => {
        if (current.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(current.imagePreview);
        return { ...current, imageName: file.name, imagePreview: uploadResult.publicUrl };
      });
      if (uploadResult.error) alert(`Storage gagal, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import foto merch: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handlePaymentProofImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Bukti bayar harus berupa gambar PNG/JPG/WebP ya bro.');
      clearFileInput(event);
      return;
    }
    if (file.size > PAYMENT_PROOF_MAX_SIZE) {
      alert('Ukuran bukti bayar maksimal 2MB dulu bro, biar admin dashboard tetap ringan.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'payment-proofs', userSession);
      setCheckoutDraft((current) => ({
        ...current,
        paymentProofName: file.name,
        paymentProofPreview: uploadResult.publicUrl,
        paymentProofUrl: uploadResult.publicUrl,
        paymentProofPath: uploadResult.path || '',
        paymentProofStatus: uploadResult.stored ? 'stored' : uploadResult.error ? 'fallback' : 'local'
      }));
      if (uploadResult.error) alert(`Bukti bayar belum masuk Storage, preview lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal import bukti bayar: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handlePaymentRequestProofImport = async (payment, event) => {
    const file = event.target.files?.[0];
    if (!file || !payment) return;
    if (!['waiting_admin_confirmation', 'rejected'].includes(payment.status)) {
      alert('Bukti bayar hanya bisa diganti saat status masih waiting atau rejected bro.');
      clearFileInput(event);
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Bukti bayar harus berupa gambar PNG/JPG/WebP ya bro.');
      clearFileInput(event);
      return;
    }
    if (file.size > PAYMENT_PROOF_MAX_SIZE) {
      alert('Ukuran bukti bayar maksimal 2MB dulu bro.');
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'payment-proofs', userSession);
      updatePendingPaymentRecord(payment.id, {
        status: 'waiting_admin_confirmation',
        paymentStatus: 'waiting_admin_confirmation',
        paymentProofName: file.name,
        paymentProofPreview: uploadResult.publicUrl,
        paymentProofUrl: uploadResult.publicUrl,
        paymentProofPath: uploadResult.path || '',
        paymentProofStatus: uploadResult.stored ? 'stored' : uploadResult.error ? 'fallback' : 'local',
        rejectedAt: '',
        rejectedBy: '',
        rejectionReason: ''
      });
      if (uploadResult.error) alert(`Bukti bayar belum masuk Storage, preview lokal dipakai dulu: ${uploadResult.error.message}`);
      else alert('Bukti bayar baru sudah diupload. Status balik ke waiting admin confirm.');
    } catch (error) {
      alert(`Gagal update bukti bayar: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleBandSupportAttachmentImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSupportedFile = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isSupportedFile) {
      alert('Lampiran support bisa gambar screenshot atau PDF dulu ya bro.');
      clearFileInput(event);
      return;
    }
    if (file.size > SUPPORT_ATTACHMENT_MAX_SIZE) {
      alert(`Ukuran lampiran maksimal ${formatFileSize(SUPPORT_ATTACHMENT_MAX_SIZE)} bro.`);
      clearFileInput(event);
      return;
    }

    try {
      const uploadResult = await uploadPublicAsset(file, 'support/attachments', userSession);
      setBandSupportDraft((current) => ({
        ...current,
        attachmentName: file.name,
        attachmentUrl: uploadResult.publicUrl,
        attachmentPath: uploadResult.path || '',
        attachmentType: file.type || '',
        attachmentSize: file.size,
        attachmentStatus: uploadResult.stored ? 'stored' : uploadResult.error ? 'fallback' : 'local'
      }));
      if (uploadResult.error) alert(`Lampiran belum masuk Storage, file lokal dipakai dulu: ${uploadResult.error.message}`);
    } catch (error) {
      alert(`Gagal upload lampiran support: ${error.message}`);
      clearFileInput(event);
    }
  };

  const handleBandProfileSave = (event) => {
    event.preventDefault();
    if (!bandProfile.name.trim()) return alert('Isi nama band dulu bro.');

    setBandProfile((current) => {
      const nextProfile = {
        ...current,
        slug: current.slug || createSlug(current.name),
        isPublished: true
      };
      persistBandProfileLocal(nextProfile);
      publishPublicBandProfile(nextProfile);
      return nextProfile;
    });
    alert('Profil band sudah diperbarui.');
  };

  const updateBandProfileField = (field, value) => {
    setBandProfile((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' && !current.slug ? { slug: createSlug(value) } : {})
    }));
  };

  const buildReleaseAgreementText = (agreement) => [
    `WiSpace Digital Release Agreement (${agreement.agreementVersion})`,
    `Release: ${agreement.releaseTitle}`,
    `Band: ${agreement.bandName}`,
    `Signer: ${agreement.signerName}`,
    `Signer email: ${agreement.signerEmail || '-'}`,
    `Signed at: ${agreement.signedAt}`,
    '',
    'Terms:',
    '1. Band menjamin memiliki hak penuh untuk mengunggah, menjual, dan mendistribusikan MP3 yang dikirim ke WiSpace.',
    '2. Band bertanggung jawab atas klaim plagiarisme, SARA, pelanggaran hak cipta, atau sengketa karya yang timbul dari rilisan ini.',
    '3. Pembagian pendapatan bersih adalah 80% untuk band dan 20% untuk WiSpace.',
    `4. Pencairan saldo diproses setiap tanggal 1 dengan minimum Rp ${MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')}.`,
    '5. Rekening payout yang tercatat dipakai untuk report dan proses pencairan sampai band memperbarui data rekening.'
  ].join('\n');

  const persistReleaseAgreementRecord = (agreement) => {
    const completeAgreement = {
      ...agreement,
      agreementText: agreement.agreementText || buildReleaseAgreementText(agreement)
    };
    setReleaseAgreements((current) => {
      const nextAgreements = [
        completeAgreement,
        ...current.filter((item) => String(item.id) !== String(completeAgreement.id))
      ];
      saveReleaseAgreementLedger(nextAgreements);
      return nextAgreements;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase
        .from('release_agreements')
        .upsert({
          id: completeAgreement.id,
          release_id: completeAgreement.releaseId,
          release_title: completeAgreement.releaseTitle,
          band_user_id: userSession.id,
          band_name: completeAgreement.bandName,
          band_slug: completeAgreement.bandSlug,
          signer_name: completeAgreement.signerName,
          signer_email: completeAgreement.signerEmail || null,
          agreement_version: completeAgreement.agreementVersion,
          agreement_text: completeAgreement.agreementText,
          payout_bank_name: completeAgreement.payoutBankName,
          payout_account_name: completeAgreement.payoutAccountName,
          payout_account_number: completeAgreement.payoutAccountNumber,
          signed_at: completeAgreement.signedAt
        }, { onConflict: 'id' })
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync agreement rilisan ke Supabase:', error.message);
          }
        });
    }
  };

  const handleDownloadAgreementText = (agreement) => {
    const text = agreement.agreementText || buildReleaseAgreementText(agreement);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${createSlug(agreement.releaseTitle || 'wispace-agreement')}-agreement.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildMonthlyFinanceReportText = (report) => [
    `WiSpace Monthly Finance Report - ${report.periodLabel}`,
    `Generated at: ${report.generatedAt}`,
    '',
    `Cash collected (produk + ongkir): Rp ${Number(report.totalCashCollected || report.totalGross || 0).toLocaleString('id-ID')}`,
    `Product gross paid (dasar split 80/20): Rp ${Number(report.totalGross || 0).toLocaleString('id-ID')}`,
    `Shipping collected (pass-through ekspedisi, bukan revenue): Rp ${Number(report.totalShippingCost || 0).toLocaleString('id-ID')}`,
    `WiSpace fee: Rp ${Number(report.totalPlatformFee || 0).toLocaleString('id-ID')}`,
    `Band payout total (produk only): Rp ${Number(report.totalBandNet || 0).toLocaleString('id-ID')}`,
    `Ready payout: Rp ${Number(report.readyPayoutTotal || 0).toLocaleString('id-ID')}`,
    `Transaction count: ${report.transactionCount}`,
    '',
    'Revenue source summary:',
    ...((report.transactionTypeSummary || []).length
      ? report.transactionTypeSummary.map((item) => (
          `- ${item.label}: ${item.count} transaksi / Product gross Rp ${Number(item.grossAmount || 0).toLocaleString('id-ID')} / Shipping pass-through Rp ${Number(item.shippingCost || 0).toLocaleString('id-ID')} / Fee Rp ${Number(item.platformFee || 0).toLocaleString('id-ID')} / Band net Rp ${Number(item.bandNet || 0).toLocaleString('id-ID')}`
        ))
      : ['- Belum ada summary tipe transaksi']),
    '',
    'Band payout rows:',
    ...(report.rows || []).map((row, index) => [
      `${index + 1}. ${row.name}`,
      `   Status: ${row.ready ? 'READY PAYOUT' : 'HOLD - CEK MINIMUM/REKENING'}`,
      `   Product gross: Rp ${Number(row.grossAmount || 0).toLocaleString('id-ID')}`,
      `   Ongkir pass-through: Rp ${Number(row.shippingCost || 0).toLocaleString('id-ID')} (tidak masuk fee/payout)`,
      `   WiSpace fee: Rp ${Number(row.platformFee || 0).toLocaleString('id-ID')}`,
      `   Net band payout: Rp ${Number(row.amount || 0).toLocaleString('id-ID')}`,
      `   Transaksi: ${row.transactions || 0}`,
      `   Rekening: ${row.bankName ? `${row.bankName} / ${row.bankAccountName} / ${row.bankAccountNumber}` : 'BELUM LENGKAP'}`,
      '   Detail transaksi:',
      ...((row.transactionDetails || []).length
        ? row.transactionDetails.map((transaction) => (
            `   - ${transaction.createdAt || transaction.paidAt || '-'} / ${transaction.orderId || '-'} / ${transaction.productType || 'order'} / ${transaction.productTitle || '-'} / Buyer: ${transaction.buyerName || '-'} / Product Rp ${Number(transaction.grossAmount || 0).toLocaleString('id-ID')} / Ongkir pass-through Rp ${Number(transaction.shippingCost || 0).toLocaleString('id-ID')} / Fee Rp ${Number(transaction.platformFee || 0).toLocaleString('id-ID')} / Band net Rp ${Number(transaction.bandNet || 0).toLocaleString('id-ID')}`
          ))
        : ['   - Belum ada detail transaksi'])
    ].join('\n'))
  ].join('\n');

  const handleGenerateMonthlyFinanceReport = () => {
    if (!adminPayoutReportRows.length) {
      alert('Belum ada transaksi paid buat report payout bro.');
      return;
    }

    const report = {
      id: createClientId(),
      periodKey: nextPayoutPeriodKey,
      periodLabel: nextPayoutLabel,
      generatedAt: new Date().toISOString(),
      rows: adminPayoutReportRows,
      totalCashCollected: adminCashCollected,
      totalGross: adminGrossSalesRevenue,
      totalShippingCost: adminMerchShippingCollected,
      totalPlatformFee: adminPlatformRevenue,
      totalBandNet: adminBandPayoutTotal,
      readyPayoutTotal: adminPayoutReadyTotal,
      transactionCount: paidSaleTransactions.length,
      missingBankCount: bandsMissingPayoutAccount.length,
      transactionTypeSummary: [
        {
          label: 'Rilisan digital',
          count: adminDigitalTransactions.length,
          grossAmount: adminDigitalTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0),
          shippingCost: 0,
          platformFee: adminReleaseFeeRevenue,
          bandNet: adminDigitalTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0)
        },
        {
          label: 'Merch fisik',
          count: adminMerchTransactions.length,
          grossAmount: adminMerchProductRevenue,
          shippingCost: adminMerchShippingCollected,
          platformFee: adminMerchFeeRevenue,
          bandNet: adminMerchTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0)
        },
        {
          label: 'Pamflet exclusive',
          count: adminExclusivePosterPaidCount,
          grossAmount: adminExclusivePosterRevenue,
          shippingCost: 0,
          platformFee: adminExclusivePosterRevenue,
          bandNet: 0
        }
      ]
    };
    report.reportText = buildMonthlyFinanceReportText(report);

    setMonthlyFinanceReports((current) => {
      const nextReports = [
        report,
        ...current.filter((item) => item.periodKey !== report.periodKey)
      ];
      saveMonthlyFinanceReports(nextReports);
      return nextReports;
    });

    if (isSupabaseConfigured) {
      const reportRows = report.rows.map((row) => ({
        period_key: report.periodKey,
        band_slug: row.slug,
        band_name: row.name,
        payout_bank_name: row.bankName || null,
        payout_account_name: row.bankAccountName || null,
        payout_account_number: row.bankAccountNumber || null,
        cash_collected: Number(row.grossAmount || 0) + Number(row.shippingCost || 0),
        gross_amount: Number(row.grossAmount || 0),
        shipping_collected: Number(row.shippingCost || 0),
        platform_fee: Number(row.platformFee || 0),
        band_net: Number(row.amount || 0),
        transaction_count: Number(row.transactions || 0),
        payout_status: row.ready ? 'ready_for_payout' : 'hold_review',
        generated_at: report.generatedAt
      }));
      void supabase
        .from('monthly_finance_reports')
        .upsert(reportRows, { onConflict: 'period_key,band_slug' })
        .then(async ({ error }) => {
          if (error && isMissingColumnError(error)) {
            const legacyReportRows = reportRows.map((row) => {
              const legacyRow = { ...row };
              delete legacyRow.cash_collected;
              delete legacyRow.shipping_collected;
              return legacyRow;
            });
            const { error: legacyError } = await supabase
              .from('monthly_finance_reports')
              .upsert(legacyReportRows, { onConflict: 'period_key,band_slug' });
            if (legacyError && !isMissingColumnError(legacyError)) {
              console.warn('Report bulanan tersimpan lokal. Supabase report butuh policy/service-role:', legacyError.message);
            }
            return;
          }
          if (error && !isMissingColumnError(error)) {
            console.warn('Report bulanan tersimpan lokal. Supabase report butuh policy/service-role:', error.message);
          }
        });
    }

    alert(`Report ${report.periodLabel} sudah dibuat. ${report.rows.length} band masuk daftar, ${report.rows.filter((row) => row.ready).length} ready payout.`);
  };

  const handleDownloadMonthlyFinanceReport = (report = latestMonthlyFinanceReport) => {
    if (!report) {
      alert('Belum ada report yang bisa didownload bro. Generate dulu.');
      return;
    }
    const text = report.reportText || buildMonthlyFinanceReportText(report);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wispace-finance-report-${report.periodKey}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAlbumDraftSubmit = (event) => {
    event.preventDefault();
    if (!hasBandPayoutAccount) return alert('Lengkapi nama bank, nama pemegang rekening, dan nomor rekening di Profile Band dulu bro. Ini wajib sebelum upload album atau merch.');
    if (!albumDraft.accepted) return alert('Centang agreement upload album dulu bro.');
    if (!albumDraft.signature.trim()) return alert('Isi nama penanggung jawab / tanda tangan digital dulu bro.');
    if (albumDraft.audioFiles.length === 0) return alert('Import minimal satu file MP3 dulu bro.');
    const masterFallbackTracks = albumDraft.audioFiles.filter((file) => !file.audioPath);
    if (masterFallbackTracks.length) {
      const shouldContinue = window.confirm(`${masterFallbackTracks.length} master audio belum masuk private Storage. Publish tetap lanjut? File lokal/fallback bisa hilang setelah refresh/deploy sampai bucket release-audio siap.`);
      if (!shouldContinue) return;
    }
    const paidTracksWithoutPreview = albumDraft.audioFiles.filter((file, index) => (
      String(index) !== String(albumDraft.freeTrackIndex) && !file.previewUrl
    ));
    if (paidTracksWithoutPreview.length) {
      const shouldContinue = window.confirm(`${paidTracksWithoutPreview.length} track berbayar belum punya preview otomatis 30 detik. Publish tetap lanjut? Preview publik bisa tidak tersedia setelah refresh sampai preview berhasil dibuat atau diupload manual.`);
      if (!shouldContinue) return;
    }

    const albumId = createClientId();
    const nextAlbum = {
      id: albumId,
      title: albumDraft.title,
      price: albumDraft.price,
      description: albumDraft.description,
      coverPreview: albumDraft.coverPreview,
      coverName: albumDraft.coverName,
      trackCount: albumDraft.audioFiles.length,
      releaseType: albumDraft.audioFiles.length === 1 ? 'single' : 'album',
      tracks: albumDraft.audioFiles.map((file, index) => ({
        id: createClientId(),
        title: file.name.replace(/\.mp3$/i, ''),
        fileName: file.name,
        size: file.size,
        url: file.url,
        audioPath: file.audioPath || '',
        previewUrl: file.previewUrl || '',
        previewPath: file.previewPath || '',
        previewName: file.previewName || '',
        price: file.price,
        freeFull: String(index) === String(albumDraft.freeTrackIndex)
      })),
      bandName: bandProfile.name || signatureName || 'Band WiSpace',
      city: bandProfile.city || 'Indonesia',
      genre: bandProfile.genre || 'Indie',
      signedBy: albumDraft.signature
    };

    const publicAlbum = publishPublicRelease(nextAlbum);
    const releaseAgreement = {
      id: createClientId(),
      releaseId: publicAlbum.id,
      releaseTitle: publicAlbum.title,
      bandUserId: userSession?.id || '',
      bandName: publicAlbum.bandName || bandProfile.name || signatureName || 'Band WiSpace',
      bandSlug: publicAlbum.bandSlug || bandProfile.slug || createSlug(publicAlbum.bandName || bandProfile.name || 'band-wispace'),
      signerName: albumDraft.signature.trim(),
      signerEmail: userSession?.email || '',
      agreementVersion: RELEASE_AGREEMENT_VERSION,
      payoutBankName: bandProfile.bankName,
      payoutAccountName: bandProfile.bankAccountName,
      payoutAccountNumber: bandProfile.bankAccountNumber,
      signedAt: new Date().toISOString(),
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };
    persistReleaseAgreementRecord(releaseAgreement);
    setAlbumItems((current) => [
      publicAlbum,
      ...current.filter((item) => String(item.id) !== String(publicAlbum.id))
    ]);
    setAlbumDraft({
      title: '',
      price: '',
      description: '',
      coverName: '',
      coverPreview: '',
      audioFiles: [],
      freeTrackIndex: '',
      signature: albumDraft.signature,
      accepted: false
    });
    setBandProfileTab('album');
    alert('Album sudah tayang di Explore.');
  };

  const handleDeleteAlbum = (album) => {
    const confirmed = window.confirm(`Hapus rilisan "${album.title}" dari etalase band dan Explore?`);
    if (!confirmed) return;

    setAlbumItems((current) => {
      const nextAlbums = current.filter((item) => String(item.id) !== String(album.id));
      savePublicReleaseRegistry(nextAlbums);
      return nextAlbums;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase
        .from('releases')
        .update({ is_active: false, is_published: false, updated_at: new Date().toISOString() })
        .eq('id', album.id)
        .then(async ({ error }) => {
          if (error && isMissingColumnError(error)) {
            const { error: fallbackError } = await supabase
              .from('releases')
              .update({ is_published: false, updated_at: new Date().toISOString() })
              .eq('id', album.id);
            if (fallbackError && !isMissingColumnError(fallbackError)) {
              console.warn('Gagal sync hapus rilisan ke Supabase:', fallbackError.message);
            }
            return;
          }
          if (error) console.warn('Gagal sync hapus rilisan ke Supabase:', error.message);
        });
    }

    alert('Rilisan sudah dihapus dari etalase dan Explore.');
  };

  const handleDeleteAlbumTrack = (album, track) => {
    const confirmed = window.confirm(`Hapus lagu "${track.title}" dari rilisan "${album.title}"?`);
    if (!confirmed) return;

    setAlbumItems((current) => {
      const nextAlbums = current
        .map((item) => {
          if (String(item.id) !== String(album.id)) return item;
          const nextTracks = (item.tracks || []).filter((candidate) => String(candidate.id) !== String(track.id));
          return {
            ...item,
            tracks: nextTracks,
            trackCount: nextTracks.length,
            releaseType: nextTracks.length === 1 ? 'single' : 'album'
          };
        })
        .filter((item) => (item.tracks || []).length > 0);
      savePublicReleaseRegistry(nextAlbums);
      return nextAlbums;
    });

    if (String(activeTrack?.id) === String(track.id)) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setActiveTrack(null);
      setPlayerQueue([]);
    }

    if (isSupabaseConfigured && userSession?.id) {
      void supabase
        .from('release_tracks')
        .update({ is_active: false })
        .eq('id', track.id)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync hapus lagu ke Supabase:', error.message);
          }
        });
    }

    alert('Lagu sudah dihapus. Kalau track terakhir di album dihapus, albumnya ikut hilang dari Explore.');
  };

  const recordBandSale = useCallback((sale) => {
    const { grossAmount, platformFee, bandNet, revenueShare } = calculateRevenueSplit(sale.amount);
    const sellerBandName = sale.sellerBandName || bandProfile.name || signatureName || 'Band WiSpace';
    const sellerBandSlug = sale.sellerBandSlug || bandProfile.slug || createSlug(sellerBandName);
    const sellerBandUserId = sale.sellerBandUserId || sale.bandUserId || '';
    const transactionId = createClientId();
    const nextTransaction = {
      id: transactionId,
      orderId: sale.orderId || `WSP-${transactionId.slice(0, 8).toUpperCase()}`,
      productType: sale.productType || 'release',
      productTitle: sale.productTitle || 'Transaksi WiSpace',
      sellerBandName,
      sellerBandSlug,
      sellerBandUserId,
      buyerUserId: sale.buyerUserId || userSession?.id || '',
      buyerName: sale.buyerName || audienceProfile.displayName || userSession?.email?.split('@')[0] || 'Audience WiSpace',
      buyerEmail: sale.buyerEmail || userSession?.email || '',
      grossAmount,
      platformFee,
      bandNet,
      revenueShare,
      status: sale.status || 'paid_settled',
      paymentStatus: sale.paymentStatus || 'demo_paid',
      paymentMethod: sale.paymentMethod || 'demo_checkout',
      fulfillmentStatus: sale.fulfillmentStatus || (sale.productType === 'merch' ? 'order_paid_waiting_band' : 'library_active'),
      payoutStatus: 'available_next_cycle',
      paidAt: new Date().toISOString(),
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setSaleTransactions((current) => {
      const nextLedger = [nextTransaction, ...current];
      saveTransactionLedger(nextLedger);
      return nextLedger;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase.from('sales_transactions').insert([{
        id: nextTransaction.id,
        order_id: nextTransaction.orderId || null,
        buyer_user_id: nextTransaction.buyerUserId || userSession.id,
        seller_band_user_id: nextTransaction.sellerBandUserId || null,
        seller_band_slug: nextTransaction.sellerBandSlug,
        seller_band_name: nextTransaction.sellerBandName,
        buyer_name: nextTransaction.buyerName,
        buyer_email: nextTransaction.buyerEmail,
        product_type: nextTransaction.productType,
        product_title: nextTransaction.productTitle,
        release_id: sale.releaseId || null,
        track_id: sale.trackId || null,
        merch_item_id: sale.merchItemId || null,
        gross_amount: nextTransaction.grossAmount,
        platform_fee: nextTransaction.platformFee,
        band_net: nextTransaction.bandNet,
        revenue_share: nextTransaction.revenueShare,
        payment_method: nextTransaction.paymentMethod,
        fulfillment_status: nextTransaction.fulfillmentStatus,
        status: nextTransaction.status,
        paid_at: nextTransaction.paidAt
      }]).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync transaksi ke Supabase:', error.message);
        }
      });
    }

    return nextTransaction;
  }, [audienceProfile.displayName, bandProfile.name, bandProfile.slug, signatureName, userSession]);

  const syncAudienceLibraryPurchase = (purchase) => {
    const audienceUserId = purchase.audienceUserId || userSession?.id;
    if (!isSupabaseConfigured || !audienceUserId) return;

    void supabase.from('audience_library').insert([{
      audience_user_id: audienceUserId,
      release_id: purchase.releaseId || null,
      track_id: purchase.trackId || null,
      purchase_type: purchase.purchaseType || 'album',
      access_type: 'encrypted_library',
      redistribution_allowed: false
    }]).then(({ error }) => {
      if (error && !isMissingColumnError(error) && !isDuplicateRowError(error)) {
        console.warn('Gagal sync library audience ke Supabase:', error.message);
      }
    });
  };

  const handlePurchaseAlbum = (album) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli rilisan dan masukin album ke library.');
      return;
    }

    const alreadyOwned = purchasedAlbums.some((item) => item.id === album.id);
    if (alreadyOwned) {
      navigateInternalPage('audience_library');
      return;
    }

    setActiveCheckout({ type: 'album', album, checkoutRef: createCheckoutReference('album'), status: 'pending_payment', startedAt: new Date().toISOString() });
    setCheckoutDraft({
      ...createEmptyCheckoutDraft(),
      buyerName: audienceProfile.displayName || userSession.email?.split('@')[0] || '',
      buyerEmail: userSession.email || ''
    });
  };

  const handlePurchaseTrack = (album, track) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli track dan masukin ke library.');
      return;
    }

    const trackPurchaseId = `${album.id}-${track.id}`;
    const alreadyOwned = purchasedAlbums.some((item) => item.id === trackPurchaseId);
    if (alreadyOwned) {
      navigateInternalPage('audience_library');
      return;
    }

    setActiveCheckout({ type: 'track', album, track, trackPurchaseId, checkoutRef: createCheckoutReference('track'), status: 'pending_payment', startedAt: new Date().toISOString() });
    setCheckoutDraft({
      ...createEmptyCheckoutDraft(),
      buyerName: audienceProfile.displayName || userSession.email?.split('@')[0] || '',
      buyerEmail: userSession.email || ''
    });
  };

  const handlePurchaseMerch = (item) => {
    setSelectedMerchDetail(null);
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli merchandise band.');
      return;
    }
    if (!isMerchPurchasable(item)) {
      const message = item.fulfillmentMode === 'admin_consignment' && item.consignmentStatus !== 'stock_received'
        ? 'Merch titipan ini belum ready di admin WiSpace bro. Tunggu admin terima stok dulu.'
        : 'Stok merch ini lagi kosong bro.';
      alert(message);
      return;
    }

    setCheckoutCourierOptions(MERCH_COURIER_OPTIONS);
    setCheckoutShippingStatus({ loading: false, message: 'Isi kota tujuan lalu cek ongkir.', mode: 'static' });
    setActiveCheckout({ type: 'merch', item: { ...item, stockAvailableAtCheckout: getMerchAvailableStock(item) }, checkoutRef: createCheckoutReference('merch'), status: 'pending_payment', startedAt: new Date().toISOString() });
    setCheckoutDraft({
      ...createEmptyCheckoutDraft(),
      buyerName: audienceProfile.displayName || userSession.email?.split('@')[0] || '',
      buyerEmail: userSession.email || '',
      recipientName: audienceProfile.displayName || userSession.email?.split('@')[0] || '',
      city: audienceProfile.city || ''
    });
  };

  const handleFetchCheckoutShippingRates = async () => {
    if (!activeCheckout || activeCheckout.type !== 'merch') return;
    const destinationCity = checkoutDraft.city.trim();
    if (!destinationCity) {
      setCheckoutShippingStatus({ loading: false, message: 'Isi kota tujuan dulu bro buat cek ongkir.', mode: 'error' });
      return;
    }

    const originShipping = activeCheckout.item?.originShipping || null;
    const originCity = originShipping?.city || originShipping?.province || WISPACE_ADMIN_SHIPPING_ORIGIN.city;
    const destinationDistrict = checkoutDraft.district.trim();
    setCheckoutShippingStatus({ loading: true, message: 'Cek ongkir...', mode: 'loading' });

    try {
      const response = await fetch(SHIPPING_RATES_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originCity,
          originDistrict: originShipping?.district || '',
          destinationCity,
          destinationDistrict,
          weightGram: activeCheckout.item?.weightGram || activeCheckout.item?.weight || 1000,
          origin: originShipping,
          destination: {
            district: destinationDistrict,
            city: destinationCity,
            province: checkoutDraft.province.trim(),
            postalCode: checkoutDraft.postalCode.trim()
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      const nextOptions = Array.isArray(data?.rates)
        ? data.rates.map(normalizeCourierOption).filter((option) => option.label && option.cost > 0)
        : [];

      if (!response.ok || !nextOptions.length) {
        setCheckoutCourierOptions(MERCH_COURIER_OPTIONS);
        const fallbackCourier = getCourierOption(checkoutDraft.courier);
        setCheckoutDraft((current) => ({
          ...current,
          courier: fallbackCourier.label,
          shippingCost: fallbackCourier.cost,
          shippingEstimate: fallbackCourier.estimate
        }));
        setCheckoutShippingStatus({
          loading: false,
          message: data?.message || 'Ongkir API belum kebaca, pakai estimasi manual WiSpace dulu.',
          mode: 'fallback'
        });
        return;
      }

      const selectedOption = nextOptions.find((option) => option.label === checkoutDraft.courier) || nextOptions[0];
      const isManualFallbackRate = data?.mode === 'manual_fallback' || data?.mode === 'provider_fallback' || nextOptions.every((option) => option.source === 'manual_fallback');
      setCheckoutCourierOptions(nextOptions);
      setCheckoutDraft((current) => ({
        ...current,
        courier: selectedOption.label,
        shippingCost: selectedOption.cost,
        shippingEstimate: selectedOption.estimate
      }));
      setCheckoutShippingStatus({
        loading: false,
        message: isManualFallbackRate
          ? `${data?.message || 'Ongkir live belum kebaca. WiSpace pakai estimasi sementara dulu.'} Final ongkir provider bisa menyesuaikan saat live aktif lagi.`
          : 'Ongkir live dari ekspedisi sudah diperbarui.',
        mode: data?.mode || 'api'
      });
    } catch (error) {
      setCheckoutCourierOptions(MERCH_COURIER_OPTIONS);
      setCheckoutShippingStatus({
        loading: false,
        message: error?.message || 'Endpoint ongkir belum bisa dihubungi, pakai estimasi manual dulu.',
        mode: 'fallback'
      });
    }
  };

  const handleCheckoutCancel = () => {
    if (!activeCheckout) return;
    if (activeCheckout.status === 'processing_payment') return;

    if (['waiting_admin_confirmation', 'paid', 'cancelled'].includes(activeCheckout.status)) {
      setActiveCheckout(null);
      return;
    }

    setActiveCheckout({
      ...activeCheckout,
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
  };

  const handleCopyCheckoutReference = async () => {
    if (!activeCheckout?.checkoutRef) return;
    try {
      await navigator.clipboard.writeText(activeCheckout.checkoutRef);
      alert(`Order ID ${activeCheckout.checkoutRef} sudah dicopy.`);
    } catch {
      alert(`Order ID: ${activeCheckout.checkoutRef}`);
    }
  };

  const closeCompletedCheckout = () => {
    if (!activeCheckout) return;
    const targetPage = activeCheckout.type === 'merch' ? 'audience_orders' : 'audience_library';
    setActiveCheckout(null);
    navigateInternalPage(targetPage);
  };

  const getSellerBandEmail = (product = {}, albumContext = null) => {
    const bandSlug = product.bandSlug || albumContext?.bandSlug || '';
    const bandName = product.bandName || albumContext?.bandName || '';
    const bandUserId = product.bandUserId || albumContext?.bandUserId || '';
    const profile = publicBandProfiles.find((item) => (
      (bandSlug && item.slug === bandSlug)
      || (bandName && item.name === bandName)
      || (bandUserId && item.bandUserId === bandUserId)
    ));
    return product.sellerBandEmail || product.bandEmail || albumContext?.sellerBandEmail || albumContext?.bandEmail || profile?.email || '';
  };

  const createCheckoutPendingPayment = (buyerName, buyerEmail) => {
    const product = activeCheckout.type === 'album'
      ? activeCheckout.album
      : activeCheckout.type === 'track'
        ? activeCheckout.track
        : activeCheckout.item;
    const albumContext = activeCheckout.album || null;
    const sellerBandEmail = getSellerBandEmail(product, albumContext);
    const revenueSplit = calculateRevenueSplit(product?.price);
    const selectedCourier = activeCheckout.type === 'merch'
      ? getCourierOption(checkoutDraft.courier, checkoutCourierOptions)
      : null;
    const shippingCost = activeCheckout.type === 'merch'
      ? normalizePriceValue(checkoutDraft.shippingCost || selectedCourier?.cost || 0)
      : 0;
    const paymentAmount = revenueSplit.grossAmount + shippingCost;
    return {
      id: createClientId(),
      checkoutRef: activeCheckout.checkoutRef,
      type: activeCheckout.type,
      buyerUserId: userSession?.id || '',
      buyerName,
      buyerEmail,
      amount: paymentAmount,
      productAmount: revenueSplit.grossAmount,
      shippingCost,
      grossAmount: revenueSplit.grossAmount,
      platformFee: revenueSplit.platformFee,
      bandNet: revenueSplit.bandNet,
      revenueShare: revenueSplit.revenueShare,
      productTitle: product?.title || product?.name || 'Checkout WiSpace',
      sellerBandName: activeCheckout.type === 'track' ? albumContext?.bandName : product?.bandName,
      sellerBandSlug: activeCheckout.type === 'track' ? albumContext?.bandSlug : product?.bandSlug,
      sellerBandUserId: activeCheckout.type === 'track' ? albumContext?.bandUserId : product?.bandUserId,
      sellerBandEmail,
      album: albumContext,
      track: activeCheckout.track || null,
      trackPurchaseId: activeCheckout.trackPurchaseId || '',
      item: activeCheckout.item || null,
      releaseId: activeCheckout.type === 'track' ? albumContext?.id : activeCheckout.album?.id,
      trackId: activeCheckout.track?.id || '',
      merchItemId: activeCheckout.item?.id || '',
      paymentProofName: checkoutDraft.paymentProofName || '',
      paymentProofPreview: checkoutDraft.paymentProofPreview || '',
      paymentProofUrl: checkoutDraft.paymentProofUrl || checkoutDraft.paymentProofPreview || '',
      paymentProofPath: checkoutDraft.paymentProofPath || '',
      paymentProofStatus: checkoutDraft.paymentProofStatus || '',
      shipping: activeCheckout.type === 'merch'
        ? {
            recipientName: checkoutDraft.recipientName.trim(),
            recipientPhone: checkoutDraft.recipientPhone.trim(),
            address: checkoutDraft.address.trim(),
            district: checkoutDraft.district.trim(),
            city: checkoutDraft.city.trim(),
            province: checkoutDraft.province.trim(),
            postalCode: checkoutDraft.postalCode.trim(),
            courier: selectedCourier?.label || checkoutDraft.courier,
            courierCode: selectedCourier?.code || '',
            courierService: selectedCourier?.service || '',
            shippingCost,
            shippingEstimate: checkoutDraft.shippingEstimate || selectedCourier?.estimate || '',
            note: checkoutDraft.note.trim(),
            origin: activeCheckout.item?.originShipping || null,
            destination: {
              address: checkoutDraft.address.trim(),
              district: checkoutDraft.district.trim(),
              city: checkoutDraft.city.trim(),
              province: checkoutDraft.province.trim(),
              postalCode: checkoutDraft.postalCode.trim()
            },
            weightGram: activeCheckout.item?.weightGram || activeCheckout.item?.weight || 1000
          }
        : null,
      status: 'waiting_admin_confirmation',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };
  };

  const requestPaymentGatewaySession = async (payment) => {
    const endpoint = PAYMENT_GATEWAY_API_ENDPOINT || '/api/create-payment';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: PAYMENT_GATEWAY_PROVIDER,
          checkoutRef: payment.checkoutRef,
          paymentType: payment.type,
          productTitle: payment.productTitle,
          amount: Number(payment.amount || 0),
          productAmount: Number(payment.grossAmount || payment.productAmount || payment.amount || 0),
          shippingCost: Number(payment.shipping?.shippingCost || payment.shippingCost || 0),
          buyerName: payment.buyerName,
          buyerEmail: payment.buyerEmail,
          sellerBandName: payment.sellerBandName,
          sellerBandSlug: payment.sellerBandSlug,
          sellerBandEmail: payment.sellerBandEmail
        })
      });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok && Boolean(data?.ok),
        status: response.status,
        data,
        error: data?.error || data?.message || ''
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: {},
        error: error?.message || 'payment_api_unreachable'
      };
    }
  };

  const getMidtransSnapScriptUrl = (checkoutUrl = '') => (
    String(checkoutUrl || '').includes('sandbox.midtrans.com')
      ? 'https://app.sandbox.midtrans.com/snap/snap.js'
      : 'https://app.midtrans.com/snap/snap.js'
  );

  const loadMidtransSnapScript = async (checkoutUrl = '') => {
    if (typeof window === 'undefined') return null;
    if (window.snap?.pay) return window.snap;
    if (!PAYMENT_GATEWAY_CLIENT_KEY) throw new Error('Midtrans client key belum diset di frontend.');

    if (!midtransSnapLoaderRef.current) {
      midtransSnapLoaderRef.current = new Promise((resolve, reject) => {
        const existingScript = document.querySelector('script[data-wispace-midtrans="true"]');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve(window.snap), { once: true });
          existingScript.addEventListener('error', () => reject(new Error('Snap script gagal dimuat.')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = getMidtransSnapScriptUrl(checkoutUrl);
        script.async = true;
        script.dataset.clientKey = PAYMENT_GATEWAY_CLIENT_KEY;
        script.dataset.wispaceMidtrans = 'true';
        script.onload = () => resolve(window.snap);
        script.onerror = () => reject(new Error('Snap script gagal dimuat.'));
        document.body.appendChild(script);
      }).catch((error) => {
        midtransSnapLoaderRef.current = null;
        throw error;
      });
    }

    return midtransSnapLoaderRef.current;
  };

  const handleMidtransPopupPayment = async () => {
    const snapToken = activeCheckout?.providerInvoiceId;
    if (!snapToken) {
      alert('Sesi pembayaran belum siap bro. Coba buat payment sekali lagi.');
      return;
    }

    setMidtransSnapLoading(true);
    try {
      const snap = await loadMidtransSnapScript(activeCheckout?.providerCheckoutUrl || '');
      if (!snap?.pay) throw new Error('Snap Midtrans belum siap.');

      snap.pay(snapToken, {
        onSuccess: (result) => {
          const nextProviderStatus = result?.transaction_status || result?.status_code || 'provider_paid_pending_activation';
          updatePendingPaymentRecord(activeCheckout.pendingPaymentId, {
            providerStatus: nextProviderStatus
          });
          setActiveCheckout((current) => current ? {
            ...current,
            providerStatus: nextProviderStatus,
            successMessage: 'Pembayaran sudah diterima. Status order akan diperbarui otomatis.'
          } : current);
        },
        onPending: (result) => {
          const nextProviderStatus = result?.transaction_status || 'pending';
          updatePendingPaymentRecord(activeCheckout.pendingPaymentId, {
            providerStatus: nextProviderStatus
          });
          setActiveCheckout((current) => current ? {
            ...current,
            providerStatus: nextProviderStatus,
            successMessage: 'Pembayaran masih menunggu penyelesaian.'
          } : current);
        },
        onError: (result) => {
          const nextProviderStatus = result?.transaction_status || result?.status_message || 'gateway_error';
          updatePendingPaymentRecord(activeCheckout.pendingPaymentId, {
            providerStatus: nextProviderStatus
          });
          setActiveCheckout((current) => current ? {
            ...current,
            providerStatus: nextProviderStatus,
            gatewayError: result?.status_message || 'Pembayaran belum bisa diproses.'
          } : current);
          alert(result?.status_message || 'Pembayaran belum bisa diproses bro.');
        },
        onClose: () => {
          setActiveCheckout((current) => current ? { ...current } : current);
        }
      });
    } catch (error) {
      alert(error?.message || 'Jendela pembayaran belum bisa dibuka bro.');
    } finally {
      setMidtransSnapLoading(false);
    }
  };

  const requestOrderNotification = async (payment) => {
    if (!ORDER_NOTIFICATION_API_ENDPOINT || !payment?.checkoutRef) return;
    try {
      const response = await fetch(ORDER_NOTIFICATION_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            checkoutRef: payment.checkoutRef,
            type: payment.type,
            productTitle: payment.productTitle,
            amount: payment.amount,
            productAmount: payment.productAmount || payment.grossAmount,
            shippingCost: payment.shippingCost,
            buyerName: payment.buyerName,
            buyerEmail: payment.buyerEmail,
            sellerBandName: payment.sellerBandName,
            sellerBandSlug: payment.sellerBandSlug,
            sellerBandEmail: payment.sellerBandEmail,
            status: payment.status,
            paymentStatus: payment.paymentStatus || payment.status,
            trackingNumber: payment.trackingNumber,
            shipmentLabelUrl: payment.shipmentLabelUrl,
            shipmentBookingStatus: payment.shipmentBookingStatus,
            shippingPaymentStatus: payment.shippingPaymentStatus,
            provider: payment.provider,
            providerStatus: payment.providerStatus,
            providerCheckoutUrl: payment.providerCheckoutUrl,
            rejectionReason: payment.rejectionReason,
            shipmentMessage: payment.shipmentMessage,
            shipping: payment.shipping || null
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        console.warn('Order notification belum terkirim:', data?.error || data?.message || response.status);
      }
    } catch (error) {
      console.warn('Order notification endpoint belum bisa dihubungi:', error?.message || error);
    }
  };

  const requestPaidOrderNotification = (payment, extra = {}) => requestOrderNotification({
    ...payment,
    ...extra,
    status: 'paid',
    paymentStatus: 'paid',
    providerStatus: payment.providerStatus || 'paid'
  });

  const requestShipmentOrderNotification = (order, updatePayload = {}) => requestOrderNotification({
    checkoutRef: order.orderId || order.checkoutRef || order.id,
    type: 'merch_shipment',
    productTitle: order.itemName || order.productTitle || 'Merch WiSpace',
    amount: Number(order.productAmount || order.itemPrice || order.amount || 0) + Number(order.shippingCost || 0),
    productAmount: order.productAmount || order.itemPrice || order.amount || 0,
    shippingCost: order.shippingCost || 0,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    sellerBandName: order.sellerBandName,
    sellerBandSlug: order.sellerBandSlug,
    sellerBandEmail: order.sellerBandEmail || getSellerBandEmail(order, null),
    status: updatePayload.shipmentBookingStatus || updatePayload.trackingStatus || order.shipmentBookingStatus || order.trackingStatus,
    paymentStatus: updatePayload.shipmentBookingStatus || updatePayload.trackingStatus || order.shipmentBookingStatus || order.trackingStatus,
    trackingNumber: updatePayload.trackingNumber || order.trackingNumber,
    shipmentLabelUrl: updatePayload.shipmentLabelUrl || order.shipmentLabelUrl,
    shipmentBookingStatus: updatePayload.shipmentBookingStatus || order.shipmentBookingStatus,
    shippingPaymentStatus: updatePayload.shippingPaymentStatus || order.shippingPaymentStatus,
    shipping: {
      courier: order.courier,
      city: order.city,
      shippingCost: order.shippingCost
    }
  });

  const requestShipmentBooking = async (order) => {
    if (!SHIPMENT_CREATE_API_ENDPOINT || !order?.orderId) return null;
    try {
      const response = await fetch(SHIPMENT_CREATE_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          merchOrderId: order.id,
          courierCode: order.courierCode,
          courierService: order.courierService || order.courier,
          shippingCost: order.shippingCost,
          weightGram: order.weightGram || 1000,
          origin: order.originShipping || {},
          destination: order.destinationShipping || {
            address: order.address,
            district: order.district,
            city: order.city,
            province: order.province,
            postalCode: order.postalCode
          },
          recipient: {
            name: order.recipientName,
            phone: order.recipientPhone
          },
          item: {
            id: order.merchItemId,
            name: order.itemName,
            sellerBandName: order.sellerBandName
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok && Boolean(data?.ok),
        status: response.status,
        data,
        error: data?.error || data?.message || ''
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: {},
        error: error?.message || 'shipment_api_unreachable'
      };
    }
  };

  const requestShipmentTracking = async (order) => {
    if (!SHIPMENT_TRACK_API_ENDPOINT || !order?.trackingNumber) return null;
    try {
      const response = await fetch(SHIPMENT_TRACK_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          courierCode: order.courierCode || order.courier
        })
      });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok && Boolean(data?.tracking),
        status: response.status,
        data,
        error: data?.error || data?.message || ''
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: {},
        error: error?.message || 'tracking_api_unreachable'
      };
    }
  };

  const markPendingPayment = (payment) => {
    setPendingPayments((current) => {
      const nextPayments = [
        payment,
        ...current.filter((item) => item.checkoutRef !== payment.checkoutRef)
      ];
      savePendingPayments(nextPayments);
      return nextPayments;
    });

    if (isSupabaseConfigured && userSession?.id) {
      const paymentRequestRow = {
        id: payment.id,
        checkout_ref: payment.checkoutRef,
        buyer_user_id: payment.buyerUserId || userSession.id,
        buyer_name: payment.buyerName,
        buyer_email: payment.buyerEmail,
        seller_band_user_id: payment.sellerBandUserId || null,
        seller_band_slug: payment.sellerBandSlug || null,
        seller_band_name: payment.sellerBandName || null,
        payment_type: payment.type,
        product_title: payment.productTitle,
        amount: Number(payment.amount || 0),
        product_amount: Number(payment.grossAmount || payment.productAmount || payment.amount || 0),
        shipping_cost: Number(payment.shipping?.shippingCost || payment.shippingCost || 0),
        status: payment.status || 'waiting_admin_confirmation',
        proof_file_name: payment.paymentProofName || null,
        proof_url: payment.paymentProofUrl || payment.paymentProofPreview || null,
        proof_storage_path: payment.paymentProofPath || null,
        proof_status: payment.paymentProofStatus || null,
        provider_invoice_id: payment.providerInvoiceId || null,
        provider_checkout_url: payment.providerCheckoutUrl || null,
        provider_status: payment.providerStatus || null,
        payload: payment,
        submitted_at: payment.submittedAt || new Date().toISOString()
      };
      void supabase.from('payment_requests').upsert([paymentRequestRow], { onConflict: 'checkout_ref' }).then(async ({ error }) => {
        if (error && isMissingColumnError(error)) {
          const legacyPaymentRequestRow = { ...paymentRequestRow };
          delete legacyPaymentRequestRow.product_amount;
          delete legacyPaymentRequestRow.shipping_cost;
          delete legacyPaymentRequestRow.provider_invoice_id;
          delete legacyPaymentRequestRow.provider_checkout_url;
          delete legacyPaymentRequestRow.provider_status;
          const { error: legacyError } = await supabase.from('payment_requests').upsert([legacyPaymentRequestRow], { onConflict: 'checkout_ref' });
          if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync payment request ke Supabase:', legacyError.message);
          return;
        }
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync payment request ke Supabase:', error.message);
        }
      });
    }
  };

  const updatePendingPaymentRecord = (paymentId, updates) => {
    const paymentSnapshot = pendingPayments.find((payment) => payment.id === paymentId) || null;
    const updatedPaymentSnapshot = paymentSnapshot ? { ...paymentSnapshot, ...updates } : null;
    setPendingPayments((current) => {
      const nextPayments = current.map((payment) => (
        payment.id === paymentId ? { ...payment, ...updates } : payment
      ));
      savePendingPayments(nextPayments);
      return nextPayments;
    });

    if (isSupabaseConfigured) {
      const updateRow = { updated_at: new Date().toISOString() };
      if (updates.status || updates.paymentStatus) updateRow.status = updates.status || updates.paymentStatus;
      if (Object.hasOwn(updates, 'confirmedAt')) updateRow.confirmed_at = updates.confirmedAt || null;
      if (Object.hasOwn(updates, 'confirmedBy')) updateRow.confirmed_by = updates.confirmedBy || null;
      if (Object.hasOwn(updates, 'rejectedAt')) updateRow.rejected_at = updates.rejectedAt || null;
      if (Object.hasOwn(updates, 'rejectedBy')) updateRow.rejected_by = updates.rejectedBy || null;
      if (Object.hasOwn(updates, 'rejectionReason')) updateRow.rejection_reason = updates.rejectionReason || null;
      if (Object.hasOwn(updates, 'paymentProofName')) updateRow.proof_file_name = updates.paymentProofName || null;
      if (Object.hasOwn(updates, 'paymentProofUrl') || Object.hasOwn(updates, 'paymentProofPreview')) updateRow.proof_url = updates.paymentProofUrl || updates.paymentProofPreview || null;
      if (Object.hasOwn(updates, 'paymentProofPath')) updateRow.proof_storage_path = updates.paymentProofPath || null;
      if (Object.hasOwn(updates, 'paymentProofStatus')) updateRow.proof_status = updates.paymentProofStatus || null;
      if (Object.hasOwn(updates, 'providerInvoiceId')) updateRow.provider_invoice_id = updates.providerInvoiceId || null;
      if (Object.hasOwn(updates, 'providerCheckoutUrl')) updateRow.provider_checkout_url = updates.providerCheckoutUrl || null;
      if (Object.hasOwn(updates, 'providerStatus')) updateRow.provider_status = updates.providerStatus || null;
      if (updatedPaymentSnapshot) updateRow.payload = updatedPaymentSnapshot;

      void supabase.from('payment_requests').update(updateRow).eq('id', paymentId).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Payment request status belum bisa diupdate client-side. Gunakan service role/webhook untuk produksi:', error.message);
        }
      });
    }
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!activeCheckout || !userSession) return;
    if (['processing_payment', 'waiting_admin_confirmation', 'paid', 'cancelled'].includes(activeCheckout.status)) return;

    const buyerName = checkoutDraft.buyerName.trim() || audienceProfile.displayName || userSession.email?.split('@')[0] || 'Audience WiSpace';
    const buyerEmail = checkoutDraft.buyerEmail.trim() || userSession.email || '';

    if (activeCheckout.type === 'merch') {
      const latestMerchItem = publicMerchList.find((item) => String(item.id) === String(activeCheckout.item?.id)) || activeCheckout.item;
      if (!isMerchPurchasable(latestMerchItem)) {
        alert('Stok merch ini sudah tidak tersedia bro. Checkout dibatalkan dulu biar tidak oversell.');
        setActiveCheckout(null);
        return;
      }
      const requiredFields = [
        checkoutDraft.recipientName,
        checkoutDraft.recipientPhone,
        checkoutDraft.address,
        checkoutDraft.district,
        checkoutDraft.city,
        checkoutDraft.province,
        checkoutDraft.postalCode
      ];
      if (requiredFields.some((field) => !field.trim())) {
        alert('Lengkapi data penerima, nomor HP, alamat, kecamatan, kota, provinsi, dan kode pos dulu bro.');
        return;
      }
      if (checkoutShippingStatus.mode === 'stale') {
        alert('Kota tujuan berubah bro. Klik cek ongkir dulu sebelum lanjut bayar.');
        return;
      }
    }
    if (PAYMENT_GATEWAY_PROVIDER === 'manual' && !checkoutDraft.paymentProofPreview && !checkoutDraft.paymentProofUrl) {
      alert('Upload bukti bayar dulu bro sebelum kirim request konfirmasi payment.');
      return;
    }

    const pendingPaymentBase = createCheckoutPendingPayment(buyerName, buyerEmail);
    setActiveCheckout((current) => current ? {
      ...current,
      status: 'processing_payment',
      paymentStatus: 'processing_payment'
    } : current);

    const gatewayResult = await requestPaymentGatewaySession(pendingPaymentBase);
    const gatewayData = gatewayResult.data || {};
    const providerCheckoutUrl = gatewayData.providerCheckoutUrl || gatewayData.provider_checkout_url || gatewayData.checkoutUrl || gatewayData.invoiceUrl || '';
    const providerInvoiceId = gatewayData.providerInvoiceId || gatewayData.provider_invoice_id || gatewayData.invoiceId || gatewayData.transactionId || '';
    const providerStatus = gatewayData.providerStatus || gatewayData.provider_status || (providerCheckoutUrl ? 'gateway_ready' : PAYMENT_GATEWAY_PROVIDER === 'manual' ? 'manual_fallback' : 'manual_fallback');
    const gatewayErrorMessage = gatewayResult.ok
      ? ''
      : [
          gatewayData.error || gatewayResult.error || 'gateway_unavailable',
          gatewayData.missingEnv ? `missing ${gatewayData.missingEnv}` : '',
          gatewayData.message || ''
        ].filter(Boolean).join(' / ');
    const pendingPayment = {
      ...pendingPaymentBase,
      provider: gatewayData.provider || PAYMENT_GATEWAY_PROVIDER || 'manual',
      providerStatus,
      providerInvoiceId,
      providerCheckoutUrl,
      gatewayStatusCode: gatewayResult.status,
      gatewayError: gatewayErrorMessage,
      manualFallback: gatewayData.manualFallback !== false || !providerCheckoutUrl
    };
    const checkoutMessage = providerCheckoutUrl
      ? `Order ${pendingPayment.checkoutRef} siap dibayar via gateway. Akses/order aktif setelah payment confirmed.`
      : gatewayErrorMessage
        ? `Gateway belum siap: ${gatewayErrorMessage}. Order ${pendingPayment.checkoutRef} masuk fallback manual dulu.`
        : `Order ${pendingPayment.checkoutRef} masuk antrean admin lewat fallback manual. Akses/order aktif setelah admin confirm paid.`;

    markPendingPayment(pendingPayment);
    void requestOrderNotification(pendingPayment);
    setActiveCheckout((current) => current ? {
      ...current,
      status: 'waiting_admin_confirmation',
      pendingPaymentId: pendingPayment.id,
      paymentStatus: 'waiting_admin_confirmation',
      provider: pendingPayment.provider,
      providerStatus: pendingPayment.providerStatus,
      providerInvoiceId: pendingPayment.providerInvoiceId,
      providerCheckoutUrl: pendingPayment.providerCheckoutUrl,
      gatewayError: pendingPayment.gatewayError,
      manualFallback: pendingPayment.manualFallback,
      successMessage: checkoutMessage
    } : current);
  };

  const handleConfirmPendingPayment = (payment) => {
    if (!payment) return;
    const currentPayment = pendingPayments.find((item) => item.id === payment.id || item.checkoutRef === payment.checkoutRef);
    const effectivePaymentStatus = currentPayment?.status || payment.status;
    const canActivatePayment = ['waiting_admin_confirmation', 'provider_paid_pending_activation'].includes(effectivePaymentStatus || 'waiting_admin_confirmation');
    if (effectivePaymentStatus && !canActivatePayment) {
      alert(`Payment request ini sudah ${effectivePaymentStatus.replaceAll('_', ' ')} bro.`);
      return;
    }
    if (!payment.paymentProofPreview && !payment.paymentProofUrl && effectivePaymentStatus !== 'provider_paid_pending_activation') {
      setSelectedPaymentDetail(payment);
      alert('Bukti bayar belum ada bro. Cek detail request dulu, jangan confirm paid sebelum ada proof.');
      return;
    }
    const confirmed = window.confirm(`Confirm paid untuk ${payment.productTitle} / ${payment.buyerName}?`);
    if (!confirmed) return;

    if (payment.type === 'album') {
      const album = payment.album;
      const buyerAccount = { id: payment.buyerUserId || userSession?.id || '', email: payment.buyerEmail || '' };
      const isCurrentBuyer = !payment.buyerUserId || payment.buyerUserId === userSession?.id;
      const buyerLibrary = isCurrentBuyer
        ? purchasedAlbums
        : (loadUserScopedData(AUDIENCE_LIBRARY_STORAGE_PREFIX, buyerAccount) || []);
      const alreadyOwned = buyerLibrary.some((item) => item.id === album.id);
      const libraryItem = {
        ...album,
        purchaseType: 'album',
        purchasedAt: 'Baru saja',
        paymentStatus: 'paid',
        accessType: 'encrypted_library'
      };
      if (!alreadyOwned && isCurrentBuyer) {
        setPurchasedAlbums((current) => {
          const nextLibrary = [libraryItem, ...current];
          persistAudienceLibraryLocal(nextLibrary);
          return nextLibrary;
        });
      } else if (!alreadyOwned) {
        persistAudienceLibraryLocal([libraryItem, ...buyerLibrary], buyerAccount);
      }
      if (!alreadyOwned) {
        syncAudienceLibraryPurchase({ audienceUserId: payment.buyerUserId, purchaseType: 'album', releaseId: album.id });
      }
      recordBandSale({
        productType: 'album',
        productTitle: album.title,
        amount: album.price,
        sellerBandName: album.bandName,
        sellerBandSlug: album.bandSlug || createSlug(album.bandName || ''),
        sellerBandUserId: album.bandUserId || '',
        releaseId: album.id,
        orderId: payment.checkoutRef,
        fulfillmentStatus: 'library_active',
        buyerName: payment.buyerName,
        buyerEmail: payment.buyerEmail,
        buyerUserId: payment.buyerUserId,
        paymentStatus: 'paid',
        paymentMethod: effectivePaymentStatus === 'provider_paid_pending_activation' ? 'provider_paid_admin_activated' : 'admin_confirmed_manual'
      });
      updatePendingPaymentRecord(payment.id, {
        status: 'paid',
        paymentStatus: 'paid',
        confirmedAt: new Date().toISOString(),
        confirmedBy: userSession?.email || 'admin_wsu'
      });
      void requestPaidOrderNotification(payment, {
        productTitle: album.title,
        sellerBandName: album.bandName,
        sellerBandSlug: album.bandSlug || createSlug(album.bandName || ''),
        sellerBandUserId: album.bandUserId || '',
        sellerBandEmail: payment.sellerBandEmail || getSellerBandEmail(album, album)
      });
      setActiveCheckout((current) => current?.pendingPaymentId === payment.id ? {
        ...current,
        status: 'paid',
        paymentStatus: 'paid',
        fulfillmentStatus: 'library_active',
        paidAt: new Date().toISOString(),
        successMessage: `${album.title} masuk Library. Akses sudah aktif.`
      } : current);
      return;
    }

    if (payment.type === 'track') {
      const { album, track, trackPurchaseId } = payment;
      const buyerAccount = { id: payment.buyerUserId || userSession?.id || '', email: payment.buyerEmail || '' };
      const isCurrentBuyer = !payment.buyerUserId || payment.buyerUserId === userSession?.id;
      const buyerLibrary = isCurrentBuyer
        ? purchasedAlbums
        : (loadUserScopedData(AUDIENCE_LIBRARY_STORAGE_PREFIX, buyerAccount) || []);
      const alreadyOwned = buyerLibrary.some((item) => item.id === trackPurchaseId);
      const libraryItem = {
        ...album,
        id: trackPurchaseId,
        title: track.title,
        price: track.price,
        trackCount: 1,
        purchaseType: 'track',
        parentAlbumTitle: album.title,
        tracks: [track],
        purchasedAt: 'Baru saja',
        paymentStatus: 'paid',
        accessType: 'encrypted_library'
      };
      if (!alreadyOwned && isCurrentBuyer) {
        setPurchasedAlbums((current) => {
          const nextLibrary = [libraryItem, ...current];
          persistAudienceLibraryLocal(nextLibrary);
          return nextLibrary;
        });
      } else if (!alreadyOwned) {
        persistAudienceLibraryLocal([libraryItem, ...buyerLibrary], buyerAccount);
      }
      if (!alreadyOwned) {
        syncAudienceLibraryPurchase({ audienceUserId: payment.buyerUserId, purchaseType: 'track', releaseId: album.id, trackId: track.id });
      }
      recordBandSale({
        productType: 'track',
        productTitle: track.title,
        amount: track.price,
        sellerBandName: album.bandName,
        sellerBandSlug: album.bandSlug || createSlug(album.bandName || ''),
        sellerBandUserId: album.bandUserId || '',
        releaseId: album.id,
        trackId: track.id,
        orderId: payment.checkoutRef,
        fulfillmentStatus: 'library_active',
        buyerName: payment.buyerName,
        buyerEmail: payment.buyerEmail,
        buyerUserId: payment.buyerUserId,
        paymentStatus: 'paid',
        paymentMethod: effectivePaymentStatus === 'provider_paid_pending_activation' ? 'provider_paid_admin_activated' : 'admin_confirmed_manual'
      });
      updatePendingPaymentRecord(payment.id, {
        status: 'paid',
        paymentStatus: 'paid',
        confirmedAt: new Date().toISOString(),
        confirmedBy: userSession?.email || 'admin_wsu'
      });
      void requestPaidOrderNotification(payment, {
        productTitle: track.title,
        sellerBandName: album.bandName,
        sellerBandSlug: album.bandSlug || createSlug(album.bandName || ''),
        sellerBandUserId: album.bandUserId || '',
        sellerBandEmail: payment.sellerBandEmail || getSellerBandEmail(track, album)
      });
      setActiveCheckout((current) => current?.pendingPaymentId === payment.id ? {
        ...current,
        status: 'paid',
        paymentStatus: 'paid',
        fulfillmentStatus: 'library_active',
        paidAt: new Date().toISOString(),
        successMessage: `${track.title} masuk Library sebagai track. Akses sudah aktif.`
      } : current);
      return;
    }

    if (payment.type === 'merch') {
      const item = publicMerchList.find((merch) => String(merch.id) === String(payment.item?.id)) || payment.item;
      if (!isMerchPurchasable(item)) {
        alert('Stok merch ini sudah kosong atau belum ready di admin. Jangan confirm paid dulu bro, reject/request refund manual dulu.');
        return;
      }
      const merchFulfillmentStatus = item.fulfillmentMode === 'admin_consignment'
        ? 'order_paid_waiting_admin'
        : 'order_paid_waiting_band';
      const sale = recordBandSale({
        productType: 'merch',
        productTitle: item.name,
        amount: item.price,
        sellerBandName: item.bandName,
        sellerBandSlug: item.bandSlug || createSlug(item.bandName || ''),
        sellerBandUserId: item.bandUserId || '',
        merchItemId: item.id,
        orderId: payment.checkoutRef,
        fulfillmentStatus: merchFulfillmentStatus,
        buyerName: payment.buyerName,
        buyerEmail: payment.buyerEmail,
        buyerUserId: payment.buyerUserId,
        paymentStatus: 'paid',
        paymentMethod: effectivePaymentStatus === 'provider_paid_pending_activation' ? 'provider_paid_admin_activated' : 'admin_confirmed_manual'
      });
      const nextOrder = {
        id: createClientId(),
        transactionId: sale.id,
        orderId: sale.orderId,
        merchItemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        productAmount: item.price,
        sellerBandName: item.bandName || 'Band WiSpace',
        sellerBandSlug: item.bandSlug || createSlug(item.bandName || 'band-wispace'),
        sellerBandUserId: item.bandUserId || '',
        sellerBandEmail: payment.sellerBandEmail || getSellerBandEmail(item, null),
        buyerUserId: payment.buyerUserId || userSession?.id || '',
        buyerName: payment.buyerName,
        buyerEmail: payment.buyerEmail,
        recipientName: payment.shipping?.recipientName || '',
        recipientPhone: payment.shipping?.recipientPhone || '',
        address: payment.shipping?.address || '',
        district: payment.shipping?.district || payment.shipping?.destination?.district || '',
        city: payment.shipping?.city || '',
        province: payment.shipping?.province || payment.shipping?.destination?.province || '',
        postalCode: payment.shipping?.postalCode || '',
        originShipping: payment.shipping?.origin || item.originShipping || null,
        destinationShipping: payment.shipping?.destination || null,
        weightGram: payment.shipping?.weightGram || item.weightGram || 1000,
        fulfillmentMode: item.fulfillmentMode || 'band_ship',
        consignmentStatus: item.consignmentStatus || '',
        courier: payment.shipping?.courier || 'JNE REG',
        courierCode: payment.shipping?.courierCode || getCourierOption(payment.shipping?.courier).code,
        courierService: payment.shipping?.courierService || getCourierOption(payment.shipping?.courier).service,
        shippingCost: normalizePriceValue(payment.shipping?.shippingCost || payment.shippingCost || 0),
        shippingEstimate: payment.shipping?.shippingEstimate || getCourierOption(payment.shipping?.courier).estimate,
        note: payment.shipping?.note || '',
        trackingNumber: '',
        trackingStatus: merchFulfillmentStatus,
        shipmentProvider: '',
        shipmentId: '',
        shipmentLabelUrl: '',
        shipmentBookingStatus: 'shipment_booking_pending',
        shippingPaymentStatus: 'shipping_fee_held_by_wispace',
        createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      };

      setMerchOrders((current) => {
        const nextOrders = [nextOrder, ...current];
        saveMerchOrders(nextOrders);
        return nextOrders;
      });
      setMerchItems((current) => {
        const nextItems = current.map((merch) => (
          String(merch.id) === String(item.id)
            ? {
                ...merch,
                stock: Math.max(0, normalizePriceValue(merch.stock) - 1),
                adminStockOnHand: merch.fulfillmentMode === 'admin_consignment'
                  ? Math.max(0, normalizePriceValue(merch.adminStockOnHand) - 1)
                  : merch.adminStockOnHand
              }
            : merch
        ));
        persistBandMerchLocal(nextItems);
        return nextItems;
      });
      setPublicMerchItems((current) => {
        const nextItems = current.map((merch) => (
          String(merch.id) === String(item.id)
            ? {
                ...merch,
                stock: Math.max(0, normalizePriceValue(merch.stock) - 1),
                adminStockOnHand: merch.fulfillmentMode === 'admin_consignment'
                  ? Math.max(0, normalizePriceValue(merch.adminStockOnHand) - 1)
                  : merch.adminStockOnHand
              }
            : merch
        ));
        savePublicMerchRegistry(nextItems);
        return nextItems;
      });

      if (isSupabaseConfigured && userSession?.id) {
        const merchOrderRow = {
          id: nextOrder.id,
          transaction_id: sale.id,
          order_id: nextOrder.orderId || null,
          buyer_user_id: payment.buyerUserId || userSession.id,
          seller_band_user_id: item.bandUserId || null,
          merch_item_id: item.id,
          quantity: 1,
          shipping_recipient: nextOrder.recipientName,
          shipping_phone: nextOrder.recipientPhone,
          shipping_address: nextOrder.address,
          shipping_district: nextOrder.district,
          shipping_city: nextOrder.city,
          shipping_province: nextOrder.province,
          shipping_postal_code: nextOrder.postalCode,
          courier_code: nextOrder.courierCode || nextOrder.courier.split(' ')[0],
          courier_service: nextOrder.courier,
          shipping_cost: nextOrder.shippingCost || 0,
          origin_shipping: nextOrder.originShipping || null,
          destination_shipping: nextOrder.destinationShipping || null,
          weight_gram: normalizePriceValue(nextOrder.weightGram || 1000) || 1000,
          fulfillment_mode: nextOrder.fulfillmentMode || 'band_ship',
          consignment_status: nextOrder.consignmentStatus || '',
          shipment_provider: nextOrder.shipmentProvider || null,
          shipment_id: nextOrder.shipmentId || null,
          shipment_label_url: nextOrder.shipmentLabelUrl || null,
          shipment_booking_status: nextOrder.shipmentBookingStatus || null,
          shipping_payment_status: nextOrder.shippingPaymentStatus || null,
          tracking_status: nextOrder.trackingStatus
        };
        void supabase.from('merch_orders').insert([merchOrderRow]).then(async ({ error }) => {
          if (error && isMissingColumnError(error)) {
            const legacyMerchOrderRow = { ...merchOrderRow };
            delete legacyMerchOrderRow.origin_shipping;
            delete legacyMerchOrderRow.destination_shipping;
            delete legacyMerchOrderRow.fulfillment_mode;
            delete legacyMerchOrderRow.consignment_status;
            delete legacyMerchOrderRow.shipping_cost;
            delete legacyMerchOrderRow.shipping_district;
            delete legacyMerchOrderRow.shipping_province;
            delete legacyMerchOrderRow.weight_gram;
            delete legacyMerchOrderRow.shipment_provider;
            delete legacyMerchOrderRow.shipment_id;
            delete legacyMerchOrderRow.shipment_label_url;
            delete legacyMerchOrderRow.shipment_booking_status;
            delete legacyMerchOrderRow.shipping_payment_status;
            const { error: legacyError } = await supabase.from('merch_orders').insert([legacyMerchOrderRow]);
            if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync order merch ke Supabase:', legacyError.message);
            return;
          }
          if (error) {
            console.warn('Gagal sync order merch ke Supabase:', error.message);
          }
        });
        const merchStockUpdateRow = {
          stock: Math.max(0, normalizePriceValue(item.stock) - 1),
          admin_stock_on_hand: item.fulfillmentMode === 'admin_consignment'
            ? Math.max(0, normalizePriceValue(item.adminStockOnHand) - 1)
            : normalizePriceValue(item.adminStockOnHand || 0),
          updated_at: new Date().toISOString()
        };
        void supabase.from('merch_items').update(merchStockUpdateRow).eq('id', item.id).then(async ({ error }) => {
          if (error && isMissingColumnError(error)) {
            const legacyMerchStockUpdateRow = { ...merchStockUpdateRow };
            delete legacyMerchStockUpdateRow.admin_stock_on_hand;
            const { error: legacyError } = await supabase.from('merch_items').update(legacyMerchStockUpdateRow).eq('id', item.id);
            if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync stok merch:', legacyError.message);
            return;
          }
          if (error) console.warn('Gagal sync stok merch:', error.message);
        });
      }

      updatePendingPaymentRecord(payment.id, {
        status: 'paid',
        paymentStatus: 'paid',
        confirmedAt: new Date().toISOString(),
        confirmedBy: userSession?.email || 'admin_wsu'
      });
      void requestPaidOrderNotification(payment, {
        productTitle: item.name,
        sellerBandName: item.bandName,
        sellerBandSlug: item.bandSlug || createSlug(item.bandName || ''),
        sellerBandUserId: item.bandUserId || '',
        sellerBandEmail: payment.sellerBandEmail || getSellerBandEmail(item, null)
      });
      void syncShipmentBookingForOrder(nextOrder);
      setActiveCheckout((current) => current?.pendingPaymentId === payment.id ? {
        ...current,
        status: 'paid',
        paymentStatus: 'paid',
        fulfillmentStatus: merchFulfillmentStatus,
        paidAt: new Date().toISOString(),
        successMessage: item.fulfillmentMode === 'admin_consignment'
          ? `${item.name} masuk order merch. WiSpace akan proses pengiriman dari stok titipan.`
          : `${item.name} masuk order merch. Band akan proses pengiriman.`
      } : current);
    }
  };

  const handleRejectPendingPayment = (payment) => {
    if (!payment) return;
    if (payment.status && payment.status !== 'waiting_admin_confirmation') {
      alert(`Payment request ini sudah ${payment.status.replaceAll('_', ' ')} bro.`);
      return;
    }
    const reason = window.prompt(`Alasan reject payment ${payment.checkoutRef}?`, 'Bukti bayar belum sesuai / nominal belum cocok.');
    if (!reason || !reason.trim()) {
      alert('Alasan reject wajib diisi bro, biar buyer tahu harus revisi apa.');
      return;
    }
    updatePendingPaymentRecord(payment.id, {
      status: 'rejected',
      paymentStatus: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: userSession?.email || 'admin_wsu',
      rejectionReason: reason.trim()
    });
    void requestOrderNotification({
      ...payment,
      status: 'rejected',
      paymentStatus: 'rejected',
      rejectionReason: reason.trim()
    });
    setActiveCheckout((current) => current?.pendingPaymentId === payment.id ? {
      ...current,
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    } : current);
  };

  const updateMerchOrderLocal = (orderId, updatePayload) => {
    setMerchOrders((current) => {
      const nextOrders = current.map((order) => (
        String(order.id) === String(orderId) ? { ...order, ...updatePayload } : order
      ));
      saveMerchOrders(nextOrders);
      return nextOrders;
    });
    setSelectedMerchOrderDetail((current) => (
      current && String(current.id) === String(orderId) ? { ...current, ...updatePayload } : current
    ));
  };

  const updateMerchTransactionFulfillmentLocal = (transactionId, fulfillmentStatus) => {
    if (!transactionId) return;

    setSaleTransactions((current) => {
      const nextTransactions = current.map((transaction) => (
        String(transaction.id) === String(transactionId) ? { ...transaction, fulfillmentStatus } : transaction
      ));
      saveTransactionLedger(nextTransactions);
      return nextTransactions;
    });
  };

  const updateMerchTransactionResolutionLocal = (transactionId, nextStatus) => {
    if (!transactionId) return;

    setSaleTransactions((current) => {
      const nextTransactions = current.map((transaction) => {
        if (String(transaction.id) !== String(transactionId)) return transaction;
        const isRefunded = nextStatus === 'refunded';
        const isCancelled = nextStatus === 'cancelled';
        if (!isRefunded && !isCancelled) return { ...transaction, fulfillmentStatus: nextStatus };
        return {
          ...transaction,
          fulfillmentStatus: nextStatus,
          status: isRefunded ? 'refunded' : 'cancelled',
          paymentStatus: isRefunded ? 'refunded' : 'cancelled',
          payoutStatus: isRefunded ? 'refunded' : 'cancelled'
        };
      });
      saveTransactionLedger(nextTransactions);
      return nextTransactions;
    });
  };

  const restoreMerchStockForOrder = (order) => {
    if (!order?.merchItemId) return false;

    let restoredFromPublic = false;
    const restoreItemStock = (merch) => {
      if (String(merch.id) !== String(order.merchItemId)) return merch;
      restoredFromPublic = true;
      return {
        ...merch,
        stock: normalizePriceValue(merch.stock) + 1,
        adminStockOnHand: merch.fulfillmentMode === 'admin_consignment'
          ? normalizePriceValue(merch.adminStockOnHand) + 1
          : merch.adminStockOnHand
      };
    };

    setPublicMerchItems((current) => {
      const nextItems = current.map(restoreItemStock);
      savePublicMerchRegistry(nextItems);
      return nextItems;
    });

    setMerchItems((current) => {
      let restoredLocally = false;
      const nextItems = current.map((merch) => {
        if (String(merch.id) !== String(order.merchItemId)) return merch;
        restoredLocally = true;
        return {
          ...merch,
          stock: normalizePriceValue(merch.stock) + 1,
          adminStockOnHand: merch.fulfillmentMode === 'admin_consignment'
            ? normalizePriceValue(merch.adminStockOnHand) + 1
            : merch.adminStockOnHand
        };
      });
      if (restoredLocally) persistBandMerchLocal(nextItems);
      return nextItems;
    });

    const publicItem = publicMerchList.find((item) => String(item.id) === String(order.merchItemId));
    if (isSupabaseConfigured && publicItem?.id) {
      const restoredStock = normalizePriceValue(publicItem.stock) + 1;
      const restoredAdminStock = publicItem.fulfillmentMode === 'admin_consignment'
        ? normalizePriceValue(publicItem.adminStockOnHand) + 1
        : normalizePriceValue(publicItem.adminStockOnHand || 0);
      const stockUpdateRow = {
        stock: restoredStock,
        admin_stock_on_hand: restoredAdminStock,
        updated_at: new Date().toISOString()
      };
      void supabase.from('merch_items').update(stockUpdateRow).eq('id', publicItem.id).then(async ({ error }) => {
        if (error && isMissingColumnError(error)) {
          const legacyStockUpdateRow = { ...stockUpdateRow };
          delete legacyStockUpdateRow.admin_stock_on_hand;
          const { error: legacyError } = await supabase.from('merch_items').update(legacyStockUpdateRow).eq('id', publicItem.id);
          if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal restore stok merch:', legacyError.message);
          return;
        }
        if (error) console.warn('Gagal restore stok merch:', error.message);
      });
    }

    return restoredFromPublic;
  };

  const syncMerchOrderUpdate = (order, updatePayload) => {
    if (!isSupabaseConfigured || !userSession?.id) return;

    const merchOrderUpdateRow = {
      tracking_status: updatePayload.trackingStatus || order.trackingStatus,
      tracking_number: updatePayload.trackingNumber ?? order.trackingNumber ?? null,
      stock_restored: updatePayload.stockRestored ?? order.stockRestored ?? false,
      stock_restored_at: updatePayload.stockRestoredAt || order.stockRestoredAt || null,
      refund_requested_at: updatePayload.refundRequestedAt || order.refundRequestedAt || null,
      cancelled_at: updatePayload.cancelledAt || order.cancelledAt || null,
      refunded_at: updatePayload.refundedAt || order.refundedAt || null,
      resolved_at: updatePayload.resolvedAt || order.resolvedAt || null,
      shipment_provider: updatePayload.shipmentProvider ?? order.shipmentProvider ?? null,
      shipment_id: updatePayload.shipmentId ?? order.shipmentId ?? null,
      shipment_label_url: updatePayload.shipmentLabelUrl ?? order.shipmentLabelUrl ?? null,
      shipment_booking_status: updatePayload.shipmentBookingStatus ?? order.shipmentBookingStatus ?? null,
      shipping_payment_status: updatePayload.shippingPaymentStatus ?? order.shippingPaymentStatus ?? null,
      updated_at: new Date().toISOString()
    };
    void supabase
      .from('merch_orders')
      .update(merchOrderUpdateRow)
      .eq('id', order.id)
      .then(async ({ error }) => {
        if (error && isMissingColumnError(error)) {
          const legacyMerchOrderUpdateRow = {
            tracking_status: merchOrderUpdateRow.tracking_status,
            tracking_number: merchOrderUpdateRow.tracking_number,
            updated_at: merchOrderUpdateRow.updated_at
          };
          const { error: legacyError } = await supabase
            .from('merch_orders')
            .update(legacyMerchOrderUpdateRow)
            .eq('id', order.id);
          if (legacyError && !isMissingColumnError(legacyError)) {
            console.warn('Gagal sync status order merch ke Supabase:', legacyError.message);
          }
          return;
        }
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync status order merch ke Supabase:', error.message);
        }
      });

    if (order.transactionId) {
      const nextTrackingStatus = updatePayload.trackingStatus || order.trackingStatus;
      const transactionUpdateRow = {
        fulfillment_status: nextTrackingStatus
      };
      if (STOCK_RESTORE_ORDER_STATUSES.includes(nextTrackingStatus)) {
        transactionUpdateRow.status = nextTrackingStatus === 'refunded' ? 'refunded' : 'cancelled';
        transactionUpdateRow.payout_status = nextTrackingStatus === 'refunded' ? 'refunded' : 'cancelled';
      }
      void supabase
        .from('sales_transactions')
        .update(transactionUpdateRow)
        .eq('id', order.transactionId)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync fulfillment transaksi merch:', error.message);
          }
        });
    }
  };

  const syncShipmentBookingForOrder = async (order, { notify = false } = {}) => {
    if (!order?.id) return;
    if (shipmentBookingOrderId && String(shipmentBookingOrderId) === String(order.id)) return;
    setShipmentBookingOrderId(order.id);
    try {
      const bookingResult = await requestShipmentBooking(order);
      if (!bookingResult) return;
      const shipment = bookingResult.data?.shipment || {};
      const hasTrackingNumber = Boolean(shipment.trackingNumber);
      const updatePayload = {
        shipmentProvider: shipment.provider || bookingResult.data?.provider || order.shipmentProvider || '',
        shipmentId: shipment.shipmentId || order.shipmentId || '',
        shipmentLabelUrl: shipment.labelUrl || order.shipmentLabelUrl || '',
        shipmentBookingStatus: shipment.bookingStatus || (bookingResult.ok ? 'shipment_booking_ready' : 'shipment_booking_failed'),
        shippingPaymentStatus: shipment.paymentStatus || 'shipping_fee_held_by_wispace',
        trackingNumber: shipment.trackingNumber || order.trackingNumber || '',
        trackingStatus: hasTrackingNumber ? 'ready_to_ship' : order.trackingStatus,
        shipmentMessage: bookingResult.data?.message || bookingResult.error || ''
      };
      updateMerchOrderLocal(order.id, updatePayload);
      if (hasTrackingNumber) updateMerchTransactionFulfillmentLocal(order.transactionId, 'ready_to_ship');
      syncMerchOrderUpdate(order, updatePayload);
      if (updatePayload.shipmentBookingStatus === 'shipment_booking_ready' || updatePayload.shipmentLabelUrl || updatePayload.trackingNumber || updatePayload.shipmentBookingStatus === 'shipment_booking_failed') {
        void requestShipmentOrderNotification(order, updatePayload);
      }
      if (notify) {
        alert(hasTrackingNumber
          ? 'Shipment berhasil dibooking. Resi/label sudah masuk.'
          : updatePayload.shipmentMessage || 'Shipment belum otomatis. Ongkir tetap ditahan WiSpace dan label masih manual.'
        );
      }
    } finally {
      setShipmentBookingOrderId('');
    }
  };

  const syncShipmentTrackingForOrder = async (order, { notify = false } = {}) => {
    if (!order?.id || !order?.trackingNumber) {
      if (notify) alert('Resi belum ada bro. Input nomor resi dulu baru tracking bisa dicek.');
      return;
    }
    if (shipmentTrackingOrderId && String(shipmentTrackingOrderId) === String(order.id)) return;
    setShipmentTrackingOrderId(order.id);
    try {
      const trackingResult = await requestShipmentTracking(order);
      if (!trackingResult?.data?.tracking) {
        if (notify) alert(trackingResult?.error || 'Tracking belum bisa dibaca dari provider.');
        return;
      }
      const tracking = trackingResult.data.tracking || {};
      const updatePayload = {
        trackingProviderStatus: tracking.status || '',
        trackingProviderLabel: tracking.statusLabel || '',
        trackingProviderSummary: tracking.summary || trackingResult.data.message || '',
        trackingEvents: Array.isArray(tracking.events) ? tracking.events : [],
        trackingLastCheckedAt: new Date().toISOString(),
        trackingSource: tracking.source || trackingResult.data.provider || ''
      };
      updateMerchOrderLocal(order.id, updatePayload);
      if (notify) {
        alert(updatePayload.trackingProviderLabel
          ? `Tracking update: ${updatePayload.trackingProviderLabel}`
          : 'Tracking berhasil dicek bro.'
        );
      }
    } finally {
      setShipmentTrackingOrderId('');
    }
  };

  const handleMerchOrderStatusUpdate = (order, nextStatus) => {
    if (!order) return;
    if (order.trackingStatus === nextStatus) return;
    if (['cancelled', 'refunded'].includes(order.trackingStatus)) {
      alert('Order ini sudah final cancelled/refunded bro. Status tidak diubah lagi biar stok dan ledger nggak dobel.');
      return;
    }
    if (order.trackingStatus === 'completed' && !['refund_requested', 'refunded'].includes(nextStatus)) {
      alert('Order ini sudah selesai. Kalau ada masalah setelah selesai, pakai review refund dulu bro.');
      return;
    }
    if (['cancelled', 'refund_requested', 'refunded'].includes(nextStatus)) {
      const confirmMessage = nextStatus === 'cancelled'
        ? 'Cancel order ini bro? Pastikan admin/band sudah komunikasi dengan buyer.'
        : nextStatus === 'refund_requested'
          ? 'Tandai order ini butuh review refund bro?'
          : 'Tandai order ini sudah refunded bro?';
      if (!window.confirm(confirmMessage)) return;
    }
    const shouldRestoreStock = STOCK_RESTORE_ORDER_STATUSES.includes(nextStatus);
    const needsStockRestore = shouldRestoreStock && !order.stockRestored;
    const stockWasRestored = needsStockRestore ? restoreMerchStockForOrder(order) : Boolean(order.stockRestored);
    if (needsStockRestore && !stockWasRestored) {
      alert('Status order tetap diupdate, tapi item merch tidak ketemu untuk restore stok. Cek data merch manual ya bro.');
    }
    const resolutionTimestamp = new Date().toISOString();
    const updatePayload = {
      trackingStatus: nextStatus,
      ...(shouldRestoreStock ? {
        stockRestored: stockWasRestored,
        stockRestoredAt: order.stockRestoredAt || (stockWasRestored ? resolutionTimestamp : ''),
        resolvedAt: resolutionTimestamp
      } : {}),
      ...(nextStatus === 'cancelled' ? { cancelledAt: resolutionTimestamp } : {}),
      ...(nextStatus === 'refunded' ? { refundedAt: resolutionTimestamp } : {}),
      ...(nextStatus === 'refund_requested' ? { refundRequestedAt: resolutionTimestamp } : {})
    };
    updateMerchOrderLocal(order.id, updatePayload);
    if (shouldRestoreStock) {
      updateMerchTransactionResolutionLocal(order.transactionId, nextStatus);
    } else {
      updateMerchTransactionFulfillmentLocal(order.transactionId, nextStatus);
    }
    syncMerchOrderUpdate(order, updatePayload);
    void requestShipmentOrderNotification(order, updatePayload);
  };

  const handleMerchTrackingNumberUpdate = (order) => {
    const trackingNumber = window.prompt(`Nomor resi untuk order ${order.orderId || order.id}:`, order.trackingNumber || '');
    if (trackingNumber === null) return;

    const cleanTrackingNumber = trackingNumber.trim();
    const updatePayload = {
      trackingNumber: cleanTrackingNumber,
      trackingStatus: cleanTrackingNumber ? 'shipped' : order.trackingStatus
    };
    updateMerchOrderLocal(order.id, updatePayload);
    updateMerchTransactionFulfillmentLocal(order.transactionId, updatePayload.trackingStatus);
    syncMerchOrderUpdate(order, updatePayload);
    void requestShipmentOrderNotification(order, updatePayload);
  };

  const handleMerchDraftSubmit = (event) => {
    event.preventDefault();
    if (!hasBandPayoutAccount) return alert('Lengkapi data rekening payout di Profile Band dulu bro sebelum upload merch.');
    if (!merchUsesAdminConsignment && !hasBandShippingOrigin) return alert(`Lengkapi data asal pengiriman di Profile Band dulu bro: ${bandShippingOriginMissingFields.join(', ')}.`);
    if (!normalizePriceValue(merchDraft.weightGram)) return alert('Isi berat merch dalam gram dulu bro. Ini dipakai buat hitung ongkir.');
    const nextItem = {
      id: createClientId(),
      ...merchDraft,
    };

    const publicItem = publishPublicMerch(nextItem);
    setMerchItems((current) => {
      const nextItems = [
        publicItem,
        ...current.filter((item) => String(item.id) !== String(publicItem.id))
      ];
      persistBandMerchLocal(nextItems);
      return nextItems;
    });
    setMerchDraft({
      name: '',
      price: '',
      stock: '',
      weightGram: '500',
      fulfillmentMode: 'band_ship',
      description: '',
      imageName: '',
      imagePreview: ''
    });
    alert('Merch sudah masuk etalase band.');
  };

  const handleDeleteMerch = (item) => {
    const confirmed = window.confirm(`Hapus merch "${item.name}" dari etalase band dan Explore?`);
    if (!confirmed) return;

    setMerchItems((current) => {
      const nextItems = current.filter((merch) => String(merch.id) !== String(item.id));
      persistBandMerchLocal(nextItems);
      return nextItems;
    });
    setPublicMerchItems((current) => {
      const nextPublicItems = current.filter((merch) => String(merch.id) !== String(item.id));
      savePublicMerchRegistry(nextPublicItems);
      return nextPublicItems;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase
        .from('merch_items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync hapus merch ke Supabase:', error.message);
          }
        });
    }

    alert('Merch sudah dihapus dari etalase dan Explore.');
  };

  const handleAdminConsignmentStatusUpdate = (item, nextStatus) => {
    const nextLabel = nextStatus === 'stock_received' ? 'STOK READY DI ADMIN WISPACE' : 'STOK DI ADMIN WISPACE';
    let nextAdminStockOnHand = nextStatus === 'stock_received'
      ? normalizePriceValue(item.adminStockOnHand || item.stock || 0)
      : 0;

    if (nextStatus === 'stock_received') {
      const stockInput = window.prompt(`Total stok "${item.name}" yang sudah ada di admin:`, String(nextAdminStockOnHand || item.stock || ''));
      if (stockInput === null) return;
      nextAdminStockOnHand = normalizePriceValue(stockInput);
      if (!nextAdminStockOnHand) {
        alert('Isi jumlah stok admin lebih dari 0 dulu bro.');
        return;
      }
    }

    const nextPatch = {
      consignmentStatus: nextStatus,
      fulfillmentLabel: nextLabel,
      adminStockOnHand: nextAdminStockOnHand,
      updatedAt: new Date().toISOString()
    };

    setPublicMerchItems((current) => {
      const nextItems = current.map((merch) => (
        String(merch.id) === String(item.id) ? { ...merch, ...nextPatch } : merch
      ));
      savePublicMerchRegistry(nextItems);
      return nextItems;
    });
    setMerchItems((current) => {
      const nextItems = current.map((merch) => (
        String(merch.id) === String(item.id) ? { ...merch, ...nextPatch } : merch
      ));
      if (item.bandUserId === userSession?.id) persistBandMerchLocal(nextItems);
      return nextItems;
    });

    if (isSupabaseConfigured && userSession?.id) {
      const merchUpdateRow = {
        consignment_status: nextStatus,
        fulfillment_label: nextLabel,
        admin_stock_on_hand: nextAdminStockOnHand,
        updated_at: new Date().toISOString()
      };
      void supabase
        .from('merch_items')
        .update(merchUpdateRow)
        .eq('id', item.id)
        .then(async ({ error }) => {
          if (error && isMissingColumnError(error)) {
            const { error: legacyError } = await supabase
              .from('merch_items')
              .update({ updated_at: merchUpdateRow.updated_at })
              .eq('id', item.id);
            if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync status stok merch:', legacyError.message);
            return;
          }
          if (error) console.warn('Gagal sync status stok merch:', error.message);
        });
    }

    alert(nextStatus === 'stock_received'
      ? `${item.name} ditandai stok sudah ada di admin: ${nextAdminStockOnHand} unit.`
      : `${item.name} dikembalikan ke status menunggu stok.`);
  };

  const openAdminMessageForMerch = (item) => {
    setAdminMessageDraft({
      targetBandSlug: item.bandSlug || createSlug(item.bandName || ''),
      category: 'merch',
      subject: `Update stok merch ${item.name}`,
      body: `Halo ${item.bandName || 'Band WiSpace'}, untuk merch "${item.name}" silahkan konfirmasi pengiriman stok ke admin WiSpace.`
    });
    setAdminActiveSection('messages');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArticleSubmit = (event) => {
    event.preventDefault();
    if (!articleDraft.title.trim()) return alert('Isi judul artikel dulu bro.');
    if (!articleDraft.excerpt.trim()) return alert('Isi ringkasan artikel dulu bro.');

    const nextArticle = {
      id: createClientId(),
      ...articleDraft,
      bandName: bandProfile.name || signatureName || 'Band WiSpace',
      category: articleDraft.category || 'Update Band',
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    const publicArticle = publishPublicArticle(nextArticle);
    setArticleItems((current) => {
      const nextItems = [
        publicArticle,
        ...current.filter((article) => String(article.id) !== String(publicArticle.id))
      ];
      persistBandArticlesLocal(nextItems);
      return nextItems;
    });
    setArticleDraft({ title: '', category: '', excerpt: '', body: '' });
    setBandProfileTab('artikel');
    alert('Artikel sudah tayang di halaman artikel.');
  };

  const handleAdminArticleSubmit = (event) => {
    event.preventDefault();
    if (!adminArticleDraft.title.trim()) return alert('Isi judul artikel admin dulu bro.');
    if (!adminArticleDraft.excerpt.trim()) return alert('Isi ringkasan artikel admin dulu bro.');

    const nextArticle = {
      id: createClientId(),
      ...adminArticleDraft,
      bandName: 'WiSpace Editorial',
      bandSlug: 'wispace-editorial',
      category: adminArticleDraft.category || 'WiSpace Update',
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    publishPublicArticle(nextArticle);
    setAdminArticleDraft({ title: '', category: '', excerpt: '', body: '' });
    alert('Artikel admin sudah tayang.');
  };

  const handleWispacePickSubmit = async (event) => {
    event.preventDefault();
    const nextPick = saveWispacePick({
      ...wispacePickDraft,
      contentLabel: WISPACE_PICK_LABEL_OPTIONS.includes(String(wispacePickDraft.contentLabel || '').toUpperCase())
        ? String(wispacePickDraft.contentLabel).toUpperCase()
        : createEmptyWispacePick().contentLabel,
      youtubeUrl: wispacePickDraft.youtubeUrl.trim(),
      title: wispacePickDraft.title.trim() || 'WiSpace Video Review',
      bandName: wispacePickDraft.bandName.trim() || 'WiSpace',
      review: wispacePickDraft.review.trim() || createEmptyWispacePick().review,
      thumbnail: wispacePickDraft.thumbnail.trim()
    });
    setWispacePickDraft(nextPick);

    if (isSupabaseConfigured && isCloudAdmin) {
      const { error } = await supabase
        .from('wispace_picks')
        .upsert(mapWispacePickToRow(nextPick, userSession?.id), { onConflict: 'id' });
      if (error && isMissingColumnError(error)) {
        alert('WiSpace Pick tersimpan, tapi sinkron cloud belum aktif.');
        return;
      }
      if (error) {
        alert('WiSpace Pick tersimpan, tapi sinkron cloud lagi bermasalah.');
        return;
      }
    }

    alert(nextPick.youtubeUrl ? 'WiSpace Pick sudah diperbarui.' : 'WiSpace Pick kembali ke mode random.');
  };

  const handleWispacePickClear = async () => {
    const nextPick = saveWispacePick(createEmptyWispacePick());
    setWispacePickDraft(nextPick);

    if (isSupabaseConfigured && isCloudAdmin) {
      const { error } = await supabase
        .from('wispace_picks')
        .upsert(mapWispacePickToRow(nextPick, userSession?.id), { onConflict: 'id' });
      if (error && !isMissingColumnError(error)) {
        alert('WiSpace Pick direset, tapi sinkron cloud lagi bermasalah.');
        return;
      }
    }

    alert('WiSpace Pick kembali ke mode random.');
  };

  const handleArticleCommentSubmit = (event, article) => {
    event.preventDefault();
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Login atau join dulu buat komentar di artikel.');
      return;
    }

    const commentText = (articleCommentDrafts[article.id] || '').trim();
    if (!commentText) return alert('Isi komentar dulu bro.');

    const author = userRole === 'musisi'
      ? (bandProfile.name || signatureName || 'Band WiSpace')
      : (audienceProfile.displayName || userSession.email?.split('@')[0] || 'Audience WiSpace');
    const nextComment = {
      id: createClientId(),
      author,
      body: commentText,
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setArticleComments((current) => {
      const nextComments = {
        ...current,
        [article.id]: [nextComment, ...(current[article.id] || [])]
      };
      saveArticleComments(nextComments);
      return nextComments;
    });
    setArticleCommentDrafts((current) => ({ ...current, [article.id]: '' }));

    if (isSupabaseConfigured && userSession?.id) {
      void supabase.from('article_comments').insert([{
        id: nextComment.id,
        article_id: article.id,
        author_user_id: userSession.id,
        author_name: author,
        body: commentText
      }]).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync komentar artikel ke Supabase:', error.message);
        }
      });
    }
  };

  const createContentReport = (payload) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Login atau join dulu buat kirim laporan.');
      return;
    }

    const reason = window.prompt('Alasan laporan? Tulis: plagiat, SARA, scam, spam, atau lainnya.', 'plagiat');
    if (!reason?.trim()) return;

    const nextReport = {
      id: createClientId(),
      type: payload.type || 'content',
      targetId: payload.targetId || '',
      title: payload.title || 'Konten WiSpace',
      reason: reason.trim(),
      status: 'open',
      reporterName: userRole === 'musisi'
        ? (bandProfile.name || signatureName || 'Band WiSpace')
        : (audienceProfile.displayName || userSession.email?.split('@')[0] || 'Audience WiSpace'),
      reporterEmail: userSession.email || '',
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setContentReports((current) => {
      const nextReports = [nextReport, ...current];
      saveContentReports(nextReports);
      return nextReports;
    });

    if (isSupabaseConfigured && userSession?.id) {
      void supabase.from('content_reports').insert([{
        id: nextReport.id,
        reporter_user_id: userSession.id,
        reporter_name: nextReport.reporterName,
        reporter_email: nextReport.reporterEmail,
        content_type: nextReport.type,
        target_id: nextReport.targetId,
        title: nextReport.title,
        reason: nextReport.reason,
        status: nextReport.status
      }]).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync laporan konten ke Supabase:', error.message);
        }
      });
    }
    alert('Laporan sudah dikirim.');
  };

  const handleResolveContentReport = (reportId) => {
    setContentReports((current) => {
      const nextReports = current.map((report) => (
        String(report.id) === String(reportId) ? { ...report, status: 'resolved' } : report
      ));
      saveContentReports(nextReports);
      return nextReports;
    });
  };

  const handleRemoveArticle = (article) => {
    const confirmed = window.confirm(`Remove artikel "${article.title}" dari WiSpace?`);
    if (!confirmed) return;

    setArticleItems((current) => {
      const nextArticles = current.filter((item) => String(item.id) !== String(article.id));
      persistBandArticlesLocal(nextArticles);
      return nextArticles;
    });
    setPublicArticleItems((current) => {
      const nextArticles = current.filter((item) => String(item.id) !== String(article.id));
      savePublicArticleRegistry(nextArticles);
      return nextArticles;
    });

    if (isSupabaseConfigured) {
      void supabase
        .from('band_articles')
        .update({ is_published: false, updated_at: new Date().toISOString() })
        .eq('id', article.id)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal remove artikel di Supabase:', error.message);
          }
        });
    }
  };

  const handleRemoveArticleComment = (articleId, commentId) => {
    const confirmed = window.confirm('Remove komentar ini dari artikel?');
    if (!confirmed) return;

    setArticleComments((current) => {
      const nextComments = {
        ...current,
        [articleId]: (current[articleId] || []).filter((comment) => String(comment.id) !== String(commentId))
      };
      saveArticleComments(nextComments);
      return nextComments;
    });

    if (isSupabaseConfigured) {
      void supabase
        .from('article_comments')
        .delete()
        .eq('id', commentId)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal remove komentar di Supabase:', error.message);
          }
        });
    }
  };

  const syncMessageToCloud = (message) => {
    if (!isSupabaseConfigured || !userSession?.id) return;

    const row = {
      sender_user_id: userSession.id,
      sender_name: message.sender || userSession.email || 'WiSpace User',
      sender_contact: message.contact || userSession.email || '',
      subject: message.subject || 'Pesan WiSpace',
      body: message.body || '',
      category: message.category || 'lainnya',
      scope: message.scope || 'band',
      source: message.source || (isBandAccount ? 'band' : 'audience'),
      target_band_slug: message.targetBandSlug || null,
      target_band_name: message.targetBandName || null,
      is_read: Boolean(message.read),
      replied: Boolean(message.replied),
      last_reply: message.lastReply || null,
      parent_message_id: isUuidLike(message.parentMessageId) ? message.parentMessageId : null,
      attachment_name: message.attachmentName || null,
      attachment_url: message.attachmentUrl || null,
      attachment_path: message.attachmentPath || null,
      attachment_type: message.attachmentType || null,
      attachment_size: normalizePriceValue(message.attachmentSize || 0),
      attachment_status: message.attachmentStatus || null
    };

    void supabase
      .from('wispace_messages')
      .insert([row])
      .then(async ({ error }) => {
        if (error && isMissingColumnError(error)) {
          const legacyRow = { ...row };
          delete legacyRow.attachment_name;
          delete legacyRow.attachment_url;
          delete legacyRow.attachment_path;
          delete legacyRow.attachment_type;
          delete legacyRow.attachment_size;
          delete legacyRow.attachment_status;
          const { error: legacyError } = await supabase.from('wispace_messages').insert([legacyRow]);
          if (legacyError && !isMissingColumnError(legacyError)) console.warn('Gagal sync message ke Supabase:', legacyError.message);
          return;
        }
        if (error) {
          console.warn('Gagal sync message ke Supabase:', error.message);
        }
      });
  };

  const syncMessageReplyToCloud = (message, replyText) => {
    if (!isSupabaseConfigured || !userSession?.id || !isUuidLike(message?.id)) return;

    void supabase
      .from('wispace_messages')
      .update({
        is_read: true,
        replied: true,
        last_reply: replyText,
        updated_at: new Date().toISOString()
      })
      .eq('id', message.id)
      .then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync reply message ke Supabase:', error.message);
        }
      });
  };

  const handleMessageSubmit = (event) => {
    event.preventDefault();
    const nextMessage = {
      id: createClientId(),
      ...messageDraft,
      scope: 'band',
      source: isBandAccount ? 'band' : 'audience',
      targetBandSlug: currentBandSlug,
      targetBandName: selectedPublicBandProfile?.name || bandProfile.name || signatureName || 'Band WiSpace',
      read: false,
      createdAt: 'Baru saja'
    };

    setMessages((current) => {
      const nextMessages = [nextMessage, ...current];
      saveMessageLedger(nextMessages);
      return nextMessages;
    });
    syncMessageToCloud(nextMessage);
    setMessageDraft({ sender: '', contact: '', subject: '', body: '' });
    alert('Pesan terkirim ke inbox band.');
  };

  const handleAdminMessageSubmit = (event) => {
    event.preventDefault();
    if (!adminMessageDraft.subject.trim() || !adminMessageDraft.body.trim()) {
      alert('Subject dan isi pesan admin wajib diisi bro.');
      return;
    }

    const targetProfile = adminMessageDraft.targetBandSlug === 'all'
      ? null
      : publicBandList.find((profile) => (profile.slug || createSlug(profile.name)) === adminMessageDraft.targetBandSlug);
    const nextMessage = {
      id: createClientId(),
      sender: 'Admin WiSpace',
      contact: 'admin@wispace.my.id',
      subject: adminMessageDraft.subject.trim(),
      body: adminMessageDraft.body.trim(),
      category: adminMessageDraft.category,
      scope: 'band',
      source: 'admin',
      targetBandSlug: adminMessageDraft.targetBandSlug,
      targetBandName: targetProfile?.name || (adminMessageDraft.targetBandSlug === 'all' ? 'Semua Band' : 'Band WiSpace'),
      read: false,
      createdAt: 'Baru saja'
    };

    setMessages((current) => {
      const nextMessages = [nextMessage, ...current];
      saveMessageLedger(nextMessages);
      return nextMessages;
    });
    syncMessageToCloud(nextMessage);
    setAdminMessageDraft({ targetBandSlug: 'all', category: 'payment', subject: '', body: '' });
    alert(`Pesan admin terkirim ke ${nextMessage.targetBandName}.`);
  };

  const handleBandSupportSubmit = (event) => {
    event.preventDefault();
    if (!bandSupportDraft.subject.trim() || !bandSupportDraft.body.trim()) {
      alert('Subject dan isi pesan ke admin wajib diisi bro.');
      return;
    }

    const bandName = bandProfile.name || signatureName || 'Band WiSpace';
    const nextMessage = {
      id: createClientId(),
      sender: bandName,
      contact: bandProfile.email || bandProfile.cp || userSession?.email || '-',
      subject: bandSupportDraft.subject.trim(),
      body: bandSupportDraft.body.trim(),
      category: bandSupportDraft.category,
      attachmentName: bandSupportDraft.attachmentName,
      attachmentUrl: bandSupportDraft.attachmentUrl,
      attachmentPath: bandSupportDraft.attachmentPath,
      attachmentType: bandSupportDraft.attachmentType,
      attachmentSize: bandSupportDraft.attachmentSize,
      attachmentStatus: bandSupportDraft.attachmentStatus,
      scope: 'admin',
      source: 'band',
      targetBandSlug: getBandProfileSlug(bandProfile) || createSlug(bandName),
      targetBandName: bandName,
      read: false,
      createdAt: 'Baru saja'
    };

    setMessages((current) => {
      const nextMessages = [nextMessage, ...current];
      saveMessageLedger(nextMessages);
      return nextMessages;
    });
    syncMessageToCloud(nextMessage);
    setBandSupportDraft({
      category: 'payment',
      subject: '',
      body: '',
      attachmentName: '',
      attachmentUrl: '',
      attachmentPath: '',
      attachmentType: '',
      attachmentSize: 0,
      attachmentStatus: ''
    });
    alert('Pesan ke admin WiSpace sudah masuk antrean support.');
  };

  const markMessagesAsRead = () => {
    const cloudMessageIds = visibleMessages
      .filter((message) => !message.read && isUuidLike(message.id) && message.targetBandSlug && message.targetBandSlug !== 'all')
      .map((message) => message.id);

    setMessages((current) => {
      const nextMessages = current.map((message) => (
        isBandAccount || message.scope === 'audience' ? { ...message, read: true } : message
      ));
      saveMessageLedger(nextMessages);
      return nextMessages;
    });

    if (isSupabaseConfigured && userSession?.id && cloudMessageIds.length) {
      void supabase
        .from('wispace_messages')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .in('id', cloudMessageIds)
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn('Gagal sync read message ke Supabase:', error.message);
          }
        });
    }
  };

  const handleReplySubmit = (event, message) => {
    event.preventDefault();
    if (!replyDraft.trim()) return alert('Isi balasan dulu bro.');

    const replyText = replyDraft.trim();
    const adminReplyMessage = message.source === 'admin' ? {
      id: createClientId(),
      sender: bandProfile.name || signatureName || 'Band WiSpace',
      contact: bandProfile.email || bandProfile.cp || userSession?.email || '-',
      subject: `Reply: ${message.subject}`,
      body: replyText,
      category: message.category || 'lainnya',
      scope: 'admin',
      source: 'band',
      targetBandSlug: currentBandSlug,
      targetBandName: bandProfile.name || signatureName || 'Band WiSpace',
      parentMessageId: isUuidLike(message.id) ? message.id : '',
      read: false,
      createdAt: 'Baru saja'
    } : null;

    setMessages((current) => {
      const updated = current.map((item) => (
        item.id === message.id ? { ...item, read: true, replied: true, lastReply: replyText } : item
      ));
      const nextMessages = adminReplyMessage ? [adminReplyMessage, ...updated] : updated;
      saveMessageLedger(nextMessages);
      return nextMessages;
    });
    syncMessageReplyToCloud(message, replyText);
    if (adminReplyMessage) syncMessageToCloud(adminReplyMessage);
    setReplyDraft('');
    setActiveReplyId(null);
    alert(`Balasan ke ${message.sender} tersimpan${message.source === 'admin' ? ' dan masuk inbox admin' : ''}.`);
  };

  // PLAYER SYSTEM
  const resolvePlayableTrack = async (track) => {
    if (!track) return null;
    if (track.audioPath && (track.isOwned || track.freeFull)) {
      try {
        const signedUrl = await createSignedAudioUrl(track.audioPath);
        if (signedUrl) return { ...track, url: signedUrl, signedAt: new Date().toISOString() };
      } catch (error) {
        console.warn('Gagal bikin signed audio URL:', error.message);
        if (!track.url) throw error;
      }
    }
    if (!track.isOwned && !track.freeFull && track.previewUrl) {
      return { ...track, url: track.previewUrl };
    }
    return track.url ? track : null;
  };

  const handlePlayTrack = async (track, queue = []) => {
    let playableTrack = null;
    try {
      playableTrack = await resolvePlayableTrack(track);
    } catch (error) {
      alert(`Akses audio private belum bisa dibuka: ${error.message}`);
      return;
    }

    if (!playableTrack?.url) {
      alert('File audio belum tersedia buat preview bro.');
      return;
    }

    window.clearTimeout(audioPreviewTimerRef.current);

    const nextQueue = queue.length ? queue : (playerQueue.length ? playerQueue : [track]);
    const nextQueueIndex = Math.max(0, nextQueue.findIndex((item) => item.id === playableTrack.id));

    if (activeTrack?.id === playableTrack.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => alert(`Audio belum bisa diputar: ${error.message}`));
      return;
    }

    audioRef.current.src = playableTrack.url;
    audioRef.current.currentTime = 0;
    setPlayerCurrentTime(0);
    setPlayerDuration(0);
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        setIsPlaying(false);
        alert(`Audio belum bisa diputar: ${error.message}`);
      });
    setActiveTrack(playableTrack);
    setPlayerQueue(nextQueue);
    setPlayerQueueIndex(nextQueueIndex);

    audioRef.current.onended = () => setIsPlaying(false);

    if (!playableTrack.freeFull) {
      audioPreviewTimerRef.current = window.setTimeout(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setPlayerCurrentTime(0);
        setIsPlaying(false);
      }, 30000);
    }
  };

  const buildLibraryPlaybackTrack = (track, libraryItem = selectedLibraryItem) => ({
    ...track,
    id: `library-${libraryItem?.id || 'item'}-${track.id}`,
    albumTitle: libraryItem?.parentAlbumTitle || libraryItem?.title || track.albumTitle,
    albumCover: libraryItem?.coverPreview || track.albumCover,
    isOwned: true,
    freeFull: true
  });

  const handlePlayLibraryTrack = (track, libraryItem = selectedLibraryItem, tracks = selectedLibraryTracks) => {
    const libraryQueue = (tracks.length ? tracks : [track]).map((item) => buildLibraryPlaybackTrack(item, libraryItem));
    handlePlayTrack(buildLibraryPlaybackTrack(track, libraryItem), libraryQueue);
  };

  const handleSecureLibraryDownload = async (trackOverride = null) => {
    const targetTrack = trackOverride || selectedLibraryTrack || selectedLibraryTracks[0];
    if (!targetTrack) return alert('Pilih rilisan di Library dulu bro.');

    try {
      const playableTrack = await resolvePlayableTrack(buildLibraryPlaybackTrack(targetTrack, selectedLibraryItem));
      if (!playableTrack?.url) return alert('File download belum tersedia untuk rilisan ini.');

      const downloadLink = document.createElement('a');
      downloadLink.href = playableTrack.url;
      downloadLink.download = targetTrack.fileName || `${targetTrack.title || 'wispace-track'}.mp3`;
      downloadLink.rel = 'noopener noreferrer';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      const nextLog = {
        id: createClientId(),
        trackId: targetTrack.id || '',
        trackTitle: targetTrack.title || targetTrack.fileName || 'WiSpace track',
        albumTitle: selectedLibraryItem?.parentAlbumTitle || selectedLibraryItem?.title || playableTrack.albumTitle || 'WiSpace archive',
        bandName: selectedLibraryItem?.bandName || playableTrack.bandName || 'WiSpace',
        fileName: targetTrack.fileName || downloadLink.download,
        source: targetTrack.audioPath ? 'signed_private_audio' : 'local_fallback',
        downloadedAt: new Date().toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      setDownloadLogs((currentLogs) => {
        const nextLogs = [nextLog, ...currentLogs].slice(0, 20);
        persistAudienceDownloadLogLocal(nextLogs);
        return nextLogs;
      });
    } catch (error) {
      alert(`Secure download belum bisa dibuka: ${error.message}`);
    }
  };

  const handleToggleActiveTrack = () => {
    if (!activeTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current.play();
    setIsPlaying(true);
  };

  const formatPlayerTime = (seconds = 0) => {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handlePlayerSeek = (event) => {
    if (!activeTrack) return;
    const requestedTime = Number(event.target.value || 0);
    const previewLimit = activeTrack.freeFull || activeTrack.isOwned ? playerDuration : Math.min(playerDuration || 30, 30);
    const nextTime = Math.max(0, Math.min(requestedTime, previewLimit || requestedTime));
    audioRef.current.currentTime = nextTime;
    setPlayerCurrentTime(nextTime);
  };

  const handlePlayerStep = (direction) => {
    if (playerQueue.length <= 1) return;
    const nextIndex = (playerQueueIndex + direction + playerQueue.length) % playerQueue.length;
    const nextTrack = playerQueue[nextIndex];
    setPlayerQueueIndex(nextIndex);
    handlePlayTrack(nextTrack, playerQueue);
  };

  const approvedFreeGigs = gigs.filter((gig) => (gig.status === 'approved' || gig.status === 'approved_free') && isVisibleApprovedHomepageGig(gig));
  const approvedExclusiveGigs = gigs.filter((gig) => gig.status === 'approved_exclusive' && isVisibleApprovedHomepageGig(gig));
  const exclusiveWaitingPaymentGigs = gigs.filter((gig) => gig.status === 'approved_waiting_payment');
  const exclusivePaidWaitingActivationGigs = gigs.filter((gig) => gig.status === 'paid_waiting_activation');
  const archivedGigs = [...gigs.filter((gig) => gig.status === 'removed')].sort((leftGig, rightGig) => {
    const leftTime = Date.parse(leftGig.updatedAt || leftGig.approvedUntil || leftGig.date || leftGig.createdAt || 0) || 0;
    const rightTime = Date.parse(rightGig.updatedAt || rightGig.approvedUntil || rightGig.date || rightGig.createdAt || 0) || 0;
    return rightTime - leftTime;
  });
  const paidExclusivePosterGigs = [...exclusivePaidWaitingActivationGigs, ...approvedExclusiveGigs];
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values) => !normalizedSearchTerm || values.some((value) => String(value || '').toLowerCase().includes(normalizedSearchTerm));
  const filteredGigs = approvedFreeGigs.filter(gig => matchesSearch(gig.title, gig.city, getGigGenre(gig), getGigDate(gig), getGigHtm(gig)));
  const filteredPublicGigs = [...approvedExclusiveGigs, ...approvedFreeGigs].filter(gig => matchesSearch(gig.title, gig.city, getGigGenre(gig), getGigDate(gig), getGigHtm(gig)));
  const filteredAlbums = albumItems.filter((album) => matchesSearch(
    album.title,
    album.bandName,
    album.genre,
    album.city,
    album.description,
    (album.tracks || []).map((track) => `${track.title} ${track.fileName}`).join(' ')
  ));
  const filteredAlbumTracks = albumItems
    .flatMap((album) => (album.tracks || []).map((track) => ({
      ...track,
      albumId: album.id,
      albumTitle: album.title,
      bandName: album.bandName,
      genre: album.genre,
      city: album.city,
      sourceAlbum: album
    })))
    .filter((track) => matchesSearch(track.title, track.fileName, track.albumTitle, track.bandName, track.genre, track.city));
  const publicBandList = [
    ...publicBandProfiles,
    ...(bandProfile.name ? [bandProfile] : [])
  ].filter((profile, index, profiles) => (
    profile.name && profiles.findIndex((item) => (item.slug || createSlug(item.name)) === (profile.slug || createSlug(profile.name))) === index
  ));
  const publicMerchList = [
    ...publicMerchItems,
    ...merchItems.map((item) => ({
      ...item,
      bandName: item.bandName || bandProfile.name || signatureName || 'Band WiSpace',
      bandSlug: item.bandSlug || bandProfile.slug || createSlug(bandProfile.name || signatureName || 'band-wispace'),
      genre: item.genre || bandProfile.genre || 'Indie',
      city: item.city || bandProfile.city || 'Indonesia'
    }))
  ].filter((item, index, items) => (
    item.name && items.findIndex((candidate) => String(candidate.id) === String(item.id)) === index
  ));
  const publicArticleList = [
    ...publicArticleItems,
    ...articleItems.map((article) => ({
      ...article,
      bandName: article.bandName || bandProfile.name || signatureName || 'Band WiSpace',
      bandSlug: article.bandSlug || bandProfile.slug || createSlug(bandProfile.name || signatureName || 'band-wispace'),
      genre: article.genre || bandProfile.genre || 'Indie',
      city: article.city || bandProfile.city || 'Indonesia'
    }))
  ].filter((article, index, articles) => (
    article.title && articles.findIndex((candidate) => String(candidate.id) === String(article.id)) === index
  ));
  const filteredBandProfiles = publicBandList.filter((profile) => matchesSearch(profile.name, profile.genre, profile.city, profile.headline, profile.bio, profile.slug));
  const filteredMerchItems = publicMerchList.filter((item) => matchesSearch(item.name, item.description, item.bandName, item.genre, item.city));
  const filteredArticles = publicArticleList.filter((article) => matchesSearch(article.title, article.category, article.excerpt, article.body, article.bandName, article.genre, article.city));
  const selectedArticle = selectedArticleId
    ? publicArticleList.find((article) => String(article.id) === String(selectedArticleId))
    : null;
  const selectedArticleComments = selectedArticle ? (articleComments[selectedArticle.id] || []) : [];
  const selectedRelease = selectedReleaseId
    ? albumItems.find((album) => String(album.id) === String(selectedReleaseId))
    : null;
  const selectedReleasePrivateTrackCount = (selectedRelease?.tracks || []).filter((track) => track.audioPath).length;
  const selectedReleasePreviewTrackCount = (selectedRelease?.tracks || []).filter((track) => track.previewUrl).length;
  const selectedReleaseFreeFullCount = (selectedRelease?.tracks || []).filter((track) => track.freeFull).length;
  const selectedMerch = selectedMerchId
    ? publicMerchList.find((item) => String(item.id) === String(selectedMerchId))
    : null;
  const isAdminUnlockSearch = normalizedSearchTerm === 'admin_wsu';
  const closeSearchUi = () => {
    setSearchTerm('');
    setIsSearchExpanded(false);
  };
  const searchCategorySummaries = [
    { id: 'rilisan', label: 'RILISAN', count: filteredAlbums.length + filteredAlbumTracks.length },
    { id: 'band', label: 'BAND', count: filteredBandProfiles.length },
    { id: 'artikel', label: 'ARTIKEL', count: filteredArticles.length },
    { id: 'merch', label: 'MERCH', count: filteredMerchItems.length }
  ];
  const totalSearchMatches = searchCategorySummaries.reduce((total, item) => total + item.count, 0);
  const searchPrimaryCategory = [...searchCategorySummaries].sort((leftItem, rightItem) => rightItem.count - leftItem.count)[0] || searchCategorySummaries[0];
  const openSearchExplore = (tab = searchPrimaryCategory?.id || 'rilisan') => {
    setIsSearchExpanded(false);
    setShowNotificationPopout(false);
    navigateInternalPage('explore', { exploreTab: tab });
  };
  const handleSearchSubmit = (event) => {
    if (event?.key && event.key !== 'Enter') return;
    if (event?.preventDefault) event.preventDefault();
    if (!normalizedSearchTerm || isAdminUnlockSearch) return;
    openSearchExplore(searchPrimaryCategory?.id || 'rilisan');
  };
  const quickSearchResults = normalizedSearchTerm && !isAdminUnlockSearch ? [
    ...filteredAlbums.slice(0, 3).map((album) => ({
      id: `album-${album.id}`,
      type: 'RILISAN',
      title: album.title,
      meta: `${album.bandName || 'Band WiSpace'} / ${album.genre || 'Indie'} / ${album.trackCount || 0} track`,
      onSelect: () => {
        closeSearchUi();
        openReleaseDetail(album);
      }
    })),
    ...filteredAlbumTracks.slice(0, 3).map((track) => ({
      id: `track-${track.albumId}-${track.id}`,
      type: 'LAGU',
      title: track.title,
      meta: `${track.bandName || 'Band WiSpace'} / ${track.albumTitle || 'Rilisan'} / ${track.freeFull ? 'free full' : 'preview'}`,
      onSelect: () => {
        closeSearchUi();
        navigateInternalPage('explore', { exploreTab: 'rilisan' });
        if (track.url || track.previewUrl || track.freeFull) handlePlayTrack(track, filteredAlbumTracks);
      }
    })),
    ...filteredBandProfiles.slice(0, 3).map((profile) => ({
      id: `band-${profile.slug || profile.name}`,
      type: 'BAND',
      title: profile.name,
      meta: `${profile.city || 'Indonesia'} / ${profile.genre || 'Indie'} / ${profile.slug || createSlug(profile.name)}`,
      onSelect: () => {
        closeSearchUi();
        openBandPublicProfile(false, profile);
      }
    })),
    ...filteredArticles.slice(0, 3).map((article) => ({
      id: `article-${article.id}`,
      type: 'ARTIKEL',
      title: article.title,
      meta: `${article.category || 'Update Band'} / ${article.bandName || 'Band WiSpace'}`,
      onSelect: () => {
        closeSearchUi();
        openArticleReader(article);
      }
    })),
    ...filteredMerchItems.slice(0, 2).map((item) => ({
      id: `merch-${item.id}`,
      type: 'MERCH',
      title: item.name,
      meta: `${item.bandName || 'Band WiSpace'} / Rp ${Number(item.price || 0).toLocaleString('id-ID')}`,
      onSelect: () => {
        closeSearchUi();
        openMerchDetail(item);
      }
    }))
  ].slice(0, 10) : [];
  const getHomeDiscoveryScore = (value = '') => (
    String(value).split('').reduce((total, char, index) => total + (char.charCodeAt(0) * (index + 7)), 0)
  );
  const getYoutubeEmbedUrl = (url = '', autoplay = false) => {
    const videoId = getYoutubeVideoId(url);
    if (!videoId) return '';
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1'
    });
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  };
  const getWispacePickLabel = (pick) => {
    const fallbackType = String(pick?.type || '').trim().toUpperCase();
    const requestedLabel = String(pick?.contentLabel || '').trim().toUpperCase();
    return WISPACE_PICK_LABEL_OPTIONS.includes(requestedLabel) ? requestedLabel : (fallbackType || 'PICK');
  };
  const getWispacePickActionLabel = (pick) => {
    if (!pick?.youtubeUrl) return 'LIHAT PICK';
    switch (getWispacePickLabel(pick)) {
      case 'PODCAST':
        return 'PLAY PODCAST';
      case 'LIVE SESSION':
        return 'PLAY LIVE SESSION';
      default:
        return 'PLAY REVIEW';
    }
  };
  const closeWispacePickDetail = () => {
    setSelectedWispacePickDetail(null);
    setWispacePickShouldAutoplay(false);
  };
  const openWispacePickDetail = (pick, options = {}) => {
    if (!pick) return;
    if (pick.youtubeUrl && !userSession) {
      setAuthType('login');
      setShowAuthModal(true);
      setAuthError('Login atau join dulu buat play WiSpace Pick dan podcast di homepage.');
      return;
    }
    setSelectedWispacePickDetail(pick);
    setWispacePickShouldAutoplay(Boolean(options.autoplay && pick.youtubeUrl));
  };
  const homeGigCards = filteredGigs.slice(0, 10);
  const homeSupportingGigs = homeGigCards.slice(0, 10);
  const homeFeaturedArticle = publicArticleList[0] || null;
  const manualYoutubeThumbnail = getYoutubeThumbnail(wispacePickDraft.youtubeUrl);
  const homePickSeed = new Date().toISOString().slice(0, 10);
  const homeRandomPick = [
    ...albumItems.map((album) => ({
      id: `release-${album.id}`,
      type: 'RILISAN REVIEW',
      title: album.title || 'WiSpace Pick',
      bandName: album.bandName || 'Band WiSpace',
      thumbnail: album.coverPreview,
      youtubeUrl: album.youtubeUrl || album.youtube_url || '',
      review: 'Pilihan kurasi WiSpace: dengarkan dulu tekstur, mood, dan arah sound-nya. Slot ini nanti bisa jadi review video YouTube dari admin untuk rilisan yang layak disorot.',
      action: () => openReleaseDetail(album)
    })),
    ...homeGigCards.map((gig) => ({
      id: `gig-${gig.id}`,
      type: 'EVENT REVIEW',
      title: gig.title || 'WiSpace Event',
      bandName: gig.city || 'WiSpace',
      thumbnail: gig.image,
      youtubeUrl: '',
      review: `Event pilihan dari ${gig.city || 'skena lokal'}. Cocok jadi highlight buat audience yang mau cari agenda dan atmosfer baru dari WiSpace.`,
      action: () => setSelectedGigDetail({ ...gig, fromEventOverlay: true })
    }))
  ].sort((a, b) => getHomeDiscoveryScore(`${b.id}-${homePickSeed}`) - getHomeDiscoveryScore(`${a.id}-${homePickSeed}`))[0] || null;
  const homeWispacePick = wispacePickDraft.youtubeUrl.trim()
    ? {
        type: wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel,
        contentLabel: wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel,
        title: wispacePickDraft.title || 'WiSpace Video Review',
        bandName: wispacePickDraft.bandName || 'WiSpace',
        thumbnail: wispacePickDraft.thumbnail || manualYoutubeThumbnail,
        youtubeUrl: wispacePickDraft.youtubeUrl,
        review: wispacePickDraft.review,
        action: () => openWispacePickDetail({
          type: wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel,
          contentLabel: wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel,
          title: wispacePickDraft.title || 'WiSpace Video Review',
          bandName: wispacePickDraft.bandName || 'WiSpace',
          thumbnail: wispacePickDraft.thumbnail || manualYoutubeThumbnail,
          youtubeUrl: wispacePickDraft.youtubeUrl,
          review: wispacePickDraft.review
        }, { autoplay: true })
      }
    : homeRandomPick;
  const selectedWispacePickEmbedUrl = getYoutubeEmbedUrl(selectedWispacePickDetail?.youtubeUrl || '', wispacePickShouldAutoplay);
  const homeDiscoveryItems = [
    ...albumItems.map((album) => ({
      id: `release-${album.id}`,
      type: 'RILISAN',
      title: album.title,
      subtitle: album.bandName || 'Band WiSpace',
      meta: `Rp ${Number(album.price || 0).toLocaleString('id-ID')}`,
      image: album.coverPreview,
      action: () => openReleasePopup(album)
    })),
    ...publicMerchList.map((item) => ({
      id: `merch-${item.id}`,
      type: 'MERCH',
      title: item.name,
      subtitle: item.bandName || 'Band WiSpace',
      meta: `Rp ${Number(item.price || 0).toLocaleString('id-ID')}`,
      image: item.imagePreview,
      action: () => openMerchDetail(item)
    }))
  ]
    .sort((a, b) => getHomeDiscoveryScore(`${b.id}-${homeGigCards.length}`) - getHomeDiscoveryScore(`${a.id}-${homeGigCards.length}`))
    .slice(0, 4);
  const selectedLibraryItem = purchasedAlbums.find((album) => album.id === selectedLibraryItemId) || purchasedAlbums[0] || null;
  const selectedLibraryTracks = selectedLibraryItem?.tracks?.length
    ? selectedLibraryItem.tracks
    : selectedLibraryItem
      ? [{
          id: `${selectedLibraryItem.id}-fallback`,
          title: selectedLibraryItem.title,
          url: selectedLibraryItem.url,
          audioPath: selectedLibraryItem.audioPath || '',
          price: selectedLibraryItem.price,
          freeFull: true
        }]
      : [];
  const selectedLibraryTrack = selectedLibraryTracks.find((track) => String(track.id) === String(selectedLibraryTrackId)) || selectedLibraryTracks[0] || null;
  const selectedLibraryDownloadLogs = selectedLibraryItem
    ? downloadLogs.filter((log) => (
        log.albumTitle === selectedLibraryItem.title
        || log.albumTitle === selectedLibraryItem.parentAlbumTitle
        || log.bandName === selectedLibraryItem.bandName
      ))
    : downloadLogs;
  const checkoutProduct = activeCheckout?.type === 'album'
    ? activeCheckout.album
    : activeCheckout?.type === 'track'
      ? activeCheckout.track
      : activeCheckout?.item || null;
  const checkoutAlbumContext = activeCheckout?.album || null;
  const checkoutTitle = checkoutProduct?.title || checkoutProduct?.name || 'Checkout WiSpace';
  const checkoutSellerName = activeCheckout?.type === 'track'
    ? checkoutAlbumContext?.bandName
    : checkoutProduct?.bandName;
  const checkoutSubtotal = normalizePriceValue(checkoutProduct?.price);
  const checkoutCourierOption = activeCheckout?.type === 'merch'
    ? getCourierOption(checkoutDraft.courier, checkoutCourierOptions)
    : null;
  const checkoutShippingCost = activeCheckout?.type === 'merch'
    ? normalizePriceValue(checkoutDraft.shippingCost || checkoutCourierOption?.cost || 0)
    : 0;
  const checkoutTotal = checkoutSubtotal + checkoutShippingCost;
  const checkoutReference = activeCheckout?.checkoutRef || 'WSP-DEMO-ORDER';
  const checkoutPaymentStatus = activeCheckout?.status || 'pending_payment';
  const checkoutProviderId = activeCheckout?.provider || PAYMENT_GATEWAY_PROVIDER || 'manual';
  const checkoutProviderLabel = PAYMENT_GATEWAY_PROVIDER_OPTIONS.find((provider) => provider.id === checkoutProviderId)?.title || checkoutProviderId;
  const checkoutProviderStatus = activeCheckout?.providerStatus || '';
  const checkoutProviderCheckoutUrl = activeCheckout?.providerCheckoutUrl || '';
  const checkoutIsMidtransPopupReady = checkoutProviderId === 'midtrans' && Boolean(activeCheckout?.providerInvoiceId) && Boolean(PAYMENT_GATEWAY_CLIENT_KEY);
  const checkoutProofRequired = PAYMENT_GATEWAY_PROVIDER === 'manual';
  const checkoutIsProcessing = checkoutPaymentStatus === 'processing_payment';
  const checkoutIsAwaitingAdmin = checkoutPaymentStatus === 'waiting_admin_confirmation';
  const checkoutIsPaid = checkoutPaymentStatus === 'paid';
  const checkoutIsCancelled = checkoutPaymentStatus === 'cancelled';
  const checkoutAccentColor = checkoutIsPaid
    ? 'rgba(255,255,255,0.72)'
    : checkoutIsCancelled
      ? '#F1D4E5'
      : checkoutProviderCheckoutUrl
        ? '#73BBC9'
        : checkoutIsAwaitingAdmin
          ? '#73BBC9'
      : 'rgba(255,255,255,0.72)';
  const selectedMerchOrderStage = selectedMerchOrderDetail ? getMerchOrderStageSummary(selectedMerchOrderDetail) : null;
  const selectedMerchOrderLabelStatus = selectedMerchOrderDetail ? getMerchShipmentLabelSummary(selectedMerchOrderDetail) : null;
  const selectedMerchOrderTrackingLive = selectedMerchOrderDetail ? getMerchTrackingLiveSummary(selectedMerchOrderDetail) : null;
  const checkoutReviewLabel = checkoutIsPaid
    ? 'DIBAYAR'
    : checkoutIsCancelled
      ? 'DITUTUP'
      : checkoutProviderCheckoutUrl
        ? 'SIAP BAYAR'
        : checkoutIsAwaitingAdmin
          ? 'MENUNGGU CEK'
          : checkoutIsProcessing
            ? 'MENYIAPKAN'
            : 'MENUNGGU BAYAR';
  const checkoutBuyerStatusText = checkoutIsPaid
    ? activeCheckout?.type === 'merch'
      ? 'Pembayaran sudah diterima. Pesanan masuk ke proses pengiriman.'
      : 'Pembayaran sudah diterima. Koleksi otomatis aktif di Library WiSpace.'
    : checkoutIsCancelled
      ? 'Sesi pembayaran ditutup. Order belum diaktifkan.'
      : checkoutIsMidtransPopupReady
        ? 'Pembayaran siap dibuka di halaman ini.'
      : checkoutProviderCheckoutUrl
        ? 'Sesi pembayaran sudah siap dibuka.'
        : checkoutIsAwaitingAdmin
          ? 'Pembayaran sedang menunggu verifikasi akhir.'
          : 'Lengkapi detail pembayaran untuk melanjutkan.';
  const checkoutStatusCopy = checkoutIsPaid
    ? activeCheckout?.type === 'merch'
      ? 'Pembayaran diterima / pesanan diproses'
      : 'Pembayaran diterima / koleksi aktif'
    : checkoutIsCancelled
      ? 'Sesi ditutup'
      : checkoutIsAwaitingAdmin
        ? 'Menunggu verifikasi'
      : checkoutIsProcessing
        ? 'Menyiapkan pembayaran'
        : 'Menunggu pembayaran';
  const checkoutSubmitLabel = PAYMENT_GATEWAY_PROVIDER === 'manual'
    ? 'KIRIM KONFIRMASI PEMBAYARAN'
    : `LANJUT KE ${checkoutProviderLabel.toUpperCase()}`;
  const isAdminPage = isAdminUnlockSearch;
  const isCloudAdmin = Boolean(cloudAdminAccount?.user_id);
  const pendingGigs = gigs.filter(gig => gig.status === 'pending');
  const posterUploadGuide = newGigRequestType === 'exclusive'
    ? { ratio: '16:9 landscape', size: '1920 x 1080 px', note: 'Cocok buat slide besar homepage. Pastikan teks utama aman di tengah gambar.' }
    : { ratio: '3:4 atau 4:5 poster', size: '1080 x 1440 px', note: 'Cocok buat card bulletin kecil. Judul, tanggal, venue harus kebaca jelas.' };
  const isBandProfilePage = activePage === 'band_profile';
  const isBandPublicPage = activePage === 'band_public';
  const isFinancePage = activePage === 'finance_dashboard';
  const isGigManagerPage = activePage === 'gig_manager';
  const isMessagePage = activePage === 'message_center';
  const isAudienceProfilePage = activePage === 'audience_profile';
  const isAudienceLibraryPage = activePage === 'audience_library';
  const isAudienceOrdersPage = activePage === 'audience_orders';
  const isExplorePage = activePage === 'explore';
  const isMerchMarketPage = activePage === 'merch_market';
  const isArticlesPage = activePage === 'articles';
  const isBandAccount = userRole === 'musisi';
  const isAudienceAccount = userRole === 'audience';
  const showAudienceCommerceNav = Boolean(userSession && isAudienceAccount);
  const showBandOwnerControls = isBandAccount && isViewingOwnBandProfile;
  const showBandContactForm = !showBandOwnerControls;
  const selectedPublicBandProfile = publicBandProfiles.find((profile) => profile.slug === viewedBandSlug);
  const displayBandProfile = isBandPublicPage && !showBandOwnerControls && selectedPublicBandProfile ? selectedPublicBandProfile : bandProfile;
  const currentBandSlug = getBandProfileSlug(displayBandProfile);
  const displayBandAlbums = albumItems.filter((album) => {
    const albumBandSlug = album.bandSlug || createSlug(album.bandName || '');
    const displayBandName = displayBandProfile.name || bandProfile.name || signatureName || '';
    return !displayBandName || albumBandSlug === currentBandSlug || album.bandName === displayBandName;
  });
  const bandPublicTracks = displayBandAlbums
    .flatMap((album) => (album.tracks || []).map((track, index) => ({
      ...track,
      albumTitle: album.title,
      albumCover: album.coverPreview,
      genre: album.genre,
      displayIndex: index + 1
    })))
    .slice(0, 5);
  const hasFreeFullBandTrack = bandPublicTracks.some((track) => track.freeFull) || displayBandAlbums.some((album) => (album.tracks || []).some((track) => track.freeFull));
  const bandPublicPreviewReadyCount = bandPublicTracks.filter((track) => track.previewUrl || track.url || track.freeFull).length;
  const albumDraftMasterStoredCount = albumDraft.audioFiles.filter((file) => file.audioPath).length;
  const albumDraftPreviewReadyCount = albumDraft.audioFiles.filter((file) => file.previewUrl).length;
  const albumDraftPaidTrackCount = albumDraft.audioFiles.filter((_, index) => String(index) !== String(albumDraft.freeTrackIndex)).length;
  const albumDraftMissingPreviewCount = albumDraft.audioFiles.filter((file, index) => String(index) !== String(albumDraft.freeTrackIndex) && !file.previewUrl).length;
  const albumDraftFreeFullLabel = albumDraft.freeTrackIndex !== '' && albumDraft.audioFiles[albumDraft.freeTrackIndex]
    ? albumDraft.audioFiles[albumDraft.freeTrackIndex].name.replace(/\.mp3$/i, '')
    : hasFreeFullBandTrack
      ? 'SUDAH ADA DI PROFILE'
      : 'BELUM DIPILIH';
  const hasBandPayoutAccount = Boolean(
    bandProfile.bankName?.trim()
    && bandProfile.bankAccountName?.trim()
    && bandProfile.bankAccountNumber?.trim()
  );
  const bandShippingOriginMissingFields = getShippingOriginMissingFields(bandProfile);
  const hasBandShippingOrigin = isShippingOriginReady(bandProfile);
  const merchUsesAdminConsignment = merchDraft.fulfillmentMode === 'admin_consignment';
  const adminConsignmentMerchItems = publicMerchList.filter((item) => item.fulfillmentMode === 'admin_consignment');
  const adminWaitingConsignmentItems = adminConsignmentMerchItems.filter((item) => item.consignmentStatus !== 'stock_received');
  const adminConsignmentStockTotal = adminConsignmentMerchItems
    .filter((item) => item.consignmentStatus === 'stock_received')
    .reduce((total, item) => total + normalizePriceValue(item.adminStockOnHand || 0), 0);
  const displayBandMerchItems = publicMerchList.filter((item) => (
    item.bandSlug === currentBandSlug || item.bandName === displayBandProfile.name
  ));
  const financeTransactions = saleTransactions.filter((transaction) => (
    transaction.sellerBandUserId === userSession?.id || transaction.sellerBandSlug === currentBandSlug || transaction.sellerBandName === displayBandProfile.name || transaction.sellerBandName === bandProfile.name
  ));
  const bandBalance = financeTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const bandGrossRevenue = financeTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0);
  const paidSaleTransactions = saleTransactions.filter((transaction) => (transaction.paymentStatus || transaction.status || '').includes('paid'));
  const adminDigitalTransactions = paidSaleTransactions.filter((transaction) => ['album', 'track'].includes(transaction.productType));
  const adminMerchTransactions = paidSaleTransactions.filter((transaction) => transaction.productType === 'merch');
  const adminPosterTransactions = paidSaleTransactions.filter((transaction) => transaction.productType === 'exclusive_poster');
  const adminGrossSalesRevenue = paidSaleTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0);
  const adminMerchFeeRevenue = adminMerchTransactions
    .reduce((total, transaction) => total + Number(transaction.platformFee || 0), 0);
  const adminReleaseFeeRevenue = adminDigitalTransactions
    .reduce((total, transaction) => total + Number(transaction.platformFee || 0), 0);
  const bandMerchOrders = merchOrders.filter((order) => (
    order.sellerBandUserId === userSession?.id || order.sellerBandSlug === currentBandSlug || order.sellerBandName === displayBandProfile.name || order.sellerBandName === bandProfile.name
  ));
  const audienceMerchOrders = merchOrders.filter((order) => (
    order.buyerUserId === userSession?.id || (userSession?.email && order.buyerEmail === userSession.email)
  ));
  const activeAudienceOrders = audienceMerchOrders.filter((order) => !FINALIZED_ORDER_STATUSES.includes(order.trackingStatus));
  const audiencePaymentRequests = pendingPayments.filter((payment) => (
    payment.buyerUserId === userSession?.id || (userSession?.email && payment.buyerEmail === userSession.email)
  ));
  const activeAudiencePaymentRequests = audiencePaymentRequests.filter((payment) => ['waiting_admin_confirmation', 'provider_paid_pending_activation'].includes(payment.status));
  const adminBandPayoutTotal = paidSaleTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const activeMerchFulfillmentStatuses = ['order_paid_waiting_band', 'order_paid_waiting_admin', 'processing', 'processing_admin', 'packing', 'ready_to_ship', 'shipped', 'refund_requested'];
  const adminActiveMerchOrderList = merchOrders.filter((order) => activeMerchFulfillmentStatuses.includes(order.trackingStatus));
  const adminWaitingMerchOrders = adminActiveMerchOrderList.length;
  const adminConsignmentOrderQueue = adminActiveMerchOrderList.filter((order) => order.fulfillmentMode === 'admin_consignment');
  const adminBandShipOrderQueue = adminActiveMerchOrderList.filter((order) => order.fulfillmentMode !== 'admin_consignment');
  const adminOrdersWithTracking = merchOrders.filter((order) => order.trackingNumber && !['completed', 'cancelled'].includes(order.trackingStatus));
  const adminCompletedMerchOrders = merchOrders.filter((order) => order.trackingStatus === 'completed');
  const adminShipmentNeedsBooking = adminActiveMerchOrderList.filter((order) => !order.trackingNumber && !order.shipmentLabelUrl && !['shipment_booking_ready', 'manual_label_pending'].includes(order.shipmentBookingStatus));
  const adminShipmentLabelReady = adminActiveMerchOrderList.filter((order) => order.trackingNumber || order.shipmentLabelUrl || order.shipmentBookingStatus === 'shipment_booking_ready');
  const adminShipmentNeedsReview = adminActiveMerchOrderList.filter((order) => order.shipmentBookingStatus === 'shipment_booking_failed' || order.trackingStatus === 'refund_requested');
  const adminShipmentShipped = merchOrders.filter((order) => order.trackingStatus === 'shipped');
  const adminShipmentFilterOptions = [
    ['active', 'AKTIF', adminActiveMerchOrderList],
    ['need_booking', 'BELUM BOOKING', adminShipmentNeedsBooking],
    ['label_ready', 'LABEL SIAP', adminShipmentLabelReady],
    ['need_review', 'PERLU CEK', adminShipmentNeedsReview],
    ['shipped', 'DIKIRIM', adminShipmentShipped],
    ['completed', 'SELESAI', adminCompletedMerchOrders]
  ];
  const selectedAdminShipmentOrders = (adminShipmentFilterOptions.find(([filterId]) => filterId === adminShipmentFilter)?.[2] || adminActiveMerchOrderList);
  const bandPendingMerchOrders = bandMerchOrders.filter((order) => activeMerchFulfillmentStatuses.includes(order.trackingStatus)).length;
  const merchShippingByOrderId = merchOrders.reduce((lookup, order) => {
    const shippingCost = Number(order.shippingCost || 0);
    [order.orderId, order.transactionId, order.id].filter(Boolean).forEach((key) => {
      lookup[String(key)] = shippingCost;
    });
    return lookup;
  }, {});
  const adminMerchShippingCollected = merchOrders.reduce((total, order) => total + Number(order.shippingCost || 0), 0);
  const adminMerchProductRevenue = adminMerchTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0);
  const adminCashCollected = adminGrossSalesRevenue + adminMerchShippingCollected;
  const adminPayoutByBand = paidSaleTransactions
    .filter((transaction) => Number(transaction.bandNet || 0) > 0)
    .reduce((bands, transaction) => {
      const key = transaction.sellerBandSlug || createSlug(transaction.sellerBandName || 'band-wispace');
      const transactionShippingCost = Number(merchShippingByOrderId[String(transaction.orderId || '')] || merchShippingByOrderId[String(transaction.id || '')] || 0);
      const current = bands[key] || {
        slug: key,
        name: transaction.sellerBandName || 'Band WiSpace',
        amount: 0,
        grossAmount: 0,
        shippingCost: 0,
        platformFee: 0,
        transactions: 0,
        transactionDetails: []
      };
      return {
        ...bands,
        [key]: {
          ...current,
          amount: current.amount + Number(transaction.bandNet || 0),
          grossAmount: current.grossAmount + Number(transaction.grossAmount || 0),
          shippingCost: current.shippingCost + transactionShippingCost,
          platformFee: current.platformFee + Number(transaction.platformFee || 0),
          transactions: current.transactions + 1,
          transactionDetails: [
            ...current.transactionDetails,
            {
              orderId: transaction.orderId || transaction.id,
              productType: transaction.productType || 'order',
              productTitle: transaction.productTitle || 'Transaksi WiSpace',
              buyerName: transaction.buyerName || 'Audience WiSpace',
              grossAmount: Number(transaction.grossAmount || 0),
              platformFee: Number(transaction.platformFee || 0),
              bandNet: Number(transaction.bandNet || 0),
              shippingCost: transactionShippingCost,
              paidAt: transaction.paidAt || transaction.createdAt || '',
              createdAt: transaction.createdAt || ''
            }
          ]
        }
      };
    }, {});
  const adminPayoutBands = Object.values(adminPayoutByBand).sort((first, second) => second.amount - first.amount);
  const adminPayoutReadyBands = adminPayoutBands.filter((band) => band.amount >= MINIMUM_PAYOUT_AMOUNT);
  const adminPayoutReadyTotal = adminPayoutReadyBands.reduce((total, band) => total + band.amount, 0);
  const adminPayoutBelowMinimumTotal = Math.max(0, adminBandPayoutTotal - adminPayoutReadyTotal);
  const financeDigitalRevenue = financeTransactions
    .filter((transaction) => ['album', 'track'].includes(transaction.productType))
    .reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const financeMerchRevenue = financeTransactions
    .filter((transaction) => transaction.productType === 'merch')
    .reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const exclusivePosterTransactions = adminPosterTransactions;
  const adminExclusivePosterRevenue = Math.max(
    exclusivePosterTransactions.reduce((total, transaction) => total + Number(transaction.platformFee || transaction.grossAmount || 0), 0),
    paidExclusivePosterGigs.length * EXCLUSIVE_POSTER_SLOT_FEE
  );
  const localAssetCount = [
    ...publicBandProfiles.flatMap((profile) => [profile.photoPreview, profile.coverPreview]),
    ...albumItems.flatMap((album) => [album.coverPreview, ...(album.tracks || []).map((track) => track.url)]),
    ...publicMerchList.map((item) => item.imagePreview),
    ...gigs.map((gig) => gig.image)
  ].filter((value) => typeof value === 'string' && (value.startsWith('blob:') || value.startsWith('data:'))).length;
  const privateAudioPathCount = albumItems
    .flatMap((album) => album.tracks || [])
    .filter((track) => Boolean(track.audioPath)).length;
  const publicPreviewClipCount = albumItems
    .flatMap((album) => album.tracks || [])
    .filter((track) => Boolean(track.previewUrl)).length;
  const totalReleaseTrackCount = albumItems.flatMap((album) => album.tracks || []).length;
  const paidReleaseTrackCount = albumItems
    .flatMap((album) => album.tracks || [])
    .filter((track) => !track.freeFull).length;
  const previewMissingTrackCount = albumItems
    .flatMap((album) => album.tracks || [])
    .filter((track) => !track.freeFull && !track.previewUrl).length;
  const activatablePaymentStatuses = ['waiting_admin_confirmation', 'provider_paid_pending_activation'];
  const isPaymentReadyForAdminActivation = (payment) => activatablePaymentStatuses.includes(payment.status || 'waiting_admin_confirmation');
  const isProviderPaidPendingActivation = (payment) => payment.status === 'provider_paid_pending_activation';
  const canAdminConfirmPayment = (payment) => Boolean(payment.paymentProofPreview || payment.paymentProofUrl || isProviderPaidPendingActivation(payment));
  const waitingAdminPaymentRequests = pendingPayments.filter(isPaymentReadyForAdminActivation);
  const providerPaidAdminPaymentRequests = pendingPayments.filter(isProviderPaidPendingActivation);
  const paidAdminPaymentRequests = pendingPayments.filter((payment) => payment.status === 'paid');
  const rejectedAdminPaymentRequests = pendingPayments.filter((payment) => payment.status === 'rejected');
  const waitingAdminPaymentAmount = waitingAdminPaymentRequests.reduce((total, payment) => total + Number(payment.amount || payment.grossAmount || 0), 0);
  const waitingAdminPaymentProductAmount = waitingAdminPaymentRequests.reduce((total, payment) => total + Number(payment.grossAmount || payment.productAmount || payment.amount || 0), 0);
  const waitingAdminPaymentShippingAmount = waitingAdminPaymentRequests.reduce((total, payment) => total + Number(payment.shipping?.shippingCost || payment.shippingCost || 0), 0);
  const waitingAdminPaymentPotentialFee = waitingAdminPaymentRequests.reduce((total, payment) => (
    total + Number(payment.platformFee || calculateRevenueSplit(payment.grossAmount || payment.productAmount || payment.amount).platformFee)
  ), 0);
  const rejectedAdminPaymentAmount = rejectedAdminPaymentRequests.reduce((total, payment) => total + Number(payment.grossAmount || payment.amount || 0), 0);
  const recentProcessedPaymentRequests = pendingPayments
    .filter((payment) => payment.status && !activatablePaymentStatuses.includes(payment.status))
    .sort((first, second) => new Date(second.confirmedAt || second.rejectedAt || second.submittedAt || 0) - new Date(first.confirmedAt || first.rejectedAt || first.submittedAt || 0));
  const manualConfirmedPaymentTransactions = saleTransactions.filter((transaction) => (
    transaction.paymentMethod === 'admin_confirmed_manual'
  )).length;
  const activePaymentGatewayProvider = PAYMENT_GATEWAY_PROVIDER_OPTIONS.find((provider) => provider.id === PAYMENT_GATEWAY_PROVIDER) || PAYMENT_GATEWAY_PROVIDER_OPTIONS[0];
  const isManualPaymentMode = activePaymentGatewayProvider.id === 'manual';
  const paymentGatewayEndpointReady = Boolean(PAYMENT_GATEWAY_API_ENDPOINT);
  const paymentGatewayClientReady = activePaymentGatewayProvider.id !== 'midtrans' || Boolean(PAYMENT_GATEWAY_CLIENT_KEY);
  const recentPaymentWebhookEvents = paymentWebhookEvents.slice(0, 6);
  const verifiedPaymentWebhookCount = paymentWebhookEvents.filter((event) => event.verified).length;
  const paymentGatewayReadinessStatus = !isManualPaymentMode && paymentGatewayEndpointReady && paymentGatewayClientReady ? 'scaffold' : 'demo';
  const paymentGatewayHealthItems = [
    ['PROVIDER', activePaymentGatewayProvider.title, isManualPaymentMode ? 'rgba(255,255,255,0.72)' : '#73BBC9'],
    ['API ENDPOINT', PAYMENT_GATEWAY_API_ENDPOINT || 'Belum diset', paymentGatewayEndpointReady ? '#73BBC9' : '#F1D4E5'],
    ['CLIENT KEY', PAYMENT_GATEWAY_CLIENT_KEY ? 'Set' : activePaymentGatewayProvider.id === 'midtrans' ? 'Belum diset' : 'Tidak wajib', paymentGatewayClientReady ? 'rgba(255,255,255,0.72)' : '#F1D4E5'],
    ['WEBHOOK TARGET', PAYMENT_GATEWAY_WEBHOOK_PATH, '#73BBC9'],
    ['WEBHOOK EVENTS', paymentWebhookEvents.length ? `${paymentWebhookEvents.length} event / ${verifiedPaymentWebhookCount} verified` : 'Belum ada event', paymentWebhookEvents.length ? '#73BBC9' : 'rgba(255,255,255,0.72)'],
    ['MANUAL FALLBACK', 'Aktif', 'rgba(255,255,255,0.72)']
  ];
  const paymentGatewayServerSteps = [
    {
      title: 'Create invoice endpoint',
      status: paymentGatewayEndpointReady ? 'scaffold' : 'todo',
      note: 'Endpoint serverless menerima checkoutRef, amount, productAmount, shippingCost, buyer, seller, lalu membuat invoice provider.'
    },
    {
      title: 'Secret key server env',
      status: 'todo',
      note: 'MIDTRANS_SERVER_KEY/XENDIT_SECRET_KEY wajib disimpan di Vercel env server, jangan di VITE frontend.'
    },
    {
      title: 'Webhook settlement',
      status: 'scaffold',
      note: 'Callback provider verified bisa update payment_requests dan masuk log event. Aktivasi library/order tetap lewat admin confirm sampai fulfillment webhook dikunci.'
    },
    {
      title: 'Admin fallback',
      status: 'ready',
      note: 'Manual proof + admin confirm tetap dipertahankan buat cadangan saat gateway belum aktif.'
    }
  ];
  const restoredMerchOrderCount = merchOrders.filter((order) => order.stockRestored).length;
  const merchRefundOrCancelCount = merchOrders.filter((order) => ['cancelled', 'refunded', 'refund_requested'].includes(order.trackingStatus)).length;
  const completedRealFlowCount = [
    publicBandProfiles.some((profile) => profile.isPublished),
    releaseAgreements.length > 0 && albumItems.length > 0,
    publicMerchList.length > 0,
    purchasedAlbums.length > 0 || saleTransactions.some((transaction) => ['album', 'track'].includes(transaction.productType)),
    merchOrders.length > 0,
    merchOrders.some((order) => order.trackingNumber || ['shipped', 'completed'].includes(order.trackingStatus)),
    restoredMerchOrderCount > 0 || merchRefundOrCancelCount > 0,
    monthlyFinanceReports.length > 0
  ].filter(Boolean).length;
  const realFlowChecklist = [
    {
      title: 'Band profile + agreement',
      status: publicBandProfiles.some((profile) => profile.isPublished) && releaseAgreements.length > 0 ? 'ready' : publicBandProfiles.length ? 'scaffold' : 'todo',
      note: 'Band daftar/login, approve agreement, isi profile, dan publish profile public.',
      actionLabel: 'BAND PROFILE',
      action: () => navigateInternalPage('band_profile')
    },
    {
      title: 'Upload album + preview',
      status: albumItems.length && publicPreviewClipCount ? 'ready' : albumItems.length ? 'scaffold' : 'todo',
      note: 'Band upload MP3, preview 30 detik kebaca, dan 1 track bisa free full kalau dipilih.',
      actionLabel: 'UPLOAD ALBUM',
      action: () => {
        setBandProfileTab('album');
        navigateInternalPage('band_profile');
      }
    },
    {
      title: 'Upload merch + stock',
      status: publicMerchList.length ? 'ready' : 'todo',
      note: 'Band upload merch, isi stok, pilih band ship/admin stock, lalu cek card merch di Explore.',
      actionLabel: 'EXPLORE MERCH',
      action: () => navigateInternalPage('explore', { exploreTab: 'merch' })
    },
    {
      title: 'Audience purchase digital',
      status: purchasedAlbums.length || saleTransactions.some((transaction) => ['album', 'track'].includes(transaction.productType)) ? 'ready' : waitingAdminPaymentRequests.length ? 'scaffold' : 'todo',
      note: 'Audience checkout album/track, admin confirm paid, lalu item masuk Library dan player bisa dipakai.',
      actionLabel: 'LIBRARY',
      action: () => navigateInternalPage('audience_library')
    },
    {
      title: 'Audience purchase merch',
      status: merchOrders.length ? 'ready' : waitingAdminPaymentRequests.some((payment) => payment.type === 'merch') ? 'scaffold' : 'todo',
      note: 'Audience checkout merch, isi alamat/kurir, admin confirm paid, lalu order muncul di audience/band/admin.',
      actionLabel: 'ORDERS',
      action: () => navigateInternalPage('audience_orders')
    },
    {
      title: 'Fulfillment + resi',
      status: merchOrders.some((order) => order.trackingNumber || ['shipped', 'completed'].includes(order.trackingStatus)) ? 'ready' : merchOrders.length ? 'scaffold' : 'todo',
      note: 'Band/admin update status, packing, input resi, shipped, completed.',
      actionLabel: 'SHIPMENT',
      action: () => setAdminActiveSection('shipment')
    },
    {
      title: 'Cancel/refund restore stock',
      status: restoredMerchOrderCount ? 'ready' : merchRefundOrCancelCount ? 'scaffold' : 'todo',
      note: 'Admin review refund/cancel, stok balik sekali, ledger keluar dari payout paid.',
      actionLabel: 'ORDER DETAIL',
      action: () => setAdminActiveSection('shipment')
    },
    {
      title: 'Finance report tanggal 1',
      status: monthlyFinanceReports.length ? 'ready' : paidSaleTransactions.length ? 'scaffold' : 'todo',
      note: 'Generate report bulanan, cek cash collected, ongkir, fee WiSpace, dan payout band.',
      actionLabel: 'FINANCE',
      action: () => setAdminActiveSection('finance')
    }
  ];
  const liveCatalogCount = publicBandProfiles.length + albumItems.length + publicMerchList.length + publicArticleList.length + gigs.length;
  const liveCatalogSummary = `${publicBandProfiles.length} band / ${albumItems.length} rilisan / ${publicMerchList.length} merch / ${gigs.length} event / ${publicArticleList.length} artikel`;
  const hasRealCommerceData = saleTransactions.length > 0 || merchOrders.length > 0 || purchasedAlbums.length > 0 || waitingAdminPaymentRequests.length > 0;
  const preLaunchCleanupChecklist = [
    {
      title: 'Bersihkan data demo sebelum isi katalog real',
      status: liveCatalogCount === 0 && !hasRealCommerceData ? 'ready' : 'scaffold',
      note: liveCatalogCount === 0 && !hasRealCommerceData
        ? 'Katalog, order, dan transaksi sudah kosong. Aman mulai isi data real.'
        : `Masih ada data aktif: ${liveCatalogSummary}. Order/transaksi ${hasRealCommerceData ? 'sudah pernah dipakai buat test' : 'belum ada'}.`
    },
    {
      title: 'Gateway checkout live',
      status: !isManualPaymentMode && paymentGatewayEndpointReady && paymentGatewayClientReady
        ? 'ready'
        : (paymentGatewayEndpointReady || paymentGatewayClientReady ? 'scaffold' : 'todo'),
      note: !isManualPaymentMode && paymentGatewayEndpointReady && paymentGatewayClientReady
        ? `${activePaymentGatewayProvider.title} sudah kebaca, popup checkout siap dipakai.`
        : `Masih pakai ${activePaymentGatewayProvider.title}. Cek endpoint payment dan client key sebelum launch publik.`
    },
    {
      title: 'Notif order + email admin',
      status: recentPaymentWebhookEvents.length > 0 ? 'ready' : 'scaffold',
      note: recentPaymentWebhookEvents.length > 0
        ? `${recentPaymentWebhookEvents.length} event webhook sudah masuk. Jalur notif pembayaran sudah pernah nembak backend.`
        : `Endpoint notif order aktif di ${ORDER_NOTIFICATION_API_ENDPOINT}. Tes 1 order real lagi buat pastiin email admin/band tetap masuk.`
    },
    {
      title: 'Shipment label + resi',
      status: adminShipmentLabelReady.length > 0
        ? 'ready'
        : (merchOrders.length > 0 || Boolean(SHIPMENT_CREATE_API_ENDPOINT) ? 'scaffold' : 'todo'),
      note: adminShipmentLabelReady.length > 0
        ? `${adminShipmentLabelReady.length} order sudah punya label/resi.`
        : `Booking shipment pakai ${SHIPMENT_CREATE_API_ENDPOINT}. Jalankan 1 order merch real sampai label dan tracking kebaca.`
    },
    {
      title: 'Finance report awal bulan',
      status: monthlyFinanceReports.length > 0 ? 'ready' : (paidSaleTransactions.length > 0 ? 'scaffold' : 'todo'),
      note: monthlyFinanceReports.length > 0
        ? `${monthlyFinanceReports.length} report sudah pernah dibuat. Tinggal lanjut ritme tanggal 1 setiap bulan.`
        : 'Belum ada report final. Setelah test transaksi real, generate 1 report bulanan biar payout flow aman.'
    }
  ];
  const productionReadinessItems = [
    {
      title: 'Supabase env',
      status: isSupabaseConfigured ? 'ready' : 'todo',
      note: isSupabaseConfigured ? 'ENV Vite sudah kebaca di app.' : 'Set VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Vercel.'
    },
    {
      title: 'SQL schema',
      status: 'scaffold',
      note: 'File SQL sudah ada dan perlu dijalankan berurutan di Supabase SQL Editor.'
    },
    {
      title: 'Commerce refund schema',
      status: restoredMerchOrderCount || merchRefundOrCancelCount ? 'ready' : 'scaffold',
      note: 'supabase-commerce-upgrade.sql sudah punya kolom ongkir, stock restore, refund timestamps, dan finance cash/shipping.'
    },
    {
      title: 'Catalog + commerce',
      status: 'ready',
      note: 'Rilisan, merch, transaksi, order, library, dan dashboard sudah punya flow UI + Supabase scaffold.'
    },
    {
      title: 'Payment gateway',
      status: paymentGatewayReadinessStatus,
      note: isManualPaymentMode
        ? `Manual admin-confirm aktif: ${waitingAdminPaymentRequests.length} waiting, ${manualConfirmedPaymentTransactions} paid manual. Set VITE_PAYMENT_PROVIDER + endpoint serverless untuk gateway.`
        : `${activePaymentGatewayProvider.title} dipilih. Endpoint ${paymentGatewayEndpointReady ? 'sudah diset' : 'belum diset'}, client key ${paymentGatewayClientReady ? 'ok/tidak wajib' : 'belum diset'}.`
    },
    {
      title: 'Asset storage',
      status: localAssetCount ? 'demo' : 'scaffold',
      note: localAssetCount ? `${localAssetCount} asset masih blob/data URL, biasanya fallback upload atau audio lama. Gambar public sudah diarahkan ke bucket band-assets.` : 'Gambar public sudah diarahkan ke bucket band-assets.'
    },
    {
      title: 'Private audio',
      status: privateAudioPathCount ? 'scaffold' : 'todo',
      note: privateAudioPathCount ? `${privateAudioPathCount} track punya private audio path. Library player meminta signed URL untuk owner/buyer/free full.` : 'MP3 sudah di-wire ke bucket release-audio; upload baru akan punya private path setelah SQL policy dijalankan.'
    },
    {
      title: 'Preview clips',
      status: publicPreviewClipCount ? 'scaffold' : 'todo',
      note: publicPreviewClipCount ? `${publicPreviewClipCount} track punya preview clip public terpisah. Ini menjaga master audio tetap private.` : 'Track berbayar sebaiknya punya file preview 30 detik di bucket release-previews.'
    },
    {
      title: 'Encrypted download',
      status: 'todo',
      note: 'Tombol secure download masih konsep UI, belum DRM/encrypted folder produksi.'
    },
    {
      title: 'Shipment tracking',
      status: merchOrders.some((order) => order.trackingNumber) ? 'scaffold' : 'demo',
      note: 'Band bisa input resi manual. API ekspedisi real-time belum tersambung.'
    },
    {
      title: 'Monthly finance report',
      status: monthlyFinanceReports.length ? 'ready' : paidSaleTransactions.length ? 'scaffold' : 'todo',
      note: monthlyFinanceReports.length ? `${monthlyFinanceReports.length} report lokal tersedia. Supabase report menyimpan cash collected dan shipping collected setelah SQL terbaru dijalankan.` : 'Generate report tanggal 1 setelah ada transaksi paid.'
    }
  ];
  const readinessStatusCounts = productionReadinessItems.reduce((counts, item) => ({
    ...counts,
    [item.status]: (counts[item.status] || 0) + 1
  }), {});
  const productionBlockers = productionReadinessItems.filter((item) => ['todo', 'demo'].includes(item.status));
  const storageHealthItems = [
    ['LOCAL/FALLBACK ASSET', localAssetCount, localAssetCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
    ['PRIVATE MASTER', `${privateAudioPathCount}/${totalReleaseTrackCount}`, privateAudioPathCount && privateAudioPathCount === totalReleaseTrackCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
    ['PUBLIC PREVIEW', `${publicPreviewClipCount}/${paidReleaseTrackCount}`, previewMissingTrackCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
    ['MISSING PREVIEW', previewMissingTrackCount, previewMissingTrackCount ? '#F1D4E5' : 'rgba(255,255,255,0.72)']
  ];
  const adminExclusivePosterPaidCount = Math.max(exclusivePosterTransactions.length, paidExclusivePosterGigs.length);
  const adminPlatformRevenue = adminMerchFeeRevenue + adminReleaseFeeRevenue + adminExclusivePosterRevenue;
  const bandsMissingPayoutAccount = publicBandProfiles.filter((profile) => (
    profile.isPublished && (!profile.bankName || !profile.bankAccountName || !profile.bankAccountNumber)
  ));
  const nextPayoutDate = new Date();
  nextPayoutDate.setMonth(nextPayoutDate.getMonth() + (nextPayoutDate.getDate() >= 1 ? 1 : 0), 1);
  const nextPayoutLabel = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(nextPayoutDate);
  const nextPayoutPeriodKey = `${nextPayoutDate.getFullYear()}-${String(nextPayoutDate.getMonth() + 1).padStart(2, '0')}`;
  const adminPayoutReportRows = adminPayoutBands.map((band) => {
    const profile = publicBandProfiles.find((item) => item.slug === band.slug || item.name === band.name) || {};
    return {
      ...band,
      bankName: profile.bankName || '',
      bankAccountName: profile.bankAccountName || '',
      bankAccountNumber: profile.bankAccountNumber || '',
      grossAmount: band.grossAmount || 0,
      shippingCost: band.shippingCost || 0,
      platformFee: band.platformFee || 0,
      ready: band.amount >= MINIMUM_PAYOUT_AMOUNT && profile.bankName && profile.bankAccountName && profile.bankAccountNumber
    };
  });
  const latestMonthlyFinanceReport = monthlyFinanceReports.find((report) => report.periodKey === nextPayoutPeriodKey) || monthlyFinanceReports[0] || null;
  const adminFinanceQuickActions = [
    {
      title: 'CONFIRM PAYMENT',
      count: waitingAdminPaymentRequests.length,
      note: 'Cek proof buyer, lalu confirm paid/reject.',
      action: () => setAdminActiveSection('payment'),
      color: waitingAdminPaymentRequests.length ? '#73BBC9' : 'rgba(255,255,255,0.72)'
    },
    {
      title: 'ORDER ADMIN SHIP',
      count: adminConsignmentOrderQueue.length,
      note: 'Order stok titipan yang harus diproses WiSpace.',
      action: () => setAdminActiveSection('shipment'),
      color: adminConsignmentOrderQueue.length ? '#73BBC9' : 'rgba(255,255,255,0.72)'
    },
    {
      title: 'ORDER BAND SHIP',
      count: adminBandShipOrderQueue.length,
      note: 'Pantau band yang harus proses pengiriman sendiri.',
      action: () => setAdminActiveSection('shipment'),
      color: adminBandShipOrderQueue.length ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'
    },
    {
      title: 'PAYOUT READY',
      count: adminPayoutReportRows.filter((band) => band.ready).length,
      note: `Siap dicek untuk report ${nextPayoutLabel}.`,
      action: () => setAdminActiveSection('finance'),
      color: adminPayoutReadyBands.length ? '#73BBC9' : 'rgba(255,255,255,0.72)'
    },
    {
      title: 'REKENING KOSONG',
      count: bandsMissingPayoutAccount.length,
      note: 'Follow up band yang belum lengkap rekening.',
      action: () => setAdminActiveSection('messages'),
      color: bandsMissingPayoutAccount.length ? '#F1D4E5' : 'rgba(255,255,255,0.72)'
    }
  ];
  const adminActionNotifications = [
    {
      title: 'PAYMENT BUYER PERLU CONFIRM',
      count: waitingAdminPaymentRequests.length,
      color: waitingAdminPaymentRequests.length ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)',
      note: 'Confirm paid dulu sebelum library/order aktif.'
    },
    {
      title: 'PAYOUT SIAP TANGGAL 1',
      count: adminPayoutReportRows.filter((band) => band.ready).length,
      color: 'rgba(255,255,255,0.72)',
      note: `Report berikutnya: ${nextPayoutLabel}.`
    },
    {
      title: 'REKENING BAND BELUM LENGKAP',
      count: bandsMissingPayoutAccount.length,
      color: 'rgba(255,255,255,0.72)',
      note: 'Band harus lengkapi rekening sebelum upload album/merch.'
    },
    {
      title: 'AGREEMENT RILISAN TEREKAM',
      count: releaseAgreements.length,
      color: '#73BBC9',
      note: 'Arsip legal per upload album/track.'
    },
    {
      title: 'PAMFLET PAID PERLU ACTIVATE',
      count: exclusivePaidWaitingActivationGigs.length,
      color: 'rgba(255,255,255,0.72)',
      note: 'Setelah pembayaran terkonfirmasi, admin activate 10 hari.'
    },
    {
      title: 'REPORT BULANAN TERAKHIR',
      count: monthlyFinanceReports.length,
      color: latestMonthlyFinanceReport ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)',
      note: latestMonthlyFinanceReport ? `${latestMonthlyFinanceReport.periodLabel} / ${latestMonthlyFinanceReport.rows.length} band.` : 'Belum pernah generate report.'
    }
  ];
  const adminNotificationQueue = [
    ...waitingAdminPaymentRequests.slice(0, 10).map((payment) => ({
      id: `pending-payment-${payment.id}`,
      title: isProviderPaidPendingActivation(payment) ? 'Provider paid perlu aktivasi' : 'Payment buyer perlu confirm paid',
      body: `${payment.productTitle} / ${payment.buyerName} / Rp ${Number(payment.amount || 0).toLocaleString('id-ID')} / ${payment.checkoutRef}${payment.providerStatus ? ` / ${String(payment.providerStatus).replaceAll('_', ' ')}` : ''}`,
      badge: 'PAYMENT',
      color: isProviderPaidPendingActivation(payment) ? '#73BBC9' : 'rgba(255,255,255,0.72)',
      targetSection: 'payment',
      actionType: 'confirm_payment',
      payment
    })),
    ...pendingGigs.slice(0, 6).map((gig) => ({
      id: `pending-gig-${gig.id}`,
      title: 'Pamflet baru perlu kurasi',
      body: `${gig.title} / ${gig.city || 'WiSpace'} / ${getGigDate(gig)}`,
      badge: 'PAMFLET',
      color: 'rgba(255,255,255,0.72)',
      targetSection: 'pamflet'
    })),
    ...exclusivePaidWaitingActivationGigs.slice(0, 6).map((gig) => ({
      id: `paid-gig-${gig.id}`,
      title: 'Pembayaran exclusive perlu activate',
      body: `${gig.title} sudah paid, aktifkan 10 hari setelah dicek.`,
      badge: 'PAYMENT',
      color: '#73BBC9',
      targetSection: 'pamflet'
    })),
    ...merchOrders.filter((order) => activeMerchFulfillmentStatuses.includes(order.trackingStatus)).slice(0, 6).map((order) => ({
      id: `merch-order-${order.id}`,
      title: 'Order merch perlu dipantau',
      body: `${order.itemName || 'Merch'} / ${order.sellerBandName || 'Band'} / ${order.orderId || order.id}`,
      badge: 'MERCH',
      color: 'rgba(255,255,255,0.72)',
      targetSection: 'shipment'
    })),
    ...bandsMissingPayoutAccount.slice(0, 6).map((profile) => ({
      id: `missing-bank-${profile.slug || profile.name}`,
      title: 'Rekening band belum lengkap',
      body: `${profile.name || 'Band WiSpace'} harus isi rekening sebelum upload dan payout.`,
      badge: 'BANK',
      color: 'rgba(255,255,255,0.72)',
      targetSection: 'legal'
    })),
    ...releaseAgreements.slice(0, 4).map((agreement) => ({
      id: `agreement-${agreement.id}`,
      title: 'Agreement rilisan terekam',
      body: `${agreement.releaseTitle} / ${agreement.bandName} / ${agreement.createdAt || 'baru'}`,
      badge: 'LEGAL',
      color: '#73BBC9',
      targetSection: 'legal'
    })),
    ...(latestMonthlyFinanceReport ? [{
      id: `latest-report-${latestMonthlyFinanceReport.id}`,
      title: 'Report bulanan siap diunduh',
      body: `${latestMonthlyFinanceReport.periodLabel} / ${latestMonthlyFinanceReport.rows.length} band / Rp ${Number(latestMonthlyFinanceReport.readyPayoutTotal || 0).toLocaleString('id-ID')} ready.`,
      badge: 'REPORT',
      color: 'rgba(255,255,255,0.72)',
      targetSection: 'finance'
    }] : [])
  ];
  const adminFinanceFilters = [
    { id: 'all', label: 'ALL', count: saleTransactions.length },
    { id: 'digital', label: 'RILISAN', count: adminDigitalTransactions.length },
    { id: 'merch', label: 'MERCH', count: adminMerchTransactions.length },
    { id: 'poster', label: 'PAMFLET', count: adminExclusivePosterPaidCount },
    { id: 'payout', label: 'PAYOUT', count: adminPayoutReadyBands.length }
  ];
  const getFinanceMonthKey = (transaction = {}) => {
    const rawDate = transaction.paidAt || transaction.createdAt || '';
    const parsedDate = rawDate ? new Date(rawDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return 'unknown';
    return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
  };
  const adminFinanceMonthOptions = Array.from(new Set(saleTransactions.map(getFinanceMonthKey)))
    .filter((key) => key !== 'unknown')
    .sort((first, second) => second.localeCompare(first));
  const formatFinanceMonthLabel = (monthKey = '') => {
    if (monthKey === 'all') return 'SEMUA BULAN';
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return 'TANGGAL LAMA';
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)).toUpperCase();
  };
  const adminFilteredTransactions = saleTransactions.filter((transaction) => {
    if (adminFinanceFilter === 'digital') return ['album', 'track'].includes(transaction.productType);
    if (adminFinanceFilter === 'merch') return transaction.productType === 'merch';
    if (adminFinanceFilter === 'poster') return transaction.productType === 'exclusive_poster';
    if (adminFinanceFilter === 'payout') return Number(transaction.bandNet || 0) > 0;
    return true;
  }).filter((transaction) => adminFinanceMonth === 'all' || getFinanceMonthKey(transaction) === adminFinanceMonth);
  const adminFilteredGrossTotal = adminFilteredTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0);
  const adminFilteredFeeTotal = adminFilteredTransactions.reduce((total, transaction) => total + Number(transaction.platformFee || 0), 0);
  const adminFilteredBandNetTotal = adminFilteredTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const openContentReports = contentReports.filter((report) => report.status !== 'resolved');
  const recentArticleComments = Object.entries(articleComments)
    .flatMap(([articleId, comments]) => (comments || []).map((comment) => ({
      ...comment,
      articleId,
      articleTitle: publicArticleList.find((article) => String(article.id) === String(articleId))?.title || 'Artikel WiSpace'
    })))
    .slice(0, 12);
  const isSubscribedToCurrentBand = subscribedBands.some((item) => item.slug === currentBandSlug);
  const subscribedBandUpdateNotifications = subscribedBands
    .flatMap((subscription) => (
      loadBandGlobalData(BAND_UPDATE_FEED_STORAGE_PREFIX, subscription.slug, [])
        .map((update) => ({
          ...update,
          id: `sub-${subscription.slug}-${update.id}`,
          sourceId: update.id,
          bandSlug: subscription.slug,
          bandName: update.bandName || subscription.name
        }))
    ))
    .filter((update) => !readSubscribedUpdateIds.includes(update.id))
    .slice(0, 8);
  const unreadBandNotifications = bandNotifications.filter((notification) => !notification.read).length;
  const isMessageForCurrentBand = (message) => {
    if (message.scope !== 'band') return false;
    if (!message.targetBandSlug || message.targetBandSlug === 'all') return true;
    return message.targetBandSlug === currentBandSlug || message.targetBandName === bandProfile.name || message.targetBandName === signatureName;
  };
  const visibleMessages = isBandAccount ? messages.filter(isMessageForCurrentBand) : messages.filter((message) => message.scope === 'audience');
  const adminSupportMessages = messages.filter((message) => message.scope === 'admin');
  const adminSentBandMessages = messages.filter((message) => message.scope === 'band' && message.source === 'admin');
  const bandAdminThreadMessages = isBandAccount
    ? messages.filter((message) => (
        (message.scope === 'admin' && (message.targetBandSlug === currentBandSlug || message.targetBandName === bandProfile.name || message.targetBandName === signatureName))
        || (message.scope === 'band' && message.source === 'admin' && isMessageForCurrentBand(message))
      ))
    : [];
  const unreadMessages = visibleMessages.filter((message) => !message.read).length;
  const unreadSubscribedUpdates = subscribedBandUpdateNotifications.length;
  const unreadNotificationTotal = unreadMessages + (isBandAccount ? unreadBandNotifications : unreadSubscribedUpdates);
  const markSubscribedUpdatesRead = () => {
    if (isBandAccount || !subscribedBandUpdateNotifications.length) return;
    const nextReads = [...new Set([...readSubscribedUpdateIds, ...subscribedBandUpdateNotifications.map((item) => item.id)])];
    setReadSubscribedUpdateIds(nextReads);
    persistSubscribedUpdateReadsLocal(nextReads);
    if (isSupabaseConfigured && userSession?.id) {
      const readRows = subscribedBandUpdateNotifications.map((item) => ({
        audience_user_id: userSession.id,
        notification_id: item.id
      }));
      void supabase.from('audience_notification_reads').upsert(readRows, { onConflict: 'audience_user_id,notification_id' }).then(({ error }) => {
        if (error && !isMissingColumnError(error)) console.warn('Gagal sync read notif subscriber:', error.message);
      });
    }
  };
  const toggleNotificationPopout = () => {
    setShowNotificationPopout((current) => !current);
  };
  const openNotificationCenter = () => {
    setShowNotificationPopout(false);
    navigateInternalPage('message_center');
    markMessagesAsRead();
    if (isBandAccount) markBandNotificationsRead();
    markSubscribedUpdatesRead();
  };
  const getNotificationTargetId = (notification = {}) => (
    notification.targetId
    || String(notification.sourceId || notification.id || '').replace(/^(release|merch|article|schedule)-/, '')
  );
  const openSubscribedUpdate = (notification) => {
    if (!notification) return;
    const targetId = getNotificationTargetId(notification);
    setShowNotificationPopout(false);
    markSubscribedUpdatesRead();

    if (notification.type === 'release') {
      const release = albumItems.find((album) => String(album.id) === String(targetId));
      if (release) {
        openReleaseDetail(release);
        return;
      }
      navigateInternalPage('explore', { exploreTab: 'rilisan' });
      return;
    }

    if (notification.type === 'merch') {
      const merch = publicMerchList.find((item) => String(item.id) === String(targetId));
      if (merch) {
        openMerchDetail(merch);
        return;
      }
      navigateInternalPage('explore', { exploreTab: 'merch' });
      return;
    }

    if (notification.type === 'article') {
      const article = publicArticleList.find((item) => String(item.id) === String(targetId));
      if (article) {
        openArticleReader(article);
        return;
      }
      navigateInternalPage('articles');
      return;
    }

    const profile = publicBandProfiles.find((item) => item.slug === notification.bandSlug) || {
      name: notification.bandName || 'Band WiSpace',
      slug: notification.bandSlug || createSlug(notification.bandName || 'band-wispace')
    };
    openBandPublicProfile(false, profile);
    if (notification.type === 'schedule') {
      window.setTimeout(() => document.getElementById('band-gig-schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  };
  const openNotificationPreview = (item) => {
    if (item?.notification) {
      openSubscribedUpdate(item.notification);
      return;
    }
    openNotificationCenter();
  };
  const notificationPreviewItems = [
    ...visibleMessages.filter((message) => !message.read).slice(0, 2).map((message) => ({
      id: `message-${message.id}`,
      label: 'MESSAGE',
      title: message.subject || message.sender || 'Pesan baru',
      body: message.body || message.contact || 'Ada pesan baru masuk.'
    })),
    ...(isBandAccount ? bandNotifications.filter((notification) => !notification.read).slice(0, 2).map((notification) => ({
      id: `band-${notification.id}`,
      label: 'BAND NOTIF',
      title: notification.title || 'Notif baru',
      body: notification.body || 'Ada update baru untuk band.'
    })) : subscribedBandUpdateNotifications.slice(0, 3).map((notification) => ({
      id: notification.id,
      label: 'SUBSCRIBED',
      title: notification.title || 'Update baru',
      body: notification.body || `${notification.bandName || 'Band'} punya update baru.`,
      notification
    })))
  ].slice(0, 3);

  useEffect(() => {
    const metricTimer = window.setTimeout(() => {
      const storedCount = loadBandGlobalData(BAND_SUBSCRIBER_COUNT_PREFIX, currentBandSlug, 0);
      const storedNotifications = loadBandGlobalData(BAND_NOTIFICATIONS_STORAGE_PREFIX, currentBandSlug, []);

      setBandSubscriberCount(Number(storedCount) || 0);
      setBandNotifications(Array.isArray(storedNotifications) ? storedNotifications : []);
    }, 0);

    return () => window.clearTimeout(metricTimer);
  }, [currentBandSlug]);

  useEffect(() => {
    const syncBandRoute = (event) => {
      const bandRouteMatch = window.location.pathname.match(/^\/band\/([^/]+)/);
      if (!bandRouteMatch) return;
      if (!event && activePage === 'band_profile') return;

      const routeSlug = decodeURIComponent(bandRouteMatch[1]);
      const ownSlug = createSlug(bandProfile.slug || bandProfile.name || signatureName || '');
      setViewedBandSlug(routeSlug);
      setShowAuthModal(false);
      setSearchTerm('');
      setIsViewingOwnBandProfile(Boolean(ownSlug && routeSlug === ownSlug && isBandAccount));
      setActivePage('band_public');
    };

    syncBandRoute();
    window.addEventListener('popstate', syncBandRoute);
    return () => window.removeEventListener('popstate', syncBandRoute);
  }, [activePage, bandProfile.name, bandProfile.slug, isBandAccount, signatureName]);

  useEffect(() => {
    const syncPublicRoute = () => {
      if (window.location.pathname.startsWith('/band/')) return;

      if (window.location.pathname === '/explore') {
        const routeTab = new URLSearchParams(window.location.search).get('tab') || 'rilisan';
        setExploreTab(['rilisan', 'band', 'artikel', 'merch'].includes(routeTab) ? routeTab : 'rilisan');
        setActivePage('explore');
        return;
      }

      if (window.location.pathname === '/articles') {
        setActivePage('articles');
        return;
      }

      if (window.location.pathname === '/merch') {
        setActivePage('merch_market');
        return;
      }

      if (window.location.pathname === '/me') {
        setActivePage('audience_profile');
        return;
      }

      if (window.location.pathname === '/library') {
        setActivePage('audience_library');
        return;
      }

      if (window.location.pathname === '/orders') {
        setActivePage('audience_orders');
        return;
      }

      if (window.location.pathname === '/inbox') {
        setActivePage('message_center');
        return;
      }

      if (window.location.pathname === '/studio') {
        const routeTab = new URLSearchParams(window.location.search).get('tab') || 'profile';
        setBandProfileTab(['profile', 'album', 'merch', 'artikel'].includes(routeTab) ? routeTab : 'profile');
        setActivePage('band_profile');
        return;
      }

      if (window.location.pathname === '/studio/gigs') {
        setActivePage('gig_manager');
        return;
      }

      if (window.location.pathname === '/studio/finance') {
        setActivePage('finance_dashboard');
        return;
      }

      if (window.location.pathname === '/') {
        setActivePage('home');
      }
    };

    syncPublicRoute();
    window.addEventListener('popstate', syncPublicRoute);
    return () => window.removeEventListener('popstate', syncPublicRoute);
  }, []);

  useEffect(() => {
    if (!supabaseOrigin || typeof document === 'undefined') return;
    const origin = supabaseOrigin.replace(/\/$/, '');
    ensureHeadElement(`link[rel="preconnect"][href="${origin}"]`, 'link', { rel: 'preconnect', href: origin, crossorigin: '' });
    ensureHeadElement(`link[rel="dns-prefetch"][href="${origin}"]`, 'link', { rel: 'dns-prefetch', href: origin });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const pagePath = window.location.pathname.startsWith('/band/')
      ? window.location.pathname
      : getPublicRoutePath(activePage, { exploreTab, bandTab: bandProfileTab });
    const pageUrl = `${WISPACE_SITE_URL}${pagePath}`;

    let nextTitle = 'WiSpace - Rilisan Digital, Gigs, dan Merch Band Indie';
    let nextDescription = 'WiSpace adalah wadah musisi indie untuk menjual album digital, menampilkan profile band, gigs, artikel skena, dan merchandise.';
    let nextImage = WISPACE_DEFAULT_IMAGE;
    let structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'WiSpace',
          url: WISPACE_SITE_URL,
          logo: `${WISPACE_SITE_URL}/favicon.svg`
        },
        {
          '@type': 'WebSite',
          name: 'WiSpace',
          url: WISPACE_SITE_URL,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${WISPACE_SITE_URL}/explore?tab=rilisan&q={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        }
      ]
    };

    if (isBandPublicPage && displayBandProfile?.name) {
      nextTitle = `${displayBandProfile.name} | WiSpace`;
      nextDescription = `${displayBandProfile.name} di WiSpace. ${displayBandProfile.genre || 'Band indie'} dari ${displayBandProfile.city || 'Indonesia'} dengan rilisan digital, promo track, jadwal manggung, dan merchandise.`;
      nextImage = displayBandProfile.coverPreview || displayBandProfile.photoPreview || WISPACE_DEFAULT_IMAGE;
      structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ProfilePage',
            name: `${displayBandProfile.name} | WiSpace`,
            url: pageUrl,
            mainEntity: {
              '@type': 'MusicGroup',
              name: displayBandProfile.name,
              genre: displayBandProfile.genre || 'Indie',
              description: displayBandProfile.bio || nextDescription,
              image: displayBandProfile.coverPreview || displayBandProfile.photoPreview || WISPACE_DEFAULT_IMAGE
            }
          }
        ]
      };
    } else if (activePage === 'explore') {
      nextTitle = `Explore ${String(exploreTab || 'rilisan').toUpperCase()} | WiSpace`;
      nextDescription = 'Jelajahi rilisan digital, direktori band, artikel skena, dan merchandise musisi indie di WiSpace.';
    } else if (activePage === 'articles') {
      nextTitle = selectedArticle?.title ? `${selectedArticle.title} | WiSpace NewsSpace` : 'NewsSpace | WiSpace';
      nextDescription = selectedArticle?.excerpt || selectedArticle?.body?.slice(0, 180) || 'NewsSpace berisi artikel, catatan rilisan, dan cerita skena band indie di WiSpace.';
    } else if (activePage === 'merch_market') {
      nextTitle = 'Merch Band Indie | WiSpace';
      nextDescription = 'Etalase merchandise band indie di WiSpace. Temukan kaos, rilisan fisik, dan item resmi langsung dari musisi.';
    } else if (selectedRelease?.title) {
      nextTitle = `${selectedRelease.title} | WiSpace`;
      nextDescription = `${selectedRelease.bandName || 'Band WiSpace'} merilis ${selectedRelease.title} di WiSpace. Dengarkan preview, beli album digital, dan cek detail track.`;
      nextImage = selectedRelease.coverPreview || WISPACE_DEFAULT_IMAGE;
    } else if (selectedMerchDetail?.name) {
      nextTitle = `${selectedMerchDetail.name} | WiSpace`;
      nextDescription = `${selectedMerchDetail.bandName || 'Band WiSpace'} menjual ${selectedMerchDetail.name} di WiSpace. Cek detail merch dan ketersediaan stock.`;
      nextImage = selectedMerchDetail.imagePreview || WISPACE_DEFAULT_IMAGE;
    }

    const titleElement = ensureHeadElement('title', 'title');
    titleElement.textContent = nextTitle;
    setHeadMeta('meta[name="description"]', { name: 'description' }, nextDescription);
    setHeadMeta('meta[name="robots"]', { name: 'robots' }, 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setHeadMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'WiSpace');
    setHeadMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
    setHeadMeta('meta[property="og:title"]', { property: 'og:title' }, nextTitle);
    setHeadMeta('meta[property="og:description"]', { property: 'og:description' }, nextDescription);
    setHeadMeta('meta[property="og:url"]', { property: 'og:url' }, pageUrl);
    setHeadMeta('meta[property="og:image"]', { property: 'og:image' }, nextImage);
    setHeadMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
    setHeadMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, nextTitle);
    setHeadMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, nextDescription);
    setHeadMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, nextImage);
    ensureHeadElement('link[rel="canonical"]', 'link', { rel: 'canonical', href: pageUrl });

    const structuredDataTag = ensureHeadElement('script#wispace-structured-data', 'script', { id: 'wispace-structured-data', type: 'application/ld+json' });
    structuredDataTag.textContent = JSON.stringify(structuredData);
  }, [
    activePage,
    exploreTab,
    bandProfileTab,
    isBandPublicPage,
    displayBandProfile?.name,
    displayBandProfile?.genre,
    displayBandProfile?.city,
    displayBandProfile?.bio,
    displayBandProfile?.coverPreview,
    displayBandProfile?.photoPreview,
    selectedArticle?.title,
    selectedArticle?.excerpt,
    selectedArticle?.body,
    selectedRelease?.title,
    selectedRelease?.bandName,
    selectedRelease?.coverPreview,
    selectedMerchDetail?.name,
    selectedMerchDetail?.bandName,
    selectedMerchDetail?.imagePreview
  ]);

  const accountDisplayName = isBandAccount
    ? (bandProfile.name || signatureName || 'BAND')
    : (audienceProfile.displayName || userSession?.email?.split('@')[0] || 'USER');
  const accountPhoto = isBandAccount ? bandProfile.photoPreview : audienceProfile.photoPreview;
  const playerSeekMax = activeTrack
    ? activeTrack.freeFull || activeTrack.isOwned
      ? Math.max(playerDuration || 0, playerCurrentTime || 0)
      : Math.max(1, Math.min(playerDuration || 30, 30))
    : 0;
  const playerSeekValue = Math.min(playerCurrentTime || 0, playerSeekMax || 0);
  const renderProfileChip = (avatarSize = 20, maxLabelWidth = '120px') => (
    <>
      <span style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: '9999px', overflow: 'hidden', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.65)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {accountPhoto ? (
          <img src={accountPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <User size={Math.max(12, avatarSize - 8)} color="#73BBC9" />
        )}
      </span>
      <span style={{ maxWidth: maxLabelWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {accountDisplayName.toUpperCase()}
      </span>
    </>
  );
  const renderGigPosterImage = (gig, style, label = 'NO PAMFLET') => (
    gig?.image ? (
      <img src={gig.image} alt="" loading="lazy" decoding="async" style={style} />
    ) : (
      <div style={{ ...style, display: 'grid', placeItems: 'center', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', textAlign: 'center' }}>
        {label}
      </div>
    )
  );
  const renderCompactSearchResults = (placement = 'inline') => {
    const isFixedPlacement = placement === 'fixed';
    return (
    <div style={isFixedPlacement ? { position: 'fixed', top: isTinyLayout ? '64px' : '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 1450, width: isTinyLayout ? 'calc(100vw - 24px)' : 'min(360px, calc(100vw - 40px))', padding: '10px', backgroundColor: 'rgba(8,2,2,0.98)', border: '1px solid rgba(115,187,201,0.24)', borderRadius: '12px', boxShadow: '0 14px 34px rgba(8,2,2,0.38)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxSizing: 'border-box' } : { position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 260, padding: '10px', backgroundColor: 'rgba(8,2,2,0.96)', border: '1px solid rgba(115,187,201,0.22)', borderRadius: '12px', boxShadow: 'none', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
        <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>FIND RESULTS / {totalSearchMatches}</p>
        <button type="button" onClick={closeSearchUi} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLEAR</button>
      </div>
      {quickSearchResults.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>Belum ketemu. Coba nama band, genre, judul lagu, artikel, atau merch.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {searchCategorySummaries.filter((item) => item.count > 0).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSearchExplore(item.id)}
                style={{ background: 'rgba(115,187,201,0.08)', border: '1px solid rgba(115,187,201,0.18)', color: '#F8F7F8', borderRadius: '9999px', padding: '5px 8px', fontSize: '8px', fontWeight: '900', letterSpacing: '0.7px', cursor: 'pointer', fontFamily: FONT_STACK }}
              >
                {item.label} / {item.count}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: '6px', maxHeight: isTinyLayout ? '220px' : '260px', overflowY: 'auto' }}>
            {quickSearchResults.slice(0, 6).map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={result.onSelect}
                style={{ textAlign: 'left', padding: '7px 0', backgroundColor: 'transparent', border: 'none', borderTop: `1.5px solid ${flatLineColor}`, borderRadius: 0, cursor: 'pointer', fontFamily: FONT_STACK, display: 'grid', gap: '3px' }}
              >
                <span style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900', letterSpacing: '1px' }}>{result.type}</span>
                <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(result.title || '').toUpperCase()}</span>
                <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '700', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.meta}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => openSearchExplore(searchPrimaryCategory?.id || 'rilisan')}
            style={{ width: '100%', marginTop: '9px', background: 'rgba(241,212,229,0.05)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '9px', padding: '8px 10px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}
          >
            BUKA HASIL DI {String(searchPrimaryCategory?.label || 'EXPLORE').toUpperCase()}
          </button>
        </>
      )}
    </div>
  );
  };

  const openProfileModal = () => {
    if (isBandAccount) {
      if (hasSignedContract) {
        openBandPublicProfile(true);
        return;
      }

      setAuthType('legalitas_musisi');
      setShowAuthModal(true);
      return;
    }

    setShowAuthModal(false);
    openAudienceWorkspace('audience_profile');
  };

  // STYLING INTERFACE ASYMMETRIC ROUNDED `16PX`
  const glassStyle = (id) => ({
    background: hoveredCard === id ? 'rgba(8, 2, 2, 0.86)' : 'rgba(8, 2, 2, 0.74)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderRadius: '10px',
    border: hoveredCard === id ? '1px solid rgba(115, 187, 201, 0.3)' : '1px solid rgba(115, 187, 201, 0.11)',
    boxShadow: hoveredCard === id ? '0 14px 34px rgba(0, 0, 0, 0.34)' : 'none',
    transition: 'background 0.22s ease, border-color 0.22s ease, transform 0.22s ease'
  });

  const glassButtonStyle = {
    background: 'rgba(241, 212, 229, 0.025)',
    border: '1px solid rgba(115, 187, 201, 0.28)',
    color: '#73BBC9',
    cursor: 'pointer',
    borderRadius: '9px',
    fontWeight: '900',
    letterSpacing: '0.4px',
    fontFamily: FONT_STACK,
    boxShadow: 'none',
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease'
  };

  const formInputStyle = {
    width: '100%',
    backgroundColor: 'rgba(8,2,2,0.94)',
    border: '1px solid rgba(115,187,201,0.16)',
    borderRadius: '9px',
    padding: '10px',
    fontSize: '12px',
    color: '#F8F7F8',
    fontFamily: FONT_STACK,
    boxSizing: 'border-box',
    outline: 'none'
  };

  const isCompactLayout = viewportWidth < 820;
  const isTinyLayout = viewportWidth < 560;
  const innerPagePadding = isTinyLayout ? '82px 12px 18px' : isCompactLayout ? '84px 18px 22px' : '86px 24px 28px';
  const splitGridColumns = isCompactLayout ? '1fr' : 'minmax(260px, 1.25fr) minmax(240px, 0.75fr)';
  const studioGridColumns = isCompactLayout ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))';
  const releaseExploreGridColumns = isCompactLayout ? '1fr' : 'minmax(0, 1fr) minmax(220px, 300px)';
  const publicBandHeroColumns = isTinyLayout ? '1fr' : '136px minmax(0, 1fr)';
  const publicBandAvatarSize = isTinyLayout ? 104 : 136;
  const libraryDetailGridColumns = isCompactLayout ? '1fr' : 'minmax(0, 1.08fr) minmax(248px, 0.72fr)';
  const articleGridColumns = isCompactLayout ? '1fr' : 'minmax(0, 1.4fr) minmax(260px, 0.6fr)';
  const flatLineColor = 'rgba(115,187,201,0.18)';
  const softSurfaceBackground = 'linear-gradient(135deg, rgba(241,212,229,0.03), rgba(115,187,201,0.07) 36%, rgba(241,212,229,0.055) 68%, rgba(8,2,2,0.78) 100%)';
  const softRowBackground = 'linear-gradient(90deg, rgba(115,187,201,0.07), rgba(241,212,229,0.045) 48%, rgba(8,2,2,0.24) 100%)';
  const flatSurfaceStyle = {
    background: softSurfaceBackground,
    border: 'none',
    borderTop: `1.5px solid ${flatLineColor}`,
    borderLeft: '1px solid rgba(115,187,201,0.12)',
    borderRadius: '8px',
    boxShadow: 'inset 0 1px 0 rgba(241,212,229,0.03)'
  };
  const compactPanelStyle = { ...flatSurfaceStyle, padding: isTinyLayout ? '10px' : '12px', marginBottom: isTinyLayout ? '10px' : '12px' };
  const compactMetricCardStyle = { ...flatSurfaceStyle, padding: isTinyLayout ? '8px 9px' : '10px 11px', minWidth: 0 };
  const compactMetricLabelStyle = { color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', margin: '0 0 4px 0', lineHeight: 1.15 };
  const compactMetricValueStyle = { color: '#F8F7F8', fontSize: isTinyLayout ? '16px' : '19px', fontWeight: '900', lineHeight: 1 };
  const compactRowStyle = { ...flatSurfaceStyle, padding: isTinyLayout ? '8px 9px' : '9px 10px' };
  const flatListStyle = { display: 'grid', gap: isTinyLayout ? '8px' : '10px' };
  const flatItemStyle = {
    display: 'grid',
    alignItems: 'center',
    gap: isTinyLayout ? '8px' : '10px',
    padding: isTinyLayout ? '7px 8px' : '8px 9px',
    background: softRowBackground,
    border: 'none',
    borderTop: `1.5px solid ${flatLineColor}`,
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: FONT_STACK,
    minWidth: 0
  };
  const railPanelStyle = {
    padding: isTinyLayout ? '8px 0 8px 12px' : '10px 0 10px 16px',
    borderLeft: `2px solid ${flatLineColor}`,
    background: 'transparent'
  };
  const compactVisualGridStyle = {
    display: 'grid',
    gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(142px, 1fr))',
    gap: isTinyLayout ? '8px' : '9px'
  };
  const compactVisualCardStyle = {
    background: softSurfaceBackground,
    border: '1.5px solid rgba(241,212,229,0.14)',
    borderRadius: '8px',
    padding: isTinyLayout ? '7px' : '8px',
    cursor: 'pointer',
    minWidth: 0,
    boxShadow: 'inset 0 1px 0 rgba(241,212,229,0.035)'
  };
  const articleCardGridStyle = {
    display: 'grid',
    gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(186px, 224px))',
    gap: isTinyLayout ? '8px' : '10px',
    justifyContent: isTinyLayout ? 'stretch' : 'start'
  };
  const articleCardStyle = {
    ...compactVisualCardStyle,
    padding: isTinyLayout ? '8px' : '9px',
    display: 'grid',
    gap: isTinyLayout ? '8px' : '9px',
    alignContent: 'start'
  };
  const flatThumbStyle = {
    overflow: 'hidden',
    backgroundColor: '#080202',
    border: `1.5px solid ${flatLineColor}`,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0
  };
  const homeShellPadding = isTinyLayout ? '12px' : '20px';
  const homeHeroHeight = isTinyLayout ? 'calc(100vh - 88px)' : 'calc(100vh - 96px)';
  const homeHeaderStyle = {
    position: 'absolute',
    top: isTinyLayout ? '16px' : '30px',
    left: isTinyLayout ? '16px' : '30px',
    right: isTinyLayout ? '16px' : '30px',
    zIndex: 100,
    display: isTinyLayout ? 'grid' : 'flex',
    gridTemplateColumns: isTinyLayout ? 'auto minmax(0, 1fr)' : undefined,
    gridTemplateAreas: isTinyLayout ? '"brand nav" "search search"' : undefined,
    justifyContent: 'space-between',
    alignItems: isTinyLayout ? 'stretch' : 'center',
    gap: isTinyLayout ? '12px' : '20px',
    background: 'transparent',
    opacity: isScrolled ? 0 : 1,
    pointerEvents: isScrolled ? 'none' : 'auto',
    transition: 'opacity 0.4s ease-in-out'
  };
  const homeBrandWrapStyle = {
    gridArea: isTinyLayout ? 'brand' : undefined,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0
  };
  const homeSearchWrapStyle = {
    position: isTinyLayout ? 'relative' : 'absolute',
    gridArea: isTinyLayout ? 'search' : undefined,
    left: isTinyLayout ? 'auto' : '50%',
    transform: isTinyLayout ? 'none' : 'translateX(-50%)',
    width: '100%',
    maxWidth: isTinyLayout ? 'none' : '360px',
    display: 'flex',
    alignItems: 'center',
    gap: isTinyLayout ? '8px' : '0',
    minWidth: 0
  };
  const homeNavStyle = {
    gridArea: isTinyLayout ? 'nav' : undefined,
    display: 'flex',
    gap: isTinyLayout ? '8px' : '20px',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: isTinyLayout ? '100%' : 'auto',
    flexWrap: 'nowrap',
    minWidth: 0
  };
  const homeFloatingWrapStyle = {
    position: 'fixed',
    top: isTinyLayout ? '12px' : '30px',
    left: isTinyLayout ? '12px' : 'auto',
    right: isTinyLayout ? '12px' : '30px',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: isTinyLayout ? 'stretch' : 'flex-end',
    opacity: isScrolled ? 1 : 0,
    transform: isScrolled ? 'translateY(0)' : 'translateY(-20px)',
    pointerEvents: isScrolled ? 'auto' : 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
  };
  const homeFloatingBadgeStyle = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: isTinyLayout ? 'wrap' : 'nowrap',
    gap: isTinyLayout ? '8px' : '12px',
    padding: isTinyLayout ? '7px 9px' : '8px 12px',
    background: 'linear-gradient(135deg, rgba(8,2,2,0.9), rgba(8,2,2,0.78) 52%, rgba(115,187,201,0.055) 100%)',
    border: '1px solid rgba(115,187,201,0.2)',
    borderRadius: '9999px',
    boxShadow: '0 12px 36px rgba(0,0,0,0.22), 0 0 30px rgba(115,187,201,0.055), inset 0 1px 0 rgba(241,212,229,0.04)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    width: isTinyLayout ? '100%' : 'auto',
    boxSizing: 'border-box'
  };
  const homeRevealStyle = (delay = 0) => ({
    animation: `wispaceRise 720ms cubic-bezier(0.18, 0.92, 0.22, 1.12) ${delay}ms both`,
    animationTimeline: 'view()',
    animationRange: 'entry 0% cover 34%'
  });
  const homeHeroContentStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    background: 'linear-gradient(90deg, rgba(8,2,2,0.84) 0%, rgba(8,2,2,0.38) 56%, rgba(8,2,2,0.12) 100%), linear-gradient(to top, rgba(8,2,2,0.98) 0%, rgba(8,2,2,0.42) 58%, rgba(8,2,2,0.06) 100%)',
    padding: isTinyLayout ? '24px 18px' : '46px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end'
  };
  const ownerActionsPanelStyle = {
    ...glassStyle('band-owner-actions'),
    padding: isTinyLayout ? '7px' : '8px',
    background: softSurfaceBackground,
    marginBottom: isTinyLayout ? '10px' : '12px',
    display: showBandOwnerControls ? 'block' : 'none',
    borderRadius: '10px'
  };
  const ownerActionsGridStyle = {
    display: 'grid',
    gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(118px, 1fr))',
    gap: isTinyLayout ? '7px' : '8px'
  };
  const ownerActionButtonStyle = {
    ...glassButtonStyle,
    padding: isTinyLayout ? '7px 6px' : '8px 7px',
    fontSize: '9px',
    lineHeight: 1.15,
    borderRadius: '9px',
    minHeight: isTinyLayout ? '30px' : '32px'
  };
  const renderMerchOrderStepper = (status = 'order_paid_waiting_band') => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MERCH_ORDER_FLOW_STEPS.length}, minmax(0, 1fr))`, gap: '5px', marginTop: '8px' }}>
      {MERCH_ORDER_FLOW_STEPS.map((step) => {
        const isActive = step.statuses.includes(status);
        return (
          <div key={step.id} style={{ borderTop: `2px solid ${isActive ? getMerchOrderStatusColor(status) : 'rgba(241,212,229,0.1)'}`, paddingTop: '5px' }}>
            <p style={{ color: isActive ? '#F1D4E5' : 'rgba(255,255,255,0.46)', fontSize: '8px', fontWeight: '900', margin: 0, letterSpacing: '0.4px' }}>{step.label}</p>
          </div>
        );
      })}
    </div>
  );

  const pageShellStyle = {
    minHeight: 'calc(100vh - 40px)',
    padding: innerPagePadding,
    background: 'linear-gradient(160deg, rgba(115,187,201,0.04) 0%, rgba(8,2,2,0) 32%, rgba(241,212,229,0.032) 100%)',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'inset 0 1px 0 rgba(115,187,201,0.035)',
    position: 'relative',
    zIndex: 1
  };

  const ambientLayerStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    background: `
      radial-gradient(circle at 16% 12%, rgba(115,187,201,0.11), rgba(115,187,201,0.04) 16%, transparent 34%),
      radial-gradient(circle at 82% 16%, rgba(241,212,229,0.1), rgba(241,212,229,0.038) 14%, transparent 30%),
      radial-gradient(circle at 72% 82%, rgba(115,187,201,0.06), transparent 30%),
      radial-gradient(circle at 24% 78%, rgba(241,212,229,0.06), transparent 28%),
      linear-gradient(115deg, transparent 0%, rgba(241,212,229,0.016) 42%, transparent 66%)
    `,
    opacity: isTinyLayout ? 0.52 : 0.62
  };

  const ambientLineStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(115deg, transparent 0%, transparent 42%, rgba(115,187,201,0.035) 42.2%, transparent 43.4%, transparent 100%),
      linear-gradient(65deg, transparent 0%, transparent 58%, rgba(241,212,229,0.028) 58.2%, transparent 59.2%, transparent 100%),
      linear-gradient(90deg, rgba(241,212,229,0.012) 1px, transparent 1px),
      linear-gradient(180deg, rgba(241,212,229,0.01) 1px, transparent 1px)
    `,
    backgroundSize: '100% 100%, 100% 100%, 92px 92px, 92px 92px',
    maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.48), rgba(0,0,0,0.12) 34%, rgba(0,0,0,0.26) 100%)',
    WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.48), rgba(0,0,0,0.12) 34%, rgba(0,0,0,0.26) 100%)',
    opacity: isTinyLayout ? 0.18 : 0.26
  };

  const pageHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '14px',
    marginBottom: isTinyLayout ? '14px' : '16px',
    flexWrap: 'wrap',
    borderBottom: 'none',
    paddingBottom: 0
  };

  const eyebrowStyle = {
    color: '#73BBC9',
    fontSize: '9px',
    fontWeight: '900',
    letterSpacing: '1px',
    margin: '0 0 5px 0'
  };

  const pageTitleStyle = {
    color: '#F8F7F8',
    fontSize: 'clamp(20px, 3.1vw, 31px)',
    fontWeight: '900',
    margin: 0,
    lineHeight: 0.95
  };

  const pageLeadStyle = {
    color: 'rgba(255,255,255,0.72)',
    fontSize: '11px',
    margin: '6px 0 0 0',
    maxWidth: '520px',
    lineHeight: 1.42
  };

  const sectionHeadingStyle = {
    color: '#F8F7F8',
    fontSize: '12px',
    fontWeight: '900',
    margin: '0 0 9px 0',
    letterSpacing: '0.9px'
  };
  const compactSurfaceStyle = {
    background: softSurfaceBackground,
    border: '1.5px solid rgba(241,212,229,0.14)',
    borderRadius: '8px',
    boxShadow: 'inset 0 1px 0 rgba(241,212,229,0.035)'
  };
  const bandArchivePanelStyle = {
    ...compactSurfaceStyle,
    borderRadius: '9px',
    borderTop: '1.5px solid rgba(115,187,201,0.18)',
    borderLeft: '1px solid rgba(115,187,201,0.12)',
    boxShadow: 'inset 0 1px 0 rgba(241,212,229,0.03)'
  };
  const checkoutBlockStyle = {
    ...compactSurfaceStyle,
    padding: isTinyLayout ? '10px' : '12px'
  };
  const modalPanelStyle = {
    background: 'linear-gradient(145deg, rgba(8,2,2,0.98), rgba(8,2,2,0.97) 58%, rgba(115,187,201,0.08) 100%)',
    border: '1.5px solid rgba(115,187,201,0.22)',
    boxShadow: '0 18px 46px rgba(0,0,0,0.48), inset 0 1px 0 rgba(241,212,229,0.045)'
  };

  const exploreCopy = {
    rilisan: {
      eyebrow: 'WISPACE RELEASES',
      title: 'RILISAN DIGITAL',
      lead: 'Rilisan digital terbaru.'
    },
    band: {
      eyebrow: 'WISPACE BAND INDEX',
      title: 'BAND DIRECTORY',
      lead: 'Profil band di WiSpace.'
    },
    artikel: {
      eyebrow: 'WISPACE ARTICLES',
      title: 'ARTIKEL SKENA',
      lead: 'Cerita, rilisan, dan catatan skena.'
    },
    merch: {
      eyebrow: 'WISPACE DISTRO',
      title: 'MERCH BAND',
      lead: 'Etalase merch band.'
    }
  };

  const activeExploreCopy = exploreCopy[exploreTab] || exploreCopy.rilisan;

  return (
    <div style={{ background: 'radial-gradient(circle at 16% 0%, rgba(115,187,201,0.18), transparent 34%), radial-gradient(circle at 88% 18%, rgba(241,212,229,0.10), transparent 30%), linear-gradient(180deg, #080202 0%, #080202 54%, rgba(8,2,2,0.96) 100%)', color: '#F8F7F8', minHeight: '100vh', padding: homeShellPadding, fontFamily: FONT_STACK, boxSizing: 'border-box', position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @keyframes wispaceRise {
          0% { opacity: 0; transform: translateY(34px) scale(0.985); }
          62% { opacity: 1; transform: translateY(-5px) scale(1.006); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={ambientLayerStyle} />
      <div style={ambientLineStyle} />
      {loading && (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '24px' : '40px', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gap: '14px', justifyItems: 'center', textAlign: 'center', maxWidth: '420px' }}>
            <img src={WISPACE_LOGO_SRC} alt="WiSpace" width="150" height="40" decoding="async" style={{ width: isTinyLayout ? '120px' : '150px', height: 'auto', display: 'block' }} />
            <div style={{ width: '56px', height: '2px', borderRadius: '9999px', background: 'linear-gradient(90deg, rgba(115,187,201,0.1), rgba(115,187,201,0.92), rgba(241,212,229,0.1))' }} />
            <p style={{ margin: 0, color: '#F8F7F8', fontSize: isTinyLayout ? '14px' : '15px', fontWeight: '900', letterSpacing: '0.4px' }}>LOADING WISPACE</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.55 }}>Sedang menyiapkan WiSpace.</p>
          </div>
        </div>
      )}
      {!isSupabaseConfigured && (
        <div style={{ position: 'fixed', left: '20px', right: '20px', bottom: '20px', zIndex: 2000, padding: '14px 16px', backgroundColor: 'rgba(241,212,229,0.12)', border: '1px solid rgba(241,212,229,0.45)', borderRadius: '14px', color: '#F8F7F8', fontSize: '12px', fontWeight: '900', lineHeight: 1.4, boxShadow: '0 18px 45px rgba(8,2,2,0.45)' }}>
          SUPABASE ENV BELUM DISET DI HOSTING. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Vercel, lalu redeploy.
        </div>
      )}
      
      {/* ========================================================
          FIXED FLOATING BADGE (IKON CYBER-LINE & KONTROL SMART ROLE)
         ======================================================== */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isAudienceOrdersPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={homeFloatingWrapStyle}>
          <div style={homeFloatingBadgeStyle}>
            <span onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap' }}>WI.ID UP</span>
            <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan', clearSearch: true })} style={{ background: 'none', border: 'none', borderBottom: '1px solid transparent', color: '#F8F7F8', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, padding: '6px 2px', whiteSpace: 'nowrap' }}>EXPLORE</button>
            
            {!userSession ? (
              <>
                <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', borderBottom: '1px solid transparent', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, padding: '6px 2px', whiteSpace: 'nowrap' }}>LOGIN</button>
                <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(115,187,201,0.8)', color: '#73BBC9', padding: '6px 2px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>JOIN</button>
              </>
            ) : (
              <>
                <button title="Notifications" onClick={toggleNotificationPopout} style={{ position: 'relative', background: 'transparent', border: 'none', color: unreadNotificationTotal || showNotificationPopout ? '#73BBC9' : '#F1D4E5', borderRadius: '9999px', width: '28px', height: '28px', display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: FONT_STACK, flexShrink: 0 }}>
                  <Bell size={14} />
                  {unreadNotificationTotal > 0 && <span style={{ position: 'absolute', top: '-7px', right: '-7px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#F1D4E5', color: '#080202', fontSize: '9px', display: 'grid', placeItems: 'center', fontWeight: '900', lineHeight: 1 }}>{unreadNotificationTotal > 9 ? '9+' : unreadNotificationTotal}</span>}
                </button>
                <button onClick={openProfileModal} style={{ background: 'none', border: 'none', color: '#F8F7F8', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_STACK, minWidth: 0 }}>{renderProfileChip(28, '110px')}</button>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT_STACK }}><LogOut size={13}/> LOGOUT</button>
              </>
            )}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', width: isTinyLayout ? '100%' : 'auto', justifyContent: isTinyLayout ? 'flex-end' : 'flex-start' }}>
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchSubmit} onFocus={() => setIsSearchExpanded(true)} onBlur={() => { if(!searchTerm) setIsSearchExpanded(false); }} style={{ backgroundColor: 'rgba(8, 2, 2, 0.95)', border: '1px solid rgba(241,212,229,0.15)', borderRadius: '9999px', padding: isSearchExpanded ? '6px 12px' : '0px', width: isSearchExpanded ? (isTinyLayout ? 'calc(100% - 78px)' : '180px') : '0px', opacity: isSearchExpanded ? 1 : 0, fontSize: '11px', color: '#F8F7F8', outline: 'none', fontFamily: FONT_STACK, transition: 'all 0.3s ease', boxSizing: 'border-box' }} />
            <div onClick={() => { if (normalizedSearchTerm && !isAdminPage) { openSearchExplore(searchPrimaryCategory?.id || 'rilisan'); return; } setIsSearchExpanded(!isSearchExpanded); }} style={{ padding: '6px 10px', backgroundColor: 'rgba(115,187,201,0.12)', color: '#F8F7F8', border: '1px solid rgba(115,187,201,0.24)', borderRadius: '9999px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: 'none' }}><Search size={12}/> FIND</div>
            {normalizedSearchTerm && !isAdminPage && renderCompactSearchResults()}
          </div>
        </div>
      )}

      {/* STICKY TOP MENU UNTUK PAGE DALAM */}
      {!isAdminPage && (isBandProfilePage || isBandPublicPage || isFinancePage || isGigManagerPage || isMessagePage || isAudienceProfilePage || isAudienceLibraryPage || isAudienceOrdersPage || isExplorePage || isMerchMarketPage || isArticlesPage) && !loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: isTinyLayout ? 'flex-start' : 'center', gap: isTinyLayout ? '8px' : '14px', padding: isTinyLayout ? '10px 12px' : '12px 28px', opacity: 1, pointerEvents: 'auto', transition: 'all 0.35s ease', background: 'linear-gradient(90deg, rgba(8,2,2,0.94), rgba(8,2,2,0.88) 48%, rgba(8,2,2,0.94) 100%)', border: 'none', borderBottom: '1px solid rgba(115,187,201,0.18)', borderRadius: 0, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 12px 34px rgba(0,0,0,0.24), 0 1px 0 rgba(241,212,229,0.035), inset 0 -1px 0 rgba(115,187,201,0.05)', width: '100vw', maxWidth: '100vw', boxSizing: 'border-box', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button onClick={() => navigateInternalPage('home', { clearSearch: true })} style={{ background: 'transparent', border: 'none', color: '#73BBC9', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>WISPACE</button>
          {[
            ['rilisan', 'RILISAN'],
            ['band', 'BAND'],
            ['artikel', 'ARTIKEL'],
            ['merch', 'MERCH']
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => navigateInternalPage('explore', { exploreTab: tab, clearSearch: true })}
              style={{ background: activePage === 'explore' && exploreTab === tab ? 'linear-gradient(180deg, rgba(115,187,201,0.12), rgba(115,187,201,0.035))' : 'transparent', border: 'none', borderBottom: activePage === 'explore' && exploreTab === tab ? '1px solid rgba(115,187,201,0.95)' : '1px solid transparent', borderRadius: 0, color: activePage === 'explore' && exploreTab === tab ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap', padding: '8px 7px 7px', boxShadow: activePage === 'explore' && exploreTab === tab ? '0 8px 22px rgba(115,187,201,0.08)' : 'none' }}
            >
              {label}
            </button>
          ))}
          {showAudienceCommerceNav && (
            <>
              <button onClick={() => navigateInternalPage('audience_library')} style={{ background: activePage === 'audience_library' ? 'linear-gradient(180deg, rgba(115,187,201,0.12), rgba(115,187,201,0.035))' : 'transparent', border: 'none', borderBottom: activePage === 'audience_library' ? '1px solid rgba(115,187,201,0.85)' : '1px solid transparent', borderRadius: 0, color: activePage === 'audience_library' ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap', padding: '8px 7px 7px', boxShadow: activePage === 'audience_library' ? '0 8px 22px rgba(115,187,201,0.08)' : 'none' }}>LIBRARY</button>
              <button onClick={() => navigateInternalPage('audience_orders')} style={{ background: activePage === 'audience_orders' ? 'linear-gradient(180deg, rgba(115,187,201,0.12), rgba(115,187,201,0.035))' : 'transparent', border: 'none', borderBottom: activePage === 'audience_orders' ? '1px solid rgba(115,187,201,0.85)' : '1px solid transparent', borderRadius: 0, color: activePage === 'audience_orders' ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap', padding: '8px 7px 7px', boxShadow: activePage === 'audience_orders' ? '0 8px 22px rgba(115,187,201,0.08)' : 'none' }}>ORDERS</button>
              <button title="Notifications" onClick={toggleNotificationPopout} style={{ position: 'relative', background: 'transparent', border: 'none', color: unreadNotificationTotal || showNotificationPopout ? '#73BBC9' : '#F1D4E5', borderRadius: '9999px', width: '30px', height: '30px', display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: FONT_STACK, flexShrink: 0 }}>
                <Bell size={14} />
                {unreadNotificationTotal > 0 && <span style={{ position: 'absolute', top: '-7px', right: '-7px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#F1D4E5', color: '#080202', fontSize: '9px', display: 'grid', placeItems: 'center', fontWeight: '900', lineHeight: 1 }}>{unreadNotificationTotal > 9 ? '9+' : unreadNotificationTotal}</span>}
              </button>
            </>
          )}
          <div style={{ position: 'relative', width: isTinyLayout ? '132px' : '190px', maxWidth: isTinyLayout ? '132px' : '30vw', flexShrink: 0 }}>
            <Search size={12} color="rgba(241,212,229,0.62)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchSubmit} style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.12)', borderRadius: '9999px', padding: '7px 10px 7px 28px', color: '#F8F7F8', fontSize: '11px', fontWeight: '700', outline: 'none', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
            {normalizedSearchTerm && !isAdminPage && renderCompactSearchResults()}
          </div>
          {!userSession ? (
            <>
              <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LOGIN</button>
              <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'rgba(115,187,201,0.12)', border: '1px solid rgba(115,187,201,0.35)', color: '#73BBC9', borderRadius: '12px', padding: '7px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>JOIN</button>
            </>
          ) : (
            <>
              <button onClick={openProfileModal} style={{ background: 'transparent', border: 'none', color: '#F8F7F8', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_STACK, whiteSpace: 'nowrap', minWidth: 0 }}>{renderProfileChip(30, '110px')}</button>
              <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}><LogOut size={13}/> LOGOUT</button>
            </>
          )}
        </div>
      )}

      {userSession && showNotificationPopout && !isAdminPage && !loading && (
        <div style={{ position: 'fixed', top: isTinyLayout ? '58px' : activePage === 'home' ? '78px' : '70px', left: isTinyLayout ? '12px' : activePage === 'home' ? 'auto' : '50%', right: isTinyLayout ? '12px' : activePage === 'home' ? '30px' : 'auto', transform: isTinyLayout || activePage === 'home' ? 'none' : 'translateX(-50%)', zIndex: 1400, width: isTinyLayout ? 'auto' : 'min(300px, calc(100vw - 40px))', padding: '10px', backgroundColor: 'rgba(8,2,2,0.96)', border: '1px solid rgba(115,187,201,0.24)', borderRadius: '12px', boxShadow: '0 14px 34px rgba(8,2,2,0.38)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '9999px', backgroundColor: 'rgba(115,187,201,0.08)', border: '1px solid rgba(115,187,201,0.28)', display: 'grid', placeItems: 'center', color: '#73BBC9' }}>
                <Bell size={13} />
              </div>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 3px 0' }}>NOTIFICATIONS</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>{unreadNotificationTotal} unread update</h3>
              </div>
            </div>
            <button type="button" onClick={() => setShowNotificationPopout(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', padding: '3px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
          </div>

          {notificationPreviewItems.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: '0 0 12px 0' }}>Belum ada notif baru bro.</p>
          ) : (
            <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
              {notificationPreviewItems.map((item) => (
                <button type="button" key={item.id} onClick={() => openNotificationPreview(item)} style={{ textAlign: 'left', padding: '8px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', borderRadius: '10px', cursor: 'pointer', fontFamily: FONT_STACK }}>
                  <p style={{ color: item.label === 'MESSAGE' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{item.label}</p>
                  <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(item.title).toUpperCase()}</h4>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.body}</p>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button type="button" onClick={() => { markMessagesAsRead(); if (isBandAccount) markBandNotificationsRead(); markSubscribedUpdatesRead(); setShowNotificationPopout(false); }} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '9px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>MARK READ</button>
            <button type="button" onClick={openNotificationCenter} style={{ ...glassButtonStyle, padding: '6px 9px', fontSize: '9px', borderRadius: '9px' }}>INBOX</button>
          </div>
        </div>
      )}

      {isBandAccount && showBandAdminPopout && !isAdminPage && !loading && (
        <div style={{ position: 'fixed', top: isTinyLayout ? '58px' : '74px', left: isTinyLayout ? '10px' : '50%', right: isTinyLayout ? '10px' : 'auto', transform: isTinyLayout ? 'none' : 'translateX(-50%)', zIndex: 1450, width: isTinyLayout ? 'auto' : 'min(760px, calc(100vw - 48px))', maxHeight: isTinyLayout ? 'calc(100vh - 76px)' : 'calc(100vh - 96px)', overflowY: 'auto', padding: isTinyLayout ? '12px' : '14px', backgroundColor: 'rgba(8,2,2,0.97)', border: '1px solid rgba(115,187,201,0.24)', borderRadius: '14px', boxShadow: '0 16px 42px rgba(8,2,2,0.46)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ADMIN WISPACE</p>
              <h3 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: 0 }}>SUPPORT ADMIN</h3>
            </div>
            <button type="button" onClick={() => setShowBandAdminPopout(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', padding: '3px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1fr) minmax(220px, 0.82fr)', gap: '12px', alignItems: 'start' }}>
            <form onSubmit={handleBandSupportSubmit} style={{ display: 'grid', gap: '9px', padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.16)', borderRadius: '12px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>KIRIM PESAN</p>
                <h4 style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: 0 }}>HUBUNGI ADMIN</h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '150px 1fr', gap: '8px' }}>
                <select value={bandSupportDraft.category} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, category: event.target.value })} style={formInputStyle}>
                  {['payment', 'payout', 'pamflet', 'album', 'merch', 'upload error', 'lainnya'].map((category) => (
                    <option key={category} value={category}>{category.toUpperCase()}</option>
                  ))}
                </select>
                <input type="text" placeholder="SUBJEK KE ADMIN" value={bandSupportDraft.subject} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, subject: event.target.value })} style={formInputStyle} />
              </div>
              <textarea placeholder="TULIS PESAN KE ADMIN..." value={bandSupportDraft.body} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, body: event.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              <label style={{ display: 'block', padding: '10px', border: '1px dashed rgba(115,187,201,0.3)', borderRadius: '10px', backgroundColor: '#080202', cursor: 'pointer' }}>
                <input type="file" accept="image/*,.pdf,application/pdf" onChange={handleBandSupportAttachmentImport} style={{ display: 'none' }} />
                <span style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900' }}>UPLOAD SCREENSHOT / PDF</span>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{bandSupportDraft.attachmentName ? `${bandSupportDraft.attachmentName} / ${formatFileSize(bandSupportDraft.attachmentSize || 0)}` : 'Opsional'}</p>
              </label>
              <button type="submit" style={{ ...glassButtonStyle, width: 'fit-content', padding: '9px 12px', fontSize: '10px' }}>KIRIM KE ADMIN</button>
            </form>

            <section style={{ padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '9px' }}>
                <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>ADMIN THREAD</h4>
                <button type="button" onClick={() => { markMessagesAsRead(); navigateInternalPage('message_center'); }} style={{ background: 'transparent', border: 'none', color: '#73BBC9', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>OPEN</button>
              </div>
              {bandAdminThreadMessages.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada thread admin. Pesan yang lu kirim ke admin dan balasan admin akan muncul di sini.</p>
              ) : (
                <div style={{ display: 'grid', gap: '7px', maxHeight: isTinyLayout ? '180px' : '250px', overflowY: 'auto' }}>
                  {bandAdminThreadMessages.slice(0, 5).map((message) => (
                    <div key={message.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(241,212,229,0.08)' }}>
                      <p style={{ color: message.source === 'admin' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{message.source === 'admin' ? 'ADMIN' : 'BAND'} / {String(message.category || 'support').toUpperCase()}</p>
                      <h5 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject}</h5>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{message.replied ? message.lastReply : message.body}</p>
                      {message.attachmentUrl && (
                        <a href={message.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', width: 'fit-content', marginTop: '6px', color: '#73BBC9', fontSize: '9px', fontWeight: '900', textDecoration: 'none' }}>
                          LAMPIRAN: {(message.attachmentName || 'FILE').toUpperCase()}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {activeTrack && !loading && (
        <div style={{ position: 'fixed', left: '50%', bottom: isTinyLayout ? '8px' : '12px', zIndex: 1000, transform: 'translateX(-50%)', width: isTinyLayout ? 'calc(100vw - 34px)' : 'min(340px, calc(100vw - 56px))', boxSizing: 'border-box', padding: isTinyLayout ? '6px 8px' : '6px 9px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '7px', alignItems: 'center', backgroundColor: 'rgba(8,2,2,0.84)', border: '1px solid rgba(241,212,229,0.12)', borderRadius: '9px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: 'none' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: isPlaying ? 'rgba(255,255,255,0.72)' : '#73BBC9', fontSize: '7px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 2px 0' }}>{isPlaying ? 'PLAYING' : 'PAUSED'}</p>
            <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '10px' : '11px', fontWeight: '900', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.05 }}>{(activeTrack.title || 'UNTITLED TRACK').toUpperCase()}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) 32px', gap: '6px', alignItems: 'center', marginTop: '5px' }}>
              <span style={{ color: 'rgba(255,255,255,0.58)', fontSize: '8px', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>{formatPlayerTime(playerSeekValue)}</span>
              <input
                type="range"
                min="0"
                max={playerSeekMax || 1}
                step="0.1"
                value={playerSeekValue}
                onChange={handlePlayerSeek}
                aria-label="Seek music player"
                style={{ width: '100%', height: '2px', accentColor: '#73BBC9', cursor: 'pointer' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.58)', fontSize: '8px', fontWeight: '900', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{formatPlayerTime(playerSeekMax)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => handlePlayerStep(-1)} disabled={playerQueue.length <= 1} title="Previous" style={{ width: '23px', height: '23px', borderRadius: '9999px', border: '1px solid rgba(241,212,229,0.09)', backgroundColor: '#080202', color: playerQueue.length <= 1 ? 'rgba(255,255,255,0.34)' : '#F8F7F8', display: 'grid', placeItems: 'center', cursor: playerQueue.length <= 1 ? 'default' : 'pointer', padding: 0 }}><SkipBack size={10} /></button>
            <button onClick={handleToggleActiveTrack} title={isPlaying ? 'Pause' : 'Play'} style={{ width: '25px', height: '25px', borderRadius: '9999px', border: '1px solid rgba(115,187,201,0.3)', backgroundColor: 'rgba(115,187,201,0.16)', color: '#F8F7F8', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'none', padding: 0 }}>{isPlaying ? <Pause size={12} /> : <Play size={12} />}</button>
            <button onClick={() => handlePlayerStep(1)} disabled={playerQueue.length <= 1} title="Next" style={{ width: '23px', height: '23px', borderRadius: '9999px', border: '1px solid rgba(241,212,229,0.09)', backgroundColor: '#080202', color: playerQueue.length <= 1 ? 'rgba(255,255,255,0.34)' : '#F8F7F8', display: 'grid', placeItems: 'center', cursor: playerQueue.length <= 1 ? 'default' : 'pointer', padding: 0 }}><SkipForward size={10} /></button>
          </div>
        </div>
      )}

      {/* HEADER UTAMA BINGKAI ATAS */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isAudienceOrdersPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={{ position: 'relative', width: '100%', height: homeHeroHeight, marginBottom: isTinyLayout ? '30px' : '46px', borderRadius: isTinyLayout ? '12px' : '14px', overflow: 'hidden', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', boxShadow: '0 18px 52px rgba(8,2,2,0.52)' }}>
          <header style={homeHeaderStyle}>
            <div style={homeBrandWrapStyle}>
              <button type="button" onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <img src={WISPACE_LOGO_SRC} alt="WiSpace" style={{ width: isTinyLayout ? '118px' : '142px', maxWidth: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 0 18px rgba(115,187,201,0.28))' }} />
              </button>
            </div>

            {/* CYBER SEARCH BAR INTEGRATION */}
            <div style={homeSearchWrapStyle}>
              <Search size={14} color="rgba(241,212,229,0.62)" style={{ position: 'absolute', left: '16px' }} />
              <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchSubmit} style={{ width: isTinyLayout ? 'auto' : '100%', flex: isTinyLayout ? '1 1 0' : undefined, minWidth: 0, backgroundColor: 'rgba(8, 2, 2, 0.4)', border: '1px solid rgba(241,212,229,0.1)', borderRadius: '9999px', padding: '10px 16px 10px 42px', fontSize: '12px', fontWeight: '700', color: '#F8F7F8', outline: 'none', fontFamily: FONT_STACK, boxSizing: 'border-box', textAlign: 'center' }} />
              {userSession && isTinyLayout && (
                <button onClick={openProfileModal} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, maxWidth: '44%', flex: '0 0 auto' }}>{renderProfileChip(22, '94px')}</button>
              )}
              {normalizedSearchTerm && !isAdminPage && renderCompactSearchResults()}
            </div>

            <div style={homeNavStyle}>
              <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan', clearSearch: true })} style={{ background: 'none', border: 'none', color: '#F8F7F8', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>EXPLORE</button>
              {!userSession ? (
                <>
                  <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#F8F7F8', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>LOGIN</button>
                  <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: isTinyLayout ? '8px 14px' : '8px 20px', fontSize: '11px', flexShrink: 0 }}>JOIN</button>
                </>
              ) : (
                <>
                  {!isTinyLayout && (
                    <button onClick={openProfileModal} style={{ ...glassButtonStyle, padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>{renderProfileChip(22, '130px')}</button>
                  )}
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>LOGOUT</button>
                </>
              )}
            </div>
          </header>

          {/* BANNER SLIDER ROTATION */}
          {exclusiveEventBanners.length > 0 ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {currentExclusiveBanner.image && (
                <img key={currentExclusiveBannerIndex} src={currentExclusiveBanner.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.92) contrast(1.08) brightness(0.86)' }} />
              )}
              <div style={homeHeroContentStyle}>
                <span style={{ backgroundColor: 'rgba(8,2,2,0.55)', border: '1px solid rgba(241,212,229,0.18)', color: '#F8F7F8', fontSize: '10px', fontWeight: '900', padding: '6px 10px', borderRadius: '9999px', width: 'fit-content', marginBottom: '16px', letterSpacing: '1px' }}>{currentExclusiveBanner.type}</span>
                <h2 style={{ fontSize: isTinyLayout ? '28px' : 'clamp(34px, 4.8vw, 58px)', fontWeight: '900', margin: '0 0 12px 0', color: '#F8F7F8', maxWidth: '860px', lineHeight: isTinyLayout ? 1.02 : 0.96 }}>{currentExclusiveBanner.title}</h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: isTinyLayout ? '13px' : '15px', maxWidth: '720px', margin: '0 0 30px 0', lineHeight: '1.55', fontWeight: '700' }}>{currentExclusiveBanner.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', width: '100%', flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedGigDetail({ ...currentExclusiveBanner.sourceGig, fromEventOverlay: true })} style={{ ...glassButtonStyle, background: 'rgba(241,212,229,0.9)', border: '1px solid rgba(241,212,229,0.7)', color: '#080202', padding: isTinyLayout ? '10px 16px' : '11px 28px', width: 'fit-content', fontSize: isTinyLayout ? '12px' : '13px', boxShadow: 'none' }}>LIHAT DETAIL EVENT</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isTinyLayout ? '10px' : '18px', maxWidth: '100%', overflowX: 'auto' }}>
                    {exclusiveEventBanners.map((banner, index) => {
                      const isActiveSlide = currentExclusiveBannerIndex === index;

                      return (
                        <button
                          key={banner.id}
                          type="button"
                          onClick={() => setActiveBanner(index)}
                          aria-label={`Buka slide event ${index + 1}`}
                          style={{
                            minWidth: '28px',
                            height: '32px',
                            border: 'none',
                            borderBottom: isActiveSlide ? '2px solid #73BBC9' : '2px solid transparent',
                            background: 'transparent',
                            color: isActiveSlide ? '#F1D4E5' : 'rgba(255,255,255,0.58)',
                            textShadow: isActiveSlide ? '0 0 10px rgba(115, 187, 201, 0.45)' : 'none',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            fontFamily: FONT_STACK,
                            fontSize: '12px',
                            fontWeight: '900',
                            lineHeight: 1,
                            transition: 'all 0.25s ease'
                          }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#080202', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(241,212,229,0.08)', background: 'radial-gradient(circle at 18% 72%, rgba(115,187,201,0.18), transparent 30%), linear-gradient(135deg, #080202 0%, rgba(115,187,201,0.18) 46%, #080202 100%)' }} />
              <div style={{ position: 'relative', zIndex: 10, padding: isTinyLayout ? '24px 18px' : '40px' }}>
                <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', letterSpacing: '1.5px' }}>WISPACE EXCLUSIVE BOARD</span>
                <h2 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '28px' : 'clamp(34px, 4.6vw, 56px)', fontWeight: '900', lineHeight: isTinyLayout ? 1.04 : 0.98, margin: '12px 0 10px 0', maxWidth: '780px' }}>BELUM ADA PAMFLET APPROVED</h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: isTinyLayout ? '13px' : '15px', maxWidth: '620px', lineHeight: 1.5, margin: 0 }}>Upload pamflet exclusive dari menu band, lalu approve di admin. Slide besar akan muncul di sini.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activePage === 'home' && !isAdminPage && selectedGigDetail?.fromEventOverlay && (
        <div onClick={() => setSelectedGigDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 1350, display: 'grid', placeItems: isTinyLayout ? 'end center' : 'center', padding: isTinyLayout ? '12px' : '24px', boxSizing: 'border-box', background: 'linear-gradient(180deg, rgba(8,2,2,0.34), rgba(8,2,2,0.78))', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: isTinyLayout ? '100%' : 'min(960px, calc(100vw - 54px))', maxHeight: isTinyLayout ? '88vh' : '82vh', overflowY: 'auto', boxSizing: 'border-box', padding: isTinyLayout ? '12px' : '16px', backgroundColor: 'rgba(8,2,2,0.94)', border: '1.5px solid rgba(115,187,201,0.24)', borderRadius: '14px', boxShadow: '0 18px 46px rgba(8,2,2,0.5)', animation: 'wispaceRise 460ms cubic-bezier(0.18, 0.92, 0.22, 1.08) both' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(280px, 0.72fr) minmax(0, 1fr)', gap: isTinyLayout ? '14px' : '18px', alignItems: 'stretch' }}>
              <div style={{ width: '100%', maxHeight: isTinyLayout ? '42vh' : '68vh', borderRadius: '13px', overflow: 'hidden', backgroundColor: '#080202', border: '1.5px solid rgba(241,212,229,0.12)', display: 'grid', placeItems: 'center' }}>
                {selectedGigDetail.image ? <img src={selectedGigDetail.image} alt="" style={{ width: '100%', height: '100%', maxHeight: isTinyLayout ? '42vh' : '68vh', objectFit: 'contain', display: 'block' }} /> : <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>POSTER</span>}
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '18px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1.4px', margin: 0 }}>DETAIL EVENT</p>
                    <button onClick={() => setSelectedGigDetail(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', padding: 0, fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
                  </div>
                  <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '26px' : 'clamp(32px, 4vw, 54px)', fontWeight: '900', lineHeight: 0.95, margin: '0 0 12px 0', overflowWrap: 'anywhere' }}>{selectedGigDetail.title?.toUpperCase()}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5, margin: '0 0 18px 0' }}>Pamflet event yang sedang tayang di WiSpace. Detail ini tidak menggeser layout homepage dan slide premium berhenti sementara saat panel dibuka.</p>
                  <div style={{ display: 'grid', gap: '8px', color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.35 }}>
                    {[
                      ['DATE', getGigDate(selectedGigDetail), '#F1D4E5'],
                      ['VENUE', selectedGigDetail.city?.toUpperCase(), '#F1D4E5'],
                      ['HTM', getGigHtm(selectedGigDetail).toUpperCase(), getGigHtm(selectedGigDetail).toLowerCase() === 'free' ? 'rgba(255,255,255,0.72)' : '#73BBC9'],
                      ['CP', getGigCp(selectedGigDetail), '#F1D4E5']
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: '12px', padding: '8px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>{label}</span>
                        <strong style={{ color, fontSize: '12px', fontWeight: '900', overflowWrap: 'anywhere' }}>{value || '-'}</strong>
                      </div>
                    ))}
                    {isApprovedHomepageGig(selectedGigDetail) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: '12px', padding: '8px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>TAYANG</span>
                        <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: '900' }}>SAMPAI {getGigApprovedUntil(selectedGigDetail) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</strong>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedGigDetail(null)} style={{ ...glassButtonStyle, width: 'fit-content', padding: '10px 14px', fontSize: '11px' }}>TUTUP DETAIL</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODERATION PANEL */}
      {!loading && isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isAudienceOrdersPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={pageShellStyle}>
          {!isAdminUnlocked ? (
            <div style={{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center' }}>
              <form onSubmit={handleAdminUnlock} style={{ ...glassStyle('admin-password-gate'), width: '100%', maxWidth: '420px', padding: '28px', backgroundColor: '#080202' }}>
                <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 8px 0' }}>WISPACE ADMIN GATE</p>
                <h2 style={{ color: '#F8F7F8', fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0', lineHeight: 1 }}>ADMIN PASSWORD</h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 12px 0' }}>Login admin.</p>
                <div style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${userSession ? 'rgba(115,187,201,0.22)' : 'rgba(241,212,229,0.22)'}`, borderRadius: '12px', marginBottom: '12px' }}>
                  <p style={{ color: userSession ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 4px 0' }}>{userSession ? 'AKUN LOGIN TERDETEKSI' : 'BELUM LOGIN ADMIN'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{userSession ? `${userSession.email || 'Admin WiSpace'} - klik unlock untuk cek admin_users.` : 'Masuk dulu kalau mau pesan admin, payment, dan data admin tersimpan ke cloud.'}</p>
                </div>
                <input type="password" placeholder="PASSWORD LOKAL OPSIONAL" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} style={{ ...formInputStyle, marginBottom: '12px' }} />
                {adminError && <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 12px 0' }}>{adminError}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: userSession ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                  <button type="submit" disabled={adminAuthLoading} style={{ ...glassButtonStyle, padding: '12px', fontSize: '12px', cursor: adminAuthLoading ? 'wait' : 'pointer', opacity: adminAuthLoading ? 0.65 : 1 }}>{adminAuthLoading ? 'CEK CLOUD...' : userSession ? 'UNLOCK ADMIN' : 'UNLOCK LOCAL'}</button>
                  {!userSession && (
                    <button type="button" onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '12px' }}>LOGIN ADMIN</button>
                  )}
                  <button type="button" onClick={closeAdminGate} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '12px', padding: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BACK HOME</button>
                </div>
              </form>
            </div>
          ) : (
            <>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>WISPACE ADMIN GATE</p>
              <h2 style={pageTitleStyle}>ADMIN CONTROL CENTER</h2>
              <p style={{ color: isCloudAdmin ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '10px 0 0 0' }}>{isCloudAdmin ? `CLOUD ADMIN: ${cloudAdminAccount.email || userSession?.email || 'admin'}` : 'LOCAL PASSWORD MODE: sync admin cloud terbatas sampai akun masuk admin_users'}</p>
            </div>
            <button onClick={closeAdminGate} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>BACK HOME</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ ...compactMetricCardStyle }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>PENDING</p>
              <strong style={{ color: '#73BBC9', fontSize: '28px', fontWeight: '900' }}>{pendingGigs.length}</strong>
            </div>
            <div style={{ ...compactMetricCardStyle }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>FREE APPROVED</p>
              <strong style={{ color: '#F8F7F8', fontSize: '28px', fontWeight: '900' }}>{approvedFreeGigs.length}</strong>
            </div>
            <div style={{ ...compactMetricCardStyle }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>WAIT PAYMENT</p>
              <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '28px', fontWeight: '900' }}>{exclusiveWaitingPaymentGigs.length}</strong>
            </div>
            <div style={{ ...compactMetricCardStyle }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>PAID / ACTIVATE</p>
              <strong style={{ color: '#73BBC9', fontSize: '28px', fontWeight: '900' }}>{exclusivePaidWaitingActivationGigs.length}</strong>
            </div>
            <div style={{ ...compactMetricCardStyle }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>EXCLUSIVE LIVE</p>
              <strong style={{ color: '#F8F7F8', fontSize: '28px', fontWeight: '900' }}>{approvedExclusiveGigs.length}</strong>
            </div>
          </div>

          <nav style={{ padding: '8px 0', backgroundColor: 'rgba(8,2,2,0.78)', display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '16px', position: 'sticky', top: isTinyLayout ? '76px' : '84px', zIndex: 20, borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            {[
              ['payment', `PAYMENT ${waitingAdminPaymentRequests.length}`],
              ['finance', 'FINANCE'],
              ['shipment', `SHIPMENT ${adminWaitingMerchOrders}`],
              ['legal', `LEGAL ${releaseAgreements.length}`],
              ['notifications', `NOTIF ${adminNotificationQueue.length}`],
              ['messages', `MESSAGES ${adminSupportMessages.length}`],
              ['merch', `MERCH ${adminWaitingConsignmentItems.length}`],
              ['setup', 'SETUP'],
              ['ledger', 'LEDGER'],
              ['article', 'ARTIKEL'],
              ['picks', 'PICKS'],
              ['moderation', 'MODERASI'],
              ['pamflet', 'PAMFLET']
            ].map(([sectionId, label]) => (
              <button
                key={sectionId}
                type="button"
                onClick={() => setAdminActiveSection(sectionId)}
                style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '10px', borderRadius: '10px', background: adminActiveSection === sectionId ? 'rgba(115,187,201,0.14)' : glassButtonStyle.background, color: adminActiveSection === sectionId ? '#F1D4E5' : '#73BBC9', border: adminActiveSection === sectionId ? '1px solid rgba(115,187,201,0.48)' : glassButtonStyle.border }}
              >
                {label}
              </button>
            ))}
          </nav>

          {adminActiveSection === 'payment' && (
          <section id="admin-payment-section" style={{ ...glassStyle('admin-payment-requests'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ADMIN PAYMENT CONTROL</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>CONFIRM PAID BUYER</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => void fetchAdminPaymentRequests(userSession)} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '9px', borderRadius: '8px' }}>REFRESH SYNC</button>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '390px' }}>Pembelian album, track, dan merch masuk waiting dulu. Library/order baru aktif setelah admin klik confirm paid.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {[
                ['WAITING', waitingAdminPaymentRequests.length, 'rgba(255,255,255,0.72)'],
                ['PROVIDER PAID', providerPaidAdminPaymentRequests.length, '#73BBC9'],
                ['PAID', paidAdminPaymentRequests.length, 'rgba(255,255,255,0.72)'],
                ['REJECTED', rejectedAdminPaymentRequests.length, '#F1D4E5'],
                ['ALL REQUEST', pendingPayments.length, '#73BBC9']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '7px 0', backgroundColor: 'transparent', borderTop: `1.5px solid ${color}55`, borderRadius: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 4px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '15px', fontWeight: '900' }}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                ['WAITING CASH', waitingAdminPaymentAmount, 'rgba(255,255,255,0.72)'],
                ['WAITING PRODUK', waitingAdminPaymentProductAmount, 'rgba(255,255,255,0.72)'],
                ['WAITING ONGKIR', waitingAdminPaymentShippingAmount, 'rgba(255,255,255,0.72)'],
                ['POTENSI FEE', waitingAdminPaymentPotentialFee, '#73BBC9'],
                ['REJECTED GROSS', rejectedAdminPaymentAmount, '#F1D4E5']
              ].map(([label, amount, color]) => (
                <div key={label} style={{ padding: '7px 0', backgroundColor: 'transparent', borderTop: `1.5px solid ${color}33`, borderRadius: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 4px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '12px', fontWeight: '900' }}>Rp {Number(amount || 0).toLocaleString('id-ID')}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1.1fr 0.9fr', gap: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.18)', borderRadius: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>PAYMENT QUEUE</p>
                {waitingAdminPaymentRequests.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada payment buyer yang menunggu confirm.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '7px', maxHeight: '310px', overflowY: 'auto' }}>
                    {waitingAdminPaymentRequests.map((payment) => {
                      const hasPaymentProof = Boolean(payment.paymentProofPreview || payment.paymentProofUrl);
                      const providerPaid = isProviderPaidPendingActivation(payment);
                      const canConfirmPayment = canAdminConfirmPayment(payment);
                      const paymentProductAmount = Number(payment.grossAmount || payment.productAmount || payment.amount || 0);
                      const paymentShippingCost = Number(payment.shipping?.shippingCost || payment.shippingCost || 0);
                      const paymentSplit = calculateRevenueSplit(paymentProductAmount);
                      return (
                      <div key={payment.id} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{payment.checkoutRef} / {(payment.type || 'order').toUpperCase()}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(payment.productTitle || 'Checkout WiSpace').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Buyer: {payment.buyerName || '-'} / Seller: {payment.sellerBandName || 'WiSpace'} / Total Rp {Number(payment.amount || 0).toLocaleString('id-ID')}</p>
                          {payment.providerStatus && <p style={{ color: providerPaid ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0', fontWeight: '900' }}>Provider: {String(payment.provider || PAYMENT_GATEWAY_PROVIDER || 'manual').toUpperCase()} / {String(payment.providerStatus).replaceAll('_', ' ').toUpperCase()}</p>}
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0' }}>Produk Rp {paymentProductAmount.toLocaleString('id-ID')}{paymentShippingCost ? ` / Ongkir Rp ${paymentShippingCost.toLocaleString('id-ID')}` : ''}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0' }}>Split admin: fee Rp {Number(payment.platformFee || paymentSplit.platformFee).toLocaleString('id-ID')} / net band Rp {Number(payment.bandNet || paymentSplit.bandNet).toLocaleString('id-ID')}</p>
                          <div style={{ display: 'flex', gap: '7px', alignItems: 'center', marginTop: '7px', flexWrap: 'wrap' }}>
                            {hasPaymentProof ? (
                              <>
                                <button type="button" onClick={() => setSelectedPaymentProofPreview(payment)} style={{ width: '54px', height: '34px', borderRadius: '7px', overflow: 'hidden', border: '1px solid rgba(241,212,229,0.28)', background: '#080202', padding: 0, cursor: 'pointer' }}>
                                  <img src={payment.paymentProofPreview || payment.paymentProofUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </button>
                                <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900' }}>PROOF READY / {String(payment.paymentProofStatus || 'local').toUpperCase()}</span>
                              </>
                            ) : (
                              <span style={{ color: providerPaid ? '#73BBC9' : '#F1D4E5', fontSize: '9px', fontWeight: '900' }}>{providerPaid ? 'PROVIDER PAID / READY TO ACTIVATE' : 'NO PROOF / CONFIRM LOCKED'}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: isTinyLayout ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setSelectedPaymentDetail(payment)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                          <button type="button" onClick={() => handleConfirmPendingPayment(payment)} disabled={!canConfirmPayment} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', color: canConfirmPayment ? 'rgba(255,255,255,0.72)' : '#F1D4E5', border: canConfirmPayment ? '1px solid rgba(241,212,229,0.35)' : '1px solid rgba(241,212,229,0.08)', cursor: canConfirmPayment ? 'pointer' : 'not-allowed' }}>CONFIRM PAID</button>
                          {!providerPaid && <button type="button" onClick={() => handleRejectPendingPayment(payment)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '8px', padding: '7px 9px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REJECT</button>}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '10px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>RECENT PAYMENT HISTORY</p>
                {recentProcessedPaymentRequests.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Histori paid/rejected akan muncul setelah admin proses request.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '7px', maxHeight: '310px', overflowY: 'auto' }}>
                    {recentProcessedPaymentRequests.slice(0, 12).map((payment) => {
                      const isPaidPayment = payment.status === 'paid';
                      const paymentProcessedAt = payment.confirmedAt || payment.rejectedAt || payment.submittedAt || '';
                      const paymentProcessedLabel = paymentProcessedAt
                        ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(paymentProcessedAt))
                        : '-';
                      return (
                        <div key={payment.id} style={{ padding: '8px', backgroundColor: '#080202', border: `1px solid ${isPaidPayment ? 'rgba(241,212,229,0.16)' : 'rgba(241,212,229,0.16)'}`, borderRadius: '9px' }}>
                          <p style={{ color: isPaidPayment ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{String(payment.status || '').replaceAll('_', ' ').toUpperCase()} / {payment.checkoutRef}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(payment.productTitle || 'Payment').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{payment.buyerName || '-'} / Rp {Number(payment.amount || 0).toLocaleString('id-ID')} / {paymentProcessedLabel}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}

          {adminActiveSection === 'finance' && (
          <section id="admin-finance-section" style={{ ...glassStyle('admin-income-report'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>WISPACE FINANCE REPORT</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>PEMASUKAN PLATFORM</h3>
              </div>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleGenerateMonthlyFinanceReport} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '10px', borderRadius: '9px' }}>GENERATE REPORT TGL 1</button>
                <button type="button" onClick={() => handleDownloadMonthlyFinanceReport()} disabled={!latestMonthlyFinanceReport} style={{ background: latestMonthlyFinanceReport ? 'rgba(241,212,229,0.04)' : '#080202', border: '1px solid rgba(241,212,229,0.12)', color: latestMonthlyFinanceReport ? '#F1D4E5' : '#F1D4E5', borderRadius: '9px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: latestMonthlyFinanceReport ? 'pointer' : 'not-allowed', fontFamily: FONT_STACK }}>DOWNLOAD TXT</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '9px' }}>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>CASH COLLECTED</p>
                <strong style={compactMetricValueStyle}>Rp {adminCashCollected.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>OMZET PRODUK PAID</p>
                <strong style={compactMetricValueStyle}>Rp {adminGrossSalesRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>ONGKIR TERKUMPUL</p>
                <strong style={compactMetricValueStyle}>Rp {adminMerchShippingCollected.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>TOTAL FEE WISPACE</p>
                <strong style={{ ...compactMetricValueStyle, color: '#73BBC9' }}>Rp {adminPlatformRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>FEE PEMBELIAN MERCH</p>
                <strong style={{ ...compactMetricValueStyle, color: '#73BBC9' }}>Rp {adminMerchFeeRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>FEE RILISAN DIGITAL</p>
                <strong style={compactMetricValueStyle}>Rp {adminReleaseFeeRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>BIAYA PAMFLET EXCLUSIVE</p>
                <strong style={compactMetricValueStyle}>Rp {adminExclusivePosterRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>TRANSAKSI PAID</p>
                <strong style={compactMetricValueStyle}>{paidSaleTransactions.length}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>ESTIMASI PAYOUT BAND</p>
                <strong style={compactMetricValueStyle}>Rp {adminBandPayoutTotal.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>SIAP CAIR MIN 100K</p>
                <strong style={{ ...compactMetricValueStyle, color: adminPayoutReadyTotal ? 'rgba(255,255,255,0.72)' : '#F1D4E5' }}>Rp {adminPayoutReadyTotal.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>BELUM MINIMUM</p>
                <strong style={compactMetricValueStyle}>Rp {adminPayoutBelowMinimumTotal.toLocaleString('id-ID')}</strong>
              </div>
              <div style={compactMetricCardStyle}>
                <p style={compactMetricLabelStyle}>ORDER PERLU PROSES</p>
                <strong style={{ ...compactMetricValueStyle, color: adminWaitingMerchOrders ? 'rgba(255,255,255,0.72)' : '#F1D4E5' }}>{adminWaitingMerchOrders}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginTop: '10px' }}>
              {adminFinanceQuickActions.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={item.action}
                  style={{ textAlign: 'left', padding: '10px', backgroundColor: '#080202', border: `1px solid ${item.color}33`, borderRadius: '10px', cursor: 'pointer', fontFamily: FONT_STACK }}
                >
                  <p style={{ color: item.color, fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>{item.title}</p>
                  <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>{item.count}</strong>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{item.note}</p>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', marginTop: '10px' }}>
              {adminActionNotifications.map((notification) => (
                <div key={notification.title} style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${notification.color}33`, borderRadius: '10px' }}>
                  <p style={{ color: notification.color, fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>{notification.title}</p>
                  <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>{notification.count}</strong>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{notification.note}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1.1fr 0.9fr', gap: '8px', marginTop: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.18)', borderRadius: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>REPORT PENCAIRAN TANGGAL 1 / {nextPayoutLabel.toUpperCase()}</p>
                {adminPayoutReportRows.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Belum ada transaksi paid untuk report payout.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
                    {adminPayoutReportRows.slice(0, 10).map((band) => (
                      <div key={band.slug} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0,1fr) auto', gap: '8px', padding: '8px', backgroundColor: '#080202', border: `1px solid ${band.ready ? 'rgba(241,212,229,0.18)' : 'rgba(241,212,229,0.18)'}`, borderRadius: '9px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: band.ready ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{band.ready ? 'READY PAYOUT' : 'CEK REKENING / MINIMUM'}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{band.name.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{band.bankName ? `${band.bankName} / ${band.bankAccountName} / ${band.bankAccountNumber}` : 'Rekening belum lengkap'}</p>
                        </div>
                        <strong style={{ color: '#F8F7F8', fontSize: '11px', whiteSpace: 'nowrap' }}>Rp {band.amount.toLocaleString('id-ID')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.16)', borderRadius: '10px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>ARSIP AGREEMENT RILISAN</p>
                {releaseAgreements.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Belum ada agreement upload album yang terekam.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
                    {releaseAgreements.slice(0, 8).map((agreement) => (
                      <div key={agreement.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', padding: '8px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '9px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{agreement.createdAt || new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(agreement.signedAt))}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agreement.releaseTitle.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{agreement.bandName} / TTD: {agreement.signerName}</p>
                        </div>
                        <button type="button" onClick={() => handleDownloadAgreementText(agreement)} style={{ ...glassButtonStyle, padding: '7px 8px', fontSize: '9px', borderRadius: '8px' }}>TXT</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.18)', borderRadius: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>PAYOUT READY QUEUE</p>
                {adminPayoutReadyBands.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Belum ada band yang tembus minimum pencairan Rp {MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')}.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {adminPayoutReadyBands.slice(0, 4).map((band) => (
                      <div key={band.slug} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{band.name.toUpperCase()}</span>
                        <strong style={{ color: '#F8F7F8', whiteSpace: 'nowrap' }}>Rp {band.amount.toLocaleString('id-ID')}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '10px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>FINANCE MIX</p>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {[
                    ['RILISAN DIGITAL', adminDigitalTransactions.length, adminReleaseFeeRevenue],
                    ['MERCH', adminMerchTransactions.length, adminMerchFeeRevenue],
                    ['PAMFLET EXCLUSIVE', adminExclusivePosterPaidCount, adminExclusivePosterRevenue]
                  ].map(([label, count, amount]) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>
                      <span>{label}</span>
                      <strong style={{ color: 'rgba(255,255,255,0.72)' }}>{count}x</strong>
                      <strong style={{ color: '#F8F7F8' }}>Rp {Number(amount || 0).toLocaleString('id-ID')}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.16)', borderRadius: '10px', marginTop: '10px' }}>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>ADMIN MERCH FULFILLMENT QUEUE</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '7px', marginBottom: '9px' }}>
                {[
                  ['ADMIN SHIP', adminConsignmentOrderQueue.length, '#73BBC9'],
                  ['BAND SHIP', adminBandShipOrderQueue.length, 'rgba(255,255,255,0.72)'],
                  ['ADA RESI', adminOrdersWithTracking.length, 'rgba(255,255,255,0.72)'],
                  ['SELESAI', adminCompletedMerchOrders.length, 'rgba(255,255,255,0.72)']
                ].map(([label, value, color]) => (
                  <div key={label} style={{ padding: '8px', backgroundColor: '#080202', border: `1px solid ${color}30`, borderRadius: '9px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', margin: '0 0 4px 0' }}>{label}</p>
                    <strong style={{ color, fontSize: '14px', fontWeight: '900' }}>{value}</strong>
                  </div>
                ))}
              </div>
              {adminActiveMerchOrderList.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Belum ada order merch aktif yang perlu diproses.</p>
              ) : (
                <div style={{ display: 'grid', gap: '7px', maxHeight: '260px', overflowY: 'auto' }}>
                  {adminActiveMerchOrderList.slice(0, 8).map((order) => {
                    const stage = getMerchOrderStageSummary(order);
                    const labelStatus = getMerchShipmentLabelSummary(order);
                    return (
                    <div key={`admin-order-${order.id}`} style={compactRowStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: order.fulfillmentMode === 'admin_consignment' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{order.fulfillmentMode === 'admin_consignment' ? 'WISPACE SHIP' : 'BAND SHIP'} / {order.orderId || order.id}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(order.itemName || 'Merch WiSpace').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{order.sellerBandName || 'Band WiSpace'} / {order.recipientName || '-'} / {order.city || '-'}</p>
                          <p style={{ color: stage.color, fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0', fontWeight: '900' }}>{stage.title.toUpperCase()} / <span style={{ color: 'rgba(255,255,255,0.62)', fontWeight: '700' }}>{stage.note}</span></p>
                          <p style={{ color: labelStatus.color, fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0', fontWeight: '900' }}>{labelStatus.title.toUpperCase()} / <span style={{ color: 'rgba(255,255,255,0.62)', fontWeight: '700' }}>{labelStatus.note}</span></p>
                        </div>
                        <strong style={{ color: getMerchOrderStatusColor(order.trackingStatus), fontSize: '9px', whiteSpace: 'nowrap' }}>{getMerchOrderStatusLabel(order.trackingStatus)}</strong>
                      </div>
                      {renderMerchOrderStepper(order.trackingStatus)}
                      {order.fulfillmentMode === 'admin_consignment' ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          <button type="button" onClick={() => setSelectedMerchOrderDetail(order)} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                          {order.shipmentLabelUrl && <button type="button" onClick={() => window.open(order.shipmentLabelUrl, '_blank', 'noopener,noreferrer')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>CETAK LABEL</button>}
                          <button type="button" onClick={() => syncShipmentBookingForOrder(order, { notify: true })} disabled={shipmentBookingOrderId === order.id} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', opacity: shipmentBookingOrderId === order.id ? 0.55 : 1 }}>{shipmentBookingOrderId === order.id ? 'BOOKING...' : 'BOOK SHIP'}</button>
                          <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'processing_admin')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>PROSES ADMIN</button>
                          <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'packing')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>PACKING</button>
                          <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'ready_to_ship')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>READY</button>
                          <button type="button" onClick={() => handleMerchTrackingNumberUpdate(order)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.24)', color: 'rgba(255,255,255,0.72)', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>RESI</button>
                          <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'completed')} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SELESAI</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                          <button type="button" onClick={() => setSelectedMerchOrderDetail(order)} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                          {order.shipmentLabelUrl && <button type="button" onClick={() => window.open(order.shipmentLabelUrl, '_blank', 'noopener,noreferrer')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>CETAK LABEL</button>}
                          <button type="button" onClick={() => syncShipmentBookingForOrder(order, { notify: true })} disabled={shipmentBookingOrderId === order.id} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', opacity: shipmentBookingOrderId === order.id ? 0.55 : 1 }}>{shipmentBookingOrderId === order.id ? 'BOOKING...' : 'BOOK SHIP'}</button>
                          <p style={{ color: '#F8F7F8', fontSize: '9px', lineHeight: 1.35, margin: 0 }}>Band ship. Admin pantau/follow up via message kalau macet.</p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
              {adminConsignmentOrderQueue.length > 0 && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '8px 0 0 0' }}>{adminConsignmentOrderQueue.length} order titipan stok sedang menunggu action admin WiSpace.</p>}
            </div>
          </section>
          )}

          {adminActiveSection === 'shipment' && (
          <section id="admin-shipment-section" style={{ ...glassStyle('admin-shipment-monitor'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ADMIN SHIPMENT MONITOR</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>ORDER MERCH & RESI</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {[
                ['AKTIF', adminActiveMerchOrderList.length, '#73BBC9'],
                ['BELUM BOOKING', adminShipmentNeedsBooking.length, 'rgba(255,255,255,0.72)'],
                ['LABEL SIAP', adminShipmentLabelReady.length, '#73BBC9'],
                ['PERLU CEK', adminShipmentNeedsReview.length, '#F1D4E5'],
                ['DIKIRIM', adminShipmentShipped.length, 'rgba(255,255,255,0.72)'],
                ['SELESAI', adminCompletedMerchOrders.length, 'rgba(255,255,255,0.72)']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '8px 0', backgroundColor: 'transparent', borderTop: `1.5px solid ${color}55`, borderRadius: 0 }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 4px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '15px', fontWeight: '900' }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', padding: '8px 0', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}`, marginBottom: '12px' }}>
              {adminShipmentFilterOptions.map(([filterId, label, items]) => (
                <button
                  key={filterId}
                  type="button"
                  onClick={() => setAdminShipmentFilter(filterId)}
                  style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', color: adminShipmentFilter === filterId ? '#F1D4E5' : '#73BBC9', background: adminShipmentFilter === filterId ? 'rgba(115,187,201,0.14)' : glassButtonStyle.background }}
                >
                  {label} {items.length}
                </button>
              ))}
            </div>

            {selectedAdminShipmentOrders.length === 0 ? (
              <div style={{ padding: '18px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Tidak ada order di filter ini.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                {selectedAdminShipmentOrders.map((order) => {
                  const stage = getMerchOrderStageSummary(order);
                  const labelStatus = getMerchShipmentLabelSummary(order);
                  const isAdminShipOrder = order.fulfillmentMode === 'admin_consignment';
                  return (
                    <div key={`shipment-monitor-${order.id}`} style={{ ...compactRowStyle, borderTopColor: order.shipmentBookingStatus === 'shipment_booking_failed' ? 'rgba(241,212,229,0.32)' : 'rgba(115,187,201,0.18)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1fr) auto', gap: '10px', alignItems: 'start' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: isAdminShipOrder ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{isAdminShipOrder ? 'WISPACE SHIP' : 'BAND SHIP'} / {order.orderId || order.id}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(order.itemName || 'Merch WiSpace').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{order.sellerBandName || 'Band WiSpace'} {'->'} {order.recipientName || 'Buyer'} / {order.city || '-'} / {order.courier || '-'}</p>
                          <p style={{ color: stage.color, fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0', fontWeight: '900' }}>{stage.title.toUpperCase()}</p>
                          <p style={{ color: labelStatus.color, fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0', fontWeight: '900' }}>{labelStatus.title.toUpperCase()}</p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0' }}>Resi: <strong style={{ color: order.trackingNumber ? '#F8F7F8' : '#F1D4E5' }}>{order.trackingNumber || 'menunggu label'}</strong> / Shipment: <strong>{getShipmentBookingLabel(order.shipmentBookingStatus)}</strong></p>
                          {order.trackingProviderLabel && <p style={{ color: '#73BBC9', fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0', fontWeight: '900' }}>TRACKING: {String(order.trackingProviderLabel).toUpperCase()}</p>}
                        </div>
                        <strong style={{ color: getMerchOrderStatusColor(order.trackingStatus), fontSize: '9px', whiteSpace: 'nowrap' }}>{getMerchOrderStatusLabel(order.trackingStatus)}</strong>
                      </div>
                      {renderMerchOrderStepper(order.trackingStatus)}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
                        <button type="button" onClick={() => setSelectedMerchOrderDetail(order)} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                        {order.shipmentLabelUrl && <button type="button" onClick={() => window.open(order.shipmentLabelUrl, '_blank', 'noopener,noreferrer')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>CETAK LABEL</button>}
                        <button type="button" onClick={() => syncShipmentBookingForOrder(order, { notify: true })} disabled={shipmentBookingOrderId === order.id} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', opacity: shipmentBookingOrderId === order.id ? 0.55 : 1 }}>{shipmentBookingOrderId === order.id ? 'BOOKING...' : 'BOOK SHIP'}</button>
                        <button type="button" onClick={() => syncShipmentTrackingForOrder(order, { notify: true })} disabled={!order.trackingNumber || shipmentTrackingOrderId === order.id} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', opacity: !order.trackingNumber || shipmentTrackingOrderId === order.id ? 0.55 : 1 }}>{shipmentTrackingOrderId === order.id ? 'TRACKING...' : 'CEK TRACK'}</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, isAdminShipOrder ? 'processing_admin' : 'processing')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>PROSES</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'packing')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>PACKING</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'ready_to_ship')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>READY</button>
                        <button type="button" onClick={() => handleMerchTrackingNumberUpdate(order)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.24)', color: 'rgba(255,255,255,0.72)', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>RESI</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'completed')} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SELESAI</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {adminActiveSection === 'legal' && (
          <section id="admin-legal-section" style={{ ...glassStyle('admin-legal-archive'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>LEGAL & PAYOUT RECORD</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>ARSIP AGREEMENT BAND</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                ['AGREEMENT', releaseAgreements.length, '#73BBC9'],
                ['REKENING KURANG', bandsMissingPayoutAccount.length, 'rgba(255,255,255,0.72)'],
                ['REPORT BULANAN', monthlyFinanceReports.length, 'rgba(255,255,255,0.72)']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${color}33`, borderRadius: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 5px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '18px', fontWeight: '900' }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1.1fr 0.9fr', gap: '10px' }}>
              <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.16)', borderRadius: '10px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>RELEASE AGREEMENT LEDGER</p>
                {releaseAgreements.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada agreement upload album yang terekam.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '7px', maxHeight: '340px', overflowY: 'auto' }}>
                    {releaseAgreements.map((agreement) => (
                      <div key={agreement.id} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{agreement.agreementVersion || RELEASE_AGREEMENT_VERSION} / {agreement.createdAt || new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(agreement.signedAt))}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agreement.releaseTitle.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{agreement.bandName} / TTD: {agreement.signerName} / {agreement.signerEmail || '-'}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.35, margin: '4px 0 0 0' }}>{agreement.payoutBankName ? `${agreement.payoutBankName} / ${agreement.payoutAccountName} / ${agreement.payoutAccountNumber}` : 'Rekening belum ada di agreement ini'}</p>
                        </div>
                        <button type="button" onClick={() => handleDownloadAgreementText(agreement)} style={{ ...glassButtonStyle, padding: '7px 8px', fontSize: '9px', borderRadius: '8px' }}>TXT</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.16)', borderRadius: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>BAND REKENING BELUM LENGKAP</p>
                  {bandsMissingPayoutAccount.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Semua band published sudah punya data rekening.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '7px', maxHeight: '155px', overflowY: 'auto' }}>
                      {bandsMissingPayoutAccount.map((profile) => (
                        <div key={profile.slug || profile.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(profile.name || 'Band WiSpace').toUpperCase()}</span>
                          <strong style={{ color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap' }}>HOLD</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.16)', borderRadius: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>FINANCE REPORT ARCHIVE</p>
                  {monthlyFinanceReports.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada report bulanan yang digenerate.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '7px', maxHeight: '155px', overflowY: 'auto' }}>
                      {monthlyFinanceReports.slice(0, 8).map((report) => (
                        <div key={report.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.periodLabel}</h4>
                            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', margin: 0 }}>Rp {Number(report.readyPayoutTotal || 0).toLocaleString('id-ID')} ready / {report.rows?.length || 0} band</p>
                          </div>
                          <button type="button" onClick={() => handleDownloadMonthlyFinanceReport(report)} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>TXT</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {adminActiveSection === 'notifications' && (
          <section style={{ ...glassStyle('admin-notification-center'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ADMIN NOTIFICATION CENTER</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>ANTRIAN AKSI ADMIN</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '380px' }}>Ringkasan hal yang perlu dicek: kurasi, pembayaran, order, rekening, legal, dan report.</p>
            </div>
            {adminNotificationQueue.length === 0 ? (
              <div style={{ padding: '18px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada notifikasi admin. Kalau ada upload pamflet, order merch, atau report baru, masuk sini.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '7px' }}>
                {adminNotificationQueue.map((item) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'auto minmax(0,1fr) auto', gap: '9px', alignItems: 'center', padding: '9px', backgroundColor: '#080202', border: `1px solid ${item.color}30`, borderRadius: '10px' }}>
                    <span style={{ color: item.color, border: `1px solid ${item.color}45`, borderRadius: '9999px', padding: '5px 7px', fontSize: '8px', fontWeight: '900', width: 'fit-content' }}>{item.badge}</span>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title.toUpperCase()}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{item.body}</p>
                    </div>
                    {item.actionType === 'confirm_payment' ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: isTinyLayout ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setSelectedPaymentDetail(item.payment)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                        <button type="button" onClick={() => handleConfirmPendingPayment(item.payment)} disabled={!canAdminConfirmPayment(item.payment)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', color: canAdminConfirmPayment(item.payment) ? 'rgba(255,255,255,0.72)' : '#F1D4E5', border: canAdminConfirmPayment(item.payment) ? '1px solid rgba(241,212,229,0.35)' : '1px solid rgba(241,212,229,0.08)', cursor: canAdminConfirmPayment(item.payment) ? 'pointer' : 'not-allowed' }}>CONFIRM PAID</button>
                        <button type="button" onClick={() => handleRejectPendingPayment(item.payment)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '8px', padding: '7px 9px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REJECT</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setAdminActiveSection(item.targetSection)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>BUKA</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {adminActiveSection === 'messages' && (
          <section id="admin-message-section" style={{ ...glassStyle('admin-band-messages'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ADMIN MESSAGE CENTER</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>KIRIM PESAN KE BAND</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '12px', alignItems: 'start' }}>
              <form onSubmit={handleAdminMessageSubmit} style={{ display: 'grid', gap: '10px', padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.16)', borderRadius: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '1fr 1fr', gap: '8px' }}>
                  <select value={adminMessageDraft.targetBandSlug} onChange={(event) => setAdminMessageDraft({ ...adminMessageDraft, targetBandSlug: event.target.value })} style={formInputStyle}>
                    <option value="all">SEMUA BAND</option>
                    {publicBandList.map((profile) => (
                      <option key={profile.slug || createSlug(profile.name)} value={profile.slug || createSlug(profile.name)}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <select value={adminMessageDraft.category} onChange={(event) => setAdminMessageDraft({ ...adminMessageDraft, category: event.target.value })} style={formInputStyle}>
                    {['payment', 'payout', 'pamflet', 'album', 'merch', 'pengumuman', 'lainnya'].map((category) => (
                      <option key={category} value={category}>{category.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <input type="text" placeholder="SUBJEK PESAN ADMIN" value={adminMessageDraft.subject} onChange={(event) => setAdminMessageDraft({ ...adminMessageDraft, subject: event.target.value })} style={formInputStyle} />
                <textarea placeholder="ISI PESAN KE BAND..." value={adminMessageDraft.body} onChange={(event) => setAdminMessageDraft({ ...adminMessageDraft, body: event.target.value })} rows={6} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                <button type="submit" style={{ ...glassButtonStyle, padding: '11px', fontSize: '11px' }}>KIRIM PESAN ADMIN</button>
              </form>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.16)', borderRadius: '12px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>SUPPORT MASUK DARI BAND</p>
                  {adminSupportMessages.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada pesan support dari band.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                      {adminSupportMessages.map((message) => (
                        <div key={message.id} style={{ ...compactRowStyle, border: message.read ? '1px solid #F1D4E5' : '1px solid rgba(241,212,229,0.3)' }}>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{String(message.category || 'support').toUpperCase()} / {message.createdAt}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0' }}>{message.subject}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: '0 0 6px 0' }}>{message.body}</p>
                          {message.attachmentUrl && (
                            <a href={message.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', width: 'fit-content', marginBottom: '6px', color: '#73BBC9', fontSize: '9px', fontWeight: '900', textDecoration: 'none' }}>
                              BUKA LAMPIRAN: {(message.attachmentName || 'FILE').toUpperCase()}
                            </a>
                          )}
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Dari: <span style={{ color: '#F8F7F8' }}>{message.sender}</span> / {message.contact}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '12px' }}>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>PESAN ADMIN TERKIRIM</p>
                  {adminSentBandMessages.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Belum ada pesan admin yang dikirim ke band.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                      {adminSentBandMessages.slice(0, 8).map((message) => (
                        <div key={message.id} style={compactRowStyle}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{String(message.category || 'info').toUpperCase()} / KE {String(message.targetBandName || 'Semua Band').toUpperCase()}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0' }}>{message.subject}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{message.replied ? `Reply terakhir: ${message.lastReply}` : message.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {adminActiveSection === 'merch' && (
          <section id="admin-merch-section" style={{ ...glassStyle('admin-merch-consignment'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>MERCH STOCK CONTROL</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>STOK DI ADMIN WISPACE</h3>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                ['MENUNGGU STOK', adminWaitingConsignmentItems.length, 'rgba(255,255,255,0.72)'],
                ['STOK READY', adminConsignmentMerchItems.filter((item) => item.consignmentStatus === 'stock_received').length, 'rgba(255,255,255,0.72)'],
                ['UNIT DI ADMIN', adminConsignmentStockTotal, 'rgba(255,255,255,0.72)'],
                ['TOTAL TITIP', adminConsignmentMerchItems.length, '#73BBC9']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${color}33`, borderRadius: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 5px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '18px', fontWeight: '900' }}>{value}</strong>
                </div>
              ))}
            </div>
            {adminConsignmentMerchItems.length === 0 ? (
              <div style={{ padding: '18px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada titipan merch.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {adminConsignmentMerchItems.map((item) => {
                  const statusColor = getConsignmentStatusColor(item.consignmentStatus || 'waiting_stock_handover');
                  const isReceived = item.consignmentStatus === 'stock_received';
                  return (
                    <div key={item.id} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '54px minmax(0, 1fr) minmax(150px, 0.8fr) auto', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', display: 'grid', placeItems: 'center' }}>
                        {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ShoppingBag size={18} color="#12323a" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{(item.bandName || 'Band WiSpace').toUpperCase()} / STOCK BAND {item.stock || 0}</p>
                        <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(item.name || 'Merch').toUpperCase()}</h4>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Stok admin: <span style={{ color: item.adminStockOnHand ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontWeight: '900' }}>{Number(item.adminStockOnHand || 0).toLocaleString('id-ID')} unit</span></p>
                        <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.35, margin: '3px 0 0 0' }}>{item.originShipping?.address || 'Silahkan hubungi admin untuk alamat kirim stok.'}</p>
                      </div>
                      <div>
                        <p style={{ color: statusColor, fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{getConsignmentStatusLabel(item.consignmentStatus || 'waiting_stock_handover')}</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{isReceived ? 'READY FULFILLMENT' : 'MENUNGGU STOK'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: isCompactLayout ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleAdminConsignmentStatusUpdate(item, 'stock_received')} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(241,212,229,0.35)' }}>{isReceived ? 'UPDATE STOK' : 'STOK DITERIMA'}</button>
                        {isReceived && (
                          <button type="button" onClick={() => handleAdminConsignmentStatusUpdate(item, 'waiting_stock_handover')} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', color: 'rgba(255,255,255,0.72)', border: '1px solid rgba(241,212,229,0.32)' }}>BALIK WAIT</button>
                        )}
                        <button type="button" onClick={() => openAdminMessageForMerch(item)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>KIRIM PESAN</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {adminActiveSection === 'setup' && (
          <>
          <section style={{ ...glassStyle('admin-prelaunch-cleanup'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>PRE-LAUNCH CLEANUP</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>CHECKLIST MENUJU DATA REAL</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '420px' }}>Biar sebelum reset isi demo, kita bisa lihat cepat mana yang sudah aman dan mana yang masih perlu 1 kali test lagi.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {preLaunchCleanupChecklist.map((item) => (
                <div key={item.title} style={compactRowStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>{item.title.toUpperCase()}</h4>
                    <span style={{ color: getReadinessColor(item.status), border: `1px solid ${getReadinessBorder(item.status)}`, backgroundColor: getReadinessTint(item.status), borderRadius: '9999px', padding: '4px 7px', fontSize: '8px', fontWeight: '900' }}>{item.status.toUpperCase()}</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.42, margin: 0 }}>{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...glassStyle('admin-real-flow-checklist'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>REAL TEST FLOW</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>CHECKLIST TESTING</h3>
              </div>
              <div style={{ display: 'grid', justifyItems: isTinyLayout ? 'start' : 'end', gap: '5px' }}>
                <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>{completedRealFlowCount}/{realFlowChecklist.length}</strong>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '380px', textAlign: isTinyLayout ? 'left' : 'right' }}>Urutan ini dipakai setelah SQL Supabase jalan dan data dummy sudah siap dibersihkan.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '7px' }}>
              {realFlowChecklist.map((item, index) => (
                <div key={item.title} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: isTinyLayout ? '28px 1fr' : '28px minmax(0, 1fr) auto', gap: '9px', alignItems: 'center' }}>
                  <strong style={{ width: '26px', height: '26px', borderRadius: '9999px', backgroundColor: getReadinessTint(item.status), border: `1px solid ${getReadinessBorder(item.status)}`, color: getReadinessColor(item.status), display: 'grid', placeItems: 'center', fontSize: '10px' }}>{index + 1}</strong>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>{item.title.toUpperCase()}</h4>
                      <span style={{ color: getReadinessColor(item.status), border: `1px solid ${getReadinessBorder(item.status)}`, backgroundColor: getReadinessTint(item.status), borderRadius: '9999px', padding: '3px 6px', fontSize: '8px', fontWeight: '900' }}>{item.status.toUpperCase()}</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>{item.note}</p>
                  </div>
                  <button type="button" onClick={item.action} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px', gridColumn: isTinyLayout ? '2 / 3' : 'auto', width: 'fit-content' }}>{item.actionLabel}</button>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...glassStyle('admin-supabase-setup'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>SUPABASE SETUP ORDER</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>SQL CHECKLIST</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '380px' }}>Run file ini berurutan di Supabase SQL Editor. Kalau sudah pernah, aman di-run ulang karena mayoritas pakai if not exists/drop policy.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {SQL_SETUP_PLAN.map((step, index) => (
                <div key={step.file} style={compactRowStyle}>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>STEP {index + 1} / {step.file}</p>
                  <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{step.title.toUpperCase()}</h4>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>{step.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...glassStyle('admin-production-readiness'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>PRODUCTION READINESS</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>FITUR SIAP VS DEMO</h3>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                ['READY', readinessStatusCounts.ready || 0, 'rgba(255,255,255,0.72)'],
                ['SCAFFOLD', readinessStatusCounts.scaffold || 0, '#73BBC9'],
                ['DEMO', readinessStatusCounts.demo || 0, 'rgba(255,255,255,0.72)'],
                ['TODO', readinessStatusCounts.todo || 0, '#F1D4E5']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${color}33`, borderRadius: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 5px 0' }}>{label}</p>
                  <strong style={{ color, fontSize: '18px', fontWeight: '900' }}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '10px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>STORAGE HEALTH</p>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {storageHealthItems.map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>
                      <span>{label}</span>
                      <strong style={{ color }}>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>NEXT BLOCKERS</p>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {productionBlockers.slice(0, 4).map((item) => (
                    <div key={`blocker-${item.title}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>{item.title.toUpperCase()}</span>
                      <strong style={{ color: getReadinessColor(item.status), fontSize: '9px' }}>{item.status.toUpperCase()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              {productionReadinessItems.map((item) => (
                <div key={item.title} style={compactRowStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>{item.title.toUpperCase()}</h4>
                    <span style={{ color: getReadinessColor(item.status), border: `1px solid ${getReadinessBorder(item.status)}`, backgroundColor: getReadinessTint(item.status), borderRadius: '9999px', padding: '4px 7px', fontSize: '8px', fontWeight: '900' }}>{item.status.toUpperCase()}</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>{item.note}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '10px' }}>
              <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 6px 0' }}>PAYMENT FLOW SCAFFOLD</p>
              <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {PAYMENT_FLOW_STEPS.map((step, index) => (
                  <div key={step.status} style={{ padding: '9px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '9px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', margin: '0 0 4px 0' }}>STEP {index + 1} / {step.status}</p>
                    <strong style={{ color: '#F8F7F8', fontSize: '10px' }}>{step.title.toUpperCase()}</strong>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{step.note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.14)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 6px 0' }}>PAYMENT GATEWAY READINESS</p>
                  <h4 style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: 0 }}>{activePaymentGatewayProvider.title.toUpperCase()}</h4>
                </div>
                <span style={{ color: getReadinessColor(paymentGatewayReadinessStatus), border: `1px solid ${getReadinessBorder(paymentGatewayReadinessStatus)}`, backgroundColor: getReadinessTint(paymentGatewayReadinessStatus), borderRadius: '9999px', padding: '5px 8px', fontSize: '8px', fontWeight: '900' }}>{paymentGatewayReadinessStatus.toUpperCase()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '0.85fr 1.15fr', gap: '10px' }}>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {paymentGatewayHealthItems.map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '7px 0', borderTop: `1px solid ${flatLineColor}` }}>
                      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900' }}>{label}</span>
                      <strong style={{ color, fontSize: '9px', fontWeight: '900', textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {PAYMENT_GATEWAY_PROVIDER_OPTIONS.map((provider) => (
                    <div key={provider.id} style={{ padding: '9px', backgroundColor: provider.id === activePaymentGatewayProvider.id ? 'rgba(115,187,201,0.06)' : '#080202', border: `1px solid ${provider.id === activePaymentGatewayProvider.id ? 'rgba(115,187,201,0.28)' : 'rgba(241,212,229,0.10)'}`, borderRadius: '9px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: provider.id === activePaymentGatewayProvider.id ? '#73BBC9' : '#F1D4E5', fontSize: '10px', fontWeight: '900' }}>{provider.title.toUpperCase()}</strong>
                        {provider.id === activePaymentGatewayProvider.id && <span style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900' }}>ACTIVE</span>}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '0 0 4px 0' }}>Public: {provider.publicEnv}</p>
                      <p style={{ color: '#F8F7F8', fontSize: '9px', lineHeight: 1.35, margin: '0 0 4px 0' }}>Server: {provider.serverEnv}</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: 0 }}>{provider.note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '7px', marginTop: '10px' }}>
                {paymentGatewayServerSteps.map((step, index) => (
                  <div key={step.title} style={{ padding: '8px', backgroundColor: '#080202', border: `1px solid ${getReadinessBorder(step.status)}`, borderRadius: '9px' }}>
                    <p style={{ color: getReadinessColor(step.status), fontSize: '8px', fontWeight: '900', margin: '0 0 4px 0' }}>STEP {index + 1} / {step.status.toUpperCase()}</p>
                    <strong style={{ color: '#F8F7F8', fontSize: '9px', fontWeight: '900' }}>{step.title.toUpperCase()}</strong>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{step.note}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.12)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 4px 0' }}>RECENT WEBHOOK EVENTS</p>
                  </div>
                  <button type="button" onClick={() => void fetchAdminPaymentRequests(userSession)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>REFRESH</button>
                </div>
                {recentPaymentWebhookEvents.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Belum ada webhook event. Setelah provider payment aktif, callback akan masuk ke sini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '7px', maxHeight: '210px', overflowY: 'auto' }}>
                    {recentPaymentWebhookEvents.map((event) => (
                      <div key={event.id} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', padding: '8px 0', borderTop: `1.5px solid ${event.verified ? 'rgba(115,187,201,0.26)' : 'rgba(241,212,229,0.24)'}` }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: event.verified ? '#73BBC9' : '#F1D4E5', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{String(event.provider || 'provider').toUpperCase()} / {event.verified ? 'VERIFIED' : 'DRY RUN'}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.checkoutRef || event.providerInvoiceId || 'NO REFERENCE'}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{String(event.providerStatus || 'unknown').replaceAll('_', ' ').toUpperCase()} / WiSpace: {String(event.wispaceStatus || '-').replaceAll('_', ' ').toUpperCase()}</p>
                        </div>
                        <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', whiteSpace: 'nowrap' }}>{event.receivedLabel || '-'}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section style={{ ...glassStyle('admin-testing-tools'), ...compactPanelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>LOCAL TESTING TOOLS</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>RESET & DATA HEALTH</h3>
              </div>
              <button type="button" onClick={handleResetLocalTestingData} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.35)', color: '#F8F7F8', borderRadius: '10px', padding: '9px 11px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>RESET LOCAL DATA</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
              {[
                ['BAND', publicBandProfiles.length],
                ['RILISAN', albumItems.length],
                ['MERCH', publicMerchList.length],
                ['ARTIKEL', publicArticleList.length],
                ['GIGS', gigs.length],
                ['TRANSAKSI', saleTransactions.length],
                ['ORDER', merchOrders.length],
                ['LIBRARY', purchasedAlbums.length]
              ].map(([label, value]) => (
                <div key={label} style={compactMetricCardStyle}>
                  <p style={compactMetricLabelStyle}>{label}</p>
                  <strong style={compactMetricValueStyle}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginTop: '12px' }}>
              {[
                ['payments', 'RESET PAYMENT', pendingPayments.length, 'rgba(255,255,255,0.72)'],
                ['commerce', 'RESET LEDGER/ORDER', saleTransactions.length + merchOrders.length, '#73BBC9'],
                ['library', 'RESET LIBRARY', purchasedAlbums.length + downloadLogs.length, 'rgba(255,255,255,0.72)'],
                ['messages', 'RESET MESSAGE/NOTIF', messages.length + contentReports.length + readSubscribedUpdateIds.length, 'rgba(255,255,255,0.72)']
              ].map(([bucketId, label, count, color]) => (
                <button
                  key={bucketId}
                  type="button"
                  onClick={() => handleResetLocalTestingBucket(bucketId)}
                  style={{ display: 'grid', gap: '4px', textAlign: 'left', background: 'rgba(241,212,229,0.03)', border: `1px solid ${color}33`, color: '#F8F7F8', borderRadius: '10px', padding: '10px', cursor: 'pointer', fontFamily: FONT_STACK }}
                >
                  <span style={{ color, fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px' }}>{label}</span>
                  <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>{count}</strong>
                </button>
              ))}
            </div>
          </section>
          </>
          )}

          {adminActiveSection === 'ledger' && (
          <section id="admin-ledger-section" style={{ ...glassStyle('admin-transaction-ledger'), ...compactPanelStyle, scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>PAYMENT LEDGER</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: 0 }}>TRANSAKSI TERBARU</h3>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px' }}>
              {adminFinanceFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setAdminFinanceFilter(filter.id)}
                  style={{ padding: '7px 9px', borderRadius: '9999px', border: adminFinanceFilter === filter.id ? '1px solid rgba(115,187,201,0.55)' : '1px solid rgba(241,212,229,0.1)', backgroundColor: adminFinanceFilter === filter.id ? 'rgba(115,187,201,0.12)' : '#080202', color: adminFinanceFilter === filter.id ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}
                >
                  {filter.label} / {filter.count}
                </button>
              ))}
              <select value={adminFinanceMonth} onChange={(event) => setAdminFinanceMonth(event.target.value)} style={{ ...formInputStyle, width: 'fit-content', minWidth: '150px', height: '31px', padding: '7px 9px', fontSize: '9px', borderRadius: '9999px' }}>
                <option value="all">SEMUA BULAN</option>
                {adminFinanceMonthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>{formatFinanceMonthLabel(monthKey)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '7px', marginBottom: '12px' }}>
              {[
                ['FILTERED PRODUCT GROSS', adminFilteredGrossTotal],
                ['FILTERED FEE', adminFilteredFeeTotal],
                ['FILTERED BAND', adminFilteredBandNetTotal]
              ].map(([label, amount]) => (
                <div key={label} style={{ padding: '8px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', margin: '0 0 4px 0' }}>{label}</p>
                  <strong style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>Rp {Number(amount || 0).toLocaleString('id-ID')}</strong>
                </div>
              ))}
            </div>
            {adminFilteredTransactions.length === 0 ? (
              <p style={{ color: '#F8F7F8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Belum ada transaksi di filter ini. Pembelian rilisan, track, merch, dan slot exclusive akan masuk ke ledger admin.</p>
            ) : (
              <div style={{ display: 'grid', gap: '7px' }}>
                {adminFilteredTransactions.slice(0, 12).map((transaction) => (
                  <div key={transaction.id} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(180px, 1.35fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) minmax(130px, 0.9fr) auto', gap: isTinyLayout ? '6px' : '9px', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0', lineHeight: 1.15 }}>{(transaction.orderId || transaction.id).toUpperCase()} / {(transaction.productType || 'order').toUpperCase()}</p>
                      <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{String(transaction.productTitle || 'Transaksi WiSpace').toUpperCase()}</h4>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Buyer: <strong style={{ color: '#F8F7F8' }}>{transaction.buyerName || '-'}</strong><br />Seller: <strong style={{ color: '#F8F7F8' }}>{transaction.sellerBandName || 'WiSpace'}</strong></p>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Produk Rp {Number(transaction.grossAmount || 0).toLocaleString('id-ID')}<br />{transaction.productType === 'merch' ? `Ongkir Rp ${Number(merchShippingByOrderId[String(transaction.orderId || '')] || merchShippingByOrderId[String(transaction.id || '')] || 0).toLocaleString('id-ID')}` : `Fee Rp ${Number(transaction.platformFee || 0).toLocaleString('id-ID')}`}</p>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Fee Rp {Number(transaction.platformFee || 0).toLocaleString('id-ID')} / Band Rp {Number(transaction.bandNet || 0).toLocaleString('id-ID')}<br />{transaction.createdAt}</p>
                    <strong style={{ color: transaction.productType === 'merch' ? getMerchOrderStatusColor(transaction.fulfillmentStatus) : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', justifySelf: isCompactLayout ? 'start' : 'end', whiteSpace: 'nowrap' }}>{transaction.productType === 'merch' ? getMerchOrderStatusLabel(transaction.fulfillmentStatus) : String(transaction.paymentStatus || transaction.status || 'paid').replaceAll('_', ' ').toUpperCase()}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {adminActiveSection === 'article' && (
          <section id="admin-article-section" style={{ ...glassStyle('admin-article-publisher'), padding: '18px', backgroundColor: '#080202', marginBottom: '24px', scrollMarginTop: '110px' }}>
            <div style={{ marginBottom: '14px' }}>
              <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>WISPACE EDITORIAL</p>
              <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: 0 }}>PUBLISH ARTIKEL ADMIN</h3>
            </div>
            <form onSubmit={handleAdminArticleSubmit} style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <input type="text" placeholder="JUDUL ARTIKEL ADMIN" value={adminArticleDraft.title} onChange={(event) => setAdminArticleDraft({ ...adminArticleDraft, title: event.target.value })} required style={formInputStyle} />
                <input type="text" placeholder="KATEGORI (News, Editorial, Update)" value={adminArticleDraft.category} onChange={(event) => setAdminArticleDraft({ ...adminArticleDraft, category: event.target.value })} style={formInputStyle} />
              </div>
              <textarea placeholder="RINGKASAN ARTIKEL" value={adminArticleDraft.excerpt} onChange={(event) => setAdminArticleDraft({ ...adminArticleDraft, excerpt: event.target.value })} required rows={3} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              <textarea placeholder="ISI ARTIKEL LENGKAP" value={adminArticleDraft.body} onChange={(event) => setAdminArticleDraft({ ...adminArticleDraft, body: event.target.value })} rows={6} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              <button type="submit" style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px', width: 'fit-content' }}>PUBLISH ARTIKEL WISPACE</button>
            </form>
          </section>
          )}

          {adminActiveSection === 'picks' && (
          <section id="admin-picks-section" style={{ ...glassStyle('admin-wispace-picks'), padding: '18px', backgroundColor: '#080202', marginBottom: '24px', scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>WISPACE PICKS</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: 0 }}>HOMEPAGE PICK CURATION</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0, maxWidth: '420px' }}>Isi link YouTube, pilih label kontennya, lalu kasih judul dan catatan singkat. Kalau URL dikosongkan, homepage otomatis random harian dari rilisan dan gigs.</p>
            </div>
            <form onSubmit={handleWispacePickSubmit} style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1fr) minmax(260px, 0.55fr)', gap: '14px', alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="url" placeholder="YOUTUBE URL (opsional)" value={wispacePickDraft.youtubeUrl} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, youtubeUrl: event.target.value })} style={formInputStyle} />
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <select value={wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, contentLabel: event.target.value })} style={formInputStyle}>
                    {WISPACE_PICK_LABEL_OPTIONS.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                  <input type="text" placeholder="JUDUL PICK" value={wispacePickDraft.title} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, title: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="NAMA BAND / CHANNEL" value={wispacePickDraft.bandName} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, bandName: event.target.value })} style={formInputStyle} />
                </div>
                <input type="url" placeholder="THUMBNAIL URL CUSTOM (opsional)" value={wispacePickDraft.thumbnail} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, thumbnail: event.target.value })} style={formInputStyle} />
                <textarea placeholder="REVIEW SINGKAT WISPACE" value={wispacePickDraft.review} onChange={(event) => setWispacePickDraft({ ...wispacePickDraft, review: event.target.value })} rows={5} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '10px', lineHeight: 1.4, margin: '-2px 0 0 0' }}>Label ini nanti tampil di homepage sebagai penanda konten seperti podcast, review, atau live session.</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="submit" style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px', width: 'fit-content' }}>SAVE WISPACE PICK</button>
                  <button type="button" onClick={handleWispacePickClear} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '10px', padding: '12px 14px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>RESET RANDOM</button>
                </div>
              </div>
              <aside style={{ padding: '12px', border: `1.5px solid ${flatLineColor}`, borderRadius: '12px', background: 'rgba(8,2,2,0.72)' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 9px 0' }}>PREVIEW THUMBNAIL</p>
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1.5px solid ${flatLineColor}`, background: '#080202', display: 'grid', placeItems: 'center', marginBottom: '10px' }}>
                  {(wispacePickDraft.thumbnail || getYoutubeThumbnail(wispacePickDraft.youtubeUrl)) ? <img src={wispacePickDraft.thumbnail || getYoutubeThumbnail(wispacePickDraft.youtubeUrl)} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} /> : <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', padding: '42px 0' }}>AUTO RANDOM ACTIVE</span>}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>{wispacePickDraft.youtubeUrl ? `${wispacePickDraft.contentLabel || createEmptyWispacePick().contentLabel} aktif${wispacePickDraft.updatedAt ? ` / update ${new Date(wispacePickDraft.updatedAt).toLocaleDateString('id-ID')}` : ''}.` : 'URL kosong: homepage pakai random pick otomatis.'}</p>
              </aside>
            </form>
          </section>
          )}

          {adminActiveSection === 'moderation' && (
          <section id="admin-moderation-section" style={{ ...glassStyle('admin-content-moderation'), padding: '18px', backgroundColor: '#080202', marginBottom: '24px', scrollMarginTop: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>CONTENT MODERATION</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: 0 }}>LAPORAN, KOMENTAR, ARTIKEL</h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0, maxWidth: '420px' }}>Tempat admin ngecek laporan plagiat/SARA/spam, remove komentar, dan takedown artikel kalau perlu.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px' }}>
                <h4 style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>LAPORAN TERBUKA ({openContentReports.length})</h4>
                {openContentReports.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada laporan konten.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {openContentReports.slice(0, 6).map((report) => (
                      <div key={report.id} style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.12)', borderRadius: '10px' }}>
                        <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{report.type.toUpperCase()} / {report.reason.toUpperCase()}</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.35, margin: '0 0 8px 0' }}>{report.title}</p>
                        <p style={{ color: '#F8F7F8', fontSize: '10px', margin: '0 0 8px 0' }}>By {report.reporterName} / {report.createdAt}</p>
                        <button onClick={() => handleResolveContentReport(report.id)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '10px' }}>RESOLVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px' }}>
                <h4 style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>KOMENTAR TERBARU</h4>
                {recentArticleComments.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada komentar artikel.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {recentArticleComments.slice(0, 6).map((comment) => (
                      <div key={`${comment.articleId}-${comment.id}`} style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.12)', borderRadius: '10px' }}>
                        <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{comment.author.toUpperCase()}</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.35, margin: '0 0 6px 0' }}>{comment.body}</p>
                        <p style={{ color: '#F8F7F8', fontSize: '10px', margin: '0 0 8px 0' }}>{comment.articleTitle}</p>
                        <button onClick={() => handleRemoveArticleComment(comment.articleId, comment.id)} style={{ background: 'rgba(241,212,229,0.1)', border: '1px solid rgba(241,212,229,0.35)', color: '#F8F7F8', borderRadius: '9px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px' }}>
                <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>ARTIKEL LIVE</h4>
                {publicArticleList.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada artikel live.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {publicArticleList.slice(0, 6).map((article) => (
                      <div key={`moderate-${article.id}`} style={{ padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.12)', borderRadius: '10px' }}>
                        <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', lineHeight: 1.25, margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                        <p style={{ color: '#F8F7F8', fontSize: '10px', margin: '0 0 8px 0' }}>{article.category} / {article.bandName}</p>
                        <button onClick={() => handleRemoveArticle(article)} style={{ background: 'rgba(241,212,229,0.1)', border: '1px solid rgba(241,212,229,0.35)', color: '#F8F7F8', borderRadius: '9px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}

          {adminActiveSection === 'pamflet' && (
          <div id="admin-pamflet-section" style={{ scrollMarginTop: '110px' }}>
          {pendingGigs.length === 0 ? (
            <div style={{ ...glassStyle('empty-admin'), padding: '32px', backgroundColor: '#080202', textAlign: 'center' }}>
              <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0' }}>ANTREAN BERSIH</h3>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: 0 }}>Belum ada pamflet baru yang perlu dicek.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
              {pendingGigs.map(gig => {
                const requestType = getGigRequestType(gig);
                const isExclusiveRequest = requestType === 'exclusive';
                return (
                <div key={gig.id} style={{ ...glassStyle(`admin-${gig.id}`), padding: '14px', backgroundColor: '#080202' }}>
                  <button
                    type="button"
                    onClick={() => gig.image && setSelectedPosterPreview(gig)}
                    disabled={!gig.image}
                    title={gig.image ? 'Klik buat cek pamflet utuh' : 'Belum ada gambar pamflet'}
                    style={{ width: '100%', padding: 0, margin: '0 0 14px 0', border: 'none', background: 'transparent', cursor: gig.image ? 'zoom-in' : 'default', fontFamily: FONT_STACK }}
                  >
                    {renderGigPosterImage(gig, { width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px' })}
                    {gig.image && <span style={{ display: 'block', color: '#73BBC9', fontSize: '10px', fontWeight: '900', marginTop: '8px', textAlign: 'left' }}>KLIK GAMBAR UNTUK PREVIEW UTUH</span>}
                  </button>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>STATUS: PENDING REVIEW</p>
                  <p style={{ color: isExclusiveRequest ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>REQUEST: {isExclusiveRequest ? 'EXCLUSIVE SLIDE' : 'FREE BULLETIN'}</p>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0', color: '#F8F7F8' }}>{gig.title?.toUpperCase()}</h3>
                  <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5, marginBottom: '14px' }}>
                    <div>Kota/Venue: <span style={{ color: '#F8F7F8' }}>{gig.city}</span></div>
                    <div>Genre: <span style={{ color: '#F8F7F8' }}>{getGigGenre(gig)}</span></div>
                    <div>Tanggal: <span style={{ color: '#F8F7F8' }}>{getGigDate(gig)}</span></div>
                    <div>HTM: <span style={{ color: '#F8F7F8' }}>{getGigHtm(gig)}</span></div>
                    <div>CP: <span style={{ color: '#F8F7F8' }}>{getGigCp(gig)}</span></div>
                    {isApprovedHomepageGig(gig) && (
                      <div>Tayang sampai: <span style={{ color: '#73BBC9' }}>{getGigApprovedUntil(gig) || 'Belum ada, approve ulang setelah SQL upgrade'}</span></div>
                    )}
                  </div>
                  <label style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px' }}>HABIS TAYANG</span>
                    <input
                      type="date"
                      value={getGigExpiryDraftValue(gig)}
                      onChange={(event) => updateGigExpiryDraft(gig.id, event.target.value)}
                      style={{ ...formInputStyle, padding: '9px 10px', fontSize: '11px' }}
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button onClick={() => handleGigModeration(gig.id, 'approved_free', getGigExpiryDraftValue(gig))} style={{ padding: '10px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE</button>
                    <button onClick={() => handleGigModeration(gig.id, 'approved_waiting_payment')} style={{ padding: '10px', backgroundColor: 'rgba(241,212,229,0.06)', color: '#F8F7F8', border: '1px solid rgba(115,187,201,0.45)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>APPROVE PAY</button>
                    <button onClick={() => handleGigModeration(gig.id, 'rejected')} style={{ padding: '10px', backgroundColor: 'rgba(241,212,229,0.1)', color: '#F8F7F8', border: '1px solid rgba(241,212,229,0.35)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REJECT</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
          </div>
          )}

          {adminActiveSection === 'pamflet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '28px' }}>
            {[
              { title: 'EXCLUSIVE WAITING PAYMENT', items: exclusiveWaitingPaymentGigs, color: 'rgba(255,255,255,0.72)', mode: 'waiting' },
              { title: 'EXCLUSIVE PAID / NEED ACTIVATE', items: exclusivePaidWaitingActivationGigs, color: '#73BBC9', mode: 'activate' }
            ].map((group) => (
              <section key={group.title} style={{ ...glassStyle(group.title), padding: '18px', backgroundColor: '#080202' }}>
                <h3 style={{ color: group.color, fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>{group.title}</h3>
                {group.items.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada pamflet di status ini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {group.items.map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', alignItems: 'center' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>{gig.city} / {getGigDate(gig)}</p>
                          <p style={{ color: group.color, fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '4px 0 0 0' }}>{group.mode === 'waiting' ? `Menunggu user bayar Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')}` : 'Payment received, siap diaktifkan'}</p>
                          {group.mode === 'activate' && (
                            <label style={{ display: 'grid', gap: '5px', marginTop: '8px', maxWidth: '170px' }}>
                              <span style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900', letterSpacing: '0.8px' }}>HABIS TAYANG</span>
                              <input
                                type="date"
                                value={getGigExpiryDraftValue(gig)}
                                onChange={(event) => updateGigExpiryDraft(gig.id, event.target.value)}
                                style={{ ...formInputStyle, padding: '7px 8px', fontSize: '10px', borderRadius: '8px' }}
                              />
                            </label>
                          )}
                        </div>
                        {group.mode === 'activate' ? (
                          <button onClick={() => handleGigActivateExclusive(gig.id, getGigExpiryDraftValue(gig))} style={{ padding: '9px 11px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>ACTIVATE</button>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', whiteSpace: 'nowrap' }}>WAIT PAY</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
          )}

          {adminActiveSection === 'pamflet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '28px' }}>
            {[
              { title: 'FREE BULLETIN LIVE', items: approvedFreeGigs, color: 'rgba(255,255,255,0.72)' },
              { title: 'EXCLUSIVE SLIDE LIVE', items: approvedExclusiveGigs, color: '#73BBC9' }
            ].map((group) => (
              <section key={group.title} style={{ ...glassStyle(group.title), padding: '18px', backgroundColor: '#080202' }}>
                <h3 style={{ color: group.color, fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>{group.title}</h3>
                {group.items.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada pamflet di list ini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {group.items.map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', alignItems: 'center' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>APPROVE: <span style={{ color: '#F8F7F8' }}>{getGigApprovedAt(gig) || '-'}</span></p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>HABIS: <span style={{ color: 'rgba(255,255,255,0.72)' }}>{getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</span></p>
                          <label style={{ display: 'grid', gap: '5px', marginTop: '8px', maxWidth: '170px' }}>
                            <span style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900', letterSpacing: '0.8px' }}>UBAH HABIS TAYANG</span>
                            <input
                              type="date"
                              value={getGigExpiryDraftValue(gig)}
                              onChange={(event) => updateGigExpiryDraft(gig.id, event.target.value)}
                              style={{ ...formInputStyle, padding: '7px 8px', fontSize: '10px', borderRadius: '8px' }}
                            />
                          </label>
                        </div>
                        <div style={{ display: 'grid', gap: '6px' }}>
                          <button onClick={() => handleGigExpiryUpdate(gig)} style={{ padding: '8px 10px', backgroundColor: 'rgba(115,187,201,0.12)', color: '#73BBC9', border: '1px solid rgba(115,187,201,0.35)', borderRadius: '10px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SAVE</button>
                          <button onClick={() => handleGigRemove(gig.id)} style={{ padding: '8px 10px', backgroundColor: 'rgba(241,212,229,0.1)', color: '#F8F7F8', border: '1px solid rgba(241,212,229,0.35)', borderRadius: '10px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
          )}

          {adminActiveSection === 'pamflet' && (
          <section style={{ ...flatSurfaceStyle, padding: isTinyLayout ? '12px 10px' : '14px 12px', marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>POSTER ARCHIVE</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: 0 }}>ARSIP PAMFLET NONAKTIF</h3>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>{archivedGigs.length} ITEM</span>
            </div>
            {archivedGigs.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>Belum ada pamflet yang masuk arsip.</p>
            ) : (
              <div style={flatListStyle}>
                {archivedGigs.slice(0, 24).map((gig) => (
                  <div
                    key={`archived-${gig.id}`}
                    style={{
                      ...flatItemStyle,
                      gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1.25fr) minmax(130px, 0.55fr) minmax(140px, 0.65fr) auto',
                      cursor: 'default',
                      padding: isTinyLayout ? '8px 0' : '9px 0'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: getGigRequestType(gig) === 'exclusive' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>
                        {getGigRequestType(gig) === 'exclusive' ? 'EXCLUSIVE SLIDE' : 'FREE BULLETIN'}
                      </p>
                      <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(gig.title || 'Pamflet WiSpace').toUpperCase()}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{gig.city || '-'} / {getGigDate(gig)} / {getGigGenre(gig)}</p>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>APPROVE</p>
                      <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.35, margin: 0 }}>{getGigApprovedAt(gig) || '-'}</p>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>ARSIP SEJAK</p>
                      <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.35, margin: 0 }}>{getGigApprovedUntil(gig) || getGigDate(gig)}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: isCompactLayout ? 'flex-start' : 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                      {gig.image ? (
                        <button type="button" onClick={() => setSelectedPosterPreview(gig)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>PREVIEW</button>
                      ) : null}
                      <span style={{ color: '#F1D4E5', fontSize: '9px', fontWeight: '900', alignSelf: 'center', whiteSpace: 'nowrap' }}>REMOVED</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}
            </>
          )}
        </section>
      )}

      {/* EXPLORE RELEASES PAGE */}
      {!loading && isExplorePage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{activeExploreCopy.eyebrow}</p>
              <h2 style={pageTitleStyle}>{activeExploreCopy.title}</h2>
              <p style={pageLeadStyle}>{activeExploreCopy.lead}</p>
            </div>
          </div>

          {exploreTab === 'rilisan' && selectedRelease && (
            <div onClick={() => setSelectedReleaseId(null)} style={{ position: 'fixed', inset: 0, zIndex: 1360, display: 'grid', placeItems: isTinyLayout ? 'end center' : 'center', padding: isTinyLayout ? '12px' : '24px', boxSizing: 'border-box', background: 'linear-gradient(180deg, rgba(8,2,2,0.36), rgba(8,2,2,0.82))', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
              <section onClick={(event) => event.stopPropagation()} style={{ ...modalPanelStyle, width: isTinyLayout ? '100%' : 'min(900px, calc(100vw - 54px))', maxHeight: isTinyLayout ? '88vh' : '84vh', overflowY: 'auto', boxSizing: 'border-box', padding: isTinyLayout ? '12px' : '16px', borderRadius: '14px', animation: 'wispaceRise 460ms cubic-bezier(0.18, 0.92, 0.22, 1.08) both' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(190px, 280px) minmax(0, 1fr)', gap: isTinyLayout ? '14px' : '18px', alignItems: 'start' }}>
                <div style={{ width: '100%', maxWidth: isCompactLayout ? '240px' : 'none', justifySelf: isCompactLayout ? 'center' : 'stretch', aspectRatio: '1/1', background: softSurfaceBackground, borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(115,187,201,0.16)', display: 'grid', placeItems: 'center' }}>
                  {selectedRelease.coverPreview ? <img src={selectedRelease.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>COVER</span>}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>{selectedRelease.genre?.toUpperCase()} / {selectedRelease.trackCount} TRACK</p>
                      <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '23px' : 'clamp(30px, 4vw, 46px)', fontWeight: '900', lineHeight: 0.95, margin: '0 0 10px 0' }}>{selectedRelease.title.toUpperCase()}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', fontWeight: '800', margin: 0 }}>{selectedRelease.bandName?.toUpperCase()} / {selectedRelease.city?.toUpperCase()}</p>
                    </div>
                    <button onClick={() => setSelectedReleaseId(null)} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.12)', color: 'rgba(255,255,255,0.72)', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
                  </div>
                  {selectedRelease.description && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.55, margin: '0 0 14px 0' }}>{selectedRelease.description}</p>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {[
                      ['PRIVATE MASTER', `${selectedReleasePrivateTrackCount}/${selectedRelease.trackCount || (selectedRelease.tracks || []).length}`, selectedReleasePrivateTrackCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
                      ['PREVIEW READY', `${selectedReleasePreviewTrackCount}/${Math.max(0, (selectedRelease.tracks || []).length - selectedReleaseFreeFullCount)}`, selectedReleasePreviewTrackCount ? '#73BBC9' : 'rgba(255,255,255,0.72)'],
                      ['FREE FULL', selectedReleaseFreeFullCount, selectedReleaseFreeFullCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)']
                    ].map(([label, value, color]) => (
                      <span key={label} style={{ padding: '7px 9px', background: softRowBackground, border: `1px solid ${color}33`, borderRadius: '9999px', color, fontSize: '10px', fontWeight: '900' }}>{label}: <strong style={{ color: '#F8F7F8' }}>{value}</strong></span>
                    ))}
                  </div>
                  <div style={{ ...compactSurfaceStyle, display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>Full Album Rp {Number(selectedRelease.price || 0).toLocaleString('id-ID')}</strong>
                    <button onClick={() => handlePurchaseAlbum(selectedRelease)} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === selectedRelease.id) ? 'BUKA LIBRARY' : 'BELI FULL ALBUM'}</button>
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(selectedRelease.tracks || []).map((track, index) => (
                      <div key={`detail-track-${track.id}`} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '32px minmax(0, 1fr) auto auto', gap: '9px', alignItems: 'center', padding: '8px 0', backgroundColor: 'transparent', border: 'none', borderTop: `1.5px solid ${flatLineColor}`, borderRadius: 0 }}>
                        <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>{String(index + 1).padStart(2, '0')}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title.toUpperCase()}</p>
                          <p style={{ color: track.freeFull ? 'rgba(255,255,255,0.72)' : track.previewUrl || track.url ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '800', margin: 0 }}>{track.freeFull ? 'FREE FULL TRACK' : track.previewUrl || track.url ? '30 SECOND PREVIEW' : 'PREVIEW PENDING'}</p>
                        </div>
                        <button onClick={() => handlePlayTrack({ ...track, albumTitle: selectedRelease.title, bandName: selectedRelease.bandName, albumCover: selectedRelease.coverPreview }, (selectedRelease.tracks || []).map((item) => ({ ...item, albumTitle: selectedRelease.title, bandName: selectedRelease.bandName, albumCover: selectedRelease.coverPreview })))} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '10px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PLAY'}</button>
                        <button onClick={() => handlePurchaseTrack(selectedRelease, track)} disabled={track.freeFull} style={{ background: track.freeFull ? 'rgba(241,212,229,0.08)' : 'rgba(115,187,201,0.08)', border: `1px solid ${track.freeFull ? 'rgba(241,212,229,0.25)' : 'rgba(115,187,201,0.25)'}`, color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#73BBC9', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK }}>{track.freeFull ? 'FREE' : `Rp ${Number(track.price || 0).toLocaleString('id-ID')}`}</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </section>
            </div>
          )}

          <div style={{ display: exploreTab === 'rilisan' ? 'grid' : 'none', gridTemplateColumns: releaseExploreGridColumns, gap: isTinyLayout ? '18px' : '20px', alignItems: 'start' }}>
            <div>
              <section style={{ marginBottom: '26px' }}>
                <h3 style={sectionHeadingStyle}>DIGITAL RELEASES</h3>
                {filteredAlbums.length === 0 ? (
                  <div style={{ ...glassStyle('explore-empty-albums'), padding: '24px', backgroundColor: '#080202' }}>
                    <h4 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>BELUM ADA RILISAN</h4>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>Upload album dulu, nanti rilisan muncul di sini.</p>
                    <button onClick={() => openBandWorkspace('album')} style={{ ...glassButtonStyle, padding: '11px 18px', fontSize: '12px' }}>UPLOAD ALBUM</button>
                  </div>
                ) : (
                  <div style={compactVisualGridStyle}>
                    {filteredAlbums.map((album) => (
                      <article key={album.id} onClick={() => openReleaseDetail(album)} style={{ ...compactVisualCardStyle, borderColor: selectedRelease?.id === album.id ? 'rgba(115,187,201,0.46)' : flatLineColor }}>
                        <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#080202', border: `1.5px solid ${selectedRelease?.id === album.id ? 'rgba(115,187,201,0.35)' : flatLineColor}`, borderRadius: '8px', overflow: 'hidden', display: 'grid', placeItems: 'center', marginBottom: '9px' }}>
                          {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>COVER</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.genre.toUpperCase()} / {album.trackCount} TRACK</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', margin: '0 0 4px 0', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', margin: '0 0 7px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.bandName.toUpperCase()}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(album.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <button onClick={(event) => { event.stopPropagation(); handlePurchaseAlbum(album); }} style={{ ...glassButtonStyle, width: '100%', marginTop: '9px', padding: '7px 8px', fontSize: '9px', borderRadius: '8px' }}>{!userSession ? 'JOIN' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI'}</button>
                        {(album.tracks || []).length > 0 && (
                          <div style={{ display: 'grid', gap: '5px', borderTop: `1.5px solid ${flatLineColor}`, paddingTop: '7px', marginTop: '8px' }}>
                            {(album.tracks || []).slice(0, 2).map((track) => (
                              <div key={`explore-${track.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: track.freeFull ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title.toUpperCase()}</span>
                                <button onClick={(event) => { event.stopPropagation(); handlePurchaseTrack(album, track); }} disabled={track.freeFull} style={{ background: 'transparent', border: 'none', color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#73BBC9', fontSize: '9px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK, flexShrink: 0 }}>{track.freeFull ? 'FREE' : 'BUY'}</button>
                              </div>
                            ))}
                            {(album.tracks || []).length > 2 && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: 0 }}>+{album.tracks.length - 2} TRACK</p>}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside style={{ ...railPanelStyle, display: 'grid', gap: '14px', width: '100%', maxWidth: isCompactLayout ? 'none' : '300px', justifySelf: isCompactLayout ? 'stretch' : 'end' }}>
              <section style={{ padding: '2px 0 0 0' }}>
                <h3 style={sectionHeadingStyle}>BAND DIRECTORY</h3>
                {filteredBandProfiles.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada band yang cocok.</p>
                ) : (
                  <div style={flatListStyle}>
                    {filteredBandProfiles.slice(0, 3).map((profile) => (
                      <div key={`side-${profile.slug}`} style={{ ...flatItemStyle, gridTemplateColumns: '42px minmax(0, 1fr)', cursor: 'default' }}>
                        <div style={{ ...flatThumbStyle, width: '42px', height: '42px', borderRadius: '10px' }}>
                          {profile.photoPreview ? <img src={profile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <button
                            onClick={() => openBandPublicProfile(false, profile)}
                            style={{ background: 'transparent', border: 'none', color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: '0 0 5px 0', padding: 0, cursor: 'pointer', fontFamily: FONT_STACK, textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(115,187,201,0.65)', textUnderlineOffset: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {profile.name.toUpperCase()}
                          </button>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 4px 0' }}>{(profile.city || 'INDONESIA').toUpperCase()} / {(profile.genre || 'INDIE').toUpperCase()}</p>
                          <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: 0 }}>/{profile.slug || createSlug(profile.name)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ padding: '2px 0 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>MERCH HIGHLIGHT</h3>
                  <button onClick={() => setExploreTab('merch')} style={{ background: 'transparent', border: 'none', color: '#F8F7F8', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LIHAT SEMUA</button>
                </div>
                {filteredMerchItems.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Belum ada merch live.</p>
                ) : (
                  <div style={flatListStyle}>
                    {filteredMerchItems.slice(0, 4).map(item => (
                      <button key={item.id} onClick={() => openMerchDetail(item)} style={{ ...flatItemStyle, gridTemplateColumns: '42px minmax(0, 1fr)' }}>
                        <div style={{ ...flatThumbStyle, width: '42px', height: '42px', borderRadius: '8px' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name.toUpperCase()}</p>
                          <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>

          {exploreTab === 'band' && (
            <section style={{ padding: isTinyLayout ? '14px 0' : '18px 0' }}>
              <h3 style={sectionHeadingStyle}>BAND DIRECTORY</h3>
              {filteredBandProfiles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(auto-fill, minmax(270px, 1fr))', gap: isTinyLayout ? '8px' : '10px' }}>
                  {filteredBandProfiles.map((profile) => (
                    <div key={`band-tab-${profile.slug}`} style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '58px minmax(0, 1fr)' : '66px minmax(0, 1fr)', gap: isTinyLayout ? '10px' : '12px', cursor: 'default' }}>
                      <div style={{ ...flatThumbStyle, width: isTinyLayout ? '58px' : '66px', height: isTinyLayout ? '58px' : '66px', borderRadius: '10px' }}>
                        {profile.photoPreview ? <img src={profile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ marginBottom: '5px' }}>
                          <button onClick={() => openBandPublicProfile(false, profile)} style={{ background: 'transparent', border: 'none', color: '#F8F7F8', fontSize: isTinyLayout ? '14px' : '16px', fontWeight: '900', margin: 0, padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', cursor: 'pointer', fontFamily: FONT_STACK, textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(115,187,201,0.65)', textUnderlineOffset: '4px' }}>{profile.name.toUpperCase()}</button>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 5px 0' }}>{(profile.genre || 'INDIE').toUpperCase()} / {(profile.city || 'INDONESIA').toUpperCase()}</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>{profile.headline || 'Profile band belum lengkap.'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: 0 }}>Belum ada band yang cocok.</p>
              )}
            </section>
          )}

          {exploreTab === 'artikel' && (
            <section style={{ padding: isTinyLayout ? '14px 0' : '18px 0' }}>
              <h3 style={sectionHeadingStyle}>ARTIKEL SKENA</h3>
              {filteredArticles.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada artikel yang cocok.</p>
              ) : (
                <div style={flatListStyle}>
                  {filteredArticles.map((article) => (
                    <article key={article.id} onClick={() => openArticleReader(article)} style={{ ...flatItemStyle, display: 'block' }}>
                      <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>{article.category.toUpperCase()} / {article.createdAt}</p>
                      <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '15px' : '17px', fontWeight: '900', lineHeight: 1.08, margin: '0 0 8px 0' }}>{article.title.toUpperCase()}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{article.excerpt}</p>
                      <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '10px 0 0 0' }}>BACA ARTIKEL</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {exploreTab === 'merch' && (
            <section style={{ padding: isTinyLayout ? '14px 0' : '18px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>MERCH BAND</h3>
                {isBandAccount && <button onClick={() => openBandWorkspace('merch')} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px' }}>UPLOAD MERCH</button>}
              </div>
              {filteredMerchItems.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada merch yang cocok.</p>
              ) : (
                <div style={compactVisualGridStyle}>
                  {filteredMerchItems.map((item) => {
                    const merchCanBePurchased = isMerchPurchasable(item);
                    return (
                      <article key={item.id} onClick={() => openMerchDetail(item)} style={{ ...compactVisualCardStyle, borderColor: selectedMerch?.id === item.id ? 'rgba(115,187,201,0.46)' : flatLineColor }}>
                        <div style={{ width: '100%', aspectRatio: '3/4', backgroundColor: '#080202', border: `1.5px solid ${selectedMerch?.id === item.id ? 'rgba(115,187,201,0.35)' : flatLineColor}`, borderRadius: '8px', overflow: 'hidden', display: 'grid', placeItems: 'center', marginBottom: '9px' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item.bandName || bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name.toUpperCase()}</h4>
                          <p style={{ color: merchCanBePurchased ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '9px', fontWeight: '900', margin: '0 0 7px 0' }}>STOCK {getMerchAvailableStock(item)}</p>
                          <p style={{ color: item.fulfillmentMode === 'admin_consignment' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', margin: '0 0 7px 0' }}>{item.fulfillmentMode === 'admin_consignment' ? 'STOK DI ADMIN' : 'BAND SHIP'}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <button disabled={!merchCanBePurchased} onClick={(event) => { event.stopPropagation(); if (merchCanBePurchased) handlePurchaseMerch(item); }} style={{ ...glassButtonStyle, width: '100%', marginTop: '9px', padding: '7px 8px', fontSize: '9px', borderRadius: '8px', opacity: merchCanBePurchased ? 1 : 0.48, cursor: merchCanBePurchased ? 'pointer' : 'not-allowed' }}>{!merchCanBePurchased ? 'SOLD OUT' : userSession ? 'BUY' : 'JOIN'}</button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </section>
      )}

      {/* MERCH MARKET PAGE */}
      {!loading && isMerchMarketPage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>WISPACE MERCH MARKET</p>
              <h2 style={pageTitleStyle}>DISTRO BAND MERCHANDISE</h2>
            </div>
            {isBandAccount && (
              <button onClick={() => openBandWorkspace('merch')} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>UPLOAD MERCH</button>
            )}
          </div>

          {publicMerchList.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' }}>
              {[1, 2, 3, 4].map((slot) => (
                <div key={slot} style={{ ...glassStyle(`merch-placeholder-${slot}`), padding: '14px', backgroundColor: '#080202', borderStyle: 'dashed' }}>
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.12)', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                    <ShoppingBag size={32} color="#12323a" />
                  </div>
                  <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>MERCH SLOT {String(slot).padStart(2, '0')}</p>
                  <h4 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>BELUM ADA ITEM</h4>
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Kosong.</p>
                </div>
              ))}
              <div style={{ ...glassStyle('merch-market-empty-action'), padding: '22px', backgroundColor: '#080202', display: 'grid', alignContent: 'center' }}>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: '0 0 10px 0' }}>MERCH MARKET MASIH KOSONG</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Belum ada merch live.</p>
                {isBandAccount ? (
                  <button onClick={() => openBandWorkspace('merch')} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TAMBAH MERCH PERTAMA</button>
                ) : (
                  <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE BAND DULU</button>
                )}
              </div>
            </div>
          ) : (
            <div style={flatListStyle}>
              {publicMerchList.map((item) => (
                <article
                  key={item.id}
                  onClick={() => openMerchDetail(item)}
                  style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '66px minmax(0, 1fr)' : '76px minmax(0, 1fr) auto', position: 'relative' }}
                >
                  <div style={{ ...flatThumbStyle, width: isTinyLayout ? '66px' : '76px', height: isTinyLayout ? '66px' : '76px', borderRadius: '9px' }}>
                    {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>MERCH</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{(item.bandName || 'BAND WISPACE').toUpperCase()} / STOCK {item.stock || 0}</p>
                    <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '13px' : '15px', fontWeight: '900', margin: '0 0 5px 0', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name.toUpperCase()}</h4>
                    <p style={{ color: item.fulfillmentMode === 'admin_consignment' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{item.fulfillmentMode === 'admin_consignment' ? 'STOK DI ADMIN' : 'BAND SHIP'}</p>
                    <p style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                  </div>
                  {!isTinyLayout && <span style={{ color: '#F8F7F8', fontSize: '9px', fontWeight: '900' }}>DETAIL</span>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ARTICLES PAGE */}
      {!loading && isArticlesPage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>WISPACE ARTICLES</p>
              <h2 style={pageTitleStyle}>ARTIKEL BAND & SKENA</h2>
            </div>
            {isBandAccount && (
              <button onClick={() => openBandWorkspace('artikel')} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TULIS ARTIKEL</button>
            )}
          </div>

          {publicArticleList.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
              {[1, 2, 3, 4].map((slot) => (
                <article key={slot} style={{ ...glassStyle(`article-placeholder-${slot}`), padding: '18px', backgroundColor: '#080202', borderStyle: 'dashed', minHeight: '220px', display: 'grid', alignContent: 'space-between' }}>
                  <div>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '0 0 14px 0' }}>ARTICLE SLOT {String(slot).padStart(2, '0')}</p>
                    <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', lineHeight: 1.05, margin: '0 0 12px 0' }}>BELUM ADA ARTIKEL</h3>
                    <p style={{ color: '#F8F7F8', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Kosong.</p>
                  </div>
                  <FileText size={26} color="#12323a" />
                </article>
              ))}
              <div style={{ ...glassStyle('articles-empty-action'), padding: '22px', backgroundColor: '#080202', display: 'grid', alignContent: 'center' }}>
                <h3 style={{ color: '#F8F7F8', fontSize: '19px', fontWeight: '900', margin: '0 0 10px 0' }}>ARSIP ARTIKEL MASIH KOSONG</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Belum ada artikel live.</p>
                {isBandAccount ? (
                  <button onClick={() => openBandWorkspace('artikel')} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TULIS ARTIKEL PERTAMA</button>
                ) : (
                  <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>JOIN UNTUK IKUT SKENA</button>
                )}
              </div>
            </div>
          ) : selectedArticle ? (
            <div style={{ display: 'grid', gridTemplateColumns: articleGridColumns, gap: '22px', alignItems: 'start' }}>
              <main>
                <article style={{ padding: isTinyLayout ? '10px 0 18px' : '14px 0 22px' }}>
                  <button onClick={() => setSelectedArticleId(null)} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.12)', color: 'rgba(255,255,255,0.72)', borderRadius: '9999px', padding: '7px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, marginBottom: '18px' }}>KEMBALI KE ETALASE</button>
                  <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 12px 0' }}>{selectedArticle.category.toUpperCase()} / {selectedArticle.createdAt}</p>
                  <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '24px' : 'clamp(30px, 4.1vw, 48px)', fontWeight: '900', lineHeight: 0.96, margin: '0 0 14px 0' }}>{selectedArticle.title.toUpperCase()}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: isTinyLayout ? '14px' : '15px', lineHeight: 1.55, margin: '0 0 18px 0', maxWidth: '840px' }}>{selectedArticle.excerpt}</p>
                  {selectedArticle.body && <p style={{ color: '#d0d0d0', fontSize: '14px', lineHeight: 1.75, margin: '0 0 20px 0', whiteSpace: 'pre-line' }}>{selectedArticle.body}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid rgba(115,187,201,0.18)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: 0 }}>PENULIS: {(selectedArticle.bandName || 'BAND WISPACE').toUpperCase()}</p>
                    <button onClick={() => createContentReport({ type: 'article', targetId: selectedArticle.id, title: selectedArticle.title })} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.12)', color: 'rgba(255,255,255,0.72)', borderRadius: '9px', padding: '6px 8px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN ARTIKEL</button>
                  </div>

                  <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid rgba(115,187,201,0.18)' }}>
                    <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '0 0 12px 0' }}>KOMENTAR ({selectedArticleComments.length})</p>
                    {selectedArticleComments.length > 0 && (
                      <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                        {selectedArticleComments.slice(0, 5).map((comment) => (
                          <div key={comment.id} style={{ padding: '9px 0', borderTop: '1px solid rgba(241,212,229,0.08)' }}>
                            <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{comment.author.toUpperCase()} / {comment.createdAt}</p>
                            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{comment.body}</p>
                            <button onClick={() => createContentReport({ type: 'comment', targetId: comment.id, title: `${selectedArticle.title} / ${comment.author}` })} style={{ marginTop: '8px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN KOMENTAR</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <form onSubmit={(event) => handleArticleCommentSubmit(event, selectedArticle)} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '1fr auto', gap: '8px' }}>
                      <input type="text" placeholder={userSession ? 'TULIS KOMENTAR...' : 'LOGIN UNTUK KOMENTAR'} value={articleCommentDrafts[selectedArticle.id] || ''} onChange={(event) => setArticleCommentDrafts({ ...articleCommentDrafts, [selectedArticle.id]: event.target.value })} style={{ ...formInputStyle, margin: 0 }} />
                      <button type="submit" style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px' }}>KIRIM</button>
                    </form>
                  </div>
                </article>
              </main>
              <aside style={{ ...railPanelStyle, position: isCompactLayout ? 'relative' : 'sticky', top: isCompactLayout ? 'auto' : '98px' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '13px', fontWeight: '900', margin: '0 0 12px 0' }}>ARTIKEL LAINNYA</h3>
                <div style={flatListStyle}>
                  {publicArticleList.slice(0, 10).map((article) => {
                    const isActiveArticle = String(article.id) === String(selectedArticle.id);
                    return (
                      <button key={`side-${article.id}`} onClick={() => setSelectedArticleId(article.id)} style={{ ...flatItemStyle, display: 'block', borderTopColor: isActiveArticle ? 'rgba(115,187,201,0.4)' : 'rgba(241,212,229,0.08)' }}>
                        <p style={{ color: isActiveArticle ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', lineHeight: 1.2, margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', margin: 0 }}>{article.category} / {article.createdAt}</p>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          ) : (
            <div style={articleCardGridStyle}>
              {publicArticleList.map((article) => (
                <article key={article.id} onClick={() => openArticleReader(article)} style={articleCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', paddingBottom: '7px', borderBottom: `1px solid ${flatLineColor}` }}>
                    <p style={{ color: '#73BBC9', fontSize: isTinyLayout ? '8px' : '8.5px', fontWeight: '900', letterSpacing: '0.9px', margin: 0 }}>{String(article.category || 'NEWSSPACE').toUpperCase()}</p>
                    <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: isTinyLayout ? '7.5px' : '8px', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{String(article.createdAt || '').toUpperCase()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <FileText size={isTinyLayout ? 11 : 12} color="rgba(255,255,255,0.58)" />
                    <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: isTinyLayout ? '8px' : '8.5px', fontWeight: '900', lineHeight: 1.2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(article.bandName || 'WiSpace Editorial').toUpperCase()}</p>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '12px' : '14px', fontWeight: '900', lineHeight: 1.1, margin: '0 0 6px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(article.title || '').toUpperCase()}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: isTinyLayout ? '9.5px' : '10.5px', lineHeight: 1.45, margin: 0, display: '-webkit-box', WebkitLineClamp: isTinyLayout ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.excerpt}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid rgba(241,212,229,0.06)` }}>
                    <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: isTinyLayout ? '8px' : '9px', fontWeight: '900', margin: 0 }}>{String(article.category || 'Newsspace').toUpperCase()}</p>
                    <span style={{ color: '#73BBC9', fontSize: isTinyLayout ? '8px' : '9px', fontWeight: '900', letterSpacing: '0.8px' }}>BACA</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* PUBLIC BAND PROFILE PAGE */}
      {!loading && isBandPublicPage && (
        <section style={{ minHeight: 'calc(100vh - 40px)', background: 'transparent', border: 'none', borderRadius: 0, overflow: 'visible', boxShadow: 'none' }}>
          <div style={{ position: 'relative', minHeight: isTinyLayout ? '430px' : '470px', display: 'flex', alignItems: 'flex-end', padding: isTinyLayout ? '98px 20px 28px' : '92px 38px 38px', boxSizing: 'border-box' }}>
            {displayBandProfile.coverPreview ? (
              <img src={displayBandProfile.coverPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 24%, rgba(115,187,201,0.24), transparent 34%), radial-gradient(circle at 78% 12%, rgba(241,212,229,0.12), transparent 28%), linear-gradient(135deg, #080202 0%, rgba(115,187,201,0.12) 48%, #080202 100%)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 78%, rgba(115,187,201,0.18), transparent 34%), linear-gradient(to top, rgba(8,2,2,1), rgba(8,2,2,0.62), rgba(8,2,2,0.16))' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: publicBandHeroColumns, gap: '24px', alignItems: 'end', width: '100%' }}>
              <div style={{ width: `${publicBandAvatarSize}px`, height: `${publicBandAvatarSize}px`, borderRadius: '9px', overflow: 'hidden', background: softSurfaceBackground, border: '1.5px solid rgba(115,187,201,0.34)', display: 'grid', placeItems: 'center', boxShadow: '0 14px 32px rgba(8,2,2,0.42), inset 0 1px 0 rgba(241,212,229,0.08)' }}>
                {displayBandProfile.photoPreview ? <img src={displayBandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>FOTO BAND</span>}
              </div>
              <div>
                <p style={eyebrowStyle}>PUBLIC BAND PROFILE</p>
                <h2 style={{ ...pageTitleStyle, fontSize: 'clamp(34px, 5.6vw, 56px)', maxWidth: '980px' }}>{(displayBandProfile.name || signatureName || 'NAMA BAND').toUpperCase()}</h2>
                <p style={{ color: '#F8F7F8', fontSize: '14px', fontWeight: '900', margin: '12px 0 10px 0', maxWidth: '760px', lineHeight: 1.25 }}>{displayBandProfile.headline || 'Headline band akan tampil di sini setelah profile diisi.'}</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', fontWeight: '800', margin: '0 0 14px 0' }}>{(displayBandProfile.city || 'KOTA').toUpperCase()} / {(displayBandProfile.genre || 'GENRE').toUpperCase()}{displayBandProfile.formedYear ? ` / SINCE ${displayBandProfile.formedYear}` : ''} / wispace.my.id{getBandProfilePath(displayBandProfile)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 14px 0' }}>
                  <span style={{ padding: '7px 10px', borderRadius: '9999px', background: softRowBackground, border: '1px solid rgba(115,187,201,0.28)', color: '#73BBC9', fontSize: '11px', fontWeight: '900' }}>{bandSubscriberCount.toLocaleString('id-ID')} SUBSCRIBERS</span>
                  {showBandOwnerControls && unreadBandNotifications > 0 && (
                    <span style={{ padding: '7px 10px', borderRadius: '9999px', background: 'linear-gradient(90deg, rgba(241,212,229,0.14), rgba(241,212,229,0.03))', border: '1px solid rgba(241,212,229,0.28)', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900' }}>{unreadBandNotifications} NOTIF BARU</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  {!showBandOwnerControls && (
                    <button onClick={handleBandSubscribeToggle} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px', width: 'fit-content', background: isSubscribedToCurrentBand ? 'rgba(241,212,229,0.1)' : glassButtonStyle.background, border: isSubscribedToCurrentBand ? '1px solid rgba(241,212,229,0.35)' : glassButtonStyle.border, color: isSubscribedToCurrentBand ? 'rgba(255,255,255,0.72)' : '#73BBC9' }}>
                      {isSubscribedToCurrentBand ? 'SUBSCRIBED' : 'SUBSCRIBE BAND'}
                    </button>
                  )}
                  <button onClick={copyBandProfileLink} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px', width: 'fit-content' }}>COPY PROFILE LINK</button>
                </div>
                {!showBandOwnerControls && isSubscribedToCurrentBand && (
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '10px 0 0 0' }}>Notif update band aktif di draft subscription.</p>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: isTinyLayout ? '20px 16px 24px' : '30px', display: 'grid', gridTemplateColumns: splitGridColumns, gap: '24px', alignItems: 'start' }}>
            <main>
              {showBandOwnerControls && (
                <div style={ownerActionsPanelStyle}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>OWNER ACTIONS</p>
                  <div style={ownerActionsGridStyle}>
                    <button onClick={() => openBandWorkspace('profile')} style={ownerActionButtonStyle}>EDIT PROFILE</button>
                    <button onClick={() => openBandWorkspace('album')} style={{ ...ownerActionButtonStyle, color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>UPLOAD ALBUM</button>
                    <button onClick={() => openBandWorkspace('merch')} style={{ ...ownerActionButtonStyle, color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>MERCH</button>
                    <button onClick={() => openBandWorkspace('artikel')} style={{ ...ownerActionButtonStyle, color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>ARTIKEL</button>
                    <button onClick={() => navigateInternalPage('gig_manager')} style={ownerActionButtonStyle}>PAMFLET</button>
                    <button onClick={() => navigateInternalPage('gig_manager')} style={{ ...ownerActionButtonStyle, color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>JADWAL</button>
                    <button onClick={() => navigateInternalPage('finance_dashboard')} style={{ ...ownerActionButtonStyle, background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.25)', color: 'rgba(255,255,255,0.72)' }}>KEUANGAN</button>
                    <button onClick={() => { setShowNotificationPopout(false); setShowBandAdminPopout(true); }} style={{ ...ownerActionButtonStyle, color: '#73BBC9', borderColor: 'rgba(115,187,201,0.3)' }}>ADMIN</button>
                  </div>
                </div>
              )}

              {showBandOwnerControls && (
                <section style={{ ...bandArchivePanelStyle, padding: '14px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 4px 0' }}>BAND NOTIFICATIONS</p>
                      <h3 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: 0 }}>SUBSCRIBER ACTIVITY</h3>
                    </div>
                    {unreadBandNotifications > 0 && (
                      <button onClick={markBandNotificationsRead} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.28)', color: 'rgba(255,255,255,0.72)', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>MARK READ</button>
                    )}
                  </div>
                  {bandNotifications.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada activity.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {bandNotifications.slice(0, 4).map((notification) => (
                          <div key={notification.id} style={{ ...compactRowStyle, borderRadius: '8px', border: `1px solid ${notification.read ? 'rgba(241,212,229,0.1)' : 'rgba(255,255,255,0.34)'}` }}>
                          <p style={{ color: notification.read ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{notification.title} / {notification.createdAt}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>{notification.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section style={{ ...bandArchivePanelStyle, padding: isTinyLayout ? '12px' : '14px', marginBottom: '18px' }}>
                <h3 style={sectionHeadingStyle}>BIO BAND</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '14px', lineHeight: 1.65, margin: 0 }}>{displayBandProfile.bio || 'Bio band belum diisi.'}</p>
              </section>

              <section style={{ ...bandArchivePanelStyle, padding: isTinyLayout ? '12px' : '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ ...sectionHeadingStyle, margin: '0 0 6px 0' }}>PROMO MUSIC PLAYER</h3>
                  </div>
                  {hasFreeFullBandTrack && (
                    <span style={{ padding: '7px 10px', borderRadius: '9999px', backgroundColor: 'rgba(241,212,229,0.1)', border: '1px solid rgba(241,212,229,0.25)', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>1 FREE FULL TRACK</span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {[
                    ['PROMO TRACKS', bandPublicTracks.length, '#F1D4E5'],
                    ['PREVIEW READY', bandPublicPreviewReadyCount, bandPublicPreviewReadyCount ? '#73BBC9' : 'rgba(255,255,255,0.72)'],
                    ['FREE FULL', hasFreeFullBandTrack ? 1 : 0, hasFreeFullBandTrack ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)']
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ padding: '7px 8px', borderTop: `1px solid ${color === '#73BBC9' ? 'rgba(115,187,201,0.24)' : color === '#F1D4E5' ? 'rgba(241,212,229,0.2)' : 'rgba(241,212,229,0.14)'}`, background: softRowBackground, borderRadius: '7px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.6px', margin: '0 0 4px 0' }}>{label}</p>
                      <strong style={{ color, fontSize: '14px', fontWeight: '900' }}>{value}</strong>
                    </div>
                  ))}
                </div>
                {bandPublicTracks.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada lagu promo. Upload album dulu, lalu pilih track preview/free full di Band Studio.</p>
                ) : (
                  <div style={flatListStyle}>
                    {bandPublicTracks.map((track, index) => {
                      const isActive = activeTrack?.id === track.id && isPlaying;
                      return (
                        <div key={track.id} style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '44px minmax(0, 1fr)' : '52px minmax(0, 1fr) auto', borderTopColor: track.freeFull ? 'rgba(241,212,229,0.26)' : 'rgba(241,212,229,0.08)', cursor: 'default' }}>
                          <div style={{ ...flatThumbStyle, width: isTinyLayout ? '44px' : '52px', height: isTinyLayout ? '44px' : '52px', borderRadius: '7px', color: '#73BBC9', fontSize: '11px', fontWeight: '900' }}>
                            {track.albumCover ? <img src={track.albumCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(index + 1).padStart(2, '0')}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: track.freeFull ? 'rgba(255,255,255,0.72)' : track.previewUrl || track.url ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{track.freeFull ? 'FREE FULL LISTEN' : track.previewUrl || track.url ? '30 SEC PREVIEW' : 'PREVIEW PENDING'} / {track.albumTitle?.toUpperCase()}</p>
                            <h4 style={{ color: '#F8F7F8', fontSize: '14px', fontWeight: '900', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title.toUpperCase()}</h4>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', margin: 0 }}>{track.freeFull ? 'FULL TRACK' : '30 SEC PREVIEW'}</p>
                              <button onClick={() => createContentReport({ type: 'track', targetId: track.id, title: `${track.title} / ${displayBandProfile.name || track.bandName || 'Band WiSpace'}` })} style={{ background: 'transparent', border: 'none', color: '#F8F7F8', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN</button>
                            </div>
                          </div>
                          <button onClick={() => handlePlayTrack(track, bandPublicTracks)} style={{ ...glassButtonStyle, padding: isTinyLayout ? '9px' : '10px 14px', fontSize: '11px', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}>{isActive ? 'PAUSE' : 'PLAY'}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section style={{ ...bandArchivePanelStyle, padding: isTinyLayout ? '12px' : '14px', marginBottom: '18px' }}>
                <h3 style={sectionHeadingStyle}>ALBUM DIGITAL</h3>
                {displayBandAlbums.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada album digital.</p>
                ) : (
                  <div style={flatListStyle}>
                    {displayBandAlbums.map((album) => (
                      <article key={album.id} style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '62px minmax(0, 1fr)' : '72px minmax(0, 1fr) auto', cursor: 'default' }}>
                        <div style={{ ...flatThumbStyle, width: isTinyLayout ? '62px' : '72px', height: isTinyLayout ? '62px' : '72px', borderRadius: '7px' }}>
                          {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900' }}>COVER</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{album.trackCount} TRACK / FULL ALBUM</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '14px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title.toUpperCase()}</h4>
                          <p style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900', margin: 0 }}>Full Album Rp {Number(album.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                        <button onClick={() => handlePurchaseAlbum(album)} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '10px', gridColumn: isTinyLayout ? '1 / -1' : 'auto', width: isTinyLayout ? 'fit-content' : 'auto' }}>{!userSession ? 'JOIN' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI'}</button>
                        {(album.tracks || []).length > 0 && (
                          <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '8px', borderTop: '1px solid rgba(241,212,229,0.08)', paddingTop: '10px' }}>
                            {(album.tracks || []).slice(0, 10).map((track, index) => (
                              <div key={track.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '11px', fontWeight: '900', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(index + 1).padStart(2, '0')} / {track.title.toUpperCase()}</p>
                                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', margin: '3px 0 0 0' }}>{track.freeFull ? 'FREE FULL LISTEN' : `Rp ${Number(track.price || 0).toLocaleString('id-ID')}`}</p>
                                  <button onClick={() => createContentReport({ type: 'track', targetId: track.id, title: `${track.title} / ${album.title}` })} style={{ marginTop: '5px', background: 'transparent', border: 'none', color: '#F8F7F8', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN</button>
                                </div>
                                <button onClick={() => handlePurchaseTrack(album, track)} disabled={track.freeFull} style={{ background: track.freeFull ? 'rgba(241,212,229,0.08)' : 'rgba(241,212,229,0.04)', border: `1px solid ${track.freeFull ? 'rgba(241,212,229,0.24)' : 'rgba(241,212,229,0.12)'}`, color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#F1D4E5', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK }}>{track.freeFull ? 'FREE' : 'BUY'}</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section id="band-gig-schedule" style={{ ...bandArchivePanelStyle, padding: isTinyLayout ? '12px' : '14px' }}>
                <h3 style={sectionHeadingStyle}>JADWAL MANGGUNG</h3>
                {bandScheduleItems.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada jadwal manggung. Tambahkan jadwal dari Band Gig Manager, jadwal ini hanya tampil di profile band.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {bandScheduleItems.slice(0, 5).map((schedule) => (
                      <div key={schedule.id} style={{ ...compactRowStyle, display: 'grid', gridTemplateColumns: '64px 1fr', gap: '12px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: softRowBackground, border: '1px solid rgba(115,187,201,0.25)', display: 'grid', placeItems: 'center', color: '#73BBC9', fontSize: '10px', fontWeight: '900', textAlign: 'center', lineHeight: 1.1 }}>LIVE<br/>DATE</div>
                        <div>
                          <h4 style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: '0 0 6px 0' }}>{schedule.title.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{schedule.venue} / {schedule.date} / {schedule.htm}</p>
                          <p style={{ color: '#F8F7F8', fontSize: '11px', lineHeight: 1.4, margin: '5px 0 0 0' }}>CP: {schedule.cp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </main>

            <aside style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...bandArchivePanelStyle, padding: '14px' }}>
                <h3 style={sectionHeadingStyle}>CONTACT</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 8px 0' }}>CP: <span style={{ color: '#F8F7F8' }}>{displayBandProfile.cp || '-'}</span></p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 8px 0' }}>Email: <span style={{ color: '#F8F7F8' }}>{displayBandProfile.email || '-'}</span></p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: 0 }}>Instagram: <span style={{ color: '#F8F7F8' }}>{displayBandProfile.instagram || '-'}</span></p>
                {showBandContactForm ? (
                  <form onSubmit={handleMessageSubmit} style={{ display: 'grid', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${flatLineColor}` }}>
                    <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0 }}>KIRIM PESAN KE {(displayBandProfile.name || signatureName || 'BAND INI').toUpperCase()}</p>
                    <input type="text" placeholder="NAMA PENGIRIM" value={messageDraft.sender} onChange={(e) => setMessageDraft({ ...messageDraft, sender: e.target.value })} required style={formInputStyle} />
                    <input type="text" placeholder="KONTAK BALASAN" value={messageDraft.contact} onChange={(e) => setMessageDraft({ ...messageDraft, contact: e.target.value })} required style={formInputStyle} />
                    <input type="text" placeholder="SUBJEK" value={messageDraft.subject} onChange={(e) => setMessageDraft({ ...messageDraft, subject: e.target.value })} required style={formInputStyle} />
                    <textarea placeholder="ISI PESAN / AJAKAN KOLABORASI / UNDANGAN GIGS" value={messageDraft.body} onChange={(e) => setMessageDraft({ ...messageDraft, body: e.target.value })} required rows={5} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                    <button type="submit" style={{ ...glassButtonStyle, width: '100%', padding: '12px', fontSize: '12px' }}>KIRIM MESSAGE</button>
                  </form>
                ) : (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${flatLineColor}` }}>
                    <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Ini profile band lu sendiri, jadi form kirim pesan disembunyikan.</p>
                  </div>
                )}
              </section>

              <section style={{ ...bandArchivePanelStyle, padding: '14px' }}>
                <h3 style={sectionHeadingStyle}>MERCHANDISE</h3>
                {displayBandMerchItems.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Belum ada merchandise.</p>
                ) : (
                  <div style={flatListStyle}>
                    {displayBandMerchItems.slice(0, 4).map((item) => {
                      const merchCanBePurchased = isMerchPurchasable(item);
                      return (
                        <div key={item.id} onClick={() => openMerchDetail(item)} style={{ ...flatItemStyle, cursor: 'pointer', gridTemplateColumns: isTinyLayout ? '50px minmax(0, 1fr)' : '50px minmax(0, 1fr) auto' }}>
                          <div style={{ ...flatThumbStyle, width: '50px', height: '50px', borderRadius: '7px' }}>
                            {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name.toUpperCase()}</p>
                            <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')} / STOCK {getMerchAvailableStock(item)}</p>
                          </div>
                          {!showBandOwnerControls && (
                            <button disabled={!merchCanBePurchased} onClick={(event) => { event.stopPropagation(); if (merchCanBePurchased) handlePurchaseMerch(item); }} style={{ ...glassButtonStyle, padding: isTinyLayout ? '7px 9px' : '8px 10px', fontSize: '10px', gridColumn: isTinyLayout ? '1 / -1' : 'auto', width: isTinyLayout ? 'fit-content' : 'auto', opacity: merchCanBePurchased ? 1 : 0.48, cursor: merchCanBePurchased ? 'pointer' : 'not-allowed' }}>{!merchCanBePurchased ? 'SOLD OUT' : userSession ? 'BUY' : 'JOIN'}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </section>
      )}

      {/* GIG MANAGER PAGE */}
      {!loading && isGigManagerPage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>BAND GIG MANAGER</p>
              <h2 style={pageTitleStyle}>PAMFLET GIGS & JADWAL MANGGUNG</h2>
              <p style={pageLeadStyle}>Pamflet dan jadwal manggung.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '24px', alignItems: 'start' }}>
            <form onSubmit={handleBandSubmit} style={{ ...glassStyle('gig-upload-form'), padding: '20px', backgroundColor: '#080202' }}>
              <h3 style={sectionHeadingStyle}>UPLOAD PAMFLET EVENT</h3>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 18px 0', lineHeight: 1.4 }}>Isi data gigs, lalu kirim ke admin WiSpace untuk dicek sebelum tampil publik.</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="NAMA ACARA / CONCERT" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="KOTA / VENUE" value={newCity} onChange={(e) => setNewCity(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="GENRE / SUB-SKENA" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} style={formInputStyle} />
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="HTM (Contoh: FREE / Rp 50.000)" value={newHtm} onChange={(e) => setNewHtm(formatOptionalRupiahText(e.target.value))} required style={formInputStyle} />
                <input type="text" placeholder="CONTACT PERSON (WA/IG: @bandmu)" value={newCp} onChange={(e) => setNewCp(e.target.value)} required style={formInputStyle} />
              </div>
              <label style={{ display: 'block', marginTop: '14px', cursor: 'pointer' }}>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleGigPosterImport} style={{ display: 'none' }} />
                <div style={{ minHeight: '220px', border: '1px dashed rgba(115,187,201,0.45)', borderRadius: '14px', backgroundColor: '#080202', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                  {newPosterImage ? (
                    <img src={newPosterImage} alt="Preview pamflet event" style={{ width: '100%', height: '100%', maxHeight: '320px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                      <p style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>UPLOAD GAMBAR PAMFLET</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Klik area ini untuk pilih JPG, PNG, atau WEBP.</p>
                    </div>
                  )}
                </div>
              </label>
              {newPosterName && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '8px 0 0 0' }}>FILE: {newPosterName}</p>}
              {newPosterNotice && <p style={{ color: newPosterNotice.includes('Ideal') ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: '6px 0 0 0' }}>{newPosterNotice}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'free' ? '1px solid rgba(241,212,229,0.62)' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'free' ? 'rgba(241,212,229,0.12)' : '#080202', color: newGigRequestType === 'free' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE BULLETIN</button>
                <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'exclusive' ? '1px solid #73BBC9' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(115,187,201,0.14)' : '#080202', color: newGigRequestType === 'exclusive' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXCLUSIVE SLIDE</button>
              </div>
              <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#080202', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(115,187,201,0.32)' : 'rgba(241,212,229,0.24)'}`, borderRadius: '14px' }}>
                <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE EVENT SLOT' : 'FREE BULLETIN SLOT'}</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{newGigRequestType === 'exclusive' ? `Request berbayar Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} untuk masuk slide besar homepage. Admin cek konten dulu, lalu pembayaran, lalu activate 10 hari.` : 'Request gratis untuk masuk bulletin gigs homepage dan jadwal manggung publik setelah dicek admin.'}</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>MASA TAYANG: 10 HARI SEJAK ADMIN APPROVE. Setelah lewat tanggal tayang, pamflet perlu diajukan ulang.</p>
                <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>UKURAN DISARANKAN: {posterUploadGuide.size} / {posterUploadGuide.ratio} / MAX 2MB</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: '5px 0 0 0' }}>{posterUploadGuide.note}</p>
              </div>
              <button type="submit" style={{ width: '100%', padding: '14px', marginTop: '16px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>KIRIM KE ANTREAN KURASI</button>
            </form>

            <div style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...glassStyle('band-schedule-form'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 8px 0' }}>TAMBAH JADWAL MANGGUNG</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: '0 0 16px 0' }}>Untuk agenda tampil di profile band saja. Tidak masuk homepage, tidak perlu free/exclusive, dan tidak masuk antrean admin.</p>
                <form onSubmit={handleScheduleSubmit} style={{ display: 'grid', gap: '12px' }}>
                  <input type="text" placeholder="NAMA ACARA / SHOWCASE" value={scheduleDraft.title} onChange={(event) => setScheduleDraft({ ...scheduleDraft, title: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="VENUE / KOTA" value={scheduleDraft.venue} onChange={(event) => setScheduleDraft({ ...scheduleDraft, venue: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="TANGGAL MANGGUNG" value={scheduleDraft.date} onChange={(event) => setScheduleDraft({ ...scheduleDraft, date: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="HTM / INFO TIKET" value={scheduleDraft.htm} onChange={(event) => setScheduleDraft({ ...scheduleDraft, htm: formatOptionalRupiahText(event.target.value) })} required style={formInputStyle} />
                  <input type="text" placeholder="CONTACT PERSON / LINK INFO" value={scheduleDraft.cp} onChange={(event) => setScheduleDraft({ ...scheduleDraft, cp: event.target.value })} required style={formInputStyle} />
                  <button type="submit" style={{ ...glassButtonStyle, width: '100%', padding: '12px', fontSize: '12px' }}>SIMPAN JADWAL PROFILE</button>
                </form>
              </section>

              <section style={{ ...glassStyle('gig-status'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>STATUS PAMFLET</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>PENDING</p>
                    <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '22px' }}>{pendingGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>FREE</p>
                    <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '22px' }}>{approvedFreeGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>BAYAR</p>
                    <strong style={{ color: 'rgba(255,255,255,0.72)', fontSize: '22px' }}>{exclusiveWaitingPaymentGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>EXCLUSIVE</p>
                    <strong style={{ color: '#73BBC9', fontSize: '22px' }}>{approvedExclusiveGigs.length}</strong>
                  </div>
                </div>

                {gigs.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada pamflet yang pernah dikirim.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {gigs.slice(0, 6).map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', margin: 0 }}>{gig.city} / {getGigDate(gig)}</p>
                          {gig.status === 'approved_waiting_payment' && (
                            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>KONTEN DISETUJUI - BAYAR RP {EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} UNTUK LANJUT</p>
                          )}
                          {gig.status === 'paid_waiting_activation' && (
                            <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>PAYMENT RECEIVED - MENUNGGU ADMIN ACTIVATE</p>
                          )}
                          {isApprovedHomepageGig(gig) && (
                            <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>TAYANG SAMPAI: {getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</p>
                          )}
                        </div>
                        {gig.status === 'approved_waiting_payment' ? (
                          <button onClick={() => handleGigExclusivePayment(gig)} style={{ padding: '9px 10px', backgroundColor: 'rgba(255,255,255,0.72)', color: '#080202', border: 'none', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BAYAR</button>
                        ) : (
                          <span style={{ color: getGigStatusColor(gig.status), fontSize: '10px', fontWeight: '900', textAlign: 'right' }}>{getGigStatusLabel(gig.status)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ ...glassStyle('gig-public-schedule'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>PAMFLET APPROVED HOMEPAGE</h3>
                {filteredPublicGigs.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '13px', margin: 0 }}>Belum ada pamflet free/exclusive yang approved untuk homepage.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredPublicGigs.slice(0, 5).map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '12px', padding: '10px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '12px' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <h4 style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{gig.city} / {getGigDate(gig)} / {getGigHtm(gig)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      )}

      {/* AUDIENCE PROFILE PAGE */}
      {!loading && isAudienceProfilePage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>AUDIENCE PROFILE</p>
              <h2 style={pageTitleStyle}>MY WISPACE ACCOUNT</h2>
              <p style={pageLeadStyle}>Profile audience.</p>
            </div>
            <button onClick={() => openAudienceWorkspace('audience_library')} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>BUKA LIBRARY</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: splitGridColumns, gap: '24px', alignItems: 'start' }}>
            <aside style={{ ...glassStyle('audience-account-card'), padding: '22px', backgroundColor: '#080202' }}>
              <div style={{ width: '92px', height: '92px', borderRadius: '14px', backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.34)', display: 'grid', placeItems: 'center', boxShadow: 'none', marginBottom: '18px', overflow: 'hidden' }}>
                {audienceProfile.photoPreview ? (
                  <img src={audienceProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={38} color="#73BBC9" />
                )}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>ACCOUNT NAME</p>
              <h3 style={{ color: '#F8F7F8', fontSize: '20px', fontWeight: '900', margin: '0 0 16px 0', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{audienceProfile.displayName || userSession?.email || 'AUDIENCE WISPACE'}</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>EMAIL</span><strong style={{ color: '#F8F7F8', textAlign: 'right', overflowWrap: 'anywhere' }}>{userSession?.email || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>ROLE</span><strong style={{ color: '#73BBC9' }}>{(userRole || 'audience').toUpperCase()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>KOTA</span><strong style={{ color: '#F8F7F8', textAlign: 'right' }}>{audienceProfile.city || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>GENRE</span><strong style={{ color: '#F8F7F8', textAlign: 'right' }}>{audienceProfile.favoriteGenre || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>STATUS</span><strong style={{ color: 'rgba(255,255,255,0.72)' }}>VERIFIED</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>PROFILE DETAIL</span><strong style={{ color: '#F8F7F8' }}>LIMITED</strong>
                </div>
              </div>
            </aside>

            <div style={{ display: 'grid', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                <div style={{ ...glassStyle('audience-owned-stat'), padding: '18px', backgroundColor: '#080202' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>OWNED ALBUMS</p>
                  <h3 style={{ color: '#73BBC9', fontSize: '32px', fontWeight: '900', margin: 0 }}>{purchasedAlbums.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-message-stat'), padding: '18px', backgroundColor: '#080202' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>MESSAGES</p>
                  <h3 style={{ color: '#F8F7F8', fontSize: '32px', fontWeight: '900', margin: 0 }}>{visibleMessages.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-order-stat'), padding: '18px', backgroundColor: '#080202' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>MERCH ORDERS</p>
                  <h3 style={{ color: activeAudienceOrders.length ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '32px', fontWeight: '900', margin: 0 }}>{audienceMerchOrders.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-payment-stat'), padding: '18px', backgroundColor: '#080202' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>PAYMENT REQUEST</p>
                  <h3 style={{ color: activeAudiencePaymentRequests.length ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '32px', fontWeight: '900', margin: 0 }}>{audiencePaymentRequests.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-secure-stat'), padding: '18px', backgroundColor: '#080202' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>SECURE ACCESS</p>
                  <h3 style={{ color: '#F8F7F8', fontSize: '22px', fontWeight: '900', margin: 0 }}>ON</h3>
                </div>
              </div>

              <section style={{ ...glassStyle('audience-actions'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>QUICK ACTIONS</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan' })} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>EXPLORE RILISAN</button>
                  <button onClick={() => openAudienceWorkspace('audience_library')} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>MY LIBRARY</button>
                  <button onClick={() => navigateInternalPage('audience_orders')} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>MY ORDERS</button>
                  <button onClick={() => { markMessagesAsRead(); navigateInternalPage('message_center'); }} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>MESSAGES</button>
                </div>
              </section>

              <section style={{ ...glassStyle('audience-payment-requests'), padding: '20px', backgroundColor: '#080202' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: 0 }}>MY PAYMENT REQUESTS</h3>
                  <span style={{ color: activeAudiencePaymentRequests.length ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>{activeAudiencePaymentRequests.length} WAITING</span>
                </div>
                {audiencePaymentRequests.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada request pembayaran. Setelah checkout dan upload bukti bayar, statusnya tampil di sini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {audiencePaymentRequests.slice(0, 6).map((payment) => (
                      <div key={`audience-payment-${payment.id}`} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0,1fr) auto', gap: '8px', alignItems: 'center', padding: '10px', backgroundColor: '#080202', border: `1px solid ${payment.status === 'paid' ? 'rgba(241,212,229,0.22)' : payment.status === 'rejected' ? 'rgba(241,212,229,0.22)' : 'rgba(241,212,229,0.22)'}`, borderRadius: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{payment.checkoutRef} / {(payment.type || 'order').toUpperCase()}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(payment.productTitle || 'Checkout WiSpace').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Rp {Number(payment.amount || 0).toLocaleString('id-ID')} / Proof: {payment.paymentProofPreview || payment.paymentProofUrl ? 'ready' : 'missing'}</p>
                          {payment.rejectionReason && <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0' }}>Reject: {payment.rejectionReason}</p>}
                        </div>
                        <div style={{ display: 'grid', gap: '6px', justifyItems: isTinyLayout ? 'start' : 'end' }}>
                          <strong style={{ color: payment.status === 'paid' ? 'rgba(255,255,255,0.72)' : payment.status === 'rejected' ? '#F1D4E5' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', whiteSpace: 'nowrap' }}>{String(payment.status || 'waiting_admin_confirmation').replaceAll('_', ' ').toUpperCase()}</strong>
                          {['waiting_admin_confirmation', 'rejected'].includes(payment.status) && (
                            <label style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', cursor: 'pointer' }}>
                              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handlePaymentRequestProofImport(payment, event)} style={{ display: 'none' }} />
                              REUPLOAD PROOF
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <form onSubmit={handleAudienceProfileSave} style={{ ...glassStyle('audience-private-form'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>PRIVATE ACCOUNT INFO</h3>
                <label style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: '14px', alignItems: 'center', padding: '14px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '14px', backgroundColor: '#080202', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="file" accept="image/*" onChange={handleAudiencePhotoImport} style={{ display: 'none' }} />
                  <div style={{ width: '74px', height: '74px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', display: 'grid', placeItems: 'center' }}>
                    {audienceProfile.photoPreview ? (
                      <img src={audienceProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={26} color="#73BBC9" />
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>GANTI FOTO PROFILE</span>
                    <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{audienceProfile.photoName || 'Upload foto akun audience lu.'}</p>
                  </div>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <input type="text" placeholder="NAMA TAMPILAN" value={audienceProfile.displayName} onChange={(event) => setAudienceProfile({ ...audienceProfile, displayName: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="KOTA / DOMISILI" value={audienceProfile.city} onChange={(event) => setAudienceProfile({ ...audienceProfile, city: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="GENRE FAVORIT" value={audienceProfile.favoriteGenre} onChange={(event) => setAudienceProfile({ ...audienceProfile, favoriteGenre: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="KONTAK OPSIONAL" value={audienceProfile.contact} onChange={(event) => setAudienceProfile({ ...audienceProfile, contact: event.target.value })} style={formInputStyle} />
                </div>
                <button type="submit" style={{ width: '100%', padding: '13px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SIMPAN PROFILE AUDIENCE</button>
              </form>

              <section style={{ ...glassStyle('audience-profile-note'), padding: '20px', backgroundColor: '#080202' }}>
                <h3 style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0' }}>PROFILE AUDIENCE DIBIKIN SIMPLE</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Akun audience.</p>
              </section>
            </div>
          </div>
        </section>
      )}

      {/* AUDIENCE LIBRARY PAGE */}
      {!loading && isAudienceLibraryPage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>AUDIENCE LIBRARY</p>
              <h2 style={pageTitleStyle}>MY MUSIC ARCHIVE</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                {[
                  ['OWNED', purchasedAlbums.length],
                  ['ACCESS', 'ENCRYPTED'],
                  ['REDISTRIBUTION', 'DILARANG']
                ].map(([label, value]) => (
                  <span key={label} style={{ padding: '7px 10px', background: softRowBackground, border: `1px solid ${label === 'REDISTRIBUTION' ? 'rgba(241,212,229,0.22)' : 'rgba(115,187,201,0.18)'}`, borderRadius: '9999px', color: label === 'REDISTRIBUTION' ? '#F1D4E5' : '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '0.6px' }}>
                    {label}: <strong style={{ color: label === 'REDISTRIBUTION' ? '#F1D4E5' : '#F1D4E5' }}>{value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {purchasedAlbums.length === 0 ? (
            <div style={{ display: 'grid', justifyContent: 'center' }}>
              <div style={{ ...flatSurfaceStyle, width: 'min(440px, 100%)', padding: isTinyLayout ? '18px 14px' : '20px 18px', textAlign: 'center' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 7px 0' }}>AUDIENCE LIBRARY</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '16px' : '17px', fontWeight: '900', margin: '0 0 8px 0' }}>LIBRARY MASIH KOSONG</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', margin: '0 0 16px 0', lineHeight: 1.45 }}>Belum ada rilisan digital yang masuk ke arsip akun ini.</p>
                <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan' })} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '10px' }}>EXPLORE RILISAN</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: libraryDetailGridColumns, gap: '24px', alignItems: 'start' }}>
              <section style={{ padding: isTinyLayout ? '8px 0' : '10px 0' }}>
                <h3 style={sectionHeadingStyle}>PURCHASED RELEASES</h3>
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(168px, 1fr))', gap: isTinyLayout ? '8px' : '9px' }}>
                  {purchasedAlbums.map((album) => {
                    const isSelectedLibraryItem = selectedLibraryItem?.id === album.id;
                    const firstTrack = album.tracks?.[0] || null;

                    return (
                    <article
                      key={album.id}
                      onClick={() => {
                        setSelectedLibraryItemId(album.id);
                        setSelectedLibraryTrackId(null);
                      }}
                      style={{ ...compactVisualCardStyle, padding: isTinyLayout ? '7px' : '8px', borderColor: isSelectedLibraryItem ? 'rgba(115,187,201,0.48)' : flatLineColor, display: 'grid', gap: '8px' }}
                    >
                      <div style={{ ...flatThumbStyle, width: '100%', aspectRatio: '1/1', borderRadius: '7px' }}>
                        {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>COVER</span>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: isSelectedLibraryItem ? '#73BBC9' : 'rgba(255,255,255,0.6)', fontSize: '8px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>{album.purchaseType === 'track' ? 'TRACK ACCESS' : 'ALBUM ACCESS'}</p>
                        <h4 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '10px' : '11px', fontWeight: '900', margin: '0 0 5px 0', lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8.5px', margin: 0, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{album.bandName.toUpperCase()} / {album.purchaseType === 'track' ? `TRACK SINGLE FROM ${album.parentAlbumTitle?.toUpperCase()}` : `${album.trackCount} TRACK`} / {album.purchasedAt}</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: isSelectedLibraryItem ? '#73BBC9' : 'rgba(255,255,255,0.44)', fontSize: '8px', fontWeight: '900', letterSpacing: '0.8px' }}>{isSelectedLibraryItem ? 'ACTIVE' : 'OPEN'}</span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLibraryItemId(album.id);
                            setSelectedLibraryTrackId(firstTrack?.id || null);
                            if (firstTrack) handlePlayLibraryTrack(firstTrack, album, album.tracks || [firstTrack]);
                          }}
                          style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '8px', borderRadius: '8px' }}
                        >
                          {activeTrack?.id === `library-${album.id}-${firstTrack?.id}` && isPlaying ? 'PAUSE' : 'PLAY'}
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>

              <aside style={{ ...railPanelStyle, paddingTop: isTinyLayout ? '12px' : '14px', paddingBottom: isTinyLayout ? '12px' : '14px' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '14px', fontWeight: '900', margin: '0 0 16px 0' }}>SECURE PLAYER</h3>
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '82px 1fr' : '96px 1fr', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ width: isTinyLayout ? '82px' : '96px', aspectRatio: '1/1', borderRadius: '9px', background: softRowBackground, border: `1px solid ${flatLineColor}`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {selectedLibraryItem?.coverPreview ? <img src={selectedLibraryItem.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900' }}>PLAYER</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start', marginBottom: '7px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: '0 0 5px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLibraryItem?.title?.toUpperCase() || 'NO TRACK SELECTED'}</h4>
                        <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: 0 }}>{selectedLibraryItem?.bandName?.toUpperCase() || 'WISPACE'}</p>
                      </div>
                      <span style={{ flexShrink: 0, padding: '5px 7px', background: softRowBackground, border: '1px solid rgba(241,212,229,0.12)', borderRadius: '9999px', color: '#F8F7F8', fontSize: '8px', fontWeight: '900' }}>{selectedLibraryItem?.purchaseType === 'track' ? 'TRACK' : 'ALBUM'}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      <span style={{ padding: '4px 7px', borderRadius: '9999px', background: softRowBackground, border: '1px solid rgba(115,187,201,0.18)', color: '#73BBC9', fontSize: '8px', fontWeight: '900' }}>{selectedLibraryTrack?.title ? `SELECTED: ${selectedLibraryTrack.title.toUpperCase()}` : 'SELECT A TRACK'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
                  {selectedLibraryTracks.map((track, index) => {
                    const libraryTrackId = `library-${selectedLibraryItem?.id || 'item'}-${track.id}`;
                    const isLibraryTrackActive = activeTrack?.id === libraryTrackId && isPlaying;
                    const isSelectedLibraryTrack = selectedLibraryTrack?.id === track.id;

                    return (
                      <div
                        key={track.id}
                        onClick={() => setSelectedLibraryTrackId(track.id)}
                        style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '1fr auto' : '1fr auto auto', borderTopColor: isSelectedLibraryTrack ? 'rgba(115,187,201,0.38)' : 'rgba(241,212,229,0.08)', padding: isTinyLayout ? '6px 7px' : '7px 8px' }}
                      >
                        <div>
                          <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 4px 0' }}>{String(index + 1).padStart(2, '0')} / {track.title?.toUpperCase() || 'UNTITLED TRACK'}</p>
                          <p style={{ color: track.audioPath ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '10px', margin: 0 }}>{track.audioPath ? 'PRIVATE' : 'LOCAL'}</p>
                        </div>
                        {!isTinyLayout && <button onClick={(event) => { event.stopPropagation(); setSelectedLibraryTrackId(track.id); handleSecureLibraryDownload(track); }} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '9px', padding: '7px 9px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DOWNLOAD</button>}
                        <button onClick={(event) => { event.stopPropagation(); setSelectedLibraryTrackId(track.id); handlePlayLibraryTrack(track); }} style={{ ...glassButtonStyle, padding: '7px 10px', fontSize: '9px' }}>{isLibraryTrackActive ? 'PAUSE' : 'PLAY'}</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => selectedLibraryTrack && handlePlayLibraryTrack(selectedLibraryTrack)} style={{ ...glassButtonStyle, padding: '10px', fontSize: '10px' }}>PLAY SELECTED</button>
                  <button onClick={() => handleSecureLibraryDownload(selectedLibraryTrack)} style={{ background: softRowBackground, border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '10px', padding: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DOWNLOAD SELECTED</button>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(241,212,229,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', margin: 0 }}>DOWNLOAD LOG</p>
                    <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900' }}>{downloadLogs.length} RECORD</span>
                  </div>
                  {selectedLibraryDownloadLogs.length === 0 ? (
                    <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.45, margin: 0 }}>Belum ada download di device ini.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '7px' }}>
                      {selectedLibraryDownloadLogs.slice(0, 3).map((log) => (
                        <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center', padding: '7px 0', borderTop: '1px solid rgba(241,212,229,0.06)' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.trackTitle.toUpperCase()}</p>
                            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.albumTitle} / {log.bandName}</p>
                          </div>
                          <span style={{ color: '#F8F7F8', fontSize: '8px', fontWeight: '900', textAlign: 'right', whiteSpace: 'nowrap' }}>{log.downloadedAt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </section>
      )}

      {/* AUDIENCE ORDERS PAGE */}
      {!loading && isAudienceOrdersPage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>AUDIENCE ORDERS</p>
              <h2 style={pageTitleStyle}>MY MERCH ORDERS</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                {[
                  ['TOTAL', audienceMerchOrders.length],
                  ['AKTIF', activeAudienceOrders.length],
                  ['PAYMENT WAIT', activeAudiencePaymentRequests.length],
                  ['SELESAI', audienceMerchOrders.filter((order) => order.trackingStatus === 'completed').length]
                ].map(([label, value]) => (
                  <span key={label} style={{ padding: '7px 10px', background: softRowBackground, border: '1px solid rgba(115,187,201,0.18)', borderRadius: '9999px', color: label === 'AKTIF' && value ? 'rgba(255,255,255,0.72)' : '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '0.6px' }}>
                    {label}: <strong style={{ color: '#F8F7F8' }}>{value}</strong>
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => navigateInternalPage('explore', { exploreTab: 'merch' })} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE MERCH</button>
          </div>

          {audiencePaymentRequests.length > 0 && (
            <section style={{ padding: isTinyLayout ? '10px 0 14px' : '12px 0 16px', marginBottom: '16px', borderBottom: '1px solid rgba(241,212,229,0.08)' }}>
              <h3 style={{ ...sectionHeadingStyle, marginBottom: '12px' }}>PAYMENT REQUEST STATUS</h3>
              <div style={flatListStyle}>
                {audiencePaymentRequests.slice(0, 6).map((payment) => (
                  <div key={`orders-payment-${payment.id}`} style={{ ...flatItemStyle, gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0, 1fr) auto', borderTopColor: payment.status === 'paid' ? 'rgba(241,212,229,0.2)' : payment.status === 'rejected' ? 'rgba(241,212,229,0.25)' : 'rgba(241,212,229,0.22)', cursor: 'default' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: payment.status === 'paid' ? 'rgba(255,255,255,0.72)' : payment.status === 'rejected' ? '#F1D4E5' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{String(payment.status || '').replaceAll('_', ' ').toUpperCase()}</p>
                      <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.productTitle}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>{payment.checkoutRef} / Rp {Number(payment.amount || 0).toLocaleString('id-ID')}</p>
                      {payment.rejectionReason && <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.35, margin: '6px 0 0 0' }}>Reject: {payment.rejectionReason}</p>}
                    </div>
                    {['waiting_admin_confirmation', 'rejected'].includes(payment.status) && (
                      <label style={{ ...glassButtonStyle, display: 'inline-grid', width: 'fit-content', padding: '6px 8px', fontSize: '9px', borderRadius: '8px', cursor: 'pointer' }}>
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handlePaymentRequestProofImport(payment, event)} style={{ display: 'none' }} />
                        REUPLOAD PROOF
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {audienceMerchOrders.length === 0 ? (
            <div style={{ display: 'grid', justifyContent: 'center' }}>
              <div style={{ ...flatSurfaceStyle, width: 'min(440px, 100%)', padding: isTinyLayout ? '18px 14px' : '20px 18px', textAlign: 'center' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 7px 0' }}>AUDIENCE ORDERS</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '16px' : '17px', fontWeight: '900', margin: '0 0 8px 0' }}>BELUM ADA ORDER MERCH</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', margin: '0 0 16px 0', lineHeight: 1.45 }}>Belum ada pesanan merch yang masuk ke akun ini.</p>
                <button onClick={() => navigateInternalPage('explore', { exploreTab: 'merch' })} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '10px' }}>EXPLORE MERCH</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1fr) 280px', gap: '18px', alignItems: 'start' }}>
              <section style={{ padding: isTinyLayout ? '10px 0' : '12px 0' }}>
                <h3 style={sectionHeadingStyle}>ORDER HISTORY</h3>
                <div style={flatListStyle}>
                  {audienceMerchOrders.map((order) => {
                    const stage = getMerchOrderStageSummary(order);
                    const labelStatus = getMerchShipmentLabelSummary(order);
                    return (
                    <article key={order.id} style={{ ...flatItemStyle, display: 'block', cursor: 'default', borderTopColor: ['completed', 'cancelled'].includes(order.trackingStatus) ? 'rgba(241,212,229,0.08)' : 'rgba(115,187,201,0.22)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{order.orderId || order.transactionId || order.id} / {order.createdAt}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '14px', fontWeight: '900', margin: '0 0 5px 0', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{String(order.itemName || 'Merch WiSpace').toUpperCase()}</h4>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.35, margin: 0 }}>{(order.sellerBandName || 'Band WiSpace').toUpperCase()} / {order.courier}{order.shippingCost ? ` / Ongkir Rp ${Number(order.shippingCost || 0).toLocaleString('id-ID')}` : ''}</p>
                          <p style={{ color: labelStatus.color, fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0', fontWeight: '900' }}>{labelStatus.title.toUpperCase()}</p>
                          <p style={{ color: stage.color, fontSize: '10px', lineHeight: 1.35, margin: '6px 0 0 0', fontWeight: '900' }}>{stage.title.toUpperCase()}</p>
                        </div>
                        <strong style={{ color: getMerchOrderStatusColor(order.trackingStatus), fontSize: '9px', fontWeight: '900', whiteSpace: 'nowrap' }}>{getMerchOrderStatusLabel(order.trackingStatus)}</strong>
                      </div>
                      {renderMerchOrderStepper(order.trackingStatus)}
                      <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '1fr 1fr', gap: '8px', padding: '8px 0', borderTop: '1px solid rgba(241,212,229,0.06)', borderBottom: '1px solid rgba(241,212,229,0.06)', marginBottom: '8px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Penerima:<br /><strong style={{ color: '#F8F7F8' }}>{order.recipientName || '-'}</strong> / {order.recipientPhone || '-'}</p>
                        <p style={{ color: order.trackingNumber ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Resi:<br /><strong>{order.trackingNumber || 'Menunggu label ekspedisi'}</strong></p>
                        <p style={{ color: '#73BBC9', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Ongkir:<br /><strong>{order.shippingPaymentStatus === 'shipping_fee_held_by_wispace' ? 'Ditahan WiSpace' : order.shippingPaymentStatus || '-'}</strong></p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: 0 }}>Shipment:<br /><strong>{getShipmentBookingLabel(order.shipmentBookingStatus)}</strong></p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.45, margin: 0 }}>{order.address}, {order.city} {order.postalCode}</p>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {order.trackingNumber && (
                            <button type="button" onClick={() => navigator.clipboard?.writeText(order.trackingNumber)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>COPY RESI</button>
                          )}
                          <button type="button" onClick={() => setSelectedMerchOrderDetail(order)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>

              <aside style={{ ...railPanelStyle, paddingTop: isTinyLayout ? '10px' : '12px', paddingBottom: isTinyLayout ? '10px' : '12px' }}>
                <h3 style={{ color: '#73BBC9', fontSize: '13px', fontWeight: '900', margin: '0 0 10px 0' }}>ORDER FLOW</h3>
                <div style={flatListStyle}>
                  {[
                    ['Paid, tunggu label', 'rgba(255,255,255,0.72)'],
                    ['Label manual', 'rgba(255,255,255,0.72)'],
                    ['Label siap', '#73BBC9'],
                    ['Paket dikirim', '#73BBC9']
                  ].map(([status, color]) => (
                    <div key={status} style={{ ...flatItemStyle, display: 'block', cursor: 'default' }}>
                      <strong style={{ color, fontSize: '10px', fontWeight: '900' }}>{status.toUpperCase()}</strong>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigateInternalPage('message_center')} style={{ ...glassButtonStyle, width: '100%', marginTop: '12px', padding: '11px', fontSize: '11px' }}>BUKA INBOX</button>
              </aside>
            </div>
          )}
        </section>
      )}

      {/* MESSAGE CENTER PAGE */}
      {!loading && isMessagePage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>WISPACE MESSAGES</p>
              <h2 style={pageTitleStyle}>INBOX</h2>
              <p style={pageLeadStyle}>{isBandAccount ? 'Inbox band dan support admin.' : 'Inbox audience.'}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '14px', alignItems: 'start' }}>
            {isBandAccount && (
              <section style={{ ...glassStyle('band-notifications'), padding: isTinyLayout ? '14px' : '16px', backgroundColor: '#080202' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '9999px', backgroundColor: 'rgba(115,187,201,0.08)', border: '1px solid rgba(115,187,201,0.24)', display: 'grid', placeItems: 'center', color: '#73BBC9' }}>
                      <Bell size={15} />
                    </div>
                    <h3 style={{ ...sectionHeadingStyle, margin: 0, fontSize: '13px' }}>BAND NOTIFICATIONS</h3>
                  </div>
                  <span style={{ color: unreadBandNotifications ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>{unreadBandNotifications} NEW</span>
                </div>
                {bandNotifications.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>Belum ada notif band.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {bandNotifications.slice(0, 6).map((notification) => (
                      <div key={notification.id} style={{ ...compactRowStyle, border: notification.read ? '1px solid #F1D4E5' : '1px solid rgba(241,212,229,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                          <strong style={{ color: notification.read ? '#F1D4E5' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900' }}>{notification.title}</strong>
                          <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', whiteSpace: 'nowrap' }}>{notification.createdAt}</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{notification.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
            {isBandAccount && (
              <section style={{ ...glassStyle('band-admin-support'), padding: isTinyLayout ? '14px' : '16px', backgroundColor: '#080202' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>SUPPORT ADMIN</p>
                    <h3 style={{ ...sectionHeadingStyle, margin: 0, fontSize: '13px' }}>HUBUNGI ADMIN WISPACE</h3>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0, maxWidth: '360px' }}>Buat masalah payout, payment, pamflet, album, merch, atau error upload.</p>
                </div>
                <form onSubmit={handleBandSupportSubmit} style={{ display: 'grid', gap: '9px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '160px 1fr', gap: '8px' }}>
                    <select value={bandSupportDraft.category} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, category: event.target.value })} style={formInputStyle}>
                      {['payment', 'payout', 'pamflet', 'album', 'merch', 'upload error', 'lainnya'].map((category) => (
                        <option key={category} value={category}>{category.toUpperCase()}</option>
                      ))}
                    </select>
                    <input type="text" placeholder="SUBJEK KE ADMIN" value={bandSupportDraft.subject} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, subject: event.target.value })} style={formInputStyle} />
                  </div>
                  <textarea placeholder="TULIS PESAN KE ADMIN..." value={bandSupportDraft.body} onChange={(event) => setBandSupportDraft({ ...bandSupportDraft, body: event.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  <label style={{ display: 'block', padding: '10px', border: '1px dashed rgba(115,187,201,0.3)', borderRadius: '10px', backgroundColor: '#080202', cursor: 'pointer' }}>
                    <input type="file" accept="image/*,.pdf,application/pdf" onChange={handleBandSupportAttachmentImport} style={{ display: 'none' }} />
                    <span style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900' }}>UPLOAD SCREENSHOT / PDF</span>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '5px 0 0 0' }}>{bandSupportDraft.attachmentName ? `${bandSupportDraft.attachmentName} / ${formatFileSize(bandSupportDraft.attachmentSize || 0)}` : 'Opsional'}</p>
                  </label>
                  <button type="submit" style={{ ...glassButtonStyle, width: 'fit-content', padding: '10px 14px', fontSize: '11px' }}>KIRIM KE ADMIN</button>
                </form>
              </section>
            )}
            <section style={{ ...glassStyle('message-inbox'), padding: '20px', backgroundColor: '#080202' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>INBOX</h3>
                <span style={{ color: unreadMessages ? '#F1D4E5' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900' }}>{unreadMessages} NEW</span>
              </div>

              {visibleMessages.length === 0 ? (
                <div style={{ padding: '24px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '14px' }}>
                  <h4 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>INBOX MASIH KOSONG</h4>
                  <p style={{ color: '#F8F7F8', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px 0' }}>{isBandAccount ? 'Belum ada pesan baru.' : 'Belum ada pesan masuk.'}</p>
                  {!isBandAccount && (
                    <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ ...glassButtonStyle, padding: '11px 16px', fontSize: '12px' }}>CARI BAND DI EXPLORE</button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {visibleMessages.map((message) => (
                    <article key={message.id} style={{ padding: '14px', backgroundColor: '#080202', border: message.read ? '1px solid #F1D4E5' : '1px solid rgba(115,187,201,0.38)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                        <p style={{ color: '#F8F7F8', fontSize: '13px', fontWeight: '900', margin: 0 }}>{message.sender.toUpperCase()}</p>
                        <span style={{ color: message.read ? 'rgba(255,255,255,0.72)' : '#73BBC9', fontSize: '10px', fontWeight: '900' }}>{message.read ? message.createdAt : 'NEW'}</span>
                      </div>
                      <h4 style={{ color: '#73BBC9', fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0' }}>{message.subject}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px 0' }}>{message.body}</p>
                      {message.attachmentUrl && (
                        <a href={message.attachmentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', width: 'fit-content', margin: '0 0 10px 0', color: '#73BBC9', fontSize: '10px', fontWeight: '900', textDecoration: 'none' }}>
                          BUKA LAMPIRAN: {(message.attachmentName || 'FILE').toUpperCase()}
                        </a>
                      )}
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 12px 0' }}>Kontak: <span style={{ color: '#F8F7F8' }}>{message.contact}</span></p>
                      {message.replied && (
                        <div style={{ padding: '10px', backgroundColor: 'rgba(115,187,201,0.06)', border: '1px solid rgba(115,187,201,0.18)', borderRadius: '10px', marginBottom: '12px' }}>
                          <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>BALASAN TERAKHIR</p>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{message.lastReply}</p>
                        </div>
                      )}
                      {isBandAccount && activeReplyId === message.id ? (
                        <form onSubmit={(event) => handleReplySubmit(event, message)} style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                          <textarea placeholder={`BALAS KE ${message.sender.toUpperCase()}`} value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows={4} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button type="submit" style={{ ...glassButtonStyle, padding: '10px', fontSize: '11px' }}>KIRIM REPLY</button>
                            <button type="button" onClick={() => { setActiveReplyId(null); setReplyDraft(''); }} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '12px', padding: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BATAL</button>
                          </div>
                        </form>
                      ) : isBandAccount ? (
                        <button onClick={() => { setActiveReplyId(message.id); setReplyDraft(message.lastReply || ''); }} style={{ ...glassButtonStyle, padding: '9px 14px', fontSize: '11px' }}>REPLY</button>
                      ) : (
                        <span style={{ display: 'inline-flex', width: 'fit-content', padding: '8px 12px', border: '1px solid rgba(241,212,229,0.12)', borderRadius: '9999px', color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900' }}>READ ONLY</span>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {/* FINANCE DASHBOARD PAGE */}
      {!loading && isFinancePage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={{ ...eyebrowStyle, color: 'rgba(255,255,255,0.72)' }}>BAND FINANCE DASHBOARD</p>
              <h2 style={pageTitleStyle}>PENGHASILAN & PENCAIRAN</h2>
              <p style={pageLeadStyle}>Saldo, transaksi, order merch, dan payout.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            <div style={{ ...glassStyle('finance-balance'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>SALDO SIAP CAIR</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>Rp {bandBalance.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-gross'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>PENJUALAN MASUK</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>Rp {bandGrossRevenue.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-minimum'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>MINIMUM PENARIKAN</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>Rp {MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-split'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>TRANSAKSI PAID</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>{financeTransactions.length}</h3>
            </div>
            <div style={{ ...glassStyle('finance-digital'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>RILISAN DIGITAL</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>Rp {financeDigitalRevenue.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-merch'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>MERCH NET</p>
              <h3 style={{ ...compactMetricValueStyle, fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>Rp {financeMerchRevenue.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-active-orders'), ...compactMetricCardStyle, backgroundColor: '#080202' }}>
              <p style={compactMetricLabelStyle}>ORDER AKTIF</p>
              <h3 style={{ ...compactMetricValueStyle, color: bandPendingMerchOrders ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: isTinyLayout ? '20px' : '24px', margin: 0 }}>{bandPendingMerchOrders}</h3>
            </div>
          </div>

          <div style={{ ...glassStyle('finance-progress'), padding: isTinyLayout ? '12px' : '14px', backgroundColor: '#080202', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900' }}>
              <span>PROGRESS MENUJU PENCAIRAN</span>
              <span>{Math.min(100, Math.round((bandBalance / MINIMUM_PAYOUT_AMOUNT) * 100))}%</span>
            </div>
            <div style={{ height: '7px', backgroundColor: '#080202', borderRadius: '9999px', overflow: 'hidden', border: '1px solid rgba(241,212,229,0.14)' }}>
              <div style={{ width: `${Math.min(100, (bandBalance / MINIMUM_PAYOUT_AMOUNT) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, rgba(241,212,229,0.62), #73BBC9)' }} />
            </div>
            <p style={{ color: bandBalance >= MINIMUM_PAYOUT_AMOUNT ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '10px', fontWeight: '900', margin: '9px 0 0 0' }}>{bandBalance >= MINIMUM_PAYOUT_AMOUNT ? 'Saldo sudah memenuhi minimum pencairan.' : `Kurang Rp ${(MINIMUM_PAYOUT_AMOUNT - bandBalance).toLocaleString('id-ID')} lagi untuk pencairan.`}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '14px' }}>
            <section style={{ ...glassStyle('finance-rules'), padding: isTinyLayout ? '14px' : '16px', backgroundColor: '#080202' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', fontWeight: '900', margin: '0 0 10px 0' }}>ATURAN PENCAIRAN</h3>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>Tanggal 1 / minimum Rp {MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')}.</p>
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#080202', border: `1px solid ${hasBandPayoutAccount ? 'rgba(241,212,229,0.18)' : 'rgba(241,212,229,0.22)'}`, borderRadius: '10px' }}>
                <p style={{ color: hasBandPayoutAccount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>REKENING PAYOUT</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{hasBandPayoutAccount ? `${bandProfile.bankName} / ${bandProfile.bankAccountName} / ${bandProfile.bankAccountNumber}` : 'BELUM LENGKAP'}</p>
              </div>
            </section>
            <section style={{ ...glassStyle('finance-history'), padding: isTinyLayout ? '14px' : '16px', backgroundColor: '#080202' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', fontWeight: '900', margin: '0 0 10px 0' }}>RIWAYAT TRANSAKSI</h3>
              {financeTransactions.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Belum ada transaksi.</p>
              ) : (
                <div style={{ display: 'grid', gap: '7px' }}>
                  {financeTransactions.slice(0, 10).map((transaction) => (
                    <div key={transaction.id} style={compactRowStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{transaction.productType.toUpperCase()} / {transaction.createdAt}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{transaction.productTitle.toUpperCase()}</h4>
                        </div>
                        <strong style={{ color: '#F8F7F8', fontSize: '12px', flexShrink: 0 }}>Rp {Number(transaction.bandNet || 0).toLocaleString('id-ID')}</strong>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Order: {transaction.orderId || transaction.id} / Buyer: {transaction.buyerName} / Produk Rp {Number(transaction.grossAmount || 0).toLocaleString('id-ID')} / Payment {(transaction.paymentStatus || transaction.status || 'paid').toUpperCase()} / Payout {(transaction.payoutStatus || 'available_next_cycle').replaceAll('_', ' ').toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section style={{ ...glassStyle('finance-merch-orders'), padding: isTinyLayout ? '14px' : '16px', backgroundColor: '#080202' }}>
              <h3 style={{ color: '#73BBC9', fontSize: '13px', fontWeight: '900', margin: '0 0 10px 0' }}>ORDER MERCH MASUK</h3>
              {bandMerchOrders.length === 0 ? (
                <p style={{ color: '#F8F7F8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Belum ada order merch.</p>
              ) : (
                <div style={{ display: 'grid', gap: '7px' }}>
                  {bandMerchOrders.slice(0, 8).map((order) => {
                    const stage = getMerchOrderStageSummary(order);
                    const labelStatus = getMerchShipmentLabelSummary(order);
                    return (
                    <div key={order.id} style={compactRowStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{order.orderId || order.transactionId} / {order.courier}{order.shippingCost ? ` / Ongkir Rp ${Number(order.shippingCost || 0).toLocaleString('id-ID')}` : ''} / {order.createdAt}</p>
                          <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{order.itemName.toUpperCase()}</h4>
                          <p style={{ color: stage.color, fontSize: '9px', lineHeight: 1.35, margin: '5px 0 0 0', fontWeight: '900' }}>{stage.title.toUpperCase()}</p>
                          <p style={{ color: labelStatus.color, fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0', fontWeight: '900' }}>{labelStatus.title.toUpperCase()}</p>
                        </div>
                        <strong style={{ color: getMerchOrderStatusColor(order.trackingStatus), fontSize: '9px', flexShrink: 0 }}>{getMerchOrderStatusLabel(order.trackingStatus)}</strong>
                      </div>
                      {renderMerchOrderStepper(order.trackingStatus)}
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '0 0 4px 0' }}>Penerima: {order.recipientName} / {order.recipientPhone}</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '0 0 8px 0' }}>{order.address}, {order.city} {order.postalCode}</p>
                      {order.originShipping && (
                        <p style={{ color: '#F8F7F8', fontSize: '9px', lineHeight: 1.35, margin: '0 0 8px 0' }}>Dikirim dari: {order.originShipping.city || '-'}, {order.originShipping.province || '-'} {order.originShipping.postalCode || ''}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <p style={{ color: order.trackingNumber ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Resi: <strong>{order.trackingNumber || 'menunggu label'}</strong></p>
                        <p style={{ color: '#73BBC9', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Ongkir: <strong>{order.shippingPaymentStatus === 'shipping_fee_held_by_wispace' ? 'DITAHAN WISPACE' : order.shippingPaymentStatus || '-'}</strong></p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: 0 }}>Shipment: <strong>{getShipmentBookingLabel(order.shipmentBookingStatus)}</strong></p>
                        {order.fulfillmentMode === 'admin_consignment' ? (
                          <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: 0 }}>DIKELOLA WISPACE</p>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setSelectedMerchOrderDetail(order)} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>DETAIL</button>
                            {order.shipmentLabelUrl && <button type="button" onClick={() => window.open(order.shipmentLabelUrl, '_blank', 'noopener,noreferrer')} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px' }}>CETAK LABEL</button>}
                            <button type="button" onClick={() => syncShipmentBookingForOrder(order, { notify: true })} disabled={shipmentBookingOrderId === order.id} style={{ ...glassButtonStyle, padding: '6px 8px', fontSize: '9px', borderRadius: '8px', opacity: shipmentBookingOrderId === order.id ? 0.55 : 1 }}>{shipmentBookingOrderId === order.id ? 'BOOKING...' : 'BOOK SHIP'}</button>
                            <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'processing')} disabled={order.trackingStatus === 'processing'} style={{ background: 'rgba(115,187,201,0.08)', border: '1px solid rgba(115,187,201,0.24)', color: order.trackingStatus === 'processing' ? '#F1D4E5' : '#73BBC9', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: order.trackingStatus === 'processing' ? 'default' : 'pointer', fontFamily: FONT_STACK }}>PROSES</button>
                            <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'packing')} disabled={order.trackingStatus === 'packing'} style={{ background: 'rgba(115,187,201,0.08)', border: '1px solid rgba(115,187,201,0.24)', color: order.trackingStatus === 'packing' ? '#F1D4E5' : '#73BBC9', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: order.trackingStatus === 'packing' ? 'default' : 'pointer', fontFamily: FONT_STACK }}>PACKING</button>
                            <button type="button" onClick={() => handleMerchTrackingNumberUpdate(order)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.24)', color: 'rgba(255,255,255,0.72)', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>RESI</button>
                            <button type="button" onClick={() => handleMerchOrderStatusUpdate(order, 'completed')} disabled={order.trackingStatus === 'completed'} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: order.trackingStatus === 'completed' ? '#F1D4E5' : '#F1D4E5', borderRadius: '8px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: order.trackingStatus === 'completed' ? 'default' : 'pointer', fontFamily: FONT_STACK }}>SELESAI</button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {/* BAND PROFILE STUDIO PAGE */}
      {!loading && isBandProfilePage && (
        <section style={pageShellStyle}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>BAND STUDIO</p>
              <h2 style={pageTitleStyle}>BAND PROFILE STUDIO</h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '24px', alignItems: 'start' }}>
            <aside style={{ ...bandArchivePanelStyle, padding: '16px' }}>
              <div style={{ position: 'relative', minHeight: '210px', borderRadius: '9px', overflow: 'hidden', background: softSurfaceBackground, border: '1px solid rgba(241,212,229,0.08)', marginBottom: '18px' }}>
                {bandProfile.coverPreview ? (
                  <img src={bandProfile.coverPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #080202 0%, #F1D4E5 52%, #080202 100%)' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,2,2,0.92), rgba(8,2,2,0.18))' }} />
                <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '16px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                  <div style={{ width: '86px', height: '86px', borderRadius: '9px', overflow: 'hidden', background: softSurfaceBackground, border: '2px solid rgba(115,187,201,0.7)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {bandProfile.photoPreview ? (
                      <img src={bandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900' }}>FOTO</span>
                    )}
                  </div>
                  <div>
                    <p style={{ color: bandProfile.isPublished ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>{bandProfile.isPublished ? 'PUBLIC DRAFT' : 'DRAFT BELUM DISIMPAN'}</p>
                    <h3 style={{ color: '#F8F7F8', fontSize: '24px', fontWeight: '900', margin: 0, lineHeight: 1 }}>{(bandProfile.name || signatureName || 'NAMA BAND').toUpperCase()}</h3>
                  </div>
                </div>
              </div>
              <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>PUBLIC BAND PAGE PREVIEW</p>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: '700', margin: '0 0 8px 0' }}>wispace.my.id{getBandProfilePath()}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '0 0 12px 0' }}>
                <div style={{ ...bandArchivePanelStyle, padding: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 4px 0' }}>SUBSCRIBERS</p>
                  <strong style={{ color: '#73BBC9', fontSize: '18px' }}>{bandSubscriberCount.toLocaleString('id-ID')}</strong>
                </div>
                <div style={{ ...bandArchivePanelStyle, padding: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 4px 0' }}>NOTIF BARU</p>
                  <strong style={{ color: unreadBandNotifications ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '18px' }}>{unreadBandNotifications}</strong>
                </div>
              </div>
              <p style={{ color: '#F8F7F8', fontSize: '14px', fontWeight: '900', lineHeight: 1.35, margin: '0 0 10px 0' }}>{bandProfile.headline || 'Headline singkat band akan tampil di sini.'}</p>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: '700', margin: '0 0 14px 0' }}>{(bandProfile.city || 'KOTA').toUpperCase()} / {(bandProfile.genre || 'GENRE').toUpperCase()}{bandProfile.formedYear ? ` / SINCE ${bandProfile.formedYear}` : ''}</p>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 18px 0' }}>{bandProfile.bio || 'Bio band belum diisi.'}</p>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: `1px solid ${flatLineColor}`, color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>CP</span><strong style={{ color: '#F8F7F8', textAlign: 'right' }}>{bandProfile.cp || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: `1px solid ${flatLineColor}`, color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>EMAIL</span><strong style={{ color: '#F8F7F8', textAlign: 'right' }}>{bandProfile.email || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: `1px solid ${flatLineColor}`, color: 'rgba(255,255,255,0.72)', fontSize: '12px' }}>
                  <span>INSTAGRAM</span><strong style={{ color: '#F8F7F8', textAlign: 'right' }}>{bandProfile.instagram || '-'}</strong>
                </div>
              </div>
              <button onClick={() => openBandPublicProfile(true)} style={{ ...glassButtonStyle, width: '100%', padding: '10px', fontSize: '11px', marginBottom: '18px' }}>BUKA PUBLIC PREVIEW</button>
              <div style={{ borderTop: `1px solid ${flatLineColor}`, paddingTop: '14px', marginBottom: '14px' }}>
                <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>PROMO PLAYER</h4>
                {bandPublicTracks.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>Belum ada promo track.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {bandPublicTracks.slice(0, 3).map((track) => (
                    <div key={`studio-${track.id}`} style={{ ...compactRowStyle, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', gap: '10px', color: '#F8F7F8', fontSize: '11px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title.toUpperCase()}</span>
                        <strong style={{ color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#73BBC9', flexShrink: 0 }}>{track.freeFull ? 'FULL' : '30S'}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${flatLineColor}`, paddingTop: '14px' }}>
                <h4 style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>MERCHANDISE SHELF</h4>
                {merchItems.length === 0 ? (
                  <p style={{ color: '#F8F7F8', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>Belum ada merch.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {merchItems.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ ...compactRowStyle, borderRadius: '8px', display: 'grid', gridTemplateColumns: '54px 1fr', gap: '10px', alignItems: 'center' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '7px', overflow: 'hidden', backgroundColor: '#F1D4E5', display: 'grid', placeItems: 'center' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{item.name.toUpperCase()}</p>
                          <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <div style={{ ...bandArchivePanelStyle, padding: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: `1px solid ${flatLineColor}`, paddingBottom: '12px', flexWrap: 'wrap' }}>
                {['profile', 'album', 'merch', 'artikel'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setBandProfileTab(tab)}
                    style={{ padding: '10px 16px', backgroundColor: bandProfileTab === tab ? '#73BBC9' : 'transparent', color: bandProfileTab === tab ? '#080202' : 'rgba(255,255,255,0.72)', border: bandProfileTab === tab ? 'none' : '1px solid #F1D4E5', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}
                  >
                    {tab === 'profile' ? 'PROFILE BAND' : tab === 'album' ? 'UPLOAD ALBUM' : tab === 'merch' ? 'MERCHANDISE' : 'ARTIKEL'}
                  </button>
                ))}
              </div>

              {bandProfileTab === 'profile' && (
                <form onSubmit={handleBandProfileSave}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="NAMA BAND" value={bandProfile.name || ''} onChange={(e) => updateBandProfileField('name', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="URL SLUG (contoh: skena-noise)" value={bandProfile.slug || ''} onChange={(e) => updateBandProfileField('slug', createSlug(e.target.value))} style={formInputStyle} />
                    <input type="text" placeholder="HEADLINE SINGKAT" value={bandProfile.headline || ''} onChange={(e) => updateBandProfileField('headline', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="KOTA / DOMISILI" value={bandProfile.city || ''} onChange={(e) => updateBandProfileField('city', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="GENRE / SUB-SKENA" value={bandProfile.genre || ''} onChange={(e) => updateBandProfileField('genre', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="TAHUN AKTIF / TERBENTUK" value={bandProfile.formedYear || ''} onChange={(e) => updateBandProfileField('formedYear', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="CP / WHATSAPP" value={bandProfile.cp || ''} onChange={(e) => updateBandProfileField('cp', e.target.value)} style={formInputStyle} />
                    <input type="email" placeholder="EMAIL BAND" value={bandProfile.email || ''} onChange={(e) => updateBandProfileField('email', e.target.value)} style={formInputStyle} />
                    <input type="text" placeholder="INSTAGRAM / SOSMED" value={bandProfile.instagram || ''} onChange={(e) => updateBandProfileField('instagram', e.target.value)} style={formInputStyle} />
                  </div>
                  <div style={{ backgroundColor: '#080202', border: `1px solid ${hasBandPayoutAccount ? 'rgba(241,212,229,0.22)' : 'rgba(241,212,229,0.26)'}`, borderRadius: '9px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ color: hasBandPayoutAccount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>REKENING PAYOUT</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Wajib sebelum upload album atau merch. Data ini dipakai report tanggal 1 dan proses pencairan.</p>
                      </div>
                      <strong style={{ color: hasBandPayoutAccount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px' }}>{hasBandPayoutAccount ? 'READY' : 'BELUM LENGKAP'}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <input type="text" placeholder="NAMA BANK (BCA / BNI / MANDIRI)" value={bandProfile.bankName || ''} onChange={(e) => updateBandProfileField('bankName', e.target.value)} style={formInputStyle} />
                      <input type="text" placeholder="NAMA PEMEGANG REKENING" value={bandProfile.bankAccountName || ''} onChange={(e) => updateBandProfileField('bankAccountName', e.target.value)} style={formInputStyle} />
                      <input type="text" inputMode="numeric" placeholder="NOMOR REKENING" value={bandProfile.bankAccountNumber || ''} onChange={(e) => updateBandProfileField('bankAccountNumber', e.target.value)} style={formInputStyle} />
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#080202', border: `1px solid ${hasBandShippingOrigin ? 'rgba(241,212,229,0.22)' : 'rgba(241,212,229,0.26)'}`, borderRadius: '9px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ color: hasBandShippingOrigin ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>ALAMAT ASAL PENGIRIMAN</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Wajib sebelum jual merch.</p>
                      </div>
                      <strong style={{ color: hasBandShippingOrigin ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px' }}>{hasBandShippingOrigin ? 'READY' : 'BELUM LENGKAP'}</strong>
                    </div>
                    {!hasBandShippingOrigin && (
                      <p style={{ color: '#F1D4E5', fontSize: '11px', lineHeight: 1.45, margin: '0 0 10px 0', fontWeight: '800' }}>Kurang: {bandShippingOriginMissingFields.join(', ')}.</p>
                    )}
                    <textarea placeholder="ALAMAT LENGKAP ASAL PENGIRIMAN" value={bandProfile.shipFromAddress || ''} onChange={(e) => updateBandProfileField('shipFromAddress', e.target.value)} rows={3} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '10px', lineHeight: 1.5 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <input type="text" placeholder="KECAMATAN PENGIRIM" value={bandProfile.shipFromDistrict || ''} onChange={(e) => updateBandProfileField('shipFromDistrict', e.target.value)} style={formInputStyle} />
                      <input type="text" placeholder="KOTA / KABUPATEN PENGIRIM" value={bandProfile.shipFromCity || ''} onChange={(e) => updateBandProfileField('shipFromCity', e.target.value)} style={formInputStyle} />
                      <input type="text" placeholder="PROVINSI" value={bandProfile.shipFromProvince || ''} onChange={(e) => updateBandProfileField('shipFromProvince', e.target.value)} style={formInputStyle} />
                      <input type="text" inputMode="numeric" placeholder="KODE POS" value={bandProfile.shipFromPostalCode || ''} onChange={(e) => updateBandProfileField('shipFromPostalCode', e.target.value)} style={formInputStyle} />
                    </div>
                  </div>
                  <textarea placeholder="BIO BAND" value={bandProfile.bio || ''} onChange={(e) => updateBandProfileField('bio', e.target.value)} rows={6} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <label style={{ display: 'block', padding: '18px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '9px', backgroundColor: '#080202', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleBandCoverImport} style={{ display: 'none' }} />
                      <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>IMPORT COVER / BANNER</span>
                      <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{bandProfile.coverName || 'Gambar lebar untuk header profile band.'}</p>
                    </label>
                    <label style={{ display: 'block', padding: '18px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '9px', backgroundColor: '#080202', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleBandPhotoImport} style={{ display: 'none' }} />
                      <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>IMPORT FOTO BAND</span>
                      <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{bandProfile.photoName || 'Foto utama/avatar band.'}</p>
                    </label>
                  </div>
                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SIMPAN PROFILE BAND</button>
                </form>
              )}

              {bandProfileTab === 'album' && (
                <form onSubmit={handleAlbumDraftSubmit}>
                  {!hasBandPayoutAccount && (
                    <div style={{ backgroundColor: 'rgba(241,212,229,0.06)', border: '1px solid rgba(241,212,229,0.28)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>LENGKAPI REKENING DULU</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Upload album butuh nama bank, nama pemegang rekening, dan nomor rekening di tab Profile Band supaya agreement dan report payout valid.</p>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="JUDUL ALBUM / EP" value={albumDraft.title} onChange={(e) => setAlbumDraft({ ...albumDraft, title: e.target.value })} required style={formInputStyle} />
                    <input type="text" inputMode="numeric" placeholder="HARGA JUAL" value={formatRupiahInput(albumDraft.price)} onChange={(e) => setAlbumDraft({ ...albumDraft, price: String(normalizePriceValue(e.target.value) || '') })} required style={formInputStyle} />
                  </div>
                  <textarea placeholder="DESKRIPSI ALBUM / CATATAN RILISAN" value={albumDraft.description} onChange={(e) => setAlbumDraft({ ...albumDraft, description: e.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '9px', backgroundColor: '#080202', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleAlbumCoverImport} style={{ display: 'none' }} />
                      <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>IMPORT COVER ALBUM</span>
                      <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{albumDraft.coverName || 'Artwork/cover album.'}</p>
                    </label>
                    <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '9px', backgroundColor: '#080202', cursor: 'pointer' }}>
                      <input type="file" accept="audio/mpeg,.mp3" multiple onChange={handleAlbumAudioImport} style={{ display: 'none' }} />
                      <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>IMPORT MP3</span>
                      <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{albumDraft.audioFiles.length ? `${albumDraft.audioFiles.length} file siap upload + auto preview` : 'Pilih track MP3 album. WiSpace otomatis bikin preview 30 detik.'}</p>
                    </label>
                  </div>

                  {albumDraft.audioFiles.length > 0 && (
                    <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '9px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>TRACK FILES</p>
                      <p style={{ color: hasFreeFullBandTrack ? '#F1D4E5' : '#73BBC9', fontSize: '11px', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                        {hasFreeFullBandTrack ? '1 free full track aktif.' : 'Opsional: pilih 1 lagu free full.'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(126px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                        {[
                          ['MASTER PRIVATE', `${albumDraftMasterStoredCount}/${albumDraft.audioFiles.length}`, albumDraftMasterStoredCount === albumDraft.audioFiles.length ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
                          ['PREVIEW READY', `${albumDraftPreviewReadyCount}/${albumDraftPaidTrackCount}`, albumDraftMissingPreviewCount ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)'],
                          ['MISSING PREVIEW', albumDraftMissingPreviewCount, albumDraftMissingPreviewCount ? '#F1D4E5' : 'rgba(255,255,255,0.72)'],
                          ['FREE FULL', albumDraftFreeFullLabel, albumDraft.freeTrackIndex !== '' || hasFreeFullBandTrack ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)']
                        ].map(([label, value, color]) => (
                          <div key={label} style={{ padding: '10px', backgroundColor: '#080202', border: `1px solid ${color === '#F1D4E5' ? 'rgba(241,212,229,0.25)' : color === 'rgba(255,255,255,0.72)' ? 'rgba(241,212,229,0.18)' : 'rgba(241,212,229,0.1)'}`, borderRadius: '10px', minWidth: 0 }}>
                            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', letterSpacing: '0.7px', margin: '0 0 5px 0' }}>{label}</p>
                            <strong style={{ display: 'block', color, fontSize: '12px', fontWeight: '900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</strong>
                          </div>
                        ))}
                      </div>
                      {albumDraft.audioFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? 'auto minmax(0, 1fr)' : hasFreeFullBandTrack ? 'minmax(0, 1.4fr) minmax(118px, 0.7fr) minmax(92px, 112px) auto' : 'auto minmax(0, 1.4fr) minmax(118px, 0.7fr) minmax(92px, 112px) auto', gap: '10px', padding: '10px 0', borderTop: index ? '1px solid #F1D4E5' : 'none', color: '#F8F7F8', fontSize: '12px', alignItems: 'center' }}>
                          {!hasFreeFullBandTrack && (
                            <input
                              type="radio"
                              name="free-track"
                              checked={String(albumDraft.freeTrackIndex) === String(index)}
                              onChange={() => setAlbumDraft({ ...albumDraft, freeTrackIndex: index })}
                              title="Jadikan lagu ini free full listen"
                            />
                          )}
                          <div style={{ minWidth: 0, gridColumn: isTinyLayout ? '2 / -1' : 'auto' }}>
                            <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(index + 1).padStart(2, '0')} / {file.name}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                              <small style={{ color: file.storageStatus === 'stored' ? 'rgba(255,255,255,0.72)' : file.storageStatus === 'fallback' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontWeight: '900' }}>
                                {file.storageStatus === 'stored' ? 'PRIVATE MASTER' : file.storageStatus === 'fallback' ? 'MASTER FALLBACK' : 'LOCAL MASTER'}
                              </small>
                              <small style={{ color: file.previewStatus === 'auto_failed' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontWeight: '900' }}>{getTrackPreviewStatusLabel(file)}</small>
                            </div>
                          </div>
                          <label onClick={(event) => event.stopPropagation()} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', minHeight: '34px', padding: '0 10px', border: `1px solid ${file.previewUrl ? 'rgba(241,212,229,0.25)' : 'rgba(115,187,201,0.25)'}`, borderRadius: '10px', backgroundColor: file.previewUrl ? 'rgba(241,212,229,0.06)' : 'rgba(115,187,201,0.06)', color: file.previewUrl ? 'rgba(255,255,255,0.72)' : '#73BBC9', fontSize: '10px', fontWeight: '900', cursor: 'pointer', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}>
                              <input type="file" accept="audio/mpeg,.mp3" onChange={(event) => handleTrackPreviewImport(index, event)} style={{ display: 'none' }} />
                              {file.previewUrl ? 'REPLACE PREVIEW' : 'UPLOAD MANUAL 30S'}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Rp/track"
                            value={formatRupiahInput(file.price)}
                            onChange={(event) => updateAlbumTrackPrice(index, String(normalizePriceValue(event.target.value) || ''))}
                            style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '10px', color: '#F8F7F8', padding: '8px', fontSize: '11px', fontFamily: FONT_STACK, boxSizing: 'border-box', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}
                          />
                          <span style={{ color: String(albumDraft.freeTrackIndex) === String(index) && !hasFreeFullBandTrack ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontWeight: '900', textAlign: isTinyLayout ? 'left' : 'right', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}>
                            {String(albumDraft.freeTrackIndex) === String(index) && !hasFreeFullBandTrack ? 'FREE FULL' : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                        </div>
                      ))}
                      {!hasFreeFullBandTrack && albumDraft.freeTrackIndex !== '' && (
                        <button type="button" onClick={() => setAlbumDraft({ ...albumDraft, freeTrackIndex: '' })} style={{ marginTop: '10px', background: 'transparent', border: '1px solid rgba(241,212,229,0.12)', color: 'rgba(255,255,255,0.72)', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BATALKAN FREE FULL</button>
                      )}
                    </div>
                  )}

                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.2)', borderRadius: '9px', padding: '14px', marginBottom: '14px' }}>
                    <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 8px 0' }}>AGREEMENT UPLOAD ALBUM</p>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: '0 0 12px 0' }}>Band menyatakan punya hak atas karya ini. Penjualan dibagi 80% untuk band dan 20% untuk WiSpace dari penjualan bersih. Pencairan minimal Rp {MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')} setiap tanggal 1.</p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F8F7F8', fontSize: '12px', fontWeight: '800', marginBottom: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={albumDraft.accepted} onChange={(e) => setAlbumDraft({ ...albumDraft, accepted: e.target.checked })} />
                      SAYA SETUJU DAN BERTANGGUNG JAWAB ATAS KARYA INI
                    </label>
                    <input type="text" placeholder="NAMA PENANGGUNG JAWAB / TTD DIGITAL" value={albumDraft.signature} onChange={(e) => setAlbumDraft({ ...albumDraft, signature: e.target.value })} style={formInputStyle} />
                  </div>

                  {displayBandAlbums.length > 0 && (
                    <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '9px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>RILISAN YANG SUDAH DIUPLOAD</p>
                      {displayBandAlbums.map((album) => (
                        <div key={album.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)', color: '#F8F7F8', fontSize: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '10px', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '900' }}>{album.title}</span>
                            <span style={{ color: '#73BBC9', fontWeight: '900' }}>{album.trackCount || 0} TRACK</span>
                            <button type="button" onClick={() => handleDeleteAlbum(album)} style={{ background: 'rgba(241,212,229,0.1)', border: '1px solid rgba(241,212,229,0.35)', color: '#F8F7F8', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE ALBUM</button>
                          </div>
                          {(album.tracks || []).length > 0 && (
                            <div style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
                              {(album.tracks || []).map((track, index) => (
                                <div key={track.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', alignItems: 'center', padding: '7px 8px', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '10px' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.72)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(index + 1).padStart(2, '0')} / {track.title}</span>
                                  <button type="button" onClick={() => handleDeleteAlbumTrack(album, track)} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.25)', color: '#ff6666', borderRadius: '9px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE LAGU</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SETUJUI & SIAPKAN UPLOAD ALBUM</button>
                </form>
              )}

              {bandProfileTab === 'merch' && (
                <form onSubmit={handleMerchDraftSubmit}>
                  {!hasBandPayoutAccount && (
                    <div style={{ backgroundColor: 'rgba(241,212,229,0.06)', border: '1px solid rgba(241,212,229,0.28)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>REKENING PAYOUT WAJIB</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Isi rekening payout dulu.</p>
                    </div>
                  )}
                  {!merchUsesAdminConsignment && !hasBandShippingOrigin && (
                    <div style={{ backgroundColor: 'rgba(241,212,229,0.06)', border: '1px solid rgba(241,212,229,0.28)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>ALAMAT PENGIRIM WAJIB</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.45, margin: '0 0 6px 0' }}>Isi alamat asal pengiriman di Profile Band dulu. Ini bakal jadi titik awal hitung ongkir, resi, dan label cetak.</p>
                      <p style={{ color: '#F1D4E5', fontSize: '11px', lineHeight: 1.4, margin: 0, fontWeight: '800' }}>Kurang: {bandShippingOriginMissingFields.join(', ')}.</p>
                    </div>
                  )}
                  <div style={{ backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.18)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
                    <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 9px 0' }}>FULFILLMENT MERCH</p>
                    <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(2, 1fr)', gap: '8px' }}>
                      {[
                        ['band_ship', 'BAND KIRIM SENDIRI', 'Ongkir dari alamat asal band. Band packing dan input resi.'],
                        ['admin_consignment', 'STOK DI ADMIN WISPACE', 'Silahkan hubungi admin untuk kirim stok barang. Order dikirim dari WiSpace.']
                      ].map(([mode, title, note]) => {
                        const isSelected = merchDraft.fulfillmentMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setMerchDraft({ ...merchDraft, fulfillmentMode: mode })}
                            style={{ textAlign: 'left', padding: '11px', backgroundColor: isSelected ? 'rgba(115,187,201,0.12)' : '#080202', border: `1px solid ${isSelected ? 'rgba(115,187,201,0.45)' : 'rgba(241,212,229,0.08)'}`, borderRadius: '12px', cursor: 'pointer', fontFamily: FONT_STACK }}
                          >
                            <strong style={{ color: isSelected ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', display: 'block', marginBottom: '5px' }}>{title}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.35 }}>{note}</span>
                          </button>
                        );
                      })}
                    </div>
                    {merchUsesAdminConsignment && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Hubungi admin untuk titip stok.</p>
                        <button type="button" onClick={() => { setShowNotificationPopout(false); setShowBandAdminPopout(true); }} style={{ ...glassButtonStyle, padding: '7px 10px', fontSize: '9px', borderRadius: '8px' }}>HUBUNGI ADMIN</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="NAMA MERCH (Kaos, CD, Kaset, Sticker)" value={merchDraft.name} onChange={(e) => setMerchDraft({ ...merchDraft, name: e.target.value })} required style={formInputStyle} />
                    <input type="text" inputMode="numeric" placeholder="HARGA JUAL" value={formatRupiahInput(merchDraft.price)} onChange={(e) => setMerchDraft({ ...merchDraft, price: String(normalizePriceValue(e.target.value) || '') })} required style={formInputStyle} />
                    <input type="number" min="0" placeholder="STOK" value={merchDraft.stock} onChange={(e) => setMerchDraft({ ...merchDraft, stock: e.target.value })} required style={formInputStyle} />
                    <input type="text" inputMode="numeric" placeholder="BERAT GRAM (contoh 500)" value={merchDraft.weightGram} onChange={(e) => setMerchDraft({ ...merchDraft, weightGram: String(normalizePriceValue(e.target.value) || '') })} required style={formInputStyle} />
                  </div>
                  <textarea placeholder="DESKRIPSI MERCH / SIZE / WARNA / DETAIL PENGIRIMAN" value={merchDraft.description} onChange={(e) => setMerchDraft({ ...merchDraft, description: e.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />
                  <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(115,187,201,0.35)', borderRadius: '9px', backgroundColor: '#080202', cursor: 'pointer', marginBottom: '14px' }}>
                    <input type="file" accept="image/*" onChange={handleMerchImageImport} style={{ display: 'none' }} />
                    <span style={{ color: '#73BBC9', fontSize: '12px', fontWeight: '900' }}>IMPORT FOTO MERCH</span>
                    <p style={{ color: '#F8F7F8', fontSize: '12px', margin: '6px 0 0 0' }}>{merchDraft.imageName || 'Foto produk untuk etalase band.'}</p>
                  </label>

                  {merchItems.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>DRAFT MERCHANDISE</p>
                      {merchItems.map((item) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto auto auto', gap: '10px', padding: '9px 0', borderTop: '1px solid rgba(241,212,229,0.08)', color: '#F8F7F8', fontSize: '12px', alignItems: 'center' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                          <span style={{ color: '#73BBC9', fontWeight: '900' }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</span>
                          {!isTinyLayout && <span style={{ color: 'rgba(255,255,255,0.72)' }}>Stok {item.stock} / {Number(item.weightGram || 0).toLocaleString('id-ID')}g / {item.fulfillmentLabel || (item.fulfillmentMode === 'admin_consignment' ? 'Stok di admin' : 'Band kirim')}</span>}
                          <button type="button" onClick={() => handleDeleteMerch(item)} style={{ background: 'transparent', border: '1px solid rgba(241,212,229,0.25)', color: '#ff6666', borderRadius: '9px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>TAMBAH KE ETALASE MERCH</button>
                </form>
              )}

              {bandProfileTab === 'artikel' && (
                <form onSubmit={handleArticleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="JUDUL ARTIKEL" value={articleDraft.title} onChange={(e) => setArticleDraft({ ...articleDraft, title: e.target.value })} required style={formInputStyle} />
                    <input type="text" placeholder="KATEGORI (Interview, Release Note, Review)" value={articleDraft.category} onChange={(e) => setArticleDraft({ ...articleDraft, category: e.target.value })} style={formInputStyle} />
                  </div>
                  <textarea placeholder="RINGKASAN ARTIKEL UNTUK CARD" value={articleDraft.excerpt} onChange={(e) => setArticleDraft({ ...articleDraft, excerpt: e.target.value })} required rows={3} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />
                  <textarea placeholder="ISI ARTIKEL LENGKAP / CERITA BAND / CATATAN RILISAN" value={articleDraft.body} onChange={(e) => setArticleDraft({ ...articleDraft, body: e.target.value })} rows={8} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '14px', lineHeight: 1.5 }} />

                  {articleItems.length > 0 && (
                    <div style={{ backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '9px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>DRAFT ARTIKEL BAND</p>
                      {articleItems.slice(0, 5).map((article) => (
                        <div key={article.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(115,187,201,0.18)' }}>
                          <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', margin: 0 }}>{article.category} / {article.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>PUBLISH ARTIKEL DRAFT</button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* HOME PREMIUM EDITORIAL */}
      {!loading && !isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isAudienceOrdersPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={{ display: 'grid', gap: isTinyLayout ? '30px' : '42px', marginBottom: '68px', ...homeRevealStyle(0) }}>
          <section style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(0, 1.62fr) minmax(250px, 0.62fr)', gap: isTinyLayout ? '24px' : '18px', alignItems: 'start' }}>
            <section style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: isTinyLayout ? '14px' : '18px', borderTop: `1.5px solid ${flatLineColor}`, paddingTop: '12px' }}>
                <div>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1.8px', margin: '0 0 5px 0' }}>01 / WISPACE PICKS</p>
                  <h2 style={{ fontSize: isTinyLayout ? '13px' : '15px', fontWeight: '900', color: '#F8F7F8', margin: 0, letterSpacing: '1.6px' }}>VIDEO REVIEW / CURATED DROP</h2>
                </div>
                <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ background: 'transparent', border: 'none', color: '#73BBC9', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXPLORE</button>
              </div>

              {homeWispacePick ? (
                <article onClick={() => openWispacePickDetail(homeWispacePick, { autoplay: Boolean(homeWispacePick.youtubeUrl) })} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'minmax(0, 1.08fr) minmax(210px, 0.62fr)', gap: isTinyLayout ? '14px' : '18px', alignItems: 'stretch', padding: isTinyLayout ? '10px 0 14px' : '12px 0 18px', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}`, cursor: 'pointer' }}>
                  <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden', borderRadius: '10px', background: '#080202' }}>
                    {homeWispacePick.thumbnail ? <img src={homeWispacePick.thumbnail} alt="" style={{ width: '100%', aspectRatio: isTinyLayout ? '16/11' : '16/9', objectFit: 'cover', borderRadius: '10px', display: 'block' }} /> : <div style={{ width: '100%', aspectRatio: isTinyLayout ? '16/11' : '16/9', display: 'grid', placeItems: 'center', borderRadius: '10px', border: `1.5px solid ${flatLineColor}` }}><Play size={26} color="#73BBC9" /></div>}
                    <span style={{ position: 'absolute', left: '12px', top: '12px', padding: '5px 8px', borderRadius: '9999px', background: 'rgba(8,2,2,0.72)', border: '1px solid rgba(115,187,201,0.28)', color: '#F8F7F8', fontSize: '9px', fontWeight: '900', letterSpacing: '1px' }}>{getWispacePickLabel(homeWispacePick)}</span>
                    <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <span style={{ width: isTinyLayout ? '42px' : '52px', height: isTinyLayout ? '42px' : '52px', borderRadius: '9999px', display: 'grid', placeItems: 'center', background: 'rgba(8,2,2,0.62)', border: '1px solid rgba(115,187,201,0.34)', boxShadow: '0 18px 46px rgba(0,0,0,0.34)' }}><Play size={isTinyLayout ? 18 : 22} color="#F8F7F8" /></span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px', minWidth: 0 }}>
                    <div>
                      <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1.6px', margin: '0 0 9px 0' }}>{getWispacePickLabel(homeWispacePick)} / {String(homeWispacePick.bandName || 'WiSpace').toUpperCase()}</p>
                      <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '22px' : 'clamp(24px, 2.45vw, 36px)', fontWeight: '900', lineHeight: 0.98, margin: '0 0 12px 0', overflowWrap: 'anywhere' }}>{String(homeWispacePick.title || 'WiSpace Pick').toUpperCase()}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.55, margin: 0 }}>{homeWispacePick.review}</p>
                    </div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); openWispacePickDetail(homeWispacePick, { autoplay: Boolean(homeWispacePick.youtubeUrl) }); }} style={{ alignSelf: 'flex-start', background: homeWispacePick.youtubeUrl ? 'rgba(115,187,201,0.14)' : 'rgba(241,212,229,0.05)', border: `1px solid ${homeWispacePick.youtubeUrl ? 'rgba(115,187,201,0.32)' : 'rgba(241,212,229,0.12)'}`, color: '#F8F7F8', borderRadius: '9999px', padding: '9px 13px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>{getWispacePickActionLabel(homeWispacePick)}</button>
                  </div>
                </article>
              ) : (
                <div style={{ ...flatSurfaceStyle, padding: '18px 0', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}` }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada WiSpace Pick.</p>
                </div>
              )}

              {homeSupportingGigs.length > 0 && (
                <div style={{ marginTop: isTinyLayout ? '12px' : '14px', borderTop: `1.5px solid ${flatLineColor}`, paddingTop: isTinyLayout ? '10px' : '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '9px' }}>
                    <p style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900', letterSpacing: '1.4px', margin: 0 }}>UPCOMING GIGS</p>
                    <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', fontSize: '8px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LIHAT SEMUA</button>
                  </div>
                  <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: isTinyLayout ? 'minmax(138px, 54vw)' : 'minmax(132px, 168px)', gap: isTinyLayout ? '8px' : '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin' }}>
                  {homeSupportingGigs.map((gig) => (
                    <button key={gig.id} onClick={() => setSelectedGigDetail({ ...gig, fromEventOverlay: true })} style={{ background: 'transparent', border: 'none', borderLeft: `1.5px solid ${flatLineColor}`, borderTop: `1.5px solid ${flatLineColor}`, padding: '8px 0 0 9px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT_STACK, minWidth: 0 }}>
                      <p style={{ color: '#73BBC9', fontSize: '7.5px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>{getGigDate(gig).toUpperCase()}</p>
                      <h3 style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', lineHeight: 1.12, margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(gig.title || '').toUpperCase()}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: '8.5px', margin: '0 0 6px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(gig.city || '').toUpperCase()} / {String(getGigGenre(gig) || 'INDIE').toUpperCase()}</p>
                      <span style={{ color: 'rgba(255,255,255,0.44)', fontSize: '7.5px', fontWeight: '900', letterSpacing: '0.8px' }}>LIHAT POSTER</span>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </section>

            <aside style={{ ...railPanelStyle, width: '100%', paddingTop: '12px', position: isCompactLayout ? 'static' : 'sticky', top: isCompactLayout ? undefined : '92px', alignSelf: 'start', justifySelf: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1.8px', margin: '0 0 5px 0' }}>02 / EDITORIAL</p>
                  <h2 style={{ fontSize: isTinyLayout ? '13px' : '15px', fontWeight: '900', color: '#F8F7F8', margin: 0, letterSpacing: '1.6px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={13} color="#73BBC9"/> NEWSSPACE</h2>
                </div>
                <button onClick={() => { setActivePage('articles'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'transparent', border: 'none', color: '#73BBC9', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LIHAT</button>
              </div>
              {homeFeaturedArticle ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <button onClick={() => openArticleReader(homeFeaturedArticle)} style={{ textAlign: 'left', padding: '0 0 12px', border: 'none', borderBottom: `1.5px solid ${flatLineColor}`, background: 'transparent', cursor: 'pointer', fontFamily: FONT_STACK }}>
                    <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 8px 0' }}>{String(homeFeaturedArticle.category || 'NewsSpace').toUpperCase()}</p>
                    <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '17px' : '20px', fontWeight: '900', lineHeight: 1.05, margin: '0 0 9px 0' }}>{String(homeFeaturedArticle.title || '').toUpperCase()}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.48, margin: 0 }}>{homeFeaturedArticle.excerpt || homeFeaturedArticle.bandName || 'Cerita baru dari skena WiSpace.'}</p>
                  </button>
                  {publicArticleList.slice(1, 4).map((article) => (
                    <button key={article.id} onClick={() => openArticleReader(article)} style={{ textAlign: 'left', padding: '8px 0', border: 'none', borderBottom: `1.5px solid ${flatLineColor}`, background: 'transparent', cursor: 'pointer', fontFamily: FONT_STACK }}>
                      <p style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', lineHeight: 1.2, margin: '0 0 4px 0' }}>{String(article.title || '').toUpperCase()}</p>
                      <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '9px', margin: 0 }}>{article.bandName || 'WiSpace'}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '11px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>Interview, release notes, dan cerita skena.</p>
                  {['Scene report coming soon', 'Band interview archive', 'Release notes from WiSpace'].map((line) => (
                    <div key={line} style={{ paddingTop: '9px', borderTop: `1.5px solid ${flatLineColor}`, color: 'rgba(255,255,255,0.58)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px' }}>{line.toUpperCase()}</div>
                  ))}
                </div>
              )}
            </aside>
          </section>

          <section style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', borderTop: `1.5px solid ${flatLineColor}`, paddingTop: '12px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1.8px', margin: '0 0 5px 0' }}>03 / MARKET</p>
                <h2 style={{ fontSize: isTinyLayout ? '13px' : '15px', fontWeight: '900', color: '#F8F7F8', margin: 0, letterSpacing: '1.6px', display: 'flex', alignItems: 'center', gap: '8px' }}><Radio size={13} color="#73BBC9"/> FRESH FINDS</h2>
              </div>
              <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan' })} style={{ background: 'transparent', border: 'none', color: '#73BBC9', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXPLORE</button>
            </div>
            {homeDiscoveryItems.length === 0 ? (
              <div style={{ ...flatSurfaceStyle, padding: '18px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada rilisan atau merch live.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(112px, 138px))', justifyContent: 'start', gap: isTinyLayout ? '8px' : '10px' }}>
                {homeDiscoveryItems.map((item) => (
                  <button key={item.id} onClick={item.action} style={{ ...compactVisualCardStyle, textAlign: 'left', fontFamily: FONT_STACK }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#080202', border: `1.5px solid ${flatLineColor}`, borderRadius: '8px', overflow: 'hidden', display: 'grid', placeItems: 'center', marginBottom: '7px' }}>
                      {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>{item.type}</span>}
                    </div>
                    <p style={{ color: '#73BBC9', fontSize: '8px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 4px 0' }}>{item.type}</p>
                    <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '10px' : '11px', fontWeight: '900', lineHeight: 1.12, margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(item.title || '').toUpperCase()}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '8.5px', margin: '0 0 5px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(item.subtitle || '').toUpperCase()}</p>
                    <p style={{ color: '#F8F7F8', fontSize: '9px', fontWeight: '900', margin: 0 }}>{item.meta}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {selectedMerchOrderDetail && !loading && (
        <div onClick={() => setSelectedMerchOrderDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 1500, backgroundColor: 'rgba(8,2,2,0.88)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box' }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'rgba(8,2,2,0.98)', border: '1.5px solid rgba(115,187,201,0.2)', borderRadius: '12px', padding: isTinyLayout ? '14px' : '18px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(0,0,0,0.42)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>MERCH ORDER DETAIL</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '20px' : '26px', fontWeight: '900', margin: '0 0 7px 0', lineHeight: 1.02, overflowWrap: 'anywhere' }}>{String(selectedMerchOrderDetail.itemName || 'Merch WiSpace').toUpperCase()}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{selectedMerchOrderDetail.orderId || selectedMerchOrderDetail.transactionId || selectedMerchOrderDetail.id} / {selectedMerchOrderDetail.createdAt || '-'}</p>
                {selectedMerchOrderStage && <p style={{ color: selectedMerchOrderStage.color, fontSize: '10px', lineHeight: 1.4, margin: '7px 0 0 0', fontWeight: '900' }}>{selectedMerchOrderStage.title.toUpperCase()} / <span style={{ color: 'rgba(255,255,255,0.64)', fontWeight: '700' }}>{selectedMerchOrderStage.note}</span></p>}
                {selectedMerchOrderLabelStatus && <p style={{ color: selectedMerchOrderLabelStatus.color, fontSize: '10px', lineHeight: 1.4, margin: '5px 0 0 0', fontWeight: '900' }}>{selectedMerchOrderLabelStatus.title.toUpperCase()} / <span style={{ color: 'rgba(255,255,255,0.64)', fontWeight: '700' }}>{selectedMerchOrderLabelStatus.note}</span></p>}
                {selectedMerchOrderTrackingLive && <p style={{ color: '#73BBC9', fontSize: '10px', lineHeight: 1.4, margin: '5px 0 0 0', fontWeight: '900' }}>{String(selectedMerchOrderTrackingLive.title || 'TRACKING LIVE').toUpperCase()} / <span style={{ color: 'rgba(255,255,255,0.64)', fontWeight: '700' }}>{selectedMerchOrderTrackingLive.note}</span></p>}
              </div>
              <button type="button" onClick={() => setSelectedMerchOrderDetail(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1.15fr 0.85fr', gap: '12px', alignItems: 'start' }}>
              <section style={{ display: 'grid', gap: '10px' }}>
                <div style={{ padding: '10px 0', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: getMerchOrderStatusColor(selectedMerchOrderDetail.trackingStatus), fontSize: '11px', fontWeight: '900' }}>{getMerchOrderStatusLabel(selectedMerchOrderDetail.trackingStatus)}</strong>
                    <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900' }}>{selectedMerchOrderDetail.fulfillmentMode === 'admin_consignment' ? 'DIKIRIM WISPACE' : 'DIKIRIM BAND'}</span>
                  </div>
                  {renderMerchOrderStepper(selectedMerchOrderDetail.trackingStatus)}
                  <div style={{ padding: '10px 0', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}`, marginTop: '10px' }}>
                    <p style={{ color: selectedMerchOrderLabelStatus?.color || '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 5px 0' }}>{selectedMerchOrderLabelStatus?.title?.toUpperCase() || 'STATUS SHIPMENT'}</p>
                    {selectedMerchOrderDetail.trackingNumber && (
                      <button type="button" onClick={() => navigator.clipboard?.writeText(selectedMerchOrderDetail.trackingNumber)} style={{ ...glassButtonStyle, marginTop: '9px', padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>COPY RESI {selectedMerchOrderDetail.trackingNumber}</button>
                    )}
                    {selectedMerchOrderDetail.trackingNumber && (
                      <button type="button" onClick={() => syncShipmentTrackingForOrder(selectedMerchOrderDetail, { notify: true })} disabled={shipmentTrackingOrderId === selectedMerchOrderDetail.id} style={{ ...glassButtonStyle, marginTop: '9px', marginLeft: '8px', padding: '7px 9px', fontSize: '9px', borderRadius: '8px', opacity: shipmentTrackingOrderId === selectedMerchOrderDetail.id ? 0.55 : 1 }}>{shipmentTrackingOrderId === selectedMerchOrderDetail.id ? 'CHECKING...' : 'CEK TRACKING'}</button>
                    )}
                    {selectedMerchOrderTrackingLive && (
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.45, margin: '9px 0 0 0' }}>
                        Provider: <strong style={{ color: '#F8F7F8' }}>{selectedMerchOrderTrackingLive.title}</strong>
                        {selectedMerchOrderTrackingLive.checkedAt ? ` / Last check ${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedMerchOrderTrackingLive.checkedAt))}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '9px' }}>
                  {[
                    ['BUYER', `${selectedMerchOrderDetail.buyerName || '-'} / ${selectedMerchOrderDetail.buyerEmail || '-'}`],
                    ['SELLER', selectedMerchOrderDetail.sellerBandName || 'Band WiSpace'],
                    ['KURIR', `${selectedMerchOrderDetail.courier || '-'} / Ongkir Rp ${Number(selectedMerchOrderDetail.shippingCost || 0).toLocaleString('id-ID')}`],
                    ['RESI', selectedMerchOrderDetail.trackingNumber || 'Belum ada resi'],
                    ['ONGKIR HELD', selectedMerchOrderDetail.shippingPaymentStatus === 'shipping_fee_held_by_wispace' ? 'Ditahan WiSpace untuk ekspedisi' : selectedMerchOrderDetail.shippingPaymentStatus || '-'],
                    ['SHIPMENT', getShipmentBookingLabel(selectedMerchOrderDetail.shipmentBookingStatus)],
                    ['STOCK RESTORE', selectedMerchOrderDetail.stockRestored ? `SUDAH / ${selectedMerchOrderDetail.stockRestoredAt ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedMerchOrderDetail.stockRestoredAt)) : 'LOCAL'}` : 'BELUM / TIDAK PERLU']
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '9px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                      <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{label}</p>
                      <strong style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{value}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 6px 0' }}>ALAMAT ASAL PENGIRIM</p>
                  <p style={{ color: 'rgba(241,212,229,0.72)', fontSize: '12px', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                    {selectedMerchOrderDetail.originShipping?.contactName || selectedMerchOrderDetail.sellerBandName || '-'} / {selectedMerchOrderDetail.originShipping?.contactPhone || '-'}<br />
                    {selectedMerchOrderDetail.originShipping?.address || '-'}, {selectedMerchOrderDetail.originShipping?.district || '-'}, {selectedMerchOrderDetail.originShipping?.city || '-'} {selectedMerchOrderDetail.originShipping?.postalCode || ''}
                  </p>
                  <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 6px 0' }}>ALAMAT PENERIMA</p>
                  <p style={{ color: 'rgba(241,212,229,0.72)', fontSize: '12px', lineHeight: 1.55, margin: 0 }}>{selectedMerchOrderDetail.recipientName || '-'} / {selectedMerchOrderDetail.recipientPhone || '-'}<br />{selectedMerchOrderDetail.address || '-'}, {selectedMerchOrderDetail.city || '-'} {selectedMerchOrderDetail.postalCode || ''}</p>
                  {selectedMerchOrderDetail.note && <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: '8px 0 0 0' }}>Catatan: {selectedMerchOrderDetail.note}</p>}
                  {selectedMerchOrderDetail.shipmentLabelUrl && (
                    <button type="button" onClick={() => window.open(selectedMerchOrderDetail.shipmentLabelUrl, '_blank', 'noopener,noreferrer')} style={{ ...glassButtonStyle, marginTop: '10px', padding: '8px 10px', fontSize: '9px', borderRadius: '8px' }}>CETAK LABEL EKSPEDISI</button>
                  )}
                  <button type="button" onClick={() => syncShipmentBookingForOrder(selectedMerchOrderDetail, { notify: true })} disabled={shipmentBookingOrderId === selectedMerchOrderDetail.id} style={{ ...glassButtonStyle, marginTop: '10px', marginLeft: selectedMerchOrderDetail.shipmentLabelUrl ? '8px' : 0, padding: '8px 10px', fontSize: '9px', borderRadius: '8px', opacity: shipmentBookingOrderId === selectedMerchOrderDetail.id ? 0.55 : 1 }}>{shipmentBookingOrderId === selectedMerchOrderDetail.id ? 'BOOKING...' : 'BOOKING SHIPMENT ULANG'}</button>
                  {selectedMerchOrderTrackingLive?.note && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1.5px solid ${flatLineColor}` }}>
                      <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 6px 0' }}>TRACKING LIVE</p>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.45, margin: '0 0 8px 0' }}>{selectedMerchOrderTrackingLive.note}</p>
                      {(selectedMerchOrderDetail.trackingEvents || []).length > 0 && (
                        <div style={{ display: 'grid', gap: '7px' }}>
                          {selectedMerchOrderDetail.trackingEvents.slice(0, 5).map((eventItem, index) => (
                            <div key={`${eventItem.status || 'event'}-${eventItem.timestamp || index}`} style={{ padding: '8px 0', borderTop: `1px solid ${flatLineColor}` }}>
                              <p style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', margin: '0 0 4px 0' }}>{eventItem.label || eventItem.status || 'Tracking update'}</p>
                              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.45, margin: '0 0 3px 0' }}>{eventItem.description || 'Provider mengirim update tracking baru.'}</p>
                              {eventItem.timestamp && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', margin: 0 }}>{eventItem.timestamp}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <aside style={{ padding: '10px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 9px 0' }}>ORDER ACTIONS</p>
                {(isAdminUnlocked || String(selectedMerchOrderDetail.sellerBandUserId || '') === String(userSession?.id || '')) ? (
                  <div style={{ display: 'grid', gap: '7px' }}>
                    {[
                      [selectedMerchOrderDetail.fulfillmentMode === 'admin_consignment' ? 'processing_admin' : 'processing', selectedMerchOrderDetail.fulfillmentMode === 'admin_consignment' ? 'PROSES WISPACE' : 'PROSES BAND'],
                      ['packing', 'PACKING'],
                      ['ready_to_ship', 'READY TO SHIP']
                    ].map(([status, label]) => (
                      <button key={status} type="button" onClick={() => handleMerchOrderStatusUpdate(selectedMerchOrderDetail, status)} disabled={selectedMerchOrderDetail.trackingStatus === status} style={{ ...glassButtonStyle, padding: '9px 10px', fontSize: '10px', borderRadius: '9px', opacity: selectedMerchOrderDetail.trackingStatus === status ? 0.55 : 1 }}>{label}</button>
                    ))}
                    <button type="button" onClick={() => handleMerchTrackingNumberUpdate(selectedMerchOrderDetail)} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.24)', color: 'rgba(241,212,229,0.72)', borderRadius: '9px', padding: '9px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>INPUT / UPDATE RESI</button>
                    <button type="button" onClick={() => syncShipmentTrackingForOrder(selectedMerchOrderDetail, { notify: true })} disabled={!selectedMerchOrderDetail.trackingNumber || shipmentTrackingOrderId === selectedMerchOrderDetail.id} style={{ ...glassButtonStyle, padding: '9px 10px', fontSize: '10px', borderRadius: '9px', opacity: !selectedMerchOrderDetail.trackingNumber || shipmentTrackingOrderId === selectedMerchOrderDetail.id ? 0.55 : 1 }}>{shipmentTrackingOrderId === selectedMerchOrderDetail.id ? 'TRACKING...' : 'CEK TRACKING LIVE'}</button>
                    <button type="button" onClick={() => handleMerchOrderStatusUpdate(selectedMerchOrderDetail, 'completed')} disabled={selectedMerchOrderDetail.trackingStatus === 'completed'} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '9px', padding: '9px 10px', fontSize: '10px', fontWeight: '900', cursor: selectedMerchOrderDetail.trackingStatus === 'completed' ? 'default' : 'pointer', opacity: selectedMerchOrderDetail.trackingStatus === 'completed' ? 0.55 : 1, fontFamily: FONT_STACK }}>SELESAI</button>
                    {isAdminUnlocked && (
                      <>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(selectedMerchOrderDetail, 'refund_requested')} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '9px', padding: '9px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REVIEW REFUND</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(selectedMerchOrderDetail, 'refunded')} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '9px', padding: '9px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>MARK REFUNDED</button>
                        <button type="button" onClick={() => handleMerchOrderStatusUpdate(selectedMerchOrderDetail, 'cancelled')} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '9px', padding: '9px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CANCEL ORDER</button>
                      </>
                    )}
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>
      )}

      {selectedWispacePickDetail && !loading && (
        <div onClick={closeWispacePickDetail} style={{ position: 'fixed', inset: 0, zIndex: 1500, backgroundColor: 'rgba(8,2,2,0.88)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box' }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(880px, 96vw)', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'rgba(8,2,2,0.98)', border: '1.5px solid rgba(115,187,201,0.22)', borderRadius: '12px', padding: isTinyLayout ? '14px' : '18px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(0,0,0,0.42)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>WISPACE PICK / {String(selectedWispacePickDetail.type || 'REVIEW').toUpperCase()}</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '22px' : 'clamp(28px, 4vw, 48px)', fontWeight: '900', margin: '0 0 7px 0', lineHeight: 0.98, overflowWrap: 'anywhere' }}>{String(selectedWispacePickDetail.title || 'WiSpace Pick').toUpperCase()}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{String(selectedWispacePickDetail.bandName || 'WiSpace').toUpperCase()}</p>
              </div>
              <button type="button" onClick={closeWispacePickDetail} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1.1fr 0.9fr', gap: '14px', alignItems: 'start' }}>
              <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: `1.5px solid ${flatLineColor}`, background: '#080202' }}>
                {selectedWispacePickEmbedUrl ? (
                  <iframe
                    src={selectedWispacePickEmbedUrl}
                    title={selectedWispacePickDetail.title || 'WiSpace Pick'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block', background: '#080202' }}
                  />
                ) : selectedWispacePickDetail.thumbnail ? <img src={selectedWispacePickDetail.thumbnail} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', aspectRatio: '16/9', display: 'grid', placeItems: 'center' }}><Play size={28} color="#73BBC9" /></div>}
              </div>
              <section style={{ borderTop: `1.5px solid ${flatLineColor}`, paddingTop: '12px' }}>
                <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 10px 0' }}>{selectedWispacePickDetail.youtubeUrl ? 'WISPACE PLAYBACK' : 'WISPACE REVIEW'}</p>
                <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '13px', lineHeight: 1.65, margin: '0 0 14px 0' }}>{selectedWispacePickDetail.review}</p>
                {selectedWispacePickDetail.youtubeUrl && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {!selectedWispacePickEmbedUrl && (
                      <button type="button" onClick={() => setWispacePickShouldAutoplay(true)} style={{ background: 'rgba(115,187,201,0.14)', border: '1px solid rgba(115,187,201,0.32)', color: '#F8F7F8', borderRadius: '9999px', padding: '9px 13px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>PLAY DI WISPACE</button>
                    )}
                    <button type="button" onClick={() => window.open(selectedWispacePickDetail.youtubeUrl, '_blank', 'noopener,noreferrer')} style={{ background: 'rgba(241,212,229,0.05)', border: '1px solid rgba(241,212,229,0.14)', color: '#F8F7F8', borderRadius: '9999px', padding: '9px 13px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BUKA YOUTUBE</button>
                  </div>
                )}
                {selectedWispacePickDetail.youtubeUrl && <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: '10px', lineHeight: 1.45, margin: '12px 0 0 0' }}>Player podcast dan video bisa diputar langsung di WiSpace setelah login.</p>}
              </section>
            </div>
          </div>
        </div>
      )}

      {selectedReleaseDetail && !loading && (
        <div onClick={() => setSelectedReleaseDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 1500, backgroundColor: 'rgba(8,2,2,0.88)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box' }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(860px, 96vw)', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'rgba(8,2,2,0.98)', border: '1.5px solid rgba(115,187,201,0.22)', borderRadius: '12px', padding: isTinyLayout ? '14px' : '18px', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(0,0,0,0.42)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>RELEASE DETAIL / {String(selectedReleaseDetail.genre || 'DIGITAL').toUpperCase()}</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '22px' : 'clamp(28px, 4vw, 46px)', fontWeight: '900', margin: '0 0 7px 0', lineHeight: 0.98, overflowWrap: 'anywhere' }}>{String(selectedReleaseDetail.title || 'Rilisan WiSpace').toUpperCase()}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{String(selectedReleaseDetail.bandName || 'Band WiSpace').toUpperCase()} / {String(selectedReleaseDetail.city || 'Indonesia').toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setSelectedReleaseDetail(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '0.82fr 1.18fr', gap: '14px', alignItems: 'start' }}>
              <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1.5px solid ${flatLineColor}`, background: '#080202', display: 'grid', placeItems: 'center' }}>
                {selectedReleaseDetail.coverPreview ? <img src={selectedReleaseDetail.coverPreview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} /> : <span style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', padding: '52px 0' }}>COVER</span>}
              </div>
              <section style={{ display: 'grid', gap: '12px' }}>
                {selectedReleaseDetail.description && <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>{selectedReleaseDetail.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: `1.5px solid ${flatLineColor}`, borderBottom: `1.5px solid ${flatLineColor}`, padding: '10px 0' }}>
                  <strong style={{ color: '#F8F7F8', fontSize: '16px', fontWeight: '900' }}>Full Album Rp {Number(selectedReleaseDetail.price || 0).toLocaleString('id-ID')}</strong>
                  <button type="button" onClick={() => handlePurchaseAlbum(selectedReleaseDetail)} style={{ ...glassButtonStyle, padding: '9px 12px', fontSize: '10px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === selectedReleaseDetail.id) ? 'BUKA LIBRARY' : 'BELI FULL ALBUM'}</button>
                </div>
                <div style={{ display: 'grid', gap: '7px' }}>
                  {(selectedReleaseDetail.tracks || []).slice(0, 6).map((track, index) => (
                    <div key={track.id || `${selectedReleaseDetail.id}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '8px', alignItems: 'center', borderTop: `1.5px solid ${flatLineColor}`, paddingTop: '8px' }}>
                      <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {track.title || selectedReleaseDetail.title}</p>
                      <button type="button" onClick={() => handlePlayTrack({ ...track, albumTitle: selectedReleaseDetail.title, bandName: selectedReleaseDetail.bandName, albumCover: selectedReleaseDetail.coverPreview }, (selectedReleaseDetail.tracks || []).map((item) => ({ ...item, albumTitle: selectedReleaseDetail.title, bandName: selectedReleaseDetail.bandName, albumCover: selectedReleaseDetail.coverPreview })))} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PLAY'}</button>
                      <button type="button" onClick={() => handlePurchaseTrack(selectedReleaseDetail, track)} disabled={track.freeFull} style={{ background: track.freeFull ? 'rgba(241,212,229,0.08)' : 'rgba(115,187,201,0.08)', border: `1px solid ${track.freeFull ? 'rgba(241,212,229,0.25)' : 'rgba(115,187,201,0.25)'}`, color: track.freeFull ? 'rgba(255,255,255,0.72)' : '#73BBC9', borderRadius: '9px', padding: '7px 9px', fontSize: '9px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK }}>{track.freeFull ? 'FREE' : `Rp ${Number(track.price || selectedReleaseDetail.price || 0).toLocaleString('id-ID')}`}</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {selectedMerchDetail && !loading && (
        <div
          onClick={() => { setSelectedMerchDetail(null); setSelectedMerchId(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1320, backgroundColor: 'rgba(8,2,2,0.78)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...modalPanelStyle, width: isTinyLayout ? '100%' : 'min(780px, calc(100vw - 48px))', maxHeight: '88vh', overflowY: 'auto', borderRadius: '14px', padding: isTinyLayout ? '12px' : '14px', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>MERCH DETAIL / STOCK {getMerchAvailableStock(selectedMerchDetail)}</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '18px' : '22px', fontWeight: '900', lineHeight: 1.02, margin: 0 }}>{String(selectedMerchDetail.name || 'Merch WiSpace').toUpperCase()}</h3>
              </div>
              <button type="button" onClick={() => { setSelectedMerchDetail(null); setSelectedMerchId(null); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.72)', padding: '3px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(180px, 260px) minmax(0, 1fr)', gap: isTinyLayout ? '12px' : '16px', alignItems: 'start' }}>
              <div style={{ width: '100%', aspectRatio: isTinyLayout ? '4/5' : '3/4', background: softSurfaceBackground, border: '1px solid rgba(241,212,229,0.12)', borderRadius: '10px', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {selectedMerchDetail.imagePreview ? (
                  <img src={selectedMerchDetail.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '900' }}>MERCH</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: '800', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                  {(selectedMerchDetail.bandName || 'Band WiSpace').toUpperCase()} / {(selectedMerchDetail.city || 'Indonesia').toUpperCase()}
                </p>
                <p style={{ color: selectedMerchDetail.fulfillmentMode === 'admin_consignment' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', margin: '0 0 12px 0' }}>
                  {selectedMerchDetail.fulfillmentLabel || (selectedMerchDetail.fulfillmentMode === 'admin_consignment' ? 'STOK DI ADMIN WISPACE' : 'BAND KIRIM SENDIRI')}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.55, margin: '0 0 14px 0' }}>{selectedMerchDetail.description || 'Merchandise resmi band di WiSpace.'}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
                  {[
                    ['HARGA', `Rp ${Number(selectedMerchDetail.price || 0).toLocaleString('id-ID')}`],
                    ['STOCK', getMerchAvailableStock(selectedMerchDetail)],
                    ['SELLER', selectedMerchDetail.bandName || 'Band WiSpace']
                  ].map(([label, value]) => (
                    <div key={label} style={{ ...compactSurfaceStyle, padding: '8px', minWidth: 0 }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{label}</p>
                      <strong style={{ color: '#F8F7F8', fontSize: label === 'SELLER' ? '11px' : '12px', fontWeight: '900', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(value).toUpperCase()}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(241,212,229,0.12)', paddingTop: '12px' }}>
                  <strong style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900' }}>Rp {Number(selectedMerchDetail.price || 0).toLocaleString('id-ID')}</strong>
                  <button type="button" disabled={!isMerchPurchasable(selectedMerchDetail)} onClick={() => handlePurchaseMerch(selectedMerchDetail)} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px', opacity: isMerchPurchasable(selectedMerchDetail) ? 1 : 0.48, cursor: isMerchPurchasable(selectedMerchDetail) ? 'pointer' : 'not-allowed' }}>{!isMerchPurchasable(selectedMerchDetail) ? 'SOLD OUT' : userSession ? 'BUY MERCH' : 'JOIN TO BUY'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPosterPreview && (
        <div
          onClick={() => setSelectedPosterPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1300, backgroundColor: 'rgba(8,2,2,0.94)', display: 'grid', placeItems: 'center', padding: '24px', boxSizing: 'border-box' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...modalPanelStyle, width: 'min(1100px, 96vw)', maxHeight: '92vh', borderRadius: '16px', padding: '16px', boxSizing: 'border-box', display: 'grid', gap: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 5px 0' }}>PREVIEW PAMFLET UTUH</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: 0 }}>{selectedPosterPreview.title?.toUpperCase()}</h3>
              </div>
              <button onClick={() => setSelectedPosterPreview(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>
            <div style={{ width: '100%', maxHeight: '74vh', overflow: 'auto', background: softSurfaceBackground, border: '1px solid rgba(241,212,229,0.12)', borderRadius: '12px', display: 'grid', placeItems: 'center', padding: '12px', boxSizing: 'border-box' }}>
              <img src={selectedPosterPreview.image} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{selectedPosterPreview.city} / {getGigDate(selectedPosterPreview)} / {getGigHtm(selectedPosterPreview)} / {getGigCp(selectedPosterPreview)}</p>
          </div>
        </div>
      )}

      {selectedPaymentDetail && (
        <div
          onClick={() => setSelectedPaymentDetail(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1390, backgroundColor: 'rgba(8,2,2,0.94)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...modalPanelStyle, width: 'min(860px, 96vw)', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px', padding: isTinyLayout ? '14px' : '18px', boxSizing: 'border-box', display: 'grid', gap: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1.2px', margin: '0 0 6px 0' }}>PAYMENT REQUEST DETAIL</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '18px' : '22px', fontWeight: '900', margin: '0 0 6px 0', lineHeight: 1.05 }}>{String(selectedPaymentDetail.productTitle || 'Checkout WiSpace').toUpperCase()}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{selectedPaymentDetail.checkoutRef} / {(selectedPaymentDetail.type || 'order').toUpperCase()} / Rp {Number(selectedPaymentDetail.amount || 0).toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => setSelectedPaymentDetail(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '260px minmax(0, 1fr)', gap: '12px', alignItems: 'start' }}>
              <div style={{ ...compactSurfaceStyle, padding: '10px', border: `1px solid ${selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl || isProviderPaidPendingActivation(selectedPaymentDetail) ? 'rgba(241,212,229,0.22)' : 'rgba(241,212,229,0.22)'}` }}>
                <p style={{ color: selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl || isProviderPaidPendingActivation(selectedPaymentDetail) ? 'rgba(255,255,255,0.72)' : '#F1D4E5', fontSize: '9px', fontWeight: '900', margin: '0 0 8px 0' }}>{selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl ? 'PROOF READY' : isProviderPaidPendingActivation(selectedPaymentDetail) ? 'PROVIDER PAID' : 'NO PAYMENT PROOF'}</p>
                <button
                  type="button"
                  disabled={!selectedPaymentDetail.paymentProofPreview && !selectedPaymentDetail.paymentProofUrl}
                  onClick={() => setSelectedPaymentProofPreview(selectedPaymentDetail)}
                  style={{ width: '100%', aspectRatio: '4/3', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(241,212,229,0.08)', background: '#080202', padding: 0, display: 'grid', placeItems: 'center', cursor: selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl ? 'pointer' : 'not-allowed' }}
                >
                  {selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl ? (
                    <img src={selectedPaymentDetail.paymentProofPreview || selectedPaymentDetail.paymentProofUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <span style={{ color: isProviderPaidPendingActivation(selectedPaymentDetail) ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900' }}>{isProviderPaidPendingActivation(selectedPaymentDetail) ? 'GATEWAY' : 'PROOF MISSING'}</span>
                  )}
                </button>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35, margin: '8px 0 0 0' }}>{selectedPaymentDetail.paymentProofName || 'Belum ada file proof.'}<br />{String(selectedPaymentDetail.paymentProofStatus || 'missing').toUpperCase()}</p>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  {[
                    ['STATUS', String(selectedPaymentDetail.status || 'waiting_admin_confirmation').replaceAll('_', ' ').toUpperCase(), selectedPaymentDetail.status === 'paid' ? 'rgba(255,255,255,0.72)' : selectedPaymentDetail.status === 'rejected' ? '#F1D4E5' : 'rgba(255,255,255,0.72)'],
                    ['PROVIDER', `${String(selectedPaymentDetail.provider || PAYMENT_GATEWAY_PROVIDER || 'manual').toUpperCase()} / ${String(selectedPaymentDetail.providerStatus || 'pending').replaceAll('_', ' ').toUpperCase()}`, isProviderPaidPendingActivation(selectedPaymentDetail) ? '#73BBC9' : 'rgba(255,255,255,0.72)'],
                    ['BUYER', `${selectedPaymentDetail.buyerName || '-'} / ${selectedPaymentDetail.buyerEmail || '-'}`, '#F1D4E5'],
                    ['SELLER', selectedPaymentDetail.sellerBandName || 'Band WiSpace', '#F1D4E5'],
                    ['SUBMITTED', selectedPaymentDetail.submittedAt ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(selectedPaymentDetail.submittedAt)) : '-', 'rgba(255,255,255,0.72)']
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ ...compactSurfaceStyle, padding: '10px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 5px 0' }}>{label}</p>
                      <strong style={{ color, fontSize: '11px', fontWeight: '900', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{value}</strong>
                    </div>
                  ))}
                </div>

                {selectedPaymentDetail.shipping && (
                  <div style={{ ...compactSurfaceStyle, padding: '10px' }}>
                    <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 7px 0' }}>SHIPPING MERCH</p>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>{selectedPaymentDetail.shipping.recipientName || '-'} / {selectedPaymentDetail.shipping.recipientPhone || '-'}<br />{selectedPaymentDetail.shipping.address || '-'}, {selectedPaymentDetail.shipping.city || '-'} {selectedPaymentDetail.shipping.postalCode || ''}<br />Courier: {selectedPaymentDetail.shipping.courier || '-'} / Rp {Number(selectedPaymentDetail.shipping.shippingCost || selectedPaymentDetail.shippingCost || 0).toLocaleString('id-ID')} {selectedPaymentDetail.shipping.shippingEstimate ? `/ ${selectedPaymentDetail.shipping.shippingEstimate}` : ''}</p>
                    {selectedPaymentDetail.shipping.origin && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: '7px 0 0 0' }}>Origin: {selectedPaymentDetail.shipping.origin.city || '-'}, {selectedPaymentDetail.shipping.origin.province || '-'} {selectedPaymentDetail.shipping.origin.postalCode || ''}</p>}
                    {selectedPaymentDetail.shipping.note && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: '7px 0 0 0' }}>Note: {selectedPaymentDetail.shipping.note}</p>}
                  </div>
                )}

                <div style={{ ...compactSurfaceStyle, padding: '10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.45, margin: 0 }}>{isProviderPaidPendingActivation(selectedPaymentDetail) ? 'Provider paid verified.' : 'Cek nominal, Order ID, dan nama buyer.'}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSelectedPaymentDetail(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.12)', color: '#F8F7F8', borderRadius: '10px', padding: '9px 11px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
              {isPaymentReadyForAdminActivation(selectedPaymentDetail) && (
                <>
                  {selectedPaymentDetail.status === 'waiting_admin_confirmation' && <button type="button" onClick={() => { handleRejectPendingPayment(selectedPaymentDetail); setSelectedPaymentDetail(null); }} style={{ background: 'rgba(241,212,229,0.08)', border: '1px solid rgba(241,212,229,0.28)', color: '#F8F7F8', borderRadius: '10px', padding: '9px 11px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REJECT</button>}
                  <button type="button" onClick={() => { handleConfirmPendingPayment(selectedPaymentDetail); if (canAdminConfirmPayment(selectedPaymentDetail)) setSelectedPaymentDetail(null); }} disabled={!canAdminConfirmPayment(selectedPaymentDetail)} style={{ ...glassButtonStyle, padding: '9px 11px', fontSize: '10px', borderRadius: '10px', color: canAdminConfirmPayment(selectedPaymentDetail) ? 'rgba(255,255,255,0.72)' : '#F1D4E5', border: canAdminConfirmPayment(selectedPaymentDetail) ? '1px solid rgba(241,212,229,0.35)' : '1px solid rgba(241,212,229,0.08)', cursor: canAdminConfirmPayment(selectedPaymentDetail) ? 'pointer' : 'not-allowed' }}>CONFIRM PAID</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPaymentProofPreview && (
        <div
          onClick={() => setSelectedPaymentProofPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1400, backgroundColor: 'rgba(8,2,2,0.94)', display: 'grid', placeItems: 'center', padding: '24px', boxSizing: 'border-box' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(760px, 96vw)', maxHeight: '92vh', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.28)', borderRadius: '16px', padding: '16px', boxSizing: 'border-box', display: 'grid', gap: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 5px 0' }}>BUKTI BAYAR BUYER</p>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: 0 }}>{selectedPaymentProofPreview.checkoutRef}</h3>
              </div>
              <button onClick={() => setSelectedPaymentProofPreview(null)} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: '#F8F7F8', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>
            <div style={{ width: '100%', maxHeight: '70vh', overflow: 'auto', backgroundColor: '#080202', borderRadius: '12px', display: 'grid', placeItems: 'center', padding: '12px', boxSizing: 'border-box' }}>
              <img src={selectedPaymentProofPreview.paymentProofPreview || selectedPaymentProofPreview.paymentProofUrl} alt="" style={{ maxWidth: '100%', maxHeight: '66vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{selectedPaymentProofPreview.productTitle} / {selectedPaymentProofPreview.buyerName} / Rp {Number(selectedPaymentProofPreview.amount || 0).toLocaleString('id-ID')}</p>
          </div>
        </div>
      )}

      {activeCheckout && checkoutProduct && (
        <div
          onClick={handleCheckoutCancel}
          style={{ position: 'fixed', inset: 0, zIndex: 1450, backgroundColor: 'rgba(8,2,2,0.94)', display: 'grid', placeItems: 'center', padding: isTinyLayout ? '14px' : '24px', boxSizing: 'border-box' }}
        >
          <form
            onSubmit={handleCheckoutSubmit}
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(640px, 96vw)', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'rgba(8,2,2,0.96)', border: '1.5px solid rgba(115,187,201,0.22)', borderRadius: '14px', padding: isTinyLayout ? '12px' : '15px', boxSizing: 'border-box', boxShadow: '0 18px 46px rgba(8,2,2,0.46)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div>
                <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 7px 0' }}>WISPACE CHECKOUT</p>
                <h3 style={{ color: '#F8F7F8', fontSize: isTinyLayout ? '20px' : '25px', fontWeight: '900', lineHeight: 1, margin: 0 }}>{checkoutTitle.toUpperCase()}</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: '7px 0 0 0' }}>{(activeCheckout.type || '').toUpperCase()} / {(checkoutSellerName || 'Band WiSpace').toUpperCase()}</p>
              </div>
              <div style={{ display: 'grid', gap: '7px', justifyItems: 'end' }}>
                <span style={{ color: checkoutAccentColor, border: `1px solid ${checkoutAccentColor}55`, backgroundColor: 'rgba(8,2,2,0.5)', borderRadius: '999px', padding: '5px 8px', fontSize: '8px', fontWeight: '900', whiteSpace: 'nowrap' }}>{checkoutReviewLabel}</span>
                <button type="button" onClick={handleCheckoutCancel} disabled={checkoutIsProcessing} style={{ background: 'rgba(241,212,229,0.04)', border: '1px solid rgba(241,212,229,0.16)', color: checkoutIsProcessing ? '#F1D4E5' : '#F1D4E5', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: checkoutIsProcessing ? 'wait' : 'pointer', fontFamily: FONT_STACK }}>{checkoutIsPaid || checkoutIsCancelled || checkoutIsAwaitingAdmin ? 'CLOSE' : 'CANCEL'}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '0.86fr 1.14fr', gap: '10px', marginBottom: '11px' }}>
              <div style={checkoutBlockStyle}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>TOTAL BAYAR</p>
                <strong style={{ color: '#73BBC9', fontSize: '23px', fontWeight: '900' }}>Rp {checkoutTotal.toLocaleString('id-ID')}</strong>
                <div style={{ display: 'grid', gap: '3px', marginTop: '7px', color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.35 }}>
                  <span>Item: Rp {checkoutSubtotal.toLocaleString('id-ID')}</span>
                  {activeCheckout.type === 'merch' && <span>Ongkir: Rp {checkoutShippingCost.toLocaleString('id-ID')} / {checkoutCourierOption?.estimate}</span>}
                </div>
              </div>
              <div style={checkoutBlockStyle}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>ORDER STATUS</p>
                <div style={{ display: 'grid', gap: '5px', color: 'rgba(255,255,255,0.72)', fontSize: '11px' }}>
                  <span>Order ID: <strong style={{ color: '#73BBC9' }}>{checkoutReference}</strong></span>
                  <span>Item: <strong style={{ color: '#F8F7F8' }}>{activeCheckout.type === 'merch' ? 'Merch fisik' : 'Koleksi digital'}</strong>{activeCheckout.type === 'merch' ? ` / ${checkoutCourierOption?.label || checkoutDraft.courier}` : ''}</span>
                  <span>Provider: <strong style={{ color: checkoutProviderCheckoutUrl ? '#73BBC9' : 'rgba(255,255,255,0.72)' }}>{checkoutProviderLabel.toUpperCase()}</strong>{checkoutProviderStatus ? ` / ${checkoutProviderStatus.replaceAll('_', ' ').toUpperCase()}` : ''}</span>
                  <span>Status: <strong style={{ color: checkoutAccentColor }}>{checkoutStatusCopy}</strong></span>
                  <span style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.35 }}>{checkoutBuyerStatusText}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '12px' }}>
              {[
                ['1', 'ORDER', checkoutIsCancelled ? 'cancelled' : 'ready'],
                ['2', 'PEMBAYARAN', checkoutIsPaid ? 'paid' : checkoutIsAwaitingAdmin ? 'waiting' : checkoutIsCancelled ? 'cancelled' : 'upload proof'],
                ['3', activeCheckout.type === 'merch' ? 'PESANAN AKTIF' : 'KOLEKSI AKTIF', checkoutIsPaid ? 'active' : 'locked']
              ].map(([number, label, status]) => {
                const isGood = ['ready', 'paid', 'active'].includes(status);
                const isWarn = ['waiting', 'upload proof'].includes(status);
                return (
                  <div key={number} style={{ padding: '8px 0', backgroundColor: 'transparent', border: 'none', borderTop: `1.5px solid ${isGood ? 'rgba(241,212,229,0.35)' : isWarn ? 'rgba(241,212,229,0.32)' : flatLineColor}`, borderRadius: 0 }}>
                    <p style={{ color: isGood ? 'rgba(255,255,255,0.72)' : isWarn ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>STEP {number}</p>
                    <strong style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900' }}>{label}</strong>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '9px', lineHeight: 1.35, margin: '4px 0 0 0' }}>{String(status).toUpperCase()}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ ...checkoutBlockStyle, marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 4px 0' }}>DETAIL PEMBAYARAN</p>
                </div>
                <button type="button" onClick={handleCopyCheckoutReference} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '9px', borderRadius: '8px' }}>COPY ORDER ID</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {WISPACE_MANUAL_PAYMENT_CHANNELS.map((channel) => (
                  <div key={channel.title} style={{ padding: '8px 0', backgroundColor: 'transparent', border: 'none', borderTop: `1.5px solid ${flatLineColor}`, borderRadius: 0 }}>
                    <p style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{channel.title.toUpperCase()}</p>
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: 1.4, margin: '0 0 5px 0' }}>{channel.detail}</p>
                  </div>
                ))}
              </div>
              {checkoutProviderCheckoutUrl && checkoutIsMidtransPopupReady && (
                <button
                  type="button"
                  onClick={handleMidtransPopupPayment}
                  disabled={midtransSnapLoading}
                  style={{ display: 'block', width: '100%', marginTop: '10px', padding: '12px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '12px', fontSize: '11px', fontWeight: '900', textAlign: 'center', textDecoration: 'none', fontFamily: FONT_STACK, cursor: midtransSnapLoading ? 'wait' : 'pointer', opacity: midtransSnapLoading ? 0.72 : 1 }}
                >
                  {midtransSnapLoading ? 'MEMBUKA PEMBAYARAN...' : 'LANJUT PEMBAYARAN'}
                </button>
              )}
              {checkoutProviderCheckoutUrl && !checkoutIsMidtransPopupReady && (
                <a
                  href={checkoutProviderCheckoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', marginTop: '10px', padding: '12px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '12px', fontSize: '11px', fontWeight: '900', textAlign: 'center', textDecoration: 'none', fontFamily: FONT_STACK }}
                >
                  BUKA HALAMAN PEMBAYARAN
                </a>
              )}
              {!checkoutProviderCheckoutUrl && checkoutProviderId !== 'manual' && checkoutIsAwaitingAdmin && (
                <div style={{ marginTop: '10px', padding: '9px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                  <p style={{ color: '#F8F7F8', fontSize: '10px', lineHeight: 1.4, margin: '0 0 5px 0', fontWeight: '800' }}>Pembayaran manual aktif.</p>
                  {activeCheckout.gatewayError && <p style={{ color: '#73BBC9', fontSize: '9px', lineHeight: 1.35, margin: 0, fontWeight: '900' }}>Detail: {activeCheckout.gatewayError}</p>}
                </div>
              )}
            </div>

            <label style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '88px 1fr auto', gap: '10px', alignItems: 'center', padding: isTinyLayout ? '10px' : '11px', backgroundColor: 'transparent', border: checkoutDraft.paymentProofPreview ? '1.5px solid rgba(241,212,229,0.24)' : '1.5px dashed rgba(241,212,229,0.34)', borderRadius: '9px', marginBottom: '12px', cursor: checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled ? 'default' : 'pointer' }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePaymentProofImport} disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={{ display: 'none' }} />
              <div style={{ width: isTinyLayout ? '100%' : '88px', aspectRatio: isTinyLayout ? '16/9' : '4/3', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.08)', display: 'grid', placeItems: 'center' }}>
                {checkoutDraft.paymentProofPreview ? (
                  <img src={checkoutDraft.paymentProofPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900' }}>BUKTI</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: checkoutDraft.paymentProofPreview ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{checkoutDraft.paymentProofPreview ? 'BUKTI BAYAR TERLAMPIR' : 'UPLOAD BUKTI BAYAR'}</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{checkoutDraft.paymentProofName || (checkoutProofRequired ? 'PNG/JPG/WebP max 2MB' : 'Opsional')}</p>
              </div>
              <span style={{ color: checkoutDraft.paymentProofStatus === 'stored' ? 'rgba(255,255,255,0.72)' : checkoutDraft.paymentProofPreview ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '9px', fontWeight: '900', justifySelf: isTinyLayout ? 'start' : 'end' }}>{checkoutDraft.paymentProofStatus ? checkoutDraft.paymentProofStatus.toUpperCase() : checkoutProofRequired ? 'REQUIRED' : 'OPTIONAL'}</span>
            </label>

            {(checkoutIsPaid || checkoutIsCancelled || checkoutIsAwaitingAdmin) && (
              <div style={{ padding: '10px 0', backgroundColor: 'transparent', border: 'none', borderTop: `1.5px solid ${checkoutIsPaid ? 'rgba(241,212,229,0.42)' : checkoutIsAwaitingAdmin ? 'rgba(115,187,201,0.42)' : 'rgba(241,212,229,0.42)'}`, borderRadius: 0, marginBottom: '12px' }}>
                <p style={{ color: checkoutIsPaid ? 'rgba(255,255,255,0.72)' : checkoutIsAwaitingAdmin ? '#73BBC9' : '#F1D4E5', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>{checkoutIsPaid ? 'PEMBAYARAN DITERIMA' : checkoutIsAwaitingAdmin ? 'MENUNGGU VERIFIKASI' : 'SESI DITUTUP'}</p>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>{checkoutIsPaid ? activeCheckout.successMessage || 'Akses sudah aktif.' : checkoutIsAwaitingAdmin ? activeCheckout.successMessage || 'Sedang menunggu verifikasi.' : 'Sesi checkout ditutup.'}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <input type="text" placeholder="NAMA PEMBELI" value={checkoutDraft.buyerName} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, buyerName: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
              <input type="email" placeholder="EMAIL PEMBELI" value={checkoutDraft.buyerEmail} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, buyerEmail: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
            </div>

            {activeCheckout.type === 'merch' && (
              <div style={{ ...checkoutBlockStyle, marginBottom: '12px' }}>
                <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 12px 0' }}>DATA PENGIRIMAN MERCH</p>
                <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : '1fr 1fr', gap: '12px' }}>
                  <input type="text" placeholder="NAMA PENERIMA" value={checkoutDraft.recipientName} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, recipientName: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <input type="text" placeholder="NO HP / WHATSAPP" value={checkoutDraft.recipientPhone} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, recipientPhone: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <input type="text" placeholder="KECAMATAN" value={checkoutDraft.district} onChange={(event) => {
                    setCheckoutDraft({ ...checkoutDraft, district: event.target.value });
                    setCheckoutShippingStatus({ loading: false, message: 'Kecamatan berubah. Cek ongkir lagi sebelum bayar.', mode: 'stale' });
                  }} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <input type="text" placeholder="KOTA" value={checkoutDraft.city} onChange={(event) => {
                    setCheckoutDraft({ ...checkoutDraft, city: event.target.value });
                    setCheckoutShippingStatus({ loading: false, message: 'Kota berubah. Cek ongkir lagi sebelum bayar.', mode: 'stale' });
                  }} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <input type="text" placeholder="PROVINSI" value={checkoutDraft.province} onChange={(event) => {
                    setCheckoutDraft({ ...checkoutDraft, province: event.target.value });
                    setCheckoutShippingStatus({ loading: false, message: 'Provinsi berubah. Cek ongkir lagi sebelum bayar.', mode: 'stale' });
                  }} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <input type="text" placeholder="KODE POS" value={checkoutDraft.postalCode} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, postalCode: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                  <select
                    value={checkoutDraft.courier}
                    onChange={(event) => {
                      const nextCourier = getCourierOption(event.target.value, checkoutCourierOptions);
                      setCheckoutDraft({
                        ...checkoutDraft,
                        courier: nextCourier.label,
                        shippingCost: nextCourier.cost,
                        shippingEstimate: nextCourier.estimate
                      });
                    }}
                    disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled}
                    style={formInputStyle}
                  >
                    {checkoutCourierOptions.map((option) => (
                      <option key={option.label} value={option.label}>{option.label} / Rp {option.cost.toLocaleString('id-ID')} / {option.estimate}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleFetchCheckoutShippingRates} disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled || checkoutShippingStatus.loading} style={{ ...glassButtonStyle, padding: '10px 12px', fontSize: '10px', opacity: checkoutShippingStatus.loading ? 0.68 : 1 }}>
                    {checkoutShippingStatus.loading ? 'CEK...' : 'CEK ONGKIR'}
                  </button>
                  <input type="text" placeholder="CATATAN OPSIONAL" value={checkoutDraft.note} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, note: event.target.value })} disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} style={formInputStyle} />
                </div>
                <textarea placeholder="ALAMAT LENGKAP" value={checkoutDraft.address} onChange={(event) => setCheckoutDraft({ ...checkoutDraft, address: event.target.value })} required disabled={checkoutIsProcessing || checkoutIsAwaitingAdmin || checkoutIsPaid || checkoutIsCancelled} rows={3} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5, marginTop: '12px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: '8px', marginTop: '10px' }}>
                  {[
                    ['ASAL', checkoutProduct?.originShipping ? `${checkoutProduct.originShipping.district || '-'}, ${checkoutProduct.originShipping.city || '-'}, ${checkoutProduct.originShipping.province || '-'}` : 'Alamat band/admin'],
                    ['TUJUAN', `${checkoutDraft.district || '-'}, ${checkoutDraft.city || '-'}, ${checkoutDraft.province || '-'}`],
                    ['BERAT', `${Number(checkoutProduct?.weightGram || 1000).toLocaleString('id-ID')} gram`],
                    ['ONGKIR', `Rp ${checkoutShippingCost.toLocaleString('id-ID')}`],
                    ['ESTIMASI', checkoutCourierOption?.estimate || checkoutDraft.shippingEstimate || '-']
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '8px 0', borderTop: `1.5px solid ${flatLineColor}` }}>
                      <p style={{ color: '#73BBC9', fontSize: '9px', fontWeight: '900', margin: '0 0 4px 0' }}>{label}</p>
                      <strong style={{ color: '#F8F7F8', fontSize: '10px', fontWeight: '900', lineHeight: 1.35 }}>{value}</strong>
                    </div>
                  ))}
                </div>
                {checkoutShippingStatus.message && <p style={{ color: checkoutShippingStatus.mode === 'error' ? '#F1D4E5' : 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: '10px 0 0 0' }}>{checkoutShippingStatus.message}</p>}
              </div>
            )}

            {checkoutIsPaid ? (
              <button type="button" onClick={closeCompletedCheckout} style={{ width: '100%', padding: '14px', backgroundColor: 'rgba(255,255,255,0.72)', color: '#080202', border: 'none', borderRadius: '14px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>{activeCheckout.type === 'merch' ? 'BUKA MY ORDERS' : 'BUKA LIBRARY'}</button>
            ) : checkoutIsCancelled || checkoutIsAwaitingAdmin ? (
              <button type="button" onClick={() => setActiveCheckout(null)} style={{ width: '100%', padding: '14px', backgroundColor: 'rgba(241,212,229,0.04)', color: '#F8F7F8', border: '1px solid rgba(241,212,229,0.16)', borderRadius: '14px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>TUTUP CHECKOUT</button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '1fr auto', gap: '10px' }}>
                <button type="submit" disabled={checkoutIsProcessing} style={{ width: '100%', padding: '14px', backgroundColor: checkoutIsProcessing ? 'rgba(241,212,229,0.1)' : '#73BBC9', color: checkoutIsProcessing ? 'rgba(255,255,255,0.50)' : '#080202', border: 'none', borderRadius: '14px', fontSize: '12px', fontWeight: '900', cursor: checkoutIsProcessing ? 'wait' : 'pointer', fontFamily: FONT_STACK }}>{checkoutIsProcessing ? 'MEMPROSES REQUEST...' : checkoutSubmitLabel}</button>
                <button type="button" onClick={handleCheckoutCancel} disabled={checkoutIsProcessing} style={{ padding: '14px', backgroundColor: 'rgba(241,212,229,0.08)', color: checkoutIsProcessing ? '#F1D4E5' : '#F1D4E5', border: '1px solid rgba(241,212,229,0.28)', borderRadius: '14px', fontSize: '12px', fontWeight: '900', cursor: checkoutIsProcessing ? 'wait' : 'pointer', fontFamily: FONT_STACK }}>CANCEL</button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* POPUP SAKRAL MULTIFUNGSI SECURITY CREDENTIAL & PROFILE SYSTEM */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(8,2,2,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ ...glassStyle('modal'), padding: '36px', maxWidth: '420px', width: '100%', position: 'relative', backgroundColor: '#080202' }}>
            <button onClick={() => { setShowAuthModal(false); setAuthType(''); setAuthError(''); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#F8F7F8', cursor: 'pointer', fontSize: '18px' }}>✕</button>

            {/* FORM LOGIN AKUN */}
            {authType === 'login' && (
              <form onSubmit={handleLoginAkun}>
                <h3 style={{ color: '#73BBC9', margin: '0 0 24px 0', fontSize: '18px', textAlign: 'center', fontWeight: '900' }}>MASUK MOSHPIT WISPACE</h3>
                <input type="email" placeholder="EMAIL USER" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                <input type="password" placeholder="PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#080202', border: `1px solid ${authError.startsWith('Link') ? 'rgba(115,187,201,0.35)' : 'rgba(241,212,229,0.35)'}`, color: authError.startsWith('Link') ? '#73BBC9' : '#F1D4E5', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '14px', backgroundColor: authLoading ? 'rgba(241,212,229,0.1)' : '#73BBC9', color: authLoading ? 'rgba(255,255,255,0.50)' : '#080202', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: FONT_STACK }}>{authLoading ? 'MEMPROSES...' : 'LOG MASUK'}</button>
                <button type="button" onClick={handleResendVerification} disabled={authLoading} style={{ width: '100%', marginTop: '10px', padding: '12px', backgroundColor: 'transparent', color: '#73BBC9', border: '1px solid rgba(115,187,201,0.35)', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: FONT_STACK, fontSize: '12px' }}>KIRIM ULANG VERIFIKASI EMAIL</button>
              </form>
            )}

            {/* FORM REGISTRASI JOIN AKUN */}
            {/* REVISI: FORM REGISTRASI JOIN DENGAN SAKELAR GESER TOGGLE ROLE DI AWAL (GAYA 2) */}
            {authType === 'join' && (
              <form onSubmit={handleDaftarAkun}>
                <h3 style={{ color: '#F8F7F8', margin: '0 0 16px 0', fontSize: '18px', textAlign: 'center', fontWeight: '900' }}>JOIN THE SKENA ECOSYSTEM</h3>
                
                {/* SAKELAR GESER (TOGGLE SWITCH) CAPSULE PREMIUM */}
                <div style={{ display: 'flex', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.1)', borderRadius: '9999px', padding: '4px', marginBottom: '20px', position: 'relative' }}>
                  {/* Tombol Geser Musisi */}
                  <div 
                    onClick={() => setUserRole('musisi')} 
                    style={{ 
                      flex: 1, textAlign: 'center', padding: '8px 0', fontSize: '12px', fontWeight: '900', cursor: 'pointer', borderRadius: '9999px',
                      backgroundColor: userRole === 'musisi' ? '#73BBC9' : 'transparent',
                      color: userRole === 'musisi' ? '#080202' : 'rgba(255,255,255,0.72)',
                      boxShadow: userRole === 'musisi' ? 'inset 0 -1px 0 rgba(115, 187, 201, 0.45)' : 'none',
                      transition: 'all 0.3s ease-in-out'
                    }}
                  >
                    🎸 MUSISI
                  </div>
                  {/* Tombol Geser Audience */}
                  <div 
                    onClick={() => setUserRole('audience')} 
                    style={{ 
                      flex: 1, textAlign: 'center', padding: '8px 0', fontSize: '12px', fontWeight: '900', cursor: 'pointer', borderRadius: '9999px',
                      backgroundColor: userRole === 'audience' ? '#73BBC9' : 'transparent',
                      color: userRole === 'audience' ? '#080202' : 'rgba(255,255,255,0.72)',
                      boxShadow: userRole === 'audience' ? 'inset 0 -1px 0 rgba(115, 187, 201, 0.45)' : 'none',
                      transition: 'all 0.3s ease-in-out'
                    }}
                  >
                    🎧 AUDIENCE
                  </div>
                </div>

                {/* NOTIFIKASI DINAMIS BERDASARKAN ARAH SAKELAR */}
                <p style={{ color: '#73BBC9', fontSize: '11px', textAlign: 'center', marginTop: '-10px', marginBottom: '16px', fontWeight: '700' }}>
                  {userRole === 'musisi' ? '👉 LU AKAN TERDAFTAR SEBAGAI BAND/KREATOR' : '👉 LU AKAN TERDAFTAR SEBAGAI PENIKMAT/KOLEKTOR MUSIK'}
                </p>

                <input type="email" placeholder="ALAMAT EMAIL RESMI" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                <input type="password" placeholder="BUAT PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#080202', border: `1px solid ${authError.startsWith('Link') ? 'rgba(115,187,201,0.35)' : 'rgba(241,212,229,0.35)'}`, color: authError.startsWith('Link') ? '#73BBC9' : '#F1D4E5', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                
                {/* Tombol Submit Kunci Akun */}
                <button type="submit" disabled={!userRole || authLoading} style={{ width: '100%', padding: '14px', backgroundColor: userRole && !authLoading ? '#73BBC9' : 'rgba(241,212,229,0.1)', color: userRole && !authLoading ? '#080202' : 'rgba(255,255,255,0.50)', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: userRole && !authLoading ? 'pointer' : 'not-allowed', fontFamily: FONT_STACK, transition: 'all 0.2s' }}>
                  {authLoading ? 'MEMPROSES...' : userRole ? 'DAFTAR AKUN BARU' : 'PILIH ROL LU DI ATAS DULU'}
                </button>
              </form>
            )}

            {/* INTERACTIVE USER TAKDIR GATEWAY: MUSISI VS AUDIENCE */}
            {authType === 'pilih_peran' && (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#F8F7F8', fontWeight: '900', fontSize: '20px', margin: '0 0 8px 0' }}>CHOOSE YOUR DESTINY</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', margin: '0 0 24px 0' }}>Tentukan kasta pergerakan lu di dalam platform WiSpace</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => handleRoleSelection('musisi')} style={{ padding: '16px', backgroundColor: 'rgba(115,187,201,0.05)', border: '1px solid #73BBC9', borderRadius: '16px', color: '#73BBC9', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: FONT_STACK }}>🎸 SEBAGAI MUSISI (UPLOAD KARYA/GIGS)</button>
                  <button onClick={() => handleRoleSelection('audience')} style={{ padding: '16px', backgroundColor: 'rgba(241,212,229,0.03)', border: '1px solid rgba(241,212,229,0.1)', borderRadius: '16px', color: '#F8F7F8', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: FONT_STACK }}>🎧 SEBAGAI AUDIENCE (PENIKMAT/KOLEKTOR)</button>
                </div>
              </div>
            )}

            {/* GABUNGAN OPSI 2 CONTRACT DIGITAL SIGNATURE (LEGALITAS MUSISI) */}
            {authType === 'legalitas_musisi' && (
              <form onSubmit={handleContractSignature}>
                <h3 style={{ color: '#F8F7F8', fontSize: '15px', fontWeight: '900', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16}/> MANIFESTO HUKUM & DISTRIBUSI WISPACE</h3>
                <div style={{ maxHeight: '180px', overflowY: 'auto', backgroundColor: '#080202', padding: '12px', borderRadius: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.72)', lineHeight: '1.4', marginBottom: '16px', border: '1px solid rgba(241,212,229,0.14)' }}>
                <p style={{ margin: '0 0 10px 0' }}>1. Segala bentuk file audio MP3, foto, dan poster acara yang di-upload sepenuhnya merupakan <strong>tanggung jawab hukum band masing-masing</strong>. WiSpace murni bertindak sebagai wadah distribusi digital independen. Simpan WAV/master hi-res di arsip pribadi band.</p>
                  <p style={{ margin: '0 0 10px 0' }}>2. WiSpace memberlakukan sistem potongan komisi tetap sebesar <strong>20%</strong> dari setiap nominal karya lagu/album/merch yang berhasil terjual untuk kebutuhan operasional platform. Ongkir merch adalah dana pass-through ekspedisi dan tidak masuk objek komisi.</p>
                  <p style={{ margin: '0 0 10px 0' }}>3. Pihak band/musisi diberikan kebebasan mutlak 100% untuk <strong>menentukan harga jual sendiri</strong> terhadap karya tunggal maupun album penuh mereka.</p>
                  <p style={{ margin: '0 0 10px 0' }}>4. Laporan keuangan komprehensif dapat dipantau real-time di profil band, dan dana hasil penjualan dapat dicairkan aman <strong>setiap tanggal 1 awal bulan (Minimal Saldo Rp {MINIMUM_PAYOUT_AMOUNT.toLocaleString('id-ID')})</strong>.</p>
                  <p style={{ margin: '0' }}>5. Tindakan Plagiarisme dilarang keras! Apabila di masa depan ditemukan indikasi plagiat karya orang lain, hal tersebut adalah <strong>pelanggaran mutlak band</strong> dan WiSpace lepas dari segala tuntutan hukum (karena admin tidak mengurasi orisinalitas nada satu per satu).</p>
                </div>
                <p style={{ color: '#F8F7F8', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>Ketik Nama Band Lu Untuk Tanda Tangan Digital Sah:</p>
                <input type="text" placeholder="CONTOH: SKENA NOISE SYNDICATE" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '16px', fontFamily: FONT_STACK, boxSizing: 'border-box', textAlign: 'center' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#F1D4E5', color: '#080202', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SAYA SETUJU & SIGN KONTRAK ✍️</button>
              </form>
            )}

            {/* SPLIT DASHBOARD PROFILE MUSISI (GABUNGAN OPSI 3) */}
            {authType === 'pilihan_upload' && (
              <div>
                <h3 style={{ color: '#73BBC9', fontSize: '18px', fontWeight: '900', margin: '0 0 6px 0', textAlign: 'center' }}>{signatureName ? signatureName.toUpperCase() : 'BACKSTAGE MUSISI'}</h3>
                
                {/* BLOK INTUOS LAPORAN KEUANGAN TRANSPARAN */}
                <div style={{ backgroundColor: '#080202', border: '1px solid rgba(115,187,201,0.2)', padding: '14px', borderRadius: '16px', marginBottom: '20px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900' }}>TOTAL SALDO SIAP CAIR</span><h4 style={{ margin: 0, fontSize: '24px', color: '#F8F7F8', fontWeight: '900', display: 'flex', alignItems: 'center' }}><DollarSign size={20} color="#73BBC9"/> Rp {bandBalance.toLocaleString('id-ID')}</h4></div>
                    <button disabled={bandBalance < MINIMUM_PAYOUT_AMOUNT} style={{ padding: '8px 14px', backgroundColor: bandBalance >= MINIMUM_PAYOUT_AMOUNT ? '#73BBC9' : 'rgba(241,212,229,0.1)', border: 'none', borderRadius: '16px', color: bandBalance >= MINIMUM_PAYOUT_AMOUNT ? '#080202' : 'rgba(255,255,255,0.50)', fontSize: '11px', fontWeight: '900', cursor: bandBalance >= MINIMUM_PAYOUT_AMOUNT ? 'pointer' : 'not-allowed', fontFamily: FONT_STACK }}>TARIK DANA</button>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.72)', fontSize: '10px', lineHeight: '1.2' }}>*Potongan sistem 20% dari harga produk. Ongkir merch dicatat terpisah untuk ekspedisi. Pencairan berkala tiap tanggal 1. {bandBalance < MINIMUM_PAYOUT_AMOUNT && <span style={{ color: '#F8F7F8' }}>Kurang Rp {(MINIMUM_PAYOUT_AMOUNT - bandBalance).toLocaleString('id-ID')} lagi buat mencairkan, bro!</span>}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => { setShowAuthModal(false); openBandWorkspace('profile'); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center' }}>EDIT PROFILE BAND</button>
                  <button onClick={() => { setShowAuthModal(false); openBandWorkspace('album'); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center', color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>UPLOAD ALBUM DIGITAL</button>
                  <button onClick={() => { setShowAuthModal(false); openBandWorkspace('merch'); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center', color: '#F8F7F8', borderColor: 'rgba(115,187,201,0.3)' }}>KELOLA MERCHANDISE</button>
                  <button onClick={() => setAuthType('band')} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center' }}>📌 UPLOAD PAMFLET EVENT</button>
                </div>
              </div>
            )}

            {/* DASHBOARD PROFILE AUDIENCE */}
            {authType === 'profil_audience' && (
              <div>
                <h3 style={{ color: '#F8F7F8', fontSize: '18px', fontWeight: '900', margin: '0 0 4px 0' }}>🎧 AUDIENCE PROFILE ARCHIVE</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 20px 0' }}>Daftar kepemilikan rilisan lagu & tanda hak dukungan skena</p>
                <div style={{ backgroundColor: '#080202', padding: '16px', borderRadius: '16px', border: '1px solid rgba(241,212,229,0.14)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#73BBC9', fontWeight: '900' }}>📚 MY MUSIC ARCHIVE (0)</h4>
                  <p style={{ color: '#F8F7F8', fontSize: '12px', margin: 0, textAlign: 'center', padding: '20px 0' }}>Belum ada riwayat pembelian rilisan lagu, breo!</p>
                </div>
              </div>
            )}

            {/* FORM INPUT SUNTIK ACARA GIGS */}
            {/* UPDATE FORM SUNTIK POSTER ACARA + DATA LENGKAP */}
            {authType === 'band' && (
              <form onSubmit={handleBandSubmit}>
                <h3 style={{ color: '#73BBC9', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '900' }}>📌 UPLOAD PAMFLET EVENT</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', margin: '0 0 18px 0', lineHeight: 1.4 }}>Pamflet masuk antrean kurasi WiSpace dulu. Setelah admin approve, baru tampil di homepage.</p>
                <input type="text" placeholder="NAMA ACARA CONCERT" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="KOTA PELAKSANAAN" value={newCity} onChange={(e) => setNewCity(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="GENRE / SUB-SKENA (Contoh: Punk, Hardcore, Indie)" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="HTM (Contoh: FREE / Rp 50.000)" value={newHtm} onChange={(e) => setNewHtm(formatOptionalRupiahText(e.target.value))} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="CONTACT PERSON (WA/IG: @bandmu)" value={newCp} onChange={(e) => setNewCp(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <label style={{ display: 'block', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleGigPosterImport} style={{ display: 'none' }} />
                  <div style={{ minHeight: '180px', border: '1px dashed rgba(115,187,201,0.45)', borderRadius: '16px', backgroundColor: '#080202', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    {newPosterImage ? (
                      <img src={newPosterImage} alt="Preview pamflet event" style={{ width: '100%', height: '100%', maxHeight: '260px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <p style={{ color: '#73BBC9', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>UPLOAD GAMBAR PAMFLET</p>
                        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>Klik untuk pilih JPG, PNG, atau WEBP. Max 2MB.</p>
                      </div>
                    )}
                  </div>
                </label>
                {newPosterName && <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', margin: '-4px 0 12px 0' }}>FILE: {newPosterName}</p>}
                {newPosterNotice && <p style={{ color: newPosterNotice.includes('Ideal') ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.45, margin: '-4px 0 12px 0' }}>{newPosterNotice}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'free' ? '1px solid rgba(241,212,229,0.62)' : '1px solid #F1D4E5', backgroundColor: newGigRequestType === 'free' ? 'rgba(241,212,229,0.12)' : '#080202', color: newGigRequestType === 'free' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE BULLETIN</button>
                  <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'exclusive' ? '1px solid #73BBC9' : '1px solid #F1D4E5', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(115,187,201,0.14)' : '#080202', color: newGigRequestType === 'exclusive' ? '#73BBC9' : 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXCLUSIVE SLIDE</button>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#080202', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(115,187,201,0.32)' : 'rgba(241,212,229,0.24)'}`, borderRadius: '14px', marginBottom: '18px' }}>
                  <p style={{ color: '#F8F7F8', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE SLIDE BERBAYAR' : 'FREE BULLETIN GRATIS'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{newGigRequestType === 'exclusive' ? `Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} / 10 hari. Admin approve konten dulu, lalu user bayar, lalu admin activate.` : 'Masuk daftar bulletin gigs homepage setelah admin approve.'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '10px', fontWeight: '900', lineHeight: 1.4, margin: '8px 0 0 0' }}>MASA TAYANG: 10 HARI SEJAK ADMIN APPROVE</p>
                  <p style={{ color: '#73BBC9', fontSize: '10px', fontWeight: '900', lineHeight: 1.4, margin: '8px 0 0 0' }}>UKURAN: {posterUploadGuide.size} / {posterUploadGuide.ratio}</p>
                </div>
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' }}>KIRIM KE ANTREAN KURASI</button>
              </form>
            )}

            {/* FORM INPUT SUNTIK FILE DATA LAGU */}
            {authType === 'upload_lagu' && (
              <form onSubmit={handleTrackSubmit}>
                <h3 style={{ color: '#73BBC9', margin: '0 0 20px 0', fontSize: '16px', fontWeight: '900' }}>🎵 SUNTIK RILISAN LAGU BARU</h3>
                <input type="text" placeholder="NAMA BAND" value={trackBand} onChange={(e) => setTrackBand(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="JUDUL SINGLE / LAGU" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="url" placeholder="LINK AUDIO CLOUD URL (MP3)" value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} required style={{ width: '100%', backgroundColor: '#080202', border: '1px solid rgba(241,212,229,0.14)', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#F8F7F8', marginBottom: '20px', boxSizing: 'border-box' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#73BBC9', color: '#080202', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' }}>LUNCURKAN RILISAN BARU</button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

