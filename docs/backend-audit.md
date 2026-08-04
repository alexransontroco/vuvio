# Vuvio Backend Audit

Date: 2026-07-29

## Current Architecture

- Frontend: React + Vite single page app.
- Firebase client SDK is initialized in `src/firebase.js`.
- Firebase Authentication is handled in `src/context/AuthContext.jsx` and `src/services/authService.js`.
- Firestore is used directly from the frontend for user profiles, usernames, and current live signaling.
- Hosting is configured in `firebase.json`.
- Firestore rules are configured in `firestore.rules`.
- Storage rules are configured in `storage.rules`.
- No `functions/` directory existed before this backend work.
- No `firestore.indexes.json` existed before this backend work.

## Existing Collections Observed

- `users`
- `usernames`
- `activeLives`
- `activeLives/{liveId}/watchers`

Additional local-only data is stored in `localStorage`, notably equipment and created live drafts.

## Current Live System

Important files:

- `src/components/BottomNav.jsx`
- `src/services/createdLiveService.js`
- `src/services/webrtcService.js`
- `src/routes/HomePage.jsx`
- `src/routes/LivePage.jsx`
- `src/routes/CurrentGlobePage.jsx`
- `src/routes/MapPage.jsx`
- `src/services/equipmentService.js`

The current live flow creates local/live documents in `activeLives`, then uses WebRTC signaling through Firestore fields and the `watchers` subcollection. This is useful for the current product prototype and is not removed by this backend V1.

## Firebase Configuration

- Project ID in `.firebaserc`: `vuvio-bf328`.
- `firebase.json` had Firestore rules, Storage rules, and Hosting only.
- Firebase Functions were not configured before this work.
- Firebase config values are read from `VITE_FIREBASE_*` variables in `src/firebase.js`.

## Cloudflare Stream

- No Cloudflare Stream backend integration was present.
- No frontend calls to Cloudflare Stream were found.
- No `liveInput`, `m3u8`, `manifest`, or Cloudflare API token usage was found in `src/`.
- `.env.local` variable names were inspected with values redacted. No `VITE_CLOUDFLARE_*` variable was present.
- No Cloudflare secret was found exposed in frontend environment names.

## Problems Detected

- Live lifecycle writes currently happen directly from frontend clients to `activeLives`.
- WebRTC signaling data is stored in public-readable `activeLives`.
- The current live status model is limited to `live` and `ended`.
- Equipment is primarily localStorage/profile data and not yet a secure server-owned `gear` collection.
- No backend validates creator identity for stream creation/start/end.
- No backend approximates GPS coordinates before public exposure.
- No Cloudflare webhook verification or idempotency exists.
- No stream analytics aggregation exists.
- Firestore rules allow authenticated owners to update broad `activeLives` fields directly.

## Technical Choices Retained

- Add Firebase Cloud Functions 2nd gen with TypeScript.
- Keep the existing `activeLives` prototype untouched for compatibility.
- Introduce new backend-owned collections:
  - `streams`
  - `streams/{streamId}/events`
  - `gear`
  - `streamStats`
  - `webhookEvents`
- Use Firebase Auth ID tokens for all sensitive endpoints.
- Never trust `creatorId` sent by the frontend.
- Use a centralized Cloudflare client interface with a safe mock mode when secrets are absent.
- Store only approximate public coordinates.
- Add a private internal page to test and understand the stream lifecycle without redesigning public screens.

## Migrations Needed

- Migrate creator equipment from profile/localStorage into the `gear` collection.
- Move production live creation from `activeLives` to backend `streams` once Cloudflare Stream is configured.
- Update Watch/Explore/Globe to read backend stream lists after the V1 API is deployed and verified.
- Tighten or deprecate direct client writes to `activeLives` after the old WebRTC prototype is no longer needed.
