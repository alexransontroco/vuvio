import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="friends-watching-sheet">
      <button
        type="button"
        className="friends-watching-sheet__backdrop"
        onClick={onClose}
        aria-label={t('common.close')}
      />

      <div className="friends-watching-sheet__panel">
        <span
          className="friends-watching-sheet__handle"
          aria-hidden="true"
        />

        <header className="friends-watching-sheet__header">
          <h2 className="friends-watching-sheet__title">{t('social.sheet.title')}</h2>
          <p className="friends-watching-sheet__subtitle">
            {t('social.sheet.subtitle')}
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
            <strong>{t('social.sheet.emptyTitle')}</strong>
            <p>{t('social.sheet.emptyBody')}</p>
          </div>
        )}

        <footer className="friends-watching-sheet__footer">
          <button
            type="button"
            className="friends-watching-sheet__invite-btn"
            onClick={onInvite}
            disabled={isLoading}
            aria-label={t('social.inviteAFriend')}
          >
            {isLoading ? t('common.loading') : t('social.inviteAFriend')}
          </button>
        </footer>
      </div>
    </div>
  );
}
