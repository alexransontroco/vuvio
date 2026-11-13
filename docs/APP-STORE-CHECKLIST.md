# App Store Checklist

## Account And Build

- [ ] Apple Developer account active.
- [ ] Bundle ID created: `app.vuvio.mobile`.
- [ ] App Store Connect app created.
- [ ] Xcode project generated after CocoaPods/SPM environment is ready.
- [ ] Signing team selected in Xcode.
- [ ] TestFlight build uploaded.

## Store Listing

- [ ] App name: Vuvio.
- [ ] Subtitle and description.
- [ ] Keywords.
- [ ] Category.
- [ ] Privacy Policy URL.
- [ ] Support URL.
- [ ] Marketing URL if available.
- [ ] App screenshots for required iPhone sizes.
- [ ] App icon from official Vuvio logo asset.
- [ ] Age rating.

## Permissions

- [ ] Camera usage description.
- [ ] Microphone usage description.
- [ ] Push notification purpose.
- [ ] Any location usage declared only if enabled.

## Auth

- [ ] Email/password tested.
- [ ] Google sign-in tested on iOS WebView.
- [ ] Sign in with Apple available if Apple requires it due third-party login providers.
- [ ] No Apple secrets in frontend.

## UGC And Live Content

- [ ] Report content exists and works.
- [ ] Report user exists and works.
- [ ] Block user exists and works.
- [ ] Moderation process documented.
- [ ] Community Guidelines available.
- [ ] Terms available.
- [ ] Privacy policy available.
- [ ] Contact/support path available.
- [ ] Account deletion available in-app or clearly linked.
- [ ] Review notes include live/UGC moderation explanation.
- [ ] Test account provided if login is required for review.

## Blockers Before Review

- iOS project generation is blocked on missing CocoaPods in this environment.
- Real Apple Team ID is required for Universal Links.
- Real Privacy Policy and Support URLs must be confirmed.
- Native Google/Apple auth behavior must be tested on device.
- UGC moderation/report/block/account deletion must be confirmed against App Store rules.

