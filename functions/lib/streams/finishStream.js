import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord } from '../shared/validation.js';
import { streamRef } from './streamHelpers.js';
export async function finishStream(req, res, streamId) {
    const user = await authenticateUser(req);
    const body = req.body ? asRecord(req.body) : {};
    const reason = typeof body.reason === 'string' ? body.reason : 'creator_finished';
    const streamRefDoc = streamRef(streamId);
    const activeLiveRef = db.collection('activeLives').doc(streamId);
    const [streamSnap, activeLiveSnap] = await Promise.all([streamRefDoc.get(), activeLiveRef.get()]);
    const snap = streamSnap.exists ? streamSnap : activeLiveSnap;
    if (!snap.exists)
        throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data();
    const creatorId = stream.creatorId ?? stream.creatorUid ?? null;
    if (creatorId !== user.uid)
        throw new ApiError('forbidden', 'Only the creator can finish this stream');
    await db.runTransaction(async (tx) => {
        const current = await tx.get(snap.ref);
        if (!current.exists)
            throw new ApiError('not_found', 'Stream not found');
        const currentData = current.data();
        if (['completed', 'failed', 'cancelled'].includes(currentData.status ?? ''))
            return;
        tx.update(snap.ref, {
            status: 'completed',
            endedAt: FieldValue.serverTimestamp(),
            currentViewerCount: 0,
            updatedAt: FieldValue.serverTimestamp(),
            endReason: reason,
            replayCleanupPending: true,
        });
    });
    res.json({ stream: { id: streamId, status: 'completed' } });
}
