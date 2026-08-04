import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCloudflareEnv } from '../config/env.js';
export function verifyCloudflareWebhook(rawBody, signature) {
    const secret = getCloudflareEnv().webhookSecret;
    if (!secret) {
        console.warn('[cloudflare-webhook] Webhook secret is not configured. Signature verification is disabled.');
        return true;
    }
    if (!signature)
        return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const normalized = signature.replace(/^sha256=/i, '');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(normalized, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}
