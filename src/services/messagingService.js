import {
  CURRENT_MESSAGE_USER_ID,
  defaultMessagePreferences,
  messageProfiles,
  mockConversations,
  mockMessageLives,
} from '../data/mockMessages.js';

const CONVERSATIONS_KEY = 'vuvio:messages:conversations';
const PREFERENCES_KEY = 'vuvio:messages:preferences';
const EVENT_NAME = 'vuvio:messages-updated';

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function emitChange() {
  safeWindow()?.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readConversations() {
  const win = safeWindow();
  if (!win) return clone(mockConversations);

  try {
    const stored = JSON.parse(win.localStorage.getItem(CONVERSATIONS_KEY) ?? 'null');
    return Array.isArray(stored) ? stored : clone(mockConversations);
  } catch {
    return clone(mockConversations);
  }
}

function writeConversations(conversations) {
  safeWindow()?.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  emitChange();
}

function readPreferences() {
  const win = safeWindow();
  if (!win) return { ...defaultMessagePreferences };

  try {
    return {
      ...defaultMessagePreferences,
      ...JSON.parse(win.localStorage.getItem(PREFERENCES_KEY) ?? '{}'),
    };
  } catch {
    return { ...defaultMessagePreferences };
  }
}

function writePreferences(preferences) {
  safeWindow()?.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  emitChange();
}

export function getOtherParticipant(conversation) {
  if (conversation.system) {
    return {
      id: 'vuvio-team',
      name: 'Vuvio Team',
      username: 'vuvio',
      avatar: '/assets/icons/icon-192.png',
      online: true,
    };
  }

  const participantId = conversation.participantIds.find((id) => id !== CURRENT_MESSAGE_USER_ID);
  return messageProfiles[participantId] ?? {
    id: 'unavailable',
    name: 'Unavailable user',
    username: 'unavailable',
    avatar: '/assets/icons/icon-192.png',
    online: false,
  };
}

export function getConversations() {
  return readConversations().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(conversationId) {
  return readConversations().find((conversation) => conversation.id === conversationId) ?? null;
}

export function getUnreadConversationCount() {
  return readConversations().filter((conversation) => !conversation.request && conversation.unreadCount > 0).length;
}

export function getMessageLive(liveId) {
  return mockMessageLives[liveId] ?? null;
}

export function searchConversations(query, filter = 'all') {
  const normalizedQuery = query.trim().toLowerCase();

  return getConversations().filter((conversation) => {
    if (filter === 'unread' && conversation.unreadCount <= 0) return false;
    if (filter === 'requests' && !conversation.request) return false;
    if (filter === 'creators') {
      if (conversation.request) return false;
      const p = getOtherParticipant(conversation);
      if (!p.profession || p.profession === 'Community') return false;
    } else if (filter !== 'requests' && conversation.request) return false;
    if (!normalizedQuery) return true;

    const participant = getOtherParticipant(conversation);
    const lastMessage = conversation.messages.at(-1);
    const live = conversation.relatedLiveId ? getMessageLive(conversation.relatedLiveId) : null;
    const haystack = `${participant.name} ${participant.username} ${lastMessage?.text ?? ''} ${live?.title ?? ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function markConversationAsRead(conversationId) {
  const conversations = readConversations();
  const next = conversations.map((conversation) => (
    conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
  ));
  writeConversations(next);
}

export function sendMessage(conversationId, text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const conversations = readConversations();
  const now = Date.now();
  let createdMessage = null;
  const next = conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    if (conversation.blocked) return conversation;

    createdMessage = {
      id: `local-${now}`,
      senderId: CURRENT_MESSAGE_USER_ID,
      type: 'text',
      text: trimmed,
      createdAt: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      day: 'Today',
    };

    return {
      ...conversation,
      request: false,
      requestStatus: 'accepted',
      lastMessageAt: 'now',
      updatedAt: now,
      messages: [...conversation.messages, createdMessage],
    };
  });

  writeConversations(next);
  return createdMessage;
}

export function getOrCreateConversation(participantId, context = {}) {
  const conversations = readConversations();
  const existing = conversations.find((conversation) => (
    conversation.participantIds.includes(CURRENT_MESSAGE_USER_ID) && conversation.participantIds.includes(participantId)
  ));

  if (existing) return existing;

  const now = Date.now();
  const conversation = {
    id: participantId,
    participantIds: [CURRENT_MESSAGE_USER_ID, participantId],
    relatedLiveId: context.liveId ?? null,
    request: false,
    muted: false,
    blocked: false,
    lastMessageAt: 'now',
    updatedAt: now,
    unreadCount: 0,
    messages: context.prefill
      ? [{
          id: `draft-${now}`,
          senderId: CURRENT_MESSAGE_USER_ID,
          type: 'system',
          text: context.prefill,
          createdAt: 'draft',
          status: 'draft',
          day: 'Today',
        }]
      : [],
  };

  writeConversations([conversation, ...conversations]);
  return conversation;
}

export function acceptMessageRequest(conversationId) {
  const next = readConversations().map((conversation) => (
    conversation.id === conversationId
      ? { ...conversation, request: false, requestStatus: 'accepted', unreadCount: 0 }
      : conversation
  ));
  writeConversations(next);
}

export function ignoreMessageRequest(conversationId) {
  const next = readConversations().filter((conversation) => conversation.id !== conversationId);
  writeConversations(next);
}

export function blockUser(conversationId) {
  const next = readConversations().map((conversation) => (
    conversation.id === conversationId ? { ...conversation, blocked: true } : conversation
  ));
  writeConversations(next);
}

export function unblockUser(conversationId) {
  const next = readConversations().map((conversation) => (
    conversation.id === conversationId ? { ...conversation, blocked: false } : conversation
  ));
  writeConversations(next);
}

export function reportUser(conversationId, reason = 'Other') {
  const next = readConversations().map((conversation) => (
    conversation.id === conversationId ? { ...conversation, reportedReason: reason } : conversation
  ));
  writeConversations(next);
}

export function deleteConversation(conversationId) {
  writeConversations(readConversations().filter((conversation) => conversation.id !== conversationId));
}

export function getMessagePreferences() {
  return readPreferences();
}

export function updateMessagePreferences(nextPreferences) {
  const preferences = { ...readPreferences(), ...nextPreferences };
  writePreferences(preferences);
  return preferences;
}

export function subscribeToMessaging(callback) {
  const win = safeWindow();
  if (!win) return () => {};

  const listener = () => callback();
  win.addEventListener(EVENT_NAME, listener);
  return () => win.removeEventListener(EVENT_NAME, listener);
}

export function subscribeToConversations(_uid, callback) {
  const win = safeWindow();
  if (!win) { callback([]); return () => {}; }

  callback(readConversations().sort((a, b) => b.updatedAt - a.updatedAt));
  const listener = () => callback(readConversations().sort((a, b) => b.updatedAt - a.updatedAt));
  win.addEventListener(EVENT_NAME, listener);
  return () => win.removeEventListener(EVENT_NAME, listener);
}
