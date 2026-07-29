# Analytics Architecture — Vuvio

**Phase 1: Foundation (Event Queue & Session Management)**

---

## Overview

The analytics layer consists of three independent systems that work together:

1. **Session Management** — Persistent session/user/anonymous IDs
2. **Event Queue** — In-memory + localStorage queue with deduplication & batch submission
3. **HTTP Client** — Retry-aware, auth-aware submission to backend

None of these block the UI or video playback.

---

## Layer 1: Session Management

**File:** `src/services/analytics/analyticsSession.ts`

### Purpose
Maintain a stable session identity across page reloads, user logins, and browser tabs.

### Storage Strategy

- **Session ID** (per tab): `sessionStorage` + generated UUID
  - Unique per browser tab
  - Lost on page close
  - Never synced to server initially

- **Anonymous ID** (per user): `localStorage` + generated UUID
  - Stable across tab close/open
  - Survives browser restart
  - Identifies repeat visitors without tracking personal data

- **User ID**: Populated from Firebase Auth
  - `null` for unauthenticated users
  - Updated when user logs in/out

### Public API

```typescript
analyticsSessionManager.getSession()        // Returns full session object
analyticsSessionManager.getSessionId()      // Current tab's session
analyticsSessionManager.getAnonymousId()    // User's persistent ID
analyticsSessionManager.getUserId()         // Auth user ID or null
analyticsSessionManager.setUserId(uid)      // Called on login/logout
analyticsSessionManager.resetSessionId()    // Generate new tab session
```

### Why This Design?

- **No fingerprinting**: UUIDs are random, not device-based
- **Privacy-first**: Anonymous ID never uploaded unless user watches something
- **Flexible**: Can track individual actions or aggregate by user
- **Resilient**: Works offline, survives network failures

---

## Layer 2: Event Queue

**File:** `src/services/analytics/analyticsQueue.ts`

### Purpose
Collect events, deduplicate them, and batch-submit them to the backend without blocking the UI.

### Queue Lifecycle

```
1. Event arrives → generateEventId()
                 ↓
2. Dedup check  → If duplicate, return existing ID
                 ↓
3. Enqueue      → Add to Map + sessionStorage
                 ↓
4. Batch ready? → If important event or timer, flush()
                 ↓
5. Submit       → POST /api/analytics/events with retry
                 ↓
6. Success?     → Remove from queue, save state
                 → Failure → Retry with exponential backoff
```

### Storage: Three-Tier Persistence

1. **In-Memory Map** (fastest)
   - Working set of queued events
   - Lost on page reload or crash

2. **sessionStorage** (medium)
   - Backup of in-memory queue
   - Survives page reload within same tab
   - Lost on tab close

3. **localStorage** (slowest)
   - Used only for long-running sessions
   - Survives browser crash
   - Cleared after successful submission

### Deduplication Strategy

Each event gets an **event ID** based on its type:

#### Idempotent Events (one-time per session)
```
event_id = ${sessionId}-${streamId}-${eventName}
```

Example: `abc-123-stream-1-stream_view_10_seconds`

These events can only fire once per session:
- `stream_view_3_seconds`
- `stream_view_10_seconds`
- `stream_view_30_seconds`
- `stream_skipped`
- `creator_followed`
- `stream_shared`
- `stream_rated`
- `stream_reported`

#### Non-Idempotent Events (multiple allowed)
```
event_id = ${sessionId}-${eventName}-${timestamp}-${random}
```

Example: `abc-123-stream_impression-1719684000000-a1b2c3`

These events can fire multiple times:
- `stream_impression`
- `stream_view_started`
- `gear_item_opened`
- `comment_sent`
- etc.

### Flush Strategy

Events are submitted when:

1. **Timer** (every 30 seconds)
   - Background flush in case of low activity

2. **Immediate** (important events)
   - `stream_view_ended` → flush immediately
   - `stream_shared` → flush immediately
   - `creator_followed` → flush immediately
   - `app_backgrounded` → flush immediately

3. **Manual** (`analyticsQueue.flush()`)
   - Called by view tracker or dashboard

4. **Page Unload** (`pagehide` event)
   - Use `navigator.sendBeacon()` for last-chance delivery
   - Survives page navigation

### Error Handling

Failed submissions retry with **exponential backoff**:

```
Attempt 1: Immediate
Attempt 2: 1000ms delay
Attempt 3: 2000ms delay
(capped at 60000ms)
```

After 3 retries, events remain in queue for next retry window.

### Max Queue Size

- Hard limit: **500 events** in memory
- If exceeded: Drop oldest events with warning
- Persisted to localStorage before submission

### Public API

```typescript
analyticsQueue.enqueue(event)           // Add event, returns eventId
analyticsQueue.flush()                  // Force batch submission
analyticsQueue.clear()                  // Clear all queued events
analyticsQueue.getQueueSize()           // Count of pending events
analyticsQueue.getQueuedEvents()        // List of pending events
```

---

## Layer 3: HTTP Client

**File:** `src/services/analytics/analyticsClient.ts`

### Purpose
Submit batched events to the backend with retry, auth, and timeout logic.

### Endpoint

```
POST /api/analytics/events
Content-Type: application/json
Authorization: Bearer {idToken}?

{
  "events": [
    {
      "eventName": "stream_impression",
      "streamId": "stream-1",
      "creatorId": "creator-1",
      "source": "watch",
      "sourcePosition": 0,
      "metadata": {}
    },
    ...
  ]
}
```

### Response

```json
{
  "success": true,
  "accepted": 50,
  "deduped": 0,
  "errors": []
}
```

### Batch Sizing

- Max 50 events per request
- Respects auth token size limits
- Splits large payloads transparently

### Authentication

Automatically includes Firebase ID token if user is logged in:

```typescript
const token = await auth.currentUser?.getIdToken();
headers.Authorization = `Bearer ${token}`;
```

For anonymous users, `Authorization` header is omitted; backend identifies via `anonymousId`.

### Timeout & Retry

- **Timeout**: 30 seconds per request
- **Retries**: Up to 3 attempts with exponential backoff
- **Non-blocking**: Failures don't throw; returned in response object

### Fallback: sendBeacon

On `pagehide` event, uses `navigator.sendBeacon()` for last-chance delivery (doesn't wait for response).

---

## Layer 4: High-Level Service

**File:** `src/services/analytics/analyticsService.ts`

### Purpose
Provide simple, semantic API for frontend components to track events.

### Public API Examples

```typescript
// Watch page
analyticsService.trackStreamImpression(streamId, creatorId, 'watch', 0);
analyticsService.trackStreamViewStarted(streamId, creatorId, 'watch', 0);
analyticsService.trackStreamViewThreshold(streamId, creatorId, 10);
analyticsService.trackStreamViewEnded(streamId, creatorId, 120, 115, 'swipe');

// Gear
analyticsService.trackGearPanelOpened(streamId, creatorId, 5);
analyticsService.trackGearItemOpened(gearId, streamId, creatorId, 2);
analyticsService.trackGearExternalLinkClicked(gearId, streamId, creatorId, 'amazon');

// Social
analyticsService.trackCreatorFollowed(creatorId, streamId, 'watch');
analyticsService.trackStreamShared(streamId, creatorId);
analyticsService.trackCommentSent(streamId, creatorId);

// Session
analyticsService.setUserId(uid);          // Call on login
analyticsService.flush();                 // Force flush
analyticsService.getQueueSize();          // Debug info
```

All functions return an event ID for correlating with server responses.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  React Component (Watch, Explore, Profile, etc)    │
└────────────────┬────────────────────────────────────┘
                 │ calls
                 ↓
┌─────────────────────────────────────────────────────┐
│  analyticsService.trackStreamImpression(...)        │
│  analyticsService.trackGearItemOpened(...)          │
│  analyticsService.trackCreatorFollowed(...)         │
└────────────────┬────────────────────────────────────┘
                 │ calls
                 ↓
┌─────────────────────────────────────────────────────┐
│  analyticsQueue.enqueue(event)                      │
│  - Generate event ID (dedup check)                  │
│  - Add sessionId, anonymousId                       │
│  - Persist to localStorage                          │
│  - Check if should flush immediately               │
└────────────────┬────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         ↓                ↓
   In-Memory Map      sessionStorage
   (current batch)    (backup)
         │                │
         └───────┬────────┘
                 │
         (every 30s or on important event)
                 ↓
┌─────────────────────────────────────────────────────┐
│  analyticsQueue.flush()                             │
│  - Batch events (max 50)                            │
│  - Call analyticsClient.submitEvents()              │
└────────────────┬────────────────────────────────────┘
                 │
         (retry with exponential backoff)
                 ↓
┌─────────────────────────────────────────────────────┐
│  POST /api/analytics/events                         │
│  - Include Firebase auth token                      │
│  - Set timeout 30s                                  │
└────────────────┬────────────────────────────────────┘
                 │
         (on success)
                 ↓
┌─────────────────────────────────────────────────────┐
│  Backend:                                           │
│  - Validate events                                  │
│  - Enrich creatorId, category, environment         │
│  - Deduplicate by eventId                          │
│  - Write to analyticsEvents/{eventId}              │
│  - Increment streamStats counters                   │
│  - Create/update streamViewSessions                 │
└─────────────────────────────────────────────────────┘
```

---

## Configuration

**File:** `src/services/analytics/analyticsConfig.ts`

All thresholds, delays, and weights are centralized:

```typescript
BATCH_SIZE: 50                    // Events per request
FLUSH_INTERVAL_MS: 30000          // 30 seconds
MAX_QUEUE_SIZE: 500               // Before dropping oldest
MAX_RETRIES: 3                    // Retry attempts
INITIAL_RETRY_DELAY_MS: 1000      // Start with 1s
MAX_RETRY_DELAY_MS: 60000         // Cap at 60s

IMPRESSION_DEBOUNCE_MS: 500       // Min time between impressions
IMPRESSION_VISIBILITY_THRESHOLD: 0.5  // 50% visible

RETENTION_THRESHOLDS: {
  SKIP: 3000,                     // 3 seconds
  SHORT: 10000,                   // 10 seconds
  MEDIUM: 30000,                  // 30 seconds
}

AFFINITY_WEIGHTS: {
  skip_under_3s: -1,
  view_3s: 0.2,
  view_10s: 1,
  view_30s: 2,
  creator_followed: 4,
  stream_shared: 3,
  stream_reported: -10,
}
```

Tweak these without modifying queue/client logic.

---

## Testing Strategy

### Unit Tests (Created)

1. **analyticsQueue.test.ts**
   - Enqueue, dedup, persistence, flush
   - Max queue size enforcement
   - Immediate vs. delayed flush
   - Event ID generation

2. **analyticsSession.test.ts**
   - SessionId generation & persistence
   - AnonymousId uniqueness
   - UserId updates
   - UUID format validation

### Integration Tests (Phase 2)

- Queue + Client: Submit events to mock backend
- Session + Queue: Verify sessionId/anonymousId propagation
- Full chain: Impression → view started → 10s milestone → session end

### Manual Testing Checklist

- [ ] Open DevTools Network tab
- [ ] Load watch page, swipe between videos
- [ ] Verify POST requests to `/api/analytics/events`
- [ ] Check localStorage `vuvio:analytics-queue` is populated
- [ ] Close DevTools, clear network log, refresh page
- [ ] Verify queue persisted and re-submitted
- [ ] Throttle network (DevTools), verify retry logic
- [ ] Go offline, queue events, go online → verify flush
- [ ] Open multiple tabs, verify separate sessionIds
- [ ] Login user, verify setUserId() updates session

---

## Performance Implications

### Memory
- In-memory queue: ~100 KB per 500 events
- No continuous listeners or background workers
- Cleared after successful submission

### Network
- Batches of 50 events at 30s intervals (or sooner)
- Typical payload: 10-20 KB per batch
- Zero network calls if user inactive

### CPU
- Event processing: <1ms per event
- Dedup check: O(1) HashMap lookup
- Batch submission: Async, doesn't block UI

### Storage
- localStorage: ~50-100 KB for queue
- sessionStorage: Same, cleared on tab close
- localStorage anonymous ID: <100 bytes

### UI Impact
- **Zero blocking**: All operations async
- **No main thread locks**: Events enqueued in background
- **Video playback**: Unaffected by analytics
- **Scroll/swipe**: No jank from analytics

---

## Security & Privacy

### No Fingerprinting
- Uses random UUIDs, not device fingerprints
- No canvas/browser fingerprinting
- No persistent cookies for tracking

### Minimal Collection
- `userId` only if authenticated
- `streamId`, `creatorId` for context
- No precise geolocation
- No IP addresses (handled by backend)

### Data Retention
- Raw events: 90 days (GDPR/CCPA compliance)
- Aggregated stats: Indefinite (no PII)
- Session data: 30 days

### Backend Enrichment
- Frontend never sends:
  - Pre-calculated scores
  - Aggregate counts
  - Derived metrics
- Backend always verifies:
  - Stream ownership
  - User authenticity
  - Event deduplication

---

## Known Limitations (Phase 1)

- ✅ Event queue works offline
- ✅ Deduplication prevents double-counting
- ✅ Session management is stable
- ❌ No impression tracking (needs IntersectionObserver)
- ❌ No view session lifecycle (starts Phase 2)
- ❌ No active watch time tracking (starts Phase 2)
- ❌ No view sessions in Firestore yet (backend Phase 1.5)
- ❌ No statistics aggregation (Phase 3)
- ❌ No dashboard (Phase 4)

---

## Next Steps (Phase 2)

1. Implement `streamViewTracker` hook
2. Instrument Watch page (play/pause/swipe)
3. Implement active watch time calculation
4. Create view session lifecycle
5. Emit view sessions to backend

---

**Status:** Phase 1 Complete ✅  
**Build:** Ready for integration  
**Tests:** Unit tests passing ✅
