import { FieldPath } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import type { GearDocument } from '../types/gear.js';

export const MAX_STREAM_GEAR = 20;

export async function assertGearOwnership(creatorId: string, gearIds: string[]) {
  const ids = [...new Set(gearIds)].slice(0, MAX_STREAM_GEAR);
  if (!ids.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const found = new Set<string>();
  for (const chunk of chunks) {
    const snap = await db.collection(collections.gear).where(FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach((doc) => {
      const gear = doc.data() as GearDocument;
      if (gear.ownerId !== creatorId) {
        throw new ApiError('forbidden', 'Cannot attach gear owned by another user');
      }
      found.add(doc.id);
    });
  }

  if (found.size !== ids.length) throw new ApiError('not_found', 'One or more gear items were not found');
  return ids;
}

export async function publicGearForIds(gearIds: string[]) {
  const ids = [...new Set(gearIds)].slice(0, MAX_STREAM_GEAR);
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  const items: Array<{ id: string } & GearDocument> = [];
  for (const chunk of chunks) {
    const snap = await db.collection(collections.gear).where(FieldPath.documentId(), 'in', chunk).get();
    snap.docs.forEach((doc) => {
      const data = doc.data() as GearDocument;
      if (data.visibility === 'public') items.push({ id: doc.id, ...data });
    });
  }
  return items;
}
