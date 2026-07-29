import type { Timestamp } from 'firebase/firestore';

export type AnalyticsEventName =
  | 'stream_impression'
  | 'stream_view_started'
  | 'stream_view_3_seconds'
  | 'stream_view_10_seconds'
  | 'stream_view_30_seconds'
  | 'stream_skipped'
  | 'stream_view_ended'
  | 'creator_profile_opened'
  | 'creator_followed'
  | 'stream_shared'
  | 'gear_panel_opened'
  | 'gear_item_opened'
  | 'gear_external_link_clicked'
  | 'comment_sent'
  | 'stream_rated'
  | 'stream_reported'
  | 'discovery_filter_applied'
  | 'search_performed'
  | 'globe_pin_clicked'
  | 'stream_quality_degraded'
  | 'app_backgrounded';

export type AnalyticsSource =
  | 'watch'
  | 'explore'
  | 'globe'
  | 'profile'
  | 'notification'
  | 'shared_link'
  | 'direct'
  | null;

export type ExitReason =
  | 'swipe'
  | 'back'
  | 'app_background'
  | 'stream_ended'
  | 'network_error'
  | 'navigation'
  | 'unknown'
  | null;

export interface AnalyticsEventInput {
  eventName: AnalyticsEventName;
  streamId?: string | null;
  creatorId?: string | null;
  gearId?: string | null;
  source?: AnalyticsSource;
  sourcePosition?: number | null;
  category?: string | null;
  environment?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsEvent extends AnalyticsEventInput {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  sessionId: string;
  viewSessionId: string | null;
  occurredAt: Timestamp;
  receivedAt: Timestamp;
}

export interface StreamViewSessionInput {
  streamId: string;
  creatorId: string;
  source: AnalyticsSource;
  sourcePosition?: number | null;
}

export interface StreamViewSession {
  id: string;
  streamId: string;
  creatorId: string;
  userId: string | null;
  anonymousId: string | null;
  sessionId: string;
  source: AnalyticsSource;
  sourcePosition: number | null;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  watchDurationSeconds: number;
  activeWatchDurationSeconds: number;
  reached3Seconds: boolean;
  reached10Seconds: boolean;
  reached30Seconds: boolean;
  skippedUnder3Seconds: boolean;
  gearOpened: boolean;
  gearItemClicks: number;
  gearExternalClicks: number;
  creatorProfileOpened: boolean;
  creatorFollowed: boolean;
  shared: boolean;
  commented: boolean;
  rated: boolean;
  reported: boolean;
  exitReason: ExitReason;
  technicalMetrics: {
    playbackStartupMs?: number;
    bufferingCount?: number;
    bufferingDurationMs?: number;
    averageBitrateKbps?: number;
    reconnectCount?: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BatchEventSubmission {
  events: AnalyticsEventInput[];
}

export interface BatchEventResponse {
  success: boolean;
  accepted: number;
  deduped: number;
  errors?: Array<{ index: number; reason: string }>;
}

export interface AnalyticsQueue {
  events: AnalyticsEventInput[];
  attempts: number;
  lastAttempt: number | null;
}
