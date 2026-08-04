import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { verifyCloudflareWebhook } from './verifyCloudflareWebhook.js';
import { addStreamEvent } from '../streams/streamHelpers.js';
import { endStream } from '../streams/endStream.js';

const eventMap: Record<string, string> = {
  'live_input.connected': 'input_connected',
  'live_input.disconnected': 'input_disconnected',
  'live_input.started': 'live_started',
  'live_input.ended': 'live_ended',
  'video.ready': 'video_ready',
  'video.errored': 'error',
};

function fakeResponse() {
  return {
    json: () => undefined,
    status: () => ({ json: () => undefined }),
  } as never;
}

function extractEvent(body: Record<string, unknown>) {
  const id = String(body.id ?? body.eventId ?? body.uid ?? `${body.type ?? 'unknown'}-${Date.now()}`);
  const type = String(body.type ?? body.event ?? body.name ?? 'unknown');
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
  const meta = data.meta && typeof data.meta === 'object' ? data.meta as Record<string, unknown> : {};
  const streamId = String(data.streamId ?? meta.streamId ?? body.streamId ?? '');
  return { id, type, mapped: eventMap[type] ?? type, streamId, data };
}

export async function cloudflareWebhook(req: Request, res: Response) {
  const signature = req.header('cf-webhook-signature') ?? req.header('webhook-signature') ?? req.header('x-cloudflare-signature') ?? undefined;
  if (!verifyCloudflareWebhook(req.rawBody, signature)) throw new ApiError('forbidden', 'Invalid webhook signature');

  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const event = extractEvent(body);
  const eventRef = db.collection(collections.webhookEvents).doc(event.id);

  const accepted = await db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) return false;
    tx.set(eventRef, {
      id: event.id,
      type: event.type,
      mappedType: event.mapped,
      streamId: event.streamId || null,
      receivedAt: FieldValue.serverTimestamp(),
      processedAt: null,
    });
    return true;
  });

  if (!accepted) {
    res.status(200).json({ accepted: true, deduped: true });
    return;
  }

  if (event.streamId) {
    const streamRef = db.collection(collections.streams).doc(event.streamId);
    if (event.mapped === 'input_connected' || event.mapped === 'live_started') {
      await streamRef.set({ status: 'connecting', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (event.mapped === 'input_disconnected') {
      await streamRef.set({ networkStatus: 'disconnected', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    if (event.mapped === 'live_ended') {
      await endStream({ body: { reason: 'cloudflare_ended' } } as never, fakeResponse(), event.streamId, 'cloudflare_ended');
    }
    addStreamEvent(event.streamId, {
      type: event.mapped === 'live_ended' ? 'stream_ended' : event.mapped === 'input_disconnected' ? 'connection_lost' : 'heartbeat',
      userId: null,
      anonymousSessionId: null,
      source: 'direct',
      metadata: { cloudflareEventType: event.type, mappedType: event.mapped },
    });
  }

  await eventRef.update({ processedAt: FieldValue.serverTimestamp() });
  res.status(202).json({ accepted: true });
}
