import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { createHighlightJob } from './highlightHelpers.js';
const MIN_LIVE_DURATION = 60; // seconds
export async function requestHighlight(req, res, liveId) {
    const user = await authenticateUser(req);
    // Validate request body
    const body = req.body;
    if (!body || typeof body !== 'object') {
        throw new ApiError('bad_request', 'Request body required');
    }
    // Get stream from Firestore
    const streamRef = db.collection('activeLives').doc(liveId);
    const streamSnap = await streamRef.get();
    if (!streamSnap.exists) {
        throw new ApiError('not_found', 'Live not found');
    }
    const stream = streamSnap.data();
    // Check authorization
    if (stream.creatorId !== user.uid) {
        throw new ApiError('forbidden', 'Only the creator can generate highlights');
    }
    // Check if stream is long enough
    if (stream.durationSeconds < MIN_LIVE_DURATION) {
        throw new ApiError('bad_request', `Live must be at least ${MIN_LIVE_DURATION} seconds long`);
    }
    // Check if recording is available
    if (!stream.cloudflareUid) {
        throw new ApiError('server_error', 'Recording not available for this live');
    }
    // Check for existing in-progress job
    const existingJobsSnap = await db.collection('highlights')
        .where('liveId', '==', liveId)
        .where('status', 'in', ['queued', 'processing'])
        .limit(1)
        .get();
    if (!existingJobsSnap.empty) {
        throw new ApiError('conflict', 'Highlight generation already in progress');
    }
    // Create job
    const jobId = await createHighlightJob(liveId, user.uid, {
        useCreatorMarkers: body.useCreatorMarkers,
        customSegments: body.customSegments,
    });
    console.log(`[highlight] Job created: ${jobId} for live ${liveId}`);
    res.json({
        jobId,
        status: 'queued',
    });
}
