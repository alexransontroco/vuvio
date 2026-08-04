import { FieldValue } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
export function streamRef(streamId) {
    return db.collection(collections.streams).doc(streamId);
}
export function publicStream(stream) {
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
export function addStreamEvent(streamId, event) {
    const ref = streamRef(streamId).collection('events').doc();
    ref.set({
        ...event,
        occurredAt: event.occurredAt ?? FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
    });
}
