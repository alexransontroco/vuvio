import { getApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { adminAuth, db } from '../shared/firestore.js';

async function deleteMatchingDocuments(collectionName: string, uid: string) {
  const snapshot = await db.collection(collectionName).where('creatorId', '==', uid).get();
  const batchSize = 400;
  for (let index = 0; index < snapshot.docs.length; index += batchSize) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + batchSize).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}

export async function deleteOwnAccount(req: Request, res: Response) {
  const identity = await authenticateUser(req);
  const authTime = Number(identity.token.auth_time ?? 0);
  if (!authTime || Date.now() / 1000 - authTime > 600) {
    throw new ApiError('conflict', 'Sign in again to confirm this action.');
  }

  const uid = identity.uid;
  const activeLives = await db.collection('activeLives')
    .where('creatorUid', '==', uid)
    .where('status', '==', 'live')
    .limit(1)
    .get();
  if (!activeLives.empty) {
    throw new ApiError('conflict', 'End your live before deleting your account.');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnapshot = await userRef.get();
  const username = userSnapshot.data()?.usernameNormalized;
  const appBucket = getApp().options.storageBucket;
  const projectId = getApp().options.projectId;
  const bucketName = appBucket
    || process.env.VUVIO_STORAGE_BUCKET
    || (projectId === 'demo-vuvio-e2e' ? 'vuvio-bf328.firebasestorage.app' : projectId ? `${projectId}.firebasestorage.app` : undefined);

  let storageMissing = false;
  try {
    await getStorage().bucket(bucketName).deleteFiles({ prefix: `users/${uid}/` });
  } catch (error) {
    if ((error as { code?: number }).code === 404) {
      storageMissing = true;
    } else {
      console.error('[deleteOwnAccount] Storage cleanup failed:', error);
      throw new ApiError('server_error', 'Could not remove account files. Please try again.');
    }
  }

  await Promise.all([
    deleteMatchingDocuments('creatorEquipment', uid),
    db.recursiveDelete(userRef),
  ]);

  if (username) {
    const usernameRef = db.collection('usernames').doc(username);
    const usernameSnapshot = await usernameRef.get();
    if (usernameSnapshot.data()?.uid === uid) await usernameRef.delete();
  }

  await adminAuth.deleteUser(uid);
  res.status(200).json({ success: true, storageMissing });
}
