import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
// IMPOR IKON VEKTOR CYBER-LINE MINIMALIS (Poin 1)
import { Search, ShoppingBag, Radio, User, LogOut, AlertTriangle, FileText, DollarSign, ShieldCheck, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const fetchCloudData = async () => {
  const { data: gigsData } = await supabase.from('gigs').select('*').order('created_at', { ascending: false });
  const { data: tracksData } = await supabase.from('tracks').select('*').order('created_at', { ascending: false }).limit(10);
  const { data: bandProfilesData, error: bandProfilesError } = await supabase.from('band_profiles').select('*').order('updated_at', { ascending: false });
  const { data: releasesData, error: releasesError } = await supabase.from('releases').select('*, release_tracks(*)').order('created_at', { ascending: false });
  const { data: articlesData, error: articlesError } = await supabase.from('band_articles').select('*').order('created_at', { ascending: false });
  const { data: merchData, error: merchError } = await supabase.from('merch_items').select('*').order('created_at', { ascending: false });
  const { data: commentsData, error: commentsError } = await supabase.from('article_comments').select('*').order('created_at', { ascending: false });

  return {
    gigsData: gigsData || [],
    tracksData: tracksData || [],
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
const getGigDate = (gig) => gig?.date || getGigMeta(gig, 'date', 'Tanggal menyusul');
const getGigHtm = (gig) => gig?.htm || getGigMeta(gig, 'htm', 'Info HTM menyusul');
const getGigCp = (gig) => gig?.cp || getGigMeta(gig, 'cp', 'CP menyusul');
const formatDisplayDate = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '';
const getGigApprovedUntil = (gig) => gig?.approved_until ? formatDisplayDate(gig.approved_until) : '';
const getGigApprovedAt = (gig) => formatDisplayDate(gig?.approved_at || gig?.updated_at || gig?.created_at);
const isApprovedHomepageGig = (gig) => ['approved', 'approved_free', 'approved_exclusive'].includes(gig?.status);
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
  approved: '#39ff14',
  approved_free: '#39ff14',
  approved_waiting_payment: '#ffcc00',
  paid_waiting_activation: '#00d2ff',
  approved_exclusive: '#00d2ff',
  rejected: '#ff3333',
  removed: '#777'
}[status] || '#ffcc00');
const isMissingColumnError = (error) => {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('could not find') || message.includes('schema cache') || message.includes('does not exist');
};
const BAND_PROFILE_STORAGE_PREFIX = 'wispace_band_profile';
const BAND_AGREEMENT_STORAGE_PREFIX = 'wispace_band_agreement';
const BAND_ARTICLES_STORAGE_PREFIX = 'wispace_band_articles';
const BAND_MERCH_STORAGE_PREFIX = 'wispace_band_merch';
const BAND_SUBSCRIPTIONS_STORAGE_PREFIX = 'wispace_band_subscriptions';
const BAND_SUBSCRIBER_COUNT_PREFIX = 'wispace_band_subscriber_count';
const BAND_NOTIFICATIONS_STORAGE_PREFIX = 'wispace_band_notifications';
const PUBLIC_BAND_REGISTRY_STORAGE_KEY = 'wispace_public_band_registry';
const PUBLIC_RELEASE_REGISTRY_STORAGE_KEY = 'wispace_public_release_registry';
const PUBLIC_ARTICLE_REGISTRY_STORAGE_KEY = 'wispace_public_article_registry';
const PUBLIC_MERCH_REGISTRY_STORAGE_KEY = 'wispace_public_merch_registry';
const PUBLIC_TRANSACTION_LEDGER_STORAGE_KEY = 'wispace_public_transaction_ledger';
const ARTICLE_COMMENTS_STORAGE_KEY = 'wispace_article_comments';
const CONTENT_REPORTS_STORAGE_KEY = 'wispace_content_reports';
const AUDIENCE_PROFILE_STORAGE_PREFIX = 'wispace_audience_profile';
const AUDIENCE_LIBRARY_STORAGE_PREFIX = 'wispace_audience_library';
const BAND_PHOTO_MAX_SIZE = 1 * 1024 * 1024;
const BAND_COVER_MAX_SIZE = 2 * 1024 * 1024;
const BAND_PREVIEW_MAX_CHARS = 3_250_000;
const FONT_STACK = "'Elms Sans', 'ElmsSans', 'Inter', 'Segoe UI', Arial, sans-serif";
const EXCLUSIVE_POSTER_SLOT_FEE = 30000;

const createClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizePriceValue = (value) => {
  const parsedValue = Number(String(value || '').replace(/[^\d]/g, ''));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const createEmptyAudienceProfile = () => ({
  displayName: '',
  city: '',
  favoriteGenre: '',
  contact: '',
  photoName: '',
  photoPreview: ''
});

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

const loadArticleComments = () => {
  const comments = readLocalJson(ARTICLE_COMMENTS_STORAGE_KEY);
  return comments && typeof comments === 'object' && !Array.isArray(comments) ? comments : {};
};

const saveArticleComments = (comments) => {
  window.localStorage.setItem(ARTICLE_COMMENTS_STORAGE_KEY, JSON.stringify(comments));
};

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
  imageName: row.image_name || '',
  imagePreview: row.image_preview || '',
  genre: row.genre || 'Indie',
  city: row.city || 'Indonesia',
  isActive: row.is_active !== false,
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

const isImageTooLarge = (file, maxSize) => file.size > maxSize;

const formatFileSize = (size) => `${(size / (1024 * 1024)).toFixed(1)}MB`;

const clearFileInput = (event) => {
  event.target.value = '';
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
  const [hoveredCard, setHoveredCard] = useState(null);
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
  const [adminError, setAdminError] = useState('');

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
  const [showReportMenu, setShowReportMenu] = useState(null); // id gig yang dilaporkan

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
  const [selectedMerchDetail, setSelectedMerchDetail] = useState(null);

  // UPDATE STATE FORM SUNTIK POSTER
  const [newDate, setNewDate] = useState('');
  const [newHtm, setNewHtm] = useState('');
  const [newCp, setNewCp] = useState('');
  const [newGigRequestType, setNewGigRequestType] = useState('free');
  const [newPosterImage, setNewPosterImage] = useState('');
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
  const [albumItems, setAlbumItems] = useState([]);
  const [purchasedAlbums, setPurchasedAlbums] = useState([]);
  const [merchDraft, setMerchDraft] = useState({
    name: '',
    price: '',
    stock: '',
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
  const [articleItems, setArticleItems] = useState([]);
  const [articleComments, setArticleComments] = useState(loadArticleComments);
  const [articleCommentDrafts, setArticleCommentDrafts] = useState({});
  const [contentReports, setContentReports] = useState(loadContentReports);
  const [subscribedBands, setSubscribedBands] = useState([]);
  const [bandSubscriberCount, setBandSubscriberCount] = useState(0);
  const [bandNotifications, setBandNotifications] = useState([]);
  const [publicBandProfiles, setPublicBandProfiles] = useState(loadPublicBandRegistry);
  const [publicArticleItems, setPublicArticleItems] = useState(loadPublicArticleRegistry);
  const [publicMerchItems, setPublicMerchItems] = useState(loadPublicMerchRegistry);
  const [saleTransactions, setSaleTransactions] = useState(loadTransactionLedger);
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
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [messages, setMessages] = useState([
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
  ]);

  // DATA REAL DARI CLOUD
  const [gigs, setGigs] = useState([]);
  const [top10Tracks, setTop10Tracks] = useState([]); 
  const [loading, setLoading] = useState(true);

  const audioRef = useRef(new Audio());
  const timerRef = useRef(null);
  const audioPreviewTimerRef = useRef(null);

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
      isPublished: true,
      updatedAt: new Date().toISOString()
    };

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
        audio_url: track.url || '',
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
            if (trackError && !isMissingColumnError(trackError)) {
              console.warn('Gagal sync track rilisan ke Supabase:', trackError.message);
            }
          });
        }
      });
    }

    return publicRelease;
  }, [bandProfile.city, bandProfile.genre, bandProfile.name, bandProfile.slug, signatureName, userSession]);

  const publishPublicMerch = useCallback((item) => {
    const merchId = item.id || createClientId();
    const bandName = bandProfile.name || signatureName || item.bandName || 'Band WiSpace';
    const publicItem = {
      ...item,
      id: merchId,
      bandName,
      bandSlug: bandProfile.slug || createSlug(bandName),
      genre: bandProfile.genre || item.genre || 'Indie',
      city: bandProfile.city || item.city || 'Indonesia',
      updatedAt: new Date().toISOString()
    };
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
        image_name: publicItem.imageName || '',
        image_preview: publicItem.imagePreview || '',
        genre: publicItem.genre || 'Indie',
        city: publicItem.city || 'Indonesia',
        is_active: true,
        updated_at: new Date().toISOString()
      };

      void supabase.from('merch_items').upsert(merchRow).then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn('Gagal sync merch ke Supabase:', error.message);
        }
      });
    }

    return publicItem;
  }, [bandProfile.city, bandProfile.genre, bandProfile.name, bandProfile.slug, signatureName, userSession]);

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
  }, [bandProfile.city, bandProfile.genre, bandProfile.name, bandProfile.slug, signatureName, userSession]);

  const exclusiveEventBanners = [
    ...gigs
      .filter((gig) => gig.status === 'approved_exclusive')
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
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUserSession(sessionUser);
      setUserRole(resolveUserRole(sessionUser));
      if(!session) { setUserRole(null); setHasSignedContract(false); }
    });
    return () => subscription.unsubscribe();
  }, [resolveUserRole]);

  useEffect(() => {
    if (!userSession) return;

    const restoreTimer = window.setTimeout(() => {
      const storedProfile = loadUserScopedData(BAND_PROFILE_STORAGE_PREFIX, userSession);
      const storedAgreement = loadUserScopedData(BAND_AGREEMENT_STORAGE_PREFIX, userSession);
      const storedArticles = loadUserScopedData(BAND_ARTICLES_STORAGE_PREFIX, userSession);
      const storedMerch = loadUserScopedData(BAND_MERCH_STORAGE_PREFIX, userSession);
      const storedSubscriptions = loadUserScopedData(BAND_SUBSCRIPTIONS_STORAGE_PREFIX, userSession);
      const storedAudienceProfile = loadUserScopedData(AUDIENCE_PROFILE_STORAGE_PREFIX, userSession);
      const storedAudienceLibrary = loadUserScopedData(AUDIENCE_LIBRARY_STORAGE_PREFIX, userSession);

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
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [persistBandProfileLocal, persistUserRole, publishPublicArticle, publishPublicBandProfile, publishPublicMerch, userSession]);

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
    setUserRole(null);
    setHasSignedContract(false);
    setSignatureName('');
    setSubscribedBands([]);
    setAudienceProfile(createEmptyAudienceProfile());
    setPurchasedAlbums([]);
    setSelectedLibraryItemId(null);
    if (window.location.pathname.startsWith('/band/')) {
      window.history.pushState({ page: 'home' }, '', '/');
    }
    setActivePage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminUnlock = (event) => {
    event.preventDefault();
    if (adminPassword === 'wispace2026') {
      setIsAdminUnlocked(true);
      setAdminPassword('');
      setAdminError('');
      return;
    }

    setAdminError('Password admin salah bro.');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const { gigsData, tracksData, bandProfilesData, releasesData, articlesData, merchData, articleCommentsData } = await fetchCloudData();
    setGigs(gigsData);
    setTop10Tracks(tracksData);
    setPublicBandProfiles(bandProfilesData);
    setAlbumItems(releasesData);
    setPublicArticleItems(articlesData);
    setPublicMerchItems(merchData);
    setArticleComments(articleCommentsData);
    savePublicBandRegistry(bandProfilesData);
    savePublicReleaseRegistry(releasesData);
    savePublicArticleRegistry(articlesData);
    savePublicMerchRegistry(merchData);
    saveArticleComments(articleCommentsData);
    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      const { gigsData, tracksData, bandProfilesData, releasesData, articlesData, merchData, articleCommentsData } = await fetchCloudData();
      if (!isActive) return;

      setGigs(gigsData);
      setTop10Tracks(tracksData);
      setPublicBandProfiles(bandProfilesData);
      setAlbumItems(releasesData);
      setPublicArticleItems(articlesData);
      setPublicMerchItems(merchData);
      setArticleComments(articleCommentsData);
      savePublicBandRegistry(bandProfilesData);
      savePublicReleaseRegistry(releasesData);
      savePublicArticleRegistry(articlesData);
      savePublicMerchRegistry(merchData);
      saveArticleComments(articleCommentsData);
      setLoading(false);
    };

    loadInitialData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (exclusiveEventBanners.length === 0) return undefined;

    timerRef.current = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % exclusiveEventBanners.length);
    }, 6500);

    return () => window.clearInterval(timerRef.current);
  }, [exclusiveEventBanners.length]);

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
        setActivePage('audience_profile');
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
    setActivePage('audience_profile');
    alert('Selamat! Akun kasta Audience lu siap berburu rilisan!');
  };

  const handleAudienceProfileSave = (event) => {
    event.preventDefault();
    persistAudienceProfileLocal(audienceProfile);
    alert('Profile audience tersimpan sebagai draft privat. Nanti ini kita sambungkan ke table audience_profiles di Supabase.');
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
    setViewedBandSlug(getBandProfileSlug(profile));
    setIsViewingOwnBandProfile(isOwnerView);
    setActivePage('band_public');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateInternalPage = (page, options = {}) => {
    if (window.location.pathname.startsWith('/band/')) {
      window.history.pushState({ page }, '', '/');
    }
    setSelectedGigDetail(null);
    setSelectedPosterPreview(null);
    setActivePage(page);
    if (options.exploreTab) setExploreTab(options.exploreTab);
    if (options.clearSearch) setSearchTerm('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setNewPosterName('');
      setNewPosterNotice('');
      setShowAuthModal(false); 
      alert(`Poster masuk antrean kurasi admin sebagai ${newGigRequestType === 'exclusive' ? 'exclusive slide' : 'free bulletin'}!`); 
      fetchData(); 
    }
  };

  const handleGigPosterImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('File pamflet harus gambar ya bro: JPG, PNG, atau WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB dulu bro, biar upload dan preview tetap ringan.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result;
      setNewPosterImage(imageData);
      setNewPosterName(file.name);
      const previewImage = new Image();
      previewImage.onload = () => {
        const ratio = previewImage.width / previewImage.height;
        const isExclusiveFit = ratio >= 1.6 && ratio <= 1.85;
        const isPosterFit = ratio >= 0.72 && ratio <= 0.85;
        const isCurrentFit = newGigRequestType === 'exclusive' ? isExclusiveFit : isPosterFit;
        setNewPosterNotice(isCurrentFit
          ? `Ukuran file kebaca ${previewImage.width} x ${previewImage.height}px. Rasio sudah cocok buat ${newGigRequestType === 'exclusive' ? 'exclusive slide' : 'free bulletin'}.`
          : `Ukuran file kebaca ${previewImage.width} x ${previewImage.height}px. Ideal ${newGigRequestType === 'exclusive' ? 'exclusive slide: 1920 x 1080 px / 16:9 landscape' : 'free bulletin: 1080 x 1440 px / 3:4 poster'}.`);
      };
      previewImage.src = imageData;
    };
    reader.readAsDataURL(file);
  };

  const handleScheduleSubmit = (event) => {
    event.preventDefault();
    setBandScheduleItems((current) => [
      {
        id: Date.now(),
        ...scheduleDraft
      },
      ...current
    ]);
    setScheduleDraft({ title: '', venue: '', date: '', htm: '', cp: '' });
    alert('Jadwal manggung masuk ke profile band. Ini tidak tampil di homepage dan tidak masuk kurasi pamflet.');
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
      setTop10Tracks((current) => [
        { id: `preview-${singleTrackId}`, band: publicRelease.bandName, title: trackTitle, url: trackUrl },
        ...current
      ].slice(0, 10));
      setTrackBand('');
      setTrackTitle('');
      setTrackUrl('');
      setShowAuthModal(false);
      alert('Lagu beres mengudara dan sudah masuk ke rilisan single.');
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
      status: 'paid_settled',
      paymentStatus: 'paid',
      payoutStatus: 'platform_income',
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
    const error = isMissingColumnError(firstError)
      ? (await supabase.from('gigs').update({ status: updatePayload.status }).eq('id', id)).error
      : firstError;
    if (!error) {
      setGigs((current) => current.map((gig) => (
        gig.id === id ? { ...gig, ...updatePayload } : gig
      )));
    }
    return error;
  };

  const handleGigModeration = async (id, status) => {
    const approvedUntil = new Date();
    approvedUntil.setDate(approvedUntil.getDate() + 10);
    const approvedAt = new Date().toISOString().slice(0, 10);
    const updatePayload = status === 'approved_exclusive'
      ? { status, approved_at: approvedAt, approved_until: approvedUntil.toISOString().slice(0, 10), payment_status: 'paid', activated_at: new Date().toISOString() }
      : status === 'approved_free'
        ? { status, approved_at: approvedAt, approved_until: approvedUntil.toISOString().slice(0, 10), payment_status: 'not_required' }
        : status === 'approved_waiting_payment'
          ? { status, payment_status: 'awaiting_payment', exclusive_fee: EXCLUSIVE_POSTER_SLOT_FEE }
          : status === 'rejected'
            ? { status, payment_status: 'cancelled' }
            : { status };
    const error = await updateGigStatus(id, updatePayload);
    if (error) alert("Gagal update status pamflet: " + error.message);
    else {
      const message = status === 'approved_free'
        ? 'Pamflet disetujui sebagai event free dan tampil di bulletin homepage selama 10 hari.'
        : status === 'approved_waiting_payment'
          ? `Konten exclusive disetujui. Pamflet belum tayang sampai user menyelesaikan pembayaran Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')}.`
        : status === 'approved_exclusive'
          ? 'Pamflet disetujui sebagai exclusive event dan masuk slot slide besar homepage selama 10 hari.'
          : 'Pamflet ditolak dan tidak akan tampil.';
      alert(message);
      fetchData();
    }
  };

  const handleGigExclusivePayment = async (gig) => {
    const confirmed = window.confirm(`Bayar slot exclusive Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} untuk "${gig.title}"? Ini demo payment dulu.`);
    if (!confirmed) return;

    const paymentReference = `demo-exclusive-${gig.id}-${Date.now()}`;
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

  const handleGigActivateExclusive = async (id) => {
    const approvedUntil = new Date();
    approvedUntil.setDate(approvedUntil.getDate() + 10);
    const approvedAt = new Date().toISOString().slice(0, 10);
    const error = await updateGigStatus(id, {
      status: 'approved_exclusive',
      approved_at: approvedAt,
      approved_until: approvedUntil.toISOString().slice(0, 10),
      payment_status: 'paid',
      activated_at: new Date().toISOString()
    });
    if (error) alert('Gagal activate pamflet exclusive: ' + error.message);
    else {
      alert('Pamflet exclusive aktif dan tampil selama 10 hari.');
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

  const handleBandPhotoImport = (event) => {
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

    const reader = new FileReader();
    reader.onload = () => {
      setBandProfile((current) => {
        const nextProfile = { ...current, photoName: file.name, photoPreview: reader.result };
        persistBandProfileLocal(nextProfile);
        return nextProfile;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAudiencePhotoImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > BAND_PHOTO_MAX_SIZE) {
      alert('Foto profile maksimal 1MB dulu bro, biar app tetap ringan.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAudienceProfile((current) => {
        const nextProfile = { ...current, photoName: file.name, photoPreview: reader.result };
        persistAudienceProfileLocal(nextProfile);
        return nextProfile;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBandCoverImport = (event) => {
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

    const reader = new FileReader();
    reader.onload = () => {
      setBandProfile((current) => {
        const nextProfile = { ...current, coverName: file.name, coverPreview: reader.result };
        persistBandProfileLocal(nextProfile);
        return nextProfile;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAlbumCoverImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAlbumDraft((current) => {
      if (current.coverPreview) URL.revokeObjectURL(current.coverPreview);
      return { ...current, coverName: file.name, coverPreview: URL.createObjectURL(file) };
    });
  };

  const handleAlbumAudioImport = (event) => {
    const files = Array.from(event.target.files || []);
    setAlbumDraft((current) => ({
      ...current,
      audioFiles: files.map((file) => ({
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file),
        price: ''
      })),
      freeTrackIndex: ''
    }));
  };

  const updateAlbumTrackPrice = (index, price) => {
    setAlbumDraft((current) => ({
      ...current,
      audioFiles: current.audioFiles.map((file, fileIndex) => (
        fileIndex === index ? { ...file, price } : file
      ))
    }));
  };

  const handleMerchImageImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMerchDraft((current) => {
      if (current.imagePreview) URL.revokeObjectURL(current.imagePreview);
      return { ...current, imageName: file.name, imagePreview: URL.createObjectURL(file) };
    });
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
    alert('Profile band tersimpan dan aman saat refresh di browser ini. Step production berikutnya: sambungkan ke Supabase Storage + table band_profiles.');
  };

  const handleAlbumDraftSubmit = (event) => {
    event.preventDefault();
    if (!albumDraft.accepted) return alert('Centang agreement upload album dulu bro.');
    if (!albumDraft.signature.trim()) return alert('Isi nama penanggung jawab / tanda tangan digital dulu bro.');
    if (albumDraft.audioFiles.length === 0) return alert('Import minimal satu file MP3/WAV dulu bro.');

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
        title: file.name.replace(/\.(mp3|wav)$/i, ''),
        fileName: file.name,
        size: file.size,
        url: file.url,
        price: file.price,
        freeFull: String(index) === String(albumDraft.freeTrackIndex)
      })),
      bandName: bandProfile.name || signatureName || 'Band WiSpace',
      city: bandProfile.city || 'Indonesia',
      genre: bandProfile.genre || 'Indie',
      signedBy: albumDraft.signature
    };

    const publicAlbum = publishPublicRelease(nextAlbum);
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
    alert('Album masuk draft rilisan dan sudah muncul di Explore. Nanti ini akan lanjut ke storage, agreement log, dan checkout.');
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
    const grossAmount = normalizePriceValue(sale.amount);
    const platformFee = Math.round(grossAmount * 0.2);
    const bandNet = Math.max(0, grossAmount - platformFee);
    const sellerBandName = sale.sellerBandName || bandProfile.name || signatureName || 'Band WiSpace';
    const sellerBandSlug = sale.sellerBandSlug || bandProfile.slug || createSlug(sellerBandName);
    const nextTransaction = {
      id: createClientId(),
      productType: sale.productType || 'release',
      productTitle: sale.productTitle || 'Transaksi WiSpace',
      sellerBandName,
      sellerBandSlug,
      buyerName: audienceProfile.displayName || userSession?.email?.split('@')[0] || 'Audience WiSpace',
      buyerEmail: userSession?.email || '',
      grossAmount,
      platformFee,
      bandNet,
      revenueShare: '80/20',
      status: 'paid_settled',
      paymentStatus: 'paid',
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
        buyer_user_id: userSession.id,
        seller_band_slug: nextTransaction.sellerBandSlug,
        seller_band_name: nextTransaction.sellerBandName,
        buyer_name: nextTransaction.buyerName,
        buyer_email: nextTransaction.buyerEmail,
        product_type: nextTransaction.productType,
        product_title: nextTransaction.productTitle,
        gross_amount: nextTransaction.grossAmount,
        platform_fee: nextTransaction.platformFee,
        band_net: nextTransaction.bandNet,
        revenue_share: nextTransaction.revenueShare,
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

  const handlePurchaseAlbum = (album) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli rilisan dan masukin album ke library.');
      return;
    }

    const alreadyOwned = purchasedAlbums.some((item) => item.id === album.id);
    if (alreadyOwned) {
      setActivePage('audience_library');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPurchasedAlbums((current) => {
      const nextLibrary = [{ ...album, purchasedAt: 'Baru saja' }, ...current];
      persistAudienceLibraryLocal(nextLibrary);
      return nextLibrary;
    });
    const sale = recordBandSale({
      productType: 'album',
      productTitle: album.title,
      amount: album.price,
      sellerBandName: album.bandName,
      sellerBandSlug: album.bandSlug || createSlug(album.bandName || '')
    });
    alert(`${album.title} masuk Library. Gross Rp ${sale.grossAmount.toLocaleString('id-ID')} | WiSpace 20% Rp ${sale.platformFee.toLocaleString('id-ID')} | Band net Rp ${sale.bandNet.toLocaleString('id-ID')}.`);
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
      setActivePage('audience_library');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPurchasedAlbums((current) => {
      const nextLibrary = [
        {
          ...album,
          id: trackPurchaseId,
          title: track.title,
        price: track.price,
        trackCount: 1,
        purchaseType: 'track',
        parentAlbumTitle: album.title,
          tracks: [track],
          purchasedAt: 'Baru saja'
        },
        ...current
      ];
      persistAudienceLibraryLocal(nextLibrary);
      return nextLibrary;
    });
    const sale = recordBandSale({
      productType: 'track',
      productTitle: track.title,
      amount: track.price,
      sellerBandName: album.bandName,
      sellerBandSlug: album.bandSlug || createSlug(album.bandName || '')
    });
    alert(`${track.title} masuk Library sebagai track. Gross Rp ${sale.grossAmount.toLocaleString('id-ID')} | WiSpace 20% Rp ${sale.platformFee.toLocaleString('id-ID')} | Band net Rp ${sale.bandNet.toLocaleString('id-ID')}.`);
  };

  const handlePurchaseMerch = (item) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli merchandise band.');
      return;
    }

    const sale = recordBandSale({
      productType: 'merch',
      productTitle: item.name,
      amount: item.price,
      sellerBandName: item.bandName,
      sellerBandSlug: item.bandSlug || createSlug(item.bandName || '')
    });
    alert(`${item.name} masuk draft order merch. Gross Rp ${sale.grossAmount.toLocaleString('id-ID')} | WiSpace 20% Rp ${sale.platformFee.toLocaleString('id-ID')} | Band net Rp ${sale.bandNet.toLocaleString('id-ID')}. Shipping/tracking nanti disambung ke API ekspedisi.`);
  };

  const handleMerchDraftSubmit = (event) => {
    event.preventDefault();
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
      description: '',
      imageName: '',
      imagePreview: ''
    });
    alert('Merch masuk etalase draft. Nanti step berikutnya kita sambungkan ke Supabase + order flow.');
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
    alert('Artikel masuk draft publish dan sudah tampil di page Artikel.');
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
    alert('Artikel admin WiSpace sudah publish ke halaman Artikel.');
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
    alert('Laporan masuk ke dashboard admin WiSpace.');
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

  const handleMessageSubmit = (event) => {
    event.preventDefault();
    const nextMessage = {
      id: Date.now(),
      ...messageDraft,
      scope: 'band',
      read: false,
      createdAt: 'Baru saja'
    };

    setMessages((current) => [nextMessage, ...current]);
    setMessageDraft({ sender: '', contact: '', subject: '', body: '' });
    alert('Pesan terkirim ke inbox. Nanti ini kita sambungkan ke Supabase realtime notifications.');
  };

  const markMessagesAsRead = () => {
    setMessages((current) => current.map((message) => (
      isBandAccount || message.scope === 'audience' ? { ...message, read: true } : message
    )));
  };

  const handleReplySubmit = (event, message) => {
    event.preventDefault();
    if (!replyDraft.trim()) return alert('Isi balasan dulu bro.');

    setMessages((current) => current.map((item) => (
      item.id === message.id ? { ...item, read: true, replied: true, lastReply: replyDraft } : item
    )));
    setReplyDraft('');
    setActiveReplyId(null);
    alert(`Balasan ke ${message.sender} tersimpan. Nanti ini dikirim lewat sistem message WiSpace.`);
  };

  const handleKirimLaporan = (id, jenis) => {
    alert(`⚠️ LAPORAN DIKUNCI! Acara ID: ${id} dilaporkan atas kasus: [${jenis.toUpperCase()}]. Admin WiSpace akan segera mengecek legalitasnya.`);
    setShowReportMenu(null);
  };

  // PLAYER SYSTEM
  const handlePlayTrack = (track, queue = []) => {
    if (!track?.url) {
      alert('File audio belum tersedia buat preview bro.');
      return;
    }

    window.clearTimeout(audioPreviewTimerRef.current);

    const nextQueue = queue.length ? queue : (playerQueue.length ? playerQueue : [track]);
    const nextQueueIndex = Math.max(0, nextQueue.findIndex((item) => item.id === track.id));

    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    audioRef.current.src = track.url;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    setActiveTrack(track);
    setIsPlaying(true);
    setPlayerQueue(nextQueue);
    setPlayerQueueIndex(nextQueueIndex);

    audioRef.current.onended = () => setIsPlaying(false);

    if (!track.freeFull) {
      audioPreviewTimerRef.current = window.setTimeout(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }, 30000);
    }
  };

  const buildLibraryPlaybackTrack = (track, libraryItem = selectedLibraryItem) => ({
    ...track,
    id: `library-${libraryItem?.id || 'item'}-${track.id}`,
    albumTitle: libraryItem?.parentAlbumTitle || libraryItem?.title || track.albumTitle,
    albumCover: libraryItem?.coverPreview || track.albumCover,
    freeFull: true
  });

  const handlePlayLibraryTrack = (track, libraryItem = selectedLibraryItem, tracks = selectedLibraryTracks) => {
    const libraryQueue = (tracks.length ? tracks : [track]).map((item) => buildLibraryPlaybackTrack(item, libraryItem));
    handlePlayTrack({
      ...track,
      id: `library-${libraryItem?.id || 'item'}-${track.id}`,
      albumTitle: libraryItem?.parentAlbumTitle || libraryItem?.title || track.albumTitle,
      albumCover: libraryItem?.coverPreview || track.albumCover,
      freeFull: true
    }, libraryQueue);
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

  const handlePlayerStep = (direction) => {
    if (playerQueue.length <= 1) return;
    const nextIndex = (playerQueueIndex + direction + playerQueue.length) % playerQueue.length;
    const nextTrack = playerQueue[nextIndex];
    setPlayerQueueIndex(nextIndex);
    handlePlayTrack(nextTrack, playerQueue);
  };

  const approvedFreeGigs = gigs.filter((gig) => gig.status === 'approved' || gig.status === 'approved_free');
  const approvedExclusiveGigs = gigs.filter((gig) => gig.status === 'approved_exclusive');
  const exclusiveWaitingPaymentGigs = gigs.filter((gig) => gig.status === 'approved_waiting_payment');
  const exclusivePaidWaitingActivationGigs = gigs.filter((gig) => gig.status === 'paid_waiting_activation');
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
  const filteredTracks = top10Tracks.filter((track) => matchesSearch(track.title, track.band));
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
  const quickSearchResults = normalizedSearchTerm ? [
    ...filteredAlbums.slice(0, 3).map((album) => ({
      id: `album-${album.id}`,
      type: 'RILISAN',
      title: album.title,
      meta: `${album.bandName || 'Band WiSpace'} / ${album.genre || 'Indie'} / ${album.trackCount || 0} track`,
      onSelect: () => navigateInternalPage('explore', { exploreTab: 'rilisan' })
    })),
    ...filteredAlbumTracks.slice(0, 3).map((track) => ({
      id: `track-${track.albumId}-${track.id}`,
      type: 'LAGU',
      title: track.title,
      meta: `${track.bandName || 'Band WiSpace'} / ${track.albumTitle || 'Rilisan'} / ${track.freeFull ? 'free full' : 'preview'}`,
      onSelect: () => {
        navigateInternalPage('explore', { exploreTab: 'rilisan' });
        if (track.url) handlePlayTrack(track, filteredAlbumTracks);
      }
    })),
    ...filteredBandProfiles.slice(0, 3).map((profile) => ({
      id: `band-${profile.slug || profile.name}`,
      type: 'BAND',
      title: profile.name,
      meta: `${profile.city || 'Indonesia'} / ${profile.genre || 'Indie'} / ${profile.slug || createSlug(profile.name)}`,
      onSelect: () => openBandPublicProfile(false, profile)
    })),
    ...filteredArticles.slice(0, 3).map((article) => ({
      id: `article-${article.id}`,
      type: 'ARTIKEL',
      title: article.title,
      meta: `${article.category || 'Update Band'} / ${article.bandName || 'Band WiSpace'}`,
      onSelect: () => navigateInternalPage('explore', { exploreTab: 'artikel' })
    })),
    ...filteredMerchItems.slice(0, 2).map((item) => ({
      id: `merch-${item.id}`,
      type: 'MERCH',
      title: item.name,
      meta: `${item.bandName || 'Band WiSpace'} / Rp ${Number(item.price || 0).toLocaleString('id-ID')}`,
      onSelect: () => navigateInternalPage('explore', { exploreTab: 'merch' })
    }))
  ].slice(0, 10) : [];
  const selectedLibraryItem = purchasedAlbums.find((album) => album.id === selectedLibraryItemId) || purchasedAlbums[0] || null;
  const selectedLibraryTracks = selectedLibraryItem?.tracks?.length
    ? selectedLibraryItem.tracks
    : selectedLibraryItem
      ? [{
          id: `${selectedLibraryItem.id}-fallback`,
          title: selectedLibraryItem.title,
          url: selectedLibraryItem.url,
          price: selectedLibraryItem.price,
          freeFull: true
        }]
      : [];
  const isAdminPage = searchTerm.toLowerCase() === 'adminwispace';
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
  const isExplorePage = activePage === 'explore';
  const isMerchMarketPage = activePage === 'merch_market';
  const isArticlesPage = activePage === 'articles';
  const isBandAccount = userRole === 'musisi';
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
  const displayBandMerchItems = publicMerchList.filter((item) => (
    item.bandSlug === currentBandSlug || item.bandName === displayBandProfile.name
  ));
  const financeTransactions = saleTransactions.filter((transaction) => (
    transaction.sellerBandSlug === currentBandSlug || transaction.sellerBandName === displayBandProfile.name || transaction.sellerBandName === bandProfile.name
  ));
  const bandBalance = financeTransactions.reduce((total, transaction) => total + Number(transaction.bandNet || 0), 0);
  const bandGrossRevenue = financeTransactions.reduce((total, transaction) => total + Number(transaction.grossAmount || 0), 0);
  const adminMerchFeeRevenue = saleTransactions
    .filter((transaction) => transaction.productType === 'merch')
    .reduce((total, transaction) => total + Number(transaction.platformFee || 0), 0);
  const adminReleaseFeeRevenue = saleTransactions
    .filter((transaction) => ['album', 'track'].includes(transaction.productType))
    .reduce((total, transaction) => total + Number(transaction.platformFee || 0), 0);
  const exclusivePosterTransactions = saleTransactions.filter((transaction) => transaction.productType === 'exclusive_poster');
  const adminExclusivePosterRevenue = Math.max(
    exclusivePosterTransactions.reduce((total, transaction) => total + Number(transaction.platformFee || transaction.grossAmount || 0), 0),
    paidExclusivePosterGigs.length * EXCLUSIVE_POSTER_SLOT_FEE
  );
  const adminExclusivePosterPaidCount = Math.max(exclusivePosterTransactions.length, paidExclusivePosterGigs.length);
  const openContentReports = contentReports.filter((report) => report.status !== 'resolved');
  const recentArticleComments = Object.entries(articleComments)
    .flatMap(([articleId, comments]) => (comments || []).map((comment) => ({
      ...comment,
      articleId,
      articleTitle: publicArticleList.find((article) => String(article.id) === String(articleId))?.title || 'Artikel WiSpace'
    })))
    .slice(0, 12);
  const isSubscribedToCurrentBand = subscribedBands.some((item) => item.slug === currentBandSlug);
  const unreadBandNotifications = bandNotifications.filter((notification) => !notification.read).length;
  const visibleMessages = isBandAccount ? messages : messages.filter((message) => message.scope === 'audience');
  const unreadMessages = visibleMessages.filter((message) => !message.read).length;

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
    const syncBandRoute = () => {
      const bandRouteMatch = window.location.pathname.match(/^\/band\/([^/]+)/);
      if (!bandRouteMatch) return;

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
  }, [bandProfile.name, bandProfile.slug, isBandAccount, signatureName]);

  const accountDisplayName = isBandAccount
    ? (bandProfile.name || signatureName || 'BAND')
    : (audienceProfile.displayName || userSession?.email?.split('@')[0] || 'USER');
  const accountPhoto = isBandAccount ? bandProfile.photoPreview : audienceProfile.photoPreview;
  const renderProfileChip = (avatarSize = 20, maxLabelWidth = '120px') => (
    <>
      <span style={{ width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: '9999px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.65)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {accountPhoto ? (
          <img src={accountPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <User size={Math.max(12, avatarSize - 8)} color="#00d2ff" />
        )}
      </span>
      <span style={{ maxWidth: maxLabelWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {accountDisplayName.toUpperCase()}
      </span>
    </>
  );
  const renderGigPosterImage = (gig, style, label = 'NO PAMFLET') => (
    gig?.image ? (
      <img src={gig.image} alt="" style={style} />
    ) : (
      <div style={{ ...style, display: 'grid', placeItems: 'center', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.08)', color: '#333', fontSize: '10px', fontWeight: '900', textAlign: 'center' }}>
        {label}
      </div>
    )
  );

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
    setActivePage('audience_profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // STYLING INTERFACE ASYMMETRIC ROUNDED `16PX`
  const glassStyle = (id) => ({
    background: 'linear-gradient(180deg, rgba(18, 18, 18, 0.78), rgba(8, 8, 8, 0.88))',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    borderRadius: '14px',
    border: hoveredCard === id ? '1px solid rgba(0, 210, 255, 0.34)' : '1px solid rgba(255, 255, 255, 0.075)',
    boxShadow: hoveredCard === id ? '0 22px 70px rgba(0, 0, 0, 0.72), 0 0 28px rgba(0, 210, 255, 0.18)' : '0 18px 48px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255,255,255,0.035)',
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease'
  });

  const glassButtonStyle = {
    background: 'rgba(255, 255, 255, 0.035)', border: '1px solid rgba(0, 210, 255, 0.28)', color: '#00d2ff',
    cursor: 'pointer', borderRadius: '12px', fontWeight: '900', letterSpacing: '0.5px', fontFamily: FONT_STACK, transition: 'all 0.2s ease'
  };

  const formInputStyle = {
    width: '100%',
    backgroundColor: '#000',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '13px',
    color: '#fff',
    fontFamily: FONT_STACK,
    boxSizing: 'border-box',
    outline: 'none'
  };

  const isCompactLayout = viewportWidth < 820;
  const isTinyLayout = viewportWidth < 560;
  const innerPagePadding = isTinyLayout ? '88px 16px 20px' : isCompactLayout ? '90px 20px 24px' : '92px 30px 34px';
  const splitGridColumns = isCompactLayout ? '1fr' : 'minmax(280px, 1.25fr) minmax(260px, 0.75fr)';
  const studioGridColumns = isCompactLayout ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))';
  const publicBandHeroColumns = isTinyLayout ? '1fr' : '136px minmax(0, 1fr)';
  const publicBandAvatarSize = isTinyLayout ? 104 : 136;
  const libraryDetailGridColumns = isCompactLayout ? '1fr' : 'minmax(280px, 1.1fr) minmax(280px, 0.9fr)';
  const articleGridColumns = isCompactLayout ? '1fr' : 'minmax(0, 1.4fr) minmax(260px, 0.6fr)';
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
    ...glassStyle('floating-badge'),
    display: 'flex',
    alignItems: 'center',
    flexWrap: isTinyLayout ? 'wrap' : 'nowrap',
    gap: isTinyLayout ? '6px' : '0',
    padding: isTinyLayout ? '8px 10px' : '8px 16px',
    background: 'linear-gradient(180deg, rgba(7,7,7,0.92), rgba(0,0,0,0.86))',
    border: '1px solid rgba(0,210,255,0.32)',
    borderRadius: '14px',
    width: isTinyLayout ? '100%' : 'auto',
    boxSizing: 'border-box'
  };
  const homeHeroContentStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    background: 'radial-gradient(circle at 18% 72%, rgba(0,210,255,0.18), transparent 28%), linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.36) 54%, rgba(0,0,0,0.12) 100%), linear-gradient(to top, rgba(3,3,3,0.98) 0%, rgba(3,3,3,0.45) 56%, rgba(0,0,0,0.06) 100%)',
    padding: isTinyLayout ? '24px 18px' : '46px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end'
  };
  const bulletinGridStyle = isTinyLayout
    ? {
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: 'calc((100vw - 48px) / 2)',
        gridTemplateRows: '1fr',
        gap: '12px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none'
      }
    : {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '24px'
      };
  const bulletinCardStyle = {
    padding: isTinyLayout ? '10px' : '14px',
    background: 'linear-gradient(180deg, rgba(14,14,14,0.92), rgba(4,4,4,0.98))',
    position: 'relative',
    cursor: 'pointer',
    scrollSnapAlign: 'start',
    minWidth: 0,
    borderRadius: '12px'
  };
  const ownerActionsPanelStyle = {
    ...glassStyle('band-owner-actions'),
    padding: isTinyLayout ? '9px' : '10px',
    backgroundColor: '#080808',
    marginBottom: isTinyLayout ? '16px' : '18px',
    display: showBandOwnerControls ? 'block' : 'none',
    borderRadius: '12px'
  };
  const ownerActionsGridStyle = {
    display: 'grid',
    gridTemplateColumns: isTinyLayout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(118px, 1fr))',
    gap: isTinyLayout ? '7px' : '8px'
  };
  const ownerActionButtonStyle = {
    ...glassButtonStyle,
    padding: isTinyLayout ? '8px 7px' : '9px 8px',
    fontSize: '10px',
    lineHeight: 1.15,
    borderRadius: '10px',
    minHeight: isTinyLayout ? '34px' : '36px'
  };

  const pageShellStyle = {
    minHeight: 'calc(100vh - 40px)',
    padding: innerPagePadding,
    background: 'linear-gradient(180deg, rgba(7,7,7,0.96) 0%, rgba(2,2,2,0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)'
  };

  const pageHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '24px',
    marginBottom: '34px',
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '22px'
  };

  const eyebrowStyle = {
    color: '#a8f1ff',
    fontSize: '11px',
    fontWeight: '900',
    letterSpacing: '1.4px',
    margin: '0 0 9px 0'
  };

  const pageTitleStyle = {
    color: '#fff',
    fontSize: 'clamp(30px, 5vw, 48px)',
    fontWeight: '900',
    margin: 0,
    lineHeight: 0.95
  };

  const pageLeadStyle = {
    color: '#8a8a8a',
    fontSize: '14px',
    margin: '12px 0 0 0',
    maxWidth: '760px',
    lineHeight: 1.55
  };

  const sectionHeadingStyle = {
    color: '#f5f5f5',
    fontSize: '15px',
    fontWeight: '900',
    margin: '0 0 16px 0',
    letterSpacing: '1px'
  };

  const exploreCopy = {
    rilisan: {
      eyebrow: 'WISPACE RELEASES',
      title: 'RILISAN DIGITAL',
      lead: 'Katalog album digital dan preview 30 detik dari musisi indie. Cover, harga, genre, dan band dibuat gampang discan.'
    },
    band: {
      eyebrow: 'WISPACE BAND INDEX',
      title: 'BAND DIRECTORY',
      lead: 'Tempat audience, band lain, dan promotor nemu profile band, kontak, rilisan, merch, dan jadwal manggung.'
    },
    artikel: {
      eyebrow: 'WISPACE ARTICLES',
      title: 'ARTIKEL SKENA',
      lead: 'Arsip cerita band, catatan rilisan, interview, dan pergerakan musik independen.'
    },
    merch: {
      eyebrow: 'WISPACE DISTRO',
      title: 'MERCH BAND',
      lead: 'Etalase merchandise band: kaos, CD, kaset, stiker, bundle album, dan item fisik lain dari komunitas.'
    }
  };

  const activeExploreCopy = exploreCopy[exploreTab] || exploreCopy.rilisan;

  return (
    <div style={{ background: 'radial-gradient(circle at 18% 0%, rgba(0,210,255,0.08), transparent 28%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.045), transparent 24%), linear-gradient(180deg, #040404 0%, #010101 100%)', color: '#ffffff', minHeight: '100vh', padding: homeShellPadding, fontFamily: FONT_STACK, boxSizing: 'border-box' }}>
      {!isSupabaseConfigured && (
        <div style={{ position: 'fixed', left: '20px', right: '20px', bottom: '20px', zIndex: 2000, padding: '14px 16px', backgroundColor: 'rgba(255,51,51,0.12)', border: '1px solid rgba(255,51,51,0.45)', borderRadius: '14px', color: '#fff', fontSize: '12px', fontWeight: '900', lineHeight: 1.4, boxShadow: '0 18px 45px rgba(0,0,0,0.45)' }}>
          SUPABASE ENV BELUM DISET DI HOSTING. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Vercel, lalu redeploy.
        </div>
      )}
      
      {/* ========================================================
          FIXED FLOATING BADGE (IKON CYBER-LINE & KONTROL SMART ROLE)
         ======================================================== */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={homeFloatingWrapStyle}>
          <div style={homeFloatingBadgeStyle}>
            <span onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', marginRight: isTinyLayout ? '4px' : '16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>WI.ID UP</span>
            <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan', clearSearch: true })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: isTinyLayout ? '4px' : '12px', fontFamily: FONT_STACK, padding: isTinyLayout ? '6px 4px' : '0', whiteSpace: 'nowrap' }}>EXPLORE</button>
            
            {!userSession ? (
              <>
                <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: isTinyLayout ? '4px' : '12px', fontFamily: FONT_STACK, padding: isTinyLayout ? '6px 4px' : '0', whiteSpace: 'nowrap' }}>LOGIN</button>
                <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'rgba(0, 210, 255, 0.1)', border: '1px solid rgba(0,210,255,0.3)', color: '#00d2ff', borderRadius: '16px', padding: isTinyLayout ? '6px 10px' : '4px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>JOIN</button>
              </>
            ) : (
              <>
                <button onClick={() => { setActivePage('message_center'); markMessagesAsRead(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ position: 'relative', background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', fontFamily: FONT_STACK }}>
                  MESSAGES
                  {unreadMessages > 0 && <span style={{ position: 'absolute', top: '-8px', right: '-10px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#ff3333', color: '#fff', fontSize: '10px', display: 'grid', placeItems: 'center', fontWeight: '900' }}>{unreadMessages}</span>}
                </button>
                <button onClick={openProfileModal} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_STACK, minWidth: 0 }}>{renderProfileChip(20, '110px')}</button>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ff3333', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT_STACK }}><LogOut size={13}/> LOGOUT</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isTinyLayout ? '100%' : 'auto', justifyContent: isTinyLayout ? 'flex-end' : 'flex-start' }}>
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearchExpanded(true)} onBlur={() => { if(!searchTerm) setIsSearchExpanded(false); }} style={{ backgroundColor: 'rgba(5, 5, 5, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: isSearchExpanded ? '6px 12px' : '0px', width: isSearchExpanded ? (isTinyLayout ? 'calc(100% - 78px)' : '180px') : '0px', opacity: isSearchExpanded ? 1 : 0, fontSize: '11px', color: '#fff', outline: 'none', fontFamily: FONT_STACK, transition: 'all 0.3s ease', boxSizing: 'border-box' }} />
            <div onClick={() => setIsSearchExpanded(!isSearchExpanded)} style={{ ...glassStyle('search-trigger'), padding: '6px 14px', backgroundColor: '#00d2ff', color: '#000', borderRadius: '16px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={12}/> FIND</div>
          </div>
        </div>
      )}

      {/* FLOATING MENU UNTUK PAGE DALAM */}
      {!isAdminPage && (isBandProfilePage || isBandPublicPage || isFinancePage || isGigManagerPage || isMessagePage || isAudienceProfilePage || isAudienceLibraryPage || isExplorePage || isMerchMarketPage || isArticlesPage) && !loading && (
        <div style={{ position: 'fixed', top: isTinyLayout ? '14px' : '24px', left: '50%', zIndex: 999, display: 'flex', alignItems: 'center', gap: isTinyLayout ? '6px' : '10px', padding: isTinyLayout ? '7px 8px' : '8px 10px', transform: 'translate(-50%, 0)', opacity: 1, pointerEvents: 'auto', transition: 'all 0.35s ease', backgroundColor: 'rgba(5, 5, 5, 0.88)', border: '1px solid rgba(0,210,255,0.35)', borderRadius: '16px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 18px 45px rgba(0,0,0,0.45)', width: isTinyLayout ? 'calc(100vw - 24px)' : 'auto', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button onClick={() => navigateInternalPage('home', { clearSearch: true })} style={{ background: 'transparent', border: 'none', color: '#00d2ff', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>WISPACE</button>
          {[
            ['rilisan', 'RILISAN'],
            ['band', 'BAND'],
            ['artikel', 'ARTIKEL'],
            ['merch', 'MERCH']
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => navigateInternalPage('explore', { exploreTab: tab, clearSearch: true })}
              style={{ background: activePage === 'explore' && exploreTab === tab ? 'rgba(0,210,255,0.12)' : 'transparent', border: activePage === 'explore' && exploreTab === tab ? '1px solid rgba(0,210,255,0.32)' : '1px solid transparent', borderRadius: '10px', color: activePage === 'explore' && exploreTab === tab ? '#00d2ff' : '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap', padding: '7px 9px' }}
            >
              {label}
            </button>
          ))}
          {userSession && (
            <>
              <button onClick={() => navigateInternalPage('audience_library')} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>LIBRARY</button>
              <button onClick={() => { navigateInternalPage('message_center'); markMessagesAsRead(); }} style={{ position: 'relative', background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}>
                MESSAGES
                {unreadMessages > 0 && <span style={{ position: 'absolute', top: '-8px', right: '-10px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#ff3333', color: '#fff', fontSize: '10px', display: 'grid', placeItems: 'center', fontWeight: '900' }}>{unreadMessages}</span>}
              </button>
            </>
          )}
          <div style={{ position: 'relative', width: isTinyLayout ? '132px' : '190px', maxWidth: isTinyLayout ? '132px' : '30vw', flexShrink: 0 }}>
            <Search size={12} color="#666" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9999px', padding: '7px 10px 7px 28px', color: '#fff', fontSize: '11px', fontWeight: '700', outline: 'none', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
          </div>
          {!userSession ? (
            <>
              <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LOGIN</button>
              <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'rgba(0,210,255,0.12)', border: '1px solid rgba(0,210,255,0.35)', color: '#00d2ff', borderRadius: '12px', padding: '7px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>JOIN</button>
            </>
          ) : (
            <>
              <button onClick={openProfileModal} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_STACK, whiteSpace: 'nowrap', minWidth: 0 }}>{renderProfileChip(20, '110px')}</button>
              <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#ff3333', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT_STACK, whiteSpace: 'nowrap' }}><LogOut size={13}/> LOGOUT</button>
            </>
          )}
        </div>
      )}

      {activeTrack && !loading && (
        <div style={{ position: 'fixed', left: '50%', bottom: isTinyLayout ? '12px' : '20px', zIndex: 1000, transform: 'translateX(-50%)', width: isTinyLayout ? 'calc(100vw - 24px)' : 'min(520px, calc(100vw - 48px))', boxSizing: 'border-box', padding: isTinyLayout ? '9px 10px' : '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', backgroundColor: 'rgba(5,5,5,0.92)', border: '1px solid rgba(0,210,255,0.32)', borderRadius: '16px', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 48px rgba(0,0,0,0.55)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: isPlaying ? '#39ff14' : '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 4px 0' }}>{isPlaying ? 'NOW PLAYING' : 'PAUSED'}</p>
            <h4 style={{ color: '#fff', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', margin: '0 0 3px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(activeTrack.title || 'UNTITLED TRACK').toUpperCase()}</h4>
            <p style={{ color: '#666', fontSize: '11px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(activeTrack.albumTitle || activeTrack.band || activeTrack.bandName || 'WISPACE PLAYER').toUpperCase()}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <button onClick={() => handlePlayerStep(-1)} disabled={playerQueue.length <= 1} title="Previous" style={{ width: '32px', height: '32px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#000', color: playerQueue.length <= 1 ? '#333' : '#fff', display: 'grid', placeItems: 'center', cursor: playerQueue.length <= 1 ? 'default' : 'pointer' }}><SkipBack size={14} /></button>
            <button onClick={handleToggleActiveTrack} title={isPlaying ? 'Pause' : 'Play'} style={{ width: '38px', height: '38px', borderRadius: '9999px', border: '1px solid rgba(0,210,255,0.38)', backgroundColor: '#00d2ff', color: '#000', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 0 24px rgba(0,210,255,0.24)' }}>{isPlaying ? <Pause size={17} fill="#000" /> : <Play size={17} fill="#000" />}</button>
            <button onClick={() => handlePlayerStep(1)} disabled={playerQueue.length <= 1} title="Next" style={{ width: '32px', height: '32px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#000', color: playerQueue.length <= 1 ? '#333' : '#fff', display: 'grid', placeItems: 'center', cursor: playerQueue.length <= 1 ? 'default' : 'pointer' }}><SkipForward size={14} /></button>
          </div>
        </div>
      )}

      {/* HEADER UTAMA BINGKAI ATAS */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={{ position: 'relative', width: '100%', height: homeHeroHeight, marginBottom: isTinyLayout ? '30px' : '46px', borderRadius: isTinyLayout ? '14px' : '18px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.075)', boxShadow: '0 28px 90px rgba(0,0,0,0.74), inset 0 1px 0 rgba(255,255,255,0.045)' }}>
          <header style={homeHeaderStyle}>
            <div style={homeBrandWrapStyle}><h1 onClick={() => setSearchTerm('')} style={{ fontSize: isTinyLayout ? '22px' : '24px', fontWeight: '900', letterSpacing: '1.5px', color: '#00d2ff', margin: 0, cursor: 'pointer' }}>WISPACE</h1></div>

            {/* CYBER SEARCH BAR INTEGRATION */}
            <div style={homeSearchWrapStyle}>
              <Search size={14} color="#666" style={{ position: 'absolute', left: '16px' }} />
              <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: isTinyLayout ? 'auto' : '100%', flex: isTinyLayout ? '1 1 0' : undefined, minWidth: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', padding: '10px 16px 10px 42px', fontSize: '12px', fontWeight: '700', color: '#fff', outline: 'none', fontFamily: FONT_STACK, boxSizing: 'border-box', textAlign: 'center' }} />
              {userSession && isTinyLayout && (
                <button onClick={openProfileModal} style={{ ...glassButtonStyle, padding: '8px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, maxWidth: '44%', flex: '0 0 auto' }}>{renderProfileChip(22, '94px')}</button>
              )}
            </div>

            <div style={homeNavStyle}>
              <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan', clearSearch: true })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>EXPLORE</button>
              {!userSession ? (
                <>
                  <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>LOGIN</button>
                  <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: isTinyLayout ? '8px 14px' : '8px 20px', fontSize: '11px', flexShrink: 0 }}>JOIN</button>
                </>
              ) : (
                <>
                  {!isTinyLayout && (
                    <button onClick={openProfileModal} style={{ ...glassButtonStyle, padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>{renderProfileChip(22, '130px')}</button>
                  )}
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ff3333', fontSize: isTinyLayout ? '12px' : '13px', fontWeight: '900', cursor: 'pointer', padding: isTinyLayout ? '8px 0' : '0', fontFamily: FONT_STACK }}>LOGOUT</button>
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
                <span style={{ backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', color: '#f5f5f5', fontSize: '10px', fontWeight: '900', padding: '6px 10px', borderRadius: '9999px', width: 'fit-content', marginBottom: '16px', letterSpacing: '1px' }}>{currentExclusiveBanner.type}</span>
                <h2 style={{ fontSize: isTinyLayout ? '36px' : 'clamp(54px, 7vw, 88px)', fontWeight: '900', margin: '0 0 14px 0', color: '#fff', maxWidth: '1040px', lineHeight: isTinyLayout ? 0.98 : 0.88 }}>{currentExclusiveBanner.title}</h2>
                <p style={{ color: '#c7c7c7', fontSize: isTinyLayout ? '13px' : '15px', maxWidth: '720px', margin: '0 0 30px 0', lineHeight: '1.55', fontWeight: '700' }}>{currentExclusiveBanner.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', width: '100%', flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedGigDetail({ ...currentExclusiveBanner.sourceGig, fromHero: true })} style={{ ...glassButtonStyle, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.72)', color: '#000', padding: isTinyLayout ? '11px 18px' : '12px 32px', width: 'fit-content', fontSize: isTinyLayout ? '12px' : '13px', boxShadow: '0 18px 36px rgba(0,0,0,0.35)' }}>LIHAT DETAIL EVENT</button>
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
                            borderBottom: isActiveSlide ? '2px solid #00d2ff' : '2px solid transparent',
                            background: 'transparent',
                            color: isActiveSlide ? '#ffffff' : 'rgba(255,255,255,0.48)',
                            textShadow: isActiveSlide ? '0 0 16px rgba(0, 210, 255, 0.95)' : 'none',
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
            <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#030303', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.08)', background: 'radial-gradient(circle at 18% 72%, rgba(0,210,255,0.16), transparent 30%), linear-gradient(135deg, #050505 0%, #0b171a 46%, #000 100%)' }} />
              <div style={{ position: 'relative', zIndex: 10, padding: isTinyLayout ? '24px 18px' : '40px' }}>
                <span style={{ color: '#fff', fontSize: '10px', fontWeight: '900', letterSpacing: '1.5px' }}>WISPACE EXCLUSIVE BOARD</span>
                <h2 style={{ color: '#fff', fontSize: isTinyLayout ? '34px' : 'clamp(52px, 6vw, 76px)', fontWeight: '900', lineHeight: isTinyLayout ? 1 : 0.9, margin: '14px 0 12px 0', maxWidth: '900px' }}>BELUM ADA PAMFLET APPROVED</h2>
                <p style={{ color: '#888', fontSize: isTinyLayout ? '13px' : '15px', maxWidth: '620px', lineHeight: 1.5, margin: 0 }}>Upload pamflet exclusive dari menu band, lalu approve di admin. Slide besar akan muncul di sini.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activePage === 'home' && !isAdminPage && normalizedSearchTerm && (
        <section style={{ margin: '0 0 34px 0', padding: isTinyLayout ? '14px' : '18px', background: 'linear-gradient(180deg, rgba(10,10,10,0.96), rgba(3,3,3,0.98))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', boxShadow: '0 20px 64px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 5px 0' }}>GLOBAL FIND</p>
              <h3 style={{ color: '#fff', fontSize: isTinyLayout ? '18px' : '22px', fontWeight: '900', lineHeight: 1, margin: 0 }}>HASIL UNTUK "{searchTerm.trim().toUpperCase()}"</h3>
            </div>
            <button onClick={() => setSearchTerm('')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '9px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLEAR</button>
          </div>

          {quickSearchResults.length === 0 ? (
            <div style={{ padding: '18px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
              <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ketemu. Coba cari nama band, genre, judul lagu, rilisan, artikel, atau merch.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {quickSearchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={result.onSelect}
                  style={{ textAlign: 'left', padding: '13px 14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', cursor: 'pointer', fontFamily: FONT_STACK, display: 'grid', gap: '5px' }}
                >
                  <span style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>{result.type}</span>
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', lineHeight: 1.1 }}>{String(result.title || '').toUpperCase()}</span>
                  <span style={{ color: '#777', fontSize: '12px', fontWeight: '700', lineHeight: 1.3 }}>{result.meta}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && activePage === 'home' && !isAdminPage && selectedGigDetail?.fromHero && (
        <section style={{ margin: '0 0 34px 0', padding: '18px', background: 'linear-gradient(180deg, rgba(10,10,10,0.94), rgba(3,3,3,0.98))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'minmax(220px, 360px) 1fr auto', gap: '18px', alignItems: 'start', boxShadow: '0 20px 64px rgba(0,0,0,0.54)' }}>
          <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
            {selectedGigDetail.image ? (
              <img src={selectedGigDetail.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>NO PAMFLET</span>
            )}
          </div>
          <div>
            <p style={{ color: '#a8f1ff', fontSize: '11px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>DETAIL EVENT</p>
            <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '900', margin: '0 0 10px 0', lineHeight: 1 }}>{selectedGigDetail.title?.toUpperCase()}</h3>
            <div style={{ display: 'grid', gap: '6px', color: '#aaa', fontSize: '12px', lineHeight: 1.45 }}>
              <span>DATE: <strong style={{ color: '#fff' }}>{getGigDate(selectedGigDetail)}</strong></span>
              <span>VENUE: <strong style={{ color: '#fff' }}>{selectedGigDetail.city?.toUpperCase()}</strong></span>
              <span>HTM: <strong style={{ color: '#00d2ff' }}>{getGigHtm(selectedGigDetail).toUpperCase()}</strong></span>
              <span>CP INFO: <strong style={{ color: '#fff' }}>{getGigCp(selectedGigDetail)}</strong></span>
              {isApprovedHomepageGig(selectedGigDetail) && <span>TAYANG SAMPAI: <strong style={{ color: '#ffcc00' }}>{getGigApprovedUntil(selectedGigDetail) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</strong></span>}
            </div>
          </div>
          <button onClick={() => setSelectedGigDetail(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
        </section>
      )}

      {/* ADMIN MODERATION PANEL */}
      {!loading && isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={pageShellStyle}>
          {!isAdminUnlocked ? (
            <div style={{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center' }}>
              <form onSubmit={handleAdminUnlock} style={{ ...glassStyle('admin-password-gate'), width: '100%', maxWidth: '420px', padding: '28px', backgroundColor: '#090909' }}>
                <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 8px 0' }}>WISPACE ADMIN GATE</p>
                <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0', lineHeight: 1 }}>ADMIN PASSWORD</h2>
                <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.5, margin: '0 0 18px 0' }}>Masukkan password admin untuk buka kurasi pamflet free dan exclusive.</p>
                <input type="password" placeholder="PASSWORD ADMIN" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required style={{ ...formInputStyle, marginBottom: '12px' }} />
                {adminError && <p style={{ color: '#ff3333', fontSize: '12px', fontWeight: '900', margin: '0 0 12px 0' }}>{adminError}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button type="submit" style={{ ...glassButtonStyle, padding: '12px', fontSize: '12px' }}>UNLOCK ADMIN</button>
                  <button type="button" onClick={closeAdminGate} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BACK HOME</button>
                </div>
              </form>
            </div>
          ) : (
            <>
          <div style={pageHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>WISPACE ADMIN GATE</p>
              <h2 style={pageTitleStyle}>KURASI PAMFLET EVENT</h2>
              <p style={pageLeadStyle}>Semua upload pamflet masuk pending dulu. Admin bisa approve sebagai event free untuk bulletin, approve sebagai exclusive untuk slide besar, atau reject kalau belum layak tayang.</p>
            </div>
            <button onClick={closeAdminGate} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>BACK HOME</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ ...glassStyle('admin-stat-pending'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>PENDING</p>
              <strong style={{ color: '#00d2ff', fontSize: '28px', fontWeight: '900' }}>{pendingGigs.length}</strong>
            </div>
            <div style={{ ...glassStyle('admin-stat-approved'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>FREE APPROVED</p>
              <strong style={{ color: '#fff', fontSize: '28px', fontWeight: '900' }}>{approvedFreeGigs.length}</strong>
            </div>
            <div style={{ ...glassStyle('admin-stat-waiting-payment'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>WAIT PAYMENT</p>
              <strong style={{ color: '#ffcc00', fontSize: '28px', fontWeight: '900' }}>{exclusiveWaitingPaymentGigs.length}</strong>
            </div>
            <div style={{ ...glassStyle('admin-stat-paid'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>PAID / ACTIVATE</p>
              <strong style={{ color: '#00d2ff', fontSize: '28px', fontWeight: '900' }}>{exclusivePaidWaitingActivationGigs.length}</strong>
            </div>
            <div style={{ ...glassStyle('admin-stat-rule'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>EXCLUSIVE LIVE</p>
              <strong style={{ color: '#fff', fontSize: '28px', fontWeight: '900' }}>{approvedExclusiveGigs.length}</strong>
            </div>
          </div>

          <section style={{ ...glassStyle('admin-income-report'), padding: '18px', backgroundColor: '#090909', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>WISPACE FINANCE REPORT</p>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: 0 }}>PEMASUKAN PLATFORM</h3>
              </div>
              <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0, maxWidth: '420px' }}>Ini laporan admin untuk fee platform. Dashboard band hanya menampilkan saldo milik band.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>FEE PEMBELIAN MERCH</p>
                <strong style={{ color: '#00d2ff', fontSize: '24px', fontWeight: '900' }}>Rp {adminMerchFeeRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>FEE RILISAN DIGITAL</p>
                <strong style={{ color: '#fff', fontSize: '24px', fontWeight: '900' }}>Rp {adminReleaseFeeRevenue.toLocaleString('id-ID')}</strong>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>BIAYA PAMFLET EXCLUSIVE</p>
                <strong style={{ color: '#fff', fontSize: '24px', fontWeight: '900' }}>Rp {adminExclusivePosterRevenue.toLocaleString('id-ID')}</strong>
                <p style={{ color: '#555', fontSize: '11px', lineHeight: 1.4, margin: '8px 0 0 0' }}>{adminExclusivePosterPaidCount} pembayaran x Rp {EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')}.</p>
              </div>
            </div>
          </section>

          <section style={{ ...glassStyle('admin-article-publisher'), padding: '18px', backgroundColor: '#090909', marginBottom: '24px' }}>
            <div style={{ marginBottom: '14px' }}>
              <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>WISPACE EDITORIAL</p>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: 0 }}>PUBLISH ARTIKEL ADMIN</h3>
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

          <section style={{ ...glassStyle('admin-content-moderation'), padding: '18px', backgroundColor: '#090909', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 6px 0' }}>CONTENT MODERATION</p>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: 0 }}>LAPORAN, KOMENTAR, ARTIKEL</h3>
              </div>
              <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0, maxWidth: '420px' }}>Tempat admin ngecek laporan plagiat/SARA/spam, remove komentar, dan takedown artikel kalau perlu.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompactLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <h4 style={{ color: '#ffcc00', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>LAPORAN TERBUKA ({openContentReports.length})</h4>
                {openContentReports.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada laporan konten.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {openContentReports.slice(0, 6).map((report) => (
                      <div key={report.id} style={{ padding: '10px', backgroundColor: '#050505', border: '1px solid #151515', borderRadius: '10px' }}>
                        <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{report.type.toUpperCase()} / {report.reason.toUpperCase()}</p>
                        <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.35, margin: '0 0 8px 0' }}>{report.title}</p>
                        <p style={{ color: '#555', fontSize: '10px', margin: '0 0 8px 0' }}>By {report.reporterName} / {report.createdAt}</p>
                        <button onClick={() => handleResolveContentReport(report.id)} style={{ ...glassButtonStyle, padding: '7px 9px', fontSize: '10px' }}>RESOLVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <h4 style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>KOMENTAR TERBARU</h4>
                {recentArticleComments.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada komentar artikel.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {recentArticleComments.slice(0, 6).map((comment) => (
                      <div key={`${comment.articleId}-${comment.id}`} style={{ padding: '10px', backgroundColor: '#050505', border: '1px solid #151515', borderRadius: '10px' }}>
                        <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{comment.author.toUpperCase()}</p>
                        <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.35, margin: '0 0 6px 0' }}>{comment.body}</p>
                        <p style={{ color: '#555', fontSize: '10px', margin: '0 0 8px 0' }}>{comment.articleTitle}</p>
                        <button onClick={() => handleRemoveArticleComment(comment.articleId, comment.id)} style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.35)', color: '#ff3333', borderRadius: '9px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>ARTIKEL LIVE</h4>
                {publicArticleList.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada artikel live.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {publicArticleList.slice(0, 6).map((article) => (
                      <div key={`moderate-${article.id}`} style={{ padding: '10px', backgroundColor: '#050505', border: '1px solid #151515', borderRadius: '10px' }}>
                        <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', lineHeight: 1.25, margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                        <p style={{ color: '#555', fontSize: '10px', margin: '0 0 8px 0' }}>{article.category} / {article.bandName}</p>
                        <button onClick={() => handleRemoveArticle(article)} style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.35)', color: '#ff3333', borderRadius: '9px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {pendingGigs.length === 0 ? (
            <div style={{ ...glassStyle('empty-admin'), padding: '32px', backgroundColor: '#090909', textAlign: 'center' }}>
              <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0' }}>ANTREAN BERSIH</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Belum ada pamflet baru yang perlu dicek.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
              {pendingGigs.map(gig => {
                const requestType = getGigRequestType(gig);
                const isExclusiveRequest = requestType === 'exclusive';
                return (
                <div key={gig.id} style={{ ...glassStyle(`admin-${gig.id}`), padding: '14px', backgroundColor: '#090909' }}>
                  <button
                    type="button"
                    onClick={() => gig.image && setSelectedPosterPreview(gig)}
                    disabled={!gig.image}
                    title={gig.image ? 'Klik buat cek pamflet utuh' : 'Belum ada gambar pamflet'}
                    style={{ width: '100%', padding: 0, margin: '0 0 14px 0', border: 'none', background: 'transparent', cursor: gig.image ? 'zoom-in' : 'default', fontFamily: FONT_STACK }}
                  >
                    {renderGigPosterImage(gig, { width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px' })}
                    {gig.image && <span style={{ display: 'block', color: '#00d2ff', fontSize: '10px', fontWeight: '900', marginTop: '8px', textAlign: 'left' }}>KLIK GAMBAR UNTUK PREVIEW UTUH</span>}
                  </button>
                  <p style={{ color: '#ffcc00', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>STATUS: PENDING REVIEW</p>
                  <p style={{ color: isExclusiveRequest ? '#00d2ff' : '#39ff14', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>REQUEST: {isExclusiveRequest ? 'EXCLUSIVE SLIDE' : 'FREE BULLETIN'}</p>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0', color: '#fff' }}>{gig.title?.toUpperCase()}</h3>
                  <div style={{ color: '#888', fontSize: '12px', lineHeight: 1.5, marginBottom: '14px' }}>
                    <div>Kota/Venue: <span style={{ color: '#fff' }}>{gig.city}</span></div>
                    <div>Genre: <span style={{ color: '#fff' }}>{getGigGenre(gig)}</span></div>
                    <div>Tanggal: <span style={{ color: '#fff' }}>{getGigDate(gig)}</span></div>
                    <div>HTM: <span style={{ color: '#fff' }}>{getGigHtm(gig)}</span></div>
                    <div>CP: <span style={{ color: '#fff' }}>{getGigCp(gig)}</span></div>
                    {isApprovedHomepageGig(gig) && (
                      <div>Tayang sampai: <span style={{ color: '#00d2ff' }}>{getGigApprovedUntil(gig) || 'Belum ada, approve ulang setelah SQL upgrade'}</span></div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <button onClick={() => handleGigModeration(gig.id, 'approved_free')} style={{ padding: '10px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE</button>
                    <button onClick={() => handleGigModeration(gig.id, 'approved_waiting_payment')} style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(0,210,255,0.45)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>APPROVE PAY</button>
                    <button onClick={() => handleGigModeration(gig.id, 'rejected')} style={{ padding: '10px', backgroundColor: 'rgba(255,51,51,0.1)', color: '#ff3333', border: '1px solid rgba(255,51,51,0.35)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REJECT</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '28px' }}>
            {[
              { title: 'EXCLUSIVE WAITING PAYMENT', items: exclusiveWaitingPaymentGigs, color: '#ffcc00', mode: 'waiting' },
              { title: 'EXCLUSIVE PAID / NEED ACTIVATE', items: exclusivePaidWaitingActivationGigs, color: '#00d2ff', mode: 'activate' }
            ].map((group) => (
              <section key={group.title} style={{ ...glassStyle(group.title), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={{ color: group.color, fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>{group.title}</h3>
                {group.items.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada pamflet di status ini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {group.items.map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', alignItems: 'center' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>{gig.city} / {getGigDate(gig)}</p>
                          <p style={{ color: group.color, fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '4px 0 0 0' }}>{group.mode === 'waiting' ? `Menunggu user bayar Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')}` : 'Payment received, siap diaktifkan'}</p>
                        </div>
                        {group.mode === 'activate' ? (
                          <button onClick={() => handleGigActivateExclusive(gig.id)} style={{ padding: '9px 11px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>ACTIVATE</button>
                        ) : (
                          <span style={{ color: '#ffcc00', fontSize: '10px', fontWeight: '900', whiteSpace: 'nowrap' }}>WAIT PAY</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '28px' }}>
            {[
              { title: 'FREE BULLETIN LIVE', items: approvedFreeGigs, color: '#39ff14' },
              { title: 'EXCLUSIVE SLIDE LIVE', items: approvedExclusiveGigs, color: '#00d2ff' }
            ].map((group) => (
              <section key={group.title} style={{ ...glassStyle(group.title), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={{ color: group.color, fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>{group.title}</h3>
                {group.items.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada pamflet di list ini.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {group.items.map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', alignItems: 'center' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>APPROVE: <span style={{ color: '#fff' }}>{getGigApprovedAt(gig) || '-'}</span></p>
                          <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>HABIS: <span style={{ color: '#ffcc00' }}>{getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</span></p>
                        </div>
                        <button onClick={() => handleGigRemove(gig.id)} style={{ padding: '9px 11px', backgroundColor: 'rgba(255,51,51,0.1)', color: '#ff3333', border: '1px solid rgba(255,51,51,0.35)', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>REMOVE</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
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

          <div style={{ display: exploreTab === 'rilisan' ? 'grid' : 'none', gridTemplateColumns: studioGridColumns, gap: '24px', alignItems: 'start' }}>
            <div>
              <section style={{ marginBottom: '26px' }}>
                <h3 style={sectionHeadingStyle}>LATEST DIGITAL RELEASES</h3>
                {filteredAlbums.length === 0 ? (
                  <div style={{ ...glassStyle('explore-empty-albums'), padding: '24px', backgroundColor: '#090909' }}>
                    <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>BELUM ADA ALBUM DRAFT</h4>
                    <p style={{ color: '#666', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>Masuk ke Backstage Musisi, buka Upload Album Digital, lalu submit draft. Rilisannya akan muncul di sini.</p>
                    <button onClick={() => { setBandProfileTab('album'); setActivePage('band_profile'); }} style={{ ...glassButtonStyle, padding: '11px 18px', fontSize: '12px' }}>BUKA BAND STUDIO</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' }}>
                    {filteredAlbums.map((album) => (
                      <article key={album.id} style={{ ...glassStyle(`album-${album.id}`), padding: '14px', backgroundColor: '#090909' }}>
                        <div style={{ width: '100%', aspectRatio: '1/1', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', display: 'grid', placeItems: 'center', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>COVER</span>}
                        </div>
                        <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>{album.genre.toUpperCase()} / {album.trackCount} TRACK</p>
                        <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 6px 0', lineHeight: 1.1 }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: '#777', fontSize: '12px', margin: '0 0 12px 0' }}>{album.bandName.toUpperCase()} - {album.city.toUpperCase()}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                          <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}>Full Rp {Number(album.price || 0).toLocaleString('id-ID')}</span>
                          <button onClick={() => handlePurchaseAlbum(album)} style={{ ...glassButtonStyle, padding: '8px 12px', fontSize: '11px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI FULL'}</button>
                        </div>
                        {(album.tracks || []).length > 0 && (
                          <div style={{ display: 'grid', gap: '7px', borderTop: '1px solid #141414', paddingTop: '10px' }}>
                            {(album.tracks || []).slice(0, 3).map((track) => (
                              <div key={`explore-${track.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: track.freeFull ? '#39ff14' : '#aaa', fontSize: '11px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title.toUpperCase()}</span>
                                <button onClick={() => handlePurchaseTrack(album, track)} disabled={track.freeFull} style={{ background: 'transparent', border: 'none', color: track.freeFull ? '#39ff14' : '#00d2ff', fontSize: '10px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK, flexShrink: 0 }}>{track.freeFull ? 'FREE' : `Rp ${Number(track.price || 0).toLocaleString('id-ID')}`}</button>
                              </div>
                            ))}
                            {(album.tracks || []).length > 3 && <p style={{ color: '#555', fontSize: '10px', fontWeight: '900', margin: 0 }}>+{album.tracks.length - 3} TRACK LAIN DI PROFILE BAND</p>}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 style={sectionHeadingStyle}>30 SECOND PREVIEW TRACKS</h3>
                <div style={{ ...glassStyle('explore-tracks'), padding: '18px', backgroundColor: '#090909' }}>
                  {filteredTracks.length === 0 ? (
                    <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada track dari database. Nanti section ini jadi player preview 30 detik untuk rilisan baru.</p>
                  ) : (
                    filteredTracks.map(track => (
                      <div key={track.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #141414', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: '14px', color: '#fff', margin: '0 0 3px 0' }}>{track.title.toUpperCase()}</h4>
                          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{track.band.toUpperCase()}</p>
                        </div>
                        <button onClick={() => handlePlayTrack(track, filteredTracks)} style={{ ...glassButtonStyle, padding: '7px 14px', fontSize: '11px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PREVIEW'}</button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <aside style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...glassStyle('explore-band-directory'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>BAND DIRECTORY</h3>
                {filteredBandProfiles.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada band publish yang cocok. Simpan profile band dulu dari Band Studio.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredBandProfiles.slice(0, 4).map((profile) => (
                      <div key={`side-${profile.slug}`} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: '58px', height: '58px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', display: 'grid', placeItems: 'center' }}>
                          {profile.photoPreview ? <img src={profile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <button
                            onClick={() => openBandPublicProfile(false, profile)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '900', margin: '0 0 5px 0', padding: 0, cursor: 'pointer', fontFamily: FONT_STACK, textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(0,210,255,0.65)', textUnderlineOffset: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {profile.name.toUpperCase()}
                          </button>
                          <p style={{ color: '#777', fontSize: '12px', margin: '0 0 4px 0' }}>{(profile.city || 'INDONESIA').toUpperCase()} / {(profile.genre || 'INDIE').toUpperCase()}</p>
                          <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>/{profile.slug || createSlug(profile.name)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ ...glassStyle('explore-merch'), padding: '18px', backgroundColor: '#090909' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>MERCH HIGHLIGHT</h3>
                  <button onClick={() => setExploreTab('merch')} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LIHAT SEMUA</button>
                </div>
                {filteredMerchItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Belum ada merch draft. Nanti audience bisa beli kaos, CD, kaset, stiker, dan bundle dari profile band.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {filteredMerchItems.slice(0, 4).map(item => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: '10px', alignItems: 'center', padding: '8px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        <div style={{ width: '54px', height: '54px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{item.name.toUpperCase()}</p>
                          <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>

          {exploreTab === 'band' && (
            <section style={{ ...glassStyle('explore-band-tab'), padding: '22px', backgroundColor: '#090909' }}>
              <h3 style={sectionHeadingStyle}>BAND DIRECTORY</h3>
              {filteredBandProfiles.length > 0 ? (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {filteredBandProfiles.map((profile) => (
                    <div key={`band-tab-${profile.slug}`} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '68px 1fr' : '86px 1fr auto', gap: '16px', alignItems: 'center', padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px' }}>
                      <div style={{ width: isTinyLayout ? '68px' : '86px', height: isTinyLayout ? '68px' : '86px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                        {profile.photoPreview ? <img src={profile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                      </div>
                      <div>
                        <h4 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', margin: '0 0 6px 0' }}>{profile.name.toUpperCase()}</h4>
                        <p style={{ color: '#777', fontSize: '13px', margin: '0 0 6px 0' }}>{(profile.genre || 'INDIE').toUpperCase()} / {(profile.city || 'INDONESIA').toUpperCase()}</p>
                        <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.45, margin: 0 }}>{profile.headline || 'Profile band akan muncul lengkap setelah musisi mengisi Band Studio.'}</p>
                      </div>
                      <button onClick={() => openBandPublicProfile(false, profile)} style={{ ...glassButtonStyle, padding: '11px 16px', fontSize: '12px', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}>LIHAT PROFILE</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada band yang cocok dengan pencarian ini.</p>
              )}
            </section>
          )}

          {exploreTab === 'artikel' && (
            <section style={{ ...glassStyle('explore-article-tab'), padding: '22px', backgroundColor: '#090909' }}>
              <h3 style={sectionHeadingStyle}>ARTIKEL SKENA</h3>
              {filteredArticles.length === 0 ? (
                <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada artikel yang cocok. Band bisa tulis artikel dari Band Studio.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                  {filteredArticles.map((article) => (
                    <article key={article.id} style={{ padding: '16px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px' }}>
                      <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 10px 0' }}>{article.category.toUpperCase()} / {article.createdAt}</p>
                      <h4 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', lineHeight: 1.05, margin: '0 0 10px 0' }}>{article.title.toUpperCase()}</h4>
                      <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{article.excerpt}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {exploreTab === 'merch' && (
            <section style={{ ...glassStyle('explore-merch-tab'), padding: '22px', backgroundColor: '#090909' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>MERCH BAND</h3>
                {isBandAccount && <button onClick={() => { setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px' }}>UPLOAD MERCH</button>}
              </div>
              {filteredMerchItems.length === 0 ? (
                <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada merch yang cocok. Merch sekarang dikumpulkan di Explore, bukan menu terpisah.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '18px' }}>
                  {filteredMerchItems.map((item) => (
                    <article key={item.id} style={{ padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px' }}>
                      <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                        {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>MERCH</span>}
                      </div>
                      <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>{(bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()} / STOCK {item.stock || 0}</p>
                      <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0' }}>{item.name.toUpperCase()}</h4>
                      <p style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 12px 0' }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                      <button onClick={() => handlePurchaseMerch(item)} style={{ ...glassButtonStyle, width: '100%', padding: '10px', fontSize: '11px' }}>{userSession ? 'BUY MERCH' : 'JOIN TO BUY'}</button>
                    </article>
                  ))}
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
              <p style={pageLeadStyle}>Satu halaman buat ngumpulin merch band indie: kaos, CD, kaset, stiker, bundle album, dan item fisik lain dari profile band.</p>
            </div>
            {isBandAccount && (
              <button onClick={() => { setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>UPLOAD MERCH</button>
            )}
          </div>

          {publicMerchList.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px' }}>
              {[1, 2, 3, 4].map((slot) => (
                <div key={slot} style={{ ...glassStyle(`merch-placeholder-${slot}`), padding: '14px', backgroundColor: '#090909', borderStyle: 'dashed' }}>
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.12)', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                    <ShoppingBag size={32} color="#12323a" />
                  </div>
                  <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>MERCH SLOT {String(slot).padStart(2, '0')}</p>
                  <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>BELUM ADA ITEM</h4>
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Nanti kaos, CD, kaset, stiker, dan bundle band akan tampil sebagai kartu merch di sini.</p>
                </div>
              ))}
              <div style={{ ...glassStyle('merch-market-empty-action'), padding: '22px', backgroundColor: '#090909', display: 'grid', alignContent: 'center' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: '0 0 10px 0' }}>MERCH MARKET MASIH KOSONG</h3>
                <p style={{ color: '#666', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Belum ada dummy/input merch. Begitu band upload merch dari Band Studio, item-nya langsung masuk ke grid ini.</p>
                {isBandAccount ? (
                  <button onClick={() => { setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TAMBAH MERCH PERTAMA</button>
                ) : (
                  <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE BAND DULU</button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '18px' }}>
              {publicMerchList.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setSelectedMerchDetail(selectedMerchDetail?.id === item.id ? null : item)}
                  style={{ ...glassStyle(`merch-market-${item.id}`), padding: '14px', backgroundColor: '#090909', cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.07)', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                    {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>MERCH</span>}
                  </div>
                  <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>{(item.bandName || 'BAND WISPACE').toUpperCase()} / STOCK {item.stock || 0}</p>
                  <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0', lineHeight: 1.1 }}>{item.name.toUpperCase()}</h4>
                  <p style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                  {selectedMerchDetail?.id === item.id && (
                    <div onClick={(event) => event.stopPropagation()} style={{ marginTop: '14px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '12px', animation: 'slideDown 0.2s ease-out' }}>
                      <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.45, margin: '0 0 12px 0' }}>{item.description || 'Merchandise resmi band di WiSpace.'}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ color: '#777', fontSize: '11px' }}>STOK<br/><strong style={{ color: '#fff', fontSize: '13px' }}>{item.stock || 0}</strong></div>
                        <div style={{ color: '#777', fontSize: '11px' }}>BAND<br/><strong style={{ color: '#fff', fontSize: '13px' }}>{(item.bandName || 'BAND WISPACE').toUpperCase()}</strong></div>
                      </div>
                      <button onClick={() => handlePurchaseMerch(item)} style={{ ...glassButtonStyle, width: '100%', padding: '10px', fontSize: '11px' }}>{userSession ? 'BUY MERCH' : 'JOIN TO BUY'}</button>
                    </div>
                  )}
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
              <p style={pageLeadStyle}>Ruang cerita buat interview band, catatan rilisan, review skena, update gigs, dan arsip pergerakan musik independen.</p>
            </div>
            {isBandAccount && (
              <button onClick={() => { setBandProfileTab('artikel'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TULIS ARTIKEL</button>
            )}
          </div>

          {publicArticleList.length === 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
              {[1, 2, 3, 4].map((slot) => (
                <article key={slot} style={{ ...glassStyle(`article-placeholder-${slot}`), padding: '18px', backgroundColor: '#090909', borderStyle: 'dashed', minHeight: '220px', display: 'grid', alignContent: 'space-between' }}>
                  <div>
                    <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 14px 0' }}>ARTICLE SLOT {String(slot).padStart(2, '0')}</p>
                    <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', lineHeight: 1.05, margin: '0 0 12px 0' }}>BELUM ADA ARTIKEL</h3>
                    <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Nanti artikel band, interview, catatan rilisan, dan report skena akan tampil di card ini.</p>
                  </div>
                  <FileText size={26} color="#12323a" />
                </article>
              ))}
              <div style={{ ...glassStyle('articles-empty-action'), padding: '22px', backgroundColor: '#090909', display: 'grid', alignContent: 'center' }}>
                <h3 style={{ color: '#fff', fontSize: '19px', fontWeight: '900', margin: '0 0 10px 0' }}>ARSIP ARTIKEL MASIH KOSONG</h3>
                <p style={{ color: '#666', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Band bisa mulai nulis cerita rilis album, proses kreatif, atau press release sederhana dari Band Studio.</p>
                {isBandAccount ? (
                  <button onClick={() => { setBandProfileTab('artikel'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>TULIS ARTIKEL PERTAMA</button>
                ) : (
                  <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>JOIN UNTUK IKUT SKENA</button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: articleGridColumns, gap: '24px', alignItems: 'start' }}>
              <main style={{ display: 'grid', gap: '18px' }}>
                {publicArticleList.map((article) => {
                  const comments = articleComments[article.id] || [];
                  return (
                    <article key={article.id} style={{ ...glassStyle(`article-${article.id}`), padding: '20px', backgroundColor: '#090909' }}>
                      <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 10px 0' }}>{article.category.toUpperCase()} / {article.createdAt}</p>
                      <h3 style={{ color: '#fff', fontSize: '26px', fontWeight: '900', lineHeight: 1, margin: '0 0 12px 0' }}>{article.title.toUpperCase()}</h3>
                      <p style={{ color: '#aaa', fontSize: '14px', lineHeight: 1.6, margin: '0 0 14px 0' }}>{article.excerpt}</p>
                      {article.body && <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.65, margin: '0 0 14px 0', whiteSpace: 'pre-line' }}>{article.body}</p>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <p style={{ color: '#555', fontSize: '11px', fontWeight: '900', margin: 0 }}>PENULIS: {(article.bandName || 'BAND WISPACE').toUpperCase()}</p>
                        <button onClick={() => createContentReport({ type: 'article', targetId: article.id, title: article.title })} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#888', borderRadius: '9px', padding: '6px 8px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN ARTIKEL</button>
                      </div>

                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #141414' }}>
                        <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>KOMENTAR ({comments.length})</p>
                        {comments.length > 0 && (
                          <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                            {comments.slice(0, 3).map((comment) => (
                              <div key={comment.id} style={{ padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '10px' }}>
                                <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{comment.author.toUpperCase()} / {comment.createdAt}</p>
                                <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{comment.body}</p>
                                <button onClick={() => createContentReport({ type: 'comment', targetId: comment.id, title: `${article.title} / ${comment.author}` })} style={{ marginTop: '8px', background: 'transparent', border: 'none', color: '#666', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN KOMENTAR</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <form onSubmit={(event) => handleArticleCommentSubmit(event, article)} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '1fr' : '1fr auto', gap: '8px' }}>
                          <input type="text" placeholder={userSession ? 'TULIS KOMENTAR...' : 'LOGIN UNTUK KOMENTAR'} value={articleCommentDrafts[article.id] || ''} onChange={(event) => setArticleCommentDrafts({ ...articleCommentDrafts, [article.id]: event.target.value })} style={{ ...formInputStyle, margin: 0 }} />
                          <button type="submit" style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px' }}>KIRIM</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </main>
              <aside style={{ ...glassStyle('article-sidebar'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>10 ARTIKEL TERBARU</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {publicArticleList.slice(0, 10).map((article) => (
                    <div key={`side-${article.id}`} style={{ padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                      <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                      <p style={{ color: '#777', fontSize: '11px', margin: 0 }}>{article.category} / {article.createdAt}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </section>
      )}

      {/* PUBLIC BAND PROFILE PAGE */}
      {!loading && isBandPublicPage && (
        <section style={{ minHeight: 'calc(100vh - 40px)', background: 'linear-gradient(180deg, #060606 0%, #030303 100%)', border: '1px solid rgba(0,210,255,0.16)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)' }}>
          <div style={{ position: 'relative', minHeight: isTinyLayout ? '430px' : '470px', display: 'flex', alignItems: 'flex-end', padding: isTinyLayout ? '98px 20px 28px' : '92px 38px 38px', boxSizing: 'border-box' }}>
            {displayBandProfile.coverPreview ? (
              <img src={displayBandProfile.coverPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #050505 0%, #072027 45%, #000 100%)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 78%, rgba(0,210,255,0.18), transparent 34%), linear-gradient(to top, rgba(3,3,3,1), rgba(3,3,3,0.62), rgba(3,3,3,0.16))' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: publicBandHeroColumns, gap: '24px', alignItems: 'end', width: '100%' }}>
              <div style={{ width: `${publicBandAvatarSize}px`, height: `${publicBandAvatarSize}px`, borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.72)', display: 'grid', placeItems: 'center', boxShadow: '0 24px 55px rgba(0,0,0,0.55), 0 0 30px rgba(0,210,255,0.2)' }}>
                {displayBandProfile.photoPreview ? <img src={displayBandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>FOTO BAND</span>}
              </div>
              <div>
                <p style={eyebrowStyle}>PUBLIC BAND PROFILE</p>
                <h2 style={{ ...pageTitleStyle, fontSize: 'clamp(42px, 7vw, 72px)', maxWidth: '980px' }}>{(displayBandProfile.name || signatureName || 'NAMA BAND').toUpperCase()}</h2>
                <p style={{ color: '#f5f5f5', fontSize: '17px', fontWeight: '900', margin: '14px 0 12px 0', maxWidth: '760px', lineHeight: 1.25 }}>{displayBandProfile.headline || 'Headline band akan tampil di sini setelah profile diisi.'}</p>
                <p style={{ color: '#9a9a9a', fontSize: '13px', fontWeight: '800', margin: '0 0 14px 0' }}>{(displayBandProfile.city || 'KOTA').toUpperCase()} / {(displayBandProfile.genre || 'GENRE').toUpperCase()}{displayBandProfile.formedYear ? ` / SINCE ${displayBandProfile.formedYear}` : ''} / wispace.my.id{getBandProfilePath(displayBandProfile)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 14px 0' }}>
                  <span style={{ padding: '7px 10px', borderRadius: '9999px', backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(0,210,255,0.28)', color: '#00d2ff', fontSize: '11px', fontWeight: '900' }}>{bandSubscriberCount.toLocaleString('id-ID')} SUBSCRIBERS</span>
                  {showBandOwnerControls && unreadBandNotifications > 0 && (
                    <span style={{ padding: '7px 10px', borderRadius: '9999px', backgroundColor: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.28)', color: '#39ff14', fontSize: '11px', fontWeight: '900' }}>{unreadBandNotifications} NOTIF BARU</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  {!showBandOwnerControls && (
                    <button onClick={handleBandSubscribeToggle} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px', width: 'fit-content', background: isSubscribedToCurrentBand ? 'rgba(57,255,20,0.1)' : glassButtonStyle.background, border: isSubscribedToCurrentBand ? '1px solid rgba(57,255,20,0.35)' : glassButtonStyle.border, color: isSubscribedToCurrentBand ? '#39ff14' : '#00d2ff' }}>
                      {isSubscribedToCurrentBand ? 'SUBSCRIBED' : 'SUBSCRIBE BAND'}
                    </button>
                  )}
                  <button onClick={copyBandProfileLink} style={{ ...glassButtonStyle, padding: '10px 14px', fontSize: '11px', width: 'fit-content' }}>COPY PROFILE LINK</button>
                </div>
                {!showBandOwnerControls && isSubscribedToCurrentBand && (
                  <p style={{ color: '#39ff14', fontSize: '11px', fontWeight: '900', margin: '10px 0 0 0' }}>Notif update band aktif di draft subscription.</p>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: isTinyLayout ? '20px 16px 24px' : '30px', display: 'grid', gridTemplateColumns: splitGridColumns, gap: '24px', alignItems: 'start' }}>
            <main>
              {showBandOwnerControls && (
                <div style={ownerActionsPanelStyle}>
                  <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>OWNER ACTIONS</p>
                  <div style={ownerActionsGridStyle}>
                    <button onClick={() => { setBandProfileTab('profile'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={ownerActionButtonStyle}>EDIT PROFILE</button>
                    <button onClick={() => { setBandProfileTab('album'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...ownerActionButtonStyle, color: '#fff', borderColor: '#444' }}>UPLOAD ALBUM</button>
                    <button onClick={() => { setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...ownerActionButtonStyle, color: '#fff', borderColor: '#444' }}>MERCH</button>
                    <button onClick={() => { setBandProfileTab('artikel'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...ownerActionButtonStyle, color: '#fff', borderColor: '#444' }}>ARTIKEL</button>
                    <button onClick={() => { setActivePage('gig_manager'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={ownerActionButtonStyle}>PAMFLET</button>
                    <button onClick={() => { setActivePage('gig_manager'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...ownerActionButtonStyle, color: '#fff', borderColor: '#444' }}>JADWAL</button>
                    <button onClick={() => { setActivePage('finance_dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...ownerActionButtonStyle, background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: '#39ff14' }}>KEUANGAN</button>
                  </div>
                </div>
              )}

              {showBandOwnerControls && (
                <section style={{ ...glassStyle('band-subscribe-notifications'), padding: '14px', backgroundColor: '#090909', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 4px 0' }}>BAND NOTIFICATIONS</p>
                      <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: '900', margin: 0 }}>SUBSCRIBER ACTIVITY</h3>
                    </div>
                    {unreadBandNotifications > 0 && (
                      <button onClick={markBandNotificationsRead} style={{ background: 'transparent', border: '1px solid rgba(57,255,20,0.28)', color: '#39ff14', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>MARK READ</button>
                    )}
                  </div>
                  {bandNotifications.length === 0 ? (
                    <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Belum ada notif subscribe. Nanti setiap audience subscribe band ini, activity-nya masuk di sini.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {bandNotifications.slice(0, 4).map((notification) => (
                        <div key={notification.id} style={{ padding: '10px', backgroundColor: '#000', border: `1px solid ${notification.read ? '#141414' : 'rgba(57,255,20,0.28)'}`, borderRadius: '10px' }}>
                          <p style={{ color: notification.read ? '#777' : '#39ff14', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{notification.title} / {notification.createdAt}</p>
                          <p style={{ color: '#ddd', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>{notification.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section style={{ ...glassStyle('band-public-bio'), padding: '20px', backgroundColor: '#090909', marginBottom: '24px' }}>
                <h3 style={sectionHeadingStyle}>BIO BAND</h3>
                <p style={{ color: '#bbb', fontSize: '14px', lineHeight: 1.65, margin: 0 }}>{displayBandProfile.bio || 'Bio band belum diisi. Nanti audience akan membaca cerita band, karakter musik, rilisan, dan info kontak di bagian ini.'}</p>
              </section>

              <section style={{ ...glassStyle('band-public-player'), padding: '20px', backgroundColor: '#090909', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ ...sectionHeadingStyle, margin: '0 0 6px 0' }}>PROMO MUSIC PLAYER</h3>
                    <p style={{ color: '#666', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Preview maksimal 30 detik. Satu lagu bisa dibuka full gratis oleh band.</p>
                  </div>
                  {hasFreeFullBandTrack && (
                    <span style={{ padding: '7px 10px', borderRadius: '9999px', backgroundColor: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.25)', color: '#39ff14', fontSize: '10px', fontWeight: '900' }}>1 FREE FULL TRACK</span>
                  )}
                </div>
                {bandPublicTracks.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada lagu promo. Upload album dulu, lalu pilih track preview/free full di Band Studio.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {bandPublicTracks.map((track, index) => {
                      const isActive = activeTrack?.id === track.id && isPlaying;
                      return (
                        <div key={track.id} style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '44px 1fr' : '52px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px', backgroundColor: '#000', border: `1px solid ${track.freeFull ? 'rgba(57,255,20,0.26)' : '#141414'}`, borderRadius: '12px' }}>
                          <div style={{ width: isTinyLayout ? '44px' : '52px', height: isTinyLayout ? '44px' : '52px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center', color: '#00d2ff', fontSize: '11px', fontWeight: '900' }}>
                            {track.albumCover ? <img src={track.albumCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : String(index + 1).padStart(2, '0')}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ color: track.freeFull ? '#39ff14' : '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{track.freeFull ? 'FREE FULL LISTEN' : '30 SEC PREVIEW'} / {track.albumTitle?.toUpperCase()}</p>
                            <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title.toUpperCase()}</h4>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>{track.freeFull ? 'Full track gratis buat kenalan sama band.' : 'Preview otomatis berhenti setelah 30 detik.'}</p>
                              <button onClick={() => createContentReport({ type: 'track', targetId: track.id, title: `${track.title} / ${displayBandProfile.name || track.bandName || 'Band WiSpace'}` })} style={{ background: 'transparent', border: 'none', color: '#555', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN</button>
                            </div>
                          </div>
                          <button onClick={() => handlePlayTrack(track, bandPublicTracks)} style={{ ...glassButtonStyle, padding: isTinyLayout ? '9px' : '10px 14px', fontSize: '11px', gridColumn: isTinyLayout ? '1 / -1' : 'auto' }}>{isActive ? 'PAUSE' : 'PLAY'}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section style={{ ...glassStyle('band-public-releases'), padding: '20px', backgroundColor: '#090909', marginBottom: '24px' }}>
                <h3 style={sectionHeadingStyle}>ALBUM DIGITAL</h3>
                {displayBandAlbums.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada album digital. Upload album pertama dari tombol owner actions.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {displayBandAlbums.map((album) => (
                      <article key={album.id} style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px' }}>
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center', marginBottom: '12px' }}>
                          {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '11px', fontWeight: '900' }}>COVER</span>}
                        </div>
                        <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>{album.trackCount} TRACK / FULL ALBUM</p>
                        <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 6px 0' }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>Full Album Rp {Number(album.price || 0).toLocaleString('id-ID')}</p>
                        <button onClick={() => handlePurchaseAlbum(album)} style={{ ...glassButtonStyle, width: '100%', padding: '9px', fontSize: '11px', marginBottom: '10px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI FULL ALBUM'}</button>
                        {(album.tracks || []).length > 0 && (
                          <div style={{ display: 'grid', gap: '8px', borderTop: '1px solid #141414', paddingTop: '10px' }}>
                            {(album.tracks || []).slice(0, 10).map((track, index) => (
                              <div key={track.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ color: track.freeFull ? '#39ff14' : '#ddd', fontSize: '11px', fontWeight: '900', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(index + 1).padStart(2, '0')} / {track.title.toUpperCase()}</p>
                                  <p style={{ color: '#666', fontSize: '10px', margin: '3px 0 0 0' }}>{track.freeFull ? 'FREE FULL LISTEN' : `Rp ${Number(track.price || 0).toLocaleString('id-ID')}`}</p>
                                  <button onClick={() => createContentReport({ type: 'track', targetId: track.id, title: `${track.title} / ${album.title}` })} style={{ marginTop: '5px', background: 'transparent', border: 'none', color: '#555', padding: 0, fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LAPORKAN</button>
                                </div>
                                <button onClick={() => handlePurchaseTrack(album, track)} disabled={track.freeFull} style={{ background: track.freeFull ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${track.freeFull ? 'rgba(57,255,20,0.24)' : 'rgba(255,255,255,0.12)'}`, color: track.freeFull ? '#39ff14' : '#fff', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: track.freeFull ? 'default' : 'pointer', fontFamily: FONT_STACK }}>{track.freeFull ? 'FREE' : 'BUY'}</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section id="band-gig-schedule" style={{ ...glassStyle('band-gig-schedule'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>JADWAL MANGGUNG</h3>
                {bandScheduleItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada jadwal manggung. Tambahkan jadwal dari Band Gig Manager, jadwal ini hanya tampil di profile band.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {bandScheduleItems.slice(0, 5).map((schedule) => (
                      <div key={schedule.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '12px', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '10px', backgroundColor: '#050505', border: '1px solid rgba(0,210,255,0.25)', display: 'grid', placeItems: 'center', color: '#00d2ff', fontSize: '11px', fontWeight: '900', textAlign: 'center', lineHeight: 1.1 }}>LIVE<br/>DATE</div>
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: '0 0 6px 0' }}>{schedule.title.toUpperCase()}</h4>
                          <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{schedule.venue} / {schedule.date} / {schedule.htm}</p>
                          <p style={{ color: '#555', fontSize: '11px', lineHeight: 1.4, margin: '5px 0 0 0' }}>CP: {schedule.cp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </main>

            <aside style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...glassStyle('band-public-contact'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>CONTACT</h3>
                <p style={{ color: '#777', fontSize: '12px', margin: '0 0 8px 0' }}>CP: <span style={{ color: '#fff' }}>{displayBandProfile.cp || '-'}</span></p>
                <p style={{ color: '#777', fontSize: '12px', margin: '0 0 8px 0' }}>Email: <span style={{ color: '#fff' }}>{displayBandProfile.email || '-'}</span></p>
                <p style={{ color: '#777', fontSize: '12px', margin: 0 }}>Instagram: <span style={{ color: '#fff' }}>{displayBandProfile.instagram || '-'}</span></p>
                {showBandContactForm ? (
                  <form onSubmit={handleMessageSubmit} style={{ display: 'grid', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #141414' }}>
                    <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: 0 }}>KIRIM PESAN KE {(displayBandProfile.name || signatureName || 'BAND INI').toUpperCase()}</p>
                    <input type="text" placeholder="NAMA PENGIRIM" value={messageDraft.sender} onChange={(e) => setMessageDraft({ ...messageDraft, sender: e.target.value })} required style={formInputStyle} />
                    <input type="text" placeholder="KONTAK BALASAN" value={messageDraft.contact} onChange={(e) => setMessageDraft({ ...messageDraft, contact: e.target.value })} required style={formInputStyle} />
                    <input type="text" placeholder="SUBJEK" value={messageDraft.subject} onChange={(e) => setMessageDraft({ ...messageDraft, subject: e.target.value })} required style={formInputStyle} />
                    <textarea placeholder="ISI PESAN / AJAKAN KOLABORASI / UNDANGAN GIGS" value={messageDraft.body} onChange={(e) => setMessageDraft({ ...messageDraft, body: e.target.value })} required rows={5} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                    <button type="submit" style={{ ...glassButtonStyle, width: '100%', padding: '12px', fontSize: '12px' }}>KIRIM MESSAGE</button>
                  </form>
                ) : (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #141414' }}>
                    <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Ini profile band lu sendiri, jadi form kirim pesan disembunyikan.</p>
                  </div>
                )}
              </section>

              <section style={{ ...glassStyle('band-public-merch'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>MERCHANDISE</h3>
                {displayBandMerchItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Belum ada merchandise. Kelola etalase merch dari tombol owner actions.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {displayBandMerchItems.slice(0, 4).map((item) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: '10px', alignItems: 'center', padding: '8px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        <div style={{ width: '54px', height: '54px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{item.name.toUpperCase()}</p>
                          <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
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
              <p style={pageLeadStyle}>Upload pamflet masuk antrean kurasi admin untuk homepage. Jadwal manggung biasa cukup ditambah sendiri dan hanya tampil di profile band.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '24px', alignItems: 'start' }}>
            <form onSubmit={handleBandSubmit} style={{ ...glassStyle('gig-upload-form'), padding: '20px', backgroundColor: '#090909' }}>
              <h3 style={sectionHeadingStyle}>UPLOAD PAMFLET EVENT</h3>
              <p style={{ color: '#666', fontSize: '12px', margin: '0 0 18px 0', lineHeight: 1.4 }}>Isi data gigs, lalu kirim ke admin WiSpace untuk dicek sebelum tampil publik.</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input type="text" placeholder="NAMA ACARA / CONCERT" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="KOTA / VENUE" value={newCity} onChange={(e) => setNewCity(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="GENRE / SUB-SKENA" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} style={formInputStyle} />
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="HTM (Contoh: FREE / Rp 50.000)" value={newHtm} onChange={(e) => setNewHtm(e.target.value)} required style={formInputStyle} />
                <input type="text" placeholder="CONTACT PERSON (WA/IG: @bandmu)" value={newCp} onChange={(e) => setNewCp(e.target.value)} required style={formInputStyle} />
              </div>
              <label style={{ display: 'block', marginTop: '14px', cursor: 'pointer' }}>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleGigPosterImport} style={{ display: 'none' }} />
                <div style={{ minHeight: '220px', border: '1px dashed rgba(0,210,255,0.45)', borderRadius: '14px', backgroundColor: '#000', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                  {newPosterImage ? (
                    <img src={newPosterImage} alt="Preview pamflet event" style={{ width: '100%', height: '100%', maxHeight: '320px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px' }}>
                      <p style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1px' }}>UPLOAD GAMBAR PAMFLET</p>
                      <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>Klik area ini untuk pilih JPG, PNG, atau WEBP.</p>
                    </div>
                  )}
                </div>
              </label>
              {newPosterName && <p style={{ color: '#aaa', fontSize: '11px', fontWeight: '900', margin: '8px 0 0 0' }}>FILE: {newPosterName}</p>}
              {newPosterNotice && <p style={{ color: newPosterNotice.includes('Ideal') ? '#ffcc00' : '#39ff14', fontSize: '11px', lineHeight: 1.45, margin: '6px 0 0 0' }}>{newPosterNotice}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'free' ? '1px solid #39ff14' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'free' ? 'rgba(57,255,20,0.12)' : '#000', color: newGigRequestType === 'free' ? '#39ff14' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE BULLETIN</button>
                <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'exclusive' ? '1px solid #00d2ff' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.14)' : '#000', color: newGigRequestType === 'exclusive' ? '#00d2ff' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXCLUSIVE SLIDE</button>
              </div>
              <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#000', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.32)' : 'rgba(57,255,20,0.24)'}`, borderRadius: '14px' }}>
                <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE EVENT SLOT' : 'FREE BULLETIN SLOT'}</p>
                <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{newGigRequestType === 'exclusive' ? `Request berbayar Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} untuk masuk slide besar homepage. Admin cek konten dulu, lalu pembayaran, lalu activate 10 hari.` : 'Request gratis untuk masuk bulletin gigs homepage dan jadwal manggung publik setelah dicek admin.'}</p>
                <p style={{ color: '#ffcc00', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>MASA TAYANG: 10 HARI SEJAK ADMIN APPROVE. Setelah lewat tanggal tayang, pamflet perlu diajukan ulang.</p>
                <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>UKURAN DISARANKAN: {posterUploadGuide.size} / {posterUploadGuide.ratio} / MAX 2MB</p>
                <p style={{ color: '#666', fontSize: '11px', lineHeight: 1.4, margin: '5px 0 0 0' }}>{posterUploadGuide.note}</p>
              </div>
              <button type="submit" style={{ width: '100%', padding: '14px', marginTop: '16px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>KIRIM KE ANTREAN KURASI</button>
            </form>

            <div style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...glassStyle('band-schedule-form'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 8px 0' }}>TAMBAH JADWAL MANGGUNG</h3>
                <p style={{ color: '#666', fontSize: '12px', lineHeight: 1.45, margin: '0 0 16px 0' }}>Untuk agenda tampil di profile band saja. Tidak masuk homepage, tidak perlu free/exclusive, dan tidak masuk antrean admin.</p>
                <form onSubmit={handleScheduleSubmit} style={{ display: 'grid', gap: '12px' }}>
                  <input type="text" placeholder="NAMA ACARA / SHOWCASE" value={scheduleDraft.title} onChange={(event) => setScheduleDraft({ ...scheduleDraft, title: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="VENUE / KOTA" value={scheduleDraft.venue} onChange={(event) => setScheduleDraft({ ...scheduleDraft, venue: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="TANGGAL MANGGUNG" value={scheduleDraft.date} onChange={(event) => setScheduleDraft({ ...scheduleDraft, date: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="HTM / INFO TIKET" value={scheduleDraft.htm} onChange={(event) => setScheduleDraft({ ...scheduleDraft, htm: event.target.value })} required style={formInputStyle} />
                  <input type="text" placeholder="CONTACT PERSON / LINK INFO" value={scheduleDraft.cp} onChange={(event) => setScheduleDraft({ ...scheduleDraft, cp: event.target.value })} required style={formInputStyle} />
                  <button type="submit" style={{ ...glassButtonStyle, width: '100%', padding: '12px', fontSize: '12px' }}>SIMPAN JADWAL PROFILE</button>
                </form>
              </section>

              <section style={{ ...glassStyle('gig-status'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>STATUS PAMFLET</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>PENDING</p>
                    <strong style={{ color: '#ffcc00', fontSize: '22px' }}>{pendingGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>FREE</p>
                    <strong style={{ color: '#39ff14', fontSize: '22px' }}>{approvedFreeGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>BAYAR</p>
                    <strong style={{ color: '#ffcc00', fontSize: '22px' }}>{exclusiveWaitingPaymentGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>EXCLUSIVE</p>
                    <strong style={{ color: '#00d2ff', fontSize: '22px' }}>{approvedExclusiveGigs.length}</strong>
                  </div>
                </div>

                {gigs.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada pamflet yang pernah dikirim.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {gigs.slice(0, 6).map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{gig.title?.toUpperCase()}</p>
                          <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>{gig.city} / {getGigDate(gig)}</p>
                          {gig.status === 'approved_waiting_payment' && (
                            <p style={{ color: '#ffcc00', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>KONTEN DISETUJUI - BAYAR RP {EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} UNTUK LANJUT</p>
                          )}
                          {gig.status === 'paid_waiting_activation' && (
                            <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>PAYMENT RECEIVED - MENUNGGU ADMIN ACTIVATE</p>
                          )}
                          {isApprovedHomepageGig(gig) && (
                            <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>TAYANG SAMPAI: {getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</p>
                          )}
                        </div>
                        {gig.status === 'approved_waiting_payment' ? (
                          <button onClick={() => handleGigExclusivePayment(gig)} style={{ padding: '9px 10px', backgroundColor: '#ffcc00', color: '#000', border: 'none', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BAYAR</button>
                        ) : (
                          <span style={{ color: getGigStatusColor(gig.status), fontSize: '10px', fontWeight: '900', textAlign: 'right' }}>{getGigStatusLabel(gig.status)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ ...glassStyle('gig-public-schedule'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>PAMFLET APPROVED HOMEPAGE</h3>
                {filteredPublicGigs.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada pamflet free/exclusive yang approved untuk homepage.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {filteredPublicGigs.slice(0, 5).map((gig) => (
                      <div key={gig.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '12px', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        {renderGigPosterImage(gig, { width: '72px', height: '90px', objectFit: 'cover', borderRadius: '8px' })}
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: '0 0 6px 0' }}>{gig.title?.toUpperCase()}</h4>
                          <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{gig.city} / {getGigDate(gig)} / {getGigHtm(gig)}</p>
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
              <p style={pageLeadStyle}>Halaman akun penikmat musik. Audience tetap simpel: cek identitas akun, koleksi, message, dan akses rilisan yang sudah dibeli.</p>
            </div>
            <button onClick={() => { setActivePage('audience_library'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>BUKA LIBRARY</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: splitGridColumns, gap: '24px', alignItems: 'start' }}>
            <aside style={{ ...glassStyle('audience-account-card'), padding: '22px', backgroundColor: '#090909' }}>
              <div style={{ width: '92px', height: '92px', borderRadius: '18px', backgroundColor: '#000', border: '2px solid rgba(0,210,255,0.65)', display: 'grid', placeItems: 'center', boxShadow: '0 0 30px rgba(0,210,255,0.16)', marginBottom: '18px', overflow: 'hidden' }}>
                {audienceProfile.photoPreview ? (
                  <img src={audienceProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={38} color="#00d2ff" />
                )}
              </div>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>ACCOUNT NAME</p>
              <h3 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', margin: '0 0 16px 0', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{audienceProfile.displayName || userSession?.email || 'AUDIENCE WISPACE'}</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>EMAIL</span><strong style={{ color: '#fff', textAlign: 'right', overflowWrap: 'anywhere' }}>{userSession?.email || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>ROLE</span><strong style={{ color: '#00d2ff' }}>{(userRole || 'audience').toUpperCase()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>KOTA</span><strong style={{ color: '#fff', textAlign: 'right' }}>{audienceProfile.city || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>GENRE</span><strong style={{ color: '#fff', textAlign: 'right' }}>{audienceProfile.favoriteGenre || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>STATUS</span><strong style={{ color: '#39ff14' }}>VERIFIED</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>PROFILE DETAIL</span><strong style={{ color: '#fff' }}>LIMITED</strong>
                </div>
              </div>
            </aside>

            <div style={{ display: 'grid', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                <div style={{ ...glassStyle('audience-owned-stat'), padding: '18px', backgroundColor: '#090909' }}>
                  <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>OWNED ALBUMS</p>
                  <h3 style={{ color: '#00d2ff', fontSize: '32px', fontWeight: '900', margin: 0 }}>{purchasedAlbums.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-message-stat'), padding: '18px', backgroundColor: '#090909' }}>
                  <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>MESSAGES</p>
                  <h3 style={{ color: '#fff', fontSize: '32px', fontWeight: '900', margin: 0 }}>{visibleMessages.length}</h3>
                </div>
                <div style={{ ...glassStyle('audience-secure-stat'), padding: '18px', backgroundColor: '#090909' }}>
                  <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>SECURE ACCESS</p>
                  <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '900', margin: 0 }}>ON</h3>
                </div>
              </div>

              <section style={{ ...glassStyle('audience-actions'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>QUICK ACTIONS</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan' })} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>EXPLORE RILISAN</button>
                  <button onClick={() => { setActivePage('audience_library'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>MY LIBRARY</button>
                  <button onClick={() => { setActivePage('message_center'); markMessagesAsRead(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>MESSAGES</button>
                </div>
              </section>

              <form onSubmit={handleAudienceProfileSave} style={{ ...glassStyle('audience-private-form'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>PRIVATE ACCOUNT INFO</h3>
                <label style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: '14px', alignItems: 'center', padding: '14px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="file" accept="image/*" onChange={handleAudiencePhotoImport} style={{ display: 'none' }} />
                  <div style={{ width: '74px', height: '74px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#080808', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
                    {audienceProfile.photoPreview ? (
                      <img src={audienceProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={26} color="#00d2ff" />
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>GANTI FOTO PROFILE</span>
                    <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{audienceProfile.photoName || 'Upload foto akun audience lu.'}</p>
                  </div>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <input type="text" placeholder="NAMA TAMPILAN" value={audienceProfile.displayName} onChange={(event) => setAudienceProfile({ ...audienceProfile, displayName: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="KOTA / DOMISILI" value={audienceProfile.city} onChange={(event) => setAudienceProfile({ ...audienceProfile, city: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="GENRE FAVORIT" value={audienceProfile.favoriteGenre} onChange={(event) => setAudienceProfile({ ...audienceProfile, favoriteGenre: event.target.value })} style={formInputStyle} />
                  <input type="text" placeholder="KONTAK OPSIONAL" value={audienceProfile.contact} onChange={(event) => setAudienceProfile({ ...audienceProfile, contact: event.target.value })} style={formInputStyle} />
                </div>
                <button type="submit" style={{ width: '100%', padding: '13px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SIMPAN PROFILE AUDIENCE</button>
              </form>

              <section style={{ ...glassStyle('audience-profile-note'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0' }}>PROFILE AUDIENCE DIBIKIN SIMPLE</h3>
                <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Audience tidak perlu bikin halaman publik seperti band. Halaman publik, album, merch, jadwal manggung, dan tombol message tetap fokus di profile band.</p>
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
              <p style={pageLeadStyle}>Koleksi album digital yang sudah dibeli audience. Nanti file bisa masuk secret encrypted folder dan hanya bisa diakses dari WiSpace.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                {[
                  ['OWNED', purchasedAlbums.length],
                  ['ACCESS', 'ENCRYPTED'],
                  ['REDISTRIBUTION', 'DILARANG']
                ].map(([label, value]) => (
                  <span key={label} style={{ padding: '7px 10px', backgroundColor: '#000', border: `1px solid ${label === 'REDISTRIBUTION' ? 'rgba(255,51,51,0.22)' : 'rgba(0,210,255,0.18)'}`, borderRadius: '9999px', color: label === 'REDISTRIBUTION' ? '#ff3333' : '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '0.6px' }}>
                    {label}: <strong style={{ color: label === 'REDISTRIBUTION' ? '#ff3333' : '#fff' }}>{value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {purchasedAlbums.length === 0 ? (
            <div style={{ ...glassStyle('library-empty'), padding: '28px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: '0 0 10px 0' }}>LIBRARY MASIH KOSONG</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Buka Explore, pilih album digital, lalu klik beli. Untuk sekarang masih mock purchase dulu.</p>
              <button onClick={() => navigateInternalPage('explore', { exploreTab: 'rilisan' })} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE RILISAN</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: libraryDetailGridColumns, gap: '24px', alignItems: 'start' }}>
              <section style={{ ...glassStyle('library-list'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>PURCHASED RELEASES</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {purchasedAlbums.map((album) => {
                    const isSelectedLibraryItem = selectedLibraryItem?.id === album.id;
                    const firstTrack = album.tracks?.[0] || null;

                    return (
                    <article
                      key={album.id}
                      onClick={() => setSelectedLibraryItemId(album.id)}
                      style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px', backgroundColor: isSelectedLibraryItem ? 'rgba(0,210,255,0.06)' : '#000', border: isSelectedLibraryItem ? '1px solid rgba(0,210,255,0.45)' : '1px solid #141414', borderRadius: '12px', cursor: 'pointer' }}
                    >
                      <div style={{ width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                        {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>COVER</span>}
                      </div>
                      <div>
                        <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 5px 0' }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: '#777', fontSize: '12px', margin: 0 }}>{album.bandName.toUpperCase()} / {album.purchaseType === 'track' ? `TRACK SINGLE FROM ${album.parentAlbumTitle?.toUpperCase()}` : `${album.trackCount} TRACK`} / {album.purchasedAt}</p>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedLibraryItemId(album.id);
                          if (firstTrack) handlePlayLibraryTrack(firstTrack, album, album.tracks || [firstTrack]);
                        }}
                        style={{ ...glassButtonStyle, padding: '8px 12px', fontSize: '11px' }}
                      >
                        {activeTrack?.id === `library-${album.id}-${firstTrack?.id}` && isPlaying ? 'PAUSE' : 'PLAY'}
                      </button>
                    </article>
                    );
                  })}
                </div>
              </section>

              <aside style={{ ...glassStyle('library-player'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 16px 0' }}>SECURE PLAYER</h3>
                <div style={{ display: 'grid', gridTemplateColumns: isTinyLayout ? '96px 1fr' : '118px 1fr', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ width: isTinyLayout ? '96px' : '118px', aspectRatio: '1/1', borderRadius: '14px', backgroundColor: '#000', border: '1px solid #141414', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {selectedLibraryItem?.coverPreview ? <img src={selectedLibraryItem.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '11px', fontWeight: '900' }}>PLAYER</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ color: '#fff', fontSize: '17px', fontWeight: '900', margin: '0 0 6px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLibraryItem?.title?.toUpperCase() || 'NO TRACK SELECTED'}</h4>
                        <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>{selectedLibraryItem?.bandName?.toUpperCase() || 'WISPACE'}</p>
                      </div>
                      <span style={{ flexShrink: 0, padding: '6px 8px', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9999px', color: '#fff', fontSize: '9px', fontWeight: '900' }}>{selectedLibraryItem?.purchaseType === 'track' ? 'TRACK' : 'ALBUM'}</span>
                    </div>
                    <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>Secret encrypted access. Full playback buat archive yang sudah dibeli.</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '9px', marginBottom: '16px' }}>
                  {selectedLibraryTracks.map((track, index) => {
                    const libraryTrackId = `library-${selectedLibraryItem?.id || 'item'}-${track.id}`;
                    const isLibraryTrackActive = activeTrack?.id === libraryTrackId && isPlaying;

                    return (
                      <div key={track.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{String(index + 1).padStart(2, '0')} / {track.title?.toUpperCase() || 'UNTITLED TRACK'}</p>
                          <p style={{ color: '#555', fontSize: '11px', margin: 0 }}>FULL OWNED PLAYBACK</p>
                        </div>
                        <button onClick={() => handlePlayLibraryTrack(track)} style={{ ...glassButtonStyle, padding: '8px 11px', fontSize: '10px' }}>{isLibraryTrackActive ? 'PAUSE' : 'PLAY'}</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => selectedLibraryTracks[0] && handlePlayLibraryTrack(selectedLibraryTracks[0])} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px' }}>PLAY {selectedLibraryItem?.purchaseType === 'track' ? 'TRACK' : 'ALBUM'}</button>
                  <button style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SECURE DOWNLOAD</button>
                </div>
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
              <p style={pageLeadStyle}>{isBandAccount ? 'Pesan dari audience, band lain, promotor, dan kolaborator event masuk di sini. Band bisa membalas langsung dari inbox.' : 'Pesan akun audience masuk di sini. Untuk kirim pesan ke band, buka halaman profile band lalu pakai form message di sana.'}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '24px', alignItems: 'start' }}>
            <section style={{ ...glassStyle('message-inbox'), padding: '20px', backgroundColor: '#090909' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>INBOX</h3>
                <span style={{ color: unreadMessages ? '#ff3333' : '#666', fontSize: '11px', fontWeight: '900' }}>{unreadMessages} NEW</span>
              </div>

              {visibleMessages.length === 0 ? (
                <div style={{ padding: '24px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px' }}>
                  <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '900', margin: '0 0 8px 0' }}>INBOX MASIH KOSONG</h4>
                  <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px 0' }}>{isBandAccount ? 'Belum ada pesan baru dari audience, promotor, atau band lain.' : 'Belum ada pesan masuk untuk akun audience ini.'}</p>
                  {!isBandAccount && (
                    <button onClick={() => navigateInternalPage('explore', { exploreTab: 'band' })} style={{ ...glassButtonStyle, padding: '11px 16px', fontSize: '12px' }}>CARI BAND DI EXPLORE</button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {visibleMessages.map((message) => (
                    <article key={message.id} style={{ padding: '14px', backgroundColor: '#000', border: message.read ? '1px solid #141414' : '1px solid rgba(0,210,255,0.38)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: 0 }}>{message.sender.toUpperCase()}</p>
                        <span style={{ color: message.read ? '#666' : '#00d2ff', fontSize: '10px', fontWeight: '900' }}>{message.read ? message.createdAt : 'NEW'}</span>
                      </div>
                      <h4 style={{ color: '#00d2ff', fontSize: '13px', fontWeight: '900', margin: '0 0 8px 0' }}>{message.subject}</h4>
                      <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.5, margin: '0 0 10px 0' }}>{message.body}</p>
                      <p style={{ color: '#666', fontSize: '12px', margin: '0 0 12px 0' }}>Kontak: <span style={{ color: '#fff' }}>{message.contact}</span></p>
                      {message.replied && (
                        <div style={{ padding: '10px', backgroundColor: 'rgba(0,210,255,0.06)', border: '1px solid rgba(0,210,255,0.18)', borderRadius: '10px', marginBottom: '12px' }}>
                          <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>BALASAN TERAKHIR</p>
                          <p style={{ color: '#ddd', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{message.lastReply}</p>
                        </div>
                      )}
                      {isBandAccount && activeReplyId === message.id ? (
                        <form onSubmit={(event) => handleReplySubmit(event, message)} style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                          <textarea placeholder={`BALAS KE ${message.sender.toUpperCase()}`} value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows={4} style={{ ...formInputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button type="submit" style={{ ...glassButtonStyle, padding: '10px', fontSize: '11px' }}>KIRIM REPLY</button>
                            <button type="button" onClick={() => { setActiveReplyId(null); setReplyDraft(''); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BATAL</button>
                          </div>
                        </form>
                      ) : isBandAccount ? (
                        <button onClick={() => { setActiveReplyId(message.id); setReplyDraft(message.lastReply || ''); }} style={{ ...glassButtonStyle, padding: '9px 14px', fontSize: '11px' }}>REPLY</button>
                      ) : (
                        <span style={{ display: 'inline-flex', width: 'fit-content', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9999px', color: '#777', fontSize: '11px', fontWeight: '900' }}>READ ONLY</span>
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
        <section style={{ ...pageShellStyle, border: '1px solid rgba(57,255,20,0.2)' }}>
          <div style={pageHeaderStyle}>
            <div>
              <p style={{ ...eyebrowStyle, color: '#39ff14' }}>BAND FINANCE DASHBOARD</p>
              <h2 style={pageTitleStyle}>PENGHASILAN & PENCAIRAN</h2>
              <p style={pageLeadStyle}>Pantau saldo, target pencairan Rp 100.000, revenue share 80/20, dan jadwal payout tiap tanggal 1.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
            <div style={{ ...glassStyle('finance-balance'), padding: '20px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>SALDO SIAP CAIR</p>
              <h3 style={{ color: '#fff', fontSize: '34px', fontWeight: '900', margin: 0 }}>Rp {bandBalance.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-gross'), padding: '20px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>GROSS SALES</p>
              <h3 style={{ color: '#fff', fontSize: '34px', fontWeight: '900', margin: 0 }}>Rp {bandGrossRevenue.toLocaleString('id-ID')}</h3>
            </div>
            <div style={{ ...glassStyle('finance-minimum'), padding: '20px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>MINIMUM PENARIKAN</p>
              <h3 style={{ color: '#fff', fontSize: '34px', fontWeight: '900', margin: 0 }}>Rp 100.000</h3>
            </div>
            <div style={{ ...glassStyle('finance-split'), padding: '20px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>REVENUE SHARE</p>
              <h3 style={{ color: '#fff', fontSize: '34px', fontWeight: '900', margin: 0 }}>80 / 20</h3>
            </div>
          </div>

          <div style={{ ...glassStyle('finance-progress'), padding: '22px', backgroundColor: '#090909', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', color: '#aaa', fontSize: '12px', fontWeight: '900' }}>
              <span>PROGRESS MENUJU PENCAIRAN</span>
              <span>{Math.min(100, Math.round((bandBalance / 100000) * 100))}%</span>
            </div>
            <div style={{ height: '10px', backgroundColor: '#000', borderRadius: '9999px', overflow: 'hidden', border: '1px solid #141414' }}>
              <div style={{ width: `${Math.min(100, (bandBalance / 100000) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #39ff14, #00d2ff)' }} />
            </div>
            <p style={{ color: bandBalance >= 100000 ? '#39ff14' : '#ff3333', fontSize: '12px', fontWeight: '900', margin: '12px 0 0 0' }}>{bandBalance >= 100000 ? 'Saldo sudah memenuhi minimum pencairan.' : `Kurang Rp ${(100000 - bandBalance).toLocaleString('id-ID')} lagi untuk pencairan.`}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '18px' }}>
            <section style={{ ...glassStyle('finance-rules'), padding: '20px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#39ff14', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>ATURAN PENCAIRAN</h3>
              <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Pencairan diproses setiap tanggal 1. Minimum saldo Rp 100.000. WiSpace mengambil flat 20% dari penjualan bersih, band menerima 80%.</p>
            </section>
            <section style={{ ...glassStyle('finance-history'), padding: '20px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#39ff14', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>RIWAYAT TRANSAKSI</h3>
              {financeTransactions.length === 0 ? (
                <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Belum ada transaksi. Pembelian album, track, dan merch akan masuk sini dengan split 80/20.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {financeTransactions.slice(0, 10).map((transaction) => (
                    <div key={transaction.id} style={{ padding: '12px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: '#39ff14', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>{transaction.productType.toUpperCase()} / {transaction.createdAt}</p>
                          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transaction.productTitle.toUpperCase()}</h4>
                        </div>
                        <strong style={{ color: '#fff', fontSize: '13px', flexShrink: 0 }}>Rp {Number(transaction.bandNet || 0).toLocaleString('id-ID')}</strong>
                      </div>
                      <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.45, margin: 0 }}>Buyer: {transaction.buyerName} / Gross Rp {Number(transaction.grossAmount || 0).toLocaleString('id-ID')} / Payment {(transaction.paymentStatus || transaction.status || 'paid').toUpperCase()} / Payout {(transaction.payoutStatus || 'available_next_cycle').replaceAll('_', ' ').toUpperCase()}</p>
                    </div>
                  ))}
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
              <p style={pageLeadStyle}>Page khusus musisi buat bangun halaman band publik, import foto, isi kontak, siapin album digital, dan kelola merchandise.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: studioGridColumns, gap: '24px', alignItems: 'start' }}>
            <aside style={{ ...glassStyle('band-preview'), padding: '18px', backgroundColor: '#090909' }}>
              <div style={{ position: 'relative', minHeight: '210px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '18px' }}>
                {bandProfile.coverPreview ? (
                  <img src={bandProfile.coverPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #050505 0%, #09232b 52%, #000 100%)' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.18))' }} />
                <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '16px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                  <div style={{ width: '86px', height: '86px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000', border: '2px solid rgba(0,210,255,0.7)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {bandProfile.photoPreview ? (
                      <img src={bandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: '#333', fontSize: '11px', fontWeight: '900' }}>FOTO</span>
                    )}
                  </div>
                  <div>
                    <p style={{ color: bandProfile.isPublished ? '#39ff14' : '#ffcc00', fontSize: '10px', fontWeight: '900', margin: '0 0 6px 0' }}>{bandProfile.isPublished ? 'PUBLIC DRAFT' : 'DRAFT BELUM DISIMPAN'}</p>
                    <h3 style={{ color: '#fff', fontSize: '24px', fontWeight: '900', margin: 0, lineHeight: 1 }}>{(bandProfile.name || signatureName || 'NAMA BAND').toUpperCase()}</h3>
                  </div>
                </div>
              </div>
              <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>PUBLIC BAND PAGE PREVIEW</p>
              <p style={{ color: '#777', fontSize: '12px', fontWeight: '700', margin: '0 0 8px 0' }}>wispace.my.id{getBandProfilePath()}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '0 0 12px 0' }}>
                <div style={{ padding: '10px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.18)', borderRadius: '12px' }}>
                  <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 4px 0' }}>SUBSCRIBERS</p>
                  <strong style={{ color: '#00d2ff', fontSize: '18px' }}>{bandSubscriberCount.toLocaleString('id-ID')}</strong>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#000', border: '1px solid rgba(57,255,20,0.16)', borderRadius: '12px' }}>
                  <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 4px 0' }}>NOTIF BARU</p>
                  <strong style={{ color: unreadBandNotifications ? '#39ff14' : '#555', fontSize: '18px' }}>{unreadBandNotifications}</strong>
                </div>
              </div>
              <p style={{ color: '#fff', fontSize: '14px', fontWeight: '900', lineHeight: 1.35, margin: '0 0 10px 0' }}>{bandProfile.headline || 'Headline singkat band akan tampil di sini.'}</p>
              <p style={{ color: '#777', fontSize: '12px', fontWeight: '700', margin: '0 0 14px 0' }}>{(bandProfile.city || 'KOTA').toUpperCase()} / {(bandProfile.genre || 'GENRE').toUpperCase()}{bandProfile.formedYear ? ` / SINCE ${bandProfile.formedYear}` : ''}</p>
              <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.5, margin: '0 0 18px 0' }}>{bandProfile.bio || 'Bio band akan tampil di sini. Audience bisa lihat cerita singkat, karakter musik, dan info rilisan band.'}</p>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>CP</span><strong style={{ color: '#fff', textAlign: 'right' }}>{bandProfile.cp || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>EMAIL</span><strong style={{ color: '#fff', textAlign: 'right' }}>{bandProfile.email || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderTop: '1px solid #141414', color: '#777', fontSize: '12px' }}>
                  <span>INSTAGRAM</span><strong style={{ color: '#fff', textAlign: 'right' }}>{bandProfile.instagram || '-'}</strong>
                </div>
              </div>
              <button onClick={() => openBandPublicProfile(true)} style={{ ...glassButtonStyle, width: '100%', padding: '10px', fontSize: '11px', marginBottom: '18px' }}>BUKA PUBLIC PREVIEW</button>
              <div style={{ borderTop: '1px solid #141414', paddingTop: '14px', marginBottom: '14px' }}>
                <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>PROMO PLAYER</h4>
                {bandPublicTracks.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>Maksimal 5 lagu promo tampil di public profile. Pilih 1 track free full saat upload album.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {bandPublicTracks.slice(0, 3).map((track) => (
                      <div key={`studio-${track.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '8px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '10px', color: '#ddd', fontSize: '11px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title.toUpperCase()}</span>
                        <strong style={{ color: track.freeFull ? '#39ff14' : '#00d2ff', flexShrink: 0 }}>{track.freeFull ? 'FULL' : '30S'}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid #141414', paddingTop: '14px' }}>
                <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>MERCHANDISE SHELF</h4>
                {merchItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>Nanti bagian ini bisa jadi tempat jual kaos, CD, kaset, stiker, bundle album, dan item fisik lain milik band.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {merchItems.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: '10px', alignItems: 'center', padding: '8px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                        <div style={{ width: '54px', height: '54px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                          {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>MERCH</span>}
                        </div>
                        <div>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 4px 0' }}>{item.name.toUpperCase()}</p>
                          <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <div style={{ ...glassStyle('band-editor'), padding: '18px', backgroundColor: '#090909' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #141414', paddingBottom: '12px' }}>
                {['profile', 'album', 'merch', 'artikel'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBandProfileTab(tab)}
                    style={{ padding: '10px 16px', backgroundColor: bandProfileTab === tab ? '#00d2ff' : 'transparent', color: bandProfileTab === tab ? '#000' : '#777', border: bandProfileTab === tab ? 'none' : '1px solid #222', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}
                  >
                    {tab === 'profile' ? 'PROFILE BAND' : tab === 'album' ? 'UPLOAD ALBUM' : tab === 'merch' ? 'MERCHANDISE' : 'ARTIKEL'}
                  </button>
                ))}
              </div>

              {bandProfileTab === 'profile' && (
                <form onSubmit={handleBandProfileSave}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="NAMA BAND" value={bandProfile.name} onChange={(e) => setBandProfile({ ...bandProfile, name: e.target.value, slug: bandProfile.slug || createSlug(e.target.value) })} style={formInputStyle} />
                    <input type="text" placeholder="URL SLUG (contoh: skena-noise)" value={bandProfile.slug} onChange={(e) => setBandProfile({ ...bandProfile, slug: createSlug(e.target.value) })} style={formInputStyle} />
                    <input type="text" placeholder="HEADLINE SINGKAT" value={bandProfile.headline} onChange={(e) => setBandProfile({ ...bandProfile, headline: e.target.value })} style={formInputStyle} />
                    <input type="text" placeholder="KOTA / DOMISILI" value={bandProfile.city} onChange={(e) => setBandProfile({ ...bandProfile, city: e.target.value })} style={formInputStyle} />
                    <input type="text" placeholder="GENRE / SUB-SKENA" value={bandProfile.genre} onChange={(e) => setBandProfile({ ...bandProfile, genre: e.target.value })} style={formInputStyle} />
                    <input type="text" placeholder="TAHUN AKTIF / TERBENTUK" value={bandProfile.formedYear} onChange={(e) => setBandProfile({ ...bandProfile, formedYear: e.target.value })} style={formInputStyle} />
                    <input type="text" placeholder="CP / WHATSAPP" value={bandProfile.cp} onChange={(e) => setBandProfile({ ...bandProfile, cp: e.target.value })} style={formInputStyle} />
                    <input type="email" placeholder="EMAIL BAND" value={bandProfile.email} onChange={(e) => setBandProfile({ ...bandProfile, email: e.target.value })} style={formInputStyle} />
                    <input type="text" placeholder="INSTAGRAM / SOSMED" value={bandProfile.instagram} onChange={(e) => setBandProfile({ ...bandProfile, instagram: e.target.value })} style={formInputStyle} />
                  </div>
                  <textarea placeholder="BIO BAND" value={bandProfile.bio} onChange={(e) => setBandProfile({ ...bandProfile, bio: e.target.value })} rows={6} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <label style={{ display: 'block', padding: '18px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleBandCoverImport} style={{ display: 'none' }} />
                      <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>IMPORT COVER / BANNER</span>
                      <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{bandProfile.coverName || 'Gambar lebar untuk header profile band.'}</p>
                    </label>
                    <label style={{ display: 'block', padding: '18px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleBandPhotoImport} style={{ display: 'none' }} />
                      <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>IMPORT FOTO BAND</span>
                      <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{bandProfile.photoName || 'Foto utama/avatar band.'}</p>
                    </label>
                  </div>
                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SIMPAN PROFILE BAND</button>
                </form>
              )}

              {bandProfileTab === 'album' && (
                <form onSubmit={handleAlbumDraftSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="JUDUL ALBUM / EP" value={albumDraft.title} onChange={(e) => setAlbumDraft({ ...albumDraft, title: e.target.value })} required style={formInputStyle} />
                    <input type="number" min="0" placeholder="HARGA JUAL (Rp)" value={albumDraft.price} onChange={(e) => setAlbumDraft({ ...albumDraft, price: e.target.value })} required style={formInputStyle} />
                  </div>
                  <textarea placeholder="DESKRIPSI ALBUM / CATATAN RILISAN" value={albumDraft.description} onChange={(e) => setAlbumDraft({ ...albumDraft, description: e.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer' }}>
                      <input type="file" accept="image/*" onChange={handleAlbumCoverImport} style={{ display: 'none' }} />
                      <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>IMPORT COVER ALBUM</span>
                      <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{albumDraft.coverName || 'Artwork/cover album.'}</p>
                    </label>
                    <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer' }}>
                      <input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" multiple onChange={handleAlbumAudioImport} style={{ display: 'none' }} />
                      <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>IMPORT MP3 / WAV</span>
                      <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{albumDraft.audioFiles.length ? `${albumDraft.audioFiles.length} file siap upload` : 'Pilih semua track album.'}</p>
                    </label>
                  </div>

                  {albumDraft.audioFiles.length > 0 && (
                    <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>TRACK FILES</p>
                      <p style={{ color: hasFreeFullBandTrack ? '#555' : '#00d2ff', fontSize: '11px', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                        {hasFreeFullBandTrack ? 'Band ini sudah punya 1 lagu free full. Track baru tetap jadi preview 30 detik.' : 'Opsional: pilih 1 lagu sebagai FREE FULL LISTEN. Track lain otomatis preview 30 detik.'}
                      </p>
                      {albumDraft.audioFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: hasFreeFullBandTrack ? '1fr minmax(88px, 120px) auto' : 'auto 1fr minmax(88px, 120px) auto', gap: '10px', padding: '8px 0', borderTop: index ? '1px solid #111' : 'none', color: '#ddd', fontSize: '12px', alignItems: 'center' }}>
                          {!hasFreeFullBandTrack && (
                            <input
                              type="radio"
                              name="free-track"
                              checked={String(albumDraft.freeTrackIndex) === String(index)}
                              onChange={() => setAlbumDraft({ ...albumDraft, freeTrackIndex: index })}
                              title="Jadikan lagu ini free full listen"
                            />
                          )}
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(index + 1).padStart(2, '0')} / {file.name}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Rp/track"
                            value={file.price}
                            onChange={(event) => updateAlbumTrackPrice(index, event.target.value)}
                            style={{ width: '100%', backgroundColor: '#050505', border: '1px solid #222', borderRadius: '10px', color: '#fff', padding: '8px', fontSize: '11px', fontFamily: FONT_STACK, boxSizing: 'border-box' }}
                          />
                          <span style={{ color: String(albumDraft.freeTrackIndex) === String(index) && !hasFreeFullBandTrack ? '#39ff14' : '#666', fontWeight: '900' }}>
                            {String(albumDraft.freeTrackIndex) === String(index) && !hasFreeFullBandTrack ? 'FREE FULL' : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                        </div>
                      ))}
                      {!hasFreeFullBandTrack && albumDraft.freeTrackIndex !== '' && (
                        <button type="button" onClick={() => setAlbumDraft({ ...albumDraft, freeTrackIndex: '' })} style={{ marginTop: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#aaa', borderRadius: '10px', padding: '8px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>BATALKAN FREE FULL</button>
                      )}
                    </div>
                  )}

                  <div style={{ backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.2)', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
                    <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 8px 0' }}>AGREEMENT UPLOAD ALBUM</p>
                    <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: '0 0 12px 0' }}>Band menyatakan punya hak atas karya ini. Penjualan dibagi 80% untuk band dan 20% untuk WiSpace dari penjualan bersih. Pencairan minimal Rp 100.000 setiap tanggal 1.</p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '12px', fontWeight: '800', marginBottom: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={albumDraft.accepted} onChange={(e) => setAlbumDraft({ ...albumDraft, accepted: e.target.checked })} />
                      SAYA SETUJU DAN BERTANGGUNG JAWAB ATAS KARYA INI
                    </label>
                    <input type="text" placeholder="NAMA PENANGGUNG JAWAB / TTD DIGITAL" value={albumDraft.signature} onChange={(e) => setAlbumDraft({ ...albumDraft, signature: e.target.value })} style={formInputStyle} />
                  </div>

                  {displayBandAlbums.length > 0 && (
                    <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>RILISAN YANG SUDAH DIUPLOAD</p>
                      {displayBandAlbums.map((album) => (
                        <div key={album.id} style={{ padding: '10px 0', borderTop: '1px solid #111', color: '#ddd', fontSize: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '10px', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '900' }}>{album.title}</span>
                            <span style={{ color: '#00d2ff', fontWeight: '900' }}>{album.trackCount || 0} TRACK</span>
                            <button type="button" onClick={() => handleDeleteAlbum(album)} style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.35)', color: '#ff3333', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE ALBUM</button>
                          </div>
                          {(album.tracks || []).length > 0 && (
                            <div style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
                              {(album.tracks || []).map((track, index) => (
                                <div key={track.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', alignItems: 'center', padding: '7px 8px', backgroundColor: '#050505', border: '1px solid #111', borderRadius: '10px' }}>
                                  <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(index + 1).padStart(2, '0')} / {track.title}</span>
                                  <button type="button" onClick={() => handleDeleteAlbumTrack(album, track)} style={{ background: 'transparent', border: '1px solid rgba(255,51,51,0.25)', color: '#ff6666', borderRadius: '9px', padding: '6px 8px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE LAGU</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SETUJUI & SIAPKAN UPLOAD ALBUM</button>
                </form>
              )}

              {bandProfileTab === 'merch' && (
                <form onSubmit={handleMerchDraftSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="NAMA MERCH (Kaos, CD, Kaset, Sticker)" value={merchDraft.name} onChange={(e) => setMerchDraft({ ...merchDraft, name: e.target.value })} required style={formInputStyle} />
                    <input type="number" min="0" placeholder="HARGA JUAL (Rp)" value={merchDraft.price} onChange={(e) => setMerchDraft({ ...merchDraft, price: e.target.value })} required style={formInputStyle} />
                    <input type="number" min="0" placeholder="STOK" value={merchDraft.stock} onChange={(e) => setMerchDraft({ ...merchDraft, stock: e.target.value })} required style={formInputStyle} />
                  </div>
                  <textarea placeholder="DESKRIPSI MERCH / SIZE / WARNA / DETAIL PENGIRIMAN" value={merchDraft.description} onChange={(e) => setMerchDraft({ ...merchDraft, description: e.target.value })} rows={4} style={{ ...formInputStyle, resize: 'vertical', marginBottom: '12px', lineHeight: 1.5 }} />
                  <label style={{ display: 'block', padding: '16px', border: '1px dashed rgba(0,210,255,0.35)', borderRadius: '14px', backgroundColor: '#000', cursor: 'pointer', marginBottom: '14px' }}>
                    <input type="file" accept="image/*" onChange={handleMerchImageImport} style={{ display: 'none' }} />
                    <span style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900' }}>IMPORT FOTO MERCH</span>
                    <p style={{ color: '#555', fontSize: '12px', margin: '6px 0 0 0' }}>{merchDraft.imageName || 'Foto produk untuk etalase band.'}</p>
                  </label>

                  {merchItems.length > 0 && (
                    <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>DRAFT MERCHANDISE</p>
                      {merchItems.map((item) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '10px', padding: '9px 0', borderTop: '1px solid #111', color: '#ddd', fontSize: '12px', alignItems: 'center' }}>
                          <span>{item.name}</span>
                          <span style={{ color: '#00d2ff', fontWeight: '900' }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</span>
                          <span style={{ color: '#666' }}>Stok {item.stock}</span>
                          <button type="button" onClick={() => handleDeleteMerch(item)} style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.35)', color: '#ff3333', borderRadius: '10px', padding: '7px 9px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>DELETE</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>TAMBAH KE ETALASE MERCH</button>
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
                    <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>DRAFT ARTIKEL BAND</p>
                      {articleItems.slice(0, 5).map((article) => (
                        <div key={article.id} style={{ padding: '10px 0', borderTop: '1px solid #111' }}>
                          <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                          <p style={{ color: '#777', fontSize: '11px', margin: 0 }}>{article.category} / {article.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>PUBLISH ARTIKEL DRAFT</button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* BULLETIN MADING GIGS */}
      {!loading && !isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={{ marginBottom: '60px' }}>
          <h2 style={{ fontSize: isTinyLayout ? '13px' : '15px', fontWeight: '900', color: '#f5f5f5', marginBottom: isTinyLayout ? '16px' : '24px', letterSpacing: '1.6px', display: 'flex', alignItems: 'center', gap: '8px' }}>UPDATED GIGS BULLETIN BOARD</h2>
          <div style={bulletinGridStyle}>
            {filteredGigs.map(gig => (
              <div 
                key={gig.id} 
                onMouseEnter={() => setHoveredCard(gig.id)} 
                onMouseLeave={() => setHoveredCard(null)} 
                onClick={() => setSelectedGigDetail(selectedGigDetail?.id === gig.id ? null : gig)} // Klik buat buka/tutup laci
                style={{ ...glassStyle(gig.id), ...bulletinCardStyle }}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowReportMenu(showReportMenu === gig.id ? null : gig.id);
                  }}
                  style={{ position: 'absolute', top: isTinyLayout ? '14px' : '22px', right: isTinyLayout ? '14px' : '22px', zIndex: 2, width: isTinyLayout ? '28px' : '34px', height: isTinyLayout ? '28px' : '34px', borderRadius: '9999px', border: '1px solid rgba(255, 51, 51, 0.35)', backgroundColor: 'rgba(0, 0, 0, 0.72)', color: '#ff3333', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                  aria-label="Laporkan acara"
                >
                  <AlertTriangle size={16} />
                </button>

                {showReportMenu === gig.id && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{ position: 'absolute', top: '62px', right: '14px', zIndex: 5, width: '190px', padding: '10px', backgroundColor: '#050505', border: '1px solid rgba(255, 51, 51, 0.35)', borderRadius: '12px', boxShadow: '0 18px 40px rgba(0,0,0,0.65)' }}
                  >
                    <p style={{ color: '#ff3333', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>LAPORKAN ACARA</p>
                    {['penipuan', 'poster palsu', 'info salah'].map((jenis) => (
                      <button
                        key={jenis}
                        onClick={() => handleKirimLaporan(gig.id, jenis)}
                        style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid #141414', color: '#ddd', fontSize: '11px', fontWeight: '800', padding: '8px 0', textAlign: 'left', cursor: 'pointer', fontFamily: FONT_STACK }}
                      >
                        {jenis.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}

                {renderGigPosterImage(gig, { width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: isTinyLayout ? '10px' : '12px', marginBottom: isTinyLayout ? '10px' : '14px' })}
                <h3 style={{ fontSize: isTinyLayout ? '12px' : '16px', fontWeight: '900', margin: '0 0 6px 0', color: '#fff', lineHeight: 1.15 }}>{gig.title.toUpperCase()}</h3>
                <p style={{ color: '#00d2ff', fontSize: isTinyLayout ? '10px' : '12px', fontWeight: '700', margin: 0, lineHeight: 1.3 }}>📍 {gig.city.toUpperCase()}</p>
                
                {/* LACI GESER DETAIL (POP-DRAWER GAYA 3) - MUNCUL DI BAWAH POSTER YANG DIKLIK */}
                {selectedGigDetail?.id === gig.id && (
                  <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '12px', animation: 'slideDown 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontFamily: FONT_STACK }}>
                      <div style={{ color: '#fff' }}><span style={{ color: '#666' }}>📅 DATE:</span> {getGigDate(gig)}</div>
                      <div style={{ color: '#fff' }}><span style={{ color: '#666' }}>📍 VENUE:</span> {gig.city.toUpperCase()}</div>
                      <div style={{ color: getGigHtm(gig).toLowerCase() === 'free' ? '#39ff14' : '#00d2ff', fontWeight: '900' }}>
                        <span style={{ color: '#666', fontWeight: 'normal' }}>🎟️ HTM:</span> {getGigHtm(gig).toUpperCase()}
                      </div>
                      {isApprovedHomepageGig(gig) && (
                        <div style={{ color: '#00d2ff', fontWeight: '900' }}>
                          <span style={{ color: '#666', fontWeight: 'normal' }}>⏱ TAYANG SAMPAI:</span> {(getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE').toUpperCase()}
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid #141414', paddingTop: '6px', marginTop: '4px', color: '#fff', fontWeight: '700' }}>
                        <span style={{ color: '#666', fontWeight: 'normal' }}>📞 CP INFO:</span> {getGigCp(gig)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* INTERACTIVE 3 COLUMNS LOWER ROW */}
      {!loading && !isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div onMouseEnter={() => setHoveredCard('c1')} onMouseLeave={() => setHoveredCard(null)} style={{ ...glassStyle('c1'), padding: isTinyLayout ? '18px' : '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#f5f5f5', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.8px' }}><Radio size={14} color="#a8f1ff"/> RADIO TOP 10 INDIE CLOUD</h3>
            {top10Tracks.map(track => (
              <div key={track.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #141414', alignItems: 'center' }}>
                <div><h4 style={{ fontSize: '14px', color: '#fff', margin: 0 }}>{track.title.toUpperCase()}</h4><p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{track.band.toUpperCase()}</p></div>
                <button onClick={() => handlePlayTrack(track, top10Tracks)} style={{ ...glassButtonStyle, padding: '6px 14px', fontSize: '11px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PLAY'}</button>
              </div>
            ))}
          </div>
          <div style={{ ...glassStyle('c2'), padding: isTinyLayout ? '18px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', color: '#f5f5f5', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.8px' }}><FileText size={14} color="#a8f1ff"/> 10 ARTIKEL BAND TERBARU</h3>
              <button onClick={() => { setActivePage('articles'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>LIHAT</button>
            </div>
            {publicArticleList.length === 0 ? (
              <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada artikel band. Nanti interview, catatan rilisan, dan report skena terbaru muncul di sini.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {publicArticleList.slice(0, 10).map((article) => (
                  <button key={article.id} onClick={() => { setActivePage('articles'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ textAlign: 'left', padding: '10px 0', border: 'none', borderTop: '1px solid #141414', background: 'transparent', cursor: 'pointer', fontFamily: FONT_STACK }}>
                    <p style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                    <p style={{ color: '#777', fontSize: '11px', margin: 0 }}>{article.category} / {article.bandName}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ ...glassStyle('c3'), padding: isTinyLayout ? '18px' : '24px' }}><h3 style={{ fontSize: '14px', color: '#f5f5f5', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.8px' }}><ShoppingBag size={14} color="#a8f1ff"/> DISTRO BAND MERCHANDISE</h3></div>
        </section>
      )}

      {selectedPosterPreview && (
        <div
          onClick={() => setSelectedPosterPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1300, backgroundColor: 'rgba(0,0,0,0.94)', display: 'grid', placeItems: 'center', padding: '24px', boxSizing: 'border-box' }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)', maxHeight: '92vh', backgroundColor: '#050505', border: '1px solid rgba(0,210,255,0.32)', borderRadius: '16px', padding: '16px', boxSizing: 'border-box', display: 'grid', gap: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              <div>
                <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', letterSpacing: '1.4px', margin: '0 0 5px 0' }}>PREVIEW PAMFLET UTUH</p>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: 0 }}>{selectedPosterPreview.title?.toUpperCase()}</h3>
              </div>
              <button onClick={() => setSelectedPosterPreview(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>CLOSE</button>
            </div>
            <div style={{ width: '100%', maxHeight: '74vh', overflow: 'auto', backgroundColor: '#000', borderRadius: '12px', display: 'grid', placeItems: 'center', padding: '12px', boxSizing: 'border-box' }}>
              <img src={selectedPosterPreview.image} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
            <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{selectedPosterPreview.city} / {getGigDate(selectedPosterPreview)} / {getGigHtm(selectedPosterPreview)} / {getGigCp(selectedPosterPreview)}</p>
          </div>
        </div>
      )}

      {/* POPUP SAKRAL MULTIFUNGSI SECURITY CREDENTIAL & PROFILE SYSTEM */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ ...glassStyle('modal'), padding: '36px', maxWidth: '420px', width: '100%', position: 'relative', backgroundColor: '#0b0b0b' }}>
            <button onClick={() => { setShowAuthModal(false); setAuthType(''); setAuthError(''); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>✕</button>

            {/* FORM LOGIN AKUN */}
            {authType === 'login' && (
              <form onSubmit={handleLoginAkun}>
                <h3 style={{ color: '#00d2ff', margin: '0 0 24px 0', fontSize: '18px', textAlign: 'center', fontWeight: '900' }}>MASUK MOSHPIT WISPACE</h3>
                <input type="email" placeholder="EMAIL USER" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                <input type="password" placeholder="PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#000', border: `1px solid ${authError.startsWith('Link') ? 'rgba(0,210,255,0.35)' : 'rgba(255,51,51,0.35)'}`, color: authError.startsWith('Link') ? '#00d2ff' : '#ff3333', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '14px', backgroundColor: authLoading ? '#141414' : '#00d2ff', color: authLoading ? '#555' : '#000', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: FONT_STACK }}>{authLoading ? 'MEMPROSES...' : 'LOG MASUK'}</button>
                <button type="button" onClick={handleResendVerification} disabled={authLoading} style={{ width: '100%', marginTop: '10px', padding: '12px', backgroundColor: 'transparent', color: '#00d2ff', border: '1px solid rgba(0,210,255,0.35)', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: FONT_STACK, fontSize: '12px' }}>KIRIM ULANG VERIFIKASI EMAIL</button>
              </form>
            )}

            {/* FORM REGISTRASI JOIN AKUN */}
            {/* REVISI: FORM REGISTRASI JOIN DENGAN SAKELAR GESER TOGGLE ROLE DI AWAL (GAYA 2) */}
            {authType === 'join' && (
              <form onSubmit={handleDaftarAkun}>
                <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '18px', textAlign: 'center', fontWeight: '900' }}>JOIN THE SKENA ECOSYSTEM</h3>
                
                {/* SAKELAR GESER (TOGGLE SWITCH) CAPSULE PREMIUM */}
                <div style={{ display: 'flex', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', padding: '4px', marginBottom: '20px', position: 'relative' }}>
                  {/* Tombol Geser Musisi */}
                  <div 
                    onClick={() => setUserRole('musisi')} 
                    style={{ 
                      flex: 1, textAlign: 'center', padding: '8px 0', fontSize: '12px', fontWeight: '900', cursor: 'pointer', borderRadius: '9999px',
                      backgroundColor: userRole === 'musisi' ? '#00d2ff' : 'transparent',
                      color: userRole === 'musisi' ? '#000' : '#666',
                      boxShadow: userRole === 'musisi' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none',
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
                      backgroundColor: userRole === 'audience' ? '#00d2ff' : 'transparent',
                      color: userRole === 'audience' ? '#000' : '#666',
                      boxShadow: userRole === 'audience' ? '0 0 15px rgba(0, 210, 255, 0.4)' : 'none',
                      transition: 'all 0.3s ease-in-out'
                    }}
                  >
                    🎧 AUDIENCE
                  </div>
                </div>

                {/* NOTIFIKASI DINAMIS BERDASARKAN ARAH SAKELAR */}
                <p style={{ color: '#00d2ff', fontSize: '11px', textAlign: 'center', marginTop: '-10px', marginBottom: '16px', fontWeight: '700' }}>
                  {userRole === 'musisi' ? '👉 LU AKAN TERDAFTAR SEBAGAI BAND/KREATOR' : '👉 LU AKAN TERDAFTAR SEBAGAI PENIKMAT/KOLEKTOR MUSIK'}
                </p>

                <input type="email" placeholder="ALAMAT EMAIL RESMI" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                <input type="password" placeholder="BUAT PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: FONT_STACK, boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#000', border: `1px solid ${authError.startsWith('Link') ? 'rgba(0,210,255,0.35)' : 'rgba(255,51,51,0.35)'}`, color: authError.startsWith('Link') ? '#00d2ff' : '#ff3333', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                
                {/* Tombol Submit Kunci Akun */}
                <button type="submit" disabled={!userRole || authLoading} style={{ width: '100%', padding: '14px', backgroundColor: userRole && !authLoading ? '#00d2ff' : '#141414', color: userRole && !authLoading ? '#000' : '#444', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: userRole && !authLoading ? 'pointer' : 'not-allowed', fontFamily: FONT_STACK, transition: 'all 0.2s' }}>
                  {authLoading ? 'MEMPROSES...' : userRole ? 'DAFTAR AKUN BARU' : 'PILIH ROL LU DI ATAS DULU'}
                </button>
              </form>
            )}

            {/* INTERACTIVE USER TAKDIR GATEWAY: MUSISI VS AUDIENCE */}
            {authType === 'pilih_peran' && (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: '#fff', fontWeight: '900', fontSize: '20px', margin: '0 0 8px 0' }}>CHOOSE YOUR DESTINY</h3>
                <p style={{ color: '#666', fontSize: '13px', margin: '0 0 24px 0' }}>Tentukan kasta pergerakan lu di dalam platform WiSpace</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => handleRoleSelection('musisi')} style={{ padding: '16px', backgroundColor: 'rgba(0,210,255,0.05)', border: '1px solid #00d2ff', borderRadius: '16px', color: '#00d2ff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: FONT_STACK }}>🎸 SEBAGAI MUSISI (UPLOAD KARYA/GIGS)</button>
                  <button onClick={() => handleRoleSelection('audience')} style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: FONT_STACK }}>🎧 SEBAGAI AUDIENCE (PENIKMAT/KOLEKTOR)</button>
                </div>
              </div>
            )}

            {/* GABUNGAN OPSI 2 CONTRACT DIGITAL SIGNATURE (LEGALITAS MUSISI) */}
            {authType === 'legalitas_musisi' && (
              <form onSubmit={handleContractSignature}>
                <h3 style={{ color: '#ff3333', fontSize: '15px', fontWeight: '900', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16}/> MANIFESTO HUKUM & DISTRIBUSI WISPACE</h3>
                <div style={{ maxHeight: '180px', overflowY: 'auto', backgroundColor: '#000', padding: '12px', borderRadius: '12px', fontSize: '11px', color: '#aaa', lineHeight: '1.4', marginBottom: '16px', border: '1px solid #141414' }}>
                  <p style={{ margin: '0 0 10px 0' }}>1. Segala bentuk file audio (MP3/WAV), foto, dan poster acara yang di-upload sepenuhnya merupakan <strong>tanggung jawab hukum band masing-masing</strong>. WiSpace murni bertindak sebagai wadah distribusi digital independen.</p>
                  <p style={{ margin: '0 0 10px 0' }}>2. WiSpace memberlakukan sistem potongan komisi sebesar <strong>15% hingga 20%</strong> dari setiap nominal karya lagu/album yang berhasil terjual untuk kebutuhan operasional server backend cloud.</p>
                  <p style={{ margin: '0 0 10px 0' }}>3. Pihak band/musisi diberikan kebebasan mutlak 100% untuk <strong>menentukan harga jual sendiri</strong> terhadap karya tunggal maupun album penuh mereka.</p>
                  <p style={{ margin: '0 0 10px 0' }}>4. Laporan keuangan komprehensif dapat dipantau real-time di profil band, dan dana hasil penjualan dapat dicairkan aman <strong>setiap tanggal 1 awal bulan (Minimal Saldo Rp 100.000)</strong>.</p>
                  <p style={{ margin: '0' }}>5. Tindakan Plagiarisme dilarang keras! Apabila di masa depan ditemukan indikasi plagiat karya orang lain, hal tersebut adalah <strong>pelanggaran mutlak band</strong> dan WiSpace lepas dari segala tuntutan hukum (karena admin tidak mengurasi orisinalitas nada satu per satu).</p>
                </div>
                <p style={{ color: '#fff', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>Ketik Nama Band Lu Untuk Tanda Tangan Digital Sah:</p>
                <input type="text" placeholder="CONTOH: SKENA NOISE SYNDICATE" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '16px', fontFamily: FONT_STACK, boxSizing: 'border-box', textAlign: 'center' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#ff3333', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>SAYA SETUJU & SIGN KONTRAK ✍️</button>
              </form>
            )}

            {/* SPLIT DASHBOARD PROFILE MUSISI (GABUNGAN OPSI 3) */}
            {authType === 'pilihan_upload' && (
              <div>
                <h3 style={{ color: '#00d2ff', fontSize: '18px', fontWeight: '900', margin: '0 0 6px 0', textAlign: 'center' }}>{signatureName ? signatureName.toUpperCase() : 'BACKSTAGE MUSISI'}</h3>
                
                {/* BLOK INTUOS LAPORAN KEUANGAN TRANSPARAN */}
                <div style={{ backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.2)', padding: '14px', borderRadius: '16px', marginBottom: '20px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><span style={{ color: '#666', fontSize: '11px', fontWeight: '900' }}>TOTAL SALDO SIAP CAIR</span><h4 style={{ margin: 0, fontSize: '24px', color: '#fff', fontWeight: '900', display: 'flex', alignItems: 'center' }}><DollarSign size={20} color="#00d2ff"/> Rp {bandBalance.toLocaleString('id-ID')}</h4></div>
                    <button disabled={bandBalance < 100000} style={{ padding: '8px 14px', backgroundColor: bandBalance >= 100000 ? '#00d2ff' : '#141414', border: 'none', borderRadius: '16px', color: bandBalance >= 100000 ? '#000' : '#444', fontSize: '11px', fontWeight: '900', cursor: bandBalance >= 100000 ? 'pointer' : 'not-allowed', fontFamily: FONT_STACK }}>TARIK DANA</button>
                  </div>
                  <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '10px', lineHeight: '1.2' }}>*Potongan sistem 15-20%. Pencairan berkala tiap tanggal 1. {bandBalance < 100000 && <span style={{ color: '#ff3333' }}>Kurang Rp {(100000 - bandBalance).toLocaleString('id-ID')} lagi buat mencairkan, breo!</span>}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => { setShowAuthModal(false); setBandProfileTab('profile'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center' }}>EDIT PROFILE BAND</button>
                  <button onClick={() => { setShowAuthModal(false); setBandProfileTab('album'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center', color: '#fff', borderColor: '#444' }}>UPLOAD ALBUM DIGITAL</button>
                  <button onClick={() => { setShowAuthModal(false); setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center', color: '#fff', borderColor: '#444' }}>KELOLA MERCHANDISE</button>
                  <button onClick={() => setAuthType('band')} style={{ ...glassButtonStyle, padding: '14px', textAlign: 'center' }}>📌 UPLOAD PAMFLET EVENT</button>
                </div>
              </div>
            )}

            {/* DASHBOARD PROFILE AUDIENCE */}
            {authType === 'profil_audience' && (
              <div>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: '0 0 4px 0' }}>🎧 AUDIENCE PROFILE ARCHIVE</h3>
                <p style={{ color: '#666', fontSize: '12px', margin: '0 0 20px 0' }}>Daftar kepemilikan rilisan lagu & tanda hak dukungan skena</p>
                <div style={{ backgroundColor: '#000', padding: '16px', borderRadius: '16px', border: '1px solid #141414' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#00d2ff', fontWeight: '900' }}>📚 MY MUSIC ARCHIVE (0)</h4>
                  <p style={{ color: '#444', fontSize: '12px', margin: 0, textAlign: 'center', padding: '20px 0' }}>Belum ada riwayat pembelian rilisan lagu, breo!</p>
                </div>
              </div>
            )}

            {/* FORM INPUT SUNTIK ACARA GIGS */}
            {/* UPDATE FORM SUNTIK POSTER ACARA + DATA LENGKAP */}
            {authType === 'band' && (
              <form onSubmit={handleBandSubmit}>
                <h3 style={{ color: '#00d2ff', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '900' }}>📌 UPLOAD PAMFLET EVENT</h3>
                <p style={{ color: '#666', fontSize: '12px', margin: '0 0 18px 0', lineHeight: 1.4 }}>Pamflet masuk antrean kurasi WiSpace dulu. Setelah admin approve, baru tampil di homepage.</p>
                <input type="text" placeholder="NAMA ACARA CONCERT" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="KOTA PELAKSANAAN" value={newCity} onChange={(e) => setNewCity(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="GENRE / SUB-SKENA (Contoh: Punk, Hardcore, Indie)" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="HTM (Contoh: FREE / Rp 50.000)" value={newHtm} onChange={(e) => setNewHtm(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="CONTACT PERSON (WA/IG: @bandmu)" value={newCp} onChange={(e) => setNewCp(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <label style={{ display: 'block', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleGigPosterImport} style={{ display: 'none' }} />
                  <div style={{ minHeight: '180px', border: '1px dashed rgba(0,210,255,0.45)', borderRadius: '16px', backgroundColor: '#000', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    {newPosterImage ? (
                      <img src={newPosterImage} alt="Preview pamflet event" style={{ width: '100%', height: '100%', maxHeight: '260px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>UPLOAD GAMBAR PAMFLET</p>
                        <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>Klik untuk pilih JPG, PNG, atau WEBP. Max 2MB.</p>
                      </div>
                    )}
                  </div>
                </label>
                {newPosterName && <p style={{ color: '#aaa', fontSize: '11px', fontWeight: '900', margin: '-4px 0 12px 0' }}>FILE: {newPosterName}</p>}
                {newPosterNotice && <p style={{ color: newPosterNotice.includes('Ideal') ? '#ffcc00' : '#39ff14', fontSize: '11px', lineHeight: 1.45, margin: '-4px 0 12px 0' }}>{newPosterNotice}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'free' ? '1px solid #39ff14' : '1px solid #222', backgroundColor: newGigRequestType === 'free' ? 'rgba(57,255,20,0.12)' : '#000', color: newGigRequestType === 'free' ? '#39ff14' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>FREE BULLETIN</button>
                  <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'exclusive' ? '1px solid #00d2ff' : '1px solid #222', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.14)' : '#000', color: newGigRequestType === 'exclusive' ? '#00d2ff' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: FONT_STACK }}>EXCLUSIVE SLIDE</button>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#000', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.32)' : 'rgba(57,255,20,0.24)'}`, borderRadius: '14px', marginBottom: '18px' }}>
                  <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE SLIDE BERBAYAR' : 'FREE BULLETIN GRATIS'}</p>
                  <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{newGigRequestType === 'exclusive' ? `Rp ${EXCLUSIVE_POSTER_SLOT_FEE.toLocaleString('id-ID')} / 10 hari. Admin approve konten dulu, lalu user bayar, lalu admin activate.` : 'Masuk daftar bulletin gigs homepage setelah admin approve.'}</p>
                  <p style={{ color: '#ffcc00', fontSize: '10px', fontWeight: '900', lineHeight: 1.4, margin: '8px 0 0 0' }}>MASA TAYANG: 10 HARI SEJAK ADMIN APPROVE</p>
                  <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', lineHeight: 1.4, margin: '8px 0 0 0' }}>UKURAN: {posterUploadGuide.size} / {posterUploadGuide.ratio}</p>
                </div>
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' }}>KIRIM KE ANTREAN KURASI</button>
              </form>
            )}

            {/* FORM INPUT SUNTIK FILE DATA LAGU */}
            {authType === 'upload_lagu' && (
              <form onSubmit={handleTrackSubmit}>
                <h3 style={{ color: '#00d2ff', margin: '0 0 20px 0', fontSize: '16px', fontWeight: '900' }}>🎵 SUNTIK RILISAN LAGU BARU</h3>
                <input type="text" placeholder="NAMA BAND" value={trackBand} onChange={(e) => setTrackBand(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="text" placeholder="JUDUL SINGLE / LAGU" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', boxSizing: 'border-box' }} />
                <input type="url" placeholder="LINK AUDIO CLOUD URL (MP3/WAV)" value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '20px', boxSizing: 'border-box' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' }}>LUNCURKAN RILISAN BARU</button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

