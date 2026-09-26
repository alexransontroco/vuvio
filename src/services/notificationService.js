import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.js';

const notifCol = (uid) => collection(db, 'users', uid, 'notifications');

export function subscribeNotifications(uid, callback) {
  const q = query(notifCol(uid), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => callback([]));
}

export async function createNotification(uid, data) {
  return addDoc(notifCol(uid), {
    read: false,
    createdAt: serverTimestamp(),
    ...data,
  });
}

export async function markRead(uid, notifId) {
  return updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
}

export async function markAllRead(uid) {
  const snap = await getDocs(query(notifCol(uid), limit(50)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    if (!d.data().read) batch.update(d.ref, { read: true });
  });
  return batch.commit();
}

export async function getRemindedStreamIds(uid) {
  const snap = await getDocs(query(notifCol(uid), where('type', '==', 'remind_me')));
  return new Set(snap.docs.map((d) => d.data().streamId).filter(Boolean));
}
