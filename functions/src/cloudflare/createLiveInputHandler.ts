import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { db } from '../shared/firestore.js';
import { createLiveInput, createCloudflareClient } from './cloudflareClient.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField, requireLiveCreator, requirePublicActiveLive } from '../shared/validation.js';

const RTMPS_RELAY_URL = process.env.RTMPS_RELAY_URL || '';

interface DestinationInput {
  url: string;
  streamKey: string;
  provider?: string;
  name?: string;
}

export async function createLiveInputHandler(req: Request, res: Response) {
  try {
    const user = await authenticateUser(req);
    const body = asRecord(req.body);
    const streamId = stringField(body, 'streamId', { required: true, max: 64 })!;
    const title = stringField(body, 'title', { required: true, max: 120 }) ?? 'Untitled';
    const rawDestinations = Array.isArray(body.destinations) ? body.destinations as DestinationInput[] : [];

    console.log(`[createLiveInput] requested for Vuvio live=${streamId} user=${user.uid}`);

    const liveRef = db.collection('activeLives').doc(streamId);

    // Detect stale Cloudflare UID in Firestore and warn — we always create fresh credentials
    const existingDoc = await liveRef.get().catch(() => null);
    if (!existingDoc?.exists) throw new ApiError('not_found', 'Live not found');
    const existingLive = existingDoc.data() as Record<string, unknown>;
    requireLiveCreator(existingLive, user.uid);
    requirePublicActiveLive(existingLive);
    const existingCfUid = existingDoc?.exists
      ? ((existingDoc.data() as Record<string, unknown>)?.cloudflareLiveInputId as string | undefined) ?? null
      : null;
    if (existingCfUid) {
      const checkClient = createCloudflareClient();
      const isValid = await checkClient.getLiveInput(existingCfUid).then(() => true).catch(() => false);
      console.log(`[createLiveInput] Firestore has existing CF uid=${existingCfUid} — valid=${isValid}`);
      if (!isValid) {
        console.warn(`[createLiveInput] stale/deleted CF uid=${existingCfUid} — creating fresh live input`);
      }
    }

    const input = await createLiveInput({
      name: title,
      description: `Created by ${user.uid}`,
    });

    if (!input || !input.uid) {
      throw new ApiError('server_error', 'Failed to create Cloudflare live input');
    }

    console.log(`[createLiveInput] Cloudflare UID = ${input.uid}`);
    console.log(`[createLiveInput] timeoutSeconds = 10`);
    console.log(`[CLOUDFLARE] live input created — uid: ${input.uid} | stream: ${streamId} | title: ${title}`);

    const client = createCloudflareClient();

    // Immediately verify new live input exists
    const verified = await client.getLiveInput(input.uid).then((v) => !!v?.uid).catch(() => false);
    console.log(`[createLiveInput] post-create verify — UID ${input.uid} exists=${verified}`);

    // Force recording mode — Cloudflare sometimes ignores mode in create payload
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

    await liveRef.update(cloudflareFields);

    const hasRelay = Boolean(RTMPS_RELAY_URL && input.ingestUrl && input.streamKey);
    console.log(`[CLOUDFLARE] relay check — relayUrl: ${RTMPS_RELAY_URL || 'none'} | rtmpsIngestUrl: ${input.ingestUrl ?? 'none'} | rtmpsStreamKey present: ${!!input.streamKey}`);

    // ── Create live outputs (multistream destinations) in the same request ──
    const outputResults: Array<{ outputId: string; provider: string; name: string; enabled: boolean; status: string }> = [];
    if (rawDestinations.length > 0) {
      console.log(`[createLiveInput] creating ${rawDestinations.length} live output(s) for liveInputId=${input.uid}`);
      await Promise.all(rawDestinations.map(async (dest) => {
        const provider = dest.provider ?? 'custom';
        const name = dest.name ?? provider;
        try {
          const output = await client.createLiveOutput(input.uid!, dest.url, dest.streamKey);
          outputResults.push({ outputId: output.outputId, provider, name, enabled: output.enabled, status: 'live' });
          console.log(`[MULTISTREAM] output created provider=${provider} outputId=${output.outputId}`);
        } catch (err) {
          outputResults.push({ outputId: '', provider, name, enabled: false, status: 'error' });
          console.warn(`[MULTISTREAM] output creation failed provider=${provider}:`, err instanceof Error ? err.message : err);
        }
      }));

      // Persist output metadata to Firestore (no stream keys)
      if (outputResults.some((o) => o.outputId)) {
        await liveRef.update({
          liveOutputs: outputResults.filter((o) => o.outputId).map((o) => ({
            outputId: o.outputId, provider: o.provider, name: o.name, enabled: o.enabled, createdAt: new Date().toISOString(),
          })),
        }).catch(() => {});
      }
    }

    res.json({
      liveInputId: input.uid,
      playbackUrl: input.playbackUrl,
      hlsManifestUrl: input.hlsManifestUrl,
      whepUrl: input.whepUrl,
      ingestUrl: input.ingestUrl,
      webRTCUrl: input.webRTCUrl,
      streamKey: input.streamKey,
      relayUrl: hasRelay ? RTMPS_RELAY_URL : null,
      rtmpsIngestUrl: hasRelay ? input.ingestUrl : null,
      rtmpsStreamKey: hasRelay ? input.streamKey : null,
      outputs: outputResults,
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
