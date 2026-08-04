# Phase 2.5: Discovery & Navigation Tracking — Frontend Complete

**Completed:** 2026-07-31  
**Frontend Status:** ✅ Deployed to Production  
**Backend Status:** ⏸️ Blocked by Firebase Spark Plan  
**Branch:** main  
**Commit:** bc21b26

---

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| **Frontend Tracking** | ✅ Completed | Globe pins, Discover impressions, Profile opens instrumented |
| **Local Queue** | ✅ Completed | Events persist in localStorage, ready for backend |
| **Backend Ingestion** | ⏸️ Blocked | Cloud Functions need Firebase Blaze plan (currently Spark) |
| **Event Storage** | ⏸️ Pending | Firestore collection ready, but endpoint not deployed |
| **Phase 3 Aggregation** | ⏸️ Pending | Waiting for backend events to arrive |
| **Phase 4 Dashboard** | ⏸️ Pending | Admin dashboard built, no real data without backend |

---

## What Was Built

### 3 Pages Instrumented + UI Refinements

**Frontend Analytics (Deployed)**
- ✅ Globe page: Pin click tracking
- ✅ Discover page: Stream impression tracking
- ✅ Profile page: Profile open tracking

**UI Improvements (Deployed)**
- ✅ Globe: Ocean color darkened (#004080 → #001a4d)
- ✅ Watch page: Info repositioned to bottom-left, sized down
- ✅ Watch page: Comments hidden, action buttons adjusted
- ✅ Watch page: Action buttons more transparent

**Data Cleanup**
- ✅ Removed dog-trainer-berlin mockup stream

---

## Implementation Details

### 1. Globe Page (CurrentGlobe.jsx)

**Added:**
- Import: `analyticsService`
- Tracking call in `selectFeature()` function
- Records: streamId, creatorId, latitude, longitude

**Event generated:**
```json
{
  "eventName": "globe_pin_clicked",
  "streamId": "...",
  "creatorId": "...",
  "metadata": { "latitude": 52.5, "longitude": 13.4 }
}
```

**Code:**
```typescript
const stream = enrichedStreams.find((s) => s.id === nextSelectedId);
if (stream) {
  analyticsService.trackGlobePinClicked(
    stream.id,
    stream.creatorId || stream.id,
    feature.geometry.coordinates[1],  // latitude
    feature.geometry.coordinates[0]   // longitude
  );
}
```

---

### 2. Discover Page (DiscoverFeedPage.jsx)

**Added:**
- Import: `analyticsService`
- useEffect to track when stream becomes current
- Records: streamId, creatorId, source='discover'

**Event generated:**
```json
{
  "eventName": "stream_impression",
  "streamId": "...",
  "creatorId": "...",
  "source": "discover"
}
```

**Code:**
```typescript
useEffect(() => {
  if (current && current.id) {
    analyticsService.trackStreamImpression(
      current.id,
      current.creatorId || current.id,
      'discover'
    );
  }
}, [current?.id]);
```

---

### 3. Profile Page (ProfilePage.jsx)

**Added:**
- useEffect to track profile opens
- Records: creatorId, source='profile'

**Event generated:**
```json
{
  "eventName": "creator_profile_opened",
  "creatorId": "...",
  "source": "profile"
}
```

**Code:**
```typescript
useEffect(() => {
  if (creatorId && state.viewedProfile) {
    analyticsService.trackCreatorProfileOpened(creatorId, undefined, 'profile');
  }
}, [creatorId]);
```

---

## Frontend Status: ✅ Complete

All three pages instrumented and deployed:
- ✅ Code compiles
- ✅ Events queued locally
- ✅ Tracking calls execute on user actions
- ✅ Zero console errors (reduced logging noise)

---

## Backend Status: ⏸️ Blocked (Not Deployed)

**Cloud Functions require Firebase Blaze plan — currently on Spark (free)**

**Current Firebase Plan:** Spark (free tier)  
**Required Firebase Plan:** Blaze (pay-as-you-go)  
**Reason:** Cloud Functions only available on Blaze and higher  

**Impact:**
- ✅ Frontend collects events correctly
- ✅ Events queue in localStorage (persisted)
- ❌ Cannot send events to backend
- ❌ Endpoint `/api/analytics/events` does not exist
- ❌ Events not stored in Firestore
- ❌ Phase 3 aggregation blocked (no data)
- ❌ Phase 4 dashboard shows no real data

**Current Behavior:** Events queue locally and retry every 30 seconds. Retries fail silently (404 error), events remain in localStorage for later when backend is available.

**Decision:** Not upgrading to Blaze yet (as of 2026-08-01).

---

## Data Flow (Frontend → Queue)

```
User clicks pin on Globe
  ↓
selectFeature() executes
  ↓
trackGlobePinClicked(streamId, creatorId, lat, lng) called
  ↓
analyticsQueue.enqueue({
  eventName: 'globe_pin_clicked',
  streamId: '...',
  creatorId: '...',
  metadata: { latitude, longitude }
})
  ↓
Event stored in localStorage
  ↓ (every 30s or when queue full)
Try to submit to /api/analytics/events
  ↓
Request fails (404 - backend not deployed)
  ↓
Queue persists locally, ready for retry
```

---

## Integration Points

### What It Depends On
- ✅ analyticsService (Phase 1) - working
- ✅ analyticsQueue (Phase 1) - working
- ✅ Firebase Auth (for session tracking) - working
- ⏸️ Cloud Functions (Phase 1.5) - blocked by Blaze plan

### What Depends On It
- Phase 3 (Aggregation) - waiting for backend
- Phase 4 (Dashboard) - waiting for aggregated data

---

## Deployment Info

**Hosting:** https://vuvio-bf328.web.app  
**Frontend:** Deployed ✅  
**Backend:** Not deployed (Blaze required)

**Last deploy:** 2026-07-31

---

## Testing Phase 2.5

### Manual Test: Globe Pin Click

1. Open https://vuvio-bf328.web.app/globe
2. Click on any globe pin
3. Open DevTools → Console
4. Should see: `[Analytics] View session ended: Object` (from Phase 2)
5. Open DevTools → Application → Local Storage
6. Look for key: `vuvio:analytics-queue`
7. Should see event in queue (stringified JSON)

**Expected queue entry:**
```json
{
  "id": "globe_pin_clicked_...",
  "eventName": "globe_pin_clicked",
  "streamId": "sailor-split",
  "creatorId": "...",
  "metadata": { "latitude": 43.5081, "longitude": 16.4402 }
}
```

### Manual Test: Discover Page Impression

1. Open https://vuvio-bf328.web.app/discover
2. View different streams (swipe through)
3. Check Local Storage: `vuvio:analytics-queue`
4. Should have `stream_impression` events with source='discover'

### Manual Test: Profile Open

1. Open any Watch page
2. Click on creator name/avatar
3. Check Local Storage: `vuvio:analytics-queue`
4. Should have `creator_profile_opened` event

---

## Known Limitations

1. **Backend offline:**
   - Events collected locally but don't reach Firestore
   - Queue persists in localStorage
   - Once backend deployed, events auto-submit

2. **Analytics Methods Pre-existing:**
   - All required analytics methods existed in Phase 1
   - Phase 2.5 only added the **calls** to those methods
   - No new analytics infrastructure needed

3. **No Explore Page:**
   - DiscoverFeedPage instruments carousel (1 stream at a time)
   - ExplorePage would need grid instrumentation
   - Can add later if needed

---

## Code Changes Summary

| File | Change | Lines |
|------|--------|-------|
| CurrentGlobe.jsx | Import + tracking in selectFeature | +6 |
| DiscoverFeedPage.jsx | Import + useEffect for impressions | +9 |
| ProfilePage.jsx | useEffect for profile opens | +6 |
| analyticsClient.ts | Reduce error logging noise | +3 |
| firebase.json | Add functions config | +3 |
| globe-test.css | Canvas background color | +1 |
| live.css | Watch UI positioning & styling | +15 |
| Removed: dog-trainer-berlin | Both data files | -20 |

**Total:** ~63 lines added/modified

---

## Success Criteria

- [x] All impression/click events sent to queue
- [x] Events stored in localStorage with correct format
- [x] No console errors (reduced noise)
- [x] Code compiles and builds
- [x] Deployed to production
- [x] Ready for backend once Blaze plan activated

---

## Activation Later (When Ready for Backend)

When you decide to upgrade Firebase to Blaze and activate the backend:

**Step 1: Upgrade Firebase Project**
1. Open: https://console.firebase.google.com/project/vuvio-bf328/billing/modify
2. Switch from Spark (free) to Blaze (pay-as-you-go)
3. Confirm billing details

**Step 2: Deploy Cloud Functions**
```bash
# From project root
firebase deploy --only functions
```

**Step 3: Verify Deployment**
1. Firebase Console → Functions → Check `ingestEvents` is deployed
2. Open app, interact with tracked elements (globe pins, discover, profiles)
3. DevTools → Network → Should see POST to `/api/analytics/events` returning 200
4. Firebase Console → Firestore → Check `analyticsEvents` collection has documents

**Step 4: Monitor**
- Phase 3 aggregation functions will automatically schedule
- Phase 4 dashboard will start showing real data
- Check `/admin/analytics` for live metrics

**Expected Result:**
```json
// Events in localStorage will automatically submit
POST /api/analytics/events → 200 OK
{
  "accepted": 45,
  "deduped": 0,
  "errors": 0
}
```

---

## Next Steps

### Option A: Activate Backend (Recommended)
1. Upgrade Firebase to Blaze
2. `firebase deploy --only functions`
3. Events flow to Firestore
4. Phase 3 aggregation kicks in (every 5 min)
5. Phase 4 dashboard shows live metrics

### Option B: Add More Pages
- Instrument ExplorePage (grid of streams)
- Add equipment click tracking
- Add search tracking
- Can do anytime without backend

### Option C: Monitor & Debug
- Watch LocalStorage queue growth
- Verify events when backend comes online
- Check Firestore once backend deployed

---

## Files Modified

```
src/
├── components/globe/CurrentGlobe.jsx        (+6 lines)
├── routes/DiscoverFeedPage.jsx              (+9 lines)
├── routes/ProfilePage.jsx                   (+6 lines)
├── services/analytics/analyticsClient.ts    (+3 lines)
├── styles/pages/
│   ├── globe-test.css                       (+1 lines)
│   └── live.css                             (+15 lines)
├── data/
│   ├── mapStreams.js                        (-11 lines)
│   └── mockStreams.js                       (-9 lines)
└── firebase.json                            (+3 lines)
```

---

## Summary

**Phase 2.5 Frontend: Complete & Deployed ✅**

Instruments the discovery flow (globe pins, discover impressions, profile opens) and deploys UI refinements. All events are collected and queued locally in localStorage, ready to submit to the backend once available.

The implementation follows established patterns from Phase 2 (watch tracking) and requires no new analytics infrastructure — just strategic placement of existing `analyticsService` calls.

**Phase 2.5 Backend: Blocked ⏸️**

Cloud Functions cannot deploy without Firebase Blaze plan. Events queue locally and retry silently. Once backend is deployed, events will automatically begin submitting and persisting to Firestore.

---

**Frontend Status:** ✅ Complete & Deployed  
**Backend Status:** ⏸️ Blocked (Firebase Spark plan)  
**Next Action:** When ready, upgrade Firebase to Blaze and run `firebase deploy --only functions`  
**Decision:** Not upgrading yet (as of 2026-08-01)

