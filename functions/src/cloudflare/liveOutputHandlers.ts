import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { createCloudflareClient } from './cloudflareClient.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField } from '../shared/validation.js';

async function assertOwnsLiveInput(uid: string, liveInputId: string) {
  const snap = await db
    .collection('activeLives')
    .where('cloudflareLiveInputId', '==', liveInputId)
    .where('creatorUid', '==', uid)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new ApiError('forbidden', 'You do not own this live input');
  }
  return snap.docs[0];
}

// POST /cloudflare/live-input/:liveInputId/outputs
// Body: { url, streamKey, provider?, name? }
export async function createLiveOutputHandler(req: Request, res: Response, liveInputId: string) {
  console.log(`[live-output] createLiveOutputHandler called liveInputId=${liveInputId} method=${req.method}`);
  const user = await authenticateUser(req);
  const body = asRecord(req.body);
  const url = stringField(body, 'url', { required: true, max: 512 })!;
  const streamKey = stringField(body, 'streamKey', { required: true, max: 512 })!;
  const provider = stringField(body, 'provider', { max: 32 }) ?? 'custom';
  const name = stringField(body, 'name', { max: 80 }) ?? provider;

  await assertOwnsLiveInput(user.uid, liveInputId);

  const client = createCloudflareClient();
  const output = await client.createLiveOutput(liveInputId, url, streamKey);

  console.log(`[live-output] created output=${output.outputId} provider=${provider} user=${user.uid}`);

  // Store output metadata (NO stream key) in Firestore for status tracking
  await db
    .collection('activeLives')
    .where('cloudflareLiveInputId', '==', liveInputId)
    .where('creatorUid', '==', user.uid)
    .limit(1)
    .get()
    .then(async (snap) => {
      if (snap.empty) return;
      const liveRef = snap.docs[0].ref;
      const existing = (snap.docs[0].data().liveOutputs as Record<string, unknown>[] | undefined) ?? [];
      await liveRef.update({
        liveOutputs: [
          ...existing.filter((o: Record<string, unknown>) => o.outputId !== output.outputId),
          { outputId: output.outputId, provider, name, enabled: true, createdAt: new Date().toISOString() },
        ],
      });
    })
    .catch(() => {});

  res.json({ outputId: output.outputId, provider, name, enabled: output.enabled });
}

// DELETE /cloudflare/live-input/:liveInputId/outputs/:outputId
export async function deleteLiveOutputHandler(req: Request, res: Response, liveInputId: string, outputId: string) {
  const user = await authenticateUser(req);
  await assertOwnsLiveInput(user.uid, liveInputId);

  const client = createCloudflareClient();
  await client.deleteLiveOutput(liveInputId, outputId);

  console.log(`[live-output] deleted output=${outputId} user=${user.uid}`);
  res.json({ ok: true });
}

// GET /cloudflare/live-input/:liveInputId/outputs
export async function listLiveOutputsHandler(req: Request, res: Response, liveInputId: string) {
  const user = await authenticateUser(req);
  await assertOwnsLiveInput(user.uid, liveInputId);

  const client = createCloudflareClient();
  const outputs = await client.listLiveOutputs(liveInputId);

  res.json({ outputs });
}
