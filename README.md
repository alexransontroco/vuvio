# Vuvio

Vuvio is a mobile-first POV live streaming app for outdoor, adventure, craft, and field-based creators.

The product centers discovery around location-first live streams, creator profiles, replay/recap flows, and creator equipment/gear as a community and monetization layer.

## Current Stack

- Frontend: React 19, Vite 6, React Router v6, i18next
- Backend: Firebase Cloud Functions v2, Node.js 20, TypeScript
- Hosting: Firebase Hosting, project `vuvio-bf328`
- Database: Firestore
- Auth: Firebase Auth, email/password and Google popup
- Video: Cloudflare Stream, WHIP ingest and HLS playback
- Storage: Firebase Storage for mock/demo video assets

## Commands

```bash
npm run dev
npm run dev:replay
npm run build
firebase deploy --only hosting
firebase deploy --only functions
```

Always run `npm run build` before considering changes complete.

`npm run dev:replay` starts the local HTTPS RTMPS relay and Vite dev server for replay validation. Open `/watch?relayLocal=1` from the HTTPS dev URL.

## Replay Relay

Local replay validation uses:

```txt
https://<dev-host>:5173/watch?relayLocal=1
https://<dev-host>:8787
```

The Cloud Run relay URL is not a production-ready browser WebRTC relay target for this flow. A production relay needs a network path that supports WebRTC ICE media, such as a VM with a public IP and required UDP ports open, or a validated TURN-backed strategy.

## Documentation Map

- [AGENTS.md](AGENTS.md) — critical engineering rules for coding agents.
- [journal.architecture.md](journal.architecture.md) — source of truth for product context, architecture, decisions, and open questions.
- [docs/README.md](docs/README.md) — index for technical docs, domain guides, and historical implementation notes.
- [agents/README.md](agents/README.md) — market and creator-prospection strategy agents.

## Non-Negotiable Rules

- Viewer playback uses HLS first. Do not prioritize WHEP for multiple viewers.
- Keep `?live=ID` streams first in the Watch feed.
- Do not delete `activeLives/{liveId}` inside the end-live flow.
- Keep mock video URLs centralized in `src/data/mockVideoUrls.js`.
- Google Sign-In uses popup, not redirect.
- App UI text should remain English.
