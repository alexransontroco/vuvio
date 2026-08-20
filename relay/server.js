import express from 'express';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import wrtc from '@roamhq/wrtc';

const { RTCPeerConnection, nonstandard } = wrtc;
const { RTCAudioSink, RTCVideoSink } = nonstandard;

const app = express();
app.use(express.json({ limit: '5mb' }));

const sessions = new Map();
const ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : null);
const host = process.env.RTMPS_RELAY_HOST || '0.0.0.0';
const port = Number(process.env.RTMPS_RELAY_PORT || 8787);
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN || '';

function buildRtmpTarget(ingestUrl, streamKey) {
  if (!ingestUrl || !streamKey) return '';
  return `${ingestUrl}${streamKey}`;
}

async function fetchCloudflareLiveInput(liveInputId) {
  if (!cloudflareAccountId || !cloudflareApiToken) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/stream/live_inputs/${encodeURIComponent(liveInputId)}`, {
    headers: { Authorization: `Bearer ${cloudflareApiToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false || !body?.result) {
    throw new Error(`Cloudflare live input fetch failed (${response.status})`);
  }
  return body.result;
}

function createFfmpegProcess(session) {
  if (!ffmpegPath) throw new Error('FFmpeg binary not available');

  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-thread_queue_size', '512',
    '-f', 'rawvideo',
    '-pix_fmt', 'yuv420p',
    '-s', `${session.videoWidth}x${session.videoHeight}`,
    '-r', String(session.videoFps),
    '-i', 'pipe:3',
    '-thread_queue_size', '512',
    '-f', 's16le',
    '-ar', String(session.audioSampleRate),
    '-ac', String(session.audioChannels),
    '-i', 'pipe:4',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'baseline',
    '-pix_fmt', 'yuv420p',
    '-g', String(session.videoFps * 2),
    '-keyint_min', String(session.videoFps * 2),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', String(session.audioSampleRate),
    '-ac', String(session.audioChannels),
    '-f', 'flv',
    session.rtmpTarget,
  ];

  console.log('[RTMPS-RELAY] launching ffmpeg:', ffmpegPath, args.join(' '));
  const child = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  child.on('exit', (code, signal) => {
    console.log('[RTMPS-RELAY] ffmpeg exited', { code, signal, sessionId: session.id });
  });

  session.videoPipe = child.stdio[3];
  session.audioPipe = child.stdio[4];
  session.ffmpeg = child;
  console.log('[RTMPS-RELAY] Cloudflare RTMPS connected');
}

async function startSession({ liveInputId, sdpOffer, title }) {
  const input = await fetchCloudflareLiveInput(liveInputId);
  const rtmps = input.rtmps || {};
  const ingestUrl = typeof rtmps.url === 'string' ? rtmps.url : null;
  const streamKey = typeof rtmps.streamKey === 'string' ? rtmps.streamKey : null;
  if (!ingestUrl || !streamKey) {
    throw new Error('Cloudflare RTMPS credentials missing on live input');
  }
  const pc = new RTCPeerConnection({
    bundlePolicy: 'max-bundle',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  const session = {
    id: randomUUID(),
    liveInputId,
    ingestUrl,
    streamKey,
    rtmpTarget: buildRtmpTarget(ingestUrl, streamKey),
    pc,
    title,
    videoSink: null,
    audioSink: null,
    videoPipe: null,
    audioPipe: null,
    ffmpeg: null,
    videoWidth: 1280,
    videoHeight: 720,
    videoFps: 30,
    audioSampleRate: 48000,
    audioChannels: 2,
    hasVideo: false,
    hasAudio: false,
  };

  sessions.set(session.id, session);

  pc.onconnectionstatechange = () => {
    console.log('[RTMPS-RELAY] WebRTC connection state:', pc.connectionState, 'sessionId:', session.id);
  };
  pc.oniceconnectionstatechange = () => {
    console.log('[RTMPS-RELAY] WebRTC ICE state:', pc.iceConnectionState, 'sessionId:', session.id);
  };
  pc.ontrack = (event) => {
    const track = event.track;
    if (!track) return;
    if (track.kind === 'video') {
      console.log('[RTMPS-RELAY] WebRTC publisher connected');
      session.hasVideo = true;
      session.videoSink = new RTCVideoSink(track);
      session.videoSink.onframe = ({ frame }) => {
        if (!session.videoPipe || !frame) return;
        if (typeof frame.width === 'number' && typeof frame.height === 'number') {
          session.videoWidth = frame.width;
          session.videoHeight = frame.height;
        }
        if (frame.data) {
          const videoBuffer = Buffer.from(frame.data.buffer, frame.data.byteOffset ?? 0, frame.data.byteLength ?? frame.data.length ?? frame.data.buffer.byteLength);
          session.videoPipe.write(videoBuffer);
        }
        if (!session.forwardingLogged) {
          session.forwardingLogged = true;
          console.log('[RTMPS-RELAY] forwarding audio/video');
        }
      };
    }
    if (track.kind === 'audio') {
      session.hasAudio = true;
      session.audioSink = new RTCAudioSink(track);
      session.audioSink.ondata = (data) => {
        if (!session.audioPipe || !data?.samples) return;
        const audioBuffer = Buffer.from(data.samples.buffer, data.samples.byteOffset ?? 0, data.samples.byteLength ?? data.samples.length ?? data.samples.buffer.byteLength);
        session.audioPipe.write(audioBuffer);
      };
    }
    if (session.hasVideo && session.hasAudio && !session.ffmpeg && session.rtmpTarget) {
      createFfmpegProcess(session);
    }
  };

  return pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer })
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer))
    .then(async () => {
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve();
        };
      });
      return {
        sessionId: session.id,
        sdpAnswer: pc.localDescription?.sdp || '',
        ingestUrl,
        streamKey,
      };
    });
}

function stopSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  console.log('[RTMPS-RELAY] broadcaster ended', sessionId);
  try {
    session.audioSink?.stop?.();
    session.videoSink?.stop?.();
  } catch {}
  try {
    session.pc?.close?.();
  } catch {}
  try {
    session.ffmpeg?.stdin?.end?.();
    session.videoPipe?.end?.();
    session.audioPipe?.end?.();
    session.ffmpeg?.kill('SIGTERM');
  } catch {}
  console.log('[RTMPS-RELAY] RTMPS closed', sessionId);
  sessions.delete(sessionId);
  return true;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
});

app.post('/sessions', async (req, res) => {
  try {
    const { liveInputId, sdpOffer, title } = req.body || {};
    if (!liveInputId || !sdpOffer) {
      res.status(400).json({ error: 'Missing liveInputId or sdpOffer' });
      return;
    }
    const result = await startSession({ liveInputId, sdpOffer, title });
    res.json({
      sessionId: result.sessionId,
      sdpAnswer: result.sdpAnswer,
    });
  } catch (err) {
    console.error('[RTMPS-RELAY] session create failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'failed to start session' });
  }
});

app.delete('/sessions/:sessionId', (req, res) => {
  const ok = stopSession(req.params.sessionId);
  res.status(ok ? 200 : 404).json({ ok });
});

app.listen(port, host, () => {
  console.log(`[RTMPS-RELAY] listening on http://${host}:${port}`);
  console.log(`[RTMPS-RELAY] ffmpeg: ${ffmpegPath ?? 'MISSING'}`);
});
