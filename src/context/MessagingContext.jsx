import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { initMessaging, subscribeToConversations } from '../services/messagingService.js';

const MessagingContext = createContext({ unreadCount: 0, conversations: [] });

export function MessagingProvider({ children }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    initMessaging(user?.uid ?? null);
    return subscribeToConversations(user?.uid ?? null, setConversations);
  }, [user?.uid]);

  const unreadCount = conversations.reduce(
    (sum, c) => sum + (!c.request && c.unreadCount > 0 ? 1 : 0),
    0,
  );

  return (
    <MessagingContext.Provider value={{ conversations, unreadCount }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  return useContext(MessagingContext);
}
