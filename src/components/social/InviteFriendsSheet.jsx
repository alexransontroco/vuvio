import { Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';

/**
 * Sheet for inviting friends to watch the current live
 */
export function InviteFriendsSheet({
  friends = [],
  selected = new Set(),
  invitedIds = new Set(),
  loading = false,
  error = null,
  onToggleFriend,
  onSendInvites,
  onClose,
}) {
  const [search, setSearch] = useState('');

  const filteredFriends = useMemo(() => {
    if (!search) return friends;
    const q = search.toLowerCase();
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q)
    );
  }, [friends, search]);

  const selectedCount = selected.size;
  const canSend = selectedCount > 0 && !loading;

  return (
    <div className="invite-friends-sheet">
      <button
        type="button"
        className="friends-watching-sheet__backdrop"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="invite-friends-sheet__panel">
        <span className="invite-friends-sheet__handle" aria-hidden="true" />

        <header className="invite-friends-sheet__header">
          <h2 className="invite-friends-sheet__title">Invite friends</h2>
          <button
            type="button"
            className="invite-friends-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="invite-friends-sheet__search">
          <input
            type="search"
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search friends"
          />
        </div>

        <div className="invite-friends-sheet__list">
          {filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => {
              const isSelected = selected.has(friend.id);
              const isInvited = invitedIds.has(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  className="friend-watching-row"
                  onClick={() => !isInvited && onToggleFriend?.(friend.id)}
                  disabled={isInvited}
                  aria-pressed={isSelected}
                >
                  <div className="friend-watching-row__avatar">
                    {friend.avatar}
                  </div>
                  <div className="friend-watching-row__info">
                    <p className="friend-watching-row__name">{friend.name}</p>
                    {friend.username && (
                      <p className="friend-watching-row__username">
                        @{friend.username}
                      </p>
                    )}
                  </div>
                  <div className="friend-watching-row__action">
                    {isInvited ? (
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>
                        ✓
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select ${friend.name}`}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="friends-watching-sheet__empty">
              <p>No friends found</p>
            </div>
          )}
        </div>

        <footer className="invite-friends-sheet__footer">
          {error && (
            <p
              style={{
                color: '#ff3b4e',
                margin: 0,
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            className={`invite-friends-sheet__send-btn${
              loading ? ' is-loading' : ''
            }`}
            onClick={onSendInvites}
            disabled={!canSend}
            aria-label={`Send ${selectedCount} invite${selectedCount !== 1 ? 's' : ''}`}
          >
            {loading
              ? 'Sending...'
              : selectedCount > 0
                ? `Send ${selectedCount} invite${selectedCount !== 1 ? 's' : ''}`
                : 'Select friends to invite'}
          </button>
        </footer>
      </div>
    </div>
  );
}
