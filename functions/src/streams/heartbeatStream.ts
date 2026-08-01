import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { STREAM_TIMEOUTS } from '../config/env.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord } from '../shared/validation.js';
import { addStreamEvent, streamRef } from './streamHelpers.js';
import type { NetworkStatus, StreamDocument } from '../types/stream.js';

export async function heartbeatStream(req: Request, res: Response, streamId: string) {
  const user = await authenticateUser(req);
  const body = asRecord(req.body ?? {});
  const networkStatus = body.networkStatus === 'unstable' ? 'unstable' : 'good';
  const viewerCount = body.viewerCount === undefined ? undefined : Math.max(0, Math.floor(Number(body.viewerCount)));
  if (viewerCount !== undefined && !Number.isFinite(viewerCount)) throw new ApiError('bad_request', 'viewerCount is invalid');

  let restored = false;
  let skippedWrite = false;
  let responseStatus: NetworkStatus = networkStatus;

  await db.runTransaction(async (tx) => {
    const ref = streamRef(streamId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
    const stream = snap.data() as StreamDocument;
    if (stream.creatorId !== user.uid) throw new ApiError('forbidden', 'Only the creator can heartbeat this stream');
    if (!['live', 'reconnecting'].includes(stream.status)) throw new ApiError('conflict', `Heartbeat is not allowed while stream is ${stream.status}`);

    const lastWriteMs = stream.lastHeartbeatWriteAt?.toMillis?.() ?? 0;
    if (Date.now() - lastWriteMs < STREAM_TIMEOUTS.minHeartbeatWriteIntervalSeconds * 1000) {
      skippedWrite = true;
      return;
    }

    restored = stream.status === 'reconnecting';
    responseStatus = networkStatus;
    const patch: Record<string, unknown> = {
      status: 'live',
      lastHeartbeatAt: FieldValue.serverTimestamp(),
      lastHeartbeatWriteAt: FieldValue.serverTimestamp(),
      networkStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (viewerCount !== undefined) {
      patch.currentViewerCount = viewerCount;
      if (viewerCount > (stream.peakViewerCount ?? 0)) patch.peakViewerCount = viewerCount;
    }
    tx.update(ref, patch);
  });

  if (restored) {
    addStreamEvent(streamId, {
      type: 'connection_restored',
      userId: user.uid,
      anonymousSessionId: null,
      source: 'direct',
      metadata: {},
    });
  }

  res.json({ stream: { id: streamId, status: skippedWrite ? 'unchanged' : 'live', networkStatus: responseStatus }, skippedWrite });
}
