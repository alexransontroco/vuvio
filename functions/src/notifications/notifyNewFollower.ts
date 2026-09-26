import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const notifyNewFollower = onDocumentUpdated({
  document: 'users/{uid}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const prevFollowed = new Set<string>(before.followedCreators ?? []);
  const nextFollowed: string[] = after.followedCreators ?? [];
  const added = nextFollowed.filter((uid) => !prevFollowed.has(uid));

  if (added.length === 0) return;

  const followerUid: string = event.params.uid;
  const followerName: string = after.displayName || after.username || 'Someone';
  const followerPhotoURL: string | null = after.photoURL ?? null;

  for (const creatorUid of added) {
    // Dedup: skip if already notified this follower within 24h
    const cacheRef = db
      .collection('users')
      .doc(creatorUid)
      .collection('followerNotifCache')
      .doc(followerUid);

    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      const lastNotifiedAt = cacheDoc.data()?.lastNotifiedAt as Timestamp | undefined;
      if (lastNotifiedAt && Date.now() - lastNotifiedAt.toMillis() < DEDUP_WINDOW_MS) {
        continue;
      }
    }

    const batch = db.batch();

    const notifRef = db
      .collection('users')
      .doc(creatorUid)
      .collection('notifications')
      .doc();
    batch.set(notifRef, {
      type: 'new_follower',
      title: `${followerName} started following you`,
      body: '',
      followerUid,
      followerName,
      followerPhotoURL,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(cacheRef, { lastNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });

    await batch.commit();
  }

  console.log(`[notifyNewFollower] Processed ${added.length} new follow(s) by ${followerName}`);
});
