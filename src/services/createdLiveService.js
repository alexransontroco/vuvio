import { collection, setDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

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

function cleanUndefinedFields(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedFields(item)).filter(item => item !== undefined);
  }

  const cleaned = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = cleanUndefinedFields(value);
    }
  });
  return cleaned;
}

async function saveLiveToFirestore(live) {
  try {
    console.log('[createdLiveService] saveLiveToFirestore called for:', live.id, 'creatorUid:', live.creatorUid);
    const liveRef = doc(collection(db, 'activeLives'), live.id);
    const data = cleanUndefinedFields({
      ...live,
      id: live.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(liveRef, data);
    console.log('[createdLiveService] Live saved to Firestore:', live.id);
  } catch (err) {
    console.error('[createdLiveService] Failed to save live:', err.message, err.code);
  }
}

async function removeLiveFromFirestore(liveId) {
  try {
    const q = query(collection(db, 'activeLives'), where('id', '==', liveId));
    const snapshot = await getDocs(q);
    snapshot.forEach(async (docSnap) => {
      await deleteDoc(docSnap.ref);
    });
  } catch (err) {
    console.error('[Firestore] Failed to remove live:', err.message);
  }
}

async function getFirestoreLives() {
  try {
    const q = query(collection(db, 'activeLives'), where('status', '==', 'live'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => docSnap.data());
  } catch (err) {
    console.error('[Firestore] Failed to fetch lives:', err.message);
    return [];
  }
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

export async function getCreatedLives() {
  const local = readStoredLives();
  const firestore = await getFirestoreLives();

  const merged = {};
  local.forEach(live => { merged[live.id] = live; });
  firestore.forEach(live => { merged[live.id] = live; });

  return Object.values(merged).sort((a, b) => {
    const aTime = new Date(a.equipmentUpdatedAt || 0).getTime();
    const bTime = new Date(b.equipmentUpdatedAt || 0).getTime();
    return bTime - aTime;
  });
}

export function createLocalLive(draft, creatorUid = null) {
  const live = {
    id: `created-${Date.now()}`,
    status: 'live',
    name: 'Alex',
    streamer: 'Alex',
    creatorUid,
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
  saveLiveToFirestore(live);
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

  const listener = () => {
    getCreatedLives().then(callback).catch(() => callback([]));
  };
  win.addEventListener(CREATED_LIVE_EVENT, listener);
  return () => win.removeEventListener(CREATED_LIVE_EVENT, listener);
}

export async function endLive(liveId) {
  const local = readStoredLives();
  const updated = local.filter(live => live.id !== liveId);
  writeStoredLives(updated);
  await removeLiveFromFirestore(liveId);
}
