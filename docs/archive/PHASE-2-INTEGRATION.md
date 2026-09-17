# Phase 2: Core Tracking — Integration Guide

**Status:** Ready for Watch page integration  
**Build:** Compiling...  
**Components Built:**
- StreamViewTracker (session lifecycle)
- useStreamView hook (React integration)
- useImpressionTracker hook (IntersectionObserver)

---

## How It Works

### StreamViewTracker

Manages a single view session from impression to completion.

```typescript
const tracker = new StreamViewTracker({
  streamId: 'stream-1',
  creatorId: 'creator-1',
  source: 'watch',
  sourcePosition: 0,
  category: 'Mountain Bike',
  environment: 'land',
});

tracker.recordImpression();        // Card visible 50%+ for 500ms
tracker.startViewSession();         // User starts playback
tracker.setPlaybackState(true);     // Video is playing
tracker.setVisibility(true);        // Element is visible on screen
tracker.setPageVisibility(true);    // Browser tab is active

vi.advanceTimersByTime(10100);      // 10+ seconds of active watch

const metrics = tracker.endViewSession('swipe');  // User swiped away
console.log(metrics);
// {
//   watchDurationSeconds: 10,
//   activeWatchDurationSeconds: 10,
//   reached3Seconds: true,
//   reached10Seconds: true,
//   reached30Seconds: false,
//   skippedUnder3Seconds: false,
//   ...
// }
```

### useStreamView Hook

React wrapper for StreamViewTracker. Automatically:
- Attaches video event listeners (play, pause, ended, error)
- Manages lifecycle (start on mount, end on unmount or explicitly)
- Tracks user actions (gear opens, follows, shares, etc.)
- Calls callback with metrics when session ends

```typescript
const {
  videoRefCallback,
  recordGearOpened,
  recordGearItemClicked,
  recordGearExternalClicked,
  recordProfileOpened,
  recordCreatorFollowed,
  recordShared,
  recordCommented,
  recordRated,
  recordReported,
  endSession,
} = useStreamView(
  {
    streamId: 'stream-1',
    creatorId: 'creator-1',
    source: 'watch',
    sourcePosition: 0,
  },
  {
    enabled: true,
    onSessionEnd: (metrics) => {
      console.log('Session ended:', metrics);
    },
  }
);

// In JSX:
<video ref={videoRefCallback} src={videoSrc} controls />

// Track actions:
<button onClick={recordGearOpened}>Open Gear</button>
<button onClick={recordCreatorFollowed}>Follow</button>
<button onClick={() => endSession('navigation')}>Exit</button>
```

### useImpressionTracker Hook

Detects when a stream card becomes visible and fires an impression event.

```typescript
const containerRef = useRef<HTMLDivElement>(null);

useImpressionTracker(containerRef, {
  enabled: true,
  threshold: 0.5,           // 50% visible
  debounceMs: 500,          // Wait 500ms before firing
  onImpression: () => {
    analyticsService.trackStreamImpression(
      streamId,
      creatorId,
      'watch',
      0
    );
  },
});

// In JSX:
<div ref={containerRef} className="stream-card">
  {/* Card content */}
</div>
```

---

## Integration Steps

### Step 1: Wrap HomePage Component

In `src/routes/HomePage.jsx`, wrap the page with session tracking:

```typescript
import { useStreamView, useImpressionTracker } from '@/hooks';
import { analyticsService } from '@/services/analytics';

export default function HomePage() {
  const [currentLiveId, setCurrentLiveId] = useState(0);
  const currentLive = liveFeed[currentLiveId];

  const {
    videoRefCallback,
    recordGearOpened,
    recordCreatorFollowed,
    recordShared,
    recordCommented,
    recordReported,
    endSession,
  } = useStreamView(
    currentLive ? {
      streamId: currentLive.id,
      creatorId: currentLive.creatorId || currentLive.name,
      source: 'watch',
      sourcePosition: currentLiveId,
      category: currentLive.category,
      environment: currentLive.environment,
    } : null,
    {
      enabled: true,
      onSessionEnd: (metrics) => {
        console.log('[Analytics] View session ended:', metrics);
      },
    }
  );

  // Handle swipe to next video
  const handleNext = () => {
    endSession('swipe');
    setCurrentLiveId((i) => (i + 1) % liveFeed.length);
  };

  const handlePrev = () => {
    endSession('swipe');
    setCurrentLiveId((i) => (i - 1 + liveFeed.length) % liveFeed.length);
  };

  return (
    <div>
      {/* Existing video player code */}
      <video
        ref={videoRefCallback}
        src={currentLive?.mediaUrl}
        controls
      />

      {/* Gear button */}
      <button onClick={recordGearOpened}>
        Gear
      </button>

      {/* Follow button */}
      <button onClick={recordCreatorFollowed}>
        Follow
      </button>

      {/* Share button */}
      <button onClick={recordShared}>
        Share
      </button>

      {/* Navigation */}
      <button onClick={handleNext}>Next</button>
      <button onClick={handlePrev}>Prev</button>
    </div>
  );
}
```

### Step 2: Track Impressions in Feed

For the initial feed load or Explore page, use `useImpressionTracker`:

```typescript
export function LiveCard({ live, index }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useImpressionTracker(containerRef, {
    onImpression: () => {
      analyticsService.trackStreamImpression(
        live.id,
        live.creatorId || live.name,
        'explore',  // or 'globe', 'profile'
        index
      );
    },
  });

  return (
    <div ref={containerRef} className="live-card">
      <img src={live.thumbnailUrl} alt={live.title} />
      <h3>{live.title}</h3>
    </div>
  );
}
```

### Step 3: Track Social Actions

Hook into existing follow/share handlers:

```typescript
const handleFollow = () => {
  followService.setFollowingCreator(creatorId, true);
  analyticsService.trackCreatorFollowed(creatorId, streamId, 'watch');
};

const handleShare = () => {
  navigator.share?.({
    title: stream.title,
    text: stream.description,
  });
  analyticsService.trackStreamShared(streamId, creatorId);
};

const handleComment = () => {
  messagingService.sendMessage(conversationId, text);
  analyticsService.trackCommentSent(streamId, creatorId);
};
```

---

## Data Flow

### Watch Page Session

```
User arrives at /watch
  ↓
LiveCard visible 50%+ for 500ms
  → fireImpression() → trackStreamImpression()
  ↓
User clicks/taps video
  → startViewSession()
  → startVideoPlayback()
  → setPlaybackState(true)
  ↓
Elapsed: 3 seconds
  → checkMilestones() → trackStreamViewThreshold(3)
  → reached3Seconds = true
  ↓
Elapsed: 10 seconds
  → checkMilestones() → trackStreamViewThreshold(10)
  → reached10Seconds = true
  ↓
User swipes to next video
  → endSession('swipe')
  → trackStreamViewEnded()
  ↓
Event queue flushes every 30s or immediately
  → POST /api/analytics/events
  → Backend: validate, enrich, deduplicate, save
```

### Gear Interaction

```
User clicks Gear button
  → recordGearOpened()
  → trackGearPanelOpened()
  ↓
User clicks specific equipment
  → recordGearItemClicked()
  → trackGearItemOpened()
  ↓
User clicks "Shop" link
  → recordGearExternalClicked()
  → trackGearExternalLinkClicked()
  ↓
All tracked within the active view session
```

### Social Action

```
User clicks Follow button
  → followService.setFollowingCreator(creatorId, true)
  → analyticsService.trackCreatorFollowed(creatorId, streamId, 'watch')
  ↓
Events queue both follow action AND view session context
```

---

## Active Watch Time Calculation

The hook tracks **active watch time** — time when:
- ✅ Video is playing
- ✅ Stream card is visible on screen
- ✅ Browser tab is active (document.visibilityState === 'visible')

Time **excluded**:
- ❌ While paused
- ❌ While card is scrolled off-screen
- ❌ While browser tab is backgrounded
- ❌ While app is backgrounded (for mobile PWA)

### Example

```
Timeline:
0:00 — Start video
0:00 — setPlaybackState(true)
0:00 → 0:05 — Playing, visible, active → 5s active time
0:05 — User pauses video
0:05 → 0:10 — Paused, visible, active → 0s active time (paused)
0:10 — User resumes
0:10 → 0:15 — Playing, visible, active → 5s active time
0:15 — Tab backgrounded
0:15 → 0:20 — Playing, visible, inactive → 0s active time (tab hidden)
0:20 — Tab foregrounded
0:20 → 0:30 — Playing, visible, active → 10s active time
0:30 — Card scrolled off-screen
0:30 → 0:35 — Playing, invisible, active → 0s active time (invisible)
0:35 — End session

Total active watch time: 5 + 5 + 10 = 20 seconds
Total calendar time: 35 seconds
```

---

## Milestone Events

Automatically fired once per session:

| Event | Condition | Analytics Event |
|---|---|---|
| 3 seconds | activeWatchSeconds ≥ 3000 | `stream_view_3_seconds` |
| 10 seconds | activeWatchSeconds ≥ 10000 | `stream_view_10_seconds` |
| 30 seconds | activeWatchSeconds ≥ 30000 | `stream_view_30_seconds` |

Each fires **exactly once** per session. If user pauses, milestones don't fire until resumed.

---

## Exit Reasons

When ending a session, specify the exit reason:

```typescript
tracker.endViewSession('swipe');           // Swiped to next
tracker.endViewSession('back');            // Clicked back button
tracker.endViewSession('app_background');  // App backgrounded
tracker.endViewSession('stream_ended');    // Live stream ended
tracker.endViewSession('network_error');   // Connection lost
tracker.endViewSession('navigation');      // Navigated away
tracker.endViewSession('unknown');         // Default
tracker.endViewSession('pagehide');        // Page unload
```

Used for understanding user behavior and diagnosing issues.

---

## Testing Hooks

### Test useStreamView

```typescript
import { renderHook, act } from '@testing-library/react';
import { useStreamView } from '@/hooks/useStreamView';

test('tracks stream view session', () => {
  const onSessionEnd = vi.fn();

  const { result } = renderHook(() =>
    useStreamView(
      {
        streamId: 'stream-1',
        creatorId: 'creator-1',
        source: 'watch',
      },
      { onSessionEnd }
    )
  );

  act(() => {
    vi.advanceTimersByTime(3100);
  });

  const { recordGearOpened } = result.current;
  act(() => {
    recordGearOpened();
  });

  act(() => {
    result.current.endSession('swipe');
  });

  expect(onSessionEnd).toHaveBeenCalled();
  const metrics = onSessionEnd.mock.calls[0][0];
  expect(metrics.gearOpened).toBe(true);
});
```

### Test useImpressionTracker

```typescript
import { renderHook } from '@testing-library/react';
import { useImpressionTracker } from '@/hooks/useImpressionTracker';

test('fires impression when element visible', () => {
  const onImpression = vi.fn();
  const ref = { current: document.createElement('div') };

  renderHook(() =>
    useImpressionTracker(ref, { onImpression })
  );

  act(() => {
    vi.advanceTimersByTime(600);
  });

  expect(onImpression).toHaveBeenCalled();
});
```

---

## Configuration

All thresholds in `analyticsConfig.ts`:

```typescript
IMPRESSION_VISIBILITY_THRESHOLD: 0.5      // 50% visible
IMPRESSION_DEBOUNCE_MS: 500               // 500ms minimum

RETENTION_THRESHOLDS: {
  SKIP: 3000,       // 3 seconds
  SHORT: 10000,     // 10 seconds
  MEDIUM: 30000,    // 30 seconds
}

FLUSH_INTERVAL_MS: 30000                  // Batch every 30s
```

Tweak without changing hook logic.

---

## Common Issues & Troubleshooting

### Issue: Impressions firing multiple times

**Cause:** Re-rendering component with same ref.

**Fix:** Use stable key on stream card; memoize ref.

```typescript
<div key={live.id} ref={containerRef}>
  {/* Content */}
</div>
```

### Issue: Active watch time incorrect

**Cause:** Not setting visibility/playback state.

**Fix:** Ensure `setVisibility()` and `setPlaybackState()` called on events.

```typescript
video.addEventListener('play', () => tracker.setPlaybackState(true));
video.addEventListener('pause', () => tracker.setPlaybackState(false));
```

### Issue: Events not submitting

**Cause:** Network error, queue full, or endpoint unreachable.

**Fix:** Check Network tab in DevTools; verify `/api/analytics/events` exists.

```typescript
analyticsService.getQueueSize()  // Should decrease after flush
```

### Issue: Hook memory leak

**Cause:** Not cleaning up listeners.

**Fix:** Hooks auto-cleanup on unmount. Don't manually call `destroy()` unless needed.

---

## Next Steps

After integrating with HomePage:

1. **Verify event flow**
   - Open DevTools Network tab
   - Watch video for 10+ seconds
   - Check `/api/analytics/events` POST requests

2. **Test with backend** (Phase 1.5)
   - Deploy `/api/analytics/events` endpoint
   - Verify events saved to Firestore
   - Check deduplication works

3. **Instrument other pages** (Phase 2.5)
   - Explore page impressions
   - Globe pin clicks
   - Profile views

4. **Aggregation** (Phase 3)
   - Calculate streamStats
   - Build creatorStats
   - Display real metrics in LiveRecapPage

---

**Status:** Ready for HomePage integration  
**Estimated Time:** 1-2 days  
**Next Phase:** Phase 1.5 (Backend endpoint validation)
