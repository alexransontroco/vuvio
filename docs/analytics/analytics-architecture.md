# Analytics Architecture — Vuvio

Status: Architecture reference, partially current  
Last reviewed: 2026-09-18  
Read before coding: Yes, for analytics event, queue, session, or backend ingestion changes.

> Verify current service files, event schemas, and deployed backend availability before relying on implementation status. Watch/Explore event changes must avoid duplicate spam during rerenders and navigation.

---

## System Overview

Three independent layers that don't block UI or video playback:

1. **Session Management** — Persistent session/user/anonymous IDs
2. **Event Queue** — In-memory + localStorage queue with deduplication & batch submission
3. **HTTP Client** — Retry-aware, auth-aware submission to backend

---

## Layer 1: Session Management

**File:** `src/services/analytics/analyticsSession.ts`

Maintains stable session identity across page reloads, logins, and tabs.

| Storage | ID | Scope |
|---|---|---|
| `sessionStorage` | `sessionId` | Per tab, lost on close |
| `localStorage` | `anonymousId` | Persistent across sessions, random UUID |
| Firebase Auth | `userId` | Authenticated users only |

```typescript
analyticsSessionManager.getSession()
analyticsSessionManager.setUserId(uid)   // call on login/logout
analyticsSessionManager.resetSessionId()
```

No fingerprinting. Anonymous ID never uploaded unless user watches something.

---

## Layer 2: Event Queue

**File:** `src/services/analytics/analyticsQueue.ts`

```
Event → generateEventId() → dedup check → enqueue → flush when ready → POST /api/analytics/events
```

**Three-tier persistence:** in-memory Map → sessionStorage → localStorage  
**Max queue size:** 500 events (oldest dropped on overflow)  
**Flush triggers:** 30s timer, important events (view_ended, shared, followed, backgrounded), manual call, `pagehide`

### Deduplication

Idempotent events (one-time per session):
```
event_id = ${sessionId}-${streamId}-${eventName}
```
Events: `stream_view_3/10/30_seconds`, `stream_skipped`, `creator_followed`, `stream_shared`

Non-idempotent events (multiple allowed):
```
event_id = ${sessionId}-${eventName}-${timestamp}-${random}
```
Events: `stream_impression`, `stream_view_started`, `gear_item_opened`, etc.

### Retry

Exponential backoff: 1s → 2s → (cap 60s). After 3 retries, events stay queued.

```typescript
analyticsQueue.enqueue(event)
analyticsQueue.flush()
analyticsQueue.getQueueSize()
```

---

## Layer 3: HTTP Client

**File:** `src/services/analytics/analyticsClient.ts`

```
POST /api/analytics/events
Authorization: Bearer {idToken}?     // omitted for anonymous users
Content-Type: application/json

{ "events": [...] }                  // max 50 per request

→ { "success": true, "accepted": N, "deduped": N, "errors": [] }
```

- Timeout: 30s per request, up to 3 retries
- `navigator.sendBeacon()` on `pagehide` for last-chance delivery

---

## Layer 4: High-Level Service

**File:** `src/services/analytics/analyticsService.ts`

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

// Session
analyticsService.setUserId(uid);
analyticsService.flush();
```

---

## Configuration

**File:** `src/services/analytics/analyticsConfig.ts`

```typescript
BATCH_SIZE: 50
FLUSH_INTERVAL_MS: 30000
MAX_QUEUE_SIZE: 500
MAX_RETRIES: 3
INITIAL_RETRY_DELAY_MS: 1000
MAX_RETRY_DELAY_MS: 60000

IMPRESSION_DEBOUNCE_MS: 500
IMPRESSION_VISIBILITY_THRESHOLD: 0.5

RETENTION_THRESHOLDS: { SKIP: 3000, SHORT: 10000, MEDIUM: 30000 }

AFFINITY_WEIGHTS: {
  skip_under_3s: -1, view_3s: 0.2, view_10s: 1, view_30s: 2,
  creator_followed: 4, stream_shared: 3, stream_reported: -10,
}
```

---

## Security & Privacy

- Random UUIDs only — no device fingerprinting
- `userId` only if authenticated; no precise geolocation
- Raw events retained 90 days; aggregated stats indefinitely
- Backend always enriches/verifies `userId`, `creatorId`, `category`, `environment` — never trusts frontend-provided values

---

## Performance

- In-memory queue: ~100 KB per 500 events
- Network: batches of 50 at 30s intervals, ~10–20 KB per batch
- CPU: <1ms per event, O(1) dedup lookup
- Zero blocking — all async, video playback unaffected

---

## Unit Tests

- `analyticsQueue.test.ts` — enqueue, dedup, persistence, flush, size limits
- `analyticsSession.test.ts` — sessionId generation, anonymousId uniqueness, userId updates
