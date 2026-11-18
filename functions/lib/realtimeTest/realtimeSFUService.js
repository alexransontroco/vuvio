/**
 * Cloudflare Realtime SFU Service
 * Official API: https://developers.cloudflare.com/realtime/sfu/api/
 *
 * Key Concepts:
 * - sessionId: Unique per WebRTC connection (Cloudflare SFU identifier)
 * - roomId: Common grouping for Vuvio participants (server-side logic, stored in Firestore)
 * - CF_APP_SECRET: Authenticates backend to Cloudflare
 * - Server verifies permissions on each publish/subscribe operation
 *
 * Important: App Secret does NOT auto-grant permissions between participants.
 * Server must validate access controls for each track operation.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// CF Realtime SFU credentials (from env, never expose to client)
const CF_APP_ID = process.env.CF_APP_ID || '';
const CF_APP_SECRET = process.env.CF_APP_SECRET || '';
// CF Realtime SFU API base URL (official)
// https://developers.cloudflare.com/realtime/sfu/api/
const CF_REALTIME_API_BASE = 'https://rtc.live.cloudflare.com/v1';
class CloudflareRealtimeSFU {
    appId;
    appSecret;
    constructor(appId, appSecret) {
        if (!appId || !appSecret) {
            throw new Error('CF Realtime SFU credentials not configured (CF_APP_ID + CF_APP_SECRET required)');
        }
        this.appId = appId;
        this.appSecret = appSecret;
    }
    /**
     * Call CF Realtime SFU API with proper authentication
     * Authorization uses CF_APP_SECRET (not CF_API_TOKEN)
     */
    async sfuApi(method, path, body) {
        const url = `${CF_REALTIME_API_BASE}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${this.appSecret}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`CF SFU API ${method} ${path}: ${response.status} ${error}`);
        }
        return await response.json();
    }
    /**
     * Create a new SFU session
     * POST /apps/{appId}/sessions
     * Returns: { sessionId, sessionSecret }
     */
    async createSession(roomId) {
        const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions`, {}));
        if (!result.sessionId) {
            throw new Error('No sessionId in CF SFU response');
        }
        return {
            sessionId: result.sessionId,
            sessionSecret: result.sessionSecret || '',
        };
    }
    /**
     * Negotiate SDP offer/answer
     * PUT /apps/{appId}/sessions/{sessionId}/answer
     * Client sends offer -> CF returns answer
     */
    async negotiateOffer(sessionId, offer) {
        const result = (await this.sfuApi('PUT', `/apps/${this.appId}/sessions/${sessionId}/answer`, {
            sdp: offer.sdp,
        }));
        if (!result.answer) {
            throw new Error('No answer SDP in CF SFU response');
        }
        return {
            type: 'answer',
            sdp: result.answer,
        };
    }
    /**
     * Publish a local track (server validates permissions)
     * POST /apps/{appId}/sessions/{sessionId}/tracks/new
     */
    async publishTrack(sessionId, trackName, codec) {
        const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
            location: 'local',
            trackName,
            media: 'inbound',
            codec,
        }));
        if (!result.trackId) {
            throw new Error('No trackId in CF SFU publish response');
        }
        return {
            trackId: result.trackId,
        };
    }
    /**
     * Subscribe to remote track (server validates room membership)
     * POST /apps/{appId}/sessions/{sessionId}/tracks/new
     * location: "remote", sessionId: remoteSessionId
     */
    async subscribeTrack(sessionId, remoteSessionId, trackName) {
        const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
            location: 'remote',
            sessionId: remoteSessionId,
            trackName,
            media: 'outbound',
        }));
        if (!result.trackId) {
            throw new Error('No trackId in CF SFU subscribe response');
        }
        return {
            trackId: result.trackId,
        };
    }
    /**
     * Close a session
     * DELETE /apps/{appId}/sessions/{sessionId}
     */
    async closeSession(sessionId) {
        await this.sfuApi('DELETE', `/apps/${this.appId}/sessions/${sessionId}`);
    }
}
/**
 * Firebase Function: Create SFU session
 * Called by authenticated client
 * Returns: { success, sessionId, answer (SDP) }
 *
 * Responsibility:
 * 1. Verify client authentication (Firebase Auth)
 * 2. Create CF SFU session
 * 3. Store session metadata in Firestore (rtcSessions collection)
 * 4. Return sessionId + SDP answer to client
 */
export const createRealtimeSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { offer, roomId } = data;
    if (!offer || !offer.sdp) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing offer SDP');
    }
    if (!roomId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing roomId (Vuvio room identifier)');
    }
    try {
        const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
        // 1. Create CF SFU session
        const { sessionId, sessionSecret } = await sfu.createSession(roomId);
        // 2. Negotiate SDP offer/answer
        const answer = await sfu.negotiateOffer(sessionId, offer);
        // 3. Store session metadata in Firestore for access control
        // This is used to verify permissions on subsequent operations
        await admin.firestore().collection('rtcSessions').doc(sessionId).set({
            userId: context.auth.uid,
            roomId: roomId,
            sessionId: sessionId,
            createdAt: admin.firestore.Timestamp.now(),
            status: 'active',
            participants: [context.auth.uid], // Track who's in this room
        });
        return {
            success: true,
            sessionId,
            answer,
        };
    }
    catch (error) {
        console.error('[createRealtimeSession]', error);
        throw new functions.https.HttpsError('internal', `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Publish track
 * Called by authenticated client
 * Returns: { success, trackId }
 *
 * Responsibility:
 * 1. Verify client authentication + session ownership
 * 2. Publish track to CF SFU
 * 3. Update Firestore audit log
 */
export const publishRealtimeTrack = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { sessionId, trackName, codec } = data;
    if (!sessionId || !trackName || !['vp8', 'opus'].includes(codec)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid parameters');
    }
    try {
        // Server-side access control: verify user owns this session
        const sessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
        if (!sessionRef.exists || sessionRef.data()?.userId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
        }
        const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
        const track = await sfu.publishTrack(sessionId, trackName, codec);
        return {
            success: true,
            trackId: track.trackId,
        };
    }
    catch (error) {
        console.error('[publishRealtimeTrack]', error);
        throw new functions.https.HttpsError('internal', `Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Subscribe to track
 * Called by authenticated client
 * Returns: { success, trackId }
 *
 * Responsibility:
 * 1. Verify client authentication
 * 2. Verify both sessions are in same roomId (Vuvio room access control)
 * 3. Subscribe to remote track
 * 4. Update Firestore audit log
 */
export const subscribeRealtimeTrack = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { sessionId, remoteSessionId, trackName } = data;
    if (!sessionId || !remoteSessionId || !trackName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing parameters');
    }
    try {
        // Server-side access control: verify local session ownership
        const localSessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
        if (!localSessionRef.exists || localSessionRef.data()?.userId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
        }
        // Verify both sessions are in same roomId (Vuvio room)
        const remoteSessionRef = await admin.firestore().collection('rtcSessions').doc(remoteSessionId).get();
        if (!remoteSessionRef.exists) {
            throw new functions.https.HttpsError('invalid-argument', 'Remote session not found');
        }
        const localRoom = localSessionRef.data()?.roomId;
        const remoteRoom = remoteSessionRef.data()?.roomId;
        if (localRoom !== remoteRoom) {
            throw new functions.https.HttpsError('permission-denied', 'Remote session in different room');
        }
        const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
        const track = await sfu.subscribeTrack(sessionId, remoteSessionId, trackName);
        return {
            success: true,
            trackId: track.trackId,
        };
    }
    catch (error) {
        console.error('[subscribeRealtimeTrack]', error);
        throw new functions.https.HttpsError('internal', `Subscribe failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Close session
 * Called by authenticated client
 * Cleans up CF SFU session + Firestore records
 */
export const closeRealtimeSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { sessionId } = data;
    if (!sessionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId');
    }
    try {
        // Verify session ownership
        const sessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
        if (!sessionRef.exists || sessionRef.data()?.userId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
        }
        const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
        await sfu.closeSession(sessionId);
        // Update Firestore
        await admin.firestore().collection('rtcSessions').doc(sessionId).update({
            status: 'closed',
            closedAt: admin.firestore.Timestamp.now(),
        });
        return { success: true };
    }
    catch (error) {
        console.error('[closeRealtimeSession]', error);
        throw new functions.https.HttpsError('internal', `Close failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
