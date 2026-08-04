import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, safeMetadata, stringField } from '../shared/validation.js';
import { allowedAnalyticsEvents, type AnalyticsEventType, type StreamEventSource } from '../types/analytics.js';
import { updateStatsForEvent } from './stats.js';
import { streamRef } from '../streams/streamHelpers.js';

const allowedSources = new Set(['watch', 'explore', 'globe', 'profile', 'direct']);

export async function trackStreamEvent(req: Request, res: Response, streamId: string) {
  const body = asRecord(req.body);
  const type = stringField(body, 'type', { required: true, max: 64 }) as AnalyticsEventType;
  if (!allowedAnalyticsEvents.includes(type)) throw new ApiError('bad_request', 'Unknown analytics event type');
  const anonymousSessionId = stringField(body, 'anonymousSessionId', { max: 120 }) ?? null;
  const eventId = stringField(body, 'eventId', { max: 160 });
  const source = stringField(body, 'source', { max: 24 }) as StreamEventSource | undefined;
  if (source && !allowedSources.has(source)) throw new ApiError('bad_request', 'Invalid event source');
  const metadata = safeMetadata(body.metadata);
  const userId = req.header('authorization') ? null : null;

  const streamSnap = await streamRef(streamId).get();
  if (!streamSnap.exists) throw new ApiError('not_found', 'Stream not found');

  const dedupeId = eventId ?? `${anonymousSessionId ?? 'anonymous'}_${streamId}_${type}_${Math.floor(Date.now() / 30000)}`;
  const eventRef = streamRef(streamId).collection('events').doc(dedupeId);
  const created = await db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) return false;
    tx.set(eventRef, {
      type,
      userId,
      anonymousSessionId,
      source: source ?? null,
      metadata,
      occurredAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (created) await updateStatsForEvent(streamId, type);
  res.status(created ? 201 : 200).json({ accepted: true, deduped: !created });
}
