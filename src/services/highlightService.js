/**
 * Highlight Service
 *
 * MVP implementation for generating highlight clips from live recordings.
 * Currently uses mock mode for testing without real Cloudflare/video processing.
 *
 * Future: Replace mock generation with real Cloudflare Stream clip API
 */

const HIGHLIGHT_DURATION_SECONDS = 30;
const MOCK_HIGHLIGHT_URL = 'https://example.com/sample-highlight.mp4'; // Placeholder

/**
 * Generate a mock highlight (MVP mode)
 * In production, this would:
 * 1. Fetch the full recording from Cloudflare Stream
 * 2. Analyze timestamps using highlightMarkers
 * 3. Extract best moments using Cloudflare Clip API
 * 4. Concatenate clips with transitions
 * 5. Return actual video URL
 */
export function generateHighlightMock(liveData) {
  if (!liveData) {
    return {
      url: MOCK_HIGHLIGHT_URL,
      thumbnailUrl: '/assets/icons/icon-192.png',
      durationSeconds: HIGHLIGHT_DURATION_SECONDS,
    };
  }

  // In mock mode, use live thumbnail as highlight thumbnail
  const thumbnailUrl = liveData.image || liveData.thumbnailUrl || '/assets/icons/icon-192.png';

  // Simulate real scenarios
  let highlight = {
    thumbnailUrl,
    durationSeconds: HIGHLIGHT_DURATION_SECONDS,
  };

  // If highlight markers exist, indicate they were used
  if (liveData.highlightMarkers?.length > 0) {
    console.log('[highlightService] Using highlight markers:', liveData.highlightMarkers);
    // In real implementation, these markers would guide clip selection
  }

  // Mock URL - in production, Cloudflare would provide actual video
  // This would be a signed URL pointing to the generated clip
  highlight.url = createMockHighlightUrl(liveData.id);

  return highlight;
}

/**
 * Create a mock highlight URL for testing
 *
 * In production, this returns an actual video URL from Cloudflare Stream:
 * Example: https://customer.cloudflarestream.com/{recording-id}/clip/download
 */
function createMockHighlightUrl(liveId) {
  // Return a data URL with simple animated SVG as fallback
  // In real implementation, this is a Cloudflare Stream video URL
  const mockVideoUrl = `https://vuvio.local/api/mock-highlight/${liveId}.mp4`;
  return mockVideoUrl;
}

/**
 * Select best moments from a live stream using markers and activity data
 *
 * MVP: Simple rule-based selection
 * - Start: 30s after stream start (skip setup)
 * - Middle: Peak viewer count timestamp
 * - End: 30s before stream end
 *
 * Future: ML-based moment detection using:
 * - Viewer spike analysis
 * - Chat sentiment analysis
 * - Movement/action detection from video
 * - Creator-placed markers
 */
export function selectHighlightMoments(liveData) {
  const durationSeconds = liveData.durationSeconds || 3600;

  const moments = [];

  // Opening: 30-90 seconds in (skip first 30s of setup)
  if (durationSeconds > 90) {
    moments.push({
      startSecond: 30,
      endSecond: 90,
      reason: 'opening',
      weight: 0.6,
    });
  }

  // Peak: Find highest viewer count period
  const peakViewerSecond = Math.floor(durationSeconds * 0.4); // Approximate at 40%
  if (durationSeconds > peakViewerSecond + 60) {
    moments.push({
      startSecond: Math.max(0, peakViewerSecond - 30),
      endSecond: Math.min(durationSeconds, peakViewerSecond + 30),
      reason: 'peak_viewers',
      weight: 1.0,
    });
  }

  // Closing: Last 60 seconds
  if (durationSeconds > 60) {
    moments.push({
      startSecond: Math.max(0, durationSeconds - 90),
      endSecond: durationSeconds,
      reason: 'closing',
      weight: 0.7,
    });
  }

  // Creator markers (if any)
  if (liveData.highlightMarkers?.length > 0) {
    liveData.highlightMarkers
      .filter((m) => m.source === 'creator')
      .forEach((marker) => {
        moments.push({
          startSecond: Math.max(0, marker.timestamp - 15),
          endSecond: Math.min(durationSeconds, marker.timestamp + 15),
          reason: 'creator_marked',
          weight: marker.score || 0.8,
        });
      });
  }

  return moments.sort((a, b) => b.weight - a.weight);
}

/**
 * Calculate highlight clip segments for MVP
 *
 * Returns 2-3 clips that total ~30 seconds with simple transitions
 */
export function calculateHighlightSegments(liveData, targetDuration = 30) {
  const moments = selectHighlightMoments(liveData);
  if (moments.length === 0) {
    return [];
  }

  const segments = [];
  let totalDuration = 0;

  // Take top 3 moments
  for (let i = 0; i < Math.min(3, moments.length); i++) {
    const moment = moments[i];
    const segmentDuration = Math.min(15, moment.endSecond - moment.startSecond);

    if (totalDuration + segmentDuration > targetDuration) {
      break;
    }

    segments.push({
      startSecond: moment.startSecond,
      durationSeconds: segmentDuration,
      transitionMs: 200,
    });

    totalDuration += segmentDuration;
  }

  return segments;
}

/**
 * Check if live is long enough for a meaningful highlight
 */
export function canGenerateHighlight(liveData) {
  const minDuration = 60; // At least 1 minute
  const duration = liveData.durationSeconds || 0;
  return duration >= minDuration;
}

/**
 * Create error-safe highlight request
 * Prevents duplicate generation jobs
 */
export async function requestHighlightGeneration(liveId) {
  if (!liveId) throw new Error('Live ID required');

  // In production, this calls backend:
  // POST /api/lives/{liveId}/highlight
  //
  // Backend should:
  // - Verify request is from live creator
  // - Check live status is ended
  // - Check if generation already in progress
  // - Queue job (idempotent)
  // - Return job status

  return {
    jobId: `job-${liveId}-${Date.now()}`,
    status: 'queued',
  };
}

/**
 * Poll for highlight generation status
 */
export async function getHighlightStatus(liveId) {
  if (!liveId) throw new Error('Live ID required');

  // In production: GET /api/lives/{liveId}/highlight-status
  return {
    status: 'processing', // or: ready, failed, not_requested
    progress: 50,
    url: null,
  };
}

export const RECORDING_EXPIRY_HOURS = 24;

/**
 * Calculate when recording expires
 */
export function getRecordingExpiryTime(recordingStartTime) {
  const expiryMs = recordingStartTime + (RECORDING_EXPIRY_HOURS * 60 * 60 * 1000);
  return new Date(expiryMs);
}

export function getTimeUntilExpiry(recordingExpiryTime) {
  const now = new Date();
  const ms = recordingExpiryTime - now;
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  return hours;
}
