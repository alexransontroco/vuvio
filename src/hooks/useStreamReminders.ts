import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

export type StreamReminderNotif = {
  id: string;
  streamId: string;
  streamTitle: string;
  minutesBefore: number;
  label: string;
  read: boolean;
  createdAt: { seconds: number } | null;
};

export function useStreamReminders(userId: string | null | undefined) {
  const [reminders, setReminders] = useState<StreamReminderNotif[]>([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'notifications', userId, 'items'),
      where('type', '==', 'stream_reminder'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReminders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StreamReminderNotif, 'id'>) })));
    }, () => {});
    return unsub;
  }, [userId]);

  const dismiss = async (notifId: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'notifications', userId, 'items', notifId), { read: true });
  };

  return { reminders, dismiss };
}
