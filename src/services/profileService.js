import { CURRENT_USER_ID, creatorProfiles, ownCreatorProfile } from '../data/creatorProfiles.js';
import { lives } from '../data/lives.js';
import { mapStreams } from '../data/mapStreams.js';
import { streams, upcomingStreams } from '../data/mockStreams.js';

const STORAGE_KEY = 'vuvio:ownCreatorProfile';
const PROFILE_UPDATED_EVENT = 'vuvio:profile-updated';

// Module-level cache of the current authenticated user's Firebase UID.
// Set by AuthContext on login so resolveCreatorProfile can match live.creatorUid
// even before the user has saved their own profile via EditProfilePage.
let _currentAuthUid = null;
export function setCurrentAuthUid(uid) { _currentAuthUid = uid || null; }
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

export function creatorSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeProfile(profile = {}) {
  const displayName = profile.displayName ?? profile.name ?? ownCreatorProfile.displayName;

  return {
    ...ownCreatorProfile,
    ...profile,
    id: profile.id ?? CURRENT_USER_ID,
    displayName,
    name: displayName,
    avatarUrl: profile.avatarUrl ?? null,
    coverUrl: profile.coverUrl ?? null,
    verified: Boolean(profile.verified ?? profile.isVerified),
    isVerified: Boolean(profile.verified ?? profile.isVerified),
    followersCount: Number(profile.followersCount ?? 0),
    followingCount: Number(profile.followingCount ?? 0),
    liveCount: Number(profile.liveCount ?? 0),
    totalViews: Number(profile.totalViews ?? 0),
    totalLiveHours: Number(profile.totalLiveHours ?? 0),
    currentLive: profile.currentLive ?? null,
    upcomingLives: Array.isArray(profile.upcomingLives) ? profile.upcomingLives : [],
    recentLives: Array.isArray(profile.recentLives) ? profile.recentLives : [],
    equipment: Array.isArray(profile.equipment) ? profile.equipment : [],
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    categories: Array.isArray(profile.categories) ? profile.categories : [],
    websiteUrl: profile.websiteUrl ?? '',
    instagramUrl: profile.instagramUrl ?? '',
    youtubeUrl: profile.youtubeUrl ?? '',
  };
}

const aliasByDisplayName = {
  'Tomas Keller': 'globetrekker',
  'Clara Vives': 'globetrekker',
  'Aarav Khan': 'globetrekker',
  'Maya Brooks': 'streetvibes',
  'Nour El Idrissi': 'globetrekker',
  'Aylin Demir': 'globetrekker',
  'Jonas Weber': 'streetvibes',
  'Sofia Novak': 'globetrekker',
  'Luka Marino': 'blueride',
  'Kai Moana': 'blueride',
  'Noah Perrin': 'arthur-l',
  'Matteo Ricci': 'arthur-l',
  'Lena Hartmann': 'arthur-l',
};

function normalizeOptionalUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeInstagram(value) {
  const trimmed = String(value ?? '').trim().replace(/^@+/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed;
}

function findCreatorSource(creatorId) {
  if (!creatorId) return null;
  const normalizedId = creatorSlug(creatorId);
  const allContent = [...mapStreams, ...streams, ...upcomingStreams, ...lives];

  return allContent.find((item) => {
    const displayName = item.name ?? item.streamer ?? String(item.who ?? '').split(' - ')[0] ?? '';
    return item.creatorId === creatorId
      || item.creatorId === normalizedId
      || creatorSlug(displayName) === normalizedId
      || creatorSlug(item.id) === normalizedId;
  }) ?? null;
}

function profileFromContent(content, creatorId) {
  if (!content) return null;

  const displayName = content.name ?? content.streamer ?? content.creatorName ?? String(content.who ?? '').split(' - ')[0] ?? 'Vuvio creator';
  const id = creatorId ?? aliasByDisplayName[displayName] ?? creatorSlug(displayName);
  const locationParts = String(content.place ?? content.locationLabel ?? '').split(',');
  const city = content.city ?? locationParts[0]?.trim() ?? '';
  const country = content.country ?? locationParts.slice(1).join(',').trim() ?? '';
  const title = content.experienceTitle ?? content.title ?? content.description ?? content.note ?? `Live: ${content.job ?? content.role ?? 'Live'}`;
  const image = content.image ?? content.thumbnailUrl ?? '/assets/icons/icon-192.png';
  const viewers = Number.parseInt(String(content.viewers ?? content.viewerLabel ?? 0).replace(/\D/g, ''), 10) || 0;
  const category = content.subcategory ?? content.category ?? content.job ?? content.role ?? 'Live';
  const isUpcoming = content.status === 'upcoming';
  const location = [city, country].filter(Boolean).join(', ') || content.locationLabel || content.place || '';

  return normalizeProfile({
    id,
    displayName,
    name: displayName,
    avatarUrl: image,
    coverUrl: image,
    profession: content.job ?? content.role ?? 'Vuvio creator',
    city,
    country,
    bio: isUpcoming
      ? content.livePlan ?? content.description ?? `Vuvio creator preparing a scheduled live from ${city || 'the field'}.`
      : `Vuvio creator live from ${city || 'the field'}.`,
    categories: [category].filter(Boolean),
    followersCount: 0,
    followingCount: 0,
    liveCount: content.status === 'live' || content.kind ? 1 : 0,
    totalViews: viewers,
    currentLive: content.status === 'live' || content.kind
      ? {
          id: content.id,
          title,
          thumbnailUrl: image,
          location,
          status: 'live',
          viewers,
        }
      : null,
    upcomingLives: isUpcoming
      ? [
          {
            id: content.id,
            title,
            thumbnailUrl: image,
            location,
            status: 'upcoming',
            scheduledAt: content.day,
            time: content.time,
          },
        ]
      : [],
    recentLives: content.status === 'live' || content.kind
      ? [
          {
            id: `${content.id}-replay`,
            title,
            thumbnailUrl: image,
            location,
            relativeDate: 'Recently',
            duration: content.duration ?? '—',
            views: viewers,
            category,
          },
        ]
      : [],
  });
}

export function normalizeProfileForSave(profile) {
  return normalizeProfile({
    ...profile,
    websiteUrl: normalizeOptionalUrl(profile.websiteUrl),
    youtubeUrl: normalizeOptionalUrl(profile.youtubeUrl),
    instagramUrl: normalizeInstagram(profile.instagramUrl),
  });
}

const EMPTY_PROFILE_BASE = {
  displayName: '',
  name: '',
  avatarUrl: null,
  coverUrl: null,
  profession: '',
  city: '',
  country: '',
  bio: '',
  languages: [],
  categories: [],
  websiteUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  verified: false,
  isVerified: false,
  followersCount: 0,
  followingCount: 0,
  liveCount: 0,
  totalViews: 0,
  totalLiveHours: 0,
  createdAt: '',
  currentLive: null,
  upcomingLives: [],
  recentLives: [],
  equipment: [],
};

export function buildProfileFromFirebaseUser(firebaseUser) {
  const win = safeWindow();
  let saved = {};
  try {
    const stored = win?.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only use stored data if it belongs to this Firebase user
      if (parsed.id === firebaseUser.uid) saved = parsed;
    }
  } catch {}

  return {
    ...EMPTY_PROFILE_BASE,
    ...saved,
    id: firebaseUser.uid,
    displayName: saved.displayName || firebaseUser.displayName || '',
    name: saved.displayName || firebaseUser.displayName || '',
    avatarUrl: saved.avatarUrl || firebaseUser.photoURL || null,
    username: saved.username || '',
  };
}

export function getOwnCreatorProfile() {
  const win = safeWindow();
  if (!win) return normalizeProfile(ownCreatorProfile);

  try {
    const stored = win.localStorage.getItem(STORAGE_KEY);
    if (!stored) return normalizeProfile(ownCreatorProfile);
    return normalizeProfile(JSON.parse(stored));
  } catch {
    return normalizeProfile(ownCreatorProfile);
  }
}

export function getCreatorProfile(creatorId) {
  if (!creatorId) return getOwnCreatorProfile();
  if (creatorId === CURRENT_USER_ID) return getOwnCreatorProfile();
  // Match by real Firebase UID stored in saved own profile
  const own = getOwnCreatorProfile();
  if (own.uid === creatorId || (own.id && own.id !== CURRENT_USER_ID && own.id === creatorId)) return own;

  const normalizedId = creatorSlug(creatorId);
  const publicProfile = creatorProfiles[creatorId]
    ?? creatorProfiles[normalizedId]
    ?? Object.values(creatorProfiles).find((profile) => creatorSlug(profile.username) === normalizedId);

  if (publicProfile) return { ...normalizeProfile(publicProfile), isDemo: true };

  const source = findCreatorSource(creatorId);
  const built = profileFromContent(source, normalizedId);
  return built ? { ...built, isDemo: true } : null;
}

export function resolveCreatorProfile(input = {}) {
  const displayName = input.name ?? input.streamer ?? input.displayName ?? '';
  // creatorUid is the Firebase UID on real live objects — return own profile without isDemo
  const creatorUid = input.creatorUid ?? input.creatorId ?? input.userId;
  if (creatorUid) {
    const own = getOwnCreatorProfile();
    const ownUid = _currentAuthUid || own.uid || (own.id !== CURRENT_USER_ID ? own.id : null);
    if (ownUid && ownUid === creatorUid) return own;
  }

  const candidateId = input.creatorId
    ?? input.userId
    ?? aliasByDisplayName[displayName]
    ?? creatorSlug(displayName);

  const resolved = getCreatorProfile(candidateId);
  if (resolved) return resolved;
  const built = profileFromContent(input, candidateId);
  if (!built) return null;
  // Real Firestore lives have a creatorUid — not demo content
  const isRealCreator = Boolean(input.creatorUid);
  return isRealCreator ? built : { ...built, isDemo: true };
}

export async function saveOwnCreatorProfile(nextProfile) {
  const win = safeWindow();
  let current = {};
  try {
    const stored = win?.localStorage.getItem(STORAGE_KEY);
    if (stored) current = JSON.parse(stored);
  } catch {}
  const merged = { ...EMPTY_PROFILE_BASE, ...current, ...nextProfile, id: nextProfile.id ?? current.id };
  const normalized = {
    ...merged,
    websiteUrl: normalizeOptionalUrl(merged.websiteUrl),
    youtubeUrl: normalizeOptionalUrl(merged.youtubeUrl),
    instagramUrl: normalizeInstagram(merged.instagramUrl),
  };

  if (win) {
    win.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    win.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: normalized }));
  }

  try {
    const { setDoc, doc } = await import('firebase/firestore');
    const { db } = await import('../firebase.js');
    const firestoreUid = normalized.uid || normalized.id;
    if (firestoreUid && firestoreUid !== CURRENT_USER_ID) {
      const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');
      // Only send user-editable fields — never send stats (followingCount, liveCount, etc.)
      // because Firestore rules forbid changing those fields client-side
      const firestoreData = {
        uid: firestoreUid,
        id: firestoreUid,
        displayName: normalized.displayName ?? '',
        name: normalized.displayName ?? '',
        bio: normalized.bio ?? '',
        profession: normalized.profession ?? '',
        city: normalized.city ?? '',
        country: normalized.country ?? '',
        username: normalized.username ?? '',
        languages: normalized.languages ?? [],
        categories: normalized.categories ?? [],
        websiteUrl: normalized.websiteUrl ?? '',
        instagramUrl: normalized.instagramUrl ?? '',
        youtubeUrl: normalized.youtubeUrl ?? '',
        playlists: normalized.playlists ?? [],
        avatarUrl: isDataUrl(normalized.avatarUrl) ? null : (normalized.avatarUrl ?? null),
        coverUrl: isDataUrl(normalized.coverUrl) ? null : (normalized.coverUrl ?? null),
      };
      await setDoc(doc(db, 'users', firestoreUid), firestoreData, { merge: true });
    }
  } catch (err) {
    console.error('[profileService] Failed to save profile to Firestore:', err.message);
  }

  return Promise.resolve(normalized);
}

export function subscribeToOwnProfile(callback) {
  const win = safeWindow();
  if (!win) return () => {};

  const listener = (event) => callback(event.detail ?? getOwnCreatorProfile());
  win.addEventListener(PROFILE_UPDATED_EVENT, listener);

  return () => win.removeEventListener(PROFILE_UPDATED_EVENT, listener);
}

export function validateImageFile(file) {
  if (!file) return 'No image selected.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported format. Choose a JPEG, PNG or WebP image.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'This image is too large. Choose an image under 5 MB.';
  }
  return '';
}

export function readImageFile(file) {
  const error = validateImageFile(file);
  if (error) return Promise.reject(new Error(error));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
}
