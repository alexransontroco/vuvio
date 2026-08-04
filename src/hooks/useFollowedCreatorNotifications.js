import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

export function useFollowedCreatorNotifications(userProfile) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    console.log('[Notifications] Setup - followedCreators:', userProfile?.followedCreators);

    if (!userProfile?.followedCreators?.length) {
      console.log('[Notifications] No followed creators');
      return;
    }

    const q = query(
      collection(db, 'activeLives'),
      where('status', '==', 'live')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('[Notifications] Snapshot received, changes:', snapshot.docChanges().length);

      snapshot.docChanges().forEach((change) => {
        const live = change.doc.data();
        console.log('[Notifications] Change type:', change.type, 'Live:', live.id, 'Creator UID:', live.creatorUid);

        if (change.type === 'added') {
          if (live.creatorUid && userProfile.followedCreators.includes(live.creatorUid)) {
            console.log('[Notifications] MATCH FOUND! Showing notification for:', live.streamer);
            const notification = {
              id: live.id,
              title: `${live.streamer} just went live!`,
              description: live.title,
              creatorName: live.streamer,
              liveId: live.id,
              timestamp: Date.now(),
            };
            setNotifications((prev) => [notification, ...prev.filter(n => n.id !== live.id)]);

            setTimeout(() => {
              setNotifications((prev) => prev.filter(n => n.id !== live.id));
            }, 5000);
          } else {
            console.log('[Notifications] Creator not followed or no creatorUid');
          }
        }
      });
    }, (err) => {
      console.error('[useFollowedCreatorNotifications] Listen failed:', err.message);
    });

    return unsubscribe;
  }, [userProfile?.followedCreators]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, dismissNotification };
}
