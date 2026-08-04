;
import { ApiError } from '../shared/errors.js';
import { publicStream, streamRef } from './streamHelpers.js';
export async function getStream(_req, res, streamId) {
    const snap = await streamRef(streamId).get();
    if (!snap.exists)
        throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data();
    if (stream.visibility !== 'public' && !['live', 'completed'].includes(stream.status)) {
        throw new ApiError('not_found', 'Stream not found');
    }
    res.json({ stream: publicStream(stream) });
}
