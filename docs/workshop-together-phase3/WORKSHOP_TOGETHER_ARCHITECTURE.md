# Phase 3 Section 4: Detailed Workshop & Together Architecture

**Session:** 2026-11-17 · **Status:** IN PROGRESS — Firestore schema + SFU integration design

---

## OVERVIEW: Hybrid Architecture (CF Stream Public + CF Realtime SFU Participants)

```
┌─────────────────────────────────────────────────────────────┐
│                        VUVIO WORKSHOP                       │
│                     (Hybrid Architecture)                    │
└─────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │  PUBLIC BROADCAST ARM (CF Stream)                        │
   │                                                          │
   │  Creator POV (WHIP) ──→ CF Stream ──→ HLS/WHEP         │
   │                           Input         for 50–500      │
   │                                        spectators       │
   └──────────────────────────────────────────────────────────┘
                              ↑
                              │ (Composite mixed feed)
                              │
   ┌──────────────────────────────────────────────────────────┐
   │  PARTICIPANT INTERACTIVE ARM (CF Realtime SFU)           │
   │                                                          │
   │  Host ──↔─ CF Realtime SFU ──↔─ Participants (5–10)   │
   │   │          (Central router)      │                     │
   │   └──────────────────┬─────────────┘                     │
   │                      │                                   │
   │        Selected participant POV                          │
   │        mixed back to CF Stream input                     │
   └──────────────────────────────────────────────────────────┘

   SPOTLIGHT FLOW:
   1. Host selects participant to spotlight
   2. Host clicks "Request Spotlight"
   3. Participant receives notification
   4. Participant clicks "Accept" (mutual consent)
   5. Host mixes participant's video into broadcast (via SFU agent)
   6. Public viewers see composed video (host + spotlighted participant)
   7. Recording captures both
```

---

## FIRESTORE SCHEMA: Multi-Participant Extension

### **Collection: `activeLives/{liveId}`** (Extended)

```
activeLives/{liveId}
  ├─ Root Fields (EXISTING + NEW):
  │  ├─ creatorUid (existing)
  │  ├─ creatorId (existing)
  │  ├─ status: 'preparing'|'live'|'ended'|'completed' (existing)
  │  ├─ mode: 'classic'|'workshop'|'together' (NEW)
  │  ├─ workshop {
  │  │    maxParticipants: 12 (NEW)
  │  │    spotlightParticipantId: string (NEW — single for MVP)
  │  │    cfRealtimeRoomId: string (NEW — CF Realtime room key)
  │  │    cfRealtimeToken: string (NEW — ephemeral SFU session token)
  │  │ }
  │  ├─ currentViewerCount (existing)
  │  └─ ... (keep existing broadcast fields)
  │
  ├─ participants/{participantId} (NEW SUBCOLLECTION)
  │  ├─ userId: string (key: Firestore-generated participant doc ID)
  │  ├─ userName: string
  │  ├─ userAvatar: string (URL)
  │  ├─ joinedAt: timestamp
  │  ├─ cameraOn: boolean
  │  ├─ micOn: boolean
  │  ├─ connectionState: 'connecting'|'connected'|'disconnected'
  │  ├─ hostViewAuthorized: boolean (host can see participant's POV? private preview)
  │  ├─ publicSpotlightAuthorized: boolean (participant consented to public broadcast?)
  │  ├─ pendingSpotlightRequest: boolean (spotlight request pending participant approval?)
  │  └─ updatedAt: timestamp
  │
  ├─ joinRequests/{requestId} (NEW SUBCOLLECTION)
  │  ├─ userId: string
  │  ├─ userName: string
  │  ├─ userAvatar: string
  │  ├─ status: 'pending'|'accepted'|'declined' (NEW)
  │  ├─ createdAt: timestamp
  │  └─ respondedAt: timestamp (optional)
  │
  ├─ spotlight/{spotlight} (NEW SINGLETON DOCUMENT)
  │  ├─ currentParticipantId: string (nullable, only 1 spotlighted in MVP)
  │  ├─ consentFrom: { userId, timestamp } (participant consent record)
  │  ├─ consentFrom host: { userId, timestamp } (host approval record)
  │  ├─ startedAt: timestamp
  │  ├─ endedAt: timestamp (nullable — ongoing)
  │  └─ publicBroadcasting: boolean (is participant visible in public broadcast?)
  │
  ├─ feedbackQueue/{feedbackId} (NEW SUBCOLLECTION — optional)
  │  ├─ type: 'question'|'compliment'|'technical_issue'
  │  ├─ fromParticipantId: string
  │  ├─ fromParticipantName: string
  │  ├─ body: string (message text)
  │  ├─ resolvedAt: timestamp (optional — host marks as read)
  │  └─ createdAt: timestamp
  │
  ├─ comments/{commentId} (EXISTING)
  ├─ questions/{questionId} (EXISTING)
  └─ stars/{starId} (EXISTING)
```

### **Collection: `users/{uid}` (Extended)**

```
users/{uid}
  ├─ ... (existing profile fields)
  │
  ├─ workshopPreferences {
  │    allowParticipation: boolean (opt-in to Workshop invitations)
  │    allowSpotlight: boolean (auto-accept spotlight requests?)
  │ } (NEW — optional)
```

---

## CF REALTIME INTEGRATION: Session Management

### **Firebase Function: `createMultiParticipantSession()`**

**Triggered:** When creator starts a "Workshop" or "Together" live

**Flow:**
```typescript
1. Authenticate: user must be live creator
2. Create Firestore live doc with mode='workshop'
3. Call CF Realtime API: POST /rooms with { name, roomId, permissions }
4. Save CF Realtime room ID + room token to Firestore: activeLives/{liveId}/workshop
5. Return room token + room ID to frontend
```

**Pseudocode:**
```javascript
async function createMultiParticipantSession(liveId, creatorUid, workshopConfig) {
  const liveRef = firestore.collection('activeLives').doc(liveId);
  const live = await liveRef.get();
  
  if (live.data().creatorUid !== creatorUid) throw new Error('Unauthorized');
  
  // Call CF Realtime API
  const cfRealtime = new CFRealtimeClient(CF_API_KEY);
  const room = await cfRealtime.createRoom({
    roomId: `vuvio-${liveId}`,
    permissions: {
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    }
  });
  
  // Save to Firestore
  await liveRef.update({
    mode: 'workshop',
    'workshop.cfRealtimeRoomId': room.id,
    'workshop.maxParticipants': workshopConfig.maxParticipants || 12,
  });
  
  return { roomId: room.id, token: room.token };
}
```

### **Firebase Function: `generateParticipantToken(liveId, participantUid)`**

**Triggered:** When participant clicks "Join Activity"

**Flow:**
```typescript
1. Verify participant is not already joined (avoid duplicates)
2. Fetch CF Realtime room ID from Firestore
3. Generate ephemeral CF Realtime token (1 hr expiry)
4. Create participant doc in Firestore: activeLives/{liveId}/participants/{newDocId}
5. Post "user joined" notification to Firestore
6. Return token to frontend
```

---

## CLIENT-SIDE: Multi-Participant Service

### **New Service: `src/services/rtcMultiParticipantService.js`**

**Purpose:** Bridge to CF Realtime SFU + manage participant state

**Key Functions:**
```javascript
// Initialize multi-participant session (called by host)
async function initializeWorkshopSession(liveId, workshopConfig) {
  const { roomId, token } = await firebase.functions.httpsCallable('createMultiParticipantSession')({
    liveId, workshopConfig
  });
  
  // Store room ID + token locally (session storage, never persisted)
  sessionStorage.setItem(`cf_realtime_room_${liveId}`, roomId);
  sessionStorage.setItem(`cf_realtime_token_${liveId}`, token);
}

// Join as participant
async function joinAsParticipant(liveId, participantUid) {
  const { token } = await firebase.functions.httpsCallable('generateParticipantToken')({
    liveId, participantUid
  });
  
  // Connect to CF Realtime via LiveKit SDK (CF Realtime is LiveKit-compatible)
  const roomId = `vuvio-${liveId}`;
  const room = new Room();
  await room.connect(CF_REALTIME_ENDPOINT, token, { roomId });
  
  return room;
}

// Spotlight flow (host requests participant consent)
async function requestSpotlight(liveId, participantId) {
  // Update Firestore: spotlight.pendingSpotlightRequest = true
  // This triggers notification to participant
  await firestore.collection('activeLives').doc(liveId)
    .collection('participants').doc(participantId)
    .update({ pendingSpotlightRequest: true });
}

// Participant accepts spotlight
async function acceptSpotlight(liveId, participantId) {
  // Update Firestore: publicSpotlightAuthorized = true
  // Also update spotlight singleton: { consentFrom: participantId, timestamp }
  await firestore.collection('activeLives').doc(liveId)
    .update({
      'spotlight.consentFrom': { userId: participantId, timestamp: Date.now() }
    });
}

// Host confirms spotlight (now visible to public)
async function confirmSpotlight(liveId, participantId) {
  // Update Firestore: spotlight.publicBroadcasting = true
  // This triggers composition agent to mix participant track into broadcast
  await firestore.collection('activeLives').doc(liveId)
    .update({
      'spotlight.currentParticipantId': participantId,
      'spotlight.publicBroadcasting': true,
      'spotlight.startedAt': Date.now()
    });
}

// End spotlight
async function endSpotlight(liveId) {
  await firestore.collection('activeLives').doc(liveId)
    .update({
      'spotlight.currentParticipantId': null,
      'spotlight.publicBroadcasting': false,
      'spotlight.endedAt': Date.now()
    });
}
```

---

## SPOTLIGHT CONSENT FLOW (State Machine)

```
HOST SIDE:
  Participant joins → Host sees "participant_name [camera icon]"
           ↓
  Host clicks "Show in Spotlight"
           ↓
  Firestore: pendingSpotlightRequest = true
           ↓
  Notification sent to participant: "Host wants to show your POV"


PARTICIPANT SIDE:
  Receives notification: "Host wants to show your POV"
           ↓
  Participant chooses:
           ├─ "Accept" → Firestore: publicSpotlightAuthorized = true
           │                        pendingSpotlightRequest = false
           │
           └─ "Decline" → Firestore: pendingSpotlightRequest = false
                                     (no spotlight granted)

HOST SEES ACCEPTANCE:
  Firestore listener detects publicSpotlightAuthorized = true
           ↓
  Host's UI updates: "Ready to spotlight [participant_name]"
  Host clicks "Go Live with [participant_name]"
           ↓
  Firestore: spotlight.currentParticipantId = participantId
             spotlight.publicBroadcasting = true
             spotlight.consentFrom = { userId, timestamp }
             (dual consent record locked in)

REVOCATION:
  Participant clicks "Hide me" at any time
           ↓
  Firestore: publicSpotlightAuthorized = false
  SFU listener: stops sending participant track to broadcast
           ↓
  Public broadcast falls back to host-only POV
  Notification to host: "[participant_name] has hidden their POV"
```

---

## TOGETHER (Private Friend Session) ARCHITECTURE

### **Differences from Workshop**

```
WORKSHOP:
  - 1 public broadcast (HLS/WHEP for 50–500 viewers)
  - 1 host (creator)
  - 5–10 interactive participants
  - Spotlight = public broadcast arm
  - Recording = public capture

TOGETHER:
  - 0 public broadcast (private only)
  - 2–4 friends (all equal, no host/participant role)
  - All bidirectional audio/video
  - No spotlight (everyone visible simultaneously on small screen)
  - Recording = optional, local-only (not published)
```

### **Firestore Schema for Together**

```
activeLives/{liveId}
  ├─ mode: 'together' (instead of 'workshop')
  ├─ together {
  │    friends: [ { userId, userName } ] (all 2–4 participants)
  │    cfRealtimeRoomId: string (private SFU room)
  │    encryptionKeyHash: string (optional — E2E encryption future feature)
  │ }
  │
  ├─ participants/{participantId} (all friends equal)
  │  ├─ userId
  │  ├─ connectionState
  │  ├─ cameraOn
  │  ├─ micOn
  │  └─ (NO publicSpotlightAuthorized — not applicable)
  │
  └─ (NO joinRequests, NO spotlight, NO public comments)
```

### **Together Session Flow**

```
Friend A initiates Together session
  ├─ Selects friends B, C, D
  ├─ Firebase Function creates live doc with mode='together'
  ├─ Generates CF Realtime room + tokens for all 4
  ├─ Sends invites (push notification) to B, C, D
           ↓
Friends B, C, D receive invite: "A wants to do Together activity"
  ├─ They click "Join"
  ├─ They receive their own CF Realtime tokens
  ├─ All 4 connect to same SFU room
  ├─ All 4 can see each other's video + hear audio
  ├─ All 4 can toggle camera/mic independently
           ↓
During call:
  ├─ No public broadcast (completely private)
  ├─ Optional: One friend records locally (save video to device)
           ↓
Call ends:
  ├─ No automatic recap (optional future feature: AI-generated recap for sharing among friends)
  ├─ Firestore live doc marked as 'completed'
```

---

## SPOTLIGHT COMPOSITION AGENT (Optional for MVP)

**Purpose:** Mix spotlighted participant's video + audio into CF Stream input (broadcast arm)

**Implementation Option 1: Client-Side Composition (Simpler for MVP)**
```
Host browser running StudioPage:
  ├─ Receives CF Realtime stream from spotlighted participant
  ├─ Mixes with host's own camera feed via Canvas API
  ├─ Publishes mixed stream to CF Stream Live Input (via WHIP)
  ├─ Public viewers see composed video
  
Advantage: No server-side agent needed; works immediately
Disadvantage: Requires host to keep StudioPage open + good CPU/network
```

**Implementation Option 2: Server-Side Agent (Scalable, Future)**
```
Firebase Function (serverless) or Node.js agent:
  ├─ Subscribes to CF Realtime room (as observer)
  ├─ Receives spotlighted participant's track
  ├─ Uses FFmpeg or WebRTC to mix with broadcast stream
  ├─ Publishes mixed stream to CF Stream Live Input
  
Advantage: Scales independently; host can close StudioPage
Disadvantage: More complex, requires agent infrastructure (cost +$0.001/min?)
```

**Recommendation for MVP:** Option 1 (client-side) — host must keep StudioPage open during Spotlight. Upgrade to agent in Phase 3.5 if needed.

---

## SECURITY: Firestore Rules (Draft)

```javascript
// File: firestore.rules (snippet for multi-participant)

match /activeLives/{liveId} {
  // Allow read if user is creator or authenticated viewer
  allow read: if request.auth != null && 
              (resource.data.creatorUid == request.auth.uid || request.auth != null);
  
  // Allow write (create) if user is authenticated
  allow create: if request.auth != null;
  
  match /participants/{participantId} {
    // Allow read if creator or participant
    allow read: if request.auth != null &&
                (resource.data.userId == request.auth.uid || parent.map.creatorUid == request.auth.uid);
    
    // Allow create: participant joins (server-side validation in Function)
    allow create: if request.auth != null;
    
    // Allow update: participant or host can update
    allow update: if request.auth != null &&
                  (resource.data.userId == request.auth.uid || parent.map.creatorUid == request.auth.uid);
    
    // ⚠️ CRITICAL: Prevent participant from self-authorizing spotlight
    // This check is in the Function, not the rule (functions are more flexible)
  }
  
  match /joinRequests/{requestId} {
    // Allow participant to create join request
    allow create: if request.auth != null;
    
    // Allow host to respond to request (approve/decline)
    allow update: if request.auth != null && parent.map.creatorUid == request.auth.uid;
  }
  
  match /spotlight/spotlight {
    // Only host can update spotlight
    allow update: if request.auth != null && parent.map.creatorUid == request.auth.uid;
  }
}
```

---

## MIGRATION STRATEGY (Minimal Risk)

### **Phase 3.1: Firestore Schema Deployment (Blue-Green)**

**Step 1:** Deploy schema extension (new subcollections) with feature flag
```javascript
// Firebase Function: check feature flag before allowing workshop join
if (!isWorkshopEnabled()) return error('Workshop not enabled');
```

**Step 2:** Test with Firebase Emulator locally
- Spin up emulator with extended schema
- Run existing live tests → verify no breakage
- Run new workshop tests → verify multi-participant flow

**Step 3:** Deploy to staging Firestore (optional `staging` database)
- Run production traffic against staging
- Verify no rules breakage

**Step 4:** Deploy to production Firestore
- Rules are backward-compatible (only add new subcollections, don't modify existing)
- Existing lives continue working (no migration needed)
- New Workshop lives use extended schema

**Rollback Plan:** If needed, disable feature flag; existing rules still apply

### **Phase 3.2: CF Realtime Integration**

**Step 1:** Deploy Firebase Functions (new `createMultiParticipantSession`, `generateParticipantToken`)
- Test with mock CF Realtime client (or staging CF account)
- Verify token generation, room creation

**Step 2:** Deploy client-side service (`rtcMultiParticipantService.js`)
- Behind feature flag: `VITE_WORKSHOP_ENABLED`
- Replace mock service with real CF Realtime service

**Step 3:** End-to-end test on staging
- Create Workshop live
- Invite participant
- Verify participant joins CF Realtime room
- Verify spotlight flow

**Step 4:** Deploy to production
- Feature flag: disabled by default (admin-only or localhost testing)
- Staged rollout: enable for 10% of creators, monitor for errors

### **Phase 3.3: Workshop UX Deployment**

**Step 1:** Enhance existing WorkshopDemoPage
- Replace mock service with real CF Realtime service
- Verify all UI flows (join, spotlight, revocation)

**Step 2:** Create new Workshop launch UI (BottomNav CTA, etc.)
- "Start Workshop" button in StudioPage
- Configuration: max participants, public/private, etc.

**Step 3:** Staged rollout to creators
- Initially: creator whitelist (50 trusted creators)
- Monitor: crashloops, Firestore rule errors, CF Realtime quota issues
- Gradually: open to all creators

---

## SUMMARY: Architecture Decision Lock-In

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Public Broadcast** | Cloudflare Stream (WHIP/WHEP) | Keep existing, proven, $1/1k min |
| **Multi-Participant SFU** | Cloudflare Realtime | $0.002/min (cheapest managed), Cloudflare-native |
| **Spotlight Composition** | Client-side Canvas (MVP) | Simple, works immediately |
| **Firestore Schema** | Extended `activeLives` subcollections | Backward-compatible, no migration |
| **Consent Model** | Dual approval (host + participant) | Legal requirement, Firestore rules enforce |
| **Recording** | CF Stream auto-record + CF Realtime export (optional) | Native to both platforms |

---

**Next Section:** WORKSHOP_SECURITY_AUDIT.md (audit Firestore rules, propose hardened rules, validate consent enforcement)
