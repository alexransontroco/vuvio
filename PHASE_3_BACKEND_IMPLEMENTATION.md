# Phase 3: Real Highlight Generation - Backend Implementation Guide

## Overview
Phase 3 infrastructure is ready. Frontend now:
- ✅ Detects if backend API is available
- ✅ Falls back to mock mode if not
- ✅ Polls for highlight generation status
- ✅ Passes moment markers to backend

This document specifies what the backend needs to implement.

---

## Required Backend Endpoints

### POST `/api/lives/:liveId/highlight`

**Purpose**: Queue a highlight generation job

**Authentication**: Firebase Auth required (`Authorization: Bearer <idToken>`)

**Request Body**:
```json
{
  "useCreatorMarkers": true,
  "customSegments": null
}
```

**Response**:
```json
{
  "jobId": "job-{liveId}-{timestamp}",
  "status": "queued"
}
```

**Error Handling**:
- 401: Not authenticated
- 403: User not creator of this live
- 404: Live not found
- 409: Generation already in progress
- 422: Live too short (<60 seconds)
- 500: Server error

---

### GET `/api/lives/:liveId/highlight-status?jobId={jobId}`

**Purpose**: Poll job status

**Authentication**: Firebase Auth required

**Response** (when processing):
```json
{
  "status": "processing",
  "progress": 45
}
```

**Response** (when ready):
```json
{
  "status": "ready",
  "url": "https://vcdn.cloudflare.com/...",
  "thumbnailUrl": "https://...",
  "durationSeconds": 30
}
```

**Response** (when failed):
```json
{
  "status": "failed",
  "error": "Recording not found"
}
```

---

### DELETE `/api/lives/:liveId/highlight/:jobId`

**Purpose**: Cancel job

**Authentication**: Firebase Auth required

**Response**:
```json
{
  "status": "cancelled"
}
```

---

### GET `/api/highlight-config`

**Purpose**: Test if highlight API is ready

**Response** (if ready):
```json
{
  "available": true,
  "version": "1.0"
}
```

**Response** (if not ready):
- HTTP 503 or return `{ "available": false }`

---

## Implementation Checklist

### 1. Cloudflare Stream Integration

- [ ] Get Cloudflare Stream API credentials (account token)
- [ ] Store credentials securely (env vars, not git)
- [ ] Implement recording lookup by `liveInputId`

```javascript
// Pseudo-code
async function getCloudflareRecording(recordingId) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${recordingId}`,
    {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`
      }
    }
  );
  return response.json();
}
```

### 2. Moment Extraction

- [ ] Load `highlightMarkers[]` from Firestore
- [ ] If markers exist, use them to guide extraction
- [ ] Otherwise use default rule-based selection:
  - Opening: 30-90 seconds
  - Peak: ~40% into stream
  - Closing: Last 60 seconds

```javascript
// Pseudo-code
function getSegmentsToExtract(durationSeconds, markers) {
  if (markers?.length > 0) {
    // Use creator markers
    return markers.map(m => ({
      start: m.timestamp - 15,
      duration: 30,
    }));
  }

  // Default rule-based
  return [
    { start: 30, duration: 60 },     // Opening
    { start: durationSeconds * 0.4, duration: 60 }, // Peak
    { start: Math.max(0, durationSeconds - 90), duration: 90 }, // Closing
  ];
}
```

### 3. Clip Creation (Cloudflare Clip API)

- [ ] Use Cloudflare Clip API to extract segments

```javascript
// Pseudo-code
async function createClip(recordingId, startSecond, durationSeconds) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/${recordingId}/clip`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clippingStartTimeSeconds: startSecond,
        clippingEndTimeSeconds: startSecond + durationSeconds,
      }),
    }
  );
  return response.json();
}
```

### 4. Clip Assembly

- [ ] Combine 2-3 clips with simple transitions
- [ ] Options:
  - Use FFmpeg server-side
  - Use Cloudflare Stream's native clip concatenation (if available)
  - Queue through video processing service

```bash
# Pseudo FFmpeg command
ffmpeg \
  -i clip1.mp4 \
  -i clip2.mp4 \
  -i clip3.mp4 \
  -filter_complex "[0][1]xfade=transition=fade:duration=0.5:offset=9.5[a][2]xfade=transition=fade:duration=0.5:offset=19.5[v]" \
  -map "[v]" \
  -map "0:a" \
  output.mp4
```

### 5. Job Management

- [ ] Implement job queue (Redis, database, or in-memory)
- [ ] Track state: `queued → processing → ready | failed`
- [ ] Prevent duplicate jobs (idempotency)
- [ ] Store job metadata:
  ```json
  {
    "jobId": "...",
    "liveId": "...",
    "createdAt": "2026-08-02T...",
    "status": "processing",
    "progress": 30,
    "resultUrl": null,
    "error": null
  }
  ```

### 6. Output Storage

- [ ] Store generated clips permanently or for limited time
- [ ] Options:
  - Cloudflare Stream (automatic hosting)
  - AWS S3 / Backblaze B2
  - Own CDN
- [ ] Generate signed/public URLs
- [ ] Set expiration (e.g., 30 days)

### 7. Firestore Updates

- [ ] After clip is ready, update live document:
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

## Error Scenarios to Handle

### Live Not Found
- Live deleted before generation started
- Response: 404 + "Live not found"

### Recording Not Available
- Cloudflare recording still processing
- Response: 503 + "Recording still being prepared"

### Recording Expired
- Automatic cleanup deleted recording
- Response: 410 + "Recording no longer available"

### Generation Failed
- FFmpeg error, clip API error, etc.
- Response: 500 + detailed error message
- Update Firestore: `highlightStatus: 'failed'`

### Unauthorized
- User not creator of live
- Response: 403 + "You are not the creator"

---

## Performance Considerations

### Timeouts
- Total generation: **20 minutes max** (frontend times out after this)
- Per-clip extraction: **5 minutes**
- Assembly: **10 minutes**

### Resource Limits
- Don't process lives >24 hours long
- Limit concurrent jobs per account (e.g., 5)
- Use queue backpressure if overloaded

### Caching
- Cache `recordingAvailable` check (1 min)
- Don't retry failed clips immediately
- Cache thumbnails for 7 days

---

## Development Testing

### Mock Response (for frontend testing)

Return this when feature flag disabled:

```json
{
  "url": "https://example.com/sample-highlight.mp4",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "durationSeconds": 30
}
```

### Local Development

1. Set up Cloudflare Stream test account
2. Create test recording
3. Test clip extraction
4. Test assembly
5. Verify Firestore updates

---

## Deployment Checklist

- [ ] Cloudflare credentials secured in env vars
- [ ] Job queue implemented (Redis/Database)
- [ ] Endpoints returning proper HTTP status codes
- [ ] Error logging configured (Cloud Logging)
- [ ] Retry logic implemented
- [ ] Rate limiting configured
- [ ] CORS headers set (allow frontend origin)
- [ ] Auth token validation working
- [ ] Firestore rules updated to allow highlight writes
- [ ] Video processing service scaled for load
- [ ] CDN configured for output videos
- [ ] Monitoring/alerts for failed jobs
- [ ] Grace period before recording deletion (24h minimum)

---

## Roadmap

### v1.0 (Current)
- Basic extraction + assembly
- 2-3 clips, simple cross-fades
- No music/effects

### v1.1
- Use creator highlight markers
- Improved moment detection
- Longer clips (45s)

### v2.0
- ML-based moment detection
- Multiple output formats (16:9, 9:16 for Stories)
- Background music selection
- Customizable transitions

### v3.0
- AI-powered highlight detection
- Custom branding/watermarks
- Multi-language captions
- Archive all highlights (not just recent)

---

## Reference: Cloudflare Stream Docs
- Stream API: https://developers.cloudflare.com/stream/api-reference/
- Clip API: https://developers.cloudflare.com/stream/clip-api/
- Recording: https://developers.cloudflare.com/stream/recording/

---

Status: Ready for backend implementation  
Last Updated: Phase 3 (frontend complete)
