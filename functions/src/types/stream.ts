import type { Timestamp } from 'firebase-admin/firestore';

export type StreamStatus =
  | 'draft'
  | 'preparing'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'ending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StreamEnvironment = 'land' | 'water' | 'air' | 'urban' | 'other';
export type StreamVisibility = 'public' | 'followers' | 'private';
export type NetworkStatus = 'unknown' | 'good' | 'unstable' | 'disconnected';

export interface StreamDocument {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  category: string;
  subcategories: string[];
  environment: StreamEnvironment;
  status: StreamStatus;
  visibility: StreamVisibility;
  countryCode: string | null;
  city: string | null;
  approximateLocation: { latitude: number; longitude: number; geohash?: string } | null;
  languages: string[];
  cloudflareLiveInputId: string | null;
  cloudflareUid: string | null;
  playbackUrl: string | null;
  hlsManifestUrl: string | null;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  lastHeartbeatAt: Timestamp | null;
  lastHeartbeatWriteAt?: Timestamp | null;
  durationSeconds: number;
  currentViewerCount: number;
  peakViewerCount: number;
  totalUniqueViewers: number;
  gearIds: string[];
  networkStatus: NetworkStatus;
  interruptionCount: number;
  disconnectedSeconds: number;
  moderationStatus: 'pending' | 'approved' | 'restricted' | 'blocked';
  recommendationStatus: 'eligible' | 'limited' | 'blocked';
  endReason?: string | null;
  highlightStatus?: 'ready' | 'processing' | 'failed' | null;
  highlightUrl?: string | null;
  highlightThumbnailUrl?: string | null;
  highlightDurationSeconds?: number | null;
  highlightMarkers?: Array<{ timestamp: number; source: string; score: number }>;
  recordingStatus?: 'processing' | 'available' | 'expired' | null;
  recordingExpiresAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
