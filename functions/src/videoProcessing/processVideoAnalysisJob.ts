import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { db } from '../shared/firestore.js';
import { getOpenAIEnv } from '../config/env.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;
const JOB_COLLECTION = 'videoProcessingJobs';
const MIN_CLIP_SECONDS = 15;
const MAX_CLIP_SECONDS = 60;
const MAX_HIGHLIGHTS = 5;

type TranscriptSegment = {
  id?: number | string;
  start: number;
  end: number;
  text: string;
};

type HighlightCandidate = {
  title: string;
  reason: string;
  startSeconds: number;
  endSeconds: number;
  score?: number;
};

type Highlight = HighlightCandidate & {
  id: string;
  durationSeconds: number;
  score: number;
  clipStoragePath: string | null;
  clipUrl: string | null;
};

function updateJob(jobId: string, data: Record<string, unknown>) {
  return db.collection(JOB_COLLECTION).doc(jobId).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function runFfmpeg(args: string[], logLabel: string) {
  if (!ffmpegPath) throw new ApiError('server_error', 'FFmpeg binary is not available');
  console.log(`[video-analysis] ffmpeg ${logLabel}`, args.join(' '));
  await execFileAsync(ffmpegPath, ['-y', ...args], { maxBuffer: 10 * 1024 * 1024 });
}

async function inspectMedia(filePath: string) {
  if (!ffmpegPath) throw new ApiError('server_error', 'FFmpeg binary is not available');
  try {
    await execFileAsync(ffmpegPath, ['-i', filePath], { maxBuffer: 10 * 1024 * 1024 });
    return '';
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ''}\n${err.stderr ?? ''}`;
  }
}

async function hasAudioStream(filePath: string) {
  const output = await inspectMedia(filePath);
  return /Stream #\d+:\d+(?:\[[^\]]+\])?(?:\([^)]*\))?: Audio:/i.test(output);
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function transcriptDuration(segments: TranscriptSegment[]) {
  return Math.max(0, ...segments.map((segment) => safeNumber(segment.end)));
}

function normalizeTranscriptSegments(transcription: any): TranscriptSegment[] {
  const rawSegments = Array.isArray(transcription?.segments) ? transcription.segments : [];
  if (rawSegments.length) {
    return rawSegments
      .map((segment: any, index: number) => ({
        id: segment.id ?? index,
        start: safeNumber(segment.start),
        end: safeNumber(segment.end),
        text: String(segment.text ?? '').trim(),
      }))
      .filter((segment: TranscriptSegment) => segment.text && segment.end > segment.start);
  }

  const text = String(transcription?.text ?? '').trim();
  return text ? [{ id: 0, start: 0, end: 30, text }] : [];
}

function analysisPrompt(segments: TranscriptSegment[]) {
  return [
    'Tu analyses la transcription horodatée d’un live Vuvio.',
    '',
    'Vuvio est une plateforme de lives POV centrée sur les activités, les métiers, les savoir-faire, le sport et la découverte de lieux.',
    '',
    'Sélectionne entre 3 et 5 moments intéressants.',
    '',
    'Favorise :',
    '- une explication utile ;',
    '- une action claire ;',
    '- un moment drôle ou inattendu ;',
    '- une interaction humaine ;',
    '- une découverte intéressante ;',
    '- un résultat ou une transformation ;',
    '- un passage compréhensible seul.',
    '',
    'Évite :',
    '- les silences ;',
    '- les répétitions ;',
    '- les phrases incomplètes ;',
    '- les informations privées ;',
    '- les moments sans intérêt ;',
    '- plusieurs clips presque identiques.',
    '',
    'Chaque clip doit durer entre 15 et 60 secondes.',
    '',
    'Retourne uniquement un JSON valide.',
    '',
    'Format JSON attendu :',
    '{"highlights":[{"title":"Titre court","reason":"Pourquoi ce passage est intéressant","startSeconds":120,"endSeconds":150,"score":0.9}]}',
    '',
    'Transcription horodatée :',
    JSON.stringify(segments.map((segment) => ({
      startSeconds: segment.start,
      endSeconds: segment.end,
      text: segment.text,
    }))),
  ].join('\n');
}

function readModelJson(response: any) {
  const outputText = response?.output_text
    ?? response?.output?.flatMap((item: any) => item.content ?? [])
      ?.map((content: any) => content.text ?? '')
      ?.join('')
    ?? '';
  return JSON.parse(outputText);
}

function validateHighlights(input: unknown, durationSeconds: number): Highlight[] {
  const raw = Array.isArray((input as any)?.highlights) ? (input as any).highlights : [];
  const accepted: Highlight[] = [];

  for (const item of raw) {
    if (accepted.length >= MAX_HIGHLIGHTS) break;

    const start = Math.max(0, safeNumber(item?.startSeconds));
    let end = safeNumber(item?.endSeconds);
    if (durationSeconds > 0) end = Math.min(end, durationSeconds);

    let duration = end - start;
    if (duration < MIN_CLIP_SECONDS) {
      end = Math.min(durationSeconds || start + MIN_CLIP_SECONDS, start + MIN_CLIP_SECONDS);
      duration = end - start;
    }
    if (duration > MAX_CLIP_SECONDS) {
      end = start + MAX_CLIP_SECONDS;
      duration = MAX_CLIP_SECONDS;
    }
    if (duration < 3 || end <= start) continue;

    const overlaps = accepted.some((existing) => {
      const overlap = Math.max(0, Math.min(existing.endSeconds, end) - Math.max(existing.startSeconds, start));
      return overlap / Math.min(existing.durationSeconds, duration) > 0.55;
    });
    if (overlaps) continue;

    accepted.push({
      id: `highlight-${accepted.length + 1}`,
      title: String(item?.title ?? `Moment ${accepted.length + 1}`).slice(0, 80),
      reason: String(item?.reason ?? '').slice(0, 300),
      startSeconds: Math.round(start * 10) / 10,
      endSeconds: Math.round(end * 10) / 10,
      durationSeconds: Math.round(duration * 10) / 10,
      score: Math.max(0, Math.min(1, safeNumber(item?.score, 0.5))),
      clipStoragePath: null,
      clipUrl: null,
    });
  }

  return accepted;
}

async function signedReadUrl(storagePath: string) {
  const [url] = await getStorage().bucket().file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return url;
}

export async function processVideoAnalysisJob(req: Request, res: Response, jobId: string) {
  const user = await authenticateUser(req);
  const jobRef = db.collection(JOB_COLLECTION).doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new ApiError('not_found', 'Video processing job not found');

  const job = snap.data() ?? {};
  if (job.userId !== user.uid) throw new ApiError('forbidden', 'This job belongs to another user');
  if (['processing', 'transcribing', 'analyzing', 'creating_clips', 'completed'].includes(String(job.status))) {
    res.json({ accepted: false, status: job.status, message: 'Job is already running or completed' });
    return;
  }

  const sourceReplayUrl = String(job.sourceReplayUrl ?? '');
  const liveId = String(job.liveId ?? '');
  if (!sourceReplayUrl || !liveId) throw new ApiError('bad_request', 'Invalid job data');

  const openaiEnv = getOpenAIEnv();
  if (!openaiEnv.apiKey) throw new ApiError('server_error', 'OpenAI is not configured');

  const openai = new OpenAI({ apiKey: openaiEnv.apiKey });
  const workDir = await mkdtemp(join(tmpdir(), `vuvio-analysis-${jobId}-`));
  const audioPath = join(workDir, 'analysis-audio.mp3');

  try {
    await updateJob(jobId, { status: 'processing', progress: 10, error: null, startedAt: FieldValue.serverTimestamp() });

    console.log('[video-analysis] downloading source replay', { jobId, sourceReplayUrl });
    await updateJob(jobId, { status: 'processing', progress: 20 });
    const sourceHasAudio = await hasAudioStream(sourceReplayUrl);
    if (!sourceHasAudio) {
      const noAudioMessage = 'Replay has no audio track, so AI transcript highlights cannot be generated.';
      console.warn('[video-analysis] no audio stream found', { jobId, sourceReplayUrl });
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        transcript: [],
        durationSeconds: 0,
        highlights: [],
        analysisNote: noAudioMessage,
        completedAt: FieldValue.serverTimestamp(),
      });
      res.json({ accepted: true, status: 'completed', highlights: [], message: noAudioMessage });
      return;
    }

    await runFfmpeg(['-i', sourceReplayUrl, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'mp3', audioPath], 'extract-audio');

    await updateJob(jobId, { status: 'transcribing', progress: 35 });
    console.log('[video-analysis] transcribing audio', { jobId, model: openaiEnv.transcriptionModel });
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath) as any,
      model: openaiEnv.transcriptionModel,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    } as any);
    const transcript = normalizeTranscriptSegments(transcription);
    const durationSeconds = safeNumber((transcription as any)?.duration, transcriptDuration(transcript));
    await updateJob(jobId, { transcript, durationSeconds, progress: 55 });

    if (!transcript.length) {
      await updateJob(jobId, { status: 'completed', progress: 100, highlights: [], completedAt: FieldValue.serverTimestamp() });
      res.json({ accepted: true, status: 'completed', highlights: [] });
      return;
    }

    await updateJob(jobId, { status: 'analyzing', progress: 65 });
    console.log('[video-analysis] analyzing transcript', { jobId, model: openaiEnv.analysisModel, segments: transcript.length });
    const analysis = await openai.responses.create({
      model: openaiEnv.analysisModel,
      input: analysisPrompt(transcript),
      text: {
        format: {
          type: 'json_schema',
          name: 'vuvio_highlights',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              highlights: {
                type: 'array',
                minItems: 0,
                maxItems: 5,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    reason: { type: 'string' },
                    startSeconds: { type: 'number' },
                    endSeconds: { type: 'number' },
                    score: { type: 'number' },
                  },
                  required: ['title', 'reason', 'startSeconds', 'endSeconds', 'score'],
                },
              },
            },
            required: ['highlights'],
          },
        },
      },
    } as any);

    let highlights = validateHighlights(readModelJson(analysis), durationSeconds);
    await updateJob(jobId, { highlights, progress: 78 });

    await updateJob(jobId, { status: 'creating_clips', progress: 82 });
    const bucket = getStorage().bucket();
    const completed: Highlight[] = [];

    for (let index = 0; index < highlights.length; index++) {
      const highlight = highlights[index];
      const clipPath = join(workDir, `${highlight.id}.mp4`);
      const clipStoragePath = `live-highlights/${user.uid}/${liveId}/${highlight.id}.mp4`;
      await runFfmpeg([
        '-ss', String(highlight.startSeconds),
        '-i', sourceReplayUrl,
        '-t', String(highlight.durationSeconds),
        '-c:v', 'libx264',
        ...(sourceHasAudio ? ['-c:a', 'aac'] : ['-an']),
        '-movflags', '+faststart',
        clipPath,
      ], `clip-${highlight.id}`);

      await bucket.upload(clipPath, {
        destination: clipStoragePath,
        metadata: { contentType: 'video/mp4' },
      });

      completed.push({
        ...highlight,
        clipStoragePath,
        clipUrl: await signedReadUrl(clipStoragePath),
      });

      await updateJob(jobId, {
        highlights: completed.concat(highlights.slice(index + 1)),
        progress: 82 + Math.round(((index + 1) / Math.max(1, highlights.length)) * 16),
      });
    }

    highlights = completed;
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      highlights,
      completedAt: FieldValue.serverTimestamp(),
    });

    console.log('[video-analysis] completed', { jobId, highlights: highlights.length });
    res.json({ accepted: true, status: 'completed', highlights });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video analysis failed';
    console.error('[video-analysis] failed', { jobId, message });
    await updateJob(jobId, { status: 'failed', error: message, progress: 100 });
    throw new ApiError('server_error', message);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
