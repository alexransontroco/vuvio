import { FriendWatchingRow } from './FriendWatchingRow.jsx';

/**
 * Bottom sheet showing all friends currently watching the live
 */
export function FriendsWatchingSheet({
  friends = [],
  onClose,
  onViewProfile,
  onInvite,
  isLoading = false,
}) {
  return (
    <div className="friends-watching-sheet">
      <button
        type="button"
        className="friends-watching-sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="friends-watching-sheet__panel">
        <span
          className="friends-watching-sheet__handle"
          aria-hidden="true"
        />

        <header className="friends-watching-sheet__header">
          <h2 className="friends-watching-sheet__title">Watching with you</h2>
          <p className="friends-watching-sheet__subtitle">
            Friends currently in this live
          </p>
        </header>

        {friends.length > 0 ? (
          <div className="friends-watching-sheet__list">
            {friends.map((friend) => (
              <FriendWatchingRow
                key={friend.userId}
                friend={friend}
                onViewProfile={() => onViewProfile?.(friend.userId)}
              />
            ))}
          </div>
        ) : (
          <div className="friends-watching-sheet__empty">
            <strong>No friends watching</strong>
            <p>Invite your friends to watch this live with you</p>
          </div>
        )}

        <footer className="friends-watching-sheet__footer">
          <button
            type="button"
            className="friends-watching-sheet__invite-btn"
            onClick={onInvite}
            disabled={isLoading}
            aria-label="Invite a friend"
          >
            {isLoading ? 'Loading...' : 'Invite a friend'}
          </button>
        </footer>
      </div>
    </div>
  );
}
