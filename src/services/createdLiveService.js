const STORAGE_KEY = 'vuvio:createdLives';
const CREATED_LIVE_EVENT = 'vuvio:created-live';
const activeLiveStreams = new Map();

const coverByFamily = {
  air: '/assets/pov/01_mountain_rescue_helicopter.jpg',
  earth: '/assets/videos/biking-cover.jpg',
  water: '/assets/pov/01_surfer.jpg',
};

const baseCoordinatesByFamily = {
  air: [2.3522, 48.8566],
  earth: [6.8647, 45.8326],
  water: [5.3698, 43.2965],
};

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function readStoredLives() {
  const win = safeWindow();
  if (!win) return [];

  try {
    const stored = JSON.parse(win.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeStoredLives(lives) {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(lives));
}

function coordinatesForDraft(draft) {
  const base = baseCoordinatesByFamily[draft.family] ?? baseCoordinatesByFamily.earth;
  const seed = Date.now() % 1000;
  const lngOffset = ((seed % 17) - 8) / 100;
  const latOffset = ((seed % 13) - 6) / 100;
  return [base[0] + lngOffset, base[1] + latOffset];
}

export function getCreatedLives() {
  return readStoredLives();
}

export function createLocalLive(draft) {
  const live = {
    id: `created-${Date.now()}`,
    status: 'live',
    name: 'Alex',
    streamer: 'Alex',
    kind: draft.hasCameraStream ? 'camera' : 'image',
    job: draft.subcategory,
    city: draft.family === 'water' ? 'Marseille' : draft.family === 'air' ? 'Paris' : 'Chamonix',
    country: 'France',
    location: draft.location?.trim() || 'Chamonix, France',
    locationLabel: draft.location?.trim() || 'Chamonix, France',
    privacy: draft.privacy || 'Everyone',
    quality: draft.quality || '1080p',
    viewers: '1',
    viewerLabel: '1',
    image: coverByFamily[draft.family] ?? coverByFamily.earth,
    coordinates: coordinatesForDraft(draft),
    family: draft.family,
    subcategory: draft.subcategory,
    povType: draft.family === 'air' ? 'drone' : draft.family === 'water' ? 'marine' : 'pov',
    experienceTitle: draft.title.trim(),
    title: draft.title.trim(),
    description: draft.description.trim(),
    chat: [
      { who: 'Vuvio', text: 'Live started' },
      { who: 'Alex', text: draft.description.trim() },
    ],
    equipment: Array.isArray(draft.equipment) ? draft.equipment : [],
    equipmentSnapshots: Array.isArray(draft.equipmentSnapshots) ? draft.equipmentSnapshots : [],
    equipmentConfirmed: false,
    equipmentUpdatedAt: new Date().toISOString(),
    createdLocally: true,
  };

  const nextLives = [live, ...readStoredLives()].slice(0, 12);
  writeStoredLives(nextLives);
  safeWindow()?.dispatchEvent(new CustomEvent(CREATED_LIVE_EVENT, { detail: live }));
  return live;
}

export function registerCreatedLiveStream(liveId, stream) {
  if (!liveId || !stream) return;
  activeLiveStreams.set(liveId, stream);
}

export function getCreatedLiveStream(liveId) {
  return activeLiveStreams.get(liveId) ?? null;
}

export function subscribeToCreatedLives(callback) {
  const win = safeWindow();
  if (!win) return () => {};

  const listener = () => callback(readStoredLives());
  win.addEventListener(CREATED_LIVE_EVENT, listener);
  return () => win.removeEventListener(CREATED_LIVE_EVENT, listener);
}
