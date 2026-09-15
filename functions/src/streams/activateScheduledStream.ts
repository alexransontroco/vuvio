import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { createCloudflareClient } from '../cloudflare/cloudflareClient.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { addStreamEvent, streamRef } from './streamHelpers.js';
import { assertStatus } from './status.js';
import type { StreamDocument } from '../types/stream.js';

// Called by the creator when they're ready to go live from a scheduled stream.
// Provisions Cloudflare and moves status from 'scheduled' → 'preparing'.
export async function activateScheduledStream(req: Request, res: Response, streamId: string) {
  const user = await authenticateUser(req);
  const ref = streamRef(streamId);

  // Validate ownership and status before provisioning Cloudflare
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError('not_found', 'Stream not found');
  const stream = snap.data() as StreamDocument;
  if (stream.creatorId !== user.uid) throw new ApiError('forbidden', 'Only the creator can activate this stream');
  const conflict = assertStatus(stream.status, ['scheduled'], 'Activate');
  if (conflict) throw new ApiError('conflict', conflict);

  const cloudflare = await createCloudflareClient().createLiveInput({ streamId, title: stream.title });
  const { liveInputId: cloudflareInputId, uid: cloudflareUid, playbackUrl, hlsManifestUrl, ingestUrl, streamKey } = cloudflare;

  await ref.update({
    status: 'preparing',
    cloudflareLiveInputId: cloudflareInputId,
    cloudflareUid,
    playbackUrl,
    hlsManifestUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });

  addStreamEvent(streamId, {
    type: 'stream_activated',
    userId: user.uid,
    anonymousSessionId: null,
    source: 'direct',
    metadata: {},
  });

  res.json({
    stream: { id: streamId, status: 'preparing', cloudflareLiveInputId: cloudflareInputId, playbackUrl, hlsManifestUrl },
    ingest: { url: ingestUrl, webRTCUrl: cloudflare.webRTCUrl, streamKey },
  });
}
