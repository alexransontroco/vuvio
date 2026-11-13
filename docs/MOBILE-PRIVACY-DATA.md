# Mobile Privacy Data Map

This is an implementation map, not a legal privacy policy.

## Account

- Data: email, display name, username, profile photo URL, auth provider.
- Reason: login, creator identity, profile display.
- Storage: Firebase Auth and Firestore `users`.
- Features: auth, profile, social graph, notifications.

## Profile

- Data: bio, city/country/location label if user enters it, activities, equipment, followed creators.
- Reason: public creator profile and discovery.
- Storage: Firestore `users` and related app collections.
- Features: profiles, discovery, follows, SEO/public pages.

## Camera And Microphone

- Data: live camera and microphone stream.
- Reason: broadcast live activities.
- Storage: sent to Cloudflare Stream during live; replay availability depends on active recording path.
- Features: Start Live, live preview, live streaming.

## Video And Replay

- Data: live metadata, HLS/WHIP/WHEP URLs, replay URLs if available, thumbnails if generated.
- Reason: live playback, replay, sharing.
- Storage: Firestore `activeLives` and Cloudflare Stream.
- Features: watch, live, replay, sharing.

## Messages And Notifications

- Data: conversation messages, notification records, followed creator notifications.
- Reason: user communication and live alerts.
- Storage: Firestore app collections.
- Features: messages, notifications, followed creator alerts.

## Push Device Token

- Data: APNs/FCM device token.
- Reason: send live/replay alerts.
- Storage: not wired yet; should be stored in a user/device token collection after explicit permission.
- Features: native push notifications.

## Analytics

- Data: app events and platform marker `web`, `ios`, or `android` where implemented.
- Reason: product analytics and reliability.
- Storage: existing analytics service / backend path.
- Features: usage analytics, creator stats.

## Location

- Data: manual profile/live location labels and reverse geocoding from coordinates where user chooses location-based flows.
- Reason: live context, discovery, maps.
- Storage: Firestore live/profile metadata.
- Features: map, discovery, live cards.

## Sensitive Handling Notes

- Do not log passwords, auth tokens, push tokens, Cloudflare secrets or Firebase secrets.
- Push permission must be contextual.
- Camera/micro permission must be requested only when starting preview/live.
- Account deletion and content deletion flow must be finalized before store submission.

