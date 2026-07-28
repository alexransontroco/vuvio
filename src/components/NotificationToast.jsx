import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/components/notification-toast.css';

export default function NotificationToast({ notifications, onDismiss }) {
  const navigate = useNavigate();

  const handleNotificationClick = (liveId) => {
    navigate(`/watch?live=${encodeURIComponent(liveId)}`);
    onDismiss(liveId);
  };

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="notification-stack" role="region" aria-live="polite" aria-label="Live notifications">
      {notifications.map((notif) => (
        <div key={notif.id} className="notification-toast" role="alert">
          <div
            className="notification-toast__content"
            onClick={() => handleNotificationClick(notif.liveId)}
          >
            <div className="notification-toast__header">
              <strong className="notification-toast__title">{notif.title}</strong>
            </div>
            {notif.description && (
              <p className="notification-toast__desc">{notif.description}</p>
            )}
          </div>
          <button
            type="button"
            className="notification-toast__close"
            onClick={() => onDismiss(notif.id)}
            aria-label="Dismiss notification"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
