import { Users } from 'lucide-react';
import './social.css';

/**
 * Compact capsule showing friend count and avatars
 * Appears as a subtle presence indicator in the live viewer
 */
export function FriendsWatchingPill({ friends = [], count = 0, onClick, className = '' }) {
  if (count === 0) return null;

  const visibleFriends = friends.slice(0, 3);
  const hiddenCount = Math.max(0, count - 3);

  return (
    <button
      type="button"
      className={`friends-watching-pill ${className}`}
      onClick={onClick}
      aria-label={count === 1 ? `${friends[0]?.name} is watching` : `${count} friends are watching`}
    >
      <div className="friends-watching-pill__avatars">
        {visibleFriends.map((friend, index) => (
          <div
            key={friend.userId}
            className="friends-watching-pill__avatar"
            style={{ '--avatar-index': index }}
            title={friend.name}
          >
            {friend.avatar}
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="friends-watching-pill__avatar friends-watching-pill__avatar--more" title={`+${hiddenCount} more`}>
            +{hiddenCount}
          </div>
        )}
      </div>

      <div className="friends-watching-pill__text">
        {count === 1 ? (
          <>
            <span className="friends-watching-pill__name">{friends[0]?.name}</span>
            <span className="friends-watching-pill__label">is here</span>
          </>
        ) : (
          <>
            <span className="friends-watching-pill__count">{count} friends</span>
            <span className="friends-watching-pill__label">are here</span>
          </>
        )}
      </div>

      <Users size={14} strokeWidth={2} className="friends-watching-pill__icon" />
    </button>
  );
}
