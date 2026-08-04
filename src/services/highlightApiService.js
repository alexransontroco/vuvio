/**
 * Highlight API Service
 *
 * Client-side service for communicating with backend highlight generation.
 * Handles job queuing, status polling, and error recovery.
 */

const POLL_INTERVAL_MS = 2000; // Poll every 2s
const MAX_POLL_ATTEMPTS = 600; // Max 20 minutes
const HIGHLIGHT_GENERATION_TIMEOUT_MS = 20 * 60 * 1000; // 20 minute timeout

/**
 * Request highlight generation from backend
 * Backend will:
 * 1. Fetch recording from Cloudflare
 * 2. Extract segments using highlightMarkers
 * 3. Assemble with transitions
 * 4. Return clip URL
 */
export async function requestHighlightGeneration(liveId, options = {}) {
  if (!liveId) throw new Error('Live ID required');

  try {
    const token = await getAuthToken();

    const response = await fetch(`/api/lives/${liveId}/highlight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({
        // Pass options like customSegments, musicTrack, etc.
        ...options,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[highlightApiService] Job queued:', data.jobId);

    return {
      jobId: data.jobId,
      status: data.status, // queued
    };
  } catch (err) {
    console.error('[highlightApiService] Request failed:', err);
    throw err;
  }
}

/**
 * Poll for highlight generation status
 * Returns: { status, progress, url?, error? }
 */
export async function pollHighlightStatus(liveId, jobId) {
  if (!liveId || !jobId) throw new Error('Live ID and Job ID required');

  let attempts = 0;
  const startTime = Date.now();

  while (attempts < MAX_POLL_ATTEMPTS) {
    try {
      const token = await getAuthToken();

      const response = await fetch(
        `/api/lives/${liveId}/highlight-status?jobId=${jobId}`,
        {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Status ready - return URL
      if (data.status === 'ready') {
        console.log('[highlightApiService] Highlight ready:', {
          jobId,
          url: data.url,
          duration: data.durationSeconds,
        });
        return {
          status: 'ready',
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          durationSeconds: data.durationSeconds,
        };
      }

      // Status failed
      if (data.status === 'failed') {
        throw new Error(data.error || 'Highlight generation failed');
      }

      // Still processing
      console.log(`[highlightApiService] Status: ${data.status} (${data.progress}%)`);

      return {
        status: data.status, // processing, queued
        progress: data.progress,
      };
    } catch (err) {
      console.error('[highlightApiService] Poll error:', err);

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > HIGHLIGHT_GENERATION_TIMEOUT_MS) {
        throw new Error('Highlight generation timeout (20 min)');
      }

      // Return error but let caller decide to retry
      throw err;
    } finally {
      attempts++;
    }
  }

  throw new Error('Max poll attempts exceeded');
}

/**
 * Get highlight status with automatic polling
 * Polls until ready or error
 */
export async function waitForHighlight(liveId, jobId, onProgress) {
  let lastStatus = null;

  const poll = async () => {
    try {
      const result = await pollHighlightStatus(liveId, jobId);

      // Progress update
      if (result.status === 'processing' || result.status === 'queued') {
        onProgress?.({ status: result.status, progress: result.progress });
        lastStatus = result;

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        return poll();
      }

      // Ready
      return result;
    } catch (err) {
      if (lastStatus?.status === 'failed') {
        return { status: 'failed', error: err.message };
      }
      throw err;
    }
  };

  return poll();
}

/**
 * Cancel highlight generation job
 */
export async function cancelHighlight(liveId, jobId) {
  if (!liveId || !jobId) throw new Error('Live ID and Job ID required');

  try {
    const token = await getAuthToken();

    const response = await fetch(`/api/lives/${liveId}/highlight/${jobId}`, {
      method: 'DELETE',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[highlightApiService] Highlight cancelled:', jobId);
  } catch (err) {
    console.error('[highlightApiService] Cancel failed:', err);
    throw err;
  }
}

/**
 * Get auth token from Firebase
 */
async function getAuthToken() {
  try {
    const auth = (await import('../firebase.js')).auth;
    return auth.currentUser?.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Test endpoint connectivity
 */
export async function testHighlightApi() {
  try {
    const response = await fetch('/api/highlight-config');
    if (!response.ok) return false;
    return true;
  } catch {
    return false;
  }
}
