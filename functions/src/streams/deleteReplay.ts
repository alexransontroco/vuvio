import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { db } from '../shared/firestore.js';
import { createCloudflareClient, type CloudflareClient } from '../cloudflare/cloudflareClient.js';

const IN_PROGRESS_HIGHLIGHT_STATUSES = ['queued', 'processing', 'assembling'];

export type DeleteReplayStatus = 'deleted' | 'deferred' | 'not_found' | 'nothing_to_delete';

export interface DeleteReplayDeps {
  cfClient?: CloudflareClient;
  hasPendingHighlights?: (liveId: string) => Promise<boolean>;
  readLive?: (liveId: string) => Promise<Record<string, unknown> | null>;
  writeLive?: (liveId: string, patch: Record<string, unknown>) => Promise<void>;
}

async function defaultHasPendingHighlightJobs(liveId: string): Promise<boolean> {
  const snap = await db.collection('highlights')
    .where('liveId', '==', liveId)
    .where('status', 'in', IN_PROGRESS_HIGHLIGHT_STATUSES)
    .limit(1)
    .get();
  return !snap.empty;
}

async function defaultReadLive(liveId: string): Promise<Record<string, unknown> | null> {
  const snap = await db.collection('activeLives').doc(liveId).get();
  if (!snap.exists) return null;
  return snap.data() ?? {};
}

async function defaultWriteLive(liveId: string, patch: Record<string, unknown>): Promise<void> {
  await db.collection('activeLives').doc(liveId).set(patch, { merge: true });
}

export async function deleteReplayForLive(
  liveId: string,
  deps: DeleteReplayDeps = {},
): Promise<{ status: DeleteReplayStatus }> {
  const hasPending = deps.hasPendingHighlights ?? defaultHasPendingHighlightJobs;
  const readLive = deps.readLive ?? defaultReadLive;
  const writeLive = deps.writeLive ?? defaultWriteLive;

  const data = await readLive(liveId);
  if (data === null) return { status: 'not_found' };

  const videoUid = typeof data.recordingUid === 'string' && data.recordingUid
    ? data.recordingUid
    : typeof data.cloudflareVideoId === 'string' ? data.cloudflareVideoId : '';
  const hasReplayFields = Boolean(videoUid || data.replayUrl);

  if (!hasReplayFields) {
    await writeLive(liveId, {
      replayUrl: FieldValue.delete(),
      recordingStatus: 'deleted',
      replayDeletedAt: FieldValue.serverTimestamp(),
      replayDeletionPending: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { status: 'nothing_to_delete' };
  }

  if (await hasPending(liveId)) {
    await writeLive(liveId, {
      replayUrl: FieldValue.delete(),
      recordingStatus: 'revoked',
      replayRevokedAt: FieldValue.serverTimestamp(),
      replayDeletionPending: true,
      replayDeletionRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[deleteReplay] deferred for live=${liveId} — highlights in progress; replay revoked in UI`);
    return { status: 'deferred' };
  }

  if (videoUid) {
    const cf = deps.cfClient ?? createCloudflareClient();
    try {
      await cf.deleteVideo(videoUid);
    } catch (err) {
      console.error(`[deleteReplay] Cloudflare deleteVideo failed for ${videoUid}:`, err instanceof Error ? err.message : err);
      throw err;
    }
  }

  await writeLive(liveId, {
    replayUrl: FieldValue.delete(),
    recordingUid: FieldValue.delete(),
    cloudflareVideoId: FieldValue.delete(),
    thumbnailUrl: FieldValue.delete(),
    recordingStatus: 'deleted',
    replayDeletedAt: FieldValue.serverTimestamp(),
    replayDeletionPending: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[deleteReplay] deleted live=${liveId} videoUid=${videoUid}`);
  return { status: 'deleted' };
}

export async function deleteReplay(req: Request, res: Response, liveId: string) {
  const user = await authenticateUser(req);
  const liveRef = db.collection('activeLives').doc(liveId);
  const snap = await liveRef.get();
  if (!snap.exists) throw new ApiError('not_found', 'Live not found');

  const data = snap.data() ?? {};
  const creatorUid = typeof data.creatorUid === 'string' ? data.creatorUid : typeof data.creatorId === 'string' ? data.creatorId : '';
  if (creatorUid && creatorUid !== user.uid) {
    throw new ApiError('forbidden', 'Only the creator can delete this replay');
  }

  const result = await deleteReplayForLive(liveId);
  res.json({ success: true, ...result });
}
