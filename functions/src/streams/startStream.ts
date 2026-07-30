import { FieldValue } from 'firebase-admin/firestore';
import type { Request, Response } from 'firebase-functions/v2/https';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { addStreamEvent, streamRef } from './streamHelpers.js';
import { assertStatus } from './status.js';
import type { StreamDocument } from '../types/stream.js';

export async function startStream(req: Request, res: Response, streamId: string) {
  const user = await authenticateUser(req);
  const ref = streamRef(streamId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data() as StreamDocument;
    if (stream.creatorId !== user.uid) throw new ApiError('forbidden', 'Only the creator can start this stream');
    const conflict = assertStatus(stream.status, ['preparing', 'connecting'], 'Start');
    if (conflict) throw new ApiError('conflict', conflict);

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
