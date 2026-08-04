import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import type { HighlightJobMetadata, HighlightJobStatus } from '../types/highlight.js';

export function highlightJobRef(liveId: string, jobId: string) {
  return db.collection('highlights').doc(`${liveId}__${jobId}`);
}

export function highlightJobCollection() {
  return db.collection('highlights');
}

export async function createHighlightJob(
  liveId: string,
  creatorId: string,
  options: { useCreatorMarkers?: boolean; customSegments?: Array<{ start: number; duration: number }> }
): Promise<string> {
  const jobId = `job-${liveId}-${Date.now()}`;
  const ref = highlightJobRef(liveId, jobId);

  const metadata: HighlightJobMetadata = {
    jobId,
    liveId,
    creatorId,
    status: 'queued',
    progress: 0,
    createdAt: FieldValue.serverTimestamp() as unknown as any,
    startedAt: null,
    completedAt: null,
    resultUrl: null,
    resultThumbnailUrl: null,
    resultDurationSeconds: null,
    error: null,
    useCreatorMarkers: options.useCreatorMarkers ?? false,
    customSegments: options.customSegments ?? null,
  };

  await ref.set(metadata);
  return jobId;
}

export async function getHighlightJob(liveId: string, jobId: string): Promise<HighlightJobMetadata> {
  const ref = highlightJobRef(liveId, jobId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new ApiError('not_found', 'Highlight job not found');
  }
  return snap.data() as HighlightJobMetadata;
}

export async function updateHighlightJobStatus(
  liveId: string,
  jobId: string,
  status: HighlightJobStatus,
  updates: Partial<HighlightJobMetadata> = {}
): Promise<void> {
  const ref = highlightJobRef(liveId, jobId);
  const data: any = {
    status,
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (status === 'processing' && !updates.startedAt) {
    data.startedAt = FieldValue.serverTimestamp();
  }
  if ((status === 'ready' || status === 'failed' || status === 'cancelled') && !updates.completedAt) {
    data.completedAt = FieldValue.serverTimestamp();
  }

  await ref.update(data);
}

export async function cancelHighlightJob(liveId: string, jobId: string): Promise<void> {
  const job = await getHighlightJob(liveId, jobId);
  if (job.status === 'ready' || job.status === 'failed' || job.status === 'cancelled') {
    throw new ApiError('conflict', `Cannot cancel job with status ${job.status}`);
  }
  await updateHighlightJobStatus(liveId, jobId, 'cancelled', {
    error: 'Cancelled by user',
  });
}
