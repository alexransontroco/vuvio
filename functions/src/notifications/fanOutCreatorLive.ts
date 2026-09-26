import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';

const PAGE_SIZE = 500;

export const fanOutCreatorLive = onDocumentCreated({
  document: 'activeLives/{liveId}',
  region: 'europe-west1',
}, async (event) => {
  const live = event.data?.data();
  if (!live) return;

  const creatorUid = live.creatorUid as string | undefined;
  if (!creatorUid) return;

  const creatorName: string = live.streamer || live.creatorDisplayName || 'Someone you follow';
  const streamTitle: string = live.title || live.experienceTitle || live.description || '';
  const liveId: string = event.params.liveId;

  let lastDoc: QueryDocumentSnapshot | null = null;
  let totalNotified = 0;

  do {
    let q = db.collection('users')
      .where('liveNotifications', 'array-contains', creatorUid)
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((followerDoc) => {
      const notifRef = db
        .collection('users')
        .doc(followerDoc.id)
        .collection('notifications')
        .doc();
      batch.set(notifRef, {
        type: 'creator_live',
        title: `${creatorName} is live`,
        body: streamTitle,
        creatorUid,
        creatorName,
        streamId: liveId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    totalNotified += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.size < PAGE_SIZE) break;
  } while (true);

  if (totalNotified > 0) {
    console.log(`[fanOutCreatorLive] Notified ${totalNotified} follower(s) of ${creatorName}`);
  }
});
