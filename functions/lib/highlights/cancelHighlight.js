import { authenticateUser } from '../middleware/authenticateUser.js';
import { cancelHighlightJob, getHighlightJob } from './highlightHelpers.js';
import { ApiError } from '../shared/errors.js';
export async function cancelHighlight(req, res, liveId, jobId) {
    const user = await authenticateUser(req);
    // Get job to check authorization
    const job = await getHighlightJob(liveId, jobId);
    if (job.creatorId !== user.uid) {
        throw new ApiError('forbidden', 'Not authorized to cancel this job');
    }
    // Cancel the job
    await cancelHighlightJob(liveId, jobId);
    console.log(`[highlight] Job cancelled: ${jobId}`);
    res.json({
        status: 'cancelled',
    });
}
