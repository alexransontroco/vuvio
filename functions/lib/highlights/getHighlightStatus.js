import { authenticateUser } from '../middleware/authenticateUser.js';
import { getHighlightJob } from './highlightHelpers.js';
import { ApiError } from '../shared/errors.js';
export async function getHighlightStatus(req, res, liveId) {
    const user = await authenticateUser(req);
    // Get jobId from query param
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : null;
    if (!jobId) {
        throw new ApiError('bad_request', 'jobId query parameter required');
    }
    // Get job metadata
    const job = await getHighlightJob(liveId, jobId);
    // Check authorization: user must be the creator
    if (job.creatorId !== user.uid) {
        throw new ApiError('forbidden', 'Not authorized to view this job');
    }
    // Build response based on status
    const response = {
        status: job.status,
    };
    if (job.status === 'processing' || job.status === 'queued') {
        response.progress = job.progress;
    }
    if (job.status === 'ready') {
        response.url = job.resultUrl;
        response.thumbnailUrl = job.resultThumbnailUrl;
        response.durationSeconds = job.resultDurationSeconds;
    }
    if (job.status === 'failed') {
        response.error = job.error;
    }
    res.json(response);
}
