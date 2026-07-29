# Vuvio Data Analytics Audit

**Date:** 2026-07-29  
**Status:** Complete Codebase Analysis  
**Scope:** All existing collections, pages, interactions, and analytics infrastructure

---

## Executive Summary

Vuvio has a functional streaming architecture (Firebase, WebRTC, HLS playback) with multiple views (Watch, Explore, Discover, Globe, Profile) but **zero systematic event tracking and analytics collection**. 

The following exist and can be reused:
- **Backend API endpoint** `/api/streams/{streamId}/events` (already defined but incomplete)
- **Firestore collection** `/streams/{streamId}/events/{eventId}` (sub-collection, unused)
- **Firestore collection** `/streamStats/{streamId}` (empty, structure defined)
- **Analytics types** already defined in `functions/src/types/analytics.ts`
- **Cloud Functions router** in `functions/src/index.ts`

The priority implementation path after this audit is:

```txt
real impression
→ stream view start
→ active watch time
→ 3/10/30 second retention thresholds
→ view session end
→ streamStats aggregation
```

Gear, follow, share, Explore, Globe, Profile, creator/category/user aggregates, scores, and the internal dashboard should be layered on top after that chain is working with real collected events.

## Existing Backend

The project already has Firebase Cloud Functions under `functions/src`.

Existing API router:

- `functions/src/index.ts`
- Base frontend API wrapper: `src/services/streamApi.ts`
- Default API base: `VITE_STREAM_API_BASE || /api`

Existing backend areas:

- Stream lifecycle:
  - `functions/src/streams/createStream.ts`
  - `functions/src/streams/startStream.ts`
  - `functions/src/streams/heartbeatStream.ts`
  - `functions/src/streams/endStream.ts`
  - `functions/src/streams/getStream.ts`
  - `functions/src/streams/listLiveStreams.ts`
  - `functions/src/streams/monitorStreamHeartbeats.ts`
- Gear:
  - `functions/src/gear/attachGearToStream.ts`
  - `functions/src/gear/getStreamGear.ts`
  - `functions/src/gear/gearHelpers.ts`
- Existing analytics:
  - `functions/src/analytics/trackStreamEvent.ts`
  - `functions/src/analytics/stats.ts`
  - `functions/src/types/analytics.ts`
- Cloudflare:
  - `functions/src/cloudflare/cloudflareClient.ts`
  - `functions/src/cloudflare/cloudflareWebhook.ts`
  - `functions/src/cloudflare/verifyCloudflareWebhook.ts`

## Existing Firestore Collections

Declared or used collections:

- `users`
- `usernames`
- `activeLives`
- `activeLives/{liveId}/watchers`
- `streams`
- `streams/{streamId}/events`
- `gear`
- `streamStats`
- `webhookEvents`

Rules are in `firestore.rules`.

Important current access rules:

- `streams` are backend-owned; clients cannot create/update/delete them directly.
- `streams/{streamId}/events` are backend-owned; creators can read their stream events, clients cannot write directly.
- `streamStats` are backend-owned; creators can read stats for their own stream, clients cannot write.
- `gear` can be created/updated by owners.
- `activeLives` is still client-writable for current realtime broadcast flows.

Missing rules for requested future collections:

- `analyticsEvents`
- `streamViewSessions`
- `creatorStats`
- `categoryStats`
- `userAnalytics`

These must be backend-written. `userAnalytics/{userId}` must not be publicly readable.

## Existing User Model

User creation is in `src/services/authService.js`.

Known user fields include:

- `uid`
- `email`
- `displayName`
- `username`
- `photoURL`
- `coverURL`
- `bio`
- `role`
- `accountStatus`
- `followerCount`
- `followingCount`
- `liveCount`
- `followedCreators`

Follow-related services:

- `src/services/creatorService.js`
- `src/services/followService.js`
- profile follow UI in `src/routes/ProfilePage.jsx`

Current follow state appears split:

- Firestore profile/user follow arrays and counters in creator service.
- LocalStorage follow behavior in `followService.js`.

This is a duplication risk for analytics because a follow event must be tied to the canonical follow action, not only a local UI toggle.

## Existing Live Models

There are two parallel live systems.

### Backend `streams`

Defined in `functions/src/types/stream.ts`.

Important fields:

- `id`
- `creatorId`
- `title`
- `description`
- `category`
- `subcategories`
- `environment`
- `status`
- `visibility`
- `countryCode`
- `city`
- `approximateLocation`
- `cloudflareLiveInputId`
- `cloudflareUid`
- `playbackUrl`
- `hlsManifestUrl`
- `startedAt`
- `endedAt`
- `durationSeconds`
- `currentViewerCount`
- `peakViewerCount`
- `totalUniqueViewers`
- `gearIds`
- `networkStatus`
- `interruptionCount`
- `disconnectedSeconds`

This model is the right source of truth for backend-enriched analytics when a stream exists in Firestore.

### Frontend/demo live feeds

Used across Watch, Explore, Globe, and Profile:

- `src/data/newPovStreams.js`
- `src/data/lives.js`
- `src/data/mockStreams.js`
- `src/data/mapStreams.js`
- `src/data/creatorProfiles.js`
- `src/services/createdLiveService.js`

These feeds power a lot of the current app UI, including mock/demo content. Analytics must not treat loaded mock data as real views. For V1, events can be collected for stable stream IDs, but backend enrichment will only be fully reliable for `streams/{streamId}` and active user-created lives unless demo streams are mirrored into backend metadata.

## Existing Analytics

Current backend analytics endpoint:

```txt
POST /api/streams/{streamId}/events
```

Implemented by `functions/src/analytics/trackStreamEvent.ts`.

Current event types in `functions/src/types/analytics.ts`:

```txt
stream_impression
viewer_joined
viewer_left
view_10_seconds
view_30_seconds
stream_skipped
follow_creator
share
gear_opened
gear_clicked
comment_sent
report_submitted
```

Current event storage:

```txt
streams/{streamId}/events/{eventId}
```

Current stats storage:

```txt
streamStats/{streamId}
```

Current increment fields:

- `stream_impression` -> `impressions`
- `view_10_seconds` -> `views10Seconds`
- `view_30_seconds` -> `views30Seconds`
- `stream_skipped` -> `skipsUnder3Seconds`
- `follow_creator` -> `followsGenerated`
- `share` -> `shares`
- `gear_opened` -> `gearOpens`
- `gear_clicked` -> `gearClicks`
- `report_submitted` -> `reports`

Current frontend wrapper:

- `trackStreamEvent()` in `src/services/streamApi.ts`

### Analytics gaps

The existing analytics layer is useful but incomplete:

- No batch endpoint `POST /api/analytics/events`.
- No top-level `analyticsEvents/{eventId}` collection.
- No `streamViewSessions/{viewSessionId}`.
- No `sessionId`, only `anonymousSessionId`.
- No durable `anonymousId` model.
- No active watch time tracking.
- No 3-second threshold.
- Event naming differs from requested names:
  - `view_10_seconds` should become `stream_view_10_seconds`.
  - `view_30_seconds` should become `stream_view_30_seconds`.
  - `follow_creator` should become `creator_followed`.
  - `share` should become `stream_shared`.
  - `gear_opened` should become `gear_panel_opened`.
  - `gear_clicked` should split into `gear_item_opened` and `gear_external_link_clicked`.
  - `report_submitted` should become `stream_reported`.
- `trackStreamEvent` currently sets `userId` to `null` even if an Authorization header exists; it does not authenticate optional users.
- Backend currently accepts `source` and `metadata`, but does not enrich `creatorId`, `category`, or `environment` into events.
- Deduplication exists per stream event doc ID, but not yet for global analytics events or view session thresholds.
- `streamStats` does simple increments only; it does not calculate unique viewers, active watch duration, averages, medians, ratios, or scores.
- No idempotent rebuild functions exist.

## Existing Cloudflare Data

Cloudflare integration exists in `functions/src/cloudflare`.

Current webhook maps:

- `live_input.connected` -> `input_connected`
- `live_input.disconnected` -> `input_disconnected`
- `live_input.started` -> `live_started`
- `live_input.ended` -> `live_ended`
- `video.ready` -> `video_ready`
- `video.errored` -> `error`

Webhook events are deduped in:

```txt
webhookEvents/{eventId}
```

Stream technical fields already exist:

- `networkStatus`
- `interruptionCount`
- `disconnectedSeconds`
- `lastHeartbeatAt`
- `peakViewerCount`
- `currentViewerCount`

Gaps:

- No frontend playback startup delay tracking.
- No buffering count/duration tracking.
- No fatal playback error event shape.
- No live latency or bitrate aggregation from the viewer player.
- Cloudflare webhook data is stream-level, not viewer-session-level.

## Existing Pages To Instrument

### Watch

Main page:

- `src/routes/HomePage.jsx`

Relevant components/functions:

- `HomePageRoute`
- `LiveViewer`
- `CreatorLiveSession`
- `CameraLiveMedia`
- `LiveLocationGlobe`
- Gear sheet state and equipment interactions inside `LiveViewer`
- Like, follow, chat/comment UI inside `LiveViewer`

This is the first page to instrument for the complete chain.

Current issue:

- `LiveViewer` selects `liveFeed[index]`, updates on `liveId`, and supports swipe/drag behavior.
- It has refs for video elements and WebRTC streams, which can be used to detect play/pause/waiting/playing/ended.
- It currently does not create a durable view session or track active watch time.

### Explore

Pages:

- `src/routes/ExplorePage.jsx`
- `src/routes/AllLivesPage.jsx`

Explore opens Watch via:

```txt
/watch?live={id}&mode=view
```

Need to add real card impressions via `IntersectionObserver`, click source metadata, source position, filters, selected category/environment, and search presence.

### Globe

Current route:

- `/globe`
- `/map`

Components:

- `src/routes/CurrentGlobePage.jsx`
- `src/components/globe/CurrentGlobe.jsx`

Globe click handlers already select features and can navigate to Watch/Discover. Do not emit continuous globe movement events. Only emit point/card/open/watch conversion events.

### Profile

Main page:

- `src/routes/ProfilePage.jsx`

Profile includes creator stats, current live cards, recent lives, follow UI, and Gear display. Instrument profile opens from live, follow, old live opens, Gear opens, and Gear item clicks.

## Existing Video Playback Detection Points

Likely points:

- `LiveViewer` in `src/routes/HomePage.jsx`
- `localVideoRef`
- `remoteVideoRef`
- `videoPlaybackRef`
- `CameraLiveMedia`
- WebRTC watcher status in `watchBroadcast`
- static/demo video playback refs

Useful browser events:

- `play`
- `pause`
- `playing`
- `waiting`
- `ended`
- `error`
- `visibilitychange`
- `pagehide`
- `beforeunload`

Needed:

- A centralized `streamViewTracker` that receives player visibility and playback state.
- Active time should only count when document is visible, stream is the active item, player is visible, playback is playing, and no fatal/buffering blocked state is active.

## Existing Gear System

Frontend:

- `src/services/equipmentService.js`
- `src/data/equipmentModel.js`
- `src/components/equipment/EquipmentKit.jsx`
- `src/components/gear/*`
- Gear UI in `ProfilePage.jsx`
- Gear/equipment sheet in `HomePage.jsx`

Backend:

- `functions/src/gear/attachGearToStream.ts`
- `functions/src/gear/getStreamGear.ts`
- `functions/src/gear/gearHelpers.ts`

Existing API:

- `POST /api/streams/{streamId}/gear`
- `GET /api/streams/{streamId}/gear`

Analytics gap:

- Need split events:
  - `gear_panel_opened`
  - `gear_item_opened`
  - `gear_external_link_clicked`
- Backend should enrich gear brand/category from `gear/{gearId}` instead of trusting frontend metadata.
- No fake conversions should be created.

## Existing User Actions

Actions found or implied:

- Follow:
  - `src/services/creatorService.js`
  - `src/services/followService.js`
  - `ProfilePage.jsx`
  - `HomePage.jsx`
- Share:
  - Share actions exist in live recap and likely live UI.
- Comment/chat:
  - `LiveViewer` local chat state.
  - `ConversationPage.jsx`
  - messaging services.
- Like:
  - `LiveViewer` local liked/reaction state.
- Report:
  - `ReportProblemForm.jsx` exists, but stream report analytics are not connected.
- Rating:
  - No clear production stream rating flow found in the audited files.

Need to instrument only real user actions where UI exists. Do not invent ratings or conversions.

## Risks Of Duplicates

- Existing `streams/{streamId}/events` and requested `analyticsEvents/{eventId}` can duplicate if both are written for the same action without a migration plan.
- Existing event names differ from requested event names.
- Follow is split between Firestore and localStorage services.
- Watch feed duplicates demo video entries using `feedKey`; analytics must dedupe by `viewSessionId`, not by React render.
- Impressions can be double counted on re-render unless guarded by stable visibility windows and impression keys.
- Thresholds can double count on retry unless `eventId` is deterministic per `viewSessionId + eventName`.
- Anonymous visitors need a stable local `anonymousId`; current `anonymousSessionId` is not enough.
- Demo/mock streams may not exist in backend `streams`; backend enrichment can fail unless fallback metadata strategy is explicit.

## Reusable Pieces

Can reuse:

- Firebase Functions API router in `functions/src/index.ts`.
- `streamApi.ts` request wrapper and auth token handling.
- `streams` source-of-truth model for creator/category/environment enrichment.
- Existing `streamStats` collection as the destination for live stats.
- Existing Cloudflare webhook and stream lifecycle events for technical quality.
- Existing backend-owned security posture for stats and events.
- Existing internal admin page `/internal/streams` for testing early analytics calls.
- Existing `getStreamGear` and `gear` collection for Gear enrichment.

Should replace or extend:

- Current single-event per-stream endpoint should be extended with a batch endpoint rather than used as the only V1 analytics API.
- Current event names should be normalized to requested names while preserving backward compatibility where needed.
- Current stats incrementer should become a richer aggregator with idempotent session updates.

## Missing Pieces

Required additions:

- `docs/data-analytics-architecture.md`
- `docs/analytics-events.md`
- `docs/analytics-metrics.md`
- Shared analytics types/config.
- Frontend analytics service directory:
  - `src/services/analytics/analyticsTypes.ts`
  - `src/services/analytics/analyticsSession.ts`
  - `src/services/analytics/analyticsQueue.ts`
  - `src/services/analytics/analyticsClient.ts`
  - `src/services/analytics/streamViewTracker.ts`
  - optional `src/services/analytics/useImpressionTracker.ts`
- Backend batch endpoint:
  - `POST /api/analytics/events`
- Backend global event collection:
  - `analyticsEvents/{eventId}`
- Backend view sessions:
  - `streamViewSessions/{viewSessionId}`
- Aggregates:
  - `streamStats/{streamId}`
  - `creatorStats/{creatorId}`
  - `categoryStats/{categoryId}`
  - `userAnalytics/{userId}`
- Idempotent rebuild helpers:
  - `rebuildStreamStats(streamId)`
  - `rebuildCreatorStats(creatorId)`
  - `rebuildCategoryStats(categoryId)`
- Privacy and retention documentation.
- Tests for dedupe, active time, thresholds, ratios, and security rules.

## Proposed Data Model

### Raw events

Use requested top-level collection:

```txt
analyticsEvents/{eventId}
```

Core event fields:

- `id`
- `eventName`
- `userId`
- `anonymousId`
- `sessionId`
- `viewSessionId`
- `streamId`
- `creatorId`
- `gearId`
- `source`
- `sourcePosition`
- `category`
- `environment`
- `metadata`
- `occurredAt`
- `receivedAt`

Frontend may send `streamId`, `gearId`, `source`, `sourcePosition`, `sessionId`, `viewSessionId`, `anonymousId`, `metadata`, and `occurredAt`. Backend must enrich or verify trusted fields such as `userId`, `creatorId`, `category`, `environment`, gear brand/category, and aggregate changes.

### View sessions

Use:

```txt
streamViewSessions/{viewSessionId}
```

Track:

- `streamId`
- `creatorId`
- `userId`
- `anonymousId`
- `sessionId`
- `source`
- `sourcePosition`
- `startedAt`
- `endedAt`
- `watchDurationSeconds`
- `activeWatchDurationSeconds`
- `reached3Seconds`
- `reached10Seconds`
- `reached30Seconds`
- `skippedUnder3Seconds`
- Gear/follow/share/comment/rating/report booleans and counts.
- `exitReason`
- technical metrics summary.

### Stream stats

Reuse and expand:

```txt
streamStats/{streamId}
```

Required fields include:

- counts: impressions, view starts, thresholds, skips, actions, Gear actions.
- unique viewers with dedupe.
- watch time and active watch time.
- ratios with division-by-zero protection.
- technical summary.
- engagement and technical scores when sample size is sufficient.

### Creator, category, and user stats

Add:

```txt
creatorStats/{creatorId}
categoryStats/{categoryId}
userAnalytics/{userId}
```

`userAnalytics` must be private and backend-written.

## Files Expected To Change

Backend:

- `functions/src/index.ts`
- `functions/src/shared/firestore.ts`
- `functions/src/types/analytics.ts`
- `functions/src/analytics/trackStreamEvent.ts`
- `functions/src/analytics/stats.ts`
- new backend analytics files for batch validation, session updates, dedupe, scores, and rebuild helpers.
- `firestore.rules`

Frontend services:

- `src/services/streamApi.ts`
- new `src/services/analytics/*`

Frontend pages/components:

- `src/routes/HomePage.jsx`
- `src/routes/ExplorePage.jsx`
- `src/routes/AllLivesPage.jsx`
- `src/components/globe/CurrentGlobe.jsx`
- `src/routes/ProfilePage.jsx`
- Gear components/sheets touched by Watch/Profile.

Internal tooling:

- `src/routes/InternalStreamAdminPage.jsx`
- possibly `src/App.jsx` for `/admin/analytics`
- new dashboard component/style files.

Docs:

- `docs/data-analytics-audit.md`
- `docs/data-analytics-architecture.md`
- `docs/analytics-events.md`
- `docs/analytics-metrics.md`

Tests:

- `functions/test/*`
- frontend tests if test framework is already configured.

## Implementation Notes

- Do not count loaded feed data as impressions.
- Use `IntersectionObserver` with 50 percent visibility and about 500 ms stability for impressions.
- Do not send analytics writes every second.
- Use local accumulation and flush every 15-30 seconds, on important actions, on backgrounding, and on session end.
- Use `sendBeacon` on `pagehide` when compatible.
- Generate deterministic event IDs for one-time thresholds:
  - `${viewSessionId}:stream_view_3_seconds`
  - `${viewSessionId}:stream_view_10_seconds`
  - `${viewSessionId}:stream_view_30_seconds`
  - `${viewSessionId}:stream_skipped`
- Keep queue failures non-blocking for UI.
- Store random `anonymousId`; do not fingerprint.
- Do not store viewer precise location.
- Do not create fake conversions, fake ratings, fake sales, or fake stats.

## Recommended Next Step

Implement the complete Watch chain first:

1. Add shared event names and affinity/score config.
2. Add `anonymousId`, `sessionId`, queue, and batch client.
3. Add backend `POST /api/analytics/events` with validation, optional auth, dedupe, backend enrichment, raw event write, and stream view session upsert.
4. Instrument `LiveViewer` for:
   - real impression of active content;
   - `stream_view_started`;
   - active watch duration;
   - `stream_view_3_seconds`, `stream_view_10_seconds`, `stream_view_30_seconds`;
   - `stream_view_ended`;
   - `stream_skipped` under 3 seconds.
5. Expand `streamStats` from those real events.

Only after this is validated should Gear, follow, share, Explore, Globe, Profile, creator/category/user aggregates, scores, and `/admin/analytics` be added.
