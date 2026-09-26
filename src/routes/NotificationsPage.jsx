import { Bell, CalendarClock, ChevronLeft, MessageCircle, Radio, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications.js';

function timeAgo(value) {
  if (!value) return '';
  const ts = value?.toDate ? value.toDate() : new Date(value);
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const TYPE_META = {
  remind_me:       { Icon: Bell,           color: 'var(--color-accent)' },
  stream_reminder: { Icon: CalendarClock,  color: 'var(--color-accent)' },
  creator_live:    { Icon: Radio,          color: '#e05e5e' },
  new_follower:    { Icon: UserRound,      color: 'var(--vuvio-blue, #2372c8)' },
  message_received:{ Icon: MessageCircle,  color: 'var(--vuvio-blue, #2372c8)' },
};

function notifTarget(notif) {
  if ((notif.type === 'creator_live' || notif.type === 'stream_reminder') && notif.streamId) {
    return `/watch?live=${encodeURIComponent(notif.streamId)}&mode=view`;
  }
  if (notif.type === 'new_follower' && notif.followerUid) {
    return `/profile/${notif.followerUid}`;
  }
  if (notif.type === 'message_received' && notif.conversationId) {
    return `/messages/${notif.conversationId}`;
  }
  return null;
}

function NotifItem({ notif, onRead, onNavigate }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.remind_me;
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
        <span className="notif-item__time">{timeAgo(notif.createdAt)}</span>
      </span>
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

  return (
    <section className="screen-scroll notif-screen" aria-label={t('notifications.title')}>
      <header className="notif-header">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>{t('notifications.title')}</h1>
        {unreadCount > 0 ? (
          <button type="button" className="notif-header__mark-all" onClick={markAllRead}>
            {t('notifications.markAllRead')}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      <div className="notif-list">
        {loading ? (
          <div className="notif-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="notif-skeleton__item" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <Bell size={40} strokeWidth={1.4} />
            <strong>{t('notifications.empty')}</strong>
            <p>{t('notifications.emptyHint')}</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotifItem
              key={notif.id}
              notif={notif}
              onRead={markRead}
              onNavigate={navigate}
            />
          ))
        )}
      </div>
    </section>
  );
}
