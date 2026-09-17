# Vuvio AI Post-Live Analysis

This first version analyzes the local MediaRecorder replay after a live ends. It does not inspect frames, reframe video, stabilize footage, create TikTok formats, or publish anything automatically.

## Flow

1. The existing MediaRecorder builds the final WebM replay blob in the browser.
2. The current Cloudflare replay upload still runs as before.
3. Before the local recording is cleared, Vuvio uploads the same WebM blob to Firebase Storage:

   ```text
   live-recordings/{userId}/{liveId}/original.webm
   ```

4. The frontend creates a Firestore job:

   ```text
   videoProcessingJobs/{jobId}
   ```

5. The frontend calls the secured backend endpoint:

   ```text
   POST /api/video-processing-jobs/{jobId}/start
   ```

6. The backend checks authentication and job ownership.
7. The backend downloads the original WebM from Firebase Storage.
8. FFmpeg extracts mono 16 kHz MP3 audio:

   ```bash
   ffmpeg -i original.webm -vn -ac 1 -ar 16000 -c:a mp3 analysis-audio.mp3
   ```

9. OpenAI transcribes the audio with timestamped segments.
10. OpenAI analyzes the timestamped transcript and returns 3 to 5 candidate highlights as JSON.
11. The backend validates timestamps, duration, overlap, duplicates, and clip count.
12. FFmpeg creates MP4 clips:

   ```bash
   ffmpeg -ss START_SECONDS -i original.webm -t DURATION_SECONDS -c:v libx264 -c:a aac -movflags +faststart clip.mp4
   ```

13. The backend uploads clips to Firebase Storage:

   ```text
   live-highlights/{userId}/{liveId}/{highlightId}.mp4
   ```

14. The recap page listens to the job document and displays progress, empty/error states, and the resulting clips.

## Job Document

Collection:

```text
videoProcessingJobs/{jobId}
```

Shape:

```js
{
  liveId: string,
  userId: string,
  sourceStoragePath: string,
  sourceDownloadUrl: string | null,
  status: "queued" | "processing" | "transcribing" | "analyzing" | "creating_clips" | "completed" | "failed",
  progress: number,
  error: string | null,
  transcript: [],
  highlights: [],
  highlightDecisions: {
    [highlightId]: "kept" | "deleted"
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Highlight shape:

```js
{
  id: string,
  title: string,
  reason: string,
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number,
  score: number,
  clipStoragePath: string | null,
  clipUrl: string | null
}
```

## Frontend

Main service:

```text
src/services/videoAnalysisService.js
```

Important functions:

- `uploadReplayForAnalysis({ videoBlob, liveId, userId })`
- `createAndStartVideoAnalysis({ videoBlob, liveId, userId })`
- `startVideoAnalysisJob(jobId)`
- `subscribeToVideoAnalysisJobs(liveId, userId, callback)`
- `markHighlightDecision(jobId, highlightId, decision)`

The recap page displays an `AI Highlights` section with:

- processing progress;
- `Analyze replay` button when no job exists;
- `Retry` button when a job failed;
- empty state when no useful highlight is found;
- one video player per generated clip;
- `Preview`, `Keep`, and `Delete` controls.

`Keep` and `Delete` only save the creator decision in Firestore. Clips are not published automatically.

## Backend

Main handler:

```text
functions/src/videoProcessing/processVideoAnalysisJob.ts
```

Route:

```text
POST /api/video-processing-jobs/{jobId}/start
```

The backend:

- verifies Firebase Auth;
- verifies that `job.userId` matches the authenticated user;
- refuses duplicate processing when a job is already running or completed;
- updates `status`, `progress`, `error`, `transcript`, and `highlights`;
- logs each major step;
- uses Firebase Admin SDK for Storage and Firestore;
- keeps the OpenAI key server-side only.

## Environment

Functions need:

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=
OPENAI_ANALYSIS_MODEL=
```

Recommended first values:

```env
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
```

For Firebase Functions secrets:

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

For local/emulator runs, put the models in `functions/.env` or your shell environment:

```env
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
```

The current code reads `process.env.OPENAI_TRANSCRIPTION_MODEL` and `process.env.OPENAI_ANALYSIS_MODEL`, so deploy environments can provide them as normal environment variables. If they are omitted, the backend uses `whisper-1` and `gpt-4o-mini`.

## Local Development

Install backend dependencies:

```bash
cd functions
npm install openai ffmpeg-static
npm run build
```

Build frontend:

```bash
npm run build
```

Run locally with Firebase emulators if configured:

```bash
firebase emulators:start --only functions,firestore,storage
```

For the frontend dev server:

```bash
npm run dev
```

## Testing

Use a short live, ideally 20 to 60 seconds, with clear spoken audio.

1. Start a creator live.
2. Speak normally with at least a few distinct moments.
3. End the live.
4. Confirm the normal replay upload still completes.
5. Open the recap page.
6. Watch the `AI Highlights` section:
   - `Preparing video`
   - `Transcribing audio`
   - `Finding the best moments`
   - `Creating clips`
7. Confirm generated clips appear with title, reason, duration, and controls.

If the automatic analysis does not start because the local recording was already cleared, use `Analyze replay` before leaving the device/session that recorded the live.

## Requirements And Limits

- FFmpeg is required in the backend runtime. This implementation uses `ffmpeg-static`.
- Long videos can exceed Cloud Functions runtime, memory, or temp disk limits. This v1 is intended for short replays.
- OpenAI transcription needs an audio model that supports timestamped verbose JSON segments.
- Clip URLs are signed read URLs and expire after 7 days in this first version.
- This is not a queue system. It is a direct secured processing endpoint with duplicate-status protection.
