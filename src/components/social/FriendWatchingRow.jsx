import { ChevronRight } from 'lucide-react';
import { formatTimeSinceJoined } from '../../hooks/useLivePresence.js';

/**
 * Individual friend row shown in the friends watching sheet
 */
export function FriendWatchingRow({ friend, onViewProfile, onMessage }) {
  return (
    <div className="friend-watching-row">
      <div className="friend-watching-row__avatar" title={friend.name}>
        {friend.avatar}
      </div>

      <div className="friend-watching-row__info">
        <p className="friend-watching-row__name">{friend.name}</p>
        {friend.username && (
          <p className="friend-watching-row__username">@{friend.username}</p>
        )}
        <span className="friend-watching-row__time">
          {formatTimeSinceJoined(friend.joinedAt)}
        </span>
      </div>

      <button
        type="button"
        className="friend-watching-row__action"
        onClick={onViewProfile}
        aria-label={`View ${friend.name}'s profile`}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
