import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
import { createCloudflareClient } from '../cloudflare/cloudflareClient.js';
const STALE_MINUTES = 5;
const LIVE_INPUT_GRACE_MINUTES = 10;
export async function cleanupStaleLives() {
    const cutoff = Timestamp.fromMillis(Date.now() - STALE_MINUTES * 60 * 1000);
    // Detect lives that have been live but stopped heartbeating
    const staleSnap = await db.collection('activeLives')
        .where('status', '==', 'live')
        .where('lastHeartbeatAt', '<', cutoff)
        .get();
    if (!staleSnap.empty) {
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
    await cleanupOrphanLiveInputs();
}
async function cleanupOrphanLiveInputs() {
    const graceCutoff = Timestamp.fromMillis(Date.now() - LIVE_INPUT_GRACE_MINUTES * 60 * 1000);
    const endedStatuses = ['ended', 'completed', 'failed', 'cancelled', 'preparing'];
    const snaps = await Promise.all(endedStatuses.map((status) => db.collection('activeLives')
        .where('status', '==', status)
        .get()));
    const client = createCloudflareClient();
    let deleted = 0;
    for (const snap of snaps) {
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const liveInputId = data.cloudflareLiveInputId || data.liveInputId || null;
            if (!liveInputId)
                continue;
            const endedAtMs = data.endedAt?.toMillis?.() ?? data.updatedAt?.toMillis?.() ?? 0;
            if (endedAtMs && endedAtMs > graceCutoff.toMillis())
                continue;
            try {
                await client.deleteLiveInput(liveInputId);
                console.log(`[CLOUDFLARE] cleanup — deleted orphan live input ${liveInputId} for ${docSnap.id}`);
                deleted += 1;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (!/not.?found/i.test(msg)) {
                    console.warn(`[CLOUDFLARE] cleanup — failed to delete live input ${liveInputId}:`, msg);
                    continue;
                }
            }
            await docSnap.ref.set({
                cloudflareLiveInputId: FieldValue.delete(),
                replayCleanupPending: false,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    }
    if (deleted > 0)
        console.log(`[CLOUDFLARE] cleanup — removed ${deleted} orphan live input(s)`);
}
