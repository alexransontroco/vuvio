import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringArray } from '../shared/validation.js';
import { assertGearOwnership } from './gearHelpers.js';
import { streamRef } from '../streams/streamHelpers.js';
export async function attachGearToStream(req, res, streamId) {
    const user = await authenticateUser(req);
    const body = asRecord(req.body);
    const gearIds = await assertGearOwnership(user.uid, stringArray(body, 'gearIds', 20));
    const ref = streamRef(streamId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data();
    if (stream.creatorId !== user.uid)
        throw new ApiError('forbidden', 'Only the creator can modify stream gear');
    await ref.update({ gearIds, updatedAt: FieldValue.serverTimestamp() });
    res.json({ stream: { id: streamId, gearIds } });
}
