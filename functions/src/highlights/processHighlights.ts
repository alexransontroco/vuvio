import { db } from '../shared/firestore.js';
import { updateHighlightJobStatus, getHighlightJob } from './highlightHelpers.js';
import { generateHighlight } from './generateHighlight.js';
import type { StreamDocument } from '../types/stream.js';
import type { HighlightJobMetadata } from '../types/highlight.js';

const MAX_CONCURRENT_JOBS = 3;
const MAX_JOB_DURATION_MS = 20 * 60 * 1000; // 20 minutes

export async function processHighlights() {
  try {
    console.log('[highlight-scheduler] Starting highlight job processing');

    // Get queued jobs
    const queuedSnap = await db.collection('highlights')
      .where('status', '==', 'queued')
      .orderBy('createdAt', 'asc')
      .limit(MAX_CONCURRENT_JOBS)
      .get();

    console.log(`[highlight-scheduler] Found ${queuedSnap.size} queued jobs`);

    for (const jobDoc of queuedSnap.docs) {
      const job = jobDoc.data() as HighlightJobMetadata;
      await processHighlightJob(job.liveId, job.jobId);
    }

    // Also update stale processing jobs to failed
    const processingSnap = await db.collection('highlights')
      .where('status', '==', 'processing')
      .get();

    const now = Date.now();
    for (const jobDoc of processingSnap.docs) {
      const job = jobDoc.data() as HighlightJobMetadata;
      const startedMs = (job.startedAt as any)?.toMillis?.() || 0;
      const elapsedMs = now - startedMs;

      if (elapsedMs > MAX_JOB_DURATION_MS) {
        console.warn(`[highlight-scheduler] Job ${job.jobId} timeout after ${elapsedMs}ms`);
        await updateHighlightJobStatus(job.liveId, job.jobId, 'failed', {
          error: 'Job timeout (exceeded 20 minutes)',
        });
      }
    }
  } catch (error) {
    console.error('[highlight-scheduler] Error:', error instanceof Error ? error.message : error);
  }
}

async function processHighlightJob(liveId: string, jobId: string) {
  let job: HighlightJobMetadata;

  try {
    job = await getHighlightJob(liveId, jobId);
  } catch (error) {
    console.error(`[highlight] Failed to get job ${jobId}:`, error);
    return;
  }

  try {
    // Update to processing
    await updateHighlightJobStatus(liveId, jobId, 'processing', {
      progress: 0,
    });

    // Get stream data
    const streamSnap = await db.collection('activeLives').doc(liveId).get();
    if (!streamSnap.exists) {
      throw new Error('Stream not found');
    }

    const stream = streamSnap.data() as StreamDocument;

    // Get creator markers if needed
    let creatorMarkers: Array<{ timestamp: number; score: number }> = [];
    if (job.useCreatorMarkers && stream.highlightMarkers) {
      creatorMarkers = stream.highlightMarkers;
    }

    console.log(`[highlight] Processing job ${jobId} for live ${liveId}`);

    // Generate the highlight
    const result = await generateHighlight(
      liveId,
      jobId,
      stream,
      job.useCreatorMarkers,
      creatorMarkers
    );

    // Update job to ready
    await updateHighlightJobStatus(liveId, jobId, 'ready', {
      progress: 100,
      resultUrl: result.url,
      resultThumbnailUrl: result.thumbnailUrl,
      resultDurationSeconds: result.durationSeconds,
    });

    // Update stream document with highlight info
    await db.collection('activeLives').doc(liveId).update({
      highlightStatus: 'ready',
      highlightUrl: result.url,
      highlightThumbnailUrl: result.thumbnailUrl,
      highlightDurationSeconds: result.durationSeconds,
    });

    console.log(`[highlight] Job ${jobId} completed successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[highlight] Job ${jobId} failed:`, message);

    try {
      await updateHighlightJobStatus(liveId, jobId, 'failed', {
        error: message,
      });
    } catch (updateError) {
      console.error(`[highlight] Failed to update job status:`, updateError);
    }
  }
}
