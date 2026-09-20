import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { addStreamEvent } from './streamHelpers.js';
export async function cancelScheduledStream(req, res, streamId) {
    const user = await authenticateUser(req);
    const ref = db.collection(collections.streams).doc(streamId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data();
    if (stream.creatorId !== user.uid)
        throw new ApiError('forbidden', 'Not your stream');
    if (stream.status !== 'scheduled')
        throw new ApiError('bad_request', 'Only scheduled streams can be cancelled');
    await ref.update({ status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
    await addStreamEvent(streamId, { type: 'stream_ended', userId: user.uid, anonymousSessionId: null, source: null, metadata: { reason: 'cancelled' } });
    res.json({ stream: { id: streamId, status: 'cancelled' } });
}
