/**
 * Cloudflare Realtime SFU Service
 * Official Documentation:
 * - API: https://developers.cloudflare.com/realtime/sfu/api/
 * - Connection Patterns: https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/
 *
 * Correct API Endpoints:
 * - Create session: POST /apps/{appId}/sessions/new
 * - Renegotiate: PUT /apps/{appId}/sessions/{sessionId}/renegotiate
 * - Publish/Subscribe: POST /apps/{appId}/sessions/{sessionId}/tracks/new
 * - Close track: PUT /apps/{appId}/sessions/{sessionId}/tracks/close
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface SDPDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

// CF Realtime SFU credentials (from env, never expose to client)
const CF_APP_ID = process.env.CF_APP_ID || '';
const CF_APP_SECRET = process.env.CF_APP_SECRET || '';

// CF Realtime SFU API base URL (official)
const CF_REALTIME_API_BASE = 'https://rtc.live.cloudflare.com/v1';

class CloudflareRealtimeSFU {
  private appId: string;
  private appSecret: string;

  constructor(appId: string, appSecret: string) {
    if (!appId || !appSecret) {
      throw new Error('CF Realtime SFU credentials not configured (CF_APP_ID + CF_APP_SECRET required)');
    }
    this.appId = appId;
    this.appSecret = appSecret;
  }

  /**
   * Call CF Realtime SFU API with proper authentication
   * Authorization uses CF_APP_SECRET
   */
  private async sfuApi(method: string, path: string, body?: unknown) {
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
      const errorText = await response.text();
      throw new Error(`CF SFU API ${method} ${path}: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Create a new SFU session
   * POST /apps/{appId}/sessions/new (OFFICIAL ENDPOINT)
   * Request: Empty body
   * Response: { sessionId, sessionSecret }
   */
  async createSession(): Promise<{ sessionId: string; sessionSecret: string }> {
    const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions/new`, {})) as any;

    if (!result.sessionId) {
      throw new Error('No sessionId in CF SFU create response');
    }

    return {
      sessionId: result.sessionId,
      sessionSecret: result.sessionSecret || '',
    };
  }

  /**
   * Renegotiate SDP offer/answer
   * PUT /apps/{appId}/sessions/{sessionId}/renegotiate (OFFICIAL ENDPOINT)
   * Request: { sessionDescription: { type, sdp } }
   * Response: { sessionDescription: { type, sdp } }
   */
  async negotiateOffer(sessionId: string, offer: SDPDescription): Promise<SDPDescription> {
    const result = (await this.sfuApi('PUT', `/apps/${this.appId}/sessions/${sessionId}/renegotiate`, {
      sessionDescription: {
        type: offer.type,
        sdp: offer.sdp,
      },
    })) as any;

    if (!result.sessionDescription || !result.sessionDescription.sdp) {
      throw new Error('No sessionDescription in CF SFU renegotiate response');
    }

    return {
      type: result.sessionDescription.type,
      sdp: result.sessionDescription.sdp,
    };
  }

  /**
   * Publish a local track
   * POST /apps/{appId}/sessions/{sessionId}/tracks/new (OFFICIAL ENDPOINT)
   * Request: { location: "local", trackName, mid, codec }
   * Response: { tracks: [{ trackId, mid, ... }] }
   */
  async publishTrack(
    sessionId: string,
    trackName: string,
    codec: 'vp8' | 'opus',
    mid: string
  ): Promise<{ trackId: string; mid: string }> {
    const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
      location: 'local',
      trackName,
      mid,
      codec,
    })) as any;

    if (!result.tracks || !result.tracks[0]) {
      throw new Error('No tracks in CF SFU publish response');
    }

    const track = result.tracks[0];
    return {
      trackId: track.trackId,
      mid: track.mid,
    };
  }

  /**
   * Subscribe to remote track
   * POST /apps/{appId}/sessions/{sessionId}/tracks/new (OFFICIAL ENDPOINT)
   * Request: { location: "remote", sessionId: remoteSessionId, trackName, mid }
   * Response: { tracks: [{ trackId, mid, ... }] }
   */
  async subscribeTrack(
    sessionId: string,
    remoteSessionId: string,
    trackName: string,
    mid: string
  ): Promise<{ trackId: string; mid: string }> {
    const result = (await this.sfuApi('POST', `/apps/${this.appId}/sessions/${sessionId}/tracks/new`, {
      location: 'remote',
      sessionId: remoteSessionId,
      trackName,
      mid,
    })) as any;

    if (!result.tracks || !result.tracks[0]) {
      throw new Error('No tracks in CF SFU subscribe response');
    }

    const track = result.tracks[0];
    return {
      trackId: track.trackId,
      mid: track.mid,
    };
  }

  /**
   * Close a track
   * PUT /apps/{appId}/sessions/{sessionId}/tracks/close (OFFICIAL ENDPOINT)
   * Request: { trackId }
   * Response: 200 OK
   */
  async closeTrack(sessionId: string, trackId: string): Promise<void> {
    await this.sfuApi('PUT', `/apps/${this.appId}/sessions/${sessionId}/tracks/close`, {
      trackId,
    });
  }

  /**
   * Close a session
   * DELETE /apps/{appId}/sessions/{sessionId}
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.sfuApi('DELETE', `/apps/${this.appId}/sessions/${sessionId}`);
  }
}

/**
 * Firebase Function: Create SFU session
 * Called by authenticated client
 * Returns: { success, sessionId, answer (SDP) }
 */
export const createRealtimeSession = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { offer, roomId } = data;

  if (!offer || !offer.sdp || !offer.type) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing offer SDP (must have type + sdp)');
  }

  if (!roomId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing roomId (Vuvio room identifier)');
  }

  try {
    const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);

    // 1. Create CF SFU session
    const { sessionId, sessionSecret } = await sfu.createSession();

    // 2. Negotiate SDP offer/answer (official format: sessionDescription)
    const answer = await sfu.negotiateOffer(sessionId, offer);

    // 3. Store session metadata in Firestore for access control
    await admin.firestore().collection('rtcSessions').doc(sessionId).set({
      userId: context.auth.uid,
      roomId: roomId,
      sessionId: sessionId,
      sessionSecret: sessionSecret,
      createdAt: admin.firestore.Timestamp.now(),
      status: 'active',
      participants: [context.auth.uid],
      tracks: [],
    });

    return {
      success: true,
      sessionId,
      answer,
    };
  } catch (error) {
    console.error('[createRealtimeSession]', error);
    throw new functions.https.HttpsError(
      'internal',
      `Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * Firebase Function: Publish track
 * Called by authenticated client to publish local media
 * Returns: { success, trackId, mid }
 */
export const publishRealtimeTrack = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId, trackName, codec, mid } = data;

  if (!sessionId || !trackName || !['vp8', 'opus'].includes(codec) || !mid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing parameters: sessionId, trackName, codec, mid');
  }

  try {
    // Server-side access control: verify user owns this session
    const sessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
    if (!sessionRef.exists || sessionRef.data()?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
    }

    const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
    const track = await sfu.publishTrack(sessionId, trackName, codec as any, mid);

    // Update Firestore audit log
    await admin.firestore().collection('rtcSessions').doc(sessionId).update({
      tracks: admin.firestore.FieldValue.arrayUnion({
        trackId: track.trackId,
        mid: track.mid,
        trackName,
        codec,
        location: 'local',
        publishedAt: admin.firestore.Timestamp.now(),
      }),
    });

    return {
      success: true,
      trackId: track.trackId,
      mid: track.mid,
    };
  } catch (error) {
    console.error('[publishRealtimeTrack]', error);
    throw new functions.https.HttpsError(
      'internal',
      `Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * Firebase Function: Subscribe to track
 * Called by authenticated client to subscribe to remote media
 * Returns: { success, trackId, mid }
 *
 * Access control: Both sessions must be in same roomId (Vuvio room isolation)
 */
export const subscribeRealtimeTrack = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId, remoteSessionId, trackName, mid } = data;

  if (!sessionId || !remoteSessionId || !trackName || !mid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing parameters: sessionId, remoteSessionId, trackName, mid');
  }

  try {
    // Verify local session ownership
    const localSessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
    if (!localSessionRef.exists || localSessionRef.data()?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
    }

    // Verify both sessions in same roomId (room isolation)
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
    const track = await sfu.subscribeTrack(sessionId, remoteSessionId, trackName, mid);

    // Update Firestore audit log
    await admin.firestore().collection('rtcSessions').doc(sessionId).update({
      tracks: admin.firestore.FieldValue.arrayUnion({
        trackId: track.trackId,
        mid: track.mid,
        trackName,
        location: 'remote',
        remoteSessionId,
        subscribedAt: admin.firestore.Timestamp.now(),
      }),
    });

    return {
      success: true,
      trackId: track.trackId,
      mid: track.mid,
    };
  } catch (error) {
    console.error('[subscribeRealtimeTrack]', error);
    throw new functions.https.HttpsError(
      'internal',
      `Subscribe failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * Firebase Function: Close track
 * Called by authenticated client to close specific track
 * Returns: { success }
 */
export const closeRealtimeTrack = functions.https.onCall(async (data: any, context: any) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId, trackId } = data;

  if (!sessionId || !trackId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing sessionId or trackId');
  }

  try {
    // Verify session ownership
    const sessionRef = await admin.firestore().collection('rtcSessions').doc(sessionId).get();
    if (!sessionRef.exists || sessionRef.data()?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Session not found or not authorized');
    }

    const sfu = new CloudflareRealtimeSFU(CF_APP_ID, CF_APP_SECRET);
    await sfu.closeTrack(sessionId, trackId);

    // Update Firestore (remove track from audit log)
    const tracks = sessionRef.data()?.tracks || [];
    const updatedTracks = tracks.filter((t: any) => t.trackId !== trackId);
    await admin.firestore().collection('rtcSessions').doc(sessionId).update({
      tracks: updatedTracks,
    });

    return { success: true };
  } catch (error) {
    console.error('[closeRealtimeTrack]', error);
    throw new functions.https.HttpsError(
      'internal',
      `Close track failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});

/**
 * Firebase Function: Close session
 * Called by authenticated client
 * Cleans up CF SFU session + Firestore records
 */
export const closeRealtimeSession = functions.https.onCall(async (data: any, context: any) => {
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
  } catch (error) {
    console.error('[closeRealtimeSession]', error);
    throw new functions.https.HttpsError(
      'internal',
      `Close failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
