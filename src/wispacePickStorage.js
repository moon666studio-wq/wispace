const WISPACE_PICK_STORAGE_KEY = 'wispace_home_pick';
export const WISPACE_PICK_LABEL_OPTIONS = ['REVIEW', 'PODCAST', 'LIVE SESSION'];
const DEFAULT_WISPACE_PICK_LABEL = WISPACE_PICK_LABEL_OPTIONS[0];

const normalizeWispacePickLabel = (value = '') => {
  const nextValue = String(value || '').trim().toUpperCase();
  return WISPACE_PICK_LABEL_OPTIONS.includes(nextValue) ? nextValue : DEFAULT_WISPACE_PICK_LABEL;
};

const decodeWispacePickTitle = (value = '') => {
  const rawTitle = String(value || '').trim();
  const match = rawTitle.match(/^\[([A-Z ]+)\]\s*(.*)$/);
  if (!match) {
    return {
      contentLabel: DEFAULT_WISPACE_PICK_LABEL,
      title: rawTitle
    };
  }

  return {
    contentLabel: normalizeWispacePickLabel(match[1]),
    title: match[2] || ''
  };
};

const encodeWispacePickTitle = (title = '', contentLabel = DEFAULT_WISPACE_PICK_LABEL) => {
  const safeTitle = String(title || '').trim();
  const safeLabel = normalizeWispacePickLabel(contentLabel);
  return `[${safeLabel}] ${safeTitle}`;
};

export const createEmptyWispacePick = () => ({
  contentLabel: DEFAULT_WISPACE_PICK_LABEL,
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

export const mapWispacePickFromRow = (row) => {
  const decodedTitle = decodeWispacePickTitle(row?.title || '');
  return {
    ...createEmptyWispacePick(),
    youtubeUrl: row?.youtube_url || '',
    contentLabel: decodedTitle.contentLabel,
    title: decodedTitle.title || createEmptyWispacePick().title,
    bandName: row?.band_name || createEmptyWispacePick().bandName,
    review: row?.review || createEmptyWispacePick().review,
    thumbnail: row?.thumbnail || '',
    updatedAt: row?.updated_at || ''
  };
};

export const mapWispacePickToRow = (pick, userId = null) => ({
  id: 'homepage',
  youtube_url: pick.youtubeUrl || '',
  title: encodeWispacePickTitle(
    pick.title || createEmptyWispacePick().title,
    pick.contentLabel || createEmptyWispacePick().contentLabel
  ),
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
