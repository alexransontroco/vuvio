import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { subscribeToConversations } from '../services/messagingService.js';

const MessagingContext = createContext({ unreadCount: 0, conversations: [] });

export function MessagingProvider({ children }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      return;
    }
    return subscribeToConversations(user.uid, setConversations);
  }, [user?.uid]);

  const unreadCount = conversations.reduce((sum, c) => {
    const n = c.unread?.[user?.uid] ?? 0;
    return sum + (n > 0 ? 1 : 0);
  }, 0);

  return (
    <MessagingContext.Provider value={{ conversations, unreadCount }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  return useContext(MessagingContext);
}
