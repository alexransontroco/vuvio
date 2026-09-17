# Streaming Docs

Live streaming, post-live summary, replay, and backend streaming implementation notes.

Status: Current index  
Last reviewed: 2026-09-05  
Read before coding: Yes, for any live, replay, watch, Cloudflare, or highlight change.

## Current Reality

- Creator ingest currently uses Cloudflare WHIP.
- Viewer playback must use HLS first.
- WHEP is not suitable as the primary multi-viewer path because Cloudflare live inputs are 1-to-1 for WHEP viewing.
- The RTMPS relay was reverted and should be treated as historical unless a new replay-recording decision explicitly reintroduces it.
- Replay/highlight behavior depends on preserving `activeLives/{liveId}` after the live ends.

## Do Not Regress

- Do not make WHEP the primary viewer path.
- Do not add `|| live?.whepUrl` to the HLS playback condition.
- Do not delete live documents from the end-live flow.
- Do not remove the `?live=ID` move-to-front behavior in Watch.
- Do not assume automatic replay is available unless the current Cloudflare recording path has been validated.

## Start Here

- [../backend/backend-stream-lifecycle.md](../backend/backend-stream-lifecycle.md) — current stream lifecycle reference.
- [LIVE_SUMMARY_IMPLEMENTATION.md](LIVE_SUMMARY_IMPLEMENTATION.md) — live summary and highlight feature notes.
- [PHASE_3_BACKEND_IMPLEMENTATION.md](PHASE_3_BACKEND_IMPLEMENTATION.md) — backend implementation notes.
- [ai-post-live-analysis.md](ai-post-live-analysis.md) — post-live AI analysis.

## Before Done

- `npm run build` passes.
- A live opened from Explore or Globe plays the selected stream first.
- HLS playback still works when `whepUrl` exists.
- Ending a live leaves the Firestore live document available for replay polling.
