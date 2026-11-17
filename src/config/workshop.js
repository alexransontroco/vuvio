/**
 * Workshop / Join Activity feature configuration.
 *
 * SIMULATION NOTICE
 * -----------------
 * Everything under the workshop feature is behind a feature flag and uses
 * MOCK data + MOCK video (no real multi-point video). See README banner in
 * workshopService.mock.js. No Firestore writes in this step.
 */

const rawFlag = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKSHOP_ENABLED
  : undefined;

// Dev-time override via localStorage (`vuvio_workshop_flag` = '1' or '0').
function localStorageOverride() {
  try {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage?.getItem('vuvio_workshop_flag');
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

const envEnabled = rawFlag === '1' || rawFlag === 'true';

/**
 * Hard-OFF by default in production, but ALWAYS ON in dev / on the /workshop-demo
 * route so the user can test without touching env. Production stays unchanged.
 */
export function isWorkshopEnabled() {
  const override = localStorageOverride();
  if (override !== null) return override;
  if (envEnabled) return true;
  if (typeof window === 'undefined') return false;
  // Enable on dev + preview + demo route so Alex can test locally.
  const host = window.location.hostname;
  const path = window.location.pathname || '';
  const isDev = host === 'localhost' || host === '127.0.0.1';
  const isDemo = path.startsWith('/workshop-demo');
  return isDev || isDemo;
}

export const PARTICIPATION_MODES = /** @type {const} */ (['off', 'join', 'workshop']);

export const PARTICIPATION_LABELS = {
  off: 'Watch only',
  join: 'Join allowed',
  workshop: 'Workshop',
};

export const PARTICIPATION_DESCRIPTIONS = {
  off: 'Viewers watch only. No participation.',
  join: 'Viewers can ask to join and practice with you.',
  workshop: 'Guided activity with participants you can mentor and spotlight.',
};

export const AUDIENCE_MODES = /** @type {const} */ (['everyone', 'followers']);

export const AUDIENCE_LABELS = {
  everyone: 'Everyone',
  followers: 'Followers',
};

export const DEFAULT_PARTICIPATION_CONFIG = {
  mode: 'off',
  maxParticipants: 6,
  audience: 'everyone',
  activityTitle: '',
};

export const PARTICIPATION_LIMITS = {
  minParticipants: 1,
  maxParticipants: 12,
};

export const WORKSHOP_STORAGE_KEYS = {
  consent: 'vuvio_workshop_consent',
  demoRole: 'vuvio_workshop_demo_role',
};
