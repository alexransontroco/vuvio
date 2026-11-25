import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendError, ApiError } from './shared/errors.js';
import { cloudflareAccountId, cloudflareApiToken, cloudflareCustomerCode, cloudflareWebhookSecret, openaiApiKey, icecatUsername, icecatPassword, ebayClientId, ebayClientSecret } from './config/env.js';
import { createStream } from './streams/createStream.js';
import { createScheduledStream } from './streams/createScheduledStream.js';
import { startStream } from './streams/startStream.js';
import { heartbeatStream } from './streams/heartbeatStream.js';
import { endStream } from './streams/endStream.js';
import { finishStream } from './streams/finishStream.js';
import { getStream } from './streams/getStream.js';
import { listGlobeStreams, listLiveStreams } from './streams/listLiveStreams.js';
import { attachGearToStream } from './gear/attachGearToStream.js';
import { getStreamGear } from './gear/getStreamGear.js';
import { trackStreamEvent } from './analytics/trackStreamEvent.js';
import { ingestEvents } from './analytics/ingestEvents.js';
import { aggregateStreamStats, aggregateCreatorStats, aggregateCategoryStats, aggregateUserAnalytics } from './analytics/aggregateStats.js';
import { cloudflareWebhook } from './cloudflare/cloudflareWebhook.js';
import { getCloudflareConfig, getCloudflareInputs, postCreateTestInput, getRawLiveInput, getRawVideos } from './cloudflare/testRouteHandlers.js';
import { createLiveInputHandler } from './cloudflare/createLiveInputHandler.js';
import { createLiveOutputHandler, deleteLiveOutputHandler, listLiveOutputsHandler } from './cloudflare/liveOutputHandlers.js';
import { turnCredentialsHandler } from './cloudflare/turnCredentialsHandler.js';
import { monitorStreamHeartbeats } from './streams/monitorStreamHeartbeats.js';
import { cleanupStaleLives } from './streams/cleanupStaleLives.js';
import { processProductImage } from './products/processProductImage.js';
import { searchProductsHandler, getProductHandler, importProductHandler } from './products/productRoutes.js';
import { resolveAffiliateHandler } from './affiliate/affiliateRoutes.js';
import { requestHighlight } from './highlights/requestHighlight.js';
import { getHighlightStatus } from './highlights/getHighlightStatus.js';
import { cancelHighlight } from './highlights/cancelHighlight.js';
import { highlightConfig } from './highlights/highlightConfig.js';
import { processHighlights } from './highlights/processHighlights.js';
import { createUploadUrl } from './streams/createUploadUrl.js';
import { listScheduledStreams } from './streams/listScheduledStreams.js';
import { activateScheduledStream } from './streams/activateScheduledStream.js';
import { ogImageHandler, ogMetaHandler } from './og/ogMetaHandler.js';
import { getReplayStatus } from './streams/getReplayStatus.js';
import { processVideoAnalysisJob } from './videoProcessing/processVideoAnalysisJob.js';
import { remindScheduledStreams } from './streams/remindScheduledStreams.js';
import { cancelScheduledStream } from './streams/cancelScheduledStream.js';
import { updateAllTrustScores } from './users/updateTrustScore.js';
import { fanOutCreatorLive } from './notifications/fanOutCreatorLive.js';
import { notifyNewFollower } from './notifications/notifyNewFollower.js';
import { notifyNewMessage } from './notifications/notifyNewMessage.js';
import { deleteOwnAccount } from './users/deleteOwnAccount.js';
import { syncFinancialDataHandler, getFinancialDataHandler } from './admin/syncFinancialDataHandler.js';
import { getReplayDownload } from './streams/getReplayDownload.js';
import { deleteReplay } from './streams/deleteReplay.js';

function pathParts(path = '') {
  return path.replace(/^\/api\/?/, '/').split('/').filter(Boolean);
}

function sendCors(res: { set: (key: string, value: string) => void }) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, cf-webhook-signature, webhook-signature, x-cloudflare-signature');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
}

export const api = onRequest({
  region: 'europe-west1',
  timeoutSeconds: 540,
  memory: '2GiB',
  // Secrets alignés sur ce qui est bindé au `api` déployé (9 secrets).
  // Metered/Amazon-PA/Awin sont déclarés dans env.ts mais pas provisionnés : les handlers (turnCredentialsHandler, affiliateRoutes) tombent sur un fallback "not configured" via sv() + undefined-guards.
  secrets: [cloudflareAccountId, cloudflareApiToken, cloudflareWebhookSecret, cloudflareCustomerCode, openaiApiKey, icecatUsername, icecatPassword, ebayClientId, ebayClientSecret],
}, async (req, res) => {
  sendCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const parts = pathParts(req.path);
    if (req.path.includes('output') || req.path.includes('live-input')) {
      console.log(`[router] method=${req.method} path=${req.path} parts=${JSON.stringify(parts)}`);
    }

    // Open Graph share preview routes
    if (req.method === 'GET' && parts[0] === 'share' && parts[1] === 'live' && parts[3] === 'recap' && parts[4] === 'image') return await ogImageHandler(req, res, parts[2], true);
    if (req.method === 'GET' && parts[0] === 'share' && parts[1] === 'live' && parts[3] === 'image') return await ogImageHandler(req, res, parts[2]);
    if (req.method === 'GET' && parts[0] === 'share' && parts[1] === 'live' && parts[3] === 'recap') return await ogMetaHandler(req, res, parts[2], true);
    if (req.method === 'GET' && parts[0] === 'share' && parts[1] === 'live' && parts[2]) return await ogMetaHandler(req, res, parts[2]);

    if (req.method === 'POST' && parts[0] === 'streams' && parts.length === 1) return await createStream(req, res);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[1] === 'scheduled') return await createScheduledStream(req, res);
    if (req.method === 'GET' && parts[0] === 'streams' && parts[1] === 'live') return await listLiveStreams(req, res);
    if (req.method === 'GET' && parts[0] === 'streams' && parts[1] === 'scheduled') return await listScheduledStreams(req, res);
    if (req.method === 'GET' && parts[0] === 'globe' && parts[1] === 'streams') return await listGlobeStreams(req, res);
    if (req.method === 'GET' && parts[0] === 'streams' && parts[2] === 'replay-status') return await getReplayStatus(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'replay' && parts[3] === 'download') return await getReplayDownload(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'replay' && parts[3] === 'delete') return await deleteReplay(req, res, parts[1]);
    if (req.method === 'GET' && parts[0] === 'streams' && parts[1]) return await getStream(req, res, parts[1]);
    if (req.method === 'DELETE' && parts[0] === 'users' && parts[1] === 'me') return await deleteOwnAccount(req, res);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'start') return await startStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'activate') return await activateScheduledStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'cancel') return await cancelScheduledStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'heartbeat') return await heartbeatStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'end') return await endStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'finish') return await finishStream(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'upload-url') return await createUploadUrl(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'gear') return await attachGearToStream(req, res, parts[1]);
    if (req.method === 'GET' && parts[0] === 'streams' && parts[2] === 'gear') return await getStreamGear(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'streams' && parts[2] === 'events') return await trackStreamEvent(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'analytics' && parts[1] === 'events') return await ingestEvents(req, res);
    if (req.method === 'POST' && parts[0] === 'video-processing-jobs' && parts[2] === 'start') return await processVideoAnalysisJob(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'webhooks' && parts[1] === 'cloudflare') return await cloudflareWebhook(req, res);
    if (req.method === 'POST' && parts[0] === 'products' && parts[1] === 'process-image') return await processProductImage(req, res);
    if (req.method === 'GET' && parts[0] === 'products' && parts[1] === 'search') return await searchProductsHandler(req, res);
    if (req.method === 'GET' && parts[0] === 'products' && parts.length === 2 && parts[1] !== 'search') return await getProductHandler(req, res, parts[1]);
    if (req.method === 'POST' && parts[0] === 'products' && parts[1] === 'import') return await importProductHandler(req, res);
    if (req.method === 'POST' && parts[0] === 'affiliate' && parts[1] === 'resolve') return await resolveAffiliateHandler(req, res);

    // Admin financial routes
    if (req.method === 'POST' && parts[0] === 'admin' && parts[1] === 'financial' && parts[2] === 'sync') return await syncFinancialDataHandler(req, res);
    if (req.method === 'GET' && parts[0] === 'admin' && parts[1] === 'financial' && parts[2] === 'data') return await getFinancialDataHandler(req, res);

    // Highlight generation routes
    if (req.method === 'POST' && parts[0] === 'lives' && parts[2] === 'highlight') return await requestHighlight(req, res, parts[1]);
    if (req.method === 'GET' && parts[0] === 'lives' && parts[2] === 'highlight-status') return await getHighlightStatus(req, res, parts[1]);
    if (req.method === 'DELETE' && parts[0] === 'lives' && parts[2] === 'highlight') return await cancelHighlight(req, res, parts[1], parts[3]);
    if (req.method === 'GET' && parts[0] === 'highlight-config') return await highlightConfig(req, res);

    // Cloudflare routes
    if (req.method === 'GET' && parts[0] === 'turn-credentials') return await turnCredentialsHandler(req, res);
    if (req.method === 'POST' && parts[0] === 'cloudflare' && parts[1] === 'live-input' && parts[2] === 'create') return await createLiveInputHandler(req, res);
    // Live Outputs (simulcasting)
    if (req.method === 'POST' && parts[0] === 'cloudflare' && parts[1] === 'live-input' && parts[3] === 'outputs' && parts.length === 4) return await createLiveOutputHandler(req, res, parts[2]);
    if (req.method === 'DELETE' && parts[0] === 'cloudflare' && parts[1] === 'live-input' && parts[3] === 'outputs' && parts[4]) return await deleteLiveOutputHandler(req, res, parts[2], parts[4]);
    if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'live-input' && parts[3] === 'outputs') return await listLiveOutputsHandler(req, res, parts[2]);
    if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'config') return await getCloudflareConfig(req, res);
    if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'raw-input') return await getRawLiveInput(req, res);
    if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'raw-videos') return await getRawVideos(req, res);
    if (req.method === 'GET' && parts[0] === 'cloudflare' && parts[1] === 'inputs') return await getCloudflareInputs(req, res);
    if (req.method === 'POST' && parts[0] === 'cloudflare' && parts[1] === 'create-test-input') return await postCreateTestInput(req, res);

    throw new ApiError('not_found', 'Route not found');
  } catch (error) {
    sendError(res, error);
  }
});

export const checkStreamHeartbeats = onSchedule({
  region: 'europe-west1',
  schedule: 'every 1 minutes',
}, async () => {
  await monitorStreamHeartbeats();
  try {
    await cleanupStaleLives();
  } catch (error) {
    console.error('[cleanup] Failed to clean up stale lives:', error);
  }
});

export const aggregateStatsScheduled = onSchedule({
  region: 'europe-west1',
  schedule: 'every 5 minutes',
}, async () => {
  try {
    await aggregateStreamStats();
    await aggregateCreatorStats();
    await aggregateCategoryStats();
  } catch (error) {
    console.error('[Aggregation] Failed:', error);
  }
});

export const aggregateUserAnalyticsScheduled = onSchedule({
  region: 'europe-west1',
  schedule: 'every 1 hours',
}, async () => {
  try {
    await aggregateUserAnalytics();
  } catch (error) {
    console.error('[UserAnalytics] Failed:', error);
  }
});

export const processHighlightsScheduled = onSchedule({
  region: 'europe-west1',
  schedule: '* * * * *', // Every minute
}, async () => {
  await processHighlights();
});

export const remindScheduledStreamsScheduled = onSchedule({
  region: 'europe-west1',
  schedule: 'every 1 minutes',
}, async () => {
  await remindScheduledStreams();
});

export const updateTrustScoresScheduled = onSchedule({
  region: 'europe-west1',
  schedule: 'every 24 hours',
}, async () => {
  try {
    await updateAllTrustScores();
  } catch (error) {
    console.error('[trust] scheduled recalculation failed:', error);
  }
});

export { fanOutCreatorLive, notifyNewFollower, notifyNewMessage };

export { createRealtimeSession, publishRealtimeTrack, subscribeRealtimeTrack, closeRealtimeTrack, closeRealtimeSession } from './realtimeTest/realtimeSFUService.js';
