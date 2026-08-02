import { createCloudflareClient } from './cloudflareClient.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { asRecord, stringField } from '../shared/validation.js';
import { ApiError } from '../shared/errors.js';

export async function createLiveInputRoute(req, res) {
  const user = await authenticateUser(req);
  const body = asRecord(req.body);
  const streamId = stringField(body, 'streamId', { required: true });
  const title = stringField(body, 'title', { required: true, max: 120 });

  const cloudflare = await createCloudflareClient().createLiveInput({ streamId, title });

  if (!cloudflare.liveInputId || !cloudflare.uid) {
    console.error('[createLiveInputRoute] Cloudflare live input creation failed', { cloudflare });
    throw new ApiError('server_error', 'Failed to create Cloudflare live input');
  }

  res.status(201).json({
    liveInputId: cloudflare.liveInputId,
    uid: cloudflare.uid,
    playbackUrl: cloudflare.playbackUrl,
    hlsManifestUrl: cloudflare.hlsManifestUrl,
    ingestUrl: cloudflare.ingestUrl,
    streamKey: cloudflare.streamKey,
  });
}
