import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase.js';

export async function searchCreators(searchQuery) {
  if (!searchQuery?.trim()) return [];

  const normalized = searchQuery.toLowerCase().trim();

  try {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(user => {
        if (!user.username || !user.displayName) return false;
        const userNormalized = (user.usernameNormalized || user.username.toLowerCase());
        return userNormalized.includes(normalized);
      })
      .slice(0, 20);
  } catch (err) {
    console.error('[creatorService] Search failed:', err.message);
    return [];
  }
}

export async function followCreator(currentUid, creatorUid) {
  if (!currentUid || !creatorUid || currentUid === creatorUid) return;

  try {
    const userRef = doc(db, 'users', currentUid);
    await updateDoc(userRef, {
      followedCreators: arrayUnion(creatorUid),
    });
  } catch (err) {
    console.error('[creatorService] Follow failed:', err.message);
  }
}

export async function unfollowCreator(currentUid, creatorUid) {
  if (!currentUid || !creatorUid) return;

  try {
    const userRef = doc(db, 'users', currentUid);
    await updateDoc(userRef, {
      followedCreators: arrayRemove(creatorUid),
    });
  } catch (err) {
    console.error('[creatorService] Unfollow failed:', err.message);
  }
}
