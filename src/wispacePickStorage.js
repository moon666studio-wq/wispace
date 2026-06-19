const WISPACE_PICK_STORAGE_KEY = 'wispace_home_pick';

export const createEmptyWispacePick = () => ({
  youtubeUrl: '',
  title: 'WiSpace Video Review',
  bandName: 'WiSpace',
  review: 'Isi link YouTube dan review singkat dari admin. Kalau link kosong, homepage otomatis pakai random pick dari rilisan dan gigs.',
  thumbnail: '',
  updatedAt: ''
});

export const getYoutubeVideoId = (url = '') => {
  const match = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^?&/]+)/i);
  return match?.[1] || '';
};

export const getYoutubeThumbnail = (url = '') => {
  const videoId = getYoutubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
};

export const mapWispacePickFromRow = (row) => ({
  ...createEmptyWispacePick(),
  youtubeUrl: row?.youtube_url || '',
  title: row?.title || createEmptyWispacePick().title,
  bandName: row?.band_name || createEmptyWispacePick().bandName,
  review: row?.review || createEmptyWispacePick().review,
  thumbnail: row?.thumbnail || '',
  updatedAt: row?.updated_at || ''
});

export const mapWispacePickToRow = (pick, userId = null) => ({
  id: 'homepage',
  youtube_url: pick.youtubeUrl || '',
  title: pick.title || createEmptyWispacePick().title,
  band_name: pick.bandName || createEmptyWispacePick().bandName,
  review: pick.review || createEmptyWispacePick().review,
  thumbnail: pick.thumbnail || '',
  is_published: Boolean(pick.youtubeUrl),
  updated_by: userId || null,
  updated_at: new Date().toISOString()
});

export const loadWispacePick = () => {
  if (typeof window === 'undefined') return createEmptyWispacePick();
  try {
    const storedPick = window.localStorage.getItem(WISPACE_PICK_STORAGE_KEY);
    return storedPick ? { ...createEmptyWispacePick(), ...JSON.parse(storedPick) } : createEmptyWispacePick();
  } catch {
    return createEmptyWispacePick();
  }
};

export const saveWispacePick = (pick) => {
  const nextPick = {
    ...createEmptyWispacePick(),
    ...pick,
    updatedAt: new Date().toISOString()
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(WISPACE_PICK_STORAGE_KEY, JSON.stringify(nextPick));
  }
  return nextPick;
};
