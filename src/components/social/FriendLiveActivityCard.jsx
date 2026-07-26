/**
 * Reusable card showing a friend is watching a live
 * Can be used in Messages, Home, or a dedicated friends activity section
 */
export function FriendLiveActivityCard({
  friend,
  live,
  onJoinLive,
  compact = false,
}) {
  return (
    <article className="friend-live-activity-card">
      <div className="friend-live-activity-card__thumbnail">
        {live.image && (
          <img
            src={live.image}
            alt={live.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/icons/icon-192.png';
            }}
          />
        )}
      </div>

      <div className="friend-live-activity-card__info">
        <header className="friend-live-activity-card__header">
          <div className="friend-live-activity-card__avatar">
            {friend.avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="friend-live-activity-card__name">{friend.name}</p>
          </div>
          <span className="friend-live-activity-card__badge">Live</span>
        </header>

        <p className="friend-live-activity-card__title">{live.title}</p>

        {live.location && (
          <span className="friend-live-activity-card__location">
            📍 {live.location}
          </span>
        )}

        <div className="friend-live-activity-card__action">
          <button
            type="button"
            onClick={onJoinLive}
            aria-label={`Join ${friend.name} watching ${live.title}`}
          >
            Join live
          </button>
        </div>
      </div>
    </article>
  );
}
