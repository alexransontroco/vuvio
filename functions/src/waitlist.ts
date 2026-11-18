import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { adminAuth, db } from './shared/firestore.js';

const turnstileSecret = defineSecret('WAITLIST_TURNSTILE_SECRET');
const hashSecret = defineSecret('WAITLIST_HASH_SECRET');
const resendApiKey = defineSecret('RESEND_API_KEY');
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const adminEmails = new Set([
  'alexandre.ranson@gmail.com',
  'doug.benchetrit@gmail.com',
  'cecilia.ranson@outlook.com',
]);

function digest(value: string) {
  return createHmac('sha256', hashSecret.value()).update(value).digest('hex');
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 254 && emailPattern.test(email) ? email : '';
}

function clientIp(req: Request) {
  return req.ip || req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function checkRateLimit(ip: string) {
  const ref = db.collection('launchWaitlistRateLimits').doc(digest(ip));
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    const resetAt = typeof data?.resetAt === 'number' && data.resetAt > now ? data.resetAt : now + 3600_000;
    const count = resetAt === data?.resetAt ? (data.count || 0) + 1 : 1;
    tx.set(ref, { count, resetAt, expiresAt: Timestamp.fromMillis(resetAt + 86400_000) });
    return count <= 10;
  });
}

async function verifyTurnstile(token: unknown, ip: string) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret.value(), response: token, remoteip: ip }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string };
    const allowed = process.env.WAITLIST_ALLOWED_HOSTNAMES?.split(',').map((host) => host.trim()) || ['vuvio.app', 'www.vuvio.app', 'vuvio-bf328.web.app', 'vuvio-bf328.firebaseapp.com'];
    return result.success === true && allowed.includes(result.hostname || '');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function requireAdmin(req: Request) {
  const match = req.header('authorization')?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const email = token.email?.toLowerCase() || '';
    return token.email_verified === true && (token.admin === true || email.endsWith('@vuvio.app') || adminEmails.has(email));
  } catch {
    return false;
  }
}

function send(res: { status: (code: number) => { json: (body: unknown) => void } }, code: number, body: unknown) {
  res.status(code).json(body);
}

export const waitlist = onRequest({
  region: 'europe-west1',
  secrets: [turnstileSecret, hashSecret],
  maxInstances: 20,
}, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const path = req.path.replace(/^\/api\/waitlist\/?/, '/').replace(/^\/waitlist\/?/, '/');
  try {
    if (req.method === 'POST' && path === '/') {
      const email = normalizeEmail(req.body?.email);
      if (!email) return send(res, 400, { code: 'invalid_email' });
      if (req.body?.website) return send(res, 200, { ok: true });
      if (!hashSecret.value() || !turnstileSecret.value()) return send(res, 503, { code: 'unavailable' });
      const ip = clientIp(req);
      if (!(await checkRateLimit(ip))) return send(res, 429, { code: 'rate_limited' });
      if (!(await verifyTurnstile(req.body?.turnstileToken, ip))) return send(res, 400, { code: 'challenge_failed' });

      const indexRef = db.collection('launchWaitlistEmailIndex').doc(digest(email));
      const entryRef = db.collection('launchWaitlist').doc();
      const unsubscribeToken = randomBytes(32).toString('hex');
      const locale = req.body?.locale === 'en' ? 'en' : 'fr';
      const created = await db.runTransaction(async (tx) => {
        const existing = await tx.get(indexRef);
        if (existing.exists) return false;
        tx.create(indexRef, { entryId: entryRef.id });
        tx.create(entryRef, {
          email,
          emailNormalized: email,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: Timestamp.fromMillis(Date.now() + 730 * 86400_000),
          locale,
          source: 'landing',
          status: 'subscribed',
          consentVersion: 'launch-v2',
          unsubscribeTokenHash: createHash('sha256').update(unsubscribeToken).digest('hex'),
        });
        return true;
      });
      return send(res, 200, created ? { ok: true, entryId: entryRef.id, unsubscribeToken } : { ok: true });
    }

    if (req.method === 'DELETE' && path === '/subscription') {
      const { entryId, token } = req.body || {};
      if (typeof entryId !== 'string' || !/^[A-Za-z0-9]{20}$/.test(entryId) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return send(res, 400, { code: 'invalid_request' });
      }
      const ref = db.collection('launchWaitlist').doc(entryId);
      const snapshot = await ref.get();
      const stored = snapshot.data()?.unsubscribeTokenHash;
      const incoming = createHash('sha256').update(token).digest();
      if (!stored || !/^[a-f0-9]{64}$/.test(stored) || !timingSafeEqual(Buffer.from(stored, 'hex'), incoming)) {
        return send(res, 200, { ok: true });
      }
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists) return;
        tx.delete(ref);
        tx.delete(db.collection('launchWaitlistEmailIndex').doc(digest(current.data()?.emailNormalized || '')));
      });
      return send(res, 200, { ok: true });
    }

    if (path.startsWith('/admin')) {
      if (!(await requireAdmin(req))) return send(res, 403, { code: 'forbidden' });
      const collection = db.collection('launchWaitlist');
      if (req.method === 'GET' && path === '/admin') {
        const now = Date.now();
        const cursorId = typeof req.query.cursor === 'string' && /^[A-Za-z0-9]{20}$/.test(req.query.cursor) ? req.query.cursor : '';
        const cursor = cursorId ? await collection.doc(cursorId).get() : null;
        let pageQuery = collection.orderBy('createdAt', 'desc').limit(100);
        if (cursor?.exists) pageQuery = pageQuery.startAfter(cursor);
        const [total, week, month, page] = await Promise.all([
          collection.count().get(),
          collection.where('createdAt', '>=', Timestamp.fromMillis(now - 7 * 86400_000)).count().get(),
          collection.where('createdAt', '>=', Timestamp.fromMillis(now - 30 * 86400_000)).count().get(),
          pageQuery.get(),
        ]);
        return send(res, 200, {
          total: total.data().count,
          last7Days: week.data().count,
          last30Days: month.data().count,
          nextCursor: page.size === 100 ? page.docs[page.docs.length - 1].id : null,
          entries: page.docs.map((doc) => {
            const item = doc.data();
            return { id: doc.id, email: item.email, createdAt: item.createdAt?.toDate().toISOString(), locale: item.locale, source: item.source };
          }),
        });
      }
      if (req.method === 'GET' && path === '/admin/export') {
        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', 'attachment; filename="vuvio-launch-waitlist.csv"');
        res.write('\ufeffemail,createdAt,locale,source,status\r\n');
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
        while (true) {
          let query = collection.orderBy('createdAt', 'desc').limit(500);
          if (cursor) query = query.startAfter(cursor);
          const page = await query.get();
          for (const doc of page.docs) {
            const item = doc.data();
            const cells = [item.email, item.createdAt?.toDate().toISOString(), item.locale, item.source, item.status];
            res.write(cells.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\r\n');
          }
          if (page.size < 500) break;
          cursor = page.docs[page.docs.length - 1];
        }
        res.end();
        return;
      }
      if (req.method === 'DELETE' && /^\/admin\/[A-Za-z0-9]{20}$/.test(path)) {
        const ref = collection.doc(path.split('/')[2]);
        await db.runTransaction(async (tx) => {
          const snapshot = await tx.get(ref);
          if (!snapshot.exists) return;
          tx.delete(ref);
          tx.delete(db.collection('launchWaitlistEmailIndex').doc(digest(snapshot.data()?.emailNormalized || '')));
        });
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { code: 'not_found' });
  } catch (error) {
    console.error('[waitlist] request failed', error instanceof Error ? error.message : error);
    if (!res.headersSent) return send(res, 500, { code: 'server_error' });
    res.end();
  }
});

export const sendWaitlistConfirmation = onDocumentCreated({
  document: 'launchWaitlist/{entryId}',
  region: 'europe-west1',
  secrets: [resendApiKey],
}, async (event) => {
  const entry = event.data?.data();
  const email = normalizeEmail(entry?.email);
  if (!email || entry?.source !== 'landing' || entry?.status !== 'subscribed') return;

  const current = await event.data?.ref.get();
  if (!current?.exists || current.data()?.status !== 'subscribed' || current.data()?.confirmationEmailSentAt) return;

  const key = resendApiKey.value();
  if (!key) {
    console.error('[waitlist-confirmation] RESEND_API_KEY is missing');
    return;
  }

  const french = entry.locale !== 'en';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'idempotency-key': `waitlist-confirmation/${event.params.entryId}`,
      },
      body: JSON.stringify({
        from: 'Vuvio <hello@vuvio.app>',
        to: [email],
        subject: french ? 'Merci pour votre inscription à Vuvio' : 'Thanks for joining Vuvio',
        text: french
          ? 'Bonjour,\n\nMerci de vous être inscrit à la liste d’attente de Vuvio ! Nous vous tiendrons informé de notre lancement.\n\nÀ bientôt,\nL’équipe Vuvio\n\nPour retirer votre inscription, répondez à cet email ou écrivez à hello@vuvio.app.'
          : 'Hello,\n\nThanks for joining the Vuvio waitlist! We’ll let you know when we launch.\n\nSee you soon,\nThe Vuvio team\n\nTo remove your signup, reply to this email or write to hello@vuvio.app.',
        reply_to: 'hello@vuvio.app',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[waitlist-confirmation] delivery failed', { entryId: event.params.entryId, status: response.status });
      if (response.status === 409 || response.status === 429 || response.status >= 500) throw new Error(`Resend HTTP ${response.status}`);
      return;
    }
    await event.data?.ref.update({ confirmationEmailSentAt: FieldValue.serverTimestamp() });
    console.info('[waitlist-confirmation] accepted', { entryId: event.params.entryId });
  } finally {
    clearTimeout(timer);
  }
});

export const cleanupWaitlist = onSchedule({
  region: 'europe-west1',
  schedule: 'every 24 hours',
  secrets: [hashSecret],
}, async () => {
  const now = Timestamp.now();
  for (const [name, field] of [['launchWaitlist', 'expiresAt'], ['launchWaitlistRateLimits', 'expiresAt']] as const) {
    while (true) {
      const page = await db.collection(name).where(field, '<=', now).limit(200).get();
      if (page.empty) break;
      const batch = db.batch();
      for (const snapshot of page.docs) {
        batch.delete(snapshot.ref);
        if (name === 'launchWaitlist') {
          batch.delete(db.collection('launchWaitlistEmailIndex').doc(digest(snapshot.data().emailNormalized)));
        }
      }
      await batch.commit();
    }
  }
});
