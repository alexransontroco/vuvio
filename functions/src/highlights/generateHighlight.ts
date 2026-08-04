import type { StreamDocument } from '../types/stream.js';
import { updateHighlightJobStatus } from './highlightHelpers.js';
import { getCloudflareEnv } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

interface ClipSegment {
  start: number;
  duration: number;
}

interface ClipResult {
  clipUrl: string;
  duration: number;
}

async function callCloudflareClipApi(
  recordingId: string,
  startSecond: number,
  durationSeconds: number
): Promise<ClipResult> {
  const env = getCloudflareEnv();
  if (!env.accountId || !env.apiToken) {
    throw new ApiError('server_error', 'Cloudflare credentials not configured');
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream/${recordingId}/clip`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clippingStartTimeSeconds: startSecond,
          clippingEndTimeSeconds: startSecond + durationSeconds,
        }),
      }
    );

    const data = (await response.json()) as any;
    if (!response.ok || data?.success === false) {
      console.error('[highlight] Clip creation failed', { status: response.status, recordingId });
      throw new ApiError('server_error', 'Failed to create clip');
    }

    const result = data.result as any;
    return {
      clipUrl: result.playback?.hls || result.url,
      duration: durationSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[highlight] Clip API error:', error instanceof Error ? error.message : error);
    throw new ApiError('server_error', 'Cloudflare clip API failed');
  }
}

function selectDefaultSegments(durationSeconds: number): ClipSegment[] {
  // Opening: 30-90 seconds into stream
  // Peak: ~40% into stream
  // Closing: Last 60 seconds

  const segments: ClipSegment[] = [];

  // Opening
  if (durationSeconds > 30) {
    segments.push({
      start: Math.min(30, durationSeconds - 60),
      duration: Math.min(60, durationSeconds - 30),
    });
  }

  // Peak (~40% in)
  if (durationSeconds > 120) {
    const peakStart = Math.floor(durationSeconds * 0.4);
    segments.push({
      start: Math.max(0, peakStart - 30),
      duration: Math.min(60, durationSeconds - peakStart + 30),
    });
  }

  // Closing (last 90 seconds)
  if (durationSeconds > 60) {
    segments.push({
      start: Math.max(0, durationSeconds - 90),
      duration: Math.min(90, durationSeconds),
    });
  }

  return segments.length > 0 ? segments : [{ start: 0, duration: Math.min(60, durationSeconds) }];
}

export async function generateHighlight(
  liveId: string,
  jobId: string,
  stream: StreamDocument,
  useCreatorMarkers: boolean,
  creatorMarkers?: Array<{ timestamp: number; score: number }>
): Promise<{ url: string; thumbnailUrl: string; durationSeconds: number }> {
  try {
    // Step 1: Validate stream has recording
    if (!stream.cloudflareUid) {
      throw new ApiError('not_found', 'Recording not found for this live');
    }

    // Step 2: Get segments to extract
    const segments = useCreatorMarkers && creatorMarkers?.length
      ? creatorMarkers.map(m => ({
          start: Math.max(0, m.timestamp - 15),
          duration: 30,
        }))
      : selectDefaultSegments(stream.durationSeconds);

    console.log(`[highlight ${jobId}] Extracting ${segments.length} segments from ${stream.cloudflareUid}`);

    // Step 3: Extract clips from Cloudflare
    const clips: ClipResult[] = [];
    for (let i = 0; i < segments.length; i++) {
      await updateHighlightJobStatus(liveId, jobId, 'processing', {
        progress: Math.floor((i / segments.length) * 50),
      });

      try {
        const segment = segments[i];
        const clip = await callCloudflareClipApi(
          stream.cloudflareUid,
          segment.start,
          segment.duration
        );
        clips.push(clip);
        console.log(`[highlight ${jobId}] Clip ${i + 1} created: ${segment.start}s for ${segment.duration}s`);
      } catch (error) {
        console.error(`[highlight ${jobId}] Clip extraction failed for segment ${i}:`, error);
        // Continue with other segments
      }
    }

    if (clips.length === 0) {
      throw new ApiError('server_error', 'Failed to extract any clips from recording');
    }

    // Step 4: For now, use the first clip as the highlight
    // TODO: Implement clip assembly with transitions (requires FFmpeg or similar)
    const primaryClip = clips[0];
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);

    await updateHighlightJobStatus(liveId, jobId, 'processing', {
      progress: 90,
    });

    console.log(`[highlight ${jobId}] Generated highlight: ${clips.length} clips, ${totalDuration}s total`);

    // Return primary clip as highlight (in production, would assemble all clips)
    return {
      url: primaryClip.clipUrl,
      thumbnailUrl: `${primaryClip.clipUrl}?time=2s`, // Cloudflare supports time parameter for thumbnails
      durationSeconds: primaryClip.duration,
    };
  } catch (error) {
    const message = error instanceof ApiError
      ? error.message
      : error instanceof Error
      ? error.message
      : 'Unknown error';

    console.error(`[highlight ${jobId}] Generation failed:`, message);
    await updateHighlightJobStatus(liveId, jobId, 'failed', {
      error: message,
    });
    throw error;
  }
}
