import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendError, ApiError } from './shared/errors.js';
import { cloudflareAccountId, cloudflareApiToken, cloudflareCustomerCode, cloudflareWebhookSecret } from './config/env.js';
import { createStream } from './streams/createStream.js';
import { startStream } from './streams/startStream.js';
import { heartbeatStream } from './streams/heartbeatStream.js';
import { endStream } from './streams/endStream.js';
import { getStream } from './streams/getStream.js';
import { listGlobeStreams, listLiveStreams } from './streams/listLiveStreams.js';
import { attachGearToStream } from './gear/attachGearToStream.js';
import { getStreamGear } from './gear/getStreamGear.js';
import { trackStreamEvent } from './analytics/trackStreamEvent.js';
import { ingestEvents } from './analytics/ingestEvents.js';
import { aggregateStreamStats, aggregateCreatorStats, aggregateCategoryStats, aggregateUserAnalytics } from './analytics/aggregateStats.js';
import { cloudflareWebhook } from './cloudflare/cloudflareWebhook.js';
import { getCloudflareConfig, getCloudflareInputs, postCreateTestInput } from './cloudflare/testRouteHandlers.js';
import { monitorStreamHeartbeats } from './streams/monitorStreamHeartbeats.js';
import { processProductImage } from './products/processProductImage.js';
function pathParts(path = '') {
    return path.replace(/^\/api\/?/, '/').split('/').filter(Boolean);
}
function sendCors(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, cf-webhook-signature, webhook-signature, x-cloudflare-signature');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
export const api = onRequest({
    region: 'europe-west1',
    secrets: [cloudflareAccountId, cloudflareApiToken, cloudflareWebhookSecret, cloudflareCustomerCode],
}, async (req, res) => {
    sendCors(res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const parts = pathParts(req.path);
        if (req.method === 'POST' && parts[0] === 'streams' && parts.length === 1)
            return await createStream(req, res);
        if (req.method === 'GET' && parts[0] === 'streams' && parts[1] === 'live')
            return await listLiveStreams(req, res);
        if (req.method === 'GET' && parts[0] === 'globe' && parts[1] === 'streams')
            return await listGlobeStreams(req, res);
        if (req.method === 'GET' && parts[0] === 'streams' && parts[1])
            return await getStream(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'start')
            return await startStream(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'heartbeat')
            return await heartbeatStream(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'end')
            return await endStream(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'gear')
            return await attachGearToStream(req, res, parts[1]);
        if (req.method === 'GET' && parts[0] === 'streams' && parts[2] === 'gear')
            return await getStreamGear(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'events')
            return await trackStreamEvent(req, res, parts[1]);
        if (req.method === 'POST' && parts[0] === 'analytics' && parts[1] === 'events')
            return await ingestEvents(req, res);
        if (req.method === 'POST' && parts[0] === 'webhooks' && parts[1] === 'cloudflare')
            return await cloudflareWebhook(req, res);
        if (req.method === 'POST' && parts[0] === 'products' && parts[1] === 'process-image')
            return await processProductImage(req, res);
        // Cloudflare test routes
        if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'config')
            return await getCloudflareConfig(req, res);
        if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'inputs')
            return await getCloudflareInputs(req, res);
        if (req.method === 'POST' && parts[0] === 'cloudflare' && parts[1] === 'create-test-input')
            return await postCreateTestInput(req, res);
        throw new ApiError('not_found', 'Route not found');
    }
    catch (error) {
        sendError(res, error);
    }
});
export const checkStreamHeartbeats = onSchedule({
    region: 'europe-west1',
    schedule: 'every 1 minutes',
}, async () => {
    await monitorStreamHeartbeats();
});
export const aggregateStatsScheduled = onSchedule({
    region: 'europe-west1',
    schedule: 'every 5 minutes',
}, async () => {
    try {
        await aggregateStreamStats();
        await aggregateCreatorStats();
        await aggregateCategoryStats();
    }
    catch (error) {
        console.error('[Aggregation] Failed:', error);
    }
});
export const aggregateUserAnalyticsScheduled = onSchedule({
    region: 'europe-west1',
    schedule: 'every 1 hours',
}, async () => {
    try {
        await aggregateUserAnalytics();
    }
    catch (error) {
        console.error('[UserAnalytics] Failed:', error);
    }
});
