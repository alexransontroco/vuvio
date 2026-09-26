import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  markAllRead,
  markRead,
  subscribeNotifications,
} from '../services/notificationService.js';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeNotifications(user.uid, (items) => {
      setNotifications(items);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const handleMarkRead = useCallback((id) => {
    if (user?.uid) markRead(user.uid, id);
  }, [user?.uid]);

  const handleMarkAllRead = useCallback(() => {
    if (user?.uid) markAllRead(user.uid);
  }, [user?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
  };
}
