import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { parseLimit } from '../shared/validation.js';
import { publicStream } from './streamHelpers.js';
import type { StreamDocument } from '../types/stream.js';

export async function listScheduledStreams(req: Request, res: Response) {
  const limit = parseLimit(req.query.limit, 20, 50);
  const now = Timestamp.now();
  const nowMs = now.toMillis();
  const mine = req.query.creator === 'me';
  const user = mine ? await authenticateUser(req) : null;
  const creatorId = typeof req.query.creatorId === 'string' ? req.query.creatorId.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

  let q: FirebaseFirestore.Query = db.collection(collections.streams)
    .where('status', '==', 'scheduled');

  if (mine && user) q = q.where('creatorId', '==', user.uid);
  else if (creatorId) q = q.where('creatorId', '==', creatorId);
  if (category) q = q.where('category', '==', category);

  if (typeof req.query.cursor === 'string') {
    const cursorSnap = await db.collection(collections.streams).doc(req.query.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.limit(100).get();
  const streams = snap.docs
    .map((doc) => publicStream(doc.data() as StreamDocument))
    .filter((stream) => {
      const scheduledStartAt = stream.scheduledStartAt;
      const scheduledMs = scheduledStartAt?.toMillis?.() ?? 0;
      const visible = mine ? true : stream.visibility === 'public';
      return visible && scheduledMs >= nowMs;
    })
    .sort((a, b) => {
      const aMs = a.scheduledStartAt?.toMillis?.() ?? 0;
      const bMs = b.scheduledStartAt?.toMillis?.() ?? 0;
      return aMs - bMs;
    })
    .slice(0, limit);
  res.json({ streams, nextCursor: snap.docs.at(-1)?.id ?? null });
}
