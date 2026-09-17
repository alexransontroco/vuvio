# Backend Docs

Backend, Firestore, messaging, and stream lifecycle references.

Status: Current index  
Last reviewed: 2026-09-05  
Read before coding: Yes, for Cloud Functions, Firestore, stream lifecycle, or messaging changes.

## Current Reality

- Functions run on Node.js 20.
- TypeScript source lives in `functions/src/`; compiled output lives in `functions/lib/`.
- New third-party imports in `functions/src/` must be added to `functions/package.json`.
- Firestore live documents are part of the replay/cleanup lifecycle and must not be removed from client end-live code.

## Do Not Regress

- Do not rely on packages installed locally but missing from `functions/package.json`.
- Do not move backend source-of-truth logic into compiled `functions/lib/`.
- Do not weaken admin-only access for analytics or stream stats.
- Do not make client cleanup responsible for deleting live documents that backend jobs still need.

## Start Here

- [backend-stream-lifecycle.md](backend-stream-lifecycle.md) — stream lifecycle behavior.
- [backend-audit.md](backend-audit.md) — backend audit notes.
- [firestore-stream-rules.md](firestore-stream-rules.md) — Firestore stream rules.
- [messaging-firestore.md](messaging-firestore.md) — messaging data model.

## Before Done

- `npm run build` passes for frontend-impacting changes.
- Function dependencies are declared in `functions/package.json`.
- Firestore paths and required indexes are documented when changed.
- Deployment-sensitive secrets remain in Firebase Secret Manager or environment configuration, not source files.
