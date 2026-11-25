import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { db } from '../shared/firestore.js';
import { getCloudflareEnv } from '../config/env.js';

const IN_PROGRESS_HIGHLIGHT_STATUSES = ['queued', 'processing', 'assembling'];

export type DeleteReplayStatus = 'deleted' | 'deferred' | 'not_found' | 'nothing_to_delete';

export interface DeleteReplayDeps {
  // Injectable for tests — omit for production (defaults to real CF API)
  cfDeleteVideo?: (videoUid: string) => Promise<void>;
  hasPendingHighlights?: (liveId: string) => Promise<boolean>;
  readLive?: (liveId: string) => Promise<Record<string, unknown> | null>;
  writeLive?: (liveId: string, patch: Record<string, unknown>) => Promise<void>;
}

async function defaultCfDeleteVideo(videoUid: string): Promise<void> {
  const { accountId, apiToken } = getCloudflareEnv();
  if (!accountId || !apiToken) throw new ApiError('server_error', 'Cloudflare not configured');
  // NOTE: uses /stream/{uid} (recorded video), NOT /live_inputs/{uid} (live input) — these are distinct CF resources.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(videoUid)}`,
      { method: 'DELETE', signal: ctrl.signal, headers: { Authorization: `Bearer ${apiToken}` } },
    );
    if (!response.ok && response.status !== 404) {
      throw new ApiError('server_error', `Cloudflare deleteVideo failed (HTTP ${response.status})`);
    }
    console.log(`[deleteReplay] CF delete uid=${videoUid} status=${response.status}`);
  } finally {
    clearTimeout(t);
  }
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
  const cfDeleteVideo = deps.cfDeleteVideo ?? defaultCfDeleteVideo;
  const hasPending = deps.hasPendingHighlights ?? defaultHasPendingHighlightJobs;
  const readLive = deps.readLive ?? defaultReadLive;
  const writeLive = deps.writeLive ?? defaultWriteLive;

  const data = await readLive(liveId);
  if (data === null) return { status: 'not_found' };

  // NOTE: videoUid is the recorded stream UID (/stream/{uid}), never the live input UID (/live_inputs/{uid}).
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

  // Deferred only if highlight jobs are ACTIVELY processing — completed highlights are already exported and unaffected.
  if (await hasPending(liveId)) {
    await writeLive(liveId, {
      replayUrl: FieldValue.delete(),
      recordingStatus: 'revoked',
      replayRevokedAt: FieldValue.serverTimestamp(),
      replayDeletionPending: true,
      replayDeletionRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[deleteReplay] deferred live=${liveId} — highlights in progress`);
    return { status: 'deferred' };
  }

  // Optimistic revocation: revoke in Firestore before CF call so the video is inaccessible in
  // the app even if the CF call times out or fails. replayDeletionPending=true flags for retry.
  // LIMITATION: a client that already cached the HLS URL can still stream until CF deletes the video.
  await writeLive(liveId, {
    replayUrl: FieldValue.delete(),
    recordingStatus: 'revoked',
    replayRevokedAt: FieldValue.serverTimestamp(),
    replayDeletionPending: Boolean(videoUid),
    replayDeletionRequestedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (!videoUid) {
    await writeLive(liveId, { recordingStatus: 'deleted', replayDeletionPending: false, updatedAt: FieldValue.serverTimestamp() });
    return { status: 'nothing_to_delete' };
  }

  try {
    await cfDeleteVideo(videoUid);
    await writeLive(liveId, {
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
  } catch (err) {
    // CF call failed — video is revoked in Firestore (inaccessible) but may still exist on CF.
    // replayDeletionPending=true flags it for the hourly retry scheduled function.
    console.error(`[deleteReplay] CF delete failed for live=${liveId} videoUid=${videoUid}; queued for retry:`, err instanceof Error ? err.message : err);
    return { status: 'deferred' };
  }
}

export async function retryPendingReplayDeletions(): Promise<void> {
  const snap = await db.collection('activeLives')
    .where('replayDeletionPending', '==', true)
    .limit(20)
    .get();

  if (snap.empty) return;
  console.log(`[deleteReplay-retry] found ${snap.size} pending deletions`);

  const tasks = snap.docs.map(async (docSnap) => {
    const data = docSnap.data() ?? {};
    const liveId = docSnap.id;
    const videoUid = typeof data.recordingUid === 'string' && data.recordingUid
      ? data.recordingUid
      : typeof data.cloudflareVideoId === 'string' ? data.cloudflareVideoId : '';

    if (!videoUid) {
      await docSnap.ref.set({ replayDeletionPending: false, recordingStatus: 'deleted', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }

    try {
      await defaultCfDeleteVideo(videoUid);
      await docSnap.ref.set({
        recordingUid: FieldValue.delete(),
        cloudflareVideoId: FieldValue.delete(),
        thumbnailUrl: FieldValue.delete(),
        recordingStatus: 'deleted',
        replayDeletedAt: FieldValue.serverTimestamp(),
        replayDeletionPending: false,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`[deleteReplay-retry] deleted live=${liveId} videoUid=${videoUid}`);
    } catch (err) {
      console.error(`[deleteReplay-retry] still failing live=${liveId} videoUid=${videoUid}:`, err instanceof Error ? err.message : err);
    }
  });

  await Promise.allSettled(tasks);
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
