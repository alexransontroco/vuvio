import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { addStreamEvent, streamRef } from './streamHelpers.js';
import { assertStatus } from './status.js';
export async function startStream(req, res, streamId) {
    const user = await authenticateUser(req);
    const ref = streamRef(streamId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new ApiError('not_found', 'Stream not found');
        const stream = snap.data();
        if (stream.creatorId !== user.uid)
            throw new ApiError('forbidden', 'Only the creator can start this stream');
        const conflict = assertStatus(stream.status, ['preparing', 'connecting'], 'Start');
        if (conflict)
            throw new ApiError('conflict', conflict);
        tx.update(ref, {
            status: 'live',
            startedAt: FieldValue.serverTimestamp(),
            lastHeartbeatAt: FieldValue.serverTimestamp(),
            lastHeartbeatWriteAt: FieldValue.serverTimestamp(),
            networkStatus: 'good',
            updatedAt: FieldValue.serverTimestamp(),
        });
    });
    addStreamEvent(streamId, {
        type: 'stream_started',
        userId: user.uid,
        anonymousSessionId: null,
        source: 'direct',
        metadata: {},
    });
    res.json({ stream: { id: streamId, status: 'live' } });
}
