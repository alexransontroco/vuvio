# Vuvio Mobile Setup

## Requirements

- Node 20 or newer for Capacitor commands.
- Xcode for iOS.
- CocoaPods for iOS Capacitor project generation/sync unless the project is later moved fully to SPM.
- Android Studio for Android.
- Firebase project configuration for web and native apps.
- Apple Developer and Google Play accounts for store distribution.

## Install

```bash
npm install
```

## Web

```bash
npm run dev
npm run build
```

## Mobile Build And Sync

```bash
npm run mobile:build
```

Equivalent:

```bash
npm run build
npx cap sync
```

If the shell still uses Node 18, run Capacitor with Node 20:

```bash
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap sync
```

## iOS

```bash
brew install cocoapods
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap add ios
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap sync ios
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap open ios
```

Required iOS values after project generation:

- Bundle ID: `app.vuvio.mobile`
- Associated Domains: `applinks:vuvio.app`
- Camera usage text: `Vuvio uses your camera so you can broadcast live activities.`
- Microphone usage text: `Vuvio uses your microphone so viewers can hear your live broadcast.`

## Android

```bash
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap sync android
PATH=/Users/alexandreranson/.nvm/versions/node/v20.20.2/bin:$PATH npx cap open android
```

Android package name:

```text
app.vuvio.mobile
```

## Deep Links

Configured native target:

```text
https://vuvio.app
```

Routing is centralized in `src/platform/deepLinks.js`.

Examples:

- `https://vuvio.app/share/live/abc` -> `/watch?live=abc&mode=view`
- `https://vuvio.app/live/abc` -> `/watch?live=abc&mode=view`
- `https://vuvio.app/@alexandre` -> `/@alexandre`

Production association files still require real store identifiers:

- Apple: `docs/mobile/apple-app-site-association.template.json`
- Android: `docs/mobile/assetlinks.template.json`

## Push Notifications

Base implementation:

- `src/platform/notifications.js`
- Permission request is explicit through `requestPushNotifications()`.
- Notification tap routing supports `live`, `replay`, and `profile` payloads.

Still needed:

- Firebase native app setup.
- `google-services.json` for Android.
- APNs key/capability for iOS.
- Store push token in a Firestore user/device collection.
- Remove token on logout if desired.

## Manual Test Checklist

AUTH

- [ ] Signup
- [ ] Login
- [ ] Logout
- [ ] Google
- [ ] Apple if enabled later
- [ ] Facebook if enabled later

WATCH

- [ ] Live loading
- [ ] Swipe
- [ ] Audio
- [ ] Fullscreen
- [ ] Profile open

LIVE

- [ ] Camera permission
- [ ] Microphone permission
- [ ] Rear camera
- [ ] Front camera
- [ ] Preview
- [ ] Thumbnail
- [ ] Start live
- [ ] Stop live
- [ ] Network loss
- [ ] App background

SHARE

- [ ] Profile
- [ ] Live
- [ ] Replay
- [ ] Native share sheet

DEEPLINK

- [ ] Live
- [ ] Profile
- [ ] App closed
- [ ] App already open

PUSH

- [ ] Permission prompt
- [ ] Token registration
- [ ] Tap notification

UI

- [ ] Safe areas
- [ ] Keyboard
- [ ] Android back
- [ ] Dark/light theme

