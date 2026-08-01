import { FieldValue } from 'firebase-admin/firestore';
import { createCloudflareClient } from '../cloudflare/cloudflareClient.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { collections, db } from '../shared/firestore.js';
import { asRecord, parseApproximateLocation, parseEnvironment, parseVisibility, stringArray, stringField } from '../shared/validation.js';
import { assertGearOwnership } from '../gear/gearHelpers.js';
import { addStreamEvent } from './streamHelpers.js';
import { initializeStats } from '../analytics/stats.js';
export async function createStream(req, res) {
    const user = await authenticateUser(req);
    const body = asRecord(req.body);
    const title = stringField(body, 'title', { required: true, max: 120 });
    const category = stringField(body, 'category', { required: true, max: 64 });
    const description = stringField(body, 'description', { max: 500 }) ?? null;
    const environment = parseEnvironment(body.environment);
    const visibility = parseVisibility(body.visibility);
    const gearIds = await assertGearOwnership(user.uid, stringArray(body, 'gearIds', 20));
    const subcategories = stringArray(body, 'subcategories', 8);
    const languages = stringArray(body, 'languages', 6, 12);
    const approximateLocation = parseApproximateLocation(body);
    const city = stringField(body, 'city', { max: 80 }) ?? null;
    const countryCode = stringField(body, 'countryCode', { max: 2 })?.toUpperCase() ?? null;
    const ref = db.collection(collections.streams).doc();
    const cloudflare = await createCloudflareClient().createLiveInput({ streamId: ref.id, title });
    const now = FieldValue.serverTimestamp();
    const stream = {
        id: ref.id,
        creatorId: user.uid,
        title,
        description,
        category,
        subcategories,
        environment,
        status: 'preparing',
        visibility,
        countryCode,
        city,
        approximateLocation,
        languages: languages.length ? languages : ['en'],
        cloudflareLiveInputId: cloudflare.liveInputId,
        cloudflareUid: cloudflare.uid,
        playbackUrl: cloudflare.playbackUrl,
        hlsManifestUrl: cloudflare.hlsManifestUrl,
        startedAt: null,
        endedAt: null,
        lastHeartbeatAt: null,
        durationSeconds: 0,
        currentViewerCount: 0,
        peakViewerCount: 0,
        totalUniqueViewers: 0,
        gearIds,
        networkStatus: 'unknown',
        interruptionCount: 0,
        disconnectedSeconds: 0,
        moderationStatus: 'pending',
        recommendationStatus: 'eligible',
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(stream);
    await initializeStats(ref.id);
    addStreamEvent(ref.id, {
        type: 'stream_created',
        userId: user.uid,
        anonymousSessionId: null,
        source: 'direct',
        metadata: {},
    });
    res.status(201).json({
        stream: {
            id: ref.id,
            status: 'preparing',
            playbackUrl: cloudflare.playbackUrl,
            hlsManifestUrl: cloudflare.hlsManifestUrl,
        },
        ingest: {
            url: cloudflare.ingestUrl,
            streamKey: cloudflare.streamKey,
        },
    });
}
