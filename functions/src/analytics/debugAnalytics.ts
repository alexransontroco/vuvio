import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { collections, db } from '../shared/firestore.js';

function isAdminEmail(email: string | null | undefined) {
  return email?.endsWith('@vuvio.app') || email === 'alexandre.ranson@gmail.com';
}

async function countCollection(name: string) {
  const snap = await db.collection(name).get();
  const sampleIds = snap.docs.slice(0, 5).map((doc) => doc.id);
  return {
    sampleIds,
    sampleCount: snap.size,
  };
}

export async function debugAnalytics(req: Request, res: Response) {
  const user = await authenticateUser(req);
  if (!isAdminEmail(user.token.email ?? null)) {
    throw new ApiError('forbidden', 'Admin access required');
  }

  const [streamStats, creatorStats, categoryStats, analyticsEvents] = await Promise.all([
    countCollection(collections.streamStats),
    countCollection('creatorStats'),
    countCollection('categoryStats'),
    countCollection('analyticsEvents'),
  ]);

  res.json({
    ok: true,
    counts: {
      streamStats: streamStats.sampleCount,
      creatorStats: creatorStats.sampleCount,
      categoryStats: categoryStats.sampleCount,
      analyticsEvents: analyticsEvents.sampleCount,
    },
    samples: {
      streamStats: streamStats.sampleIds,
      creatorStats: creatorStats.sampleIds,
      categoryStats: categoryStats.sampleIds,
      analyticsEvents: analyticsEvents.sampleIds,
    },
  });
}
