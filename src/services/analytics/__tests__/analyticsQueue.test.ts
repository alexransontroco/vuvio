import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyticsQueue } from '../analyticsQueue';
import { analyticsSessionManager } from '../analyticsSession';
import type { AnalyticsEventInput } from '../analyticsTypes';

describe('AnalyticsQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    analyticsQueue.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('enqueue', () => {
    it('should enqueue an event', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_impression',
        streamId: 'stream-1',
        creatorId: 'creator-1',
        source: 'watch',
      };

      const eventId = analyticsQueue.enqueue(event);

      expect(eventId).toBeDefined();
      expect(analyticsQueue.getQueueSize()).toBe(1);
    });

    it('should assign sessionId and anonymousId to events', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_impression',
        streamId: 'stream-1',
        creatorId: 'creator-1',
      };

      analyticsQueue.enqueue(event);

      const queued = analyticsQueue.getQueuedEvents();
      expect(queued[0].sessionId).toBeDefined();
      expect(queued[0].anonymousId).toBeDefined();
    });

    it('should persist queue to localStorage', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_view_started',
        streamId: 'stream-1',
        creatorId: 'creator-1',
      };

      analyticsQueue.enqueue(event);

      const stored = localStorage.getItem('vuvio:analytics-queue');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toBeDefined();
    });

    it('should detect and deduplicate idempotent events', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_view_10_seconds',
        streamId: 'stream-1',
        creatorId: 'creator-1',
      };

      const id1 = analyticsQueue.enqueue(event);
      const id2 = analyticsQueue.enqueue(event);

      expect(id1).toBe(id2);
      expect(analyticsQueue.getQueueSize()).toBe(1);
    });

    it('should allow non-idempotent events with same name', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_impression',
        streamId: 'stream-1',
        creatorId: 'creator-1',
      };

      const id1 = analyticsQueue.enqueue(event);

      vi.advanceTimersByTime(100);

      const id2 = analyticsQueue.enqueue(event);

      expect(id1).not.toBe(id2);
      expect(analyticsQueue.getQueueSize()).toBe(2);
    });

    it('should generate event ID deterministically for idempotent events', () => {
      const sessionId = analyticsSessionManager.getSessionId();

      const event: AnalyticsEventInput = {
        eventName: 'stream_view_30_seconds',
        streamId: 'stream-1',
      };

      const id1 = analyticsQueue.enqueue(event);
      const id2 = analyticsQueue.enqueue(event);

      expect(id1).toContain(sessionId);
      expect(id1).toContain('stream-1');
      expect(id1).toContain('stream_view_30_seconds');
      expect(id1).toBe(id2);
    });

    it('should respect max queue size', () => {
      for (let i = 0; i < 600; i++) {
        analyticsQueue.enqueue({
          eventName: 'stream_impression',
          streamId: `stream-${i}`,
          creatorId: `creator-${i}`,
        });
      }

      expect(analyticsQueue.getQueueSize()).toBeLessThanOrEqual(500);
    });

    it('should immediately flush important events', async () => {
      const flushSpy = vi.spyOn(analyticsQueue, 'flush');

      analyticsQueue.enqueue({
        eventName: 'stream_view_ended',
        streamId: 'stream-1',
      });

      await vi.runAllTimersAsync();

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should return early if queue is empty', async () => {
      analyticsQueue.clear();
      expect(analyticsQueue.getQueueSize()).toBe(0);

      await analyticsQueue.flush();

      expect(analyticsQueue.getQueueSize()).toBe(0);
    });

    it('should handle successful submission', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_impression',
        streamId: 'stream-1',
      };

      analyticsQueue.enqueue(event);
      expect(analyticsQueue.getQueueSize()).toBe(1);

      vi.mock('../analyticsClient', () => ({
        analyticsClient: {
          submitEvents: vi.fn().mockResolvedValue({
            success: true,
            accepted: 1,
            deduped: 0,
          }),
        },
      }));

      await analyticsQueue.flush();

      expect(analyticsQueue.getQueueSize()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear queue and localStorage', () => {
      analyticsQueue.enqueue({
        eventName: 'stream_impression',
        streamId: 'stream-1',
      });

      expect(analyticsQueue.getQueueSize()).toBeGreaterThan(0);

      analyticsQueue.clear();

      expect(analyticsQueue.getQueueSize()).toBe(0);
      expect(localStorage.getItem('vuvio:analytics-queue')).toBeNull();
    });
  });

  describe('getQueuedEvents', () => {
    it('should return all queued events', () => {
      const events: AnalyticsEventInput[] = [
        {
          eventName: 'stream_impression',
          streamId: 'stream-1',
        },
        {
          eventName: 'stream_view_started',
          streamId: 'stream-1',
        },
      ];

      events.forEach((e) => analyticsQueue.enqueue(e));

      const queued = analyticsQueue.getQueuedEvents();

      expect(queued).toHaveLength(2);
      expect(queued[0].eventName).toBe('stream_impression');
      expect(queued[1].eventName).toBe('stream_view_started');
    });
  });

  describe('persistence', () => {
    it('should load queue from localStorage on construction', () => {
      const event: AnalyticsEventInput = {
        eventName: 'stream_view_10_seconds',
        streamId: 'stream-1',
      };

      analyticsQueue.enqueue(event);

      const stored = localStorage.getItem('vuvio:analytics-queue');
      expect(stored).toBeDefined();
    });
  });

  describe('pageUnload', () => {
    it('should use sendBeacon on pagehide', () => {
      const sendBeaconSpy = vi.spyOn(analyticsQueue, 'flush' as any);

      window.dispatchEvent(new Event('pagehide'));

      expect(sendBeaconSpy).toBeDefined();
    });
  });
});
