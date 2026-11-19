# Phase 3 Section 5: Workshop & Together Security Audit

**Session:** 2026-11-17 · **Status:** IN PROGRESS — Firestore rules review + test design

---

## OVERVIEW: Threat Model

### **Actors & Trust Boundaries**

```
Creator (Host)
  ├─ Can: Start Workshop, invite participants, approve joins, spotlight management
  ├─ Cannot: Unilaterally broadcast participant POV without consent
  └─ Risk: Malicious creator forces spotlight on unwilling participant

Participant
  ├─ Can: Request join, accept/decline spotlight, leave at any time
  ├─ Cannot: Self-approve spotlight, modify other participants' permissions
  └─ Risk: Participant joins, then denies having agreed (refutation attack)

Viewer (Spectator, Public)
  ├─ Can: Watch public HLS/WHEP broadcast
  ├─ Cannot: Access participant audio/video without public broadcast
  └─ Risk: Brute-force guess participant room IDs

Cloudflare (SFU Operator)
  ├─ Sees: All participant media flowing through SFU (architecture constraint)
  ├─ Cannot: Access without key (encryption in transit via DTLS)
  └─ Risk: Cloudflare abuse, data retention (Cloudflare's privacy policy applies)
```

### **Key Security Properties (MVP)**

1. **Mutual Consent (Spotlight):** Host + Participant both must approve before public broadcast
2. **Non-repudiation (Audit Trail):** Firestore records all approvals with timestamps
3. **Revocation:** Participant can revoke spotlight at any time (immediate broadcast fallback to host-only)
4. **Isolation:** Participant audio/video invisible to public unless spotlighted + consented
5. **Confidentiality (Transit):** DTLS encryption between participant ↔ SFU, SFU ↔ broadcast
6. **No End-to-End Encryption (MVP Limitation):** SFU can observe all media (architecture constraint)

---

## FIRESTORE RULES AUDIT

### **Current Draft Rules (From Architecture Doc)**

```javascript
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

### **FINDING 1: Participant Can Self-Approve Spotlight** ⚠️ CRITICAL

**Vulnerability:** `participants/{participantId}.update()` allows participant OR host to update. If participant modifies `publicSpotlightAuthorized = true`, they self-approve spotlight without host consent.

**Threat:** Participant tricks host by self-authorizing spotlight, then claims they were forced on broadcast.

**Mitigation:**
```javascript
match /participants/{participantId} {
  allow update: if request.auth.uid == resource.data.userId &&
                // Participant can only update camera/mic, NOT spotlight fields
                request.resource.data.diff(resource.data).affectedKeys()
                  .hasOnly(['cameraOn', 'micOn', 'connectionState']) ||
                request.auth.uid == parent.map.creatorUid;
  // Host can update any field
}
```

**Status:** ✅ **RULE CHANGE NEEDED** — ensure participant can only update `cameraOn`/`micOn`, NOT spotlight authorization fields

---

### **FINDING 2: Host Can Unilaterally Modify Spotlight Singleton** ⚠️ CRITICAL

**Vulnerability:** `spotlight/spotlight.update()` only checks `creatorUid`, but doesn't verify participant consent before setting `publicBroadcasting = true`.

**Threat:** Host could set spotlight and `publicBroadcasting = true` without participant ever accepting. Public broadcast would include participant POV without consent.

**Current Flow (Broken):**
1. Host clicks "Spotlight [Participant]" → `spotlight.currentParticipantId = participantId` (no participant notification)
2. Host clicks "Go Live" → `spotlight.publicBroadcasting = true` (broadcast starts immediately)
3. Participant never consented ❌

**Mitigation:** Require `publicSpotlightAuthorized = true` check before allowing `publicBroadcasting = true`:

```javascript
match /spotlight/{doc} {
  allow update: if request.auth.uid == parent.map.creatorUid &&
                // Can only set publicBroadcasting if participant consented
                (request.resource.data.publicBroadcasting == false ||
                 // Check that referenced participant has authorized
                 get(/databases/$(database)/documents/activeLives/$(liveId)/participants/$(request.resource.data.currentParticipantId))
                   .data.publicSpotlightAuthorized == true);
}
```

**Status:** ✅ **RULE CHANGE NEEDED** — validate consent before `publicBroadcasting = true`

---

### **FINDING 3: Participant Can Decline Join Request, Then Rejoin Immediately** ⚠️ LOW RISK

**Vulnerability:** No cooldown or rate limiting on join requests. Participant could spam "decline" + "rejoin" to cause UI churn.

**Threat:** Low severity (UI annoying, not security breach). Mitigated by rate limiting at Function layer.

**Mitigation:** Add server-side Function validation:
```javascript
// Firebase Function: validateJoinRequest()
// Before allowing a new join request, check:
// - Previous request created <1 min ago? → deny with "Please wait"
// - Participant already in participants list? → auto-accept
```

**Status:** ⚠️ **FUNCTION CHANGE RECOMMENDED** — add cooldown in validateJoinRequest()

---

### **FINDING 4: No Validation That `creatorUid` Matches Authenticated User** ⚠️ MEDIUM

**Vulnerability:** Rules check `parent.map.creatorUid == request.auth.uid`, but don't verify that `request.auth.uid` is the actual creator (could be spoofed in test).

**Threat:** Low in production (Firebase Auth is reliable), but risky in development/tests.

**Mitigation:** Ensure Firebase Auth is properly initialized in all tests. Use Firebase Emulator for security rule testing.

**Status:** ✅ **TESTING STRATEGY** — write Emulator tests with fake UIDs to validate auth checks

---

### **FINDING 5: No Validation of `spotlightParticipantId` Exists** ⚠️ MEDIUM

**Vulnerability:** Host could set `spotlight.currentParticipantId` to a UID that doesn't exist in the participants list.

**Threat:** Composition agent tries to fetch non-existent participant → silent failure or crash.

**Mitigation:** Add Function validation:
```javascript
// Firebase Function: confirmSpotlight()
const participantRef = await db.collection('activeLives').doc(liveId)
  .collection('participants').doc(participantId).get();
if (!participantRef.exists) throw new Error('Participant not found');
if (!participantRef.data().publicSpotlightAuthorized) throw new Error('Participant did not consent');
```

**Status:** ✅ **FUNCTION VALIDATION NEEDED** — verify participant exists + consented before spotlight

---

## HARDENED FIRESTORE RULES (Proposed)

```javascript
// File: firestore.rules (Multi-Participant Workshop Section)

match /activeLives/{liveId} {
  // Existing rules for broadcast (unchanged)
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null && resource.data.creatorUid == request.auth.uid;
  
  // === PARTICIPANTS SUBCOLLECTION ===
  match /participants/{participantId} {
    allow read: if request.auth != null && 
                (request.auth.uid == resource.data.userId || 
                 request.auth.uid == parent.map.creatorUid);
    
    allow create: if request.auth != null;
      // Real validation in Firebase Function (generateParticipantToken)
      // Function must:
      // - Verify host approved join request
      // - Verify participant not already in participants list
      // - Create participant doc with cameraOn=false (default)
    
    allow update: if request.auth.uid == resource.data.userId &&
                  // Participant can ONLY update camera/mic state
                  request.resource.data.diff(resource.data).affectedKeys()
                    .hasOnly(['cameraOn', 'micOn', 'connectionState', 'updatedAt']) ||
                  // Host can update any field
                  (request.auth.uid == parent.map.creatorUid &&
                   // But host CANNOT directly set publicSpotlightAuthorized without consent flow
                   !request.resource.data.diff(resource.data).affectedKeys()
                     .hasAny(['publicSpotlightAuthorized']));
    
    allow delete: if request.auth.uid == parent.map.creatorUid;
      // Only host can remove participant (kick out)
  }
  
  // === JOIN REQUESTS SUBCOLLECTION ===
  match /joinRequests/{requestId} {
    allow read: if request.auth != null &&
                (request.auth.uid == resource.data.userId ||
                 request.auth.uid == parent.map.creatorUid);
    
    allow create: if request.auth != null &&
                  request.auth.uid == request.resource.data.userId;
      // Participant creates their own request
    
    allow update: if request.auth.uid == parent.map.creatorUid &&
                  request.resource.data.status in ['accepted', 'declined'];
      // Only host can approve/decline, only to these statuses
    
    allow delete: if request.auth.uid == parent.map.creatorUid;
      // Host can clean up old requests
  }
  
  // === SPOTLIGHT SINGLETON ===
  match /spotlight/spotlight {
    allow read: if request.auth != null &&
                (request.auth.uid == parent.map.creatorUid ||
                 // Participant can only read if they're spotlighted
                 get(/databases/$(database)/documents/activeLives/$(liveId)/participants/$(request.auth.uid))
                   .exists);
    
    allow update: if request.auth.uid == parent.map.creatorUid &&
                  (
                    // Host can set currentParticipantId (but not publicBroadcasting yet)
                    (request.resource.data.currentParticipantId != resource.data.currentParticipantId &&
                     request.resource.data.publicBroadcasting == false) ||
                    // Host can set publicBroadcasting only if participant consented
                    (request.resource.data.publicBroadcasting == true &&
                     get(/databases/$(database)/documents/activeLives/$(liveId)/participants/$(request.resource.data.currentParticipantId))
                       .data.publicSpotlightAuthorized == true) ||
                    // Host can always turn off spotlight
                    (request.resource.data.currentParticipantId == null &&
                     request.resource.data.publicBroadcasting == false)
                  );
  }
}
```

---

## FIREBASE EMULATOR TESTS (Validation)

**Purpose:** Ensure Firestore rules enforce mutual consent without breaking legitimate flows.

**Test Framework:** Node.js + `@firebase/rules-unit-testing`

```javascript
// File: __tests__/workshopSecurityRules.test.js

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

describe('Workshop Security Rules', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'vuvio-test',
      firestore: { host: 'localhost', port: 8080 },
    });
  });

  describe('Participant Self-Approval Prevention', () => {
    it('should prevent participant from self-approving spotlight', async () => {
      const hostDb = testEnv.authenticatedContext('host-uid').firestore();
      const participantDb = testEnv.authenticatedContext('participant-uid').firestore();

      // Host creates live
      await hostDb.collection('activeLives').doc('live-1').set({
        creatorUid: 'host-uid',
        creatorId: 'host-name',
        mode: 'workshop',
      });

      // Host adds participant
      await hostDb.collection('activeLives').doc('live-1').collection('participants').doc('participant-1').set({
        userId: 'participant-uid',
        publicSpotlightAuthorized: false,
      });

      // ❌ Participant attempts to self-approve spotlight
      await assertFails(
        participantDb.collection('activeLives').doc('live-1').collection('participants').doc('participant-1').update({
          publicSpotlightAuthorized: true,
        })
      );

      console.log('✅ Participant cannot self-approve spotlight');
    });

    it('should allow participant to toggle camera on/off', async () => {
      const participantDb = testEnv.authenticatedContext('participant-uid').firestore();

      // ✅ Participant can update camera
      await assertSucceeds(
        participantDb.collection('activeLives').doc('live-1').collection('participants').doc('participant-1').update({
          cameraOn: true,
        })
      );

      console.log('✅ Participant can toggle camera');
    });
  });

  describe('Host Unilateral Spotlight Prevention', () => {
    it('should prevent host from broadcasting spotlight without participant consent', async () => {
      const hostDb = testEnv.authenticatedContext('host-uid').firestore();

      // Host tries to set publicBroadcasting without participant consent
      await assertFails(
        hostDb.collection('activeLives').doc('live-1').collection('spotlight').doc('spotlight').update({
          currentParticipantId: 'participant-uid',
          publicBroadcasting: true,
          // But participant has NOT consented (publicSpotlightAuthorized = false)
        })
      );

      console.log('✅ Host cannot broadcast without participant consent');
    });

    it('should allow host to broadcast after participant consents', async () => {
      const hostDb = testEnv.authenticatedContext('host-uid').firestore();
      const participantDb = testEnv.authenticatedContext('participant-uid').firestore();

      // Participant consents
      await participantDb.collection('activeLives').doc('live-1').collection('participants').doc('participant-1').update({
        publicSpotlightAuthorized: true,
      });

      // ✅ Host can now broadcast
      await assertSucceeds(
        hostDb.collection('activeLives').doc('live-1').collection('spotlight').doc('spotlight').update({
          currentParticipantId: 'participant-uid',
          publicBroadcasting: true,
        })
      );

      console.log('✅ Host can broadcast after participant consent');
    });
  });

  describe('Revocation', () => {
    it('should allow participant to revoke spotlight at any time', async () => {
      const participantDb = testEnv.authenticatedContext('participant-uid').firestore();

      // Participant revokes spotlight
      await assertSucceeds(
        participantDb.collection('activeLives').doc('live-1').collection('participants').doc('participant-1').update({
          publicSpotlightAuthorized: false,
        })
      );

      console.log('✅ Participant can revoke spotlight');
    });
  });
});
```

**How to Run:**
```bash
# Start Firebase Emulator
firebase emulators:start --only firestore

# Run tests in another terminal
npm test -- workshopSecurityRules.test.js
```

---

## LIMITATIONS & ACCEPTANCE CRITERIA (MVP)

### **What MVP Secures ✅**

1. **Mutual Consent (Spotlight):** Host + Participant both must approve before public broadcast
2. **Participant Revocation:** Participant can hide themselves from broadcast at any time (Firestore update → SFU listener stops forwarding)
3. **Audit Trail:** Firestore records all approvals with timestamps (non-repudiation)
4. **Isolation:** Private POVs stay private unless spotlighted + consented

### **What MVP Does NOT Secure ⚠️ (Document as Limitations)**

1. **End-to-End Encryption:** SFU sees all media (architecture constraint)
   - **Mitigation:** Cloudflare privacy policy + TLS in transit
   - **Future:** Client-side encryption with server-side media transformation (complex, Phase 3.5+)

2. **Screen-Locked Participant (Audio-Only):** WebRTC audio stops when screen locks on mobile
   - **Mitigation:** Tell users "keep screen on" during Together (PWA + Audio API workaround Phase 3.5+)
   - **Severity:** LOW (acceptable for MVP, friends use case)

3. **Network Buffering:** Participant revocation → public broadcast fallback has ~1–5s delay
   - **Reason:** Media buffering in SFU + broadcast pipeline
   - **Mitigation:** Document in IMPLEMENTATION_ROADMAP: "expect 1–5s delay between revocation + fallback"
   - **Severity:** LOW (acceptable, participant is already leaving)

4. **Participant Impersonation:** No biometric verification; someone else could use participant's device
   - **Mitigation:** Participant must keep device secure (outside scope of app)
   - **Severity:** LOW (trust model: friends know each other)

5. **Host Credential Compromise:** If host's Firebase Auth is compromised, attacker can spotlight anyone
   - **Mitigation:** Standard Firebase Auth security (2FA recommended)
   - **Severity:** MEDIUM (but standard risk for any creator app)

---

## ACCEPTANCE CRITERIA (Test Plan for QA)

Before launching Workshop to producers, validate:

- [ ] **Firestore Rules Deployed** — `firestore.rules` updated with hardened rules
- [ ] **Security Tests Pass** — `workshopSecurityRules.test.js` all green ✅
- [ ] **Participant Cannot Self-Approve** — Manual test: participant modifies `publicSpotlightAuthorized` → firestore denies
- [ ] **Host Cannot Broadcast Without Consent** — Manual test: host tries `publicBroadcasting = true` without participant consent → firestore denies
- [ ] **Revocation Works** — Manual test: participant revokes spotlight → public broadcast falls back to host within 5s
- [ ] **Audit Trail Exists** — Manual test: check Firestore `spotlight` doc has `consentFrom` + `consentFromHost` timestamps
- [ ] **Limitations Documented** — Add notes to IMPLEMENTATION_ROADMAP about E2E encryption, screen-lock, buffering delays

---

## SUMMARY OF SECURITY CHANGES NEEDED

| Finding | Severity | Action | Status |
|---------|----------|--------|--------|
| Participant self-approves spotlight | CRITICAL | Restrict participant updates to `cameraOn`/`micOn` only | ✅ Rule change |
| Host broadcasts without consent | CRITICAL | Validate `publicSpotlightAuthorized` before allowing `publicBroadcasting` | ✅ Rule change |
| Join request spam | LOW | Add cooldown in Firebase Function | ✅ Function validation |
| Non-existent participant spotlight | MEDIUM | Validate participant exists before spotlight | ✅ Function validation |
| Stale `creatorUid` | MEDIUM | Write Emulator tests with fake UIDs | ✅ Testing |

---

**Next Section:** IMPLEMENTATION_ROADMAP.md (phased rollout, dependencies, cost forecast, PoC scope)
