# Vuvio Analytics System — Status

Status: Historical status report, partially current  
Last reviewed: 2026-09-18  
Read before coding: Use for rollout context, but verify current code and Firebase deployment state.

> Phrases like "Production Ready" below reflect the original rollout note, not a guarantee of current production behavior. Backend deployment, billing plan, event schemas, and admin access must be verified before analytics changes.

**As of 2026-08-01** — Overall: Partial Deployment (Frontend Ready, Backend Blocked)

---

## What's Done

### Phase 1: Event Queue Foundation
Frontend analytics infrastructure: event queue (localStorage), session management (sessionId, anonymousId, userId), HTTP client with exponential backoff, deduplication, config.

**Files:** `src/services/analytics/`  
**Build impact:** +5–8 KB gzipped. 60+ unit tests passing.

### Phase 1.5: Backend Ingestion Endpoint (Code ready, NOT deployed)
`POST /api/analytics/events` — validates, deduplicates, saves to `analyticsEvents`, updates `streamStats` in real-time. Handles batches up to 500 events.

**File:** `functions/src/analytics/ingestEvents.ts`  
**Status:** Compiles. NOT deployed — requires Firebase Blaze plan (project is on Spark/free).

### Phase 2: View Session Tracking
`useStreamView` and `useImpressionTracker` hooks. Tracks impressions (IntersectionObserver), play/pause, active watch time (only when playing + visible + tab active), milestones (3s/10s/30s), follow/share/gear/swipe.

**Integrated into:** `src/routes/HomePage.jsx`

### Phase 2.5: Discovery Tracking
Explore card impressions, Globe pin clicks, Profile opens — also deployed.

---

## Data Collection Points

```
Watch (HomePage.jsx) — impressions, view start, milestones, follow/share/gear, swipe
Explore               — card impressions, interactions
Globe                 — pin clicks
Profile               — opens, equipment views

          ↓ queue locally (localStorage, up to 500 events)
          ↓ flush every 30s or on important event

POST /api/analytics/events → analyticsEvents/{id} + streamStats/{id}
```

---

## Key Metrics

**Per stream:** impressions, viewStarts, retention10s/30s, follows, shares, gear opens, skips  
**Per user:** sessionId, anonymousId, userId, activeWatchTime  
**Per source:** watch / explore / globe / profile

---

## Deployment Status

**Frontend:** deployed to https://vuvio-bf328.web.app (Phases 1, 2, 2.5)  
**Backend:** NOT deployed — Firebase Spark plan blocks Cloud Functions. Upgrade to Blaze to unblock.

Once Blaze is active: `firebase deploy --only functions` — queued events will submit automatically, no code changes needed.

---

## What's Planned

- **Phase 3** — Stats aggregation (`creatorStats`, `categoryStats`, `userAnalytics`). Requires Phase 1.5 live.
- **Phase 4** — Admin dashboard at `/admin/analytics`. Requires Phase 3.

---

## Quick Commands

```bash
npm run dev
npm run build
npm run test -- streamViewTracker.test.ts
npm run test -- analyticsQueue.test.ts
```

---

## Troubleshooting

**Events not in Firestore?** Check `Application > Local Storage > vuvio:analytics-queue` in DevTools. If events are queued but never sent, the backend endpoint doesn't exist yet (Spark plan).

**Active watch time wrong?** Only counts when: video playing + element 50%+ visible + tab active.

**Duplicate events?** Handled automatically by deterministic `eventId` on both frontend and backend.
