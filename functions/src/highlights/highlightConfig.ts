import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getCloudflareEnv } from '../config/env.js';

export async function highlightConfig(req: Request, res: Response) {
  const env = getCloudflareEnv();
  const available = Boolean(env.accountId && env.apiToken);

  res.json({
    available,
    version: '1.0',
  });
}
