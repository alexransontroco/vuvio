# Google Play Checklist

## Account And Build

- [ ] Google Play Console account active.
- [ ] Package name confirmed: `app.vuvio.mobile`.
- [ ] Android project opens in Android Studio.
- [ ] Internal testing track configured.
- [ ] Release signing configured.
- [ ] Production signing key SHA-256 captured for App Links.

## Store Listing

- [ ] App name: Vuvio.
- [ ] Short description.
- [ ] Full description.
- [ ] Screenshots.
- [ ] App icon.
- [ ] Feature graphic if needed.
- [ ] Category.
- [ ] Content rating questionnaire.
- [ ] Privacy Policy URL.

## Permissions And Data Safety

- [ ] Camera declared.
- [ ] Microphone declared.
- [ ] Notifications declared.
- [ ] Data Safety completed for account/profile/video/messages/analytics/push token.
- [ ] No unnecessary storage permission.

## UGC And Live Content

- [ ] Report content.
- [ ] Report user.
- [ ] Block user.
- [ ] Moderation.
- [ ] Community Guidelines.
- [ ] Terms.
- [ ] Contact/support.
- [ ] Account deletion.

## Blockers Before Production

- Android App Links need real SHA-256 in `assetlinks.json`.
- Play Console app and signing are not configured in this repo.
- Device tests required for camera/micro/WHIP/HLS.
- Push needs Firebase native setup and `google-services.json`.
- UGC moderation and account deletion must be verified before public launch.

