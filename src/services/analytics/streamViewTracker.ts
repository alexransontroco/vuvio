import { ANALYTICS_CONFIG } from './analyticsConfig';
import { analyticsService } from './analyticsService';
import type { AnalyticsSource } from './analyticsTypes';

export interface StreamViewTrackerConfig {
  streamId: string;
  creatorId: string;
  source: AnalyticsSource;
  sourcePosition?: number;
  category?: string;
  environment?: string;
}

export interface ViewSessionMetrics {
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
  exitReason: string | null;
}

export class StreamViewTracker {
  private config: StreamViewTrackerConfig;
  private startTime: number | null = null;
  private endTime: number | null = null;
  private lastActiveTime: number | null = null;
  private accumulatedActiveTime: number = 0;
  private isPlaying: boolean = false;
  private isVisible: boolean = false;
  private isPageVisible: boolean = true;
  private milestonesFired: Set<number> = new Set();
  private impressionFired: boolean = false;
  private metrics: ViewSessionMetrics = {
    watchDurationSeconds: 0,
    activeWatchDurationSeconds: 0,
    reached3Seconds: false,
    reached10Seconds: false,
    reached30Seconds: false,
    skippedUnder3Seconds: false,
    gearOpened: false,
    gearItemClicks: 0,
    gearExternalClicks: 0,
    creatorProfileOpened: false,
    creatorFollowed: false,
    shared: false,
    commented: false,
    rated: false,
    reported: false,
    exitReason: null,
  };

  private visibilityListener: (() => void) | null = null;
  private updateInterval: number | null = null;

  constructor(config: StreamViewTrackerConfig) {
    this.config = config;
    this.setupVisibilityListener();
  }

  recordImpression(): void {
    if (this.impressionFired) return;
    this.impressionFired = true;

    analyticsService.trackStreamImpression(
      this.config.streamId,
      this.config.creatorId,
      this.config.source,
      this.config.sourcePosition
    );
  }

  startViewSession(): void {
    if (this.startTime !== null) return;

    this.startTime = Date.now();
    this.lastActiveTime = this.startTime;
    this.impressionFired = false;

    analyticsService.trackStreamViewStarted(
      this.config.streamId,
      this.config.creatorId,
      this.config.source,
      this.config.sourcePosition
    );

    this.startActiveTimeTracking();
  }

  setPlaybackState(playing: boolean): void {
    const wasPlaying = this.isPlaying;
    this.isPlaying = playing;

    if (wasPlaying !== playing) {
      if (playing) {
        this.lastActiveTime = Date.now();
      } else {
        this.flushActiveTime();
      }
    }
  }

  setVisibility(visible: boolean): void {
    const wasVisible = this.isVisible;
    this.isVisible = visible;

    if (wasVisible !== visible) {
      if (!visible) {
        this.flushActiveTime();
      } else {
        this.lastActiveTime = Date.now();
      }
    }
  }

  setPageVisibility(visible: boolean): void {
    const wasVisible = this.isPageVisible;
    this.isPageVisible = visible;

    if (wasVisible !== visible) {
      if (!visible) {
        this.flushActiveTime();
      } else {
        this.lastActiveTime = Date.now();
      }
    }
  }

  recordGearOpened(): void {
    this.metrics.gearOpened = true;
  }

  recordGearItemClicked(): void {
    this.metrics.gearItemClicks += 1;
  }

  recordGearExternalClicked(): void {
    this.metrics.gearExternalClicks += 1;
  }

  recordProfileOpened(): void {
    this.metrics.creatorProfileOpened = true;
  }

  recordCreatorFollowed(): void {
    this.metrics.creatorFollowed = true;
  }

  recordShared(): void {
    this.metrics.shared = true;
  }

  recordCommented(): void {
    this.metrics.commented = true;
  }

  recordRated(): void {
    this.metrics.rated = true;
  }

  recordReported(): void {
    this.metrics.reported = true;
  }

  endViewSession(exitReason: string = 'unknown'): ViewSessionMetrics {
    if (this.startTime === null) {
      return this.metrics;
    }

    this.endTime = Date.now();
    this.flushActiveTime();
    this.cleanupListeners();

    const watchDurationSeconds = Math.floor((this.endTime - this.startTime) / 1000);
    const activeWatchDurationSeconds = Math.floor(this.accumulatedActiveTime / 1000);

    this.metrics.watchDurationSeconds = watchDurationSeconds;
    this.metrics.activeWatchDurationSeconds = activeWatchDurationSeconds;
    this.metrics.exitReason = exitReason;

    if (activeWatchDurationSeconds < 3) {
      this.metrics.skippedUnder3Seconds = true;
      analyticsService.trackStreamSkipped(
        this.config.streamId,
        this.config.creatorId,
        activeWatchDurationSeconds,
        this.config.source
      );
    }

    analyticsService.trackStreamViewEnded(
      this.config.streamId,
      this.config.creatorId,
      watchDurationSeconds,
      activeWatchDurationSeconds,
      exitReason,
      this.config.category,
      this.config.environment
    );

    return this.metrics;
  }

  getMetrics(): ViewSessionMetrics {
    return { ...this.metrics };
  }

  private startActiveTimeTracking(): void {
    this.updateInterval = window.setInterval(() => {
      this.checkMilestones();
      this.flushActiveTime();
    }, 1000);
  }

  private checkMilestones(): void {
    if (this.startTime === null || !this.isPlaying || !this.isVisible || !this.isPageVisible) {
      return;
    }

    const thresholds = [
      { ms: ANALYTICS_CONFIG.RETENTION_THRESHOLDS.SKIP, key: 3, name: 'stream_view_3_seconds' },
      { ms: ANALYTICS_CONFIG.RETENTION_THRESHOLDS.SHORT, key: 10, name: 'stream_view_10_seconds' },
      { ms: ANALYTICS_CONFIG.RETENTION_THRESHOLDS.MEDIUM, key: 30, name: 'stream_view_30_seconds' },
    ];

    for (const threshold of thresholds) {
      if (!this.milestonesFired.has(threshold.key) && this.accumulatedActiveTime >= threshold.ms) {
        this.milestonesFired.add(threshold.key);

        if (threshold.key === 3) {
          this.metrics.reached3Seconds = true;
        } else if (threshold.key === 10) {
          this.metrics.reached10Seconds = true;
        } else if (threshold.key === 30) {
          this.metrics.reached30Seconds = true;
        }

        analyticsService.trackStreamViewThreshold(
          this.config.streamId,
          this.config.creatorId,
          threshold.key as 3 | 10 | 30,
          this.config.category,
          this.config.environment
        );
      }
    }
  }

  private flushActiveTime(): void {
    if (!this.isPlaying || !this.isVisible || !this.isPageVisible || this.lastActiveTime === null) {
      return;
    }

    const now = Date.now();
    const delta = now - this.lastActiveTime;

    if (delta > 0 && delta < 60000) {
      this.accumulatedActiveTime += delta;
    }

    this.lastActiveTime = now;
  }

  private setupVisibilityListener(): void {
    this.visibilityListener = () => {
      this.setPageVisibility(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  private cleanupListeners(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.visibilityListener !== null) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  destroy(): void {
    this.cleanupListeners();
  }
}
