# Vuvio Stream Backend Lifecycle

## Architecture

Backend V1 uses Firebase Cloud Functions 2nd gen with TypeScript.

Entry points:

- `api`: HTTP API mounted behind `/api/**`.
- `checkStreamHeartbeats`: scheduled function running every minute.

The existing frontend WebRTC prototype using `activeLives` remains in place. The new production-oriented lifecycle uses the `streams` collection.

## Collections

- `streams`
- `streams/{streamId}/events`
- `gear`
- `streamStats`
- `webhookEvents`
- existing `users`

## Status Flow

```txt
draft
  ↓
preparing
  ↓
connecting
  ↓
live
  ↔ reconnecting
  ↓
ending
  ↓
completed
```

V1 may go directly from `live` or `reconnecting` to `completed` because post-live video processing is not implemented yet.

## Routes

- `POST /api/streams`
- `GET /api/streams/:streamId`
- `GET /api/streams/live`
- `GET /api/globe/streams`
- `POST /api/streams/:streamId/start`
- `POST /api/streams/:streamId/heartbeat`
- `POST /api/streams/:streamId/end`
- `POST /api/streams/:streamId/gear`
- `GET /api/streams/:streamId/gear`
- `POST /api/streams/:streamId/events`
- `POST /api/webhooks/cloudflare`

## Authentication

Sensitive routes require:

```txt
Authorization: Bearer <Firebase ID token>
```

The backend derives `creatorId` from the verified Firebase token. It never trusts a frontend-provided creator id.

## Cloudflare Configuration

Secrets required in Firebase Functions:

```txt
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_WEBHOOK_SECRET
CLOUDFLARE_CUSTOMER_CODE
```

When Cloudflare account id/token are absent, the backend creates the Firestore stream but returns null ingest/playback fields. This is intentional for local development and makes the missing manual configuration explicit.

## Local Testing

Install function dependencies first:

```txt
cd functions
npm install
npm run build
npm run test
```

Run the frontend:

```txt
npm run dev
```

Open the private internal page:

```txt
/internal/streams
```

## Deployment

Configure secrets:

```txt
firebase functions:secrets:set CLOUDFLARE_ACCOUNT_ID
firebase functions:secrets:set CLOUDFLARE_API_TOKEN
firebase functions:secrets:set CLOUDFLARE_WEBHOOK_SECRET
firebase functions:secrets:set CLOUDFLARE_CUSTOMER_CODE
```

Deploy:

```txt
firebase deploy --only functions,firestore:rules,firestore:indexes,hosting
```

## Current Limits

- No AI highlights.
- No replay processing.
- No sponsorship automation.
- No payments.
- Cloudflare webhook event names are isolated but may need adjustment against the final Cloudflare Stream webhook payload used in production.
- The public app still uses the existing `activeLives` prototype until the new backend flow is connected to the main create-live UI.

## Next Steps

- Migrate equipment from localStorage/profile documents into `gear`.
- Replace direct `activeLives` creation in `BottomNav` with `createStream`.
- Connect Cloudflare ingest credentials to the broadcaster experience.
- Add emulator-backed integration tests for Firestore transactions.
- Add stricter admin role gating for `/internal/streams` once roles are finalized.
