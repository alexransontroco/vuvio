import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { collections, db } from '../shared/firestore.js';
import { parseLimit } from '../shared/validation.js';
import { publicStream } from './streamHelpers.js';
import type { StreamDocument } from '../types/stream.js';

export async function listLiveStreams(req: Request, res: Response) {
  const limit = parseLimit(req.query.limit);
  let q: FirebaseFirestore.Query = db.collection(collections.streams).where('status', '==', 'live').where('visibility', '==', 'public');

  if (typeof req.query.category === 'string') q = q.where('category', '==', req.query.category);
  if (typeof req.query.environment === 'string') q = q.where('environment', '==', req.query.environment);
  if (typeof req.query.countryCode === 'string') q = q.where('countryCode', '==', req.query.countryCode.toUpperCase());
  if (typeof req.query.language === 'string') q = q.where('languages', 'array-contains', req.query.language);

  q = q.orderBy('startedAt', 'desc').limit(limit);
  if (typeof req.query.cursor === 'string') {
    const cursorSnap = await db.collection(collections.streams).doc(req.query.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const streams = snap.docs.map((doc) => publicStream(doc.data() as StreamDocument));
  res.json({ streams, nextCursor: snap.docs.at(-1)?.id ?? null });
}

export async function listGlobeStreams(_req: Request, res: Response) {
  const snap = await db.collection(collections.streams)
    .where('status', '==', 'live')
    .where('visibility', '==', 'public')
    .orderBy('startedAt', 'desc')
    .limit(100)
    .get();

  const userIds = [...new Set(snap.docs.map((doc) => (doc.data() as StreamDocument).creatorId))];
  const creators = new Map<string, { displayName: string; photoURL: string | null }>();
  await Promise.all(userIds.map(async (uid) => {
    const userSnap = await db.collection(collections.users).doc(uid).get();
    const data = userSnap.data() ?? {};
    creators.set(uid, {
      displayName: String(data.displayName ?? data.username ?? 'Vuvio creator'),
      photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    });
  }));

  const streams = snap.docs
    .map((doc) => doc.data() as StreamDocument)
    .filter((stream) => stream.approximateLocation)
    .map((stream) => {
      const creator = creators.get(stream.creatorId) ?? { displayName: 'Vuvio creator', photoURL: null };
      return {
        id: stream.id,
        title: stream.title,
        category: stream.category,
        environment: stream.environment,
        status: 'live',
        creator: { id: stream.creatorId, ...creator },
        approximateLocation: stream.approximateLocation,
        currentViewerCount: stream.currentViewerCount,
        featured: false,
      };
    });

  res.json({ streams });
}
