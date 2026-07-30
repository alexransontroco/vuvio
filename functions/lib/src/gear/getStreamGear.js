import { ApiError } from '../shared/errors.js';
import { streamRef } from '../streams/streamHelpers.js';
import { publicGearForIds } from './gearHelpers.js';
export async function getStreamGear(_req, res, streamId) {
    const snap = await streamRef(streamId).get();
    if (!snap.exists)
        throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data();
    const gear = await publicGearForIds(stream.gearIds ?? []);
    res.json({ gear });
}
