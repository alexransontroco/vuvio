import { useEffect, useState } from 'react';
import {
  getFriendsWatchingLive,
  getUserActivityVisibility,
  setUserActivityVisibility,
  startWatchingLive,
  stopWatchingLive,
  simulateFriendJoin,
  simulateFriendLeave,
  getFriendsNotWatching,
  inviteFriendToLive,
  getAllFriends,
  formatTimeSinceJoined,
} from '../services/livePresenceService.js';

/**
 * Hook to get friends currently watching a live
 * Refetches presence data periodically
 */
export function useFriendsWatching(liveId, enabled = true) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !liveId) {
      setFriends([]);
      return;
    }

    const fetchFriends = () => {
      setLoading(true);
      // Simulate network delay
      setTimeout(() => {
        const data = getFriendsWatchingLive(liveId);
        setFriends(data);
        setLoading(false);
      }, 100);
    };

    fetchFriends();

    // Poll for presence updates every 2 seconds
    const interval = setInterval(fetchFriends, 2000);
    return () => clearInterval(interval);
  }, [liveId, enabled]);

  return { friends, loading, count: friends.length };
}

/**
 * Hook to manage current user's viewing activity
 */
export function useCurrentUserActivity(liveId) {
  const [visibility, setVisibility] = useState(() => getUserActivityVisibility());

  useEffect(() => {
    if (!liveId) return;
    startWatchingLive(liveId);
    return () => stopWatchingLive(liveId);
  }, [liveId]);

  const updateVisibility = (newVisibility) => {
    setUserActivityVisibility(newVisibility);
    setVisibility(newVisibility);
  };

  return {
    visibility,
    setVisibility: updateVisibility,
    isActive: liveId !== null,
  };
}

/**
 * Hook to manage friend invitations
 */
export function useInviteFriends(liveId, liveTitle) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);
  const [invitedIds, setInvitedIds] = useState(new Set());

  useEffect(() => {
    if (!liveId) return;

    const loadFriends = () => {
      setLoading(true);
      setTimeout(() => {
        const data = getFriendsNotWatching(liveId);
        setFriends(data);
        setLoading(false);
      }, 100);
    };

    loadFriends();
  }, [liveId]);

  const toggleFriend = (friendId) => {
    const next = new Set(selected);
    if (next.has(friendId)) {
      next.delete(friendId);
    } else {
      next.add(friendId);
    }
    setSelected(next);
  };

  const sendInvites = async () => {
    try {
      setError(null);
      for (const friendId of selected) {
        inviteFriendToLive(friendId, liveId, liveTitle);
      }
      setInvitedIds(new Set([...invitedIds, ...selected]));
      // Clear selection after a moment
      setTimeout(() => {
        setSelected(new Set());
      }, 800);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  return {
    friends,
    loading,
    selected,
    toggleFriend,
    sendInvites,
    error,
    invitedIds,
  };
}

/**
 * Hook to simulate friend arrival notifications (for demo)
 */
export function useFriendArrivals(liveId) {
  const [arrivals, setArrivals] = useState([]);

  const simulateArrival = (friendId) => {
    const id = `${friendId}-${Date.now()}`;
    setArrivals((prev) => [...prev, { id, friendId }]);

    // Remove after 3 seconds
    setTimeout(() => {
      setArrivals((prev) => prev.filter((a) => a.id !== id));
    }, 3000);
  };

  return { arrivals, simulateArrival };
}

export { formatTimeSinceJoined };
