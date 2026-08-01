import type { Response } from 'express';;
import { ApiError } from '../shared/errors.js';
import { publicStream, streamRef } from './streamHelpers.js';
import type { StreamDocument } from '../types/stream.js';

export async function getStream(_req: unknown, res: Response, streamId: string) {
  const snap = await streamRef(streamId).get();
  if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
  const stream = snap.data() as StreamDocument;
  if (stream.visibility !== 'public' && !['live', 'completed'].includes(stream.status)) {
    throw new ApiError('not_found', 'Stream not found');
  }
  res.json({ stream: publicStream(stream) });
}
