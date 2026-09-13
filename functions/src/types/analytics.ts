import type { Timestamp } from 'firebase-admin/firestore';

export const allowedAnalyticsEvents = [
  'stream_impression',
  'viewer_joined',
  'viewer_left',
  'view_10_seconds',
  'view_30_seconds',
  'stream_skipped',
  'follow_creator',
  'share',
  'gear_opened',
  'gear_clicked',
  'comment_sent',
  'report_submitted',
] as const;

export type AnalyticsEventType = typeof allowedAnalyticsEvents[number];
export type StreamEventSource = 'watch' | 'explore' | 'globe' | 'profile' | 'direct';

export interface StreamEventDocument {
  type: AnalyticsEventType | 'stream_created' | 'stream_scheduled' | 'stream_activated' | 'stream_started' | 'heartbeat' | 'connection_lost' | 'connection_restored' | 'stream_ended';
  userId: string | null;
  anonymousSessionId: string | null;
  source: StreamEventSource | null;
  metadata: Record<string, unknown>;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}
