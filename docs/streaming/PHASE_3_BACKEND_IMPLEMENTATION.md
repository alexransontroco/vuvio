# Phase 3: Real Highlight Generation — Backend Spec

Status: Backend implementation guide, requires current-code verification  
Last reviewed: 2026-09-18  
Read before coding: Yes, for highlight API work.

> Confirm the current Cloudflare recording/replay path before assuming automatic recording is available. Keep `activeLives/{liveId}` available after live end so jobs can read stream metadata.

Do not regress:
- Deployed functions need all dependencies in `functions/package.json`.
- Highlight generation must not depend on client-side deletion timing.
- Creator-only endpoints must not be accessible to unauthorized users.

---

## Frontend Status

- Detects if backend API is available (falls back to mock mode if not)
- Polls for highlight generation status
- Passes moment markers to backend

---

## Required Backend Endpoints

### `POST /api/lives/:liveId/highlight`

Auth: Firebase Auth required.

```json
// Request
{ "useCreatorMarkers": true, "customSegments": null }

// Response
{ "jobId": "job-{liveId}-{timestamp}", "status": "queued" }
```

Errors: 401 (unauthenticated), 403 (not creator), 404 (not found), 409 (already in progress), 422 (too short <60s), 500.

---

### `GET /api/lives/:liveId/highlight-status?jobId={jobId}`

Auth: Firebase Auth required.

```json
// Processing
{ "status": "processing", "progress": 45 }

// Ready
{ "status": "ready", "url": "...", "thumbnailUrl": "...", "durationSeconds": 30 }

// Failed
{ "status": "failed", "error": "Recording not found" }
```

---

### `DELETE /api/lives/:liveId/highlight/:jobId`
Returns `{ "status": "cancelled" }`.

### `GET /api/highlight-config`
Returns `{ "available": true, "version": "1.0" }` or HTTP 503.

---

## Implementation Steps

### 1. Cloudflare recording lookup

```javascript
const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${recordingId}`,
  { headers: { 'Authorization': `Bearer ${CLOUDFLARE_TOKEN}` } }
);
```

### 2. Segment selection

```javascript
function getSegmentsToExtract(durationSeconds, markers) {
  if (markers?.length > 0) {
    return markers.map(m => ({ start: m.timestamp - 15, duration: 30 }));
  }
  return [
    { start: 30, duration: 60 },
    { start: durationSeconds * 0.4, duration: 60 },
    { start: Math.max(0, durationSeconds - 90), duration: 90 },
  ];
}
```

### 3. Clip creation (Cloudflare Clip API)

```javascript
await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${recordingId}/clip`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clippingStartTimeSeconds: start, clippingEndTimeSeconds: start + duration }),
  }
);
```

### 4. Clip assembly (FFmpeg)

```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -i clip3.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.5:offset=9.5[a][2]xfade=transition=fade:duration=0.5:offset=19.5[v]" \
  -map "[v]" -map "0:a" output.mp4
```

### 5. Firestore update when ready

```javascript
await updateDoc(doc(db, 'activeLives', liveId), {
  highlightStatus: 'ready',
  highlightUrl: clipUrl,
  highlightThumbnailUrl: thumbnailUrl,
  highlightDurationSeconds: 30,
  recordingStatus: 'available',
  recordingExpiresAt: Timestamp.fromDate(expiryDate),
});
```

---

## Timeouts & Limits

- Total generation: 20 min max
- Per-clip extraction: 5 min
- Assembly: 10 min
- Don't process lives >24h
- Max 5 concurrent jobs per account

---

## Error Cases

| Scenario | Response |
|---|---|
| Live not found | 404 |
| Recording still processing | 503 |
| Recording expired | 410 |
| User not creator | 403 |
| Generation failed | 500 + update Firestore `highlightStatus: 'failed'` |

---

## References

- Cloudflare Stream API: https://developers.cloudflare.com/stream/api-reference/
- Clip API: https://developers.cloudflare.com/stream/clip-api/
- Recording: https://developers.cloudflare.com/stream/recording/
