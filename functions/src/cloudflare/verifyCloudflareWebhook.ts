import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCloudflareEnv } from '../config/env.js';

// Cloudflare Stream sends `Webhook-Signature: time=<epoch>,sig1=<hex>`
// where sig1 = HMAC-SHA256(secret, `${time}.${rawBody}`) as hex.
export function verifyCloudflareWebhook(rawBody: Buffer, signature: string | undefined) {
  const secret = getCloudflareEnv().webhookSecret;
  if (!secret) {
    console.warn('[cloudflare-webhook] Webhook secret is not configured. Signature verification is disabled.');
    return true;
  }
  if (!signature) return false;

  const parts = signature.split(',').reduce<Record<string, string>>((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) acc[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    return acc;
  }, {});
  const time = parts.time;
  const sig1 = parts.sig1;
  if (!time || !sig1) return false;

  const signedPayload = `${time}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
