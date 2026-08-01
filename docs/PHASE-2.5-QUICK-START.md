# Phase 2.5: Quick Start — Copy-Paste Instructions

**Complexity Assessment:** Pages are more complex than Phase 2  
**Time Required:** 3-5 hours (detailed work needed)  
**Risk:** Medium (multiple pages, coordinated changes)

---

## Option A: Minimal Implementation (1-2 hours)

Add tracking to just **one page** to test the pattern.

### Example: Add Profile Open Tracking

**File:** `src/routes/ProfilePage.jsx`

**Step 1:** Add imports (after line 20, with other imports)

```typescript
import { analyticsService } from '../services/analytics.js';
```

**Step 2:** Track profile opens (find where profile is loaded, add after line ~200)

```typescript
// When navigating to this profile from a stream
useEffect(() => {
  // Get streamId from URL params if navigating from watch
  const params = new URLSearchParams(window.location.search);
  const streamId = params.get('stream');
  
  if (streamId && profile?.id) {
    analyticsService.trackCreatorProfileOpened(
      profile.id,
      streamId,
      'watch'  // source
    );
  }
}, [profile?.id]);
```

**Step 3:** Test in browser
- Navigate from Watch page to Profile
- DevTools → Network → XHR/Fetch
- Should see POST to `/api/analytics/events`

---

## Option B: Full Phase 2.5 (3-5 hours)

Do all three pages properly. **Requires understanding:**
- Page structure (React components, hooks, event handlers)
- Where cards/pins/items are rendered
- How navigation works in each page
- Where to inject analytics calls

### Pages to Instrument

#### 1. Explore Page (DiscoverFeedPage or ExplorePage)

**Goal:** Track card impressions

**Problem:** Explore uses different card types (Nearby, Upcoming, Category, Creator)

**Solution:** Add to each card render loop

```javascript
{streams.map((stream, index) => (
  <div
    key={stream.id}
    ref={useRef().current}
    onMouseEnter={() => {
      // Or use useImpressionTracker for IntersectionObserver
      analyticsService.trackStreamImpression(
        stream.id,
        stream.creatorId,
        'explore',
        index
      );
    }}
  >
    {/* Card content */}
  </div>
))}
```

**Actual Locations:**
- `src/routes/ExplorePage.jsx` line ~300-400 (NearbyCard loop)
- `src/routes/ExplorePage.jsx` line ~400-500 (CreatorCard loop)
- Add to each `.map()` rendering cards

#### 2. Globe Page (CurrentGlobe.jsx)

**Goal:** Track pin clicks

**Problem:** MapLibre event handler, not React onClick

**Solution:** Modify selectFeature function

```typescript
// Find in CurrentGlobe.jsx around line 650:
const selectFeature = (event) => {
  const { properties } = event.features?.[0];
  if (!properties) return;
  
  // ADD THIS:
  analyticsService.trackGlobePinClicked(
    properties.streamId,
    properties.creatorId,
    properties.latitude,
    properties.longitude
  );
  
  // Existing logic continues...
  navigate(`/watch?live=${properties.streamId}`);
};
```

**Actual Location:**
- `src/components/globe/CurrentGlobe.jsx` line ~650

#### 3. Profile Page (ProfilePage.jsx)

**Goal:** Track profile opens and equipment views

**Solution A - Profile Opens:**

```typescript
// Add to ProfilePage.jsx, in component function, after useEffect hooks:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const streamId = params.get('stream');
  
  if (streamId && creatorId) {
    analyticsService.trackCreatorProfileOpened(
      creatorId,
      streamId,
      'watch'  // Where they came from
    );
  }
}, [creatorId]);
```

**Solution B - Equipment Views:**

```typescript
// In equipment rendering section, find the onClick:
<button
  onClick={() => {
    // ADD THIS:
    analyticsService.trackGearItemOpened(
      gearItem.id,
      streamId,
      creatorId
    );
    
    // Existing logic...
  }}
>
  {/* Equipment item */}
</button>
```

**Actual Locations:**
- Profile opens: After line ~100
- Equipment view: Around line ~450-500

---

## Option C: Smart Implementation (2 hours)

Just add tracking **where it's easiest** - don't overthink it.

### Strategy

1. **Skip Explore** (too many card types)
2. **Add Globe** (single selectFeature function)
3. **Add Profile** (useEffect pattern)

### Why?

- Globe tracking shows geographic discovery
- Profile tracking shows creator interest
- Explore can wait - need grid refactor anyway

### Expected Results

After doing Globe + Profile:

```json
{
  "globe_pin_clicked": 5,
  "creator_profile_opened": 3,
  "stream_view_started": 8  // From those profiles clicking play
}
```

---

## Step-by-Step for Globe (Easiest)

**File:** `src/components/globe/CurrentGlobe.jsx`

**Step 1:** Add import at top

```typescript
import { analyticsService } from '../../services/analytics.js';
```

**Step 2:** Find selectFeature function (~line 650)

Look for:
```typescript
const selectFeature = (event) => {
```

**Step 3:** Add tracking inside selectFeature

```typescript
const selectFeature = (event) => {
  const { properties } = event.features?.[0];
  if (!properties) return;
  
  // ADD THESE 4 LINES:
  const { streamId = '', creatorId = '', latitude, longitude } = properties;
  analyticsService.trackGlobePinClicked(streamId, creatorId, latitude, longitude);
  
  // Rest of existing code...
};
```

**Step 4:** Test

- Open Globe
- Click on a pin
- DevTools → Network → Should see POST to `/api/analytics/events`

---

## Validation Checklist

After implementing your choice:

- [ ] Code compiles (`npm run build`)
- [ ] No console errors
- [ ] Network requests sent to `/api/analytics/events` ⚠️ (will fail with 404 - backend not deployed)
- [ ] Events queued in localStorage (`vuvio:analytics-queue`) ✅ (this works now)
- [ ] Data in queue has correct eventName
- [ ] Data in queue has streamId and creatorId

**Note:** Events cannot reach Firestore yet because Phase 1.5 backend isn't deployed (Firebase Spark plan). Events queue locally and will submit automatically once backend goes live.

---

## If You Get Stuck

### "Code doesn't compile"
→ Check import paths, spelling of function names
→ Run `npm run build` to see full error

### "No network requests"
→ Is page actually instrumented?
→ Are streams loaded? (need streamId)
→ Check browser console for `[Analytics]` logs

### "Events in queue but not sent"
→ **This is expected!** Backend not deployed yet (Firebase Spark plan)
→ Check DevTools → Application → Local Storage → `vuvio:analytics-queue`
→ Should see events queued and waiting
→ Events will send automatically once backend is deployed

### "Network shows 404 on analytics endpoint"
→ **This is expected!** The endpoint doesn't exist yet
→ Firebase project still on Spark plan (free tier)
→ Cloud Functions only available on Blaze (paid tier)
→ Events queue locally and will retry automatically

### "Data missing in Firestore"
→ **Expected** - Firestore doesn't have events because endpoint not deployed
→ Phase 1.5 backend blocked by Firebase Spark plan
→ Once backend deployed, events will flow and Firestore will populate

---

## Decision Tree

**Question: How much time do you have?**

- **< 1 hour** → Skip Phase 2.5 for now
- **1-2 hours** → Do Globe only (Option C)
- **2-3 hours** → Do Globe + Profile (Option C smart)
- **3-5 hours** → Do all three pages (Option B full)

**Question: What's most important?**

- **Geographic discovery** → Do Globe (where users find streams)
- **Creator interest** → Do Profile (which creators users click)
- **All discovery** → Do all three pages

**Recommendation:** Start with Globe (easiest, most useful)

---

## Files You'll Touch

```
src/
├── services/analytics/
│   └── analyticsService.ts         (ONLY READ - no changes)
├── routes/
│   ├── ProfilePage.jsx             (+ 10 lines)
│   └── ExplorePage.jsx             (+ 30 lines if doing full)
├── components/globe/
│   └── CurrentGlobe.jsx            (+ 5 lines)
└── data/
    └── mockStreams.js              (ONLY READ - reference)
```

---

## Success Metrics

**After Phase 2.5:**

Queries you can now answer:

✅ "Which geographic areas drive discovery?"  
✅ "How many pin clicks lead to watch?"  
✅ "Which creators get most profile opens?"  
✅ "Discovery to watch conversion rate"  

---

## Copy-Paste Code Blocks

### Globe Pin Click Tracking

```typescript
// Add to CurrentGlobe.jsx selectFeature function
const { streamId = '', creatorId = '', latitude, longitude } = properties;
analyticsService.trackGlobePinClicked(streamId, creatorId, latitude, longitude);
```

### Profile Open Tracking

```typescript
// Add to ProfilePage.jsx after hooks
const params = new URLSearchParams(window.location.search);
const streamId = params.get('stream');
if (streamId && profile?.id) {
  analyticsService.trackCreatorProfileOpened(profile.id, streamId, 'watch');
}
```

### Equipment Click Tracking

```typescript
// Wrap existing onClick
onClick={() => {
  analyticsService.trackGearItemOpened(gearItem.id, streamId, profile.id);
  // existing logic
}}
```

---

**Status:** Ready to implement step-by-step  
**Recommendation:** Start with Globe (5 lines, high value)  
**Next:** Profile (10 lines, medium value)  
**Later:** Explore (30+ lines, medium effort)
