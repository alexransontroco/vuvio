import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// CF Realtime configuration (from environment variables)
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
/**
 * Generate Cloudflare Realtime SFU token for PoC testing
 * Server-side only - never expose CF credentials to client
 */
export const generateCFRealtimeToken = functions.https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { roomId: providedRoomId, userId, userName } = data;
    // Validation
    if (!userId || !userName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId or userName');
    }
    // Generate room ID if not provided
    const roomId = providedRoomId || `test-${Date.now()}`;
    try {
        // Call Cloudflare Realtime API to generate token
        // This requires CF_API_TOKEN and CF_ACCOUNT_ID in Firebase env vars
        if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
            throw new Error('CF Realtime credentials not configured');
        }
        const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/rtc/sessions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'offer',
                sessionDescription: {
                    type: 'offer',
                    sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\nm=application 9 UDP/TLS/RTP/SAVPF 120\r\nc=IN IP4 127.0.0.1\r\na=rtcp:9 IN IP4 127.0.0.1\r\na=ice-ufrag:test\r\na=ice-pwd:test\r\na=fingerprint:sha-256 12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78\r\na=setup:active\r\na=mid:0\r\na=sendrecv\r\na=rtcp-mux\r\na=rtpmap:120 JSON/90000\r\n',
                },
            }),
        });
        if (!cfResponse.ok) {
            const error = await cfResponse.text();
            console.error('CF Realtime API error:', error);
            throw new Error(`CF Realtime API failed: ${cfResponse.statusText}`);
        }
        const cfData = await cfResponse.json();
        if (!cfData.success) {
            throw new Error(`CF Realtime API error: ${cfData.errors?.[0]?.message || 'Unknown error'}`);
        }
        // Extract session ID and credentials from CF response
        const sessionId = cfData.result?.sessionId || `session-${Date.now()}`;
        // Log to Firestore for audit trail
        await admin.firestore().collection('rtcSessions').doc(sessionId).set({
            roomId,
            userId: context.auth.uid,
            userName,
            createdAt: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000)), // 1 hour
            status: 'active',
        }, { merge: true });
        // Return token to client (never expose CF_API_TOKEN itself)
        return {
            success: true,
            token: cfData.result?.sessionDescription?.sdp || '',
            sessionId,
            roomId,
            expiresIn: 3600, // 1 hour
        };
    }
    catch (error) {
        console.error('Error generating CF Realtime token:', error);
        throw new functions.https.HttpsError('internal', `Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
/**
 * Cleanup expired RTC sessions
 * Run as scheduled task (e.g., every hour)
 */
export const cleanupExpiredRTCSessions = functions.pubsub.schedule('every 1 hours').onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await admin.firestore()
        .collection('rtcSessions')
        .where('expiresAt', '<', now)
        .where('status', '==', 'active')
        .get();
    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'expired' });
    });
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} expired RTC sessions`);
});
