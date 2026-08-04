const FOLLOWING_KEY = 'vuvio:following-creators';
const FOLLOW_EVENT = 'vuvio:following-updated';

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function readFollowing() {
  const win = safeWindow();
  if (!win) return [];

  try {
    const parsed = JSON.parse(win.localStorage.getItem(FOLLOWING_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFollowing(ids) {
  const win = safeWindow();
  if (!win) return;
  win.localStorage.setItem(FOLLOWING_KEY, JSON.stringify(ids));
  win.dispatchEvent(new CustomEvent(FOLLOW_EVENT, { detail: ids }));
}

export function isFollowingCreator(creatorId) {
  if (!creatorId) return false;
  return readFollowing().includes(creatorId);
}

export async function setFollowingCreator(creatorId, following) {
  if (!creatorId) throw new Error('Creator not found.');

  const current = readFollowing();
  const next = following
    ? Array.from(new Set([...current, creatorId]))
    : current.filter((id) => id !== creatorId);

  writeFollowing(next);
  return following;
}

export function subscribeToFollowing(callback) {
  const win = safeWindow();
  if (!win) return () => {};

  const listener = (event) => callback(event.detail ?? readFollowing());
  win.addEventListener(FOLLOW_EVENT, listener);
  return () => win.removeEventListener(FOLLOW_EVENT, listener);
}
