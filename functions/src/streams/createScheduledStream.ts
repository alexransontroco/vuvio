import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, parseApproximateLocation, parseEnvironment, parseVisibility, stringArray, stringField } from '../shared/validation.js';
import { assertGearOwnership } from '../gear/gearHelpers.js';
import { initializeStats } from '../analytics/stats.js';
import { addStreamEvent } from './streamHelpers.js';
import type { StreamDocument } from '../types/stream.js';

function parseScheduledStartAt(value: unknown) {
  if (typeof value !== 'string') throw new ApiError('bad_request', 'scheduledStartAt is required');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ApiError('bad_request', 'scheduledStartAt is invalid');
  if (date.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new ApiError('bad_request', 'scheduledStartAt must be at least 5 minutes from now');
  }
  return Timestamp.fromDate(date);
}

export async function createScheduledStream(req: Request, res: Response) {
  const user = await authenticateUser(req);
  const body = asRecord(req.body);
  const title = stringField(body, 'title', { required: true, max: 120 })!;
  const category = stringField(body, 'category', { required: true, max: 64 })!;
  const description = stringField(body, 'description', { max: 500 }) ?? null;
  const scheduledStartAt = parseScheduledStartAt(body.scheduledStartAt);
  const environment = parseEnvironment(body.environment);
  const visibility = parseVisibility(body.visibility);
  const gearIds = await assertGearOwnership(user.uid, stringArray(body, 'gearIds', 20));
  const subcategories = stringArray(body, 'subcategories', 8);
  const languages = stringArray(body, 'languages', 6, 12);
  const approximateLocation = parseApproximateLocation(body);
  const city = stringField(body, 'city', { max: 80 }) ?? null;
  const countryCode = stringField(body, 'countryCode', { max: 2 })?.toUpperCase() ?? null;

  const ref = db.collection(collections.streams).doc();
  const now = FieldValue.serverTimestamp();

  const stream: Omit<StreamDocument, 'createdAt' | 'updatedAt'> & { createdAt: FieldValue; updatedAt: FieldValue } = {
    id: ref.id,
    creatorId: user.uid,
    title,
    description,
    category,
    subcategories,
    environment,
    status: 'scheduled',
    visibility,
    countryCode,
    city,
    approximateLocation,
    languages: languages.length ? languages : ['en'],
    cloudflareLiveInputId: null,
    cloudflareUid: null,
    playbackUrl: null,
    hlsManifestUrl: null,
    scheduledStartAt,
    startedAt: null,
    endedAt: null,
    lastHeartbeatAt: null,
    durationSeconds: 0,
    currentViewerCount: 0,
    peakViewerCount: 0,
    totalUniqueViewers: 0,
    gearIds,
    networkStatus: 'unknown',
    interruptionCount: 0,
    disconnectedSeconds: 0,
    moderationStatus: 'pending',
    recommendationStatus: 'eligible',
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(stream);
  await initializeStats(ref.id);
  addStreamEvent(ref.id, {
    type: 'stream_scheduled',
    userId: user.uid,
    anonymousSessionId: null,
    source: 'direct',
    metadata: {},
  });

  res.status(201).json({
    stream: {
      id: ref.id,
      status: 'scheduled',
      scheduledStartAt,
    },
  });
}
