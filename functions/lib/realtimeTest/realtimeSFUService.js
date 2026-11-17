/**
 * Cloudflare Realtime SFU Service
 * Real implementation using CF API for session creation + SDP negotiation + track pub/sub
 *
 * API Flow:
 * 1. createSession() -> sessionId
 * 2. negotiateOffer(sessionId, localOffer) -> remoteAnswer
 * 3. publishTrack(sessionId, trackName, codec) -> trackId
 * 4. subscribeTrack(sessionId, remoteSessionId, trackName) -> trackId
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// CF Realtime configuration (from env, never expose to client)
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_APP_ID = process.env.CF_APP_ID || '';
// Use env-based config, not firebase functions:config:set (deprecated)
// Set via: export CF_API_TOKEN="..." in .env.local or Firebase Secret Manager
class CloudflareRealtimeSFU {
    token;
    accountId;
    appId;
    constructor(token, accountId, appId) {
        if (!token || !accountId || !appId) {
            throw new Error('CF Realtime credentials not configured');
        }
        this.token = token;
        this.accountId = accountId;
        this.appId = appId;
    }
    async cfApi(method, path, body) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${path}`;
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`CF API ${method} ${path}: ${response.status} ${error}`);
        }
        const data = (await response.json());
        if (!data.success) {
            throw new Error(`CF API error: ${data.errors?.[0]?.message || 'Unknown'}`);
        }
        return data.result;
    }
    /**
     * Create a new SFU session
     * POST /apps/{appId}/sessions/new -> returns sessionId
     */
    async createSession() {
        const result = await this.cfApi('POST', `/apps/${this.appId}/sessions/new`, {});
        return {
            sessionId: result.sessionId,
            expiresAt: result.expiresAt,
        };
    }
    /**
     * Negotiate SDP offer/answer
     * POST /apps/{appId}/sessions/{sessionId}/renegotiate
     * Client sends offer -> CF returns answer
     */
    async negotiateOffer(sessionId, offer) {
        const result = await this.cfApi('POST', `/apps/${this.appId}/sessions/${sessionId}/renegotiate`, {
            sdp: offer.sdp,
            type: 'offer',
        });
        return {
            type: 'answer',
            sdp: result.sdp,
        };
    }
    /**
     * Publish a local track
     * POST /apps/{appId}/sessions/{sessionId}/tracks/new
     * location: "local", trackName, codec (vp8, opus)
     */
    async publishTrack(sessionId, trackName, codec) {
        const result = await this.cfApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
            location: 'local',
            trackName,
            media: 'inbound',
            codec,
        });
        return {
            trackId: result.trackId,
            mid: result.mid,
        };
    }
    /**
     * Subscribe to remote track
     * POST /apps/{appId}/sessions/{sessionId}/tracks/new
     * location: "remote", remoteSessionId, trackName
     */
    async subscribeTrack(sessionId, remoteSessionId, trackName) {
        const result = await this.cfApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
            location: 'remote',
            sessionId: remoteSessionId,
            trackName,
            media: 'outbound',
        });
        return {
            trackId: result.trackId,
            mid: result.mid,
        };
    }
    /**
     * Close a session
     * POST /apps/{appId}/sessions/{sessionId}/close
     */
    async closeSession(sessionId) {
        await this.cfApi('POST', `/apps/${this.appId}/sessions/${sessionId}/close`, {});
    }
}
/**
 * Firebase Function: Create SFU session
 * Returns: { sessionId, answer (SDP) }
 */
export const createRealtimeSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { offer } = data;
    if (!offer || !offer.sdp) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing offer SDP');
    }
    try {
        const sfu = new CloudflareRealtimeSFU(CF_API_TOKEN, CF_ACCOUNT_ID, CF_APP_ID);
        // 1. Create session
        const { sessionId, expiresAt } = await sfu.createSession();
        // 2. Negotiate offer/answer
        const answer = await sfu.negotiateOffer(sessionId, offer);
        // 3. Log session to Firestore for audit
        await admin.firestore().collection('rtcSessions').doc(sessionId).set({
            userId: context.auth.uid,
            createdAt: admin.firestore.Timestamp.now(),
            expiresAt: new Date(expiresAt),
            status: 'active',
            participants: [],
        });
        return {
            success: true,
            sessionId,
            answer,
            expiresIn: 3600,
        };
    }
    catch (error) {
        console.error('createRealtimeSession error:', error);
        throw new functions.https.HttpsError('internal', `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Publish track
 * Returns: { trackId, mid }
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
        const sfu = new CloudflareRealtimeSFU(CF_API_TOKEN, CF_ACCOUNT_ID, CF_APP_ID);
        const track = await sfu.publishTrack(sessionId, trackName, codec);
        return {
            success: true,
            ...track,
        };
    }
    catch (error) {
        console.error('publishRealtimeTrack error:', error);
        throw new functions.https.HttpsError('internal', `Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Subscribe to track
 * Returns: { trackId, mid }
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
        const sfu = new CloudflareRealtimeSFU(CF_API_TOKEN, CF_ACCOUNT_ID, CF_APP_ID);
        const track = await sfu.subscribeTrack(sessionId, remoteSessionId, trackName);
        return {
            success: true,
            ...track,
        };
    }
    catch (error) {
        console.error('subscribeRealtimeTrack error:', error);
        throw new functions.https.HttpsError('internal', `Subscribe failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Firebase Function: Close session
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
        const sfu = new CloudflareRealtimeSFU(CF_API_TOKEN, CF_ACCOUNT_ID, CF_APP_ID);
        await sfu.closeSession(sessionId);
        // Update Firestore
        await admin.firestore().collection('rtcSessions').doc(sessionId).update({
            status: 'closed',
            closedAt: admin.firestore.Timestamp.now(),
        });
        return { success: true };
    }
    catch (error) {
        console.error('closeRealtimeSession error:', error);
        throw new functions.https.HttpsError('internal', `Close failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
