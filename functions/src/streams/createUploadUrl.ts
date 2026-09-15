import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { getCloudflareEnv } from '../config/env.js';

export async function createUploadUrl(req: Request, res: Response, streamId: string) {
  await authenticateUser(req);

  const { accountId, apiToken, customerCode } = getCloudflareEnv();
  if (!accountId || !apiToken) throw new ApiError('server_error', 'Cloudflare not configured');

  // Create a Cloudflare Stream Direct Creator Upload for a one-time multipart POST.
  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 21600, // 6 hours max
        meta: { name: `replay-${streamId}` },
        requireSignedURLs: false,
      }),
    }
  );

  if (!cfRes.ok) {
    const body = await cfRes.text();
    console.error('[createUploadUrl] Cloudflare error:', cfRes.status, body);
    throw new ApiError('server_error', 'Failed to create Cloudflare upload URL');
  }

  const data = await cfRes.json() as { result?: { uid?: string; uploadURL?: string } };
  const uid = data.result?.uid;
  const uploadUrl = data.result?.uploadURL;

  if (!uid || !uploadUrl) throw new ApiError('server_error', 'Invalid Cloudflare response');

  const hlsUrl = `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
  console.log(`[createUploadUrl] Created upload URL for stream ${streamId}, uid: ${uid}`);

  // Don't expose uploadUrl in logs — only return to authenticated client
  res.json({ cloudflareUid: uid, uploadUrl, replayUrl: hlsUrl });
}
