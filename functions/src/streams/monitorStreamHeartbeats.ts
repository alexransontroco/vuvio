import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { STREAM_TIMEOUTS } from '../config/env.js';
import { collections, db } from '../shared/firestore.js';
import { addStreamEvent } from './streamHelpers.js';
import { endStream } from './endStream.js';
import type { StreamDocument } from '../types/stream.js';

function fakeResponse() {
  return {
    json: () => undefined,
    status: () => ({ json: () => undefined }),
  } as never;
}

export async function monitorStreamHeartbeats() {
  const snap = await db.collection(collections.streams)
    .where('status', 'in', ['live', 'reconnecting'])
    .get();

  const nowMs = Date.now();
  await Promise.all(snap.docs.map(async (doc) => {
    const stream = doc.data() as StreamDocument;
    const lastMs = stream.lastHeartbeatAt?.toMillis?.() ?? stream.startedAt?.toMillis?.() ?? stream.createdAt.toMillis();
    const staleSeconds = Math.floor((nowMs - lastMs) / 1000);

    if (stream.status === 'live' && staleSeconds >= STREAM_TIMEOUTS.reconnectAfterSeconds) {
      await doc.ref.update({
        status: 'reconnecting',
        networkStatus: 'disconnected',
        interruptionCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      addStreamEvent(stream.id, {
        type: 'connection_lost',
        userId: null,
        anonymousSessionId: null,
        source: 'direct',
        metadata: { staleSeconds },
        occurredAt: Timestamp.now(),
      });
      return;
    }

    if (stream.status === 'reconnecting' && staleSeconds >= STREAM_TIMEOUTS.endAfterSeconds) {
      await endStream({ body: { reason: 'heartbeat_timeout' } } as never, fakeResponse(), stream.id, 'heartbeat_timeout');
    }
  }));
}
