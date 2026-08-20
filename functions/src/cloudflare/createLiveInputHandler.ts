import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { createLiveInput, createCloudflareClient } from './cloudflareClient.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField } from '../shared/validation.js';

export async function createLiveInputHandler(req: Request, res: Response) {
  try {
    const user = await authenticateUser(req);
    const body = asRecord(req.body);
    const streamId = stringField(body, 'streamId', { required: true, max: 64 })!;
    const title = stringField(body, 'title', { required: true, max: 120 }) ?? 'Untitled';
    const useRelay = body.useRelay === true;

    const input = await createLiveInput({
      name: title,
      description: `Created by ${user.uid}`,
    });

    if (!input || !input.uid) {
      throw new ApiError('server_error', 'Failed to create Cloudflare live input');
    }

    console.log(`[CLOUDFLARE] live input created — uid: ${input.uid} | stream: ${streamId} | title: ${title}`);

    // Verify + force recording mode — Cloudflare sometimes ignores mode in create payload
    const client = createCloudflareClient();
    const recordingOk = await client.ensureRecordingEnabled(input.uid);
    if (!recordingOk) {
      console.error(`[CLOUDFLARE] ❌ Failed to confirm recording.mode=automatic for liveInput=${input.uid}`);
    } else {
      console.log(`[CLOUDFLARE] ✓ recording.mode=automatic confirmed for liveInput=${input.uid}`);
    }
    console.log(`[CLOUDFLARE] WHEP: ${input.whepUrl ?? 'none'} | HLS: ${input.hlsManifestUrl ?? 'none'} | webRTC: ${input.webRTCUrl ?? 'none'}`);

    const cloudflareFields = {
      cloudflareLiveInputId: input.uid,
      cloudflareUid: input.uid,
      playbackUrl: input.playbackUrl,
      hlsManifestUrl: input.hlsManifestUrl,
      whepUrl: input.whepUrl,
      recordingStatus: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    };

    const liveRef = db.collection('activeLives').doc(streamId);
    await liveRef.update(cloudflareFields).catch(async (err) => {
      if (err.code === 5) {
        await liveRef.set({
          id: streamId,
          title,
          creatorId: user.uid,
          creatorUid: user.uid,
          ...cloudflareFields,
          status: 'preparing',
          createdAt: new Date(),
        }, { merge: true });
      } else {
        throw err;
      }
    });

    res.json({
      liveInputId: input.uid,
      playbackUrl: input.playbackUrl,
      hlsManifestUrl: input.hlsManifestUrl,
      whepUrl: input.whepUrl,
      ingestUrl: input.ingestUrl,
      webRTCUrl: useRelay ? null : input.webRTCUrl,
      streamKey: useRelay ? null : input.streamKey,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.status).json({ code: error.code, message: error.message });
    } else {
      console.error('[cloudflare] Error creating live input:', error);
      res.status(500).json({ code: 'server_error', message: 'Failed to create live input' });
    }
  }
}
