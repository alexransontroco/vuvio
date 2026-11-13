# Vuvio Mobile App Audit

Date: 2026-10-06

## Existing Web App

Vuvio is a React 19 / Vite 6 SPA hosted from `dist` through Firebase Hosting. The web app stays intact: `npm run dev`, `npm run build`, Firebase Hosting rewrites, routing, auth and streaming are not replaced.

Current public/native-relevant pieces:

- Routing: React Router v6 in `src/App.jsx`, with app shell, watch, live, profile, auth, settings, notifications and legal routes.
- Firebase: initialized in `src/firebase.js` from `VITE_FIREBASE_*` environment variables.
- Auth: email/password and Google popup live in `src/services/authService.js`.
- Camera/micro: `navigator.mediaDevices.getUserMedia` is used in `src/components/BottomNav.jsx`, `src/services/webrtcService.js`, `src/routes/MapPage.jsx`.
- Streaming: Cloudflare WHIP/HLS/WHEP paths live mainly in `src/routes/WatchPage.jsx` and `src/services/webrtcService.js`. HLS remains the primary viewer path.
- Sharing: existing Web Share / copy logic lives in `src/services/shareService.js` and is now routed through `src/platform/sharing.js`.
- PWA: `public/manifest.webmanifest` and `public/sw.js` exist. Service worker remains web-only.
- Notifications: in-app Firestore notification hooks exist; native push now has a Capacitor foundation in `src/platform/notifications.js`.
- Assets: usable logo/icon assets exist under `public/assets/brand/`, `public/assets/logo/`, and `public/assets/icons/`.

## What Can Be Kept

- React/Vite UI and routing.
- Firebase client initialization.
- Firestore data model.
- Cloudflare Stream / WHIP / HLS logic.
- Existing auth screens and email/password auth.
- Existing profile/watch/explore/globe visual identity.
- Web deployment at `https://vuvio.app`.

## Capacitor Adaptations Added

- Capacitor config: `capacitor.config.ts`.
- Android project: `android/`.
- Native wrapper uses embedded `dist` assets, not `https://vuvio.app` as `server.url`.
- NPM scripts for mobile build/sync/open.
- Central platform layer in `src/platform/`.
- Native share sheet fallback for iOS/Android.
- Deep link route conversion for `https://vuvio.app`.
- App lifecycle/network/push listener foundations.
- Android permissions for camera, microphone, network and push.
- Android App Link intent-filter for `https://vuvio.app`.
- Service worker disabled inside Capacitor native runtime.

## iOS Status

The iOS project could not be generated in this environment because Capacitor checks for CocoaPods before creating `ios/`, and CocoaPods is not installed. Homebrew installation failed with a Homebrew API 404 on this machine, and user-local Ruby gem installation was blocked by sandbox permissions.

Required next local step:

```bash
brew install cocoapods
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap add ios
```

After generation, add:

- `NSCameraUsageDescription`: `Vuvio uses your camera so you can broadcast live activities.`
- `NSMicrophoneUsageDescription`: `Vuvio uses your microphone so viewers can hear your live broadcast.`
- Associated Domains: `applinks:vuvio.app`

## Android Status

Android was generated successfully with package/application ID `app.vuvio.mobile`.

Added permissions:

- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.POST_NOTIFICATIONS`

Added App Links intent-filter:

- `https://vuvio.app`

## Key Risks

- Google OAuth popup inside a native WebView must be tested on device. Email/password is expected to be lower risk.
- Cloudflare WHIP from iOS WKWebView and Android WebView must be tested on physical devices for codec, camera switching, backgrounding and network interruptions.
- iOS will suspend camera/network work when the app backgrounds; Vuvio must not promise background streaming.
- Push token storage is scaffolded but not wired to Firestore user documents yet.
- Universal/App Links require production association files with real Apple Team ID and Android signing SHA-256.
- App Store / Google Play UGC requirements need final moderation/account-deletion review before store submission.

## Differences Web / iOS / Android

- Web uses browser share/service worker/PWA behavior.
- Native uses Capacitor Share, App, Network, Push, Keyboard, Haptics, Status Bar and Splash Screen plugins.
- Native shares must always publish `https://vuvio.app/...`, never `capacitor://...`.
- Native camera/micro permissions require store-facing usage descriptions.
- Native push must request permission contextually, not at first launch.

