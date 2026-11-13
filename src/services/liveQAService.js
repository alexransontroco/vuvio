import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

export function subscribeToQuestions(liveId, callback) {
  if (!liveId) return () => {};
  return onSnapshot(
    collection(db, `activeLives/${liveId}/questions`),
    (snap) => {
      const questions = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000;
          const bt = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000;
          return at - bt;
        });
      callback(questions);
    },
    (err) => console.warn('[liveQAService] onSnapshot error:', err.message)
  );
}

export async function sendQuestion({ liveId, streamCreatorId, authorId, authorName, authorAvatar, text }) {
  return addDoc(collection(db, `activeLives/${liveId}/questions`), {
    text,
    type: 'question',
    authorId,
    authorName: authorName || 'Spectateur',
    authorAvatar: authorAvatar || null,
    streamCreatorId: streamCreatorId || null,
    createdAt: serverTimestamp(),
    answered: false,
  });
}

export async function answerQuestion({ liveId, questionId, text, authorId, authorName }) {
  return updateDoc(doc(db, `activeLives/${liveId}/questions`, questionId), {
    answered: true,
    answer: {
      text,
      authorId,
      authorName,
      createdAt: new Date().toISOString(),
    },
  });
}
