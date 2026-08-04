import { FieldValue } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField } from '../shared/validation.js';
import { streamRef } from '../streams/streamHelpers.js';
// Map frontend event names to backend event types for stats tracking
const eventTypeMap = {
    'stream_impression': 'stream_impression',
    'stream_view_started': 'viewer_joined',
    'stream_view_3_seconds': 'view_10_seconds',
    'stream_view_10_seconds': 'view_10_seconds',
    'stream_view_30_seconds': 'view_30_seconds',
    'stream_skipped': 'stream_skipped',
    'stream_view_ended': 'viewer_left',
    'creator_followed': 'follow_creator',
    'stream_shared': 'share',
    'gear_panel_opened': 'gear_opened',
    'gear_item_opened': 'gear_clicked',
    'gear_external_link_clicked': 'gear_clicked',
    'comment_sent': 'comment_sent',
    'stream_reported': 'report_submitted',
};
function validateEvent(event) {
    try {
        const obj = asRecord(event);
        const id = stringField(obj, 'id', { required: true, max: 160 });
        const eventName = stringField(obj, 'eventName', { required: true, max: 64 });
        const sessionId = stringField(obj, 'sessionId', { required: true, max: 100 });
        const anonymousId = stringField(obj, 'anonymousId', { required: true, max: 120 });
        const timestamp = obj.timestamp;
        if (typeof timestamp !== 'number') {
            return { valid: false, reason: 'timestamp must be a number' };
        }
        const streamId = stringField(obj, 'streamId', { max: 100 });
        const creatorId = stringField(obj, 'creatorId', { max: 100 });
        const userId = stringField(obj, 'userId', { max: 128 });
        const source = stringField(obj, 'source', { max: 30 });
        const sourcePosition = obj.sourcePosition;
        const viewSessionId = stringField(obj, 'viewSessionId', { max: 160 });
        const metadata = obj.metadata ? asRecord(obj.metadata) : undefined;
        // Validate timestamp is reasonable (within last 24 hours)
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;
        if (timestamp > now || timestamp < now - maxAge) {
            return { valid: false, reason: 'Invalid timestamp' };
        }
        return {
            valid: true,
            event: {
                id: id || '',
                eventName: eventName,
                streamId: streamId || undefined,
                creatorId: creatorId || undefined,
                sessionId: sessionId || '',
                anonymousId: anonymousId || '',
                userId: userId || null,
                source: (source || null),
                sourcePosition: typeof sourcePosition === 'number' ? sourcePosition : undefined,
                viewSessionId: viewSessionId || undefined,
                timestamp,
                metadata,
            },
        };
    }
    catch (error) {
        return { valid: false, reason: error instanceof Error ? error.message : 'Invalid event format' };
    }
}
async function ingestEvent(event) {
    try {
        // Only process events with streamId
        if (!event.streamId) {
            return { accepted: false, deduped: false, error: 'Missing streamId' };
        }
        const streamId = event.streamId;
        // Verify stream exists
        const streamSnap = await streamRef(streamId).get();
        if (!streamSnap.exists) {
            return { accepted: false, deduped: false, error: 'Stream not found' };
        }
        // Deduplicate by eventId
        const eventsRef = collections.analyticsEvents;
        const dedupeId = event.id;
        const result = await db.runTransaction(async (tx) => {
            const existing = await tx.get(eventsRef.doc(dedupeId));
            if (existing.exists) {
                return { accepted: false, deduped: true };
            }
            // Save event
            tx.set(eventsRef.doc(dedupeId), {
                eventName: event.eventName,
                eventId: event.id,
                streamId: streamId,
                creatorId: event.creatorId,
                sessionId: event.sessionId,
                anonymousId: event.anonymousId,
                userId: event.userId,
                source: event.source,
                sourcePosition: event.sourcePosition ?? null,
                viewSessionId: event.viewSessionId || null,
                metadata: event.metadata || {},
                timestamp: new Date(event.timestamp),
                receivedAt: FieldValue.serverTimestamp(),
            });
            // Update stream stats
            const backendEventType = eventTypeMap[event.eventName] || event.eventName;
            const statsRef = streamRef(streamId).collection('stats').doc('current');
            const update = {
                updatedAt: FieldValue.serverTimestamp(),
            };
            switch (backendEventType) {
                case 'stream_impression':
                    update.impressions = FieldValue.increment(1);
                    break;
                case 'viewer_joined':
                    update.viewStarts = FieldValue.increment(1);
                    break;
                case 'view_10_seconds':
                    update.retention10s = FieldValue.increment(1);
                    break;
                case 'view_30_seconds':
                    update.retention30s = FieldValue.increment(1);
                    break;
                case 'stream_skipped':
                    update.skips = FieldValue.increment(1);
                    break;
                case 'follow_creator':
                    update.follows = FieldValue.increment(1);
                    break;
                case 'share':
                    update.shares = FieldValue.increment(1);
                    break;
                case 'gear_opened':
                    update.gear = FieldValue.increment(1);
                    break;
            }
            tx.set(statsRef, update, { merge: true });
            return { accepted: true, deduped: false };
        });
        return result;
    }
    catch (error) {
        return { accepted: false, deduped: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
export async function ingestEvents(req, res) {
    try {
        const body = asRecord(req.body);
        const events = body.events;
        if (!Array.isArray(events)) {
            throw new ApiError('bad_request', 'events must be an array');
        }
        if (events.length === 0) {
            throw new ApiError('bad_request', 'No events provided');
        }
        if (events.length > 500) {
            throw new ApiError('bad_request', 'Too many events (max 500)');
        }
        const results = {
            accepted: 0,
            deduped: 0,
            errors: 0,
        };
        // Process each event
        for (const rawEvent of events) {
            const validation = validateEvent(rawEvent);
            if (!validation.valid) {
                results.errors++;
                continue;
            }
            const ingestResult = await ingestEvent(validation.event);
            if (ingestResult.accepted) {
                results.accepted++;
            }
            else if (ingestResult.deduped) {
                results.deduped++;
            }
            else {
                results.errors++;
            }
        }
        res.status(200).json({
            accepted: results.accepted,
            deduped: results.deduped,
            errors: results.errors,
        });
    }
    catch (error) {
        throw error;
    }
}
