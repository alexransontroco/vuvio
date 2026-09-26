import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatTimeSinceJoined } from '../../hooks/useLivePresence.js';

/**
 * Individual friend row shown in the friends watching sheet
 */
export function FriendWatchingRow({ friend, onViewProfile, onMessage }) {
  const { t } = useTranslation();
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
        aria-label={t('social.viewProfileOfAria', { name: friend.name })}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
