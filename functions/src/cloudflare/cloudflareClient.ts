import { getCloudflareEnv } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

interface CloudflareApiResponse {
  success?: boolean;
  result?: Record<string, unknown>;
  errors?: Array<{ code: number; message: string }>;
}

export interface CloudflareLiveInput {
  liveInputId: string | null;
  uid: string | null;
  playbackUrl: string | null;
  hlsManifestUrl: string | null;
  ingestUrl: string | null;
  streamKey: string | null;
  name?: string;
  connected?: boolean;
}

export interface CloudflareClient {
  createLiveInput(input: { streamId: string; title: string }): Promise<CloudflareLiveInput>;
  getLiveInput(liveInputId: string): Promise<CloudflareLiveInput>;
  deleteLiveInput(liveInputId: string): Promise<void>;
  listLiveInputs(): Promise<CloudflareLiveInput[]>;
}

function hlsUrl(customerCode: string, uid: string | null) {
  if (!customerCode || !uid) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

function normalizeLiveInput(result: Record<string, unknown>, customerCode: string): CloudflareLiveInput {
  const uid = String(result.uid ?? result.id ?? '') || null;
  const rtmps = result.rtmps as Record<string, unknown> | undefined;
  const srt = result.srt as Record<string, unknown> | undefined;
  const webRTC = result.webRTC as Record<string, unknown> | undefined;
  const playback = result.playback as Record<string, unknown> | undefined;
  const playbackHls = typeof playback?.hls === 'string' ? playback.hls : null;
  const meta = result.meta as Record<string, unknown> | undefined;
  const name = typeof meta?.name === 'string' ? meta.name : typeof result.name === 'string' ? result.name : 'Untitled';
  const connected = (result.connected === true || result.status === 'connected');

  // Stream credentials are only returned on creation, not in list/get responses
  const ingestUrl = typeof rtmps?.url === 'string' ? rtmps.url : typeof srt?.url === 'string' ? srt.url : typeof webRTC?.url === 'string' ? webRTC.url : null;
  const streamKey = typeof rtmps?.streamKey === 'string' ? rtmps.streamKey : typeof srt?.streamId === 'string' ? srt.streamId : null;

  return {
    liveInputId: uid,
    uid,
    playbackUrl: playbackHls ?? hlsUrl(customerCode, uid),
    hlsManifestUrl: playbackHls ?? hlsUrl(customerCode, uid),
    ingestUrl,
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
      console.warn('[cloudflare] Cloudflare secrets are not configured. Using null live input response.');
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
        console.error('[cloudflare] Request failed', { status: response.status, path });
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

  return {
    async createLiveInput(input) {
      const result = await request('/live_inputs', {
        method: 'POST',
        body: JSON.stringify({
          meta: { name: input.title, streamId: input.streamId },
          recording: { mode: 'off' },
        }),
      });

      if (!result) {
        return {
          liveInputId: null,
          uid: null,
          playbackUrl: null,
          hlsManifestUrl: null,
          ingestUrl: null,
          streamKey: null,
        };
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
      if (result[0]) {
        console.log('[cloudflare] Keys:', Object.keys(result[0]).join(', '));
        console.log('[cloudflare] uid:', result[0].uid, '| rtmps:', result[0].rtmps, '| srt:', result[0].srt);
      }
      return result.map(item => normalizeLiveInput(item, env.customerCode));
    },
  };
}

export async function listLiveInputs(): Promise<CloudflareLiveInput[]> {
  const client = createCloudflareClient();
  return client.listLiveInputs();
}

export async function createLiveInput(input: { name: string; description?: string }): Promise<CloudflareLiveInput> {
  const client = createCloudflareClient();
  return client.createLiveInput({
    streamId: input.name,
    title: input.name,
  });
}
