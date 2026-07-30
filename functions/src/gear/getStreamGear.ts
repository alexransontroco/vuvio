import type { Response } from 'firebase-functions/v2/https';
import { ApiError } from '../shared/errors.js';
import { streamRef } from '../streams/streamHelpers.js';
import { publicGearForIds } from './gearHelpers.js';
import type { StreamDocument } from '../types/stream.js';

export async function getStreamGear(_req: unknown, res: Response, streamId: string) {
  const snap = await streamRef(streamId).get();
  if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
  const stream = snap.data() as StreamDocument;
  const gear = await publicGearForIds(stream.gearIds ?? []);
  res.json({ gear });
}
