# Phase 3 Section 1: Audit Existing Real-Time + Lives Architecture

**Session:** 2026-11-17 · **Status:** COMPLETE — Ready for Section 2 comparison

---

## Executive Summary

Vuvio's current live streaming is **1-to-many broadcast**: creator broadcasts via WHIP to Cloudflare Stream, viewers watch via WHEP WebRTC or HLS CDN fallback. P2P signaling (SDP/ICE) is Firestore-mediated, clean and reusable.

**Key Finding:** The P2P signaling layer is **highly modular and portable**. Scaling to multi-participant (Workshop Spotlight, Together sessions) is feasible by generalizing `watchers` → `peers` bidirectional topology. The main fragility is the **collection split** (`activeLives` vs `streams`) and **relay server scalability limits**.

---

## 1. BROADCASTER ARCHITECTURE

### **Core Service: `src/services/webrtcService.js` (979 lines)**

**What it does:**
- Creates RTCPeerConnection (VP8 codec, bitrate 2.5–5 Mbps locked)
- Posts SDP offer to Firestore: `activeLives/{liveId}/sdpOffer`
- Batches ICE candidates and posts as `activeLives/{liveId}/iceCandidates/{id}`
- Supports two broadcast paths:
  1. **WHIP to Cloudflare Stream** — HTTP POST SDP to `https://<whip-ingest-url>`, gets answer, establishes DTLS
  2. **RTMPS via relay server** — WebRTC → relay node.js server → FFmpeg → RTMPS output

**Key Functions:**
- `startBroadcast(liveId, userId, existingStream)` — Opens RTCPeerConnection, initiates signaling
- `stopBroadcast(liveId)` — Closes peer, marks live ended
- `startWhipConnection(stream, whipUrl, whipKey)` — Cloudflare ingest
- `startRtmpRelayBroadcast(...relayUrl, ingestUrl, streamKey, authToken)` — Relay simulcast
- `getRtcConfig()` — Cached TURN credentials (60s TTL)

**Data Flow:**
```
Creator opens broadcast → requestVuvioMediaStream() (getUserMedia) 
  → startBroadcast() creates RTCPeerConnection
  → SDP offer posted to Firestore
  → Cloudflare Stream listener (via Function) answers
  → Answer posted back to Firestore
  → Creator receives answer, sets remote SDP
  → ICE candidates trickled back and forth via Firestore
  → DTLS connects, media flows
```

**Reusable for Multi-Participant? ✅ HIGHLY MODULAR**
- SDP offer/answer/ICE pattern is **universal** for WebRTC
- Can be generalized to N peers by creating multiple RTCPeerConnections
- TURN config caching is portable
- Codec preferences (VP8) are tweakable per use case

**Fragile/Specific Issues? ⚠️**
- **Canvas stream creation** (`createFixedResolutionStream`) hardcodes 854×480 @15fps — suitable only for RTMPS relay, not for P2P (too low quality)
- **TURN credential fetching** baked into `getRtcConfig()` — not injectable; hardcodes Cloudflare API
- **Relay RTMPS conversion** (VP8 → H.264 via FFmpeg) is Cloudflare-specific
- **No multistreaming abstraction** — relay only supports one outbound at a time (not simulcast to N platforms)

---

### **Relay Server: `relay/server.js` (350+ lines)**

**What it does:**
- Node.js server using `@roamhq/wrtc` to establish RTCPeerConnection with broadcaster
- Extracts video frames (I420 YUV) + audio samples (PCM) via RTCVideoSink/RTCAudioSink
- Pipes to FFmpeg subprocess: I420 video + PCM audio → H.264 + AAC → RTMPS output
- Scales frames bilinearly (854×480), rate-adapts to 30fps output

**Reusable for Multi-Participant? ⚠️ LIMITED**
- FFmpeg integration pattern is **portable** to other RTMP/RTMPS destinations
- BUT: Hardcoded I420 YUV scaling, no color space negotiation
- Could be adapted for SRT (Secure Reliable Transport) or HLS as alternate output

**Fragile/Specific Issues? ⚠️⚠️ VERY FRAGILE**
- **Resource-intensive per session:** FFmpeg child process spawned per relay = CPU/memory explosion at scale
- **Max 3 concurrent sessions** (`MAX_CONCURRENT_SESSIONS`) — won't scale for N concurrent broadcasts
- **Inactivity timeout (30s):** Kills relay if no ICE candidates received (flaky networks → silent stream dropout)
- **No audio fallback:** If microphone inactive, plays synthetic silence (anullsrc) — works but suboptimal UX
- **No error retry logic:** Failed FFmpeg encode → no recovery, orphan subprocess

**Cost:** ~€8.99/mo Hetzner CX33 (2 vCPU, 4GB RAM) for relay server — scales to ~10–15 concurrent streams before resource exhaustion.

---

### **Creator UI: `src/routes/StudioPage.jsx`**

**What it does:**
- Companion desktop UI for live broadcast
- Shows broadcast status, Q&A, participant count, comment feed
- Workshop integration: participant roster + join requests

**Reusable for Multi-Participant? ❌ NO**
- Too tightly coupled to current live UX
- Could be repurposed as generic "control center" but needs abstraction

---

## 2. VIEWER ARCHITECTURE

### **Core Service: `src/services/webrtcService.js` (viewer side)**

**What it does:**
- Creates RTCPeerConnection with broadcaster's offer (recvonly transceiver)
- Posts SDP answer to Firestore: `activeLives/{liveId}/watchers/{watcherId}/sdpAnswer`
- Batches ICE candidates as `...watchers/{watcherId}/watcherIceCandidates/{id}`
- Fallback: HLS.js for CDN playback if WHEP fails

**Key Functions:**
- `watchBroadcast(liveId, onStreamReceived, watcherId, watcherUid)` — Initiates P2P watch
- `startWhepViewer(whepUrl, onStream)` — Cloudflare WHEP HTTP pull
- `combineStreams(videoStream, audioStream)` — Merges separate audio/video tracks

**Data Flow:**
```
Viewer navigates to live
  → watchBroadcast() creates RTCPeerConnection (recvonly)
  → Firestore listener fetches broadcaster's offer
  → SDP answer generated + posted back
  → ICE candidates trickled (bidirectional via Firestore)
  → DTLS connects
  → Media delivered to onStreamReceived callback
  → React component renders <video> with stream
```

**Key Detail:** Viewer **waits for DTLS `connected` state before delivering stream** — prevents half-open connections from rendering black video.

**Reusable for Multi-Participant? ✅ EXCELLENT**
- **P2P signaling pattern is portable** to group calls by generalizing watchers → peers
- **DTLS timing workaround** is production-grade and reusable
- **ICE deduplication** (Set-based) is clean

**Fragile/Specific Issues? ⚠️**
- **No automatic HLS fallback:** If WHEP fails, app doesn't silently switch to HLS (Safari cross-network WHEP sometimes stalls)
- **1-to-many topology only:** Viewers don't peer with each other (intentional for security, but limits mesh topologies)

---

### **Fallback: HLS.js for CDN**

**What it does:**
- Plays HLS manifest from Cloudflare Stream CDN (`{hlsManifestUrl}`)
- Used when P2P unavailable (network issue, Safari, mobile)

**Reusable for Multi-Participant? ✅ YES**
- Independent of P2P layer
- Could continue working for broadcast scenarios

---

## 3. CLOUDFLARE STREAM INTEGRATION

### **Cloudflare Client: `functions/src/cloudflare/cloudflareClient.ts`**

**What it does:**
- TypeScript abstraction over Cloudflare Stream API
- Creates live inputs (broadcaster), deletes on stream end
- Retrieves WHIP/WHEP URLs, HLS manifests, stream keys

**Interfaces:**
```typescript
CloudflareLiveInput {
  liveInputId, uid, playbackUrl, hlsManifestUrl,
  ingestUrl (WHIP), webRTCUrl, streamKey
}
```

**Reusable for Multi-Participant? ✅ YES**
- Abstraction is **platform-agnostic** — could swap for LiveKit or Mux
- Downstream code doesn't depend on Cloudflare specifics

**Fragile/Specific Issues? ⚠️**
- **API versioning risk:** No version pinning; Cloudflare API evolves
- **uid/liveInputId confusion:** Duplicate identifier fields → fragile mapping

---

### **Firebase Function: `functions/src/streams/createStream.ts`**

**What it does:**
- Called when creator starts broadcast
- Creates Cloudflare live input
- Initializes Firestore stream doc

**Flow:**
```
Creator clicks "Go Live" (BottomNav)
  → Frontend: startBroadcast(liveId, userId)
  → Posts to Firebase Function /api/streams/{liveId}/create
  → Backend: calls cloudflareClient.createLiveInput()
  → Firestore: saves stream metadata + Cloudflare IDs
  → Frontend: receives WHIP/WHEP URLs
  → Broadcast begins
```

**Reusable for Multi-Participant? ✅ YES**
- Firestore stream schema is **not Cloudflare-specific**

**Fragile/Specific Issues? ⚠️**
- Hardcoded to `createCloudflareClient()` — no dependency injection
- No fallback if Cloudflare API fails

---

### **Firebase Function: `functions/src/streams/finishStream.ts` (58 lines)**

**What it does:**
- Called when creator ends broadcast
- Marks stream as "completed"
- Async deletes Cloudflare live input (with 10 min grace period)

**Flow:**
```
Creator clicks "End Broadcast"
  → Frontend: stopBroadcast(liveId)
  → Backend: Transaction: status = 'completed', replayCleanupPending = true
  → Async: delete Cloudflare input
```

**Fragile Issues? ⚠️**
- **Fallback to `activeLives` collection** — indicates schema inconsistency
- **No retry logic:** If Cloudflare delete fails, stream cleanup hangs

---

### **Scheduled Function: `functions/src/streams/cleanupStaleLives.ts` (89 lines)**

**What it does:**
- Runs every 1 min
- Finds lives with no heartbeat for 5 min → marks as "ended"
- Finds ended streams >10 min old → deletes Cloudflare input

**Purpose:** Catch crashed broadcasters, clean up orphan Cloudflare resources

**Fragile Issues? ⚠️**
- **Hardcoded timeouts** (5 & 10 min) — should be env vars
- **No error handling:** Cloudflare delete failures → orphans accumulate
- **Eventual consistency:** Orphan inputs may cost extra storage $$ before cleanup

---

## 4. FIRESTORE SCHEMA & SECURITY RULES

### **Collections Structure**

```
activeLives/{liveId}
  Root: creatorUid, creatorId, status, sdpOffer, iceCandidates,
        cloudflareLiveInputId, playbackUrl, hlsManifestUrl,
        currentViewerCount, peakViewerCount, createdAt, ...
  
  watchers/{watcherId}
    sdpAnswer, watcherIceCandidates, watcherUid, ...
    Security: allow create/update if signed in (NO auth check! ⚠️)
  
  comments/{commentId}
    text, userId, userDisplayName, timestamp
  
  questions/{questionId}
    text, type: 'question', authorId, answered, answer
  
  stars/{starId}
    userId, userDisplayName, timestamp
  
  ❌ NOT YET: participants, joinRequests, spotlightRequests
     (Workshop only exists in mock service, not Firestore)

streams/{streamId}
  (Parallel collection for managed streams)
  cloudflareLiveInputId, playbackUrl, hlsManifestUrl,
  currentViewerCount, status, ...
  
  ❌ SCHEMA SPLIT ISSUE: activeLives vs streams — which is source of truth?
```

### **Security Analysis**

**Current Rules (inferred):**
- Watchers subcollection: `allow create/update: if request.auth != null`
  - **RISK:** No validation that watcherId matches user UID
  - SDP/ICE could be manipulated by arbitrary viewers
  - **Mitigation:** SDP/ICE alone aren't sensitive (not auth tokens), but injection could break P2P

**For Multi-Participant:**
- Need to **add participants subcollection** with stricter rules
- Spotlight/join requests require **server-side validation** (host authorization, mutual consent)

---

## 5. WORKSHOP FEATURE (Mock Stage)

### **State Machine: `src/services/workshopService.mock.js`**

**Data structure:**
```javascript
Session {
  mode: 'off' | 'join' | 'workshop',
  participants: [{
    id, userId, userName, userAvatar, joinedAt,
    cameraOn, micOn, hostViewAuthorized,
    publicSpotlightAuthorized, pendingSpotlightRequest,
    connectionState, ...
  }],
  joinRequests: [{
    id, userId, userName, status: 'pending'|'accepted'|'declined'
  }],
  spotlightParticipantId: single participant (MVP),
  feedbackQueue: [],
  log: [ { type, timestamp, payload } ]
}
```

**Key Mutations:**
- `requestJoin()` → Add to joinRequests
- `respondJoinRequest()` → Move to participants or decline
- `grantSpotlightAuthorization()` → Participant consents to broadcast
- `setParticipantMedia()` → Toggle camera/mic (local state only)

**Reusable for Multi-Participant? ⚠️ SCHEMA YES, IMPLEMENTATION NO**
- Data structure is **good reference** for Firestore schema
- **IN-MEMORY MOCK ONLY** — no Firestore layer, no server-side validation
- **Single spotlight participant** (MVP) is a limitation — real workshops need N participants on screen
- **No video track negotiation yet** — just state flags (cameraOn/micOn), not SDP/ICE

---

## 6. AUTH & MULTISTREAMING

### **Auth: `src/context/AuthContext.jsx`**

- Firebase Auth (email/password, Google OAuth)
- Role assignment: creator, viewer (via admin)
- Demo account hardcoded

**Reusable for Multi-Participant? ✅ YES** — Auth is independent

---

### **Multistreaming: `src/services/streamDestinationsService.js` (80 lines)**

**What it does:**
- Manages RTMP destination configs (Twitch, YouTube, etc.)
- **Stores stream keys IN-MEMORY ONLY during broadcast** (never persisted to Firestore) ✅ best practice
- Calls Cloudflare Live Output API to create simulcast outputs

**Reusable for Multi-Participant? ✅ YES**
- Session-based secret storage pattern is **production-grade**

---

## 7. RECAP & POST-LIVE

### **Replay Analysis: `src/services/videoAnalysisService.js` (85 lines)**

- Queues replay analysis jobs → Firebase Function
- Backend: OpenAI transcript + highlights extraction
- Creator reviews highlights, marks keep/discard

**Reusable for Multi-Participant? ✅ YES**
- Job queue pattern is **universal** (not replay-specific)

---

## KEY RISKS & CONSTRAINTS FOR PHASE 3 FORWARD

### **BREAKING CHANGES NEEDED:**

1. **Collection Schema Migration** ⚠️⚠️
   - Current: `activeLives` (1-to-many broadcaster focus)
   - Needed: Add `participants` subcollection with bidirectional peer offer/answer/ICE
   - Migration: Versioning required; can't be backward-compat with existing lives

2. **Relay Server Scalability** ⚠️⚠️
   - Current: 3 concurrent sessions max, FFmpeg per-session
   - Needed for Together: 2–4 concurrent participants typical, up to 10 edge case
   - **Solution:** Either upgrade relay (more Hetzner instances) or use SFU (CF Realtime / LiveKit)

3. **Workshop Firestore Layer** ⚠️
   - Currently mock-only
   - Needs: Firestore collections + security rules + server-side validation
   - **Mutual consent enforcement:** Host must approve AND participant must consent before spotlight broadcast

4. **SFU vs P2P Choice** ⚠️
   - Current P2P works for 1-to-many
   - For multi-participant: **SFU (CF Realtime/LiveKit) is better for 3+ peers** (better bitrate scaling than full-mesh)
   - Hybrid possible: SFU for primary video stream, P2P for private POV (Together audio-only)

### **DEPENDENCIES & TIMING:**

| Task | Blockers | Est. Effort |
|------|----------|-------------|
| Audit existing (this doc) | None | ✅ DONE |
| Compare CF Stream vs CF Realtime vs LiveKit | Audit | 2–4 hrs |
| Decide architecture (SFU vs P2P vs hybrid) | Research findings | 1–2 hrs |
| Design multi-participant Firestore schema | Architecture decision | 2–3 hrs |
| ⚠️ Implement Workshop Firestore layer | Schema design | 4–6 hrs |
| ⚠️ Implement SFU (or upgrade relay) | Architecture decision | 8–16 hrs |
| Security audit + rules | Schema finalized | 3–4 hrs |
| Implementation roadmap | All above | 2–3 hrs |

---

## NEXT SECTION

**Section 2:** Compare Cloudflare Stream (existing), Cloudflare Realtime (SFU), and LiveKit (SFU/self-hosted).

**Research findings ready** (from web search):
- CF Stream: $1/1000 min delivery, <500ms latency, no multiparticipant
- CF Realtime: $0.05/GB egress (SFU), $0.002/min participant (RealtimeKit layer), best for 3+ participants
- LiveKit Cloud: $0.016/min video participant, self-hosted free (ops cost only)
