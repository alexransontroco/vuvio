import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
export function highlightJobRef(liveId, jobId) {
    return db.collection('highlights').doc(`${liveId}__${jobId}`);
}
export function highlightJobCollection() {
    return db.collection('highlights');
}
export async function createHighlightJob(liveId, creatorId, options) {
    const jobId = `job-${liveId}-${Date.now()}`;
    const ref = highlightJobRef(liveId, jobId);
    const metadata = {
        jobId,
        liveId,
        creatorId,
        status: 'queued',
        progress: 0,
        createdAt: FieldValue.serverTimestamp(),
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
export async function getHighlightJob(liveId, jobId) {
    const ref = highlightJobRef(liveId, jobId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new ApiError('not_found', 'Highlight job not found');
    }
    return snap.data();
}
export async function updateHighlightJobStatus(liveId, jobId, status, updates = {}) {
    const ref = highlightJobRef(liveId, jobId);
    const data = {
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
export async function cancelHighlightJob(liveId, jobId) {
    const job = await getHighlightJob(liveId, jobId);
    if (job.status === 'ready' || job.status === 'failed' || job.status === 'cancelled') {
        throw new ApiError('conflict', `Cannot cancel job with status ${job.status}`);
    }
    await updateHighlightJobStatus(liveId, jobId, 'cancelled', {
        error: 'Cancelled by user',
    });
}
