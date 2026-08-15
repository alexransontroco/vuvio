import { collection, setDoc, deleteDoc, doc, getDocs, onSnapshot, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const STORAGE_KEY = 'vuvio:createdLives';
const CREATED_LIVE_EVENT = 'vuvio:created-live';
const activeLiveStreams = new Map();
const LOCAL_LIVE_GRACE_MS = 2 * 60 * 1000;
const RETIRED_LIVE_IDS = new Set([
  'created-1785259033066',
]);

import { MOCK_THUMBNAILS } from '../data/mockVideoUrls.js';

const coverByFamily = {
  air: '/assets/pov/01_mountain_rescue_helicopter.jpg',
  earth: MOCK_THUMBNAILS.biking,
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

    // Mark all previous lives for this creator as ended
    if (live.creatorUid) {
      try {
        const prevQ = query(collection(db, 'activeLives'), where('creatorUid', '==', live.creatorUid), where('status', '==', 'live'));
        const prevSnap = await getDocs(prevQ);
        for (const doc of prevSnap.docs) {
          await updateDoc(doc.ref, { status: 'ended' });
        }
      } catch (err) {
        console.warn('[createdLiveService] Failed to mark previous lives as ended:', err.message);
      }
    }

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
    if (err.code !== 'permission-denied') {
      console.error('[Firestore] Failed to fetch lives:', err.message);
    }
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

function createdLiveTimestamp(live) {
  const fromId = String(live?.id ?? '').match(/^created-(\d+)$/)?.[1];
  if (fromId) return Number(fromId);
  return new Date(live?.equipmentUpdatedAt || live?.createdAt || 0).getTime() || 0;
}

function isRetiredLive(live) {
  return RETIRED_LIVE_IDS.has(live?.id) || live?.status === 'ended' || live?.status === 'cancelled';
}

function isUsableLocalLive(live, firestoreIds) {
  if (!live?.id || isRetiredLive(live)) return false;
  if (firestoreIds.has(live.id)) return true;
  if (activeLiveStreams.has(live.id)) return true;
  return Date.now() - createdLiveTimestamp(live) <= LOCAL_LIVE_GRACE_MS;
}

function mergeCreatedLives(local, firestore) {
  const firestoreIds = new Set(firestore.map((live) => live.id).filter(Boolean));
  const usableLocal = local.filter((live) => isUsableLocalLive(live, firestoreIds));

  if (usableLocal.length !== local.length) {
    writeStoredLives(usableLocal);
  }

  const merged = {};
  usableLocal.forEach(live => { merged[live.id] = live; });
  firestore.filter((live) => !isRetiredLive(live)).forEach(live => {
    const existing = merged[live.id];
    merged[live.id] = existing?.createdLocally ? { ...live, createdLocally: true } : live;
  });

  return Object.values(merged).sort((a, b) => {
    const aTime = new Date(a.equipmentUpdatedAt || 0).getTime();
    const bTime = new Date(b.equipmentUpdatedAt || 0).getTime();
    return bTime - aTime;
  });
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
  return mergeCreatedLives(local, firestore);
}

export function createLocalLive(draft, creatorUid = null, userCoordinates = null) {
  const live = {
    id: `created-${Date.now()}`,
    status: 'live',
    name: 'Alex',
    streamer: 'Alex',
    creatorUid,
    kind: draft.hasCameraStream ? 'camera' : 'image',
    job: draft.subcategory,
    city: draft.geoCity ?? (draft.family === 'water' ? 'Marseille' : draft.family === 'air' ? 'Paris' : 'Chamonix'),
    country: draft.geoCountry ?? 'France',
    location: draft.location?.trim() || 'My location',
    locationLabel: draft.location?.trim() || 'My location',
    privacy: draft.privacy || 'Everyone',
    quality: draft.quality || '1080p',
    viewers: '1',
    viewerLabel: '1',
    image: coverByFamily[draft.family] ?? coverByFamily.earth,
    coordinates: userCoordinates || coordinatesForDraft(draft),
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

export function updateCreatedLive(liveId, patch) {
  const lives = readStoredLives();
  const idx = lives.findIndex(l => l.id === liveId);
  if (idx === -1) return;
  lives[idx] = { ...lives[idx], ...patch };
  writeStoredLives(lives);
  safeWindow()?.dispatchEvent(new CustomEvent(CREATED_LIVE_EVENT, { detail: lives[idx] }));
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

  let firestoreLives = [];
  const emit = () => {
    callback(mergeCreatedLives(readStoredLives(), firestoreLives));
  };

  const listener = () => emit();
  win.addEventListener(CREATED_LIVE_EVENT, listener);
  win.addEventListener('storage', listener);

  let unsubscribeFirestore = () => {};
  try {
    const q = query(collection(db, 'activeLives'), where('status', '==', 'live'));
    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      firestoreLives = snapshot.docs.map(docSnap => docSnap.data());
      emit();
    }, (err) => {
      if (err.code !== 'permission-denied') {
        console.error('[Firestore] Failed to subscribe to lives:', err.message);
      }
    });
  } catch (err) {
    console.error('[Firestore] Failed to start live subscription:', err.message);
  }

  emit();

  return () => {
    win.removeEventListener(CREATED_LIVE_EVENT, listener);
    win.removeEventListener('storage', listener);
    unsubscribeFirestore();
  };
}

export async function endLive(liveId) {
  const local = readStoredLives();
  const updated = local.filter(live => live.id !== liveId);
  writeStoredLives(updated);
}

export async function publishLivePing(liveId) {
  if (!liveId) return null;

  const ping = {
    id: `ping-${Date.now()}`,
    color: '#ff8a1f',
    createdAt: Date.now(),
  };

  const local = readStoredLives();
  const updated = local.map((live) => (live.id === liveId ? { ...live, latestPing: ping } : live));
  if (updated.some((live) => live.id === liveId)) writeStoredLives(updated);

  try {
    await updateDoc(doc(db, 'activeLives', liveId), {
      latestPing: ping,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err.code !== 'permission-denied') {
      console.error('[Firestore] Failed to publish ping:', err.message);
    }
  }

  safeWindow()?.dispatchEvent(new CustomEvent(CREATED_LIVE_EVENT, { detail: { liveId, latestPing: ping } }));
  return ping;
}
