import { ANALYTICS_CONFIG } from './analyticsConfig';
import { analyticsClient } from './analyticsClient';
import { analyticsSessionManager } from './analyticsSession';
import type { AnalyticsEventInput } from './analyticsTypes';

export interface QueuedEvent {
  id: string;
  event: AnalyticsEventInput;
  timestamp: number;
  attempts: number;
}

class AnalyticsQueue {
  private queue: Map<string, QueuedEvent> = new Map();
  private flushTimer: number | null = null;
  private isSubmitting = false;
  private dedupMap: Map<string, string> = new Map();

  constructor() {
    this.loadQueue();
    this.startFlushTimer();
    this.setupPageUnload();
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(ANALYTICS_CONFIG.QUEUE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, QueuedEvent>;
        this.queue = new Map(Object.entries(parsed));
        console.log(`[Analytics] Loaded ${this.queue.size} queued events from storage`);
      }
    } catch (error) {
      console.error('[Analytics] Failed to load queue from storage', error);
      this.queue.clear();
    }
  }

  private saveQueue(): void {
    try {
      if (this.queue.size === 0) {
        localStorage.removeItem(ANALYTICS_CONFIG.QUEUE_STORAGE_KEY);
        return;
      }

      const data = Object.fromEntries(this.queue);
      localStorage.setItem(ANALYTICS_CONFIG.QUEUE_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[Analytics] Failed to save queue to storage', error);
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = window.setInterval(() => {
      this.flush().catch((error) => console.error('[Analytics] Flush error', error));
    }, ANALYTICS_CONFIG.FLUSH_INTERVAL_MS);
  }

  private setupPageUnload(): void {
    window.addEventListener('pagehide', () => {
      this.flushSync();
    });

    window.addEventListener('beforeunload', () => {
      this.flushSync();
    });
  }

  enqueue(event: AnalyticsEventInput): string {
    if (this.queue.size >= ANALYTICS_CONFIG.MAX_QUEUE_SIZE) {
      console.warn('[Analytics] Queue size exceeded, dropping oldest events');
      const oldestKey = Array.from(this.queue.keys())[0];
      if (oldestKey) {
        this.queue.delete(oldestKey);
      }
    }

    const eventId = this.generateEventId(event);

    if (this.isDuplicate(eventId)) {
      console.debug(`[Analytics] Duplicate event detected: ${eventId}`);
      return eventId;
    }

    const queuedEvent: QueuedEvent = {
      id: eventId,
      event: {
        ...event,
        sessionId: analyticsSessionManager.getSessionId(),
        userId: analyticsSessionManager.getUserId(),
        anonymousId: analyticsSessionManager.getAnonymousId(),
      },
      timestamp: Date.now(),
      attempts: 0,
    };

    this.queue.set(eventId, queuedEvent);
    this.dedupMap.set(eventId, eventId);
    this.saveQueue();

    if (this.shouldFlushImmediately(event)) {
      this.flush().catch((error) => console.error('[Analytics] Immediate flush error', error));
    }

    return eventId;
  }

  private generateEventId(event: AnalyticsEventInput): string {
    const { sessionId, anonymousId, userId } = analyticsSessionManager.getSession();

    if (ANALYTICS_CONFIG.IDEMPOTENT_EVENTS.includes(event.eventName as any)) {
      return `${sessionId}-${event.streamId || 'no-stream'}-${event.eventName}`;
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sessionId}-${event.eventName}-${timestamp}-${random}`;
  }

  private isDuplicate(eventId: string): boolean {
    return this.dedupMap.has(eventId);
  }

  private shouldFlushImmediately(event: AnalyticsEventInput): boolean {
    const immediateEvents = [
      'stream_view_ended',
      'app_backgrounded',
      'creator_followed',
      'stream_shared',
    ];
    return immediateEvents.includes(event.eventName);
  }

  async flush(): Promise<void> {
    if (this.isSubmitting || this.queue.size === 0) {
      return;
    }

    this.isSubmitting = true;

    try {
      const batch = Array.from(this.queue.values())
        .slice(0, ANALYTICS_CONFIG.BATCH_SIZE)
        .map((q) => ({ ...q.event, id: q.id, timestamp: q.timestamp }));

      if (batch.length === 0) {
        return;
      }

      const response = await analyticsClient.submitEvents(batch);

      if (response.success) {
        Array.from(this.queue.keys())
          .slice(0, batch.length)
          .forEach((eventId) => this.queue.delete(eventId));
        this.saveQueue();
      } else {
        console.warn('[Analytics] Batch submission returned success=false');
      }
    } catch (error) {
      console.error('[Analytics] Flush error', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private flushSync(): void {
    if (this.queue.size === 0) {
      return;
    }

    const batch = Array.from(this.queue.values())
      .slice(0, ANALYTICS_CONFIG.BATCH_SIZE)
      .map((q) => ({ ...q.event, id: q.id, timestamp: q.timestamp }));

    if (batch.length > 0) {
      analyticsClient.sendBeacon(batch);
    }
  }

  clear(): void {
    this.queue.clear();
    this.dedupMap.clear();
    this.saveQueue();
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  getQueuedEvents(): AnalyticsEventInput[] {
    return Array.from(this.queue.values()).map((q) => q.event);
  }
}

export const analyticsQueue = new AnalyticsQueue();
