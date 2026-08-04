import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamViewTracker } from '../streamViewTracker';
import type { StreamViewTrackerConfig } from '../streamViewTracker';

describe('StreamViewTracker', () => {
  let tracker: StreamViewTracker;
  const config: StreamViewTrackerConfig = {
    streamId: 'stream-1',
    creatorId: 'creator-1',
    source: 'watch',
    sourcePosition: 0,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    tracker = new StreamViewTracker(config);
  });

  afterEach(() => {
    tracker.destroy();
    vi.useRealTimers();
  });

  describe('impression tracking', () => {
    it('should record impression only once', () => {
      const recordSpy = vi.spyOn(tracker, 'recordImpression');

      tracker.recordImpression();
      tracker.recordImpression();
      tracker.recordImpression();

      expect(recordSpy).toHaveBeenCalledTimes(3);
      const metrics = tracker.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('view session lifecycle', () => {
    it('should start and end session', () => {
      tracker.startViewSession();
      expect(tracker.getMetrics().watchDurationSeconds).toBe(0);

      vi.advanceTimersByTime(5000);
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(5000);

      const metrics = tracker.endViewSession('swipe');
      expect(metrics.watchDurationSeconds).toBeGreaterThan(0);
      expect(metrics.exitReason).toBe('swipe');
    });

    it('should not start session twice', () => {
      tracker.startViewSession();
      vi.advanceTimersByTime(1000);

      const firstMetrics = tracker.getMetrics();

      tracker.startViewSession();
      vi.advanceTimersByTime(1000);

      const secondMetrics = tracker.getMetrics();

      expect(firstMetrics.watchDurationSeconds).toBe(secondMetrics.watchDurationSeconds);
    });
  });

  describe('playback state tracking', () => {
    it('should track when video is playing', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(5000);

      tracker.setPlaybackState(false);
      const metrics = tracker.getMetrics();

      expect(metrics.activeWatchDurationSeconds).toBeGreaterThan(0);
    });

    it('should not count paused time as active', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(false);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(5000);

      const metrics = tracker.getMetrics();
      expect(metrics.activeWatchDurationSeconds).toBe(0);
    });
  });

  describe('visibility tracking', () => {
    it('should only count time when element is visible', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(3000);

      tracker.setVisibility(false);
      vi.advanceTimersByTime(3000);

      tracker.setVisibility(true);
      vi.advanceTimersByTime(3000);

      const metrics = tracker.getMetrics();
      expect(metrics.activeWatchDurationSeconds).toBeGreaterThanOrEqual(5);
      expect(metrics.activeWatchDurationSeconds).toBeLessThanOrEqual(7);
    });
  });

  describe('page visibility tracking', () => {
    it('should pause active time when page is hidden', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(3000);

      tracker.setPageVisibility(false);
      vi.advanceTimersByTime(3000);

      const metrics = tracker.getMetrics();
      expect(metrics.activeWatchDurationSeconds).toBeGreaterThanOrEqual(2);
      expect(metrics.activeWatchDurationSeconds).toBeLessThanOrEqual(4);
    });
  });

  describe('milestone tracking', () => {
    it('should fire 3-second milestone', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(3100);

      const metrics = tracker.getMetrics();
      expect(metrics.reached3Seconds).toBe(true);
    });

    it('should fire 10-second milestone', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(10100);

      const metrics = tracker.getMetrics();
      expect(metrics.reached10Seconds).toBe(true);
    });

    it('should fire 30-second milestone', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(30100);

      const metrics = tracker.getMetrics();
      expect(metrics.reached30Seconds).toBe(true);
    });

    it('should not re-fire milestones', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(10100);
      const metrics1 = tracker.getMetrics();

      vi.advanceTimersByTime(5000);
      const metrics2 = tracker.getMetrics();

      expect(metrics1.reached10Seconds).toBe(metrics2.reached10Seconds);
    });
  });

  describe('skip detection', () => {
    it('should mark as skipped if ended under 3 seconds', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(2000);

      const metrics = tracker.endViewSession('swipe');
      expect(metrics.skippedUnder3Seconds).toBe(true);
    });

    it('should not mark as skipped if watched 3+ seconds', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(3100);

      const metrics = tracker.endViewSession('swipe');
      expect(metrics.skippedUnder3Seconds).toBe(false);
    });
  });

  describe('action tracking', () => {
    it('should track gear interactions', () => {
      tracker.recordGearOpened();
      tracker.recordGearItemClicked();
      tracker.recordGearItemClicked();
      tracker.recordGearExternalClicked();

      const metrics = tracker.getMetrics();
      expect(metrics.gearOpened).toBe(true);
      expect(metrics.gearItemClicks).toBe(2);
      expect(metrics.gearExternalClicks).toBe(1);
    });

    it('should track social actions', () => {
      tracker.recordProfileOpened();
      tracker.recordCreatorFollowed();
      tracker.recordShared();
      tracker.recordCommented();
      tracker.recordRated();
      tracker.recordReported();

      const metrics = tracker.getMetrics();
      expect(metrics.creatorProfileOpened).toBe(true);
      expect(metrics.creatorFollowed).toBe(true);
      expect(metrics.shared).toBe(true);
      expect(metrics.commented).toBe(true);
      expect(metrics.rated).toBe(true);
      expect(metrics.reported).toBe(true);
    });
  });

  describe('exit reasons', () => {
    it('should record custom exit reason', () => {
      tracker.startViewSession();

      const metrics = tracker.endViewSession('network_error');
      expect(metrics.exitReason).toBe('network_error');
    });

    it('should default to unknown if not specified', () => {
      tracker.startViewSession();

      const metrics = tracker.endViewSession();
      expect(metrics.exitReason).toBe('unknown');
    });
  });

  describe('watch duration calculation', () => {
    it('should calculate correct watch duration', () => {
      tracker.startViewSession();

      vi.advanceTimersByTime(15000);

      const metrics = tracker.endViewSession();
      expect(metrics.watchDurationSeconds).toBe(15);
    });

    it('should calculate correct active watch duration', () => {
      tracker.startViewSession();
      tracker.setPlaybackState(true);
      tracker.setVisibility(true);
      tracker.setPageVisibility(true);

      vi.advanceTimersByTime(5000);

      tracker.setPlaybackState(false);
      vi.advanceTimersByTime(5000);

      tracker.setPlaybackState(true);
      vi.advanceTimersByTime(5000);

      const metrics = tracker.endViewSession();
      expect(metrics.watchDurationSeconds).toBe(15);
      expect(metrics.activeWatchDurationSeconds).toBeGreaterThanOrEqual(9);
    });
  });
});
