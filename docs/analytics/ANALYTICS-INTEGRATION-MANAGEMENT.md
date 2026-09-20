# Analytics Integration & Management Guide

Status: Integration reference  
Last reviewed: 2026-09-18  
Read before coding: Yes, for adding tracking to components or managing the analytics system.

---

## Core Files

| File | Purpose |
|---|---|
| `src/services/analytics/analyticsSession.ts` | Session/anonymous/user IDs |
| `src/services/analytics/analyticsQueue.ts` | Local event queue + flush |
| `src/services/analytics/analyticsClient.ts` | HTTP submission with retry |
| `src/services/analytics/analyticsService.ts` | Public API for components |
| `src/services/analytics/streamViewTracker.ts` | Per-video watch session |
| `src/hooks/useStreamView.ts` | React hook wrapping the tracker |

---

## How to Use in a Component

```javascript
import { useStreamView } from '@/hooks/useStreamView'
import { analyticsService } from '@/services/analytics'

const {
  videoRefCallback,
  recordGearOpened,
  recordCreatorFollowed,
  recordShared,
  endSession,
} = useStreamView(
  live.id ? {
    streamId: live.id,
    creatorId: live.creatorId || 'unknown',
    source: 'watch',
    sourcePosition: index,
    category: live.category,
    environment: live.environment,
  } : null,
  { enabled: !!live.id && !creatorMode }
)

// Connect to the video element
<video ref={isActive ? (el) => { videoPlaybackRef.current = el; videoRefCallback(el); } : null} />

// Track actions
<button onClick={() => { recordCreatorFollowed(); setFollowing(true); }}>Follow</button>
<button onClick={recordShared}>Share</button>
<button onClick={() => { recordGearOpened(); setEquipmentSheetOpen(true); }}>Gear</button>

// Track navigation
const goTo = (direction) => {
  endSession('swipe');
  setIndex(...);
};
```

---

## Active Watch Time

Only counted when ALL THREE are true: video playing + element 50%+ visible + tab active.

```
0:00–0:05  playing + visible + active  → +5s
0:05–0:10  paused                       → +0s
0:10–0:15  playing + visible + active  → +5s
0:15–0:20  scrolled off                → +0s
0:20–0:25  tab hidden                  → +0s
0:25–0:30  playing + visible + active  → +5s
                                    = 15s active out of 30s
```

---

## Event Types

All events automatically include: `eventId`, `sessionId`, `anonymousId`, `userId`, `timestamp`, `streamId`, `creatorId`, `source`.

**View events:** `stream_view_impression`, `stream_view_started`, `stream_view_3/10/30_seconds`, `stream_view_ended`, `stream_view_skipped`  
**Action events:** `creator_followed`, `stream_shared`, `gear_opened`, `comment_sent`, `stream_rated`, `stream_reported`

---

## Direct API (without hook)

```typescript
// Session
analyticsService.setUserId(userId)

// View tracking
analyticsService.trackStreamImpression(streamId, creatorId, source, position)
analyticsService.trackStreamViewStarted(streamId, creatorId)
analyticsService.trackStreamViewThreshold(streamId, creatorId, seconds)
analyticsService.trackStreamViewEnded(streamId, creatorId, metrics, exitReason)
analyticsService.trackStreamSkipped(streamId, creatorId)

// Actions
analyticsService.trackCreatorFollowed(streamId, creatorId)
analyticsService.trackStreamShared(streamId, creatorId)
analyticsService.trackGearOpened(streamId, creatorId)
```

---

## Queue Management

```typescript
import { analyticsQueue } from '@/services/analytics'
analyticsQueue.flush()      // force send immediately
analyticsQueue.getQueueSize()
analyticsQueue.clear()      // emergency only
```

---

## Configuration

All thresholds in `src/services/analytics/analyticsConfig.ts`:
- `FLUSH_INTERVAL_MS: 30000` — change to send more/less often
- `BATCH_SIZE: 50` — events per request
- `RETENTION_THRESHOLDS` — 3s/10s/30s milestones

---

## Troubleshooting

**Events not queuing?**  
Check `Application > Local Storage > vuvio:analytics-queue`. Verify `enabled: !!live.id && !creatorMode` in the hook config.

**Events not sending?**  
The backend endpoint doesn't exist yet (Firebase Spark plan). Events stay queued until Blaze is active.

**Watch time seems wrong?**  
All three conditions must be true simultaneously: playing, visible, tab active.

---

## Implementation Status

- [x] Phase 1: Event queue + session
- [x] Phase 2: Watch page view tracking
- [x] Phase 2.5: Explore/Globe/Profile tracking
- [ ] Phase 1.5: Backend endpoint (blocked by Spark plan)
- [ ] Phase 3: Stats aggregation
- [ ] Phase 4: Admin dashboard
