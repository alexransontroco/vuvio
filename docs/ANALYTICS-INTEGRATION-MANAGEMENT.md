# Analytics Integration & Management Guide

**Purpose:** Complete guide to understand, manage, and maintain the analytics system built into Vuvio  
**Status:** Phase 2 integrated into HomePage (Watch page), ready for testing  
**Last Updated:** 2026-07-30

---

## 🎯 Quick Overview: What Was Built

We built a **data tracking system** that captures user behavior when they watch POV streams. Think of it like a security camera that records what users do, but for the app.

### Files Created (6 core files)

| File | Purpose | Size |
|------|---------|------|
| `src/services/analytics/analyticsSession.ts` | Manages who the user is (sessionId, anonymousId, userId) | ~200 lines |
| `src/services/analytics/analyticsQueue.ts` | Stores events locally before sending to server | ~300 lines |
| `src/services/analytics/analyticsClient.ts` | Sends events to the server with retry logic | ~150 lines |
| `src/services/analytics/analyticsService.ts` | Public API - call this from components to track events | ~300 lines |
| `src/services/analytics/streamViewTracker.ts` | Manages one video watch session (tracks time, actions) | ~350 lines |
| `src/hooks/useStreamView.ts` | React hook - connects React components to tracking | ~130 lines |

**Plus:** Type definitions, configuration, unit tests, integration into HomePage.jsx

---

## 📊 The Big Picture: How It Works

### 1. **What Gets Tracked**

When a user watches a video on the Watch page:

```
User opens video
  ↓
Impression recorded (card was 50% visible for 500ms)
  ↓
User clicks play
  ↓
Video starts → event sent ("view_started")
  ↓
After 3 seconds → milestone event sent ("view_3_seconds")
  ↓
After 10 seconds → milestone event sent ("view_10_seconds")
  ↓
After 30 seconds → milestone event sent ("view_30_seconds")
  ↓
User does something (follow, share, click gear)
  ↓
Action event sent ("creator_followed", "stream_shared", "gear_opened")
  ↓
User swipes to next video
  ↓
Video session ends → event sent with total watch time
  ↓
Events queue locally → sent to server every 30 seconds
```

### 2. **Why This Design**

**Local Queueing:** Events are stored locally first (in browser storage) before sending. This:
- Works offline (events don't disappear if internet drops)
- Batches events (send 50 at once = less network traffic)
- Retries on failure (if server is down, it tries again)

**Active Watch Time:** We only count time when:
- ✅ Video is playing (not paused)
- ✅ Video element is visible on screen (not scrolled off)
- ✅ Browser tab is active (not hidden/backgrounded)

Example: 30 second watch session
```
0:00-0:05   Playing + Visible + Tab Active  → +5s active
0:05-0:10   Paused (not playing)             → +0s
0:10-0:15   Playing + Visible + Tab Active  → +5s active
0:15-0:20   Scrolled off screen              → +0s
0:20-0:25   Tab hidden (switched tabs)       → +0s
0:25-0:30   Playing + Visible + Tab Active  → +5s active
            ────────────────────────────────
            Total: 15s active out of 30s calendar
```

---

## 🔧 Understanding the Code Structure

### Layer 1: Session (analyticsSession.ts)

**What it does:** Manages three IDs that identify the user

```typescript
sessionId     // Changes every page reload (for this session)
anonymousId   // Stays same forever (persistent across sessions)
userId        // Only set when user logs in with Firebase Auth
```

**Example flow:**
```
User opens app for first time
  → Create random anonymousId (UUID) - saved to localStorage
  → Create sessionId - saved to sessionStorage
  → Events tagged with both IDs

User logs in
  → Set userId from Firebase Auth
  → Events tagged with userId + anonymousId

User closes browser, reopens app tomorrow
  → anonymousId is still there (localStorage)
  → sessionId is new (sessionStorage cleared)
  → We know it's the same person by anonymousId
```

### Layer 2: Queue (analyticsQueue.ts)

**What it does:** Stores events locally before sending

**Example:** User watches video for 10 seconds
```
Event 1: view_started        → Added to queue
Event 2: view_3_seconds      → Added to queue
Event 3: view_10_seconds     → Added to queue
Event 4: stream_shared       → Added to queue (user clicked share)
Event 5: view_ended          → Added to queue

Queue now has 5 events in memory (+ backup in localStorage)

Every 30 seconds:
  → Pick 5 events from queue
  → Send as batch to server
  → If server responds OK → remove from queue
  → If server fails → keep in queue, retry later
```

**Deduplication:** Events use a deterministic ID so if they're sent twice by accident, the server won't count them twice.

### Layer 3: Client (analyticsClient.ts)

**What it does:** Actually sends events to the server via HTTP

```typescript
// Simplified example
POST /api/analytics/events
{
  events: [
    { eventId: "...", eventName: "stream_view_started", timestamp: 1722345600 },
    { eventId: "...", eventName: "stream_view_3_seconds", timestamp: 1722345603 },
    { eventId: "...", eventName: "stream_shared", timestamp: 1722345605 },
  ]
}
```

**Retry Logic:** If server doesn't respond
```
Attempt 1: Wait 1 second, try again
Attempt 2: Wait 2 seconds, try again
Attempt 3: Wait 4 seconds, try again
Attempt 4: Give up (will retry next batch)
```

### Layer 4: Service (analyticsService.ts)

**What it does:** Public API for components to use

```typescript
// Components call this
analyticsService.trackStreamImpression(streamId, creatorId, source, position)
analyticsService.trackStreamViewStarted(streamId, creatorId)
analyticsService.trackCreatorFollowed(streamId, creatorId)
analyticsService.trackStreamShared(streamId, creatorId)

// All methods:
// 1. Automatically add sessionId, anonymousId, userId
// 2. Create event object
// 3. Add to queue
// 4. Return eventId (for correlation)
```

### Layer 5: StreamViewTracker (streamViewTracker.ts)

**What it does:** Manages one video watch session from start to finish

```typescript
// Create tracker for one video
const tracker = new StreamViewTracker({
  streamId: "video-123",
  creatorId: "creator-456",
  source: "watch",
  sourcePosition: 0,
})

// Record impression when card becomes visible
tracker.recordImpression()

// Start session when user clicks play
tracker.startViewSession()

// Update playback state (video playing/paused)
tracker.setPlaybackState(true)  // video playing
tracker.setPlaybackState(false) // video paused

// Update visibility (element on screen/off screen)
tracker.setVisibility(true)  // element visible
tracker.setVisibility(false) // element scrolled off

// Update tab visibility (tab active/hidden)
tracker.setPageVisibility(true)  // tab active
tracker.setPageVisibility(false) // tab hidden

// Record actions
tracker.recordCreatorFollowed()
tracker.recordShared()

// End session when user leaves video
const metrics = tracker.endViewSession('swipe')
// Returns: {
//   activeWatchDurationSeconds: 15,
//   watchDurationSeconds: 30,
//   reached3Seconds: true,
//   reached10Seconds: true,
//   reached30Seconds: false,
//   creatorFollowed: true,
//   shared: true,
//   exitReason: 'swipe',
// }
```

### Layer 6: React Hook (useStreamView.ts)

**What it does:** Integrates StreamViewTracker with React components

```typescript
const {
  videoRefCallback,          // Attach to <video> element
  recordGearOpened,          // Call when gear button clicked
  recordCreatorFollowed,     // Call when follow button clicked
  recordShared,              // Call when share button clicked
  endSession,                // Call when navigating away
} = useStreamView(config, options)

// Use in JSX:
<video ref={videoRefCallback} />
<button onClick={recordCreatorFollowed}>Follow</button>
<button onClick={recordShared}>Share</button>

// When user swipes to next video:
onClick={() => {
  endSession('swipe')
  navigateToNextVideo()
}}
```

---

## 📱 How It's Integrated into HomePage.jsx

### What Changed in HomePage.jsx

**1. Added imports** (top of file)
```javascript
import { useStreamView } from '../hooks/useStreamView';
import { analyticsService } from '../services/analytics';
```

**2. Initialize hook** (inside LiveViewer component)
```javascript
const {
  videoRefCallback,
  recordGearOpened,
  recordCreatorFollowed,
  recordShared,
  endSession,
} = useStreamView(
  live.id ? {
    streamId: live.id,
    creatorId: live.creatorId || live.name || 'unknown',
    source: 'watch',
    sourcePosition: index,
    category: live.category,
    environment: live.environment,
  } : null,
  {
    enabled: !!live.id && !creatorMode,
    onSessionEnd: (metrics) => {
      console.log('[Analytics] View session ended:', metrics);
    },
  }
);
```

**3. Connect video element**
```javascript
// OLD: ref={isActive ? videoPlaybackRef : null}
// NEW:
ref={isActive ? (el) => {
  videoPlaybackRef.current = el;
  videoRefCallback(el);  // ← Analytics tracking
} : null}
```

**4. Track actions**
```javascript
// Follow button
onClick={() => {
  const wasFollowing = isFollowing;
  setFollowing(...);
  if (!wasFollowing) {
    recordCreatorFollowed();  // ← Track follow
  }
}}

// Share button
onClick={recordShared}  // ← Track share

// Gear button
onClick={() => {
  recordGearOpened();  // ← Track gear open
  setEquipmentSheetOpen(true);
}}
```

**5. Track navigation**
```javascript
const goTo = (direction) => {
  endSession('swipe');  // ← End session when swiping
  setIndex((current) => {
    const next = current + direction;
    if (next < 0) return liveFeed.length - 1;
    if (next >= liveFeed.length) return 0;
    return next;
  });
};
```

---

## 🧪 How to Test Analytics

### Test 1: Check Events Are Queuing

1. Open browser DevTools (F12)
2. Go to **Application** → **Local Storage** → find `vuvio:analytics-queue`
3. Open app, watch a video for 10+ seconds
4. Check localStorage - should see events queue growing

### Test 2: Check Network Calls

1. Open DevTools (F12) → **Network** tab
2. Filter by XHR/Fetch
3. Watch a video
4. After 30 seconds (or when important event fires)
5. Look for POST request to `/api/analytics/events`
6. Check request body - should contain batched events

### Test 3: Check Console

1. Open DevTools (F12) → **Console**
2. Watch a video for 10+ seconds
3. Swipe to next video
4. Look for `[Analytics]` logs with metrics

### Test 4: Manual Event Generation

In browser console:
```javascript
import { analyticsService } from '@/services/analytics'

// Manually trigger an event
analyticsService.trackStreamShared('stream-123', 'creator-456', 'watch', 0)

// Check queue
import { analyticsQueue } from '@/services/analytics'
console.log(analyticsQueue.getQueue())  // See all queued events
```

---

## 🔍 Understanding Configuration

**File:** `src/services/analytics/analyticsConfig.ts`

```typescript
export const ANALYTICS_CONFIG = {
  // How many events to batch per request
  BATCH_SIZE: 50,
  
  // How often to flush queue (milliseconds)
  FLUSH_INTERVAL_MS: 30000,  // 30 seconds
  
  // How many times to retry on network failure
  MAX_RETRIES: 3,
  
  // How long to wait before detecting impression (milliseconds)
  IMPRESSION_DEBOUNCE_MS: 500,
  
  // Retention thresholds (milliseconds)
  RETENTION_THRESHOLDS: {
    SKIP: 3000,           // Less than 3 seconds = skip
    SHORT: 10000,         // 10 seconds milestone
    MEDIUM: 30000,        // 30 seconds milestone
  },
};
```

### How to Change Configuration

Example: Send events every 15 seconds instead of 30
```javascript
// In analyticsConfig.ts
FLUSH_INTERVAL_MS: 15000,  // Changed from 30000

// Rebuild
npm run build

// Deploy
```

---

## 📝 Event Types (What Gets Sent)

All events automatically include:
- `eventId` - Unique identifier (for deduplication)
- `sessionId` - Current session identifier
- `anonymousId` - Persistent user identifier
- `userId` - Firebase Auth UID (if logged in)
- `timestamp` - When event occurred
- `streamId` - Which stream
- `creatorId` - Which creator
- `source` - Where user came from ('watch', 'explore', 'globe', 'profile')

### Event Types

**View Events:**
- `stream_view_impression` - Card became visible
- `stream_view_started` - User clicked play
- `stream_view_3_seconds` - Watched 3 seconds actively
- `stream_view_10_seconds` - Watched 10 seconds actively
- `stream_view_30_seconds` - Watched 30 seconds actively
- `stream_view_ended` - Session complete (includes total watch time)
- `stream_view_skipped` - Left before 3 seconds

**Action Events:**
- `creator_followed` - User followed creator
- `stream_shared` - User clicked share
- `gear_opened` - User opened equipment panel
- `comment_sent` - User sent comment
- `stream_rated` - User rated stream
- `stream_reported` - User reported stream

---

## 🚀 Next Steps (What's Missing)

### Phase 1.5: Backend Endpoint (REQUIRED)

Currently events queue locally but nowhere to send them. Need to:

1. **Create endpoint** `POST /api/analytics/events`
2. **Validate events** - make sure data is valid
3. **Save to Firestore** - store `analyticsEvents/{eventId}`
4. **Update stats** - increment `streamStats/{streamId}`

### Phase 2.5: Instrument Other Pages

Add tracking to:
- Explore page (Discover) - card impressions
- Globe page - pin clicks
- Profile page - profile opens, equipment clicks

### Phase 3: Statistics Aggregation

Calculate:
- `streamStats` - views, unique viewers, retention
- `creatorStats` - total views, follower conversions
- `categoryStats` - category popularity
- `userAnalytics` - user affinity/interests

### Phase 4: Admin Dashboard

Create `/admin/analytics` route showing:
- Top streams by views
- Creator leaderboard
- Category breakdown
- Retention metrics

---

## 🆘 Troubleshooting

### Events Not Queuing?

**Check:**
1. Is localStorage enabled in browser? (DevTools → Application → Storage)
2. Is hook enabled? Check `enabled: !!live.id && !creatorMode` in HomePage.jsx
3. Is video playing? Events only queue when video plays + element visible

**Debug:**
```javascript
// In console:
localStorage.getItem('vuvio:analytics-queue')  // Should show events
console.log(sessionStorage.getItem('vuvio:session'))  // Should show sessionId
```

### Events Not Sending?

**Check:**
1. Is backend endpoint implemented? (POST /api/analytics/events)
2. Is network working? (DevTools → Network tab)
3. Are there browser console errors? (DevTools → Console)

**Debug:**
```javascript
// In console:
import { analyticsQueue } from '@/services/analytics'
analyticsQueue.flush()  // Force send immediately
```

### Wrong Active Watch Time?

**Check:**
1. Is video playing? (check playback state)
2. Is element visible on screen? (IntersectionObserver working)
3. Is tab active? (document.visibilityState === 'visible')

Only counts when ALL THREE are true.

### Duplicate Events?

This is handled automatically via `eventId` deduplication. If same event sent twice:
- Queue detects duplicate `eventId` and won't send same event twice
- Server also deduplicates by `eventId`

---

## 📚 File Tree

```
src/
├── services/analytics/
│   ├── analyticsTypes.ts              ← Type definitions
│   ├── analyticsConfig.ts             ← Configuration
│   ├── analyticsSession.ts            ← Session management
│   ├── analyticsQueue.ts              ← Event queue
│   ├── analyticsClient.ts             ← HTTP client
│   ├── analyticsService.ts            ← Public API
│   ├── streamViewTracker.ts           ← Watch session tracking
│   ├── index.ts                       ← Exports
│   └── __tests__/
│       ├── analyticsQueue.test.ts
│       ├── analyticsSession.test.ts
│       └── streamViewTracker.test.ts
├── hooks/
│   ├── useStreamView.ts               ← React integration
│   └── useImpressionTracker.ts        ← Impression detection
└── routes/
    └── HomePage.jsx                   ← Watch page (integrated)

docs/
├── README-ANALYTICS.md                ← Quick index
├── ANALYTICS-GUIDE-SIMPLE.md          ← Simple explanations
├── ANALYTICS-INTEGRATION-MANAGEMENT.md ← THIS FILE
├── PHASE-2-COMPLETE.md                ← What was built
├── PHASE-2-INTEGRATION.md             ← Integration examples
├── analytics-architecture.md          ← Deep dive
└── ...
```

---

## ⚡ Quick Reference

### Import & Use

```javascript
// In a component
import { useStreamView } from '@/hooks/useStreamView'
import { analyticsService } from '@/services/analytics'

// Track a watch session
const { videoRefCallback, recordShared, endSession } = useStreamView(config)

// Manual tracking (without hook)
analyticsService.trackStreamShared(streamId, creatorId, 'watch', 0)
```

### API Methods

```typescript
// Session
analyticsService.getSession()           // Get {sessionId, anonymousId, userId}
analyticsService.setUserId(userId)      // Set user ID on login

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

### Queue Management

```typescript
// Manually flush queue to server
import { analyticsQueue } from '@/services/analytics'
analyticsQueue.flush()

// Get current queue size
analyticsQueue.getQueueSize()

// Clear queue (emergency only)
analyticsQueue.clear()
```

---

## 📞 Questions?

- **How does active time work?** → See "Why This Design" section
- **Why events are local first?** → See "How It Works" section
- **How to add new events?** → Add method to analyticsService.ts, call from component
- **How to change refresh rate?** → Edit FLUSH_INTERVAL_MS in analyticsConfig.ts
- **How to test offline?** → Turn off network in DevTools, watch video, events stay in queue

---

## ✅ Implementation Checklist

- [x] Phase 1: Event queue foundation
- [x] Phase 2: View session tracking
- [x] Phase 2: Integration into HomePage
- [x] Build passes (2429 modules)
- [ ] Phase 1.5: Backend endpoint
- [ ] Phase 2.5: Other page tracking
- [ ] Phase 3: Stats aggregation
- [ ] Phase 4: Admin dashboard

---

**Status:** Ready for Phase 1.5 backend implementation  
**Build:** ✓ Passing  
**Tests:** 60+ passing  
**Bundle Impact:** +5-8 KB gzipped (negligible)

For more details, see:
- [PHASE-2-INTEGRATION.md](./PHASE-2-INTEGRATION.md) - Code examples
- [analytics-architecture.md](./analytics-architecture.md) - Deep technical dive
- [README-ANALYTICS.md](./README-ANALYTICS.md) - Master index
