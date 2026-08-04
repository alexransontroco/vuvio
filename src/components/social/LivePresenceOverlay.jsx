import { useState } from 'react';
import { Users } from 'lucide-react';
import { FriendsWatchingPill } from './FriendsWatchingPill.jsx';
import { FriendsWatchingSheet } from './FriendsWatchingSheet.jsx';
import { InviteFriendsSheet } from './InviteFriendsSheet.jsx';
import { FriendJoinedToast } from './FriendJoinedToast.jsx';
import { useFriendsWatching, useInviteFriends, useFriendArrivals } from '../../hooks/useLivePresence.js';

/**
 * Complete social presence overlay for the live viewer
 * Includes:
 * - Friends watching pill
 * - Friends watching sheet
 * - Invite friends interface
 * - Friend arrival notifications
 */
export function LivePresenceOverlay({ liveId, liveTitle, onJoinFriend }) {
  const [showFriendsSheet, setShowFriendsSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  const { friends, count } = useFriendsWatching(liveId, !showFriendsSheet && !showInviteSheet);
  const { friends: invitableFriends, selected, toggleFriend, sendInvites, invitedIds } = useInviteFriends(liveId, liveTitle);
  const { arrivals } = useFriendArrivals(liveId);

  const handleInviteClick = () => {
    setShowFriendsSheet(false);
    setShowInviteSheet(true);
  };

  const handleSendInvites = async () => {
    await sendInvites();
  };

  return (
    <>
      {/* Friends watching pill */}
      {count > 0 && (
        <FriendsWatchingPill
          friends={friends}
          count={count}
          onClick={() => {
            setShowInviteSheet(false);
            setShowFriendsSheet(true);
          }}
          className="live-presence-pill"
        />
      )}

      {/* Friends watching sheet */}
      {showFriendsSheet && (
        <FriendsWatchingSheet
          friends={friends}
          onClose={() => setShowFriendsSheet(false)}
          onViewProfile={(friendId) => {
            setShowFriendsSheet(false);
            // Could navigate to profile here
          }}
          onInvite={handleInviteClick}
        />
      )}

      {/* Invite friends sheet */}
      {showInviteSheet && (
        <InviteFriendsSheet
          friends={invitableFriends}
          selected={selected}
          invitedIds={invitedIds}
          onToggleFriend={toggleFriend}
          onSendInvites={handleSendInvites}
          onClose={() => setShowInviteSheet(false)}
        />
      )}

      {/* Friend arrival toasts */}
      {arrivals.map((arrival) => {
        const friend = friends.find((f) => f.userId === arrival.friendId);
        return friend ? (
          <FriendJoinedToast
            key={arrival.id}
            friend={friend}
            onDismiss={() => {}}
          />
        ) : null;
      })}

      {/* Quick invite button - floating action if you want */}
      {count > 0 && !showFriendsSheet && !showInviteSheet && (
        <button
          type="button"
          className="live-presence-invite-btn"
          onClick={() => {
            setShowInviteSheet(true);
          }}
          aria-label="Invite friends to watch"
          title="Invite friends"
        >
          <Users size={18} strokeWidth={2} />
        </button>
      )}
    </>
  );
}
