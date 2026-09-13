import { getCloudflareEnv } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

interface CloudflareApiResponse {
  success?: boolean;
  result?: Record<string, unknown>;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
}

export interface CloudflareLiveInput {
  liveInputId: string | null;
  uid: string | null;
  playbackUrl: string | null;
  hlsManifestUrl: string | null;
  ingestUrl: string | null;
  webRTCUrl: string | null;
  whepUrl: string | null;
  streamKey: string | null;
  name?: string;
  connected?: boolean;
}

export interface CloudflareClient {
  createLiveInput(input: { streamId: string; title: string }): Promise<CloudflareLiveInput>;
  getLiveInput(liveInputId: string): Promise<CloudflareLiveInput>;
  deleteLiveInput(liveInputId: string): Promise<void>;
  listLiveInputs(): Promise<CloudflareLiveInput[]>;
  listVideosByLiveInput(liveInputId: string): Promise<CloudflareVideo[]>;
  ensureRecordingEnabled(liveInputId: string): Promise<boolean>;
}

export interface CloudflareVideo {
  uid: string | null;
  created: string | null;
  modified: string | null;
  duration: number | null;
  readyToStream?: boolean;
  playback?: { hls?: string };
  thumbnail?: string | null;
  status?: { state?: string; pctComplete?: string; errorReasonCode?: string; errorReasonText?: string };
  liveInput?: string | null;
}

function hlsUrl(customerCode: string, uid: string | null) {
  if (!customerCode || !uid) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

function whepUrlFor(customerCode: string, uid: string | null, webRTCPlaybackUrl: string | null, _whipUrl: string | null): string | null {
  if (webRTCPlaybackUrl) return webRTCPlaybackUrl;
  // Cloudflare WHEP viewer endpoint — correct format regardless of ingest method
  if (customerCode && uid) return `https://customer-${customerCode}.cloudflarestream.com/${uid}/webRTC/play`;
  return null;
}

function normalizeLiveInput(result: Record<string, unknown>, customerCode: string): CloudflareLiveInput {
  const uid = String(result.uid ?? result.id ?? '') || null;
  const rtmps = result.rtmps as Record<string, unknown> | undefined;
  const srt = result.srt as Record<string, unknown> | undefined;
  const webRTC = result.webRTC as Record<string, unknown> | undefined;
  const webRTCPlayback = result.webRTCPlayback as Record<string, unknown> | undefined;
  const playback = result.playback as Record<string, unknown> | undefined;
  const playbackHls = typeof playback?.hls === 'string' ? playback.hls : null;
  const meta = result.meta as Record<string, unknown> | undefined;
  const name = typeof meta?.name === 'string' ? meta.name : typeof result.name === 'string' ? result.name : 'Untitled';
  const connected = result.connected === true || result.status === 'connected';

  // Ingest credentials — only returned on creation, not in list/get responses
  const ingestUrl = typeof rtmps?.url === 'string' ? rtmps.url : typeof srt?.url === 'string' ? srt.url : null;
  // Prefer webRTC stream key, fall back to RTMP key
  const streamKey = typeof webRTC?.streamKey === 'string' ? webRTC.streamKey
    : typeof rtmps?.streamKey === 'string' ? rtmps.streamKey
    : typeof srt?.streamId === 'string' ? srt.streamId : null;

  // WHIP URL: use webRTC.url from Cloudflare, or construct from RTMPS stream key (same key, different protocol)
  const webRTCUrl = typeof webRTC?.url === 'string' ? webRTC.url : null;

  const whepUrl = whepUrlFor(customerCode, uid, typeof webRTCPlayback?.url === 'string' ? webRTCPlayback.url : null, webRTCUrl);

  console.log(`[CLOUDFLARE] live input ${uid} — webRTCUrl: ${webRTCUrl ?? 'MISSING'} | whepUrl: ${whepUrl ?? 'none'} | streamKey: ${streamKey ? 'present' : 'MISSING'} | keys in result: ${Object.keys(result).join(',')}`);
  if (!webRTC) console.warn(`[CLOUDFLARE] webRTC field missing from Cloudflare response — constructed WHIP URL from streamKey: ${!!streamKey}`);

  return {
    liveInputId: uid,
    uid,
    playbackUrl: playbackHls ?? hlsUrl(customerCode, uid),
    hlsManifestUrl: playbackHls ?? hlsUrl(customerCode, uid),
    ingestUrl,
    webRTCUrl,
    whepUrl,
    streamKey,
    name,
    connected,
  };
}

export function createCloudflareClient(): CloudflareClient {
  const env = getCloudflareEnv();
  const configured = Boolean(env.accountId && env.apiToken);

  async function request(path: string, init: RequestInit = {}) {
    if (!configured) {
      console.warn('[cloudflare] Cloudflare secrets are not configured.');
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.apiToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      const body = await response.json().catch(() => ({})) as CloudflareApiResponse;
      if (!response.ok || body?.success === false) {
        console.error('[cloudflare] Request failed', { status: response.status, path, errors: body?.errors });
        throw new ApiError('server_error', 'Cloudflare Stream request failed');
      }
      return body?.result as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error('[cloudflare] Request error', error instanceof Error ? error.message : error);
      throw new ApiError('server_error', 'Cloudflare Stream request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  const nullInput: CloudflareLiveInput = {
    liveInputId: null, uid: null, playbackUrl: null, hlsManifestUrl: null,
    ingestUrl: null, webRTCUrl: null, whepUrl: null, streamKey: null,
  };

  return {
    async createLiveInput(input) {
      const payload = {
        meta: { name: input.title, streamId: input.streamId },
        recording: { mode: 'automatic', requireSignedURLs: false, allowedOrigins: [], timeoutSeconds: 10 },
        preferLowLatency: false,
      };

      const url = `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream/live_inputs`;
      console.log('[cloudflare] createLiveInput URL:', url.replace(env.accountId, '[accountId]'));
      console.log('[cloudflare] createLiveInput body:', JSON.stringify(payload));

      // Raw fetch so we can log success/errors/messages before the wrapper strips them
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      let httpStatus = 0;
      let rawBody: CloudflareApiResponse = {};
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${env.apiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        httpStatus = response.status;
        rawBody = await response.json().catch(() => ({})) as CloudflareApiResponse;
      } finally {
        clearTimeout(t);
      }

      const result = rawBody.result as Record<string, unknown> | undefined;
      const postRecording = result?.recording as Record<string, unknown> | undefined;
      console.log(`[cloudflare] createLiveInput HTTP ${httpStatus} | success=${rawBody.success}`);
      console.log(`[cloudflare] createLiveInput errors:`, JSON.stringify(rawBody.errors ?? []));
      console.log(`[cloudflare] createLiveInput messages:`, JSON.stringify(rawBody.messages ?? []));
      console.log(`[cloudflare] createLiveInput result.uid=${result?.uid} | result.recording=${JSON.stringify(postRecording)}`);

      if (!rawBody.success || httpStatus < 200 || httpStatus >= 300 || !result) {
        throw new ApiError('server_error', `Cloudflare createLiveInput failed (HTTP ${httpStatus}): ${JSON.stringify(rawBody.errors)}`);
      }

      const uid = typeof result.uid === 'string' ? result.uid : null;

      if (uid) {
        try {
          const verify = await request(`/live_inputs/${uid}`, { method: 'GET' });
          const vRec = verify?.recording as Record<string, unknown> | undefined;
          const vPlayback = verify?.playback as Record<string, unknown> | undefined;
          console.log(`[CLOUDFLARE VERIFY] uid=${uid} | recording.mode=${vRec?.mode ?? 'MISSING'} | playback.hls=${vPlayback?.hls ?? 'MISSING'}`);
        } catch (e) {
          console.error('[CLOUDFLARE VERIFY] GET failed:', e instanceof Error ? e.message : e);
        }
      }

      return normalizeLiveInput(result, env.customerCode);
    },

    async getLiveInput(liveInputId) {
      const result = await request(`/live_inputs/${encodeURIComponent(liveInputId)}`, { method: 'GET' });
      if (!result) throw new ApiError('not_found', 'Cloudflare live input not found');
      return normalizeLiveInput(result, env.customerCode);
    },

    async deleteLiveInput(liveInputId) {
      await request(`/live_inputs/${encodeURIComponent(liveInputId)}`, { method: 'DELETE' });
    },

    async listLiveInputs() {
      const result = await request('/live_inputs', { method: 'GET' });
      if (!result || !Array.isArray(result)) return [];
      return result.map((item) => normalizeLiveInput(item as Record<string, unknown>, env.customerCode));
    },

    async listVideosByLiveInput(liveInputId) {
      const result = await request(`/live_inputs/${encodeURIComponent(liveInputId)}/videos`, { method: 'GET' });
      if (!result || !Array.isArray(result)) return [];
      return result.map((item: Record<string, unknown>) => ({
        uid: typeof item.uid === 'string' ? item.uid : null,
        created: typeof item.created === 'string' ? item.created : null,
        modified: typeof item.modified === 'string' ? item.modified : null,
        duration: typeof item.duration === 'number' ? item.duration : typeof item.duration === 'string' ? Number(item.duration) : null,
        readyToStream: item.readyToStream === true,
        playback: item.playback && typeof item.playback === 'object' ? item.playback as { hls?: string } : undefined,
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : null,
        status: item.status && typeof item.status === 'object' ? item.status as CloudflareVideo['status'] : undefined,
        liveInput: typeof item.liveInput === 'string' ? item.liveInput : null,
      }));
    },

    async ensureRecordingEnabled(liveInputId) {
      try {
        // Always PUT to activate the HLS pipeline — dashboard "Save" triggers this even when
        // recording.mode is already automatic; API create alone does not provision HLS output.
        const updated = await request(`/live_inputs/${encodeURIComponent(liveInputId)}`, {
          method: 'PUT',
          body: JSON.stringify({ recording: { mode: 'automatic', requireSignedURLs: false, allowedOrigins: [], timeoutSeconds: 10 }, preferLowLatency: true }),
        });
        const newMode = (updated?.recording as Record<string, unknown> | undefined)?.mode;
        const playback = updated?.playback as Record<string, unknown> | undefined;
        console.log(`[cloudflare] ensureRecordingEnabled — liveInputId=${liveInputId} mode=${newMode ?? 'MISSING'} playback.hls=${playback?.hls ?? 'MISSING'}`);
        return newMode === 'automatic';
      } catch (err) {
        console.error('[cloudflare] ensureRecordingEnabled failed:', err instanceof Error ? err.message : err);
        return false;
      }
    },
  };
}

export async function listLiveInputs(): Promise<CloudflareLiveInput[]> {
  return createCloudflareClient().listLiveInputs();
}

export async function createLiveInput(input: { name: string; description?: string }): Promise<CloudflareLiveInput> {
  return createCloudflareClient().createLiveInput({ streamId: input.name, title: input.name });
}
