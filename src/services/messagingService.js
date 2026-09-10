import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  defaultMessagePreferences,
  messageProfiles,
  mockConversations,
  mockMessageLives,
} from '../data/mockMessages.js';

const PREFERENCES_KEY = 'vuvio:messages:preferences';
const EVENT_NAME = 'vuvio:messages-updated';

// ── In-memory state ───────────────────────────────────────────────
let currentUid = null;
let convMap = new Map();   // conversationId → conversation object (with messages[])
let msgMap = new Map();    // conversationId → message[]
let profileMap = new Map(); // uid → profile object
let listenerUnsub = null;
let msgListenerMap = new Map(); // conversationId → unsubscribe fn

// ── Utilities ─────────────────────────────────────────────────────
function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

function formatTs(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMsgTime(ts) {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts) {
  if (!ts) return 'Today';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return 'Today';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Profile fetching ──────────────────────────────────────────────
async function fetchProfile(uid) {
  if (profileMap.has(uid)) return profileMap.get(uid);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : null;
    const profile = data
      ? {
          id: uid,
          name: data.displayName || data.name || 'Unknown',
          username: data.username || data.usernameNormalized || uid.slice(0, 8),
          avatar: data.photoURL || data.avatar || '/assets/icons/icon-192.png',
          online: false,
          profession: data.profession || null,
          location: data.location || null,
          liveStatus: null,
          liveStatusText: null,
          suggestedQuestions: null,
        }
      : null;
    profileMap.set(uid, profile);
    return profile;
  } catch {
    profileMap.set(uid, null);
    return null;
  }
}

// ── Data building ─────────────────────────────────────────────────
function buildConv(data, id) {
  return {
    id,
    participantIds: data.participantIds ?? [],
    relatedLiveId: data.relatedLiveId ?? null,
    contextNote: data.contextNote ?? null,
    request: data.request ?? false,
    requestType: data.requestType ?? null,
    requestStatus: data.requestStatus ?? null,
    muted: data.muted ?? false,
    blocked: data.blocked ?? false,
    blockedBy: data.blockedBy ?? null,
    previewText: data.lastMessage ?? '',
    lastMessageAt: formatTs(data.updatedAt),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
    unreadCount: currentUid ? (data.unread?.[currentUid] ?? 0) : 0,
    messages: msgMap.get(id) ?? [],
  };
}

function buildMsg(data, id) {
  return {
    id,
    senderId: data.senderId,
    type: data.type ?? 'text',
    text: data.text ?? '',
    liveId: data.liveId ?? null,
    createdAt: formatMsgTime(data.createdAt),
    status: data.status ?? 'sent',
    day: formatDay(data.createdAt),
  };
}

// ── Init ─────────────────────────────────────────────────────────
export function initMessaging(uid) {
  if (uid === currentUid) return;

  listenerUnsub?.();
  listenerUnsub = null;
  msgListenerMap.forEach((unsub) => unsub());
  msgListenerMap.clear();
  msgMap.clear();

  currentUid = uid;

  if (!uid) {
    convMap.clear();
    mockConversations.forEach((c) => convMap.set(c.id, c));
    Object.entries(messageProfiles).forEach(([k, v]) => profileMap.set(k, v));
    emitChange();
    return;
  }

  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  );

  listenerUnsub = onSnapshot(q, async (snap) => {
    const unknownUids = new Set();
    snap.docs.forEach((d) => {
      (d.data().participantIds ?? []).forEach((pid) => {
        if (pid !== uid && !profileMap.has(pid)) unknownUids.add(pid);
      });
    });
    if (unknownUids.size > 0) {
      await Promise.all([...unknownUids].map(fetchProfile));
    }

    const incoming = new Set(snap.docs.map((d) => d.id));
    snap.docs.forEach((d) => convMap.set(d.id, buildConv(d.data(), d.id)));
    [...convMap.keys()].forEach((id) => { if (!incoming.has(id)) convMap.delete(id); });

    emitChange();
  }, (err) => {
    console.warn('[messaging] conversations listener error:', err.message);
  });
}

// Subscribe to messages for a specific conversation (called by ConversationPage)
export function subscribeToConversationMessages(conversationId) {
  if (!currentUid) return () => {};
  if (msgListenerMap.has(conversationId)) return () => {};

  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  );

  const unsub = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => buildMsg(d.data(), d.id));
    msgMap.set(conversationId, msgs);
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, messages: msgs });
    emitChange();
  }, (err) => {
    console.warn('[messaging] messages listener error:', err.message);
  });

  msgListenerMap.set(conversationId, unsub);
  return () => {
    unsub();
    msgListenerMap.delete(conversationId);
  };
}

// ── Public read API ───────────────────────────────────────────────
export function getOtherParticipant(conversation) {
  if (!currentUid) {
    const pid = conversation.participantIds?.find((id) => id !== 'current-user');
    return messageProfiles[pid] ?? { id: 'unknown', name: 'Unknown', username: 'unknown', avatar: '/assets/icons/icon-192.png' };
  }

  if (conversation.system) {
    return { id: 'vuvio-team', name: 'Vuvio Team', username: 'vuvio', avatar: '/assets/icons/icon-192.png', online: true };
  }

  const pid = conversation.participantIds?.find((id) => id !== currentUid);
  if (!pid) return { id: 'unknown', name: 'Unknown', username: 'unknown', avatar: '/assets/icons/icon-192.png' };
  return profileMap.get(pid) ?? { id: pid, name: 'Loading…', username: '', avatar: '/assets/icons/icon-192.png' };
}

export function getConversations() {
  return [...convMap.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(conversationId) {
  return convMap.get(conversationId) ?? null;
}

export function getUnreadConversationCount() {
  return [...convMap.values()].filter((c) => !c.request && c.unreadCount > 0).length;
}

export function getMessageLive(liveId) {
  return mockMessageLives[liveId] ?? null;
}

export function searchConversations(searchQuery, filter = 'all') {
  const normalized = searchQuery.trim().toLowerCase();
  return getConversations().filter((conv) => {
    if (filter === 'unread' && conv.unreadCount <= 0) return false;
    if (filter === 'requests' && !conv.request) return false;
    if (filter === 'creators') {
      if (conv.request) return false;
      const p = getOtherParticipant(conv);
      if (!p.profession || p.profession === 'Community') return false;
    } else if (filter !== 'requests' && conv.request) return false;
    if (!normalized) return true;
    const p = getOtherParticipant(conv);
    const haystack = `${p.name} ${p.username} ${conv.previewText}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

// ── Write API ─────────────────────────────────────────────────────
export async function markConversationAsRead(conversationId) {
  if (!currentUid) {
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, unreadCount: 0 });
    emitChange();
    return;
  }
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`unread.${currentUid}`]: 0,
    });
  } catch (err) {
    console.warn('[messaging] markAsRead failed:', err.message);
  }
}

export async function sendMessage(conversationId, text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (!currentUid) {
    const now = Date.now();
    const msg = {
      id: `local-${now}`,
      senderId: 'current-user',
      type: 'text',
      text: trimmed,
      createdAt: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      day: 'Today',
    };
    const conv = convMap.get(conversationId);
    if (conv) {
      convMap.set(conversationId, {
        ...conv,
        messages: [...conv.messages, msg],
        previewText: trimmed,
        lastMessageAt: 'now',
        updatedAt: now,
        request: false,
      });
    }
    emitChange();
    return msg;
  }

  const conv = convMap.get(conversationId);
  const otherUid = conv?.participantIds?.find((id) => id !== currentUid);
  const now = Date.now();

  // Optimistic update
  const optimisticMsg = {
    id: `pending-${now}`,
    senderId: currentUid,
    type: 'text',
    text: trimmed,
    createdAt: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    status: 'sent',
    day: 'Today',
  };
  if (conv) {
    convMap.set(conversationId, {
      ...conv,
      messages: [...conv.messages, optimisticMsg],
      previewText: trimmed,
      lastMessageAt: 'now',
      updatedAt: now,
    });
    emitChange();
  }

  try {
    await Promise.all([
      addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        senderId: currentUid,
        text: trimmed,
        type: 'text',
        createdAt: serverTimestamp(),
        status: 'sent',
      }),
      updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: trimmed,
        updatedAt: serverTimestamp(),
        request: false,
        ...(otherUid ? { [`unread.${otherUid}`]: increment(1) } : {}),
      }),
    ]);
  } catch (err) {
    console.error('[messaging] sendMessage failed:', err.message);
  }
  return optimisticMsg;
}

export async function getOrCreateConversation(participantId, context = {}) {
  if (!currentUid) {
    const existing = [...convMap.values()].find(
      (c) => c.participantIds.includes('current-user') && c.participantIds.includes(participantId),
    );
    if (existing) return existing;
    const now = Date.now();
    const conv = {
      id: participantId,
      participantIds: ['current-user', participantId],
      relatedLiveId: context.liveId ?? null,
      contextNote: null,
      request: false, muted: false, blocked: false,
      lastMessageAt: 'now', updatedAt: now, unreadCount: 0,
      messages: [], previewText: '',
    };
    convMap.set(conv.id, conv);
    emitChange();
    return conv;
  }

  const existing = [...convMap.values()].find(
    (c) => c.participantIds.includes(currentUid) && c.participantIds.includes(participantId),
  );
  if (existing) return existing;

  const convId = [currentUid, participantId].sort().join('_');
  const convRef = doc(db, 'conversations', convId);
  const snap = await getDoc(convRef);

  if (snap.exists()) {
    const conv = buildConv(snap.data(), convId);
    convMap.set(convId, conv);
    emitChange();
    return conv;
  }

  const data = {
    participantIds: [currentUid, participantId],
    participants: { [currentUid]: true, [participantId]: true },
    lastMessage: '',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    relatedLiveId: context.liveId ?? null,
    contextNote: null,
    request: false,
    muted: false,
    blocked: false,
    unread: { [currentUid]: 0, [participantId]: 0 },
  };
  await setDoc(convRef, data);

  const conv = {
    id: convId,
    participantIds: [currentUid, participantId],
    relatedLiveId: context.liveId ?? null,
    contextNote: null,
    request: false, muted: false, blocked: false,
    lastMessageAt: 'now', updatedAt: Date.now(), unreadCount: 0,
    messages: [], previewText: '',
  };
  convMap.set(convId, conv);
  emitChange();
  return conv;
}

export async function toggleMute(conversationId) {
  const conv = convMap.get(conversationId);
  const nextMuted = !(conv?.muted ?? false);
  if (currentUid) {
    try {
      await updateDoc(doc(db, 'conversations', conversationId), { muted: nextMuted });
    } catch (err) {
      console.warn('[messaging] toggleMute failed:', err.message);
    }
  } else {
    if (conv) convMap.set(conversationId, { ...conv, muted: nextMuted });
    emitChange();
  }
}

export async function acceptMessageRequest(conversationId) {
  const update = { request: false, requestStatus: 'accepted' };
  if (currentUid) {
    await updateDoc(doc(db, 'conversations', conversationId), {
      ...update,
      [`unread.${currentUid}`]: 0,
    });
  } else {
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, ...update, unreadCount: 0 });
    emitChange();
  }
}

export async function ignoreMessageRequest(conversationId) {
  convMap.delete(conversationId);
  if (currentUid) {
    await deleteDoc(doc(db, 'conversations', conversationId));
  }
  emitChange();
}

export async function blockUser(conversationId) {
  const update = { blocked: true, blockedBy: currentUid ?? 'current-user' };
  if (currentUid) {
    await updateDoc(doc(db, 'conversations', conversationId), update);
  } else {
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, ...update });
    emitChange();
  }
}

export async function unblockUser(conversationId) {
  const update = { blocked: false, blockedBy: null };
  if (currentUid) {
    await updateDoc(doc(db, 'conversations', conversationId), update);
  } else {
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, ...update });
    emitChange();
  }
}

export async function reportUser(conversationId, reason = 'Other') {
  if (currentUid) {
    await updateDoc(doc(db, 'conversations', conversationId), { reportedReason: reason });
  } else {
    const conv = convMap.get(conversationId);
    if (conv) convMap.set(conversationId, { ...conv, reportedReason: reason });
    emitChange();
  }
}

export async function deleteConversation(conversationId) {
  convMap.delete(conversationId);
  if (currentUid) {
    await deleteDoc(doc(db, 'conversations', conversationId));
  }
  emitChange();
}

// ── User search ───────────────────────────────────────────────────
export async function searchUsers(searchQuery) {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return [];

  if (!currentUid) {
    return Object.values(Object.fromEntries(profileMap))
      .filter((p) => p && p.id !== 'current-user' && (
        p.name?.toLowerCase().includes(normalized) ||
        p.username?.toLowerCase().includes(normalized)
      ))
      .slice(0, 8);
  }

  try {
    const [byUsername, byDisplay] = await Promise.all([
      getDocs(query(
        collection(db, 'users'),
        where('usernameNormalized', '>=', normalized),
        where('usernameNormalized', '<=', normalized + '\uf8ff'),
        limit(8),
      )),
      getDocs(query(
        collection(db, 'users'),
        where('displayNameNormalized', '>=', normalized),
        where('displayNameNormalized', '<=', normalized + '\uf8ff'),
        limit(8),
      )),
    ]);

    const seen = new Set();
    const results = [];
    [...byUsername.docs, ...byDisplay.docs].forEach((d) => {
      if (d.id === currentUid || seen.has(d.id)) return;
      seen.add(d.id);
      const data = d.data();
      results.push({
        id: d.id,
        name: data.displayName || 'Unknown',
        username: data.username || d.id.slice(0, 8),
        avatar: data.photoURL || '/assets/icons/icon-192.png',
        profession: data.profession || null,
      });
    });
    return results.slice(0, 8);
  } catch (err) {
    console.warn('[messaging] searchUsers failed:', err.message);
    return [];
  }
}

// ── Preferences ───────────────────────────────────────────────────
export function getMessagePreferences() {
  try {
    return { ...defaultMessagePreferences, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') };
  } catch {
    return { ...defaultMessagePreferences };
  }
}

export function updateMessagePreferences(next) {
  const prefs = { ...getMessagePreferences(), ...next };
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  emitChange();
  return prefs;
}

// ── Subscriptions ─────────────────────────────────────────────────
export function subscribeToMessaging(callback) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => callback();
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function subscribeToConversations(uid, callback) {
  if (typeof window === 'undefined') { callback([]); return () => {}; }
  callback(getConversations());
  const listener = () => callback(getConversations());
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
