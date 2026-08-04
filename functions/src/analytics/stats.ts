import { FieldValue } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import type { AnalyticsEventType } from '../types/analytics.js';

const increments: Partial<Record<AnalyticsEventType, string>> = {
  stream_impression: 'impressions',
  view_10_seconds: 'views10Seconds',
  view_30_seconds: 'views30Seconds',
  stream_skipped: 'skipsUnder3Seconds',
  follow_creator: 'followsGenerated',
  share: 'shares',
  gear_opened: 'gearOpens',
  gear_clicked: 'gearClicks',
  report_submitted: 'reports',
};

export function updateStatsForEvent(streamId: string, type: AnalyticsEventType) {
  const field = increments[type];
  const ref = db.collection(collections.streamStats).doc(streamId);
  const patch: Record<string, unknown> = {
    streamId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (field) patch[field] = FieldValue.increment(1);
  return ref.set(patch, { merge: true });
}

export function initializeStats(streamId: string) {
  return db.collection(collections.streamStats).doc(streamId).set({
    streamId,
    impressions: 0,
    uniqueViewers: 0,
    views10Seconds: 0,
    views30Seconds: 0,
    skipsUnder3Seconds: 0,
    totalWatchSeconds: 0,
    averageWatchSeconds: 0,
    followsGenerated: 0,
    shares: 0,
    gearOpens: 0,
    gearClicks: 0,
    reports: 0,
    engagementScore: null,
    qualityScore: null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
