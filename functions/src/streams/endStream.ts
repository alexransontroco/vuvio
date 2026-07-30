import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Request, Response } from 'firebase-functions/v2/https';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord } from '../shared/validation.js';
import { secondsBetween } from '../shared/timestamps.js';
import { addStreamEvent, streamRef } from './streamHelpers.js';
import { initializeStats } from '../analytics/stats.js';
import type { StreamDocument } from '../types/stream.js';

const reasons = new Set(['creator_ended', 'heartbeat_timeout', 'cloudflare_ended', 'error']);

export async function endStream(req: Request, res: Response, streamId: string, backendReason?: string) {
  const user = backendReason ? null : await authenticateUser(req);
  const body = req.body ? asRecord(req.body) : {};
  const reason = backendReason ?? (typeof body.reason === 'string' && reasons.has(body.reason) ? body.reason : 'creator_ended');
  let status = 'completed';
  let durationSeconds = 0;
  let alreadyEnded = false;

  await db.runTransaction(async (tx) => {
    const ref = streamRef(streamId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data() as StreamDocument;
    if (user && stream.creatorId !== user.uid) throw new ApiError('forbidden', 'Only the creator can end this stream');
    if (['completed', 'failed', 'cancelled'].includes(stream.status)) {
      alreadyEnded = true;
      status = stream.status;
      durationSeconds = stream.durationSeconds;
      return;
    }

    const endedAt = FieldValue.serverTimestamp();
    durationSeconds = secondsBetween(stream.startedAt, Timestamp.now());
    tx.update(ref, {
      status: 'completed',
      endedAt,
      durationSeconds,
      currentViewerCount: 0,
      networkStatus: reason === 'heartbeat_timeout' ? 'disconnected' : stream.networkStatus,
      endReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await initializeStats(streamId);
  if (!alreadyEnded) {
    addStreamEvent(streamId, {
      type: 'stream_ended',
      userId: user?.uid ?? null,
      anonymousSessionId: null,
      source: 'direct',
      metadata: { reason, durationSeconds },
    });
  }

  res.json({ stream: { id: streamId, status, durationSeconds }, alreadyEnded });
}
