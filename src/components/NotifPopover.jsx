import { Bell, CalendarClock, MessageCircle, Radio, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function notifTimeAgo(value) {
  if (!value) return '';
  const ts = value?.toDate ? value.toDate() : new Date(value);
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const NOTIF_TYPE_META = {
  remind_me:        { Icon: Bell,          color: 'var(--color-accent)' },
  stream_reminder:  { Icon: CalendarClock, color: 'var(--color-accent)' },
  creator_live:     { Icon: Radio,         color: '#e05e5e' },
  new_follower:     { Icon: UserRound,     color: 'var(--vuvio-blue, #2372c8)' },
  message_received: { Icon: MessageCircle, color: 'var(--vuvio-blue, #2372c8)' },
};

function notifTarget(notif) {
  if ((notif.type === 'creator_live' || notif.type === 'stream_reminder') && notif.streamId) {
    return `/watch?live=${encodeURIComponent(notif.streamId)}&mode=view`;
  }
  if (notif.type === 'new_follower' && notif.followerUid) return `/profile/${notif.followerUid}`;
  if (notif.type === 'message_received' && notif.conversationId) return `/messages/${notif.conversationId}`;
  return null;
}

function NotifItem({ notif, onRead, onNavigate }) {
  const meta = NOTIF_TYPE_META[notif.type] ?? NOTIF_TYPE_META.remind_me;
  const { Icon, color } = meta;
  const target = notifTarget(notif);

  const handleClick = () => {
    if (!notif.read) onRead(notif.id);
    if (target) onNavigate(target);
  };

  return (
    <button
      type="button"
      className={`notif-item${notif.read ? '' : ' notif-item--unread'}${target ? ' notif-item--tappable' : ''}`}
      onClick={handleClick}
    >
      <span className="notif-item__icon" style={{ color }}>
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span className="notif-item__body">
        <strong>{notif.title}</strong>
        {notif.body ? <span>{notif.body}</span> : null}
      </span>
      <span className="notif-item__right">
        {!notif.read ? <span className="notif-item__dot" aria-hidden="true" /> : null}
        <span className="notif-item__time">{notifTimeAgo(notif.createdAt)}</span>
      </span>
    </button>
  );
}

export default function NotifPopover({ notifications, loading, unreadCount, markRead, markAllRead, onClose, onNavigate }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={onClose} aria-hidden="true" />
      <div className="notif-popover" role="dialog" aria-modal="true" aria-label={t('notifications.title')}>
        <div className="notif-popover__header">
          <span className="notif-popover__title">{t('notifications.title')}</span>
          {unreadCount > 0 ? (
            <button type="button" className="notif-header__mark-all" onClick={markAllRead}>
              {t('notifications.markAllRead')}
            </button>
          ) : null}
        </div>
        <div className="notif-popover__list">
          {loading ? (
            <div className="notif-skeleton" style={{ padding: '8px 12px' }}>
              {[1, 2, 3].map((i) => <div key={i} className="notif-skeleton__item" />)}
            </div>
          ) : notifications.length === 0 ? (
            <p className="notif-popover__empty">{t('notifications.empty')}</p>
          ) : (
            notifications.map((notif) => (
              <NotifItem key={notif.id} notif={notif} onRead={markRead} onNavigate={onNavigate} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
