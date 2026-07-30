# Phase 2.5: Discovery & Navigation Tracking — Implementation Guide

**Status:** 🔜 Ready to Implement  
**Scope:** Add impression & click tracking to Explore, Globe, and Profile pages  
**Effort:** 2-3 days  
**Impact:** Track how users discover streams, not just how they watch

---

## 🎯 Overview

### What's Missing

**Phase 2 (Done):** Watch page - tracks when users watch videos
- ✅ Impressions on Watch page
- ✅ View starts, milestones, time watched
- ✅ Actions (follow, share, gear)

**Phase 2.5 (To Do):** Discovery pages - track how users discover
- ❌ Impressions on Explore cards
- ❌ Pin clicks on Globe
- ❌ Profile opens from cards
- ❌ Equipment browsing

### Why It Matters

To answer:
- "Which streams get most discovery impressions?"
- "Do users click on pins in Globe or swipe them?"
- "Which categories drive most discovery?"
- "What's the conversion from impression → watch?"

---

## 📍 Implementation Plan

### 1. Explore Page (DiscoverFeedPage)

**Goal:** Track card impressions in the Discover feed

**How:**
```typescript
// Pseudo-code
const streamCards = streams.map((stream) => (
  <div ref={useImpressionTracker({
    onImpression: () => {
      analyticsService.trackStreamImpression(
        stream.id,
        stream.creatorId,
        'explore',  // source
        index       // position
      );
    }
  })}>
    <StreamCard stream={stream} />
  </div>
));
```

**Changes:**
- Import `useImpressionTracker` from `@/hooks`
- Wrap each card with ref callback
- Call `analyticsService.trackStreamImpression()` on impression
- Use card index as `sourcePosition`

**File to modify:** `src/routes/DiscoverFeedPage.jsx`

**Expected events:**
```json
{
  "eventName": "stream_impression",
  "source": "explore",
  "sourcePosition": 0,
  "streamId": "...",
  "creatorId": "..."
}
```

---

### 2. Globe Page (GlobeCesiumPage or CurrentGlobePage)

**Goal:** Track pin clicks and interactions

**How:**
```typescript
// Track pin click
onClick={() => {
  analyticsService.trackGlobePinClicked(
    stream.id,
    stream.creatorId,
    coordinates  // optional
  );
  navigateToWatch(stream.id);
}}
```

**Changes:**
- Add `recordGlobePinClicked` to analyticsService
- Call on pin click
- Also track pin hover (optional)

**File to modify:** `src/routes/CurrentGlobePage.jsx` or `src/components/CurrentGlobe.jsx`

**Expected events:**
```json
{
  "eventName": "globe_pin_clicked",
  "source": "globe",
  "streamId": "...",
  "creatorId": "...",
  "metadata": {
    "latitude": 52.5,
    "longitude": 13.4
  }
}
```

---

### 3. Profile Page (ProfilePage)

**Goal:** Track profile opens and equipment browsing

**How:**

**Option A: From card click**
```typescript
onClick={() => {
  analyticsService.trackCreatorProfileOpened(
    stream.id,
    stream.creatorId,
    'watch'  // source: where user came from
  );
  navigate(`/profile/${stream.creatorId}`);
}}
```

**Option B: Equipment click on profile**
```typescript
// On profile page
onClick={() => {
  analyticsService.trackGearItemOpened(
    stream.id,
    stream.creatorId
  );
}}
```

**Changes:**
- Add `recordCreatorProfileOpened` to analyticsService
- Add `recordGearItemOpened` to analyticsService
- Call on profile link / gear item click

**File to modify:** `src/routes/ProfilePage.jsx`

**Expected events:**
```json
{
  "eventName": "creator_profile_opened",
  "source": "watch",  // where they came from
  "streamId": "...",
  "creatorId": "..."
}
```

---

## 🔧 Code Changes Needed

### Step 1: Add Missing Events to analyticsService

**File:** `src/services/analytics/analyticsService.ts`

Add methods:
```typescript
trackStreamImpression(
  streamId: string,
  creatorId: string,
  source: AnalyticsSource,
  sourcePosition?: number
): string

trackGlobePinClicked(
  streamId: string,
  creatorId: string,
  coordinates?: { latitude: number; longitude: number }
): string

trackCreatorProfileOpened(
  streamId: string,
  creatorId: string,
  source: AnalyticsSource
): string

trackGearItemOpened(
  streamId: string,
  creatorId: string,
  gearId?: string
): string
```

### Step 2: Update Event Types

**File:** `src/services/analytics/analyticsTypes.ts`

Ensure these events are defined:
```typescript
export type AnalyticsEventName =
  | ...existing...
  | 'globe_pin_clicked'        // ← ADD
  | 'creator_profile_opened'   // ← ADD
  // others already exist
```

### Step 3: Instrument Pages

#### DiscoverFeedPage.jsx

```typescript
import { useImpressionTracker } from '@/hooks/useImpressionTracker'
import { analyticsService } from '@/services/analytics'

// In render loop:
{streams.map((stream, index) => (
  <div
    key={stream.id}
    ref={(el) => {
      useImpressionTracker(el, {
        onImpression: () => {
          analyticsService.trackStreamImpression(
            stream.id,
            stream.creatorId,
            'explore',
            index
          );
        }
      });
    }}
  >
    <StreamCard stream={stream} />
  </div>
))}
```

#### CurrentGlobePage.jsx or CurrentGlobe.jsx

```typescript
// On pin click:
const handlePinClick = (stream, coordinates) => {
  analyticsService.trackGlobePinClicked(
    stream.id,
    stream.creatorId,
    coordinates
  );
  navigate(`/watch?live=${stream.id}`);
};
```

#### ProfilePage.jsx

```typescript
// On profile open from card:
const handleProfileClick = () => {
  analyticsService.trackCreatorProfileOpened(
    currentStreamId,
    creatorId,
    'profile'  // came from viewing profile
  );
  navigate(`/profile/${creatorId}`);
};

// On equipment click on profile:
const handleGearClick = (gearItem) => {
  analyticsService.trackGearItemOpened(
    currentStreamId,
    creatorId,
    gearItem.id
  );
};
```

---

## 📊 Analytics Questions Answered

**Once Phase 2.5 is complete, you can answer:**

1. **Discovery Metrics:**
   - How many impressions per stream?
   - Impression → Watch conversion rate?
   - Top 10 most discovered streams?

2. **Source Breakdown:**
   - % of watch starts from Explore
   - % of watch starts from Globe
   - % of watch starts from Profile

3. **Navigation Patterns:**
   - Do users click on pins or swipe?
   - Profile open → Watch start conversion?
   - Equipment view → Follow conversion?

4. **Creator Discovery:**
   - Most discovered creators
   - Geographic hot spots (Globe data)
   - Equipment interest (by gear)

---

## 🧪 Testing Phase 2.5

### Manual Testing

1. **Explore Page:**
   - Open Explore page
   - Scroll down (card enters viewport)
   - DevTools → Network → Check for `stream_impression` event

2. **Globe Page:**
   - Open Globe
   - Click on a pin
   - DevTools → Network → Check for `globe_pin_clicked` event

3. **Profile Page:**
   - Click on creator link → Profile opens
   - Check for `creator_profile_opened` event
   - Click on equipment → Check for `gear_item_opened` event

### Automated Testing

Add to `src/services/analytics/__tests__/`

```typescript
describe('Discovery Tracking', () => {
  it('tracks stream impressions', () => {
    // Test useImpressionTracker
  });

  it('tracks globe pin clicks', () => {
    // Test globe tracking
  });

  it('tracks profile opens', () => {
    // Test profile tracking
  });
});
```

---

## 🔄 Event Flow: Explore Example

```
User opens Explore page
  ↓
Cards appear on screen
  ↓ (card enters viewport)
User scrolls down, card becomes 50%+ visible
  ↓
IntersectionObserver fires (debounced 500ms)
  ↓
useImpressionTracker callback → onImpression()
  ↓
analyticsService.trackStreamImpression(streamId, creatorId, 'explore', 0)
  ↓
Creates event: {
  eventName: 'stream_impression',
  streamId: 'stream-123',
  creatorId: 'creator-456',
  source: 'explore',
  sourcePosition: 0,
  timestamp: ...,
  ...
}
  ↓
analyticsQueue stores event
  ↓ (after 30s or batch full)
analyticsClient.submitEvents()
  ↓
POST /api/analytics/events
  ↓
Backend validates, deduplicates, saves
  ↓
Database updated: analyticsEvents + streamStats
```

---

## 📈 Expected Data

**After Phase 2.5, Firestore will contain:**

```
/analyticsEvents
  ├── stream-123_explore_impression_0
  ├── stream-123_globe_pin_click
  ├── stream-123_profile_open
  └── ...

/streams/{streamId}/stats/current
  ├── impressions: 50
  ├── viewStarts: 15        (from impressions)
  ├── globeClicks: 3        (from globe pins)
  └── profileOpens: 2       (from profile links)
```

---

## 🚨 Common Mistakes to Avoid

1. **Double-counting impressions:**
   - ❌ Don't track on scroll AND on click
   - ✅ Use useImpressionTracker (does debouncing)

2. **Impression without context:**
   - ❌ Don't forget sourcePosition or source
   - ✅ Include full context (where, position)

3. **No deduplication:**
   - ❌ Don't generate random eventIds
   - ✅ analyticsService handles it (deterministic)

4. **Network fallback:**
   - ❌ Don't fail silently if analytics doesn't send
   - ✅ Queue keeps events locally, retries on next flush

---

## 📋 Implementation Checklist

### Frontend Changes
- [ ] Add missing methods to analyticsService
- [ ] Update AnalyticsEventName types
- [ ] Instrument DiscoverFeedPage with useImpressionTracker
- [ ] Instrument GlobePage with pin click tracking
- [ ] Instrument ProfilePage with profile/gear tracking
- [ ] Add tests for discovery tracking
- [ ] Build passes (npm run build)

### Testing
- [ ] Manual test: Explore impressions
- [ ] Manual test: Globe pin clicks
- [ ] Manual test: Profile opens
- [ ] DevTools verification: Events appear in Network
- [ ] Firestore verification: Events saved
- [ ] End-to-end: Watch video from Explore

### Documentation
- [ ] Update README-ANALYTICS.md
- [ ] Add discovery tracking examples
- [ ] Document new event types

---

## ⏱️ Effort Estimate

| Task | Time |
|------|------|
| Add analyticsService methods | 30 min |
| Instrument DiscoverFeedPage | 1 hour |
| Instrument GlobePage | 1 hour |
| Instrument ProfilePage | 1 hour |
| Testing | 1-2 hours |
| Documentation | 30 min |
| **Total** | **2-3 days** |

---

## 🎯 Success Criteria

- [x] All impression/click events sent to backend
- [x] Events deduplicated correctly
- [x] Stats updated in Firestore
- [x] No double-counting
- [x] Build passes
- [x] Tests pass
- [x] Can answer "Which streams are most discovered?"

---

## Next After Phase 2.5

**Phase 3: Statistics Aggregation**
- Calculate `creatorStats` (total views, conversion rates)
- Calculate `categoryStats` (popularity by category)
- Calculate `userAnalytics` (user affinity for recommendations)

**Phase 4: Dashboard**
- Build `/admin/analytics` route
- Display metrics, charts, trends
- Filter by date, source, category

---

## 📚 Reference

**Files to read:**
- `docs/ANALYTICS-INTEGRATION-MANAGEMENT.md` - How system works
- `docs/PHASE-2-COMPLETE.md` - useStreamView details
- `src/hooks/useImpressionTracker.ts` - IntersectionObserver hook
- `src/services/analytics/analyticsService.ts` - API reference

**Commands:**
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run analytics tests
```

---

**Status:** Ready to implement when you give the signal  
**Complexity:** Low (mostly copy-paste from Phase 2)  
**Risk:** Very low (isolated to specific pages)  
