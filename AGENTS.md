# Vuvio — Agent Instructions

Vuvio is a mobile-first POV live streaming app. React 19 / Vite 6 / React Router v6, deployed on Firebase Hosting + Cloud Functions (Node 20).

## Stack

- Frontend: React 19, Vite 6, React Router v6, i18next
- Backend: Firebase Cloud Functions v2 on Node 20 (TypeScript, compiled to `functions/lib/`)
- Database: Firestore (`activeLives`, `users` collections)
- Video: Cloudflare Stream (WHIP ingest, HLS playback; recording/replay path must be verified before replay changes)
- Storage: Firebase Storage (mock/demo videos at `storage.googleapis.com/vuvio-bf328.firebasestorage.app/`)
- Auth: Firebase Auth (email/password + Google popup)

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # Production build — always run after changes to verify
firebase deploy --only hosting          # Deploy frontend
firebase deploy --only functions        # Deploy backend
```

**Always run `npm run build` before reporting a task done.** Errors only surface at build time.

## Critical rules — do NOT break these

### Live viewer playback (WatchPage.jsx)
- **HLS is the primary viewer path.** Cloudflare WHEP only supports 1 simultaneous viewer per live input (WebRTC 1-to-1 limit). The WHEP viewer useEffect is intentionally disabled with `if (true || ...)`.
- The HLS condition must NOT have `|| live?.whepUrl` — that would skip HLS when WHEP URL exists, breaking multi-viewer.
- Viewer priority: HLS (primary, unlimited viewers) → P2P WebRTC (final fallback).

### Explore → Watch navigation (WatchPage.jsx `liveFeed` useMemo)
- When `liveId` comes from URL (`?live=ID`), that stream must be placed at index 0 of `liveFeed`. Never remove this "move to front" logic.
- Without it: wrong stream plays first, analytics spam, AbortError on video.

### Replay / Firestore cleanup
- **Never call `deleteLiveFromDB(live.id)` inside `endLive`** in WatchPage.jsx or anywhere in the end-live flow.
- The `activeLives/{liveId}` document must persist after the live ends so the replay polling backend can read `cloudflareLiveInputId`.
- Document cleanup is handled server-side by `checkStreamHeartbeats` Cloud Function only.

### Functions dependencies
- Any new `import` of a third-party package in `functions/src/` must be added to `functions/package.json` dependencies.
- Cloud Run builds from `package.json` — locally installed packages are invisible to the deployed container.

### Mock video URLs
- All mock/demo video and thumbnail URLs use Firebase Storage (GCS direct URL format: `https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/...`).
- Centralized in `src/data/mockVideoUrls.js` — do not hardcode storage URLs elsewhere.
- The `public/assets/videos/` and `public/assets/mockups/` directories contain large files excluded from the production build via `vite.config.js` `excludedPublicPatterns`. Do not remove those exclusions.

### Google Sign-In
- Always uses `signInWithPopup` — never `signInWithRedirect`. Redirect flow was causing users to always land back on `/login` after Google auth.

### Splash screen
- Only `SplashScreen.jsx` is used on app load (shown on `/` for 6s via `showSplash` in AuthContext).
- `MobileLandingScreen` has been removed from `AppShell`. Do not add it back.

## Architecture notes

### Live streaming chain
1. Broadcaster → WHIP (`webRTC.url` from Cloudflare) → Cloudflare ingests
2. `createLiveInputHandler` stores `whepUrl`, `hlsManifestUrl`, `cloudflareLiveInputId` in Firestore `activeLives/{streamId}`
3. Viewers → HLS (`hlsManifestUrl`) via Cloudflare CDN — unlimited concurrent viewers
4. Replay: keep `activeLives/{liveId}` available after live end so backend replay/highlight jobs can read `cloudflareLiveInputId`; current recording availability must be verified against the active Cloudflare ingest path before changing replay behavior.

### Explore feed (DiscoverFeedPage.jsx)
- Real Firestore lives (`createdLives`) are pinned to the top of the feed, sorted by `startedAt` descending.
- Mock streams fill the rest of the feed via `weightedDiscoverStreams`.

### Auth flow
- `PublicOnlyRoute` redirects authenticated users to `/watch`.
- `ProtectedRoute` redirects unauthenticated users to `/login` with `state.returnTo`.
- After Google popup login, `LoginPage` navigates to `returnTo` (defaults to `/watch`).

## Code style
- No comments unless absolutely necessary (WHY only, never WHAT).
- No trailing summaries or explanation blocks.
- Prefer editing existing files over creating new ones.
