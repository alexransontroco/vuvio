import type { Timestamp } from 'firebase-admin/firestore';

export type HighlightJobStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';

export interface HighlightJobMetadata {
  jobId: string;
  liveId: string;
  creatorId: string;
  status: HighlightJobStatus;
  progress: number; // 0-100
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  resultUrl: string | null;
  resultThumbnailUrl: string | null;
  resultDurationSeconds: number | null;
  error: string | null;
  useCreatorMarkers: boolean;
  customSegments: Array<{ start: number; duration: number }> | null;
}

export interface HighlightRequest {
  useCreatorMarkers?: boolean;
  customSegments?: Array<{ start: number; duration: number }>;
}
