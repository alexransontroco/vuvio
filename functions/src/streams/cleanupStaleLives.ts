import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';

const STALE_MINUTES = 5;

export async function cleanupStaleLives() {
  const cutoff = Timestamp.fromMillis(Date.now() - STALE_MINUTES * 60 * 1000);

  // Detect lives that have been live but stopped heartbeating
  const staleSnap = await db.collection('activeLives')
    .where('status', '==', 'live')
    .where('lastHeartbeatAt', '<', cutoff)
    .get();

  if (staleSnap.empty) return;

  const batch = db.batch();
  staleSnap.docs.forEach((docSnap) => {
    console.log(`[CLOUDFLARE] cleanup — marking stale live as ended: ${docSnap.id}`);
    batch.update(docSnap.ref, {
      status: 'ended',
      endedAt: FieldValue.serverTimestamp(),
      endReason: 'heartbeat_timeout',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log(`[CLOUDFLARE] cleanup complete — ended ${staleSnap.size} stale live(s)`);
}
