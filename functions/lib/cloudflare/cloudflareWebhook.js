import { FieldValue } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { verifyCloudflareWebhook } from './verifyCloudflareWebhook.js';
import { addStreamEvent } from '../streams/streamHelpers.js';
import { endStream } from '../streams/endStream.js';
import { getCloudflareEnv } from '../config/env.js';
import { createCloudflareClient } from './cloudflareClient.js';
const eventMap = {
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
    };
}
function extractEvent(body) {
    const id = String(body.id ?? body.eventId ?? body.uid ?? `${body.type ?? 'unknown'}-${Date.now()}`);
    const type = String(body.type ?? body.event ?? body.name ?? 'unknown');
    const data = (body.data && typeof body.data === 'object' ? body.data : body);
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    const streamId = String(data.streamId ?? meta.streamId ?? body.streamId ?? '');
    return { id, type, mapped: eventMap[type] ?? type, streamId, data };
}
function extractLiveInputUid(body, data) {
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    return String(data.liveInput
        ?? data.liveInputUid
        ?? data.live_input
        ?? data.live_input_uid
        ?? meta.liveInput
        ?? meta.liveInputUid
        ?? body.liveInput
        ?? body.liveInputUid
        ?? body.live_input
        ?? body.live_input_uid
        ?? '');
}
export async function cloudflareWebhook(req, res) {
    const signature = req.header('cf-webhook-signature') ?? req.header('webhook-signature') ?? req.header('x-cloudflare-signature') ?? undefined;
    if (!verifyCloudflareWebhook(req.rawBody, signature))
        throw new ApiError('forbidden', 'Invalid webhook signature');
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const event = extractEvent(body);
    const eventRef = db.collection(collections.webhookEvents).doc(event.id);
    const accepted = await db.runTransaction(async (tx) => {
        const existing = await tx.get(eventRef);
        if (existing.exists)
            return false;
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
    if (event.mapped === 'video_ready') {
        const { customerCode } = getCloudflareEnv();
        const recordingUid = String(body.uid ?? '');
        const liveInputUid = extractLiveInputUid(body, event.data);
        console.log(`[cloudflare-webhook] video.ready — recordingUid=${recordingUid} liveInputUid=${liveInputUid}`);
        const recordingUrl = recordingUid
            ? `https://customer-${customerCode}.cloudflarestream.com/${recordingUid}/manifest/video.m3u8`
            : '';
        if (recordingUid) {
            // Try cloudflareLiveInputId first, then liveInputId (set by WatchPage frontend)
            let snap = await db.collection('activeLives')
                .where('cloudflareLiveInputId', '==', liveInputUid)
                .limit(1)
                .get();
            if (snap.empty && liveInputUid) {
                snap = await db.collection('activeLives')
                    .where('liveInputId', '==', liveInputUid)
                    .limit(1)
                    .get();
            }
            if (!snap.empty) {
                const liveRef = snap.docs[0].ref;
                const liveData = snap.docs[0].data();
                await liveRef.set({ replayUrl: recordingUrl, recordingStatus: 'ready', recordingUid, cloudflareVideoId: recordingUid, updatedAt: FieldValue.serverTimestamp(), replayCleanupPending: false }, { merge: true });
                const liveInputId = typeof liveData.cloudflareLiveInputId === 'string' && liveData.cloudflareLiveInputId
                    ? liveData.cloudflareLiveInputId
                    : typeof liveData.liveInputId === 'string' && liveData.liveInputId
                        ? liveData.liveInputId
                        : liveInputUid;
                if (liveInputId && liveData.replayCleanupPending !== false) {
                    await createCloudflareClient().deleteLiveInput(liveInputId).catch((err) => {
                        console.warn(`[cloudflare-webhook] failed to delete live input ${liveInputId}:`, err instanceof Error ? err.message : err);
                    });
                }
                console.log(`[cloudflare-webhook] video.ready saved for liveInput=${liveInputUid} uid=${recordingUid}`);
            }
            else {
                console.warn(`[cloudflare-webhook] video.ready — no activeLives doc found for liveInputUid=${liveInputUid} recordingUid=${recordingUid}`);
            }
        }
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
            await endStream({ body: { reason: 'cloudflare_ended' } }, fakeResponse(), event.streamId, 'cloudflare_ended');
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
