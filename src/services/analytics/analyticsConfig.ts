export const ANALYTICS_CONFIG = {
  QUEUE_STORAGE_KEY: 'vuvio:analytics-queue',
  SESSION_STORAGE_KEY: 'vuvio:analytics-session',
  ANONYMOUS_ID_STORAGE_KEY: 'vuvio:anonymous-id',

  BATCH_SIZE: 50,
  FLUSH_INTERVAL_MS: 30000,
  MAX_QUEUE_SIZE: 500,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 60000,

  IMPRESSION_DEBOUNCE_MS: 500,
  IMPRESSION_VISIBILITY_THRESHOLD: 0.5,

  AFFINITY_WEIGHTS: {
    impression_ignored: -0.1,
    skip_under_3s: -1,
    view_3s: 0.2,
    view_10s: 1,
    view_30s: 2,
    gear_opened: 0.5,
    profile_opened: 0.5,
    creator_followed: 4,
    stream_shared: 3,
    stream_reported: -10,
  },

  RETENTION_THRESHOLDS: {
    SKIP: 3000,
    SHORT: 10000,
    MEDIUM: 30000,
  },

  RETENTION_EVENTS: [
    'stream_view_3_seconds',
    'stream_view_10_seconds',
    'stream_view_30_seconds',
  ] as const,

  IDEMPOTENT_EVENTS: [
    'stream_view_3_seconds',
    'stream_view_10_seconds',
    'stream_view_30_seconds',
    'stream_skipped',
    'creator_followed',
    'stream_shared',
    'stream_rated',
    'stream_reported',
  ] as const,

  API_ENDPOINT: '/analytics/events',
  FALLBACK_API_ENDPOINT: 'https://api.vuvio.app/analytics/events',

  RETENTION_DURATION_DAYS: 90,
  SESSION_DURATION_DAYS: 30,
  AGGREGATE_RETENTION_DAYS: 0,
} as const;

export type AffinityWeights = typeof ANALYTICS_CONFIG.AFFINITY_WEIGHTS;
export type RetentionThresholds = typeof ANALYTICS_CONFIG.RETENTION_THRESHOLDS;
