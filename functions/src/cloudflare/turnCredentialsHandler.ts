import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getMeteredEnv } from '../config/env.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { sendError, ApiError } from '../shared/errors.js';

const TTL_SECONDS = 3600;

interface MeteredIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export async function turnCredentialsHandler(req: Request, res: Response) {
  try {
    await authenticateUser(req);

    const { apiKey, appName } = getMeteredEnv();

    if (!apiKey || !appName) {
      res.status(404).json({ code: 'not_configured', message: 'TURN service not configured' });
      return;
    }

    const response = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { method: 'GET' },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[turnCredentials] Metered error', response.status, body);
      throw new ApiError('server_error', 'Failed to get TURN credentials from Metered');
    }

    const servers = await response.json() as MeteredIceServer[];
    if (!Array.isArray(servers) || servers.length === 0) {
      throw new ApiError('server_error', 'Unexpected TURN credentials format');
    }

    // Normalize: ensure urls is always an array
    const iceServers = servers.map((s) => ({
      ...s,
      urls: Array.isArray(s.urls) ? s.urls : [s.urls],
    }));

    res.json({ iceServers, ttlSeconds: TTL_SECONDS });
  } catch (err) {
    sendError(res, err);
  }
}
