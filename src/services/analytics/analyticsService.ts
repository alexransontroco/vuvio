import { analyticsQueue } from './analyticsQueue';
import { analyticsSessionManager } from './analyticsSession';
import type { AnalyticsEventInput, AnalyticsSource } from './analyticsTypes';

class AnalyticsService {
  trackStreamImpression(
    streamId: string,
    creatorId: string,
    source: AnalyticsSource,
    sourcePosition?: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_impression',
      streamId,
      creatorId,
      source,
      sourcePosition: sourcePosition ?? null,
    });
  }

  trackStreamViewStarted(
    streamId: string,
    creatorId: string,
    source: AnalyticsSource,
    sourcePosition?: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_view_started',
      streamId,
      creatorId,
      source,
      sourcePosition: sourcePosition ?? null,
    });
  }

  trackStreamViewThreshold(
    streamId: string,
    creatorId: string,
    threshold: 3 | 10 | 30,
    category?: string,
    environment?: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: `stream_view_${threshold}_seconds` as any,
      streamId,
      creatorId,
      category: category ?? null,
      environment: environment ?? null,
    });
  }

  trackStreamSkipped(
    streamId: string,
    creatorId: string,
    watchedSeconds: number,
    source?: AnalyticsSource
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_skipped',
      streamId,
      creatorId,
      source: source ?? null,
      metadata: { watchedSeconds },
    });
  }

  trackStreamViewEnded(
    streamId: string,
    creatorId: string,
    watchDurationSeconds: number,
    activeWatchDurationSeconds: number,
    exitReason: string,
    category?: string,
    environment?: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_view_ended',
      streamId,
      creatorId,
      category: category ?? null,
      environment: environment ?? null,
      metadata: {
        watchDurationSeconds,
        activeWatchDurationSeconds,
        exitReason,
      },
    });
  }

  trackCreatorProfileOpened(
    creatorId: string,
    streamId?: string,
    source?: AnalyticsSource
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'creator_profile_opened',
      creatorId,
      streamId: streamId ?? null,
      source: source ?? null,
    });
  }

  trackCreatorFollowed(
    creatorId: string,
    streamId?: string,
    source?: AnalyticsSource
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'creator_followed',
      creatorId,
      streamId: streamId ?? null,
      source: source ?? null,
    });
  }

  trackStreamShared(
    streamId: string,
    creatorId: string,
    source?: AnalyticsSource
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_shared',
      streamId,
      creatorId,
      source: source ?? null,
    });
  }

  trackGearPanelOpened(
    streamId: string,
    creatorId: string,
    gearCount: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'gear_panel_opened',
      streamId,
      creatorId,
      metadata: { gearCount },
    });
  }

  trackGearItemOpened(
    gearId: string,
    streamId: string,
    creatorId: string,
    position: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'gear_item_opened',
      gearId,
      streamId,
      creatorId,
      metadata: { position },
    });
  }

  trackGearExternalLinkClicked(
    gearId: string,
    streamId: string,
    creatorId: string,
    linkType: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'gear_external_link_clicked',
      gearId,
      streamId,
      creatorId,
      metadata: { linkType },
    });
  }

  trackCommentSent(
    streamId: string,
    creatorId: string,
    source?: AnalyticsSource
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'comment_sent',
      streamId,
      creatorId,
      source: source ?? null,
    });
  }

  trackStreamRated(
    streamId: string,
    creatorId: string,
    rating: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_rated',
      streamId,
      creatorId,
      metadata: { rating },
    });
  }

  trackStreamReported(
    streamId: string,
    creatorId: string,
    reason: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_reported',
      streamId,
      creatorId,
      metadata: { reason },
    });
  }

  trackDiscoveryFilterApplied(
    category?: string,
    environment?: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'discovery_filter_applied',
      category: category ?? null,
      environment: environment ?? null,
    });
  }

  trackSearchPerformed(query: string, resultCount: number): string {
    return analyticsQueue.enqueue({
      eventName: 'search_performed',
      metadata: { query: query.substring(0, 100), resultCount },
    });
  }

  trackGlobePinClicked(
    streamId: string,
    creatorId: string,
    latitude: number,
    longitude: number
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'globe_pin_clicked',
      streamId,
      creatorId,
      metadata: { latitude, longitude },
    });
  }

  trackStreamQualityDegraded(
    streamId: string,
    creatorId: string,
    reason: string
  ): string {
    return analyticsQueue.enqueue({
      eventName: 'stream_quality_degraded',
      streamId,
      creatorId,
      metadata: { reason },
    });
  }

  trackAppBackgrounded(): string {
    return analyticsQueue.enqueue({
      eventName: 'app_backgrounded',
    });
  }

  setUserId(userId: string | null): void {
    analyticsSessionManager.setUserId(userId);
  }

  async flush(): Promise<void> {
    await analyticsQueue.flush();
  }

  clear(): void {
    analyticsQueue.clear();
  }

  getQueueSize(): number {
    return analyticsQueue.getQueueSize();
  }

  getSession() {
    return analyticsSessionManager.getSession();
  }
}

export const analyticsService = new AnalyticsService();
