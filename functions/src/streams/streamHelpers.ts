import { FieldValue } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import type { StreamDocument } from '../types/stream.js';
import type { StreamEventDocument } from '../types/analytics.js';

export function streamRef(streamId: string) {
  return db.collection(collections.streams).doc(streamId);
}

export function publicStream(stream: StreamDocument) {
  return {
    id: stream.id,
    creatorId: stream.creatorId,
    title: stream.title,
    description: stream.description,
    category: stream.category,
    subcategories: stream.subcategories,
    environment: stream.environment,
    status: stream.status,
    visibility: stream.visibility,
    countryCode: stream.countryCode,
    city: stream.city,
    approximateLocation: stream.approximateLocation,
    languages: stream.languages,
    playbackUrl: stream.playbackUrl,
    hlsManifestUrl: stream.hlsManifestUrl,
    scheduledStartAt: stream.scheduledStartAt ?? null,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt,
    durationSeconds: stream.durationSeconds,
    currentViewerCount: stream.currentViewerCount,
    peakViewerCount: stream.peakViewerCount,
    gearIds: stream.gearIds,
    networkStatus: stream.networkStatus,
    createdAt: stream.createdAt,
    updatedAt: stream.updatedAt,
  };
}

export function addStreamEvent(streamId: string, event: Omit<StreamEventDocument, 'createdAt' | 'occurredAt'> & { occurredAt?: FirebaseFirestore.Timestamp }) {
  const ref = streamRef(streamId).collection('events').doc();
  ref.set({
    ...event,
    occurredAt: event.occurredAt ?? FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
}
