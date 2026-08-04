/**
 * Live Presence Service
 * Manages viewing activity visibility and friend presence tracking.
 * Currently uses mock data; ready to connect to real-time backend.
 */

const STALE_TIMEOUT_MS = 30000; // 30 seconds for presence to expire
const HEARTBEAT_INTERVAL_MS = 5000; // Update presence every 5 seconds

// Mock presence data: liveId -> { userId, joinedAt, visibility, etc. }
let mockLivePresence = {};

// Mock current user activity
let mockCurrentUserActivity = {
  userId: 'current-user-123',
  liveId: null,
  visibility: 'friends', // 'friends' or 'nobody'
  isActive: false,
};

// Mock user friends data
const mockFriends = [
  { id: 'user-cecilia', name: 'Cecilia', username: 'cecilia', avatar: '👩' },
  { id: 'user-lucas', name: 'Lucas', username: 'lucas', avatar: '👨' },
  { id: 'user-maya', name: 'Maya', username: 'maya', avatar: '👨‍🦱' },
  { id: 'user-noah', name: 'Noah', username: 'noah', avatar: '👨‍🦲' },
  { id: 'user-emma', name: 'Emma', username: 'emma', avatar: '👩‍🦰' },
  { id: 'user-liam', name: 'Liam', username: 'liam', avatar: '👨‍🦱' },
];

/**
 * Get friends currently watching a specific live
 * @param {string} liveId
 * @returns {Array} Array of friend objects with presence info
 */
export function getFriendsWatchingLive(liveId) {
  if (!mockLivePresence[liveId]) return [];

  return Object.values(mockLivePresence[liveId])
    .filter((presence) => {
      // Check if presence is still active (not stale)
      const ageMs = Date.now() - new Date(presence.lastSeenAt).getTime();
      return ageMs < STALE_TIMEOUT_MS && presence.visibility === 'friends';
    })
    .map((presence) => {
      const friend = mockFriends.find((f) => f.id === presence.userId);
      return {
        ...friend,
        userId: presence.userId,
        joinedAt: presence.joinedAt,
        lastSeenAt: presence.lastSeenAt,
        status: 'watching',
      };
    })
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}

/**
 * Get current user's viewing activity visibility setting
 * @returns {string} 'friends' or 'nobody'
 */
export function getUserActivityVisibility() {
  return mockCurrentUserActivity.visibility;
}

/**
 * Set whether current user's viewing activity is visible
 * @param {string} visibility - 'friends' or 'nobody'
 */
export function setUserActivityVisibility(visibility) {
  if (!['friends', 'nobody'].includes(visibility)) {
    throw new Error('Invalid visibility setting');
  }
  mockCurrentUserActivity.visibility = visibility;
  // In real app: persist to Firebase
}

/**
 * Mark user as watching a live (for current user)
 * @param {string} liveId
 */
export function startWatchingLive(liveId) {
  mockCurrentUserActivity.liveId = liveId;
  mockCurrentUserActivity.isActive = true;

  // Simulate other users also watching
  if (!mockLivePresence[liveId]) {
    mockLivePresence[liveId] = {};
  }

  // Add some mock friends watching
  const watching = ['user-cecilia', 'user-lucas', 'user-maya'];
  const baseTime = Date.now() - 60000; // Some joined 1 min ago

  watching.forEach((userId, index) => {
    mockLivePresence[liveId][userId] = {
      userId,
      liveId,
      joinedAt: new Date(baseTime + index * 30000).toISOString(),
      lastSeenAt: new Date().toISOString(),
      visibility: 'friends',
    };
  });
}

/**
 * Mark user as no longer watching a live
 * @param {string} liveId
 */
export function stopWatchingLive(liveId) {
  if (mockCurrentUserActivity.liveId === liveId) {
    mockCurrentUserActivity.liveId = null;
    mockCurrentUserActivity.isActive = false;
  }
}

/**
 * Simulate a friend joining a live
 * @param {string} liveId
 * @param {string} friendId
 */
export function simulateFriendJoin(liveId, friendId) {
  if (!mockLivePresence[liveId]) {
    mockLivePresence[liveId] = {};
  }

  mockLivePresence[liveId][friendId] = {
    userId: friendId,
    liveId,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    visibility: 'friends',
  };
}

/**
 * Simulate a friend leaving a live
 * @param {string} liveId
 * @param {string} friendId
 */
export function simulateFriendLeave(liveId, friendId) {
  if (mockLivePresence[liveId]) {
    delete mockLivePresence[liveId][friendId];
  }
}

/**
 * Get all friends (for invite interface)
 * @returns {Array} Array of friend objects
 */
export function getAllFriends() {
  return [...mockFriends];
}

/**
 * Get friends not currently watching
 * @param {string} liveId
 * @returns {Array} Array of friend objects
 */
export function getFriendsNotWatching(liveId) {
  const watching = getFriendsWatchingLive(liveId).map((f) => f.userId);
  return mockFriends.filter((f) => !watching.includes(f.id));
}

/**
 * Invite friend to current live
 * @param {string} friendId
 * @param {string} liveId
 * @param {string} liveTitle
 */
export function inviteFriendToLive(friendId, liveId, liveTitle) {
  // In real app: send notification to friend
  console.log(`Invited ${friendId} to ${liveTitle}`);
}

/**
 * Format time since joined
 * @param {string} joinedAt - ISO timestamp
 * @returns {string} Human-readable time string
 */
export function formatTimeSinceJoined(joinedAt) {
  const now = new Date();
  const joined = new Date(joinedAt);
  const diffMs = now.getTime() - joined.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds < 30) return 'Just joined';
  if (diffMinutes === 0) return 'A few seconds ago';
  if (diffMinutes === 1) return 'Joined 1 min ago';
  if (diffMinutes < 60) return `Joined ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return 'Joined 1 hour ago';
  return `Joined ${diffHours} hours ago`;
}
