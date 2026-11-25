import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { db } from '../shared/firestore.js';
import { getCloudflareEnv } from '../config/env.js';

export async function getReplayDownload(req: Request, res: Response, liveId: string) {
  const user = await authenticateUser(req);

  const snap = await db.collection('activeLives').doc(liveId).get();
  if (!snap.exists) throw new ApiError('not_found', 'Live not found');

  const data = snap.data() ?? {};
  const creatorUid = typeof data.creatorUid === 'string' ? data.creatorUid
    : typeof data.creatorId === 'string' ? data.creatorId : '';
  if (creatorUid && creatorUid !== user.uid) {
    throw new ApiError('forbidden', 'Only the creator can download this replay');
  }

  const videoUid = typeof data.recordingUid === 'string' && data.recordingUid ? data.recordingUid
    : typeof data.cloudflareVideoId === 'string' && data.cloudflareVideoId ? data.cloudflareVideoId : '';
  if (!videoUid) throw new ApiError('bad_request', 'No recording available for download');

  const { accountId, apiToken } = getCloudflareEnv();
  if (!accountId || !apiToken) throw new ApiError('server_error', 'Cloudflare not configured');

  // POST is idempotent — creates MP4 download job if not exists, returns current status otherwise
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  let cfResponse: Awaited<ReturnType<typeof fetch>>;
  try {
    cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(videoUid)}/downloads`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: '{}',
        signal: ctrl.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  const body = await cfResponse.json().catch(() => ({})) as {
    success?: boolean;
    result?: { default?: { status?: string; url?: string; pctComplete?: number } };
    errors?: unknown[];
  };

  if (!cfResponse.ok || body?.success === false) {
    console.error('[replay-download] Cloudflare error', { status: cfResponse.status, errors: body?.errors });
    throw new ApiError('server_error', 'Cloudflare download generation failed');
  }

  const dl = body?.result?.default ?? {};
  const status = typeof dl.status === 'string' ? dl.status : 'inprogress';
  const url = status === 'ready' && typeof dl.url === 'string' ? dl.url : '';
  const pctComplete = typeof dl.pctComplete === 'number' ? dl.pctComplete : null;

  console.log(`[replay-download] liveId=${liveId} videoUid=${videoUid} status=${status} pct=${pctComplete}`);
  res.json({ success: true, status, url, pctComplete, videoUid });
}
