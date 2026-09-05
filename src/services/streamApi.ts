import { auth } from '../firebase.js';

type ApiOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  authRequired?: boolean;
};

const API_BASE = import.meta.env.VITE_STREAM_API_BASE || '/api';

export function getStreamApiBase() {
  return API_BASE;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const token = await auth.currentUser?.getIdToken?.();
  if (options.authRequired !== false) {
    if (!token) throw new Error('Authentication required');
    headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Stream API request failed';
    const error = new Error(message) as Error & { code?: string; status?: number; details?: unknown };
    error.code = data.code;
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data as T;
}

export type CreateStreamInput = {
  title: string;
  description?: string;
  category: string;
  subcategories?: string[];
  environment: 'land' | 'water' | 'air' | 'urban' | 'other';
  visibility?: 'public' | 'followers' | 'private';
  city?: string;
  countryCode?: string;
  approximateLocation?: { latitude: number; longitude: number };
  languages?: string[];
  gearIds?: string[];
};

export function createStream(input: CreateStreamInput) {
  return apiRequest<{ stream: { id: string; status: string; playbackUrl: string | null; hlsManifestUrl: string | null }; ingest: { url: string | null; streamKey: string | null } }>('/streams', {
    method: 'POST',
    body: input,
  });
}

export function startStream(streamId: string) {
  return apiRequest<{ stream: { id: string; status: string } }>(`/streams/${encodeURIComponent(streamId)}/start`, { method: 'POST', body: {} });
}

export function sendStreamHeartbeat(streamId: string, input: { networkStatus?: 'good' | 'unstable'; viewerCount?: number; bitrateKbps?: number } = {}) {
  return apiRequest<{ stream: { id: string; status: string; networkStatus: string }; skippedWrite: boolean }>(`/streams/${encodeURIComponent(streamId)}/heartbeat`, {
    method: 'POST',
    body: input,
  });
}

export function endStream(streamId: string, reason: 'creator_ended' | 'heartbeat_timeout' | 'cloudflare_ended' | 'error' = 'creator_ended') {
  return apiRequest<{ stream: { id: string; status: string; durationSeconds: number }; alreadyEnded: boolean }>(`/streams/${encodeURIComponent(streamId)}/end`, {
    method: 'POST',
    body: { reason },
  });
}

export function attachGearToStream(streamId: string, gearIds: string[]) {
  return apiRequest<{ stream: { id: string; gearIds: string[] } }>(`/streams/${encodeURIComponent(streamId)}/gear`, {
    method: 'POST',
    body: { gearIds },
  });
}

export function getStreamGear(streamId: string) {
  return apiRequest<{ gear: unknown[] }>(`/streams/${encodeURIComponent(streamId)}/gear`, { authRequired: false });
}

export function trackStreamEvent(streamId: string, input: { type: string; eventId?: string; anonymousSessionId?: string; source?: 'watch' | 'explore' | 'globe' | 'profile' | 'direct'; metadata?: Record<string, unknown> }) {
  return apiRequest<{ accepted: boolean; deduped: boolean }>(`/streams/${encodeURIComponent(streamId)}/events`, {
    method: 'POST',
    authRequired: false,
    body: input,
  });
}

export function getStream(streamId: string) {
  return apiRequest<{ stream: unknown }>(`/streams/${encodeURIComponent(streamId)}`, { authRequired: false });
}

export function getLiveStreams(filters: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return apiRequest<{ streams: unknown[]; nextCursor: string | null }>(`/streams/live${params.size ? `?${params}` : ''}`, { authRequired: false });
}

export function getGlobeStreams() {
  return apiRequest<{ streams: unknown[] }>('/globe/streams', { authRequired: false });
}

export const finishStream = endStream;
