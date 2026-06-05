import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
// IMPOR IKON VEKTOR CYBER-LINE MINIMALIS (Poin 1)
import { Search, ShoppingBag, Radio, User, LogOut, AlertTriangle, FileText, DollarSign, ShieldCheck } from 'lucide-react';

const fetchCloudData = async () => {
  const { data: gigsData } = await supabase.from('gigs').select('*').order('created_at', { ascending: false });
  const { data: tracksData } = await supabase.from('tracks').select('*').order('created_at', { ascending: false }).limit(10);

  return {
    gigsData: gigsData || [],
    tracksData: tracksData || [],
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
const isMissingColumnError = (error) => error?.message?.toLowerCase().includes('could not find') || error?.message?.toLowerCase().includes('schema cache');
const BAND_PROFILE_STORAGE_PREFIX = 'wispace_band_profile';
const BAND_AGREEMENT_STORAGE_PREFIX = 'wispace_band_agreement';
const BAND_ARTICLES_STORAGE_PREFIX = 'wispace_band_articles';
const BAND_PHOTO_MAX_SIZE = 1 * 1024 * 1024;
const BAND_COVER_MAX_SIZE = 2 * 1024 * 1024;
const BAND_PREVIEW_MAX_CHARS = 3_250_000;

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
  const [audienceProfile, setAudienceProfile] = useState({
    displayName: '',
    city: '',
    favoriteGenre: '',
    contact: '',
    photoName: '',
    photoPreview: ''
  });
  
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
  const [bandProfile, setBandProfile] = useState({
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
  const [albumDraft, setAlbumDraft] = useState({
    title: '',
    price: '',
    description: '',
    coverName: '',
    coverPreview: '',
    audioFiles: [],
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
  const [articleItems, setArticleItems] = useState([]);
  const [messageDraft, setMessageDraft] = useState({
    sender: '',
    contact: '',
    subject: '',
    body: ''
  });
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

  // MOCK FINANCIAL DATA BAND (Contoh Tampilan Saldo)
  const [bandBalance] = useState(75000); // Contoh saldo awal 75rb

  const audioRef = useRef(new Audio());
  const timerRef = useRef(null);

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
      }

      if (Array.isArray(storedArticles)) {
        setArticleItems(storedArticles);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [persistBandProfileLocal, persistUserRole, userSession]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert('Gagal logout: ' + error.message);
      return;
    }

    setShowAuthModal(false);
    setAuthType('');
    setAuthError('');
    setSearchTerm('');
    setIsSearchExpanded(false);
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

  // FETCH DATABASE CLOUD
  const fetchData = async () => {
    const { gigsData, tracksData } = await fetchCloudData();
    setGigs(gigsData);
    setTop10Tracks(tracksData);
    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      const { gigsData, tracksData } = await fetchCloudData();
      if (!isActive) return;

      setGigs(gigsData);
      setTop10Tracks(tracksData);
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
        setUserRole('musisi');
        persistUserRole('musisi', data.user);
        setHasSignedContract(Boolean(storedAgreement?.accepted));
        setSignatureName((current) => current || storedAgreement?.signatureName || '');
        setActivePage(storedAgreement?.accepted ? 'band_public' : 'home');
        return;
      }
      if (savedRole === 'audience') {
        setUserRole('audience');
        persistUserRole('audience', data.user);
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
    setActivePage('audience_profile');
    alert('Selamat! Akun kasta Audience lu siap berburu rilisan!');
  };

  const handleAudienceProfileSave = (event) => {
    event.preventDefault();
    alert('Profile audience tersimpan sebagai draft privat. Nanti ini kita sambungkan ke table audience_profiles di Supabase.');
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
    }
    setBandProfile((current) => {
      const nextProfile = {
        ...current,
        name: current.name || signedBandName,
        slug: current.slug || createSlug(signedBandName),
        isPublished: true
      };
      persistBandProfileLocal(nextProfile, userSession);
      return nextProfile;
    });
    setShowAuthModal(false);
    setIsViewingOwnBandProfile(true);
    setActivePage('band_public');
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
    const { error } = await supabase.from('tracks').insert([{ band: trackBand, title: trackTitle, url: trackUrl }]);
    if (error) alert(error.message);
    else { setTrackBand(''); setTrackTitle(''); setTrackUrl(''); setShowAuthModal(false); alert('Lagu beres mengudara!'); fetchData(); }
  };

  const handleGigModeration = async (id, status) => {
    const approvedUntil = new Date();
    approvedUntil.setDate(approvedUntil.getDate() + 10);
    const approvedAt = new Date().toISOString().slice(0, 10);
    const updatePayload = status === 'approved_exclusive' || status === 'approved_free'
      ? { status, approved_at: approvedAt, approved_until: approvedUntil.toISOString().slice(0, 10) }
      : { status };
    const { error: firstError } = await supabase.from('gigs').update(updatePayload).eq('id', id);
    const error = isMissingColumnError(firstError)
      ? (await supabase.from('gigs').update({ status }).eq('id', id)).error
      : firstError;
    if (error) alert("Gagal update status pamflet: " + error.message);
    else {
      const message = status === 'approved_free'
        ? 'Pamflet disetujui sebagai event free dan tampil di bulletin homepage selama 10 hari.'
        : status === 'approved_exclusive'
          ? 'Pamflet disetujui sebagai exclusive event dan masuk slot slide besar homepage selama 10 hari.'
          : 'Pamflet ditolak dan tidak akan tampil.';
      alert(message);
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

    setAudienceProfile((current) => {
      if (current.photoPreview) URL.revokeObjectURL(current.photoPreview);
      return { ...current, photoName: file.name, photoPreview: URL.createObjectURL(file) };
    });
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
        size: file.size
      }))
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
      return nextProfile;
    });
    alert('Profile band tersimpan dan aman saat refresh di browser ini. Step production berikutnya: sambungkan ke Supabase Storage + table band_profiles.');
  };

  const handleAlbumDraftSubmit = (event) => {
    event.preventDefault();
    if (!albumDraft.accepted) return alert('Centang agreement upload album dulu bro.');
    if (!albumDraft.signature.trim()) return alert('Isi nama penanggung jawab / tanda tangan digital dulu bro.');
    if (albumDraft.audioFiles.length === 0) return alert('Import minimal satu file MP3/WAV dulu bro.');

    const nextAlbum = {
      id: Date.now(),
      title: albumDraft.title,
      price: albumDraft.price,
      description: albumDraft.description,
      coverPreview: albumDraft.coverPreview,
      coverName: albumDraft.coverName,
      trackCount: albumDraft.audioFiles.length,
      bandName: bandProfile.name || signatureName || 'Band WiSpace',
      city: bandProfile.city || 'Indonesia',
      genre: bandProfile.genre || 'Indie',
      signedBy: albumDraft.signature
    };

    setAlbumItems((current) => [nextAlbum, ...current]);
    setAlbumDraft({
      title: '',
      price: '',
      description: '',
      coverName: '',
      coverPreview: '',
      audioFiles: [],
      signature: albumDraft.signature,
      accepted: false
    });
    setBandProfileTab('album');
    alert('Album masuk draft rilisan dan sudah muncul di Explore. Nanti ini akan lanjut ke storage, agreement log, dan checkout.');
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
      setActivePage('audience_library');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setPurchasedAlbums((current) => [{ ...album, purchasedAt: 'Baru saja' }, ...current]);
    alert(`${album.title} masuk ke Audience Library. Nanti ini diganti checkout/payment beneran.`);
  };

  const handlePurchaseMerch = (item) => {
    if (!userSession) {
      setAuthType('join');
      setShowAuthModal(true);
      setAuthError('Join atau login dulu buat beli merchandise band.');
      return;
    }

    alert(`${item.name} masuk draft order merch. Nanti ini kita sambungkan ke checkout, stok, dan shipping.`);
  };

  const handleMerchDraftSubmit = (event) => {
    event.preventDefault();
    const nextItem = {
      id: Date.now(),
      ...merchDraft,
    };

    setMerchItems((current) => [nextItem, ...current]);
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

  const handleArticleSubmit = (event) => {
    event.preventDefault();
    if (!articleDraft.title.trim()) return alert('Isi judul artikel dulu bro.');
    if (!articleDraft.excerpt.trim()) return alert('Isi ringkasan artikel dulu bro.');

    const nextArticle = {
      id: Date.now(),
      ...articleDraft,
      bandName: bandProfile.name || signatureName || 'Band WiSpace',
      category: articleDraft.category || 'Update Band',
      createdAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    setArticleItems((current) => {
      const nextItems = [nextArticle, ...current];
      persistBandArticlesLocal(nextItems);
      return nextItems;
    });
    setArticleDraft({ title: '', category: '', excerpt: '', body: '' });
    setBandProfileTab('artikel');
    alert('Artikel masuk draft publish dan sudah tampil di page Artikel.');
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
  const handlePlayTrack = (track) => {
    if (activeTrack?.id === track.id && isPlaying) { audioRef.current.pause(); setIsPlaying(false); return; }
    audioRef.current.src = track.url; audioRef.current.play(); setActiveTrack(track); setIsPlaying(true);
  };

  const approvedFreeGigs = gigs.filter((gig) => gig.status === 'approved' || gig.status === 'approved_free');
  const approvedExclusiveGigs = gigs.filter((gig) => gig.status === 'approved_exclusive');
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values) => !normalizedSearchTerm || values.some((value) => String(value || '').toLowerCase().includes(normalizedSearchTerm));
  const filteredGigs = approvedFreeGigs.filter(gig => matchesSearch(gig.title, gig.city, getGigGenre(gig), getGigDate(gig), getGigHtm(gig)));
  const filteredPublicGigs = [...approvedExclusiveGigs, ...approvedFreeGigs].filter(gig => matchesSearch(gig.title, gig.city, getGigGenre(gig), getGigDate(gig), getGigHtm(gig)));
  const filteredAlbums = albumItems.filter((album) => matchesSearch(album.title, album.bandName, album.genre, album.city, album.description));
  const filteredTracks = top10Tracks.filter((track) => matchesSearch(track.title, track.band));
  const filteredMerchItems = merchItems.filter((item) => matchesSearch(item.name, item.description, bandProfile.name, bandProfile.genre));
  const filteredArticles = articleItems.filter((article) => matchesSearch(article.title, article.category, article.excerpt, article.body, article.bandName));
  const bandMatchesSearch = matchesSearch(bandProfile.name, signatureName, bandProfile.genre, bandProfile.city, bandProfile.headline, bandProfile.bio);
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
  const hasBandIdentity = hasSignedContract || signatureName.trim() || bandProfile.name.trim();
  const isBandAccount = userRole === 'musisi' || hasBandIdentity;
  const showBandOwnerControls = isBandAccount && isViewingOwnBandProfile;
  const showBandContactForm = !showBandOwnerControls;
  const visibleMessages = isBandAccount ? messages : messages.filter((message) => message.scope === 'audience');
  const unreadMessages = visibleMessages.filter((message) => !message.read).length;
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
        setShowAuthModal(false);
        setIsViewingOwnBandProfile(true);
        setActivePage('band_public');
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    background: 'rgba(20, 20, 20, 0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: hoveredCard === id ? '0 0 30px rgba(0, 210, 255, 0.3)' : '0 4px 30px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.3s ease-in-out'
  });

  const glassButtonStyle = {
    background: 'rgba(0, 210, 255, 0.08)', border: '1px solid rgba(0, 210, 255, 0.2)', color: '#00d2ff',
    cursor: 'pointer', borderRadius: '16px', fontWeight: '900', letterSpacing: '0.5px', fontFamily: "'League Spartan'", transition: 'all 0.2s ease'
  };

  const formInputStyle = {
    width: '100%',
    backgroundColor: '#000',
    border: '1px solid #222',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '13px',
    color: '#fff',
    fontFamily: "'League Spartan'",
    boxSizing: 'border-box',
    outline: 'none'
  };

  const pageShellStyle = {
    minHeight: 'calc(100vh - 40px)',
    padding: '92px 30px 34px',
    background: 'linear-gradient(180deg, #060606 0%, #030303 100%)',
    border: '1px solid rgba(0,210,255,0.16)',
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
    color: '#00d2ff',
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
    letterSpacing: '0.8px'
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
    <div style={{ backgroundColor: '#030303', color: '#ffffff', minHeight: '100vh', padding: '20px', fontFamily: "'League Spartan', sans-serif", boxSizing: 'border-box' }}>
      {!isSupabaseConfigured && (
        <div style={{ position: 'fixed', left: '20px', right: '20px', bottom: '20px', zIndex: 2000, padding: '14px 16px', backgroundColor: 'rgba(255,51,51,0.12)', border: '1px solid rgba(255,51,51,0.45)', borderRadius: '14px', color: '#fff', fontSize: '12px', fontWeight: '900', lineHeight: 1.4, boxShadow: '0 18px 45px rgba(0,0,0,0.45)' }}>
          SUPABASE ENV BELUM DISET DI HOSTING. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Vercel, lalu redeploy.
        </div>
      )}
      
      {/* ========================================================
          FIXED FLOATING BADGE (IKON CYBER-LINE & KONTROL SMART ROLE)
         ======================================================== */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={{ position: 'fixed', top: '30px', right: '30px', zIndex: 999, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', opacity: isScrolled ? 1 : 0, transform: isScrolled ? 'translateY(0)' : 'translateY(-20px)', pointerEvents: isScrolled ? 'auto' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ ...glassStyle('floating-badge'), display: 'flex', alignItems: 'center', padding: '8px 16px', backgroundColor: 'rgba(10, 10, 10, 0.9)', border: '1px solid #00d2ff', borderRadius: '16px' }}>
            <span onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', marginRight: '16px', cursor: 'pointer' }}>WI.ID ↑</span>
            <button onClick={() => { setActivePage('explore'); setExploreTab('rilisan'); setSearchTerm(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', fontFamily: "'League Spartan'" }}>EXPLORE</button>
            
            {!userSession ? (
              <>
                <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', fontFamily: "'League Spartan'" }}>LOGIN</button>
                <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'rgba(0, 210, 255, 0.1)', border: '1px solid rgba(0,210,255,0.3)', color: '#00d2ff', borderRadius: '16px', padding: '4px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>JOIN</button>
              </>
            ) : (
              <>
                <button onClick={() => { setActivePage('message_center'); markMessagesAsRead(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ position: 'relative', background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', fontFamily: "'League Spartan'" }}>
                  MESSAGES
                  {unreadMessages > 0 && <span style={{ position: 'absolute', top: '-8px', right: '-10px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#ff3333', color: '#fff', fontSize: '10px', display: 'grid', placeItems: 'center', fontWeight: '900' }}>{unreadMessages}</span>}
                </button>
                <button onClick={openProfileModal} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', marginRight: '12px', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: "'League Spartan'", minWidth: 0 }}>{renderProfileChip(20, '110px')}</button>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ff3333', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'League Spartan'" }}><LogOut size={13}/> LOGOUT</button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearchExpanded(true)} onBlur={() => { if(!searchTerm) setIsSearchExpanded(false); }} style={{ backgroundColor: 'rgba(5, 5, 5, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9999px', padding: isSearchExpanded ? '6px 12px' : '0px', width: isSearchExpanded ? '180px' : '0px', opacity: isSearchExpanded ? 1 : 0, fontSize: '11px', color: '#fff', outline: 'none', fontFamily: "'League Spartan'", transition: 'all 0.3s ease', boxSizing: 'border-box' }} />
            <div onClick={() => setIsSearchExpanded(!isSearchExpanded)} style={{ ...glassStyle('search-trigger'), padding: '6px 14px', backgroundColor: '#00d2ff', color: '#000', borderRadius: '16px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={12}/> FIND</div>
          </div>
        </div>
      )}

      {/* FLOATING MENU UNTUK PAGE DALAM */}
      {!isAdminPage && (isBandProfilePage || isBandPublicPage || isFinancePage || isGigManagerPage || isMessagePage || isAudienceProfilePage || isAudienceLibraryPage || isExplorePage || isMerchMarketPage || isArticlesPage) && !loading && (
        <div style={{ position: 'fixed', top: '24px', left: '50%', zIndex: 999, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', transform: 'translate(-50%, 0)', opacity: 1, pointerEvents: 'auto', transition: 'all 0.35s ease', backgroundColor: 'rgba(5, 5, 5, 0.88)', border: '1px solid rgba(0,210,255,0.35)', borderRadius: '16px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 18px 45px rgba(0,0,0,0.45)', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <button onClick={() => { setActivePage('home'); setSearchTerm(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'transparent', border: 'none', color: '#00d2ff', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'", whiteSpace: 'nowrap' }}>WISPACE</button>
          {[
            ['rilisan', 'RILISAN'],
            ['band', 'BAND'],
            ['artikel', 'ARTIKEL'],
            ['merch', 'MERCH']
          ].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => { setActivePage('explore'); setExploreTab(tab); setSearchTerm(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{ background: activePage === 'explore' && exploreTab === tab ? 'rgba(0,210,255,0.12)' : 'transparent', border: activePage === 'explore' && exploreTab === tab ? '1px solid rgba(0,210,255,0.32)' : '1px solid transparent', borderRadius: '10px', color: activePage === 'explore' && exploreTab === tab ? '#00d2ff' : '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'", whiteSpace: 'nowrap', padding: '7px 9px' }}
            >
              {label}
            </button>
          ))}
          {userSession && (
            <>
              <button onClick={() => { setActivePage('audience_library'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'", whiteSpace: 'nowrap' }}>LIBRARY</button>
              <button onClick={() => { setActivePage('message_center'); markMessagesAsRead(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ position: 'relative', background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'", whiteSpace: 'nowrap' }}>
                MESSAGES
                {unreadMessages > 0 && <span style={{ position: 'absolute', top: '-8px', right: '-10px', minWidth: '16px', height: '16px', borderRadius: '9999px', backgroundColor: '#ff3333', color: '#fff', fontSize: '10px', display: 'grid', placeItems: 'center', fontWeight: '900' }}>{unreadMessages}</span>}
              </button>
            </>
          )}
          <div style={{ position: 'relative', width: '190px', maxWidth: '30vw' }}>
            <Search size={12} color="#666" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9999px', padding: '7px 10px 7px 28px', color: '#fff', fontSize: '11px', fontWeight: '700', outline: 'none', fontFamily: "'League Spartan'", boxSizing: 'border-box' }} />
          </div>
          {!userSession ? (
            <>
              <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>LOGIN</button>
              <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ background: 'rgba(0,210,255,0.12)', border: '1px solid rgba(0,210,255,0.35)', color: '#00d2ff', borderRadius: '12px', padding: '7px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>JOIN</button>
            </>
          ) : (
            <>
              <button onClick={openProfileModal} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: "'League Spartan'", whiteSpace: 'nowrap', minWidth: 0 }}>{renderProfileChip(20, '110px')}</button>
              <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#ff3333', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'League Spartan'", whiteSpace: 'nowrap' }}><LogOut size={13}/> LOGOUT</button>
            </>
          )}
        </div>
      )}

      {/* HEADER UTAMA BINGKAI ATAS */}
      {!isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && !loading && (
        <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 40px)', marginBottom: '40px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000' }}>
          <header style={{ position: 'absolute', top: '30px', left: '30px', right: '30px', zIndex: 100, display: 'flex', justifyView: 'space-between', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', opacity: isScrolled ? 0 : 1, pointerEvents: isScrolled ? 'none' : 'auto', transition: 'opacity 0.4s ease-in-out' }}>
            <div><h1 onClick={() => setSearchTerm('')} style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '1.5px', color: '#00d2ff', margin: 0, cursor: 'pointer' }}>WISPACE.MY.ID</h1></div>

            {/* CYBER SEARCH BAR INTEGRATION */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '360px', display: 'flex', alignItems: 'center' }}>
              <Search size={14} color="#666" style={{ position: 'absolute', left: '16px' }} />
              <input type="text" placeholder="FIND..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', padding: '10px 16px 10px 42px', fontSize: '12px', fontWeight: '700', color: '#fff', outline: 'none', fontFamily: "'League Spartan'", boxSizing: 'border-box', textAlign: 'center' }} />
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <button onClick={() => { setActivePage('explore'); setExploreTab('rilisan'); setSearchTerm(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>EXPLORE</button>
              {!userSession ? (
                <>
                  <button onClick={() => { setAuthType('login'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>LOGIN</button>
                  <button onClick={() => { setAuthType('join'); setShowAuthModal(true); }} style={{ ...glassButtonStyle, padding: '8px 20px', fontSize: '11px' }}>JOIN</button>
                </>
              ) : (
                <>
                  <button onClick={openProfileModal} style={{ ...glassButtonStyle, padding: '7px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>{renderProfileChip(22, '130px')}</button>
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ff3333', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>LOGOUT</button>
                </>
              )}
            </div>
          </header>

          {/* BANNER SLIDER ROTATION */}
          {exclusiveEventBanners.length > 0 ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {currentExclusiveBanner.image && (
                <img key={currentExclusiveBannerIndex} src={currentExclusiveBanner.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, zIndex: 10, background: 'linear-gradient(to top, rgba(3, 3, 3, 1) 0%, rgba(3, 3, 3, 0.4) 50%, rgba(0, 0, 0, 0) 100%)', padding: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <span style={{ backgroundColor: 'rgba(0,210,255,0.15)', border: '1px solid #00d2ff', color: '#00d2ff', fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '2px', width: 'fit-content', marginBottom: '16px' }}>{currentExclusiveBanner.type}</span>
                <h2 style={{ fontSize: '56px', fontWeight: '900', margin: '0 0 12px 0', color: '#fff', maxWidth: '950px', lineHeight: '0.9' }}>{currentExclusiveBanner.title}</h2>
                <p style={{ color: '#bbb', fontSize: '15px', maxWidth: '700px', margin: '0 0 28px 0', lineHeight: '1.5' }}>{currentExclusiveBanner.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', width: '100%', flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedGigDetail({ ...currentExclusiveBanner.sourceGig, fromHero: true })} style={{ ...glassButtonStyle, padding: '12px 32px', width: 'fit-content', fontSize: '13px' }}>LIHAT DETAIL EVENT</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
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
                            fontFamily: "'League Spartan'",
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
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(0,210,255,0.18)', backgroundColor: '#030303' }} />
              <div style={{ position: 'relative', zIndex: 10, padding: '40px' }}>
                <span style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', letterSpacing: '1.5px' }}>EXCLUSIVE EVENT EMPTY</span>
                <h2 style={{ color: '#fff', fontSize: '52px', fontWeight: '900', lineHeight: 0.95, margin: '14px 0 12px 0', maxWidth: '800px' }}>BELUM ADA PAMFLET APPROVED</h2>
                <p style={{ color: '#888', fontSize: '15px', maxWidth: '620px', lineHeight: 1.5, margin: 0 }}>Upload pamflet exclusive dari menu band, lalu approve di admin. Slide besar akan muncul di sini.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && selectedGigDetail?.fromHero && (
        <section style={{ margin: '0 0 34px 0', padding: '18px', backgroundColor: '#050505', border: '1px solid rgba(0,210,255,0.28)', borderRadius: '16px', display: 'grid', gridTemplateColumns: 'minmax(220px, 360px) 1fr auto', gap: '18px', alignItems: 'start' }}>
          <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
            {selectedGigDetail.image ? (
              <img src={selectedGigDetail.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>NO PAMFLET</span>
            )}
          </div>
          <div>
            <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 8px 0' }}>DETAIL EVENT</p>
            <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: '900', margin: '0 0 10px 0', lineHeight: 1 }}>{selectedGigDetail.title?.toUpperCase()}</h3>
            <div style={{ display: 'grid', gap: '6px', color: '#aaa', fontSize: '12px', lineHeight: 1.45 }}>
              <span>DATE: <strong style={{ color: '#fff' }}>{getGigDate(selectedGigDetail)}</strong></span>
              <span>VENUE: <strong style={{ color: '#fff' }}>{selectedGigDetail.city?.toUpperCase()}</strong></span>
              <span>HTM: <strong style={{ color: '#00d2ff' }}>{getGigHtm(selectedGigDetail).toUpperCase()}</strong></span>
              <span>CP INFO: <strong style={{ color: '#fff' }}>{getGigCp(selectedGigDetail)}</strong></span>
              {isApprovedHomepageGig(selectedGigDetail) && <span>TAYANG SAMPAI: <strong style={{ color: '#ffcc00' }}>{getGigApprovedUntil(selectedGigDetail) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</strong></span>}
            </div>
          </div>
          <button onClick={() => setSelectedGigDetail(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>CLOSE</button>
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
                  <button type="button" onClick={closeAdminGate} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>BACK HOME</button>
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
            <div style={{ ...glassStyle('admin-stat-rule'), padding: '16px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 6px 0' }}>EXCLUSIVE LIVE</p>
              <strong style={{ color: '#fff', fontSize: '28px', fontWeight: '900' }}>{approvedExclusiveGigs.length}</strong>
            </div>
          </div>

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
                    style={{ width: '100%', padding: 0, margin: '0 0 14px 0', border: 'none', background: 'transparent', cursor: gig.image ? 'zoom-in' : 'default', fontFamily: "'League Spartan'" }}
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
                    <button onClick={() => handleGigModeration(gig.id, 'approved_free')} style={{ padding: '10px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>FREE</button>
                    <button onClick={() => handleGigModeration(gig.id, 'approved_exclusive')} style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(0,210,255,0.45)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>EXCLUSIVE</button>
                    <button onClick={() => handleGigModeration(gig.id, 'rejected')} style={{ padding: '10px', backgroundColor: 'rgba(255,51,51,0.1)', color: '#ff3333', border: '1px solid rgba(255,51,51,0.35)', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>REJECT</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

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
                        <button onClick={() => handleGigRemove(gig.id)} style={{ padding: '9px 11px', backgroundColor: 'rgba(255,51,51,0.1)', color: '#ff3333', border: '1px solid rgba(255,51,51,0.35)', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>REMOVE</button>
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

          <div style={{ display: exploreTab === 'rilisan' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900' }}>Rp {Number(album.price || 0).toLocaleString('id-ID')}</span>
                          <button onClick={() => handlePurchaseAlbum(album)} style={{ ...glassButtonStyle, padding: '8px 12px', fontSize: '11px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI'}</button>
                        </div>
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
                        <button onClick={() => handlePlayTrack(track)} style={{ ...glassButtonStyle, padding: '7px 14px', fontSize: '11px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PREVIEW'}</button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <aside style={{ display: 'grid', gap: '18px' }}>
              <section style={{ ...glassStyle('explore-band-directory'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>BAND DIRECTORY</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '68px 1fr', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ width: '68px', height: '68px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', display: 'grid', placeItems: 'center' }}>
                    {bandProfile.photoPreview ? <img src={bandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                  </div>
                  <div>
                    <button
                      onClick={() => { setIsViewingOwnBandProfile(false); setActivePage('band_public'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 5px 0', padding: 0, cursor: 'pointer', fontFamily: "'League Spartan'", textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'rgba(0,210,255,0.65)', textUnderlineOffset: '4px' }}
                    >
                      {(bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()}
                    </button>
                    <p style={{ color: '#777', fontSize: '12px', margin: '0 0 4px 0' }}>{(bandProfile.city || 'INDONESIA').toUpperCase()} / {(bandProfile.genre || 'INDIE').toUpperCase()}</p>
                    <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: 0 }}>/{bandProfile.slug || 'band-wispace'}</p>
                  </div>
                </div>
                <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.45, margin: '0 0 14px 0' }}>{bandProfile.headline || 'Profile band akan muncul lengkap setelah musisi mengisi Band Studio.'}</p>
              </section>

              <section style={{ ...glassStyle('explore-merch'), padding: '18px', backgroundColor: '#090909' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>MERCH HIGHLIGHT</h3>
                  <button onClick={() => setExploreTab('merch')} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>LIHAT SEMUA</button>
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
              {bandMatchesSearch ? (
                <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr auto', gap: '16px', alignItems: 'center', padding: '14px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px' }}>
                  <div style={{ width: '86px', height: '86px', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                    {bandProfile.photoPreview ? <img src={bandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>BAND</span>}
                  </div>
                  <div>
                    <h4 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', margin: '0 0 6px 0' }}>{(bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()}</h4>
                    <p style={{ color: '#777', fontSize: '13px', margin: '0 0 6px 0' }}>{(bandProfile.genre || 'INDIE').toUpperCase()} / {(bandProfile.city || 'INDONESIA').toUpperCase()}</p>
                    <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.45, margin: 0 }}>{bandProfile.headline || 'Profile band akan muncul lengkap setelah musisi mengisi Band Studio.'}</p>
                  </div>
                  <button onClick={() => { setIsViewingOwnBandProfile(false); setActivePage('band_public'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '11px 16px', fontSize: '12px' }}>LIHAT PROFILE</button>
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

          {merchItems.length === 0 ? (
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
                  <button onClick={() => { setActivePage('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE BAND DULU</button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '18px' }}>
              {merchItems.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setSelectedMerchDetail(selectedMerchDetail?.id === item.id ? null : item)}
                  style={{ ...glassStyle(`merch-market-${item.id}`), padding: '14px', backgroundColor: '#090909', cursor: 'pointer', position: 'relative' }}
                >
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.07)', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                    {item.imagePreview ? <img src={item.imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>MERCH</span>}
                  </div>
                  <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', margin: '0 0 8px 0' }}>{(bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()} / STOCK {item.stock || 0}</p>
                  <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '900', margin: '0 0 8px 0', lineHeight: 1.1 }}>{item.name.toUpperCase()}</h4>
                  <p style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: 0 }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</p>
                  {selectedMerchDetail?.id === item.id && (
                    <div onClick={(event) => event.stopPropagation()} style={{ marginTop: '14px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '12px', animation: 'slideDown 0.2s ease-out' }}>
                      <p style={{ color: '#aaa', fontSize: '12px', lineHeight: 1.45, margin: '0 0 12px 0' }}>{item.description || 'Merchandise resmi band di WiSpace.'}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ color: '#777', fontSize: '11px' }}>STOK<br/><strong style={{ color: '#fff', fontSize: '13px' }}>{item.stock || 0}</strong></div>
                        <div style={{ color: '#777', fontSize: '11px' }}>BAND<br/><strong style={{ color: '#fff', fontSize: '13px' }}>{(bandProfile.name || signatureName || 'BAND WISPACE').toUpperCase()}</strong></div>
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

          {articleItems.length === 0 ? (
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
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.6fr)', gap: '24px', alignItems: 'start' }}>
              <main style={{ display: 'grid', gap: '18px' }}>
                {articleItems.map((article) => (
                  <article key={article.id} style={{ ...glassStyle(`article-${article.id}`), padding: '20px', backgroundColor: '#090909' }}>
                    <p style={{ color: '#00d2ff', fontSize: '10px', fontWeight: '900', letterSpacing: '1px', margin: '0 0 10px 0' }}>{article.category.toUpperCase()} / {article.createdAt}</p>
                    <h3 style={{ color: '#fff', fontSize: '26px', fontWeight: '900', lineHeight: 1, margin: '0 0 12px 0' }}>{article.title.toUpperCase()}</h3>
                    <p style={{ color: '#aaa', fontSize: '14px', lineHeight: 1.6, margin: '0 0 14px 0' }}>{article.excerpt}</p>
                    {article.body && <p style={{ color: '#777', fontSize: '13px', lineHeight: 1.65, margin: '0 0 14px 0', whiteSpace: 'pre-line' }}>{article.body}</p>}
                    <p style={{ color: '#555', fontSize: '11px', fontWeight: '900', margin: 0 }}>PENULIS: {(article.bandName || 'BAND WISPACE').toUpperCase()}</p>
                  </article>
                ))}
              </main>
              <aside style={{ ...glassStyle('article-sidebar'), padding: '18px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>10 ARTIKEL TERBARU</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {articleItems.slice(0, 10).map((article) => (
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
          <div style={{ position: 'relative', minHeight: '470px', display: 'flex', alignItems: 'flex-end', padding: '92px 38px 38px', boxSizing: 'border-box' }}>
            {bandProfile.coverPreview ? (
              <img src={bandProfile.coverPreview} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #050505 0%, #072027 45%, #000 100%)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 78%, rgba(0,210,255,0.18), transparent 34%), linear-gradient(to top, rgba(3,3,3,1), rgba(3,3,3,0.62), rgba(3,3,3,0.16))' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '136px minmax(0, 1fr)', gap: '24px', alignItems: 'end', width: '100%' }}>
              <div style={{ width: '136px', height: '136px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.72)', display: 'grid', placeItems: 'center', boxShadow: '0 24px 55px rgba(0,0,0,0.55), 0 0 30px rgba(0,210,255,0.2)' }}>
                {bandProfile.photoPreview ? <img src={bandProfile.photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>FOTO BAND</span>}
              </div>
              <div>
                <p style={eyebrowStyle}>PUBLIC BAND PROFILE</p>
                <h2 style={{ ...pageTitleStyle, fontSize: 'clamp(42px, 7vw, 72px)', maxWidth: '980px' }}>{(bandProfile.name || signatureName || 'NAMA BAND').toUpperCase()}</h2>
                <p style={{ color: '#f5f5f5', fontSize: '17px', fontWeight: '900', margin: '14px 0 12px 0', maxWidth: '760px', lineHeight: 1.25 }}>{bandProfile.headline || 'Headline band akan tampil di sini setelah profile diisi.'}</p>
                <p style={{ color: '#9a9a9a', fontSize: '13px', fontWeight: '800', margin: 0 }}>{(bandProfile.city || 'KOTA').toUpperCase()} / {(bandProfile.genre || 'GENRE').toUpperCase()}{bandProfile.formedYear ? ` / SINCE ${bandProfile.formedYear}` : ''} / wispace.my.id/band/{bandProfile.slug || 'nama-band'}</p>
              </div>
            </div>
          </div>

          <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1.25fr) minmax(260px, 0.75fr)', gap: '24px', alignItems: 'start' }}>
            <main>
              <div style={{ ...glassStyle('band-owner-actions'), padding: '14px', backgroundColor: '#090909', marginBottom: '24px', display: showBandOwnerControls ? 'block' : 'none' }}>
                <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 12px 0' }}>OWNER ACTIONS</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <button onClick={() => { setBandProfileTab('profile'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px' }}>EDIT PROFILE</button>
                  <button onClick={() => { setBandProfileTab('album'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px', color: '#fff', borderColor: '#444' }}>UPLOAD ALBUM</button>
                  <button onClick={() => { setBandProfileTab('merch'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px', color: '#fff', borderColor: '#444' }}>MERCHANDISE</button>
                  <button onClick={() => { setBandProfileTab('artikel'); setActivePage('band_profile'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px', color: '#fff', borderColor: '#444' }}>TULIS ARTIKEL</button>
                  <button onClick={() => { setActivePage('gig_manager'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px' }}>UPLOAD PAMFLET GIGS</button>
                  <button onClick={() => { setActivePage('gig_manager'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px', color: '#fff', borderColor: '#444' }}>JADWAL MANGGUNG</button>
                  <button onClick={() => { setActivePage('finance_dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: '#39ff14' }}>DASHBOARD KEUANGAN</button>
                </div>
              </div>

              <section style={{ ...glassStyle('band-public-bio'), padding: '20px', backgroundColor: '#090909', marginBottom: '24px' }}>
                <h3 style={sectionHeadingStyle}>BIO BAND</h3>
                <p style={{ color: '#bbb', fontSize: '14px', lineHeight: 1.65, margin: 0 }}>{bandProfile.bio || 'Bio band belum diisi. Nanti audience akan membaca cerita band, karakter musik, rilisan, dan info kontak di bagian ini.'}</p>
              </section>

              <section style={{ ...glassStyle('band-public-releases'), padding: '20px', backgroundColor: '#090909', marginBottom: '24px' }}>
                <h3 style={sectionHeadingStyle}>ALBUM DIGITAL</h3>
                {albumItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Belum ada album digital. Upload album pertama dari tombol owner actions.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {albumItems.map((album) => (
                      <article key={album.id} style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '14px', padding: '12px' }}>
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center', marginBottom: '12px' }}>
                          {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '11px', fontWeight: '900' }}>COVER</span>}
                        </div>
                        <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 6px 0' }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>Rp {Number(album.price || 0).toLocaleString('id-ID')}</p>
                        <button onClick={() => handlePurchaseAlbum(album)} style={{ ...glassButtonStyle, width: '100%', padding: '9px', fontSize: '11px' }}>{!userSession ? 'JOIN TO BUY' : purchasedAlbums.some((item) => item.id === album.id) ? 'LIBRARY' : 'BELI ALBUM'}</button>
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
                <p style={{ color: '#777', fontSize: '12px', margin: '0 0 8px 0' }}>CP: <span style={{ color: '#fff' }}>{bandProfile.cp || '-'}</span></p>
                <p style={{ color: '#777', fontSize: '12px', margin: '0 0 8px 0' }}>Email: <span style={{ color: '#fff' }}>{bandProfile.email || '-'}</span></p>
                <p style={{ color: '#777', fontSize: '12px', margin: 0 }}>Instagram: <span style={{ color: '#fff' }}>{bandProfile.instagram || '-'}</span></p>
                {showBandContactForm ? (
                  <form onSubmit={handleMessageSubmit} style={{ display: 'grid', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #141414' }}>
                    <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: 0 }}>KIRIM PESAN KE {(bandProfile.name || signatureName || 'BAND INI').toUpperCase()}</p>
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
                {merchItems.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>Belum ada merchandise. Kelola etalase merch dari tombol owner actions.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {merchItems.slice(0, 4).map((item) => (
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
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
                <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'free' ? '1px solid #39ff14' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'free' ? 'rgba(57,255,20,0.12)' : '#000', color: newGigRequestType === 'free' ? '#39ff14' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>FREE BULLETIN</button>
                <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '12px', border: newGigRequestType === 'exclusive' ? '1px solid #00d2ff' : '1px solid #1f1f1f', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.14)' : '#000', color: newGigRequestType === 'exclusive' ? '#00d2ff' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>EXCLUSIVE SLIDE</button>
              </div>
              <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#000', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.32)' : 'rgba(57,255,20,0.24)'}`, borderRadius: '14px' }}>
                <p style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 6px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE EVENT SLOT' : 'FREE BULLETIN SLOT'}</p>
                <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.45, margin: 0 }}>{newGigRequestType === 'exclusive' ? 'Request berbayar untuk masuk slide besar homepage dan tetap wajib dicek admin.' : 'Request gratis untuk masuk bulletin gigs homepage dan jadwal manggung publik setelah dicek admin.'}</p>
                <p style={{ color: '#ffcc00', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>MASA TAYANG: 10 HARI SEJAK ADMIN APPROVE. Setelah lewat tanggal tayang, pamflet perlu diajukan ulang.</p>
                <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', lineHeight: 1.45, margin: '10px 0 0 0' }}>UKURAN DISARANKAN: {posterUploadGuide.size} / {posterUploadGuide.ratio} / MAX 2MB</p>
                <p style={{ color: '#666', fontSize: '11px', lineHeight: 1.4, margin: '5px 0 0 0' }}>{posterUploadGuide.note}</p>
              </div>
              <button type="submit" style={{ width: '100%', padding: '14px', marginTop: '16px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>KIRIM KE ANTREAN KURASI</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>PENDING</p>
                    <strong style={{ color: '#ffcc00', fontSize: '22px' }}>{pendingGigs.length}</strong>
                  </div>
                  <div style={{ backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px', padding: '12px' }}>
                    <p style={{ color: '#666', fontSize: '10px', fontWeight: '900', margin: '0 0 5px 0' }}>FREE</p>
                    <strong style={{ color: '#39ff14', fontSize: '22px' }}>{approvedFreeGigs.length}</strong>
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
                          {isApprovedHomepageGig(gig) && (
                            <p style={{ color: '#00d2ff', fontSize: '11px', fontWeight: '900', margin: '4px 0 0 0' }}>TAYANG SAMPAI: {getGigApprovedUntil(gig) || 'APPROVE ULANG SETELAH SQL UPGRADE'}</p>
                          )}
                        </div>
                        <span style={{ color: gig.status === 'approved' || gig.status === 'approved_free' ? '#39ff14' : gig.status === 'approved_exclusive' ? '#00d2ff' : gig.status === 'rejected' ? '#ff3333' : '#ffcc00', fontSize: '10px', fontWeight: '900' }}>{(gig.status || 'pending').replace('approved_', '').toUpperCase()}</span>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.85fr) minmax(300px, 1.15fr)', gap: '24px', alignItems: 'start' }}>
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
                  <button onClick={() => { setActivePage('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '13px', fontSize: '12px' }}>EXPLORE RILISAN</button>
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
                <button type="submit" style={{ width: '100%', padding: '13px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>SIMPAN PROFILE AUDIENCE</button>
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
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
            <div style={{ ...glassStyle('library-owned'), padding: '18px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>OWNED ALBUMS</p>
              <h3 style={{ color: '#00d2ff', fontSize: '32px', fontWeight: '900', margin: 0 }}>{purchasedAlbums.length}</h3>
            </div>
            <div style={{ ...glassStyle('library-access'), padding: '18px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>ACCESS TYPE</p>
              <h3 style={{ color: '#fff', fontSize: '24px', fontWeight: '900', margin: 0 }}>ENCRYPTED</h3>
            </div>
            <div style={{ ...glassStyle('library-policy'), padding: '18px', backgroundColor: '#090909' }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 8px 0' }}>REDISTRIBUTION</p>
              <h3 style={{ color: '#ff3333', fontSize: '24px', fontWeight: '900', margin: 0 }}>DILARANG</h3>
            </div>
          </div>

          {purchasedAlbums.length === 0 ? (
            <div style={{ ...glassStyle('library-empty'), padding: '28px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: '0 0 10px 0' }}>LIBRARY MASIH KOSONG</h3>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 18px 0', lineHeight: 1.5 }}>Buka Explore, pilih album digital, lalu klik beli. Untuk sekarang masih mock purchase dulu.</p>
              <button onClick={() => { setActivePage('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '12px 18px', fontSize: '12px' }}>EXPLORE RILISAN</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(280px, 0.9fr)', gap: '24px', alignItems: 'start' }}>
              <section style={{ ...glassStyle('library-list'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={sectionHeadingStyle}>PURCHASED RELEASES</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {purchasedAlbums.map((album) => (
                    <article key={album.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px', backgroundColor: '#000', border: '1px solid #141414', borderRadius: '12px' }}>
                      <div style={{ width: '72px', height: '72px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#111', display: 'grid', placeItems: 'center' }}>
                        {album.coverPreview ? <img src={album.coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '10px', fontWeight: '900' }}>COVER</span>}
                      </div>
                      <div>
                        <h4 style={{ color: '#fff', fontSize: '14px', fontWeight: '900', margin: '0 0 5px 0' }}>{album.title.toUpperCase()}</h4>
                        <p style={{ color: '#777', fontSize: '12px', margin: 0 }}>{album.bandName.toUpperCase()} / {album.trackCount} TRACK / {album.purchasedAt}</p>
                      </div>
                      <button style={{ ...glassButtonStyle, padding: '8px 12px', fontSize: '11px' }}>PLAY</button>
                    </article>
                  ))}
                </div>
              </section>

              <aside style={{ ...glassStyle('library-player'), padding: '20px', backgroundColor: '#090909' }}>
                <h3 style={{ color: '#00d2ff', fontSize: '14px', fontWeight: '900', margin: '0 0 16px 0' }}>SECURE PLAYER</h3>
                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '16px', backgroundColor: '#000', border: '1px solid #141414', display: 'grid', placeItems: 'center', marginBottom: '16px', overflow: 'hidden' }}>
                  {purchasedAlbums[0]?.coverPreview ? <img src={purchasedAlbums[0].coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#333', fontSize: '12px', fontWeight: '900' }}>PLAYER</span>}
                </div>
                <h4 style={{ color: '#fff', fontSize: '18px', fontWeight: '900', margin: '0 0 6px 0' }}>{purchasedAlbums[0]?.title?.toUpperCase() || 'NO TRACK SELECTED'}</h4>
                <p style={{ color: '#777', fontSize: '12px', lineHeight: 1.5, margin: '0 0 16px 0' }}>File berada di secret encrypted folder. Audience bisa access/download pribadi, tapi tidak boleh redistribusi ulang.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button style={{ ...glassButtonStyle, padding: '12px', fontSize: '11px' }}>PLAY ALBUM</button>
                  <button style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>SECURE DOWNLOAD</button>
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
                    <button onClick={() => { setActivePage('explore'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '11px 16px', fontSize: '12px' }}>CARI BAND DI EXPLORE</button>
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
                            <button type="button" onClick={() => { setActiveReplyId(null); setReplyDraft(''); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>BATAL</button>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <section style={{ ...glassStyle('finance-rules'), padding: '20px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#39ff14', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>ATURAN PENCAIRAN</h3>
              <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Pencairan diproses setiap tanggal 1. Minimum saldo Rp 100.000. WiSpace mengambil flat 20% dari penjualan bersih, band menerima 80%.</p>
            </section>
            <section style={{ ...glassStyle('finance-history'), padding: '20px', backgroundColor: '#090909' }}>
              <h3 style={{ color: '#39ff14', fontSize: '14px', fontWeight: '900', margin: '0 0 14px 0' }}>RIWAYAT TRANSAKSI</h3>
              <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>Belum ada transaksi real. Nanti bagian ini menampilkan penjualan album, merchandise, fee platform, dan status payout.</p>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
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
              <p style={{ color: '#777', fontSize: '12px', fontWeight: '700', margin: '0 0 8px 0' }}>wispace.my.id/band/{bandProfile.slug || (bandProfile.name ? createSlug(bandProfile.name) : 'nama-band')}</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
                <button onClick={() => { setActivePage('message_center'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ ...glassButtonStyle, padding: '10px', fontSize: '11px' }}>MESSAGE</button>
                <button style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: '12px', padding: '10px', fontSize: '11px', fontWeight: '900', fontFamily: "'League Spartan'" }}>FOLLOW</button>
              </div>
              <div style={{ borderTop: '1px solid #141414', paddingTop: '14px', marginBottom: '14px' }}>
                <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: '900', margin: '0 0 10px 0' }}>PROMO PLAYER</h4>
                <p style={{ color: '#555', fontSize: '12px', lineHeight: 1.4, margin: 0 }}>Nanti maksimal 5 lagu promo tampil di sini, masing-masing preview 30 detik.</p>
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
                    style={{ padding: '10px 16px', backgroundColor: bandProfileTab === tab ? '#00d2ff' : 'transparent', color: bandProfileTab === tab ? '#000' : '#777', border: bandProfileTab === tab ? 'none' : '1px solid #222', borderRadius: '12px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}
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
                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>SIMPAN PROFILE BAND</button>
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
                      <p style={{ color: '#666', fontSize: '11px', fontWeight: '900', margin: '0 0 10px 0' }}>TRACK FILES</p>
                      {albumDraft.audioFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderTop: index ? '1px solid #111' : 'none', color: '#ddd', fontSize: '12px' }}>
                          <span>{String(index + 1).padStart(2, '0')} / {file.name}</span>
                          <span style={{ color: '#666' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                      ))}
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

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>SETUJUI & SIAPKAN UPLOAD ALBUM</button>
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
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', padding: '9px 0', borderTop: '1px solid #111', color: '#ddd', fontSize: '12px', alignItems: 'center' }}>
                          <span>{item.name}</span>
                          <span style={{ color: '#00d2ff', fontWeight: '900' }}>Rp {Number(item.price || 0).toLocaleString('id-ID')}</span>
                          <span style={{ color: '#666' }}>Stok {item.stock}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>TAMBAH KE ETALASE MERCH</button>
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

                  <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#00d2ff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>PUBLISH ARTIKEL DRAFT</button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {/* BULLETIN MADING GIGS */}
      {!loading && !isAdminPage && !isBandProfilePage && !isBandPublicPage && !isFinancePage && !isGigManagerPage && !isMessagePage && !isAudienceProfilePage && !isAudienceLibraryPage && !isExplorePage && !isMerchMarketPage && !isArticlesPage && (
        <section style={{ marginBottom: '60px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#00d2ff', marginBottom: '24px', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '8px' }}> UPDATED GIGS BULLETIN BOARD</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
            {filteredGigs.map(gig => (
              <div 
                key={gig.id} 
                onMouseEnter={() => setHoveredCard(gig.id)} 
                onMouseLeave={() => setHoveredCard(null)} 
                onClick={() => setSelectedGigDetail(selectedGigDetail?.id === gig.id ? null : gig)} // Klik buat buka/tutup laci
                style={{ ...glassStyle(gig.id), padding: '14px', backgroundColor: '#090909', position: 'relative', cursor: 'pointer' }}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowReportMenu(showReportMenu === gig.id ? null : gig.id);
                  }}
                  style={{ position: 'absolute', top: '22px', right: '22px', zIndex: 2, width: '34px', height: '34px', borderRadius: '9999px', border: '1px solid rgba(255, 51, 51, 0.35)', backgroundColor: 'rgba(0, 0, 0, 0.72)', color: '#ff3333', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
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
                        style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid #141414', color: '#ddd', fontSize: '11px', fontWeight: '800', padding: '8px 0', textAlign: 'left', cursor: 'pointer', fontFamily: "'League Spartan'" }}
                      >
                        {jenis.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}

                {renderGigPosterImage(gig, { width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: '12px', marginBottom: '14px' })}
                <h3 style={{ fontSize: '16px', fontWeight: '900', margin: '0 0 6px 0', color: '#fff' }}>{gig.title.toUpperCase()}</h3>
                <p style={{ color: '#00d2ff', fontSize: '12px', fontWeight: '700', margin: 0 }}>📍 {gig.city.toUpperCase()}</p>
                
                {/* LACI GESER DETAIL (POP-DRAWER GAYA 3) - MUNCUL DI BAWAH POSTER YANG DIKLIK */}
                {selectedGigDetail?.id === gig.id && (
                  <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0,210,255,0.3)', borderRadius: '12px', animation: 'slideDown 0.2s ease-out' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontFamily: "'League Spartan'" }}>
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
          <div onMouseEnter={() => setHoveredCard('c1')} onMouseLeave={() => setHoveredCard(null)} style={{ ...glassStyle('c1'), padding: '24px', backgroundColor: '#090909' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#00d2ff', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Radio size={14}/> RADIO TOP 10 INDIE CLOUD</h3>
            {top10Tracks.map(track => (
              <div key={track.id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #141414', alignItems: 'center' }}>
                <div><h4 style={{ fontSize: '14px', color: '#fff', margin: 0 }}>{track.title.toUpperCase()}</h4><p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{track.band.toUpperCase()}</p></div>
                <button onClick={() => handlePlayTrack(track)} style={{ ...glassButtonStyle, padding: '6px 14px', fontSize: '11px' }}>{activeTrack?.id === track.id && isPlaying ? 'PAUSE' : 'PLAY'}</button>
              </div>
            ))}
          </div>
          <div style={{ ...glassStyle('c2'), padding: '24px', backgroundColor: '#090909' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', color: '#00d2ff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={14}/> 10 ARTIKEL BAND TERBARU</h3>
              <button onClick={() => { setActivePage('articles'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '10px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>LIHAT</button>
            </div>
            {articleItems.length === 0 ? (
              <p style={{ color: '#555', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>Belum ada artikel band. Nanti interview, catatan rilisan, dan report skena terbaru muncul di sini.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {articleItems.slice(0, 10).map((article) => (
                  <button key={article.id} onClick={() => { setActivePage('articles'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ textAlign: 'left', padding: '10px 0', border: 'none', borderTop: '1px solid #141414', background: 'transparent', cursor: 'pointer', fontFamily: "'League Spartan'" }}>
                    <p style={{ color: '#fff', fontSize: '13px', fontWeight: '900', margin: '0 0 5px 0' }}>{article.title.toUpperCase()}</p>
                    <p style={{ color: '#777', fontSize: '11px', margin: 0 }}>{article.category} / {article.bandName}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ ...glassStyle('c3'), padding: '24px', backgroundColor: '#090909' }}><h3 style={{ fontSize: '14px', color: '#00d2ff', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={14}/> DISTRO BAND MERCHANDISE</h3></div>
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
              <button onClick={() => setSelectedPosterPreview(null)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: '12px', padding: '10px 12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>CLOSE</button>
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
                <input type="email" placeholder="EMAIL USER" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: "'League Spartan'", boxSizing: 'border-box' }} />
                <input type="password" placeholder="PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: "'League Spartan'", boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#000', border: `1px solid ${authError.startsWith('Link') ? 'rgba(0,210,255,0.35)' : 'rgba(255,51,51,0.35)'}`, color: authError.startsWith('Link') ? '#00d2ff' : '#ff3333', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '14px', backgroundColor: authLoading ? '#141414' : '#00d2ff', color: authLoading ? '#555' : '#000', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: "'League Spartan'" }}>{authLoading ? 'MEMPROSES...' : 'LOG MASUK'}</button>
                <button type="button" onClick={handleResendVerification} disabled={authLoading} style={{ width: '100%', marginTop: '10px', padding: '12px', backgroundColor: 'transparent', color: '#00d2ff', border: '1px solid rgba(0,210,255,0.35)', borderRadius: '16px', fontWeight: '900', cursor: authLoading ? 'wait' : 'pointer', fontFamily: "'League Spartan'", fontSize: '12px' }}>KIRIM ULANG VERIFIKASI EMAIL</button>
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

                <input type="email" placeholder="ALAMAT EMAIL RESMI" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: "'League Spartan'", boxSizing: 'border-box' }} />
                <input type="password" placeholder="BUAT PASSWORD AKUN" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '12px', fontFamily: "'League Spartan'", boxSizing: 'border-box' }} />
                {authError && (
                  <div style={{ backgroundColor: '#000', border: `1px solid ${authError.startsWith('Link') ? 'rgba(0,210,255,0.35)' : 'rgba(255,51,51,0.35)'}`, color: authError.startsWith('Link') ? '#00d2ff' : '#ff3333', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '800', lineHeight: 1.4, marginBottom: '12px' }}>{authError}</div>
                )}
                
                {/* Tombol Submit Kunci Akun */}
                <button type="submit" disabled={!userRole || authLoading} style={{ width: '100%', padding: '14px', backgroundColor: userRole && !authLoading ? '#00d2ff' : '#141414', color: userRole && !authLoading ? '#000' : '#444', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: userRole && !authLoading ? 'pointer' : 'not-allowed', fontFamily: "'League Spartan'", transition: 'all 0.2s' }}>
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
                  <button onClick={() => handleRoleSelection('musisi')} style={{ padding: '16px', backgroundColor: 'rgba(0,210,255,0.05)', border: '1px solid #00d2ff', borderRadius: '16px', color: '#00d2ff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: "'League Spartan'" }}>🎸 SEBAGAI MUSISI (UPLOAD KARYA/GIGS)</button>
                  <button onClick={() => handleRoleSelection('audience')} style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', fontWeight: '900', fontSize: '14px', cursor: 'pointer', fontFamily: "'League Spartan'" }}>🎧 SEBAGAI AUDIENCE (PENIKMAT/KOLEKTOR)</button>
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
                <input type="text" placeholder="CONTOH: SKENA NOISE SYNDICATE" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} required style={{ width: '100%', backgroundColor: '#000', border: '1px solid #222', borderRadius: '16px', padding: '12px', fontSize: '13px', color: '#fff', marginBottom: '16px', fontFamily: "'League Spartan'", boxSizing: 'border-box', textAlign: 'center' }} />
                <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#ff3333', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>SAYA SETUJU & SIGN KONTRAK ✍️</button>
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
                    <button disabled={bandBalance < 100000} style={{ padding: '8px 14px', backgroundColor: bandBalance >= 100000 ? '#00d2ff' : '#141414', border: 'none', borderRadius: '16px', color: bandBalance >= 100000 ? '#000' : '#444', fontSize: '11px', fontWeight: '900', cursor: bandBalance >= 100000 ? 'pointer' : 'not-allowed', fontFamily: "'League Spartan'" }}>TARIK DANA</button>
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
                  <button type="button" onClick={() => { setNewGigRequestType('free'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'free' ? '1px solid #39ff14' : '1px solid #222', backgroundColor: newGigRequestType === 'free' ? 'rgba(57,255,20,0.12)' : '#000', color: newGigRequestType === 'free' ? '#39ff14' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>FREE BULLETIN</button>
                  <button type="button" onClick={() => { setNewGigRequestType('exclusive'); setNewPosterNotice(''); }} style={{ padding: '12px', borderRadius: '14px', border: newGigRequestType === 'exclusive' ? '1px solid #00d2ff' : '1px solid #222', backgroundColor: newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.14)' : '#000', color: newGigRequestType === 'exclusive' ? '#00d2ff' : '#777', fontSize: '11px', fontWeight: '900', cursor: 'pointer', fontFamily: "'League Spartan'" }}>EXCLUSIVE SLIDE</button>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#000', border: `1px solid ${newGigRequestType === 'exclusive' ? 'rgba(0,210,255,0.32)' : 'rgba(57,255,20,0.24)'}`, borderRadius: '14px', marginBottom: '18px' }}>
                  <p style={{ color: '#fff', fontSize: '11px', fontWeight: '900', margin: '0 0 5px 0' }}>{newGigRequestType === 'exclusive' ? 'EXCLUSIVE SLIDE BERBAYAR' : 'FREE BULLETIN GRATIS'}</p>
                  <p style={{ color: '#777', fontSize: '11px', lineHeight: 1.4, margin: 0 }}>{newGigRequestType === 'exclusive' ? 'Masuk slide besar homepage setelah admin approve.' : 'Masuk daftar bulletin gigs homepage setelah admin approve.'}</p>
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
