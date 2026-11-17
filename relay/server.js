import express from 'express';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import wrtc from '@roamhq/wrtc';

const { RTCPeerConnection, nonstandard } = wrtc;
const { RTCAudioSink, RTCVideoSink } = nonstandard;

const app = express();
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

const sessions = new Map();
const ffmpegPath = process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg';
const host = process.env.RTMPS_RELAY_HOST || '0.0.0.0';
const port = Number(process.env.PORT || process.env.RTMPS_RELAY_PORT || 8787);
const certPath = process.env.RTMPS_RELAY_CERT || '../certs/cert.pem';
const keyPath = process.env.RTMPS_RELAY_KEY || '../certs/key.pem';
const INACTIVITY_MS = Number(process.env.RTMPS_RELAY_INACTIVITY_MS || 30000);
const diagnosticsEnabled = process.env.RTMPS_RELAY_DIAGNOSTICS === '1';
const MAX_CONCURRENT_SESSIONS = Number(process.env.RTMPS_RELAY_MAX_SESSIONS || 3);
const RELAY_AUTH_TOKEN = process.env.RTMPS_RELAY_AUTH_TOKEN || '';
const STARTED_AT = Date.now();
const INPUT_FPS = 15;
const OUTPUT_FPS = 30; // RTMPS output fps — FFmpeg duplicates frames to fill
const TARGET_WIDTH = 854;
const TARGET_HEIGHT = 480;

function scaleI420(srcBuf, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return srcBuf;
  const srcUVW = Math.ceil(srcW / 2), srcUVH = Math.ceil(srcH / 2);
  const dstUVW = Math.ceil(dstW / 2), dstUVH = Math.ceil(dstH / 2);
  const dst = Buffer.allocUnsafe(dstW * dstH + dstUVW * dstUVH * 2);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.floor(y * srcH / dstH);
    for (let x = 0; x < dstW; x++) {
      dst[y * dstW + x] = srcBuf[sy * srcW + Math.floor(x * srcW / dstW)];
    }
  }
  const srcUOff = srcW * srcH, dstUOff = dstW * dstH;
  for (let y = 0; y < dstUVH; y++) {
    const sy = Math.floor(y * srcUVH / dstUVH);
    for (let x = 0; x < dstUVW; x++) {
      dst[dstUOff + y * dstUVW + x] = srcBuf[srcUOff + sy * srcUVW + Math.floor(x * srcUVW / dstUVW)];
    }
  }
  const srcVOff = srcUOff + srcUVW * srcUVH, dstVOff = dstUOff + dstUVW * dstUVH;
  for (let y = 0; y < dstUVH; y++) {
    const sy = Math.floor(y * srcUVH / dstUVH);
    for (let x = 0; x < dstUVW; x++) {
      dst[dstVOff + y * dstUVW + x] = srcBuf[srcVOff + sy * srcUVW + Math.floor(x * srcUVW / dstUVW)];
    }
  }
  return dst;
}

function buildRtmpTarget(ingestUrl, streamKey) {
  if (!ingestUrl || !streamKey) return '';
  return `${ingestUrl.replace(/\/$/, '')}/${streamKey.replace(/^\//, '')}`;
}

function createFfmpegProcess(session) {
  if (!ffmpegPath) throw new Error('FFmpeg binary not available');

  const args = [
    '-hide_banner',
    '-nostdin',
    '-loglevel', 'warning',
    ...(diagnosticsEnabled ? ['-progress', 'pipe:5', '-stats_period', '1'] : []),
    '-thread_queue_size', '512',
    '-f', 'rawvideo',
    '-pix_fmt', 'yuv420p',
    '-s', `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
    '-framerate', String(INPUT_FPS),
    '-r', String(INPUT_FPS),
    '-i', 'pipe:3',
  ];

  if (session.hasAudio) {
    args.push(
      '-thread_queue_size', '512',
      '-f', 's16le',
      '-ar', String(session.audioSampleRate * 3), // wrtc reports 16kHz but delivers 48kHz PCM
      '-ac', String(session.audioChannels),
      '-i', 'pipe:4',
    );
  } else {
    // Cloudflare RTMPS requires an audio track — synthesize silence.
    args.push(
      '-f', 'lavfi',
      '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
    );
  }

  args.push(
    '-threads', '2',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-profile:v', 'baseline',
    '-pix_fmt', 'yuv420p',
    '-r', String(OUTPUT_FPS),
    '-g', String(OUTPUT_FPS),
    '-keyint_min', String(OUTPUT_FPS),
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '48000',
    '-ac', '2',
    // CFR is required: VFR produces irregular FLV packet timing that blocks RTMPS writes at ~10-12s.
    '-fps_mode', 'cfr',
    '-rw_timeout', '5000000',
    '-flvflags', 'no_duration_filesize',
    '-f', 'flv',
    session.rtmpTarget,
  );

  const stdio = ['ignore', 'ignore', 'pipe', 'pipe', session.hasAudio ? 'pipe' : 'ignore', diagnosticsEnabled ? 'pipe' : 'ignore'];
  const child = spawn(ffmpegPath, args, { stdio });
  let stderrPending = '';
  const logStderr = (line) => console.warn('[relay] ffmpeg session=%s %s', session.id,
    line.replaceAll(session.rtmpTarget, '[RTMP target]').replaceAll(session.streamKey, '[stream key]'));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => {
    stderrPending += data;
    const lines = stderrPending.split(/[\r\n]/);
    stderrPending = lines.pop();
    for (const line of lines) if (line) logStderr(line);
  });
  child.stderr.on('end', () => { if (stderrPending) logStderr(stderrPending); });
  child.on('error', (err) => {
    session.ffmpegError = err.code || 'spawn_failed';
    console.error('[relay] ffmpeg spawn error session=%s code=%s', session.id, session.ffmpegError);
  });
  if (diagnosticsEnabled) {
    let pending = '';
    let progress = {};
    child.stdio[5].setEncoding('utf8');
    child.stdio[5].on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        const separator = line.indexOf('=');
        if (separator < 0) continue;
        progress[line.slice(0, separator)] = line.slice(separator + 1).trim();
        if (line.startsWith('progress=')) {
          session.ffmpegProgress = { ...progress, observedAt: Date.now() };
          progress = {};
        }
      }
    });
  }

  session.ffmpegStartedAt = Date.now();
  console.log('[relay] ffmpeg started pid=%d session=%s %dx%d audio=%s fps=%d',
    child.pid, session.id, session.videoWidth, session.videoHeight,
    session.hasAudio ? 'webrtc' : 'silence', INPUT_FPS);

  child.on('exit', (code, signal) => {
    session.ffmpegExit = { code, signal };
    console.log('[relay] ffmpeg exit code=%s signal=%s session=%s frames=%d written=%d',
      code, signal, session.id, session.frameCount, session.framesWritten);
  });

  session.videoPipe = child.stdio[3];
  session.audioPipe = session.hasAudio ? child.stdio[4] : null;
  session.ffmpeg = child;
  session.videoPipe.on('error', (err) => {
    console.error('[relay] videoPipe error session=%s code=%s', session.id, err?.code || err?.message);
  });
  session.audioPipe?.on('error', (err) => {
    console.error('[relay] audioPipe error session=%s code=%s', session.id, err?.code || err?.message);
  });

  // Primary writes happen in onframe (WebRTC callback) — more reliable than setInterval
  // under Node.js event-loop load. Timer is a backup for WebRTC delivery gaps.
  session.timerStartedAt = Date.now();
  console.log('[relay] write timer started session=%s', session.id);
  session.videoWriteTimer = setInterval(() => {
    const src = session.latestFrameBuf;
    if (!src || !session.videoPipe) return;
    const elapsed = Date.now() - session.timerStartedAt;
    const targetFrames = Math.floor(elapsed / (1000 / INPUT_FPS));
    if (targetFrames <= session.framesWritten) return;
    // Backup write: covers gaps when WebRTC stops delivering frames.
    // 66ms interval guarantees 15fps floor; write up to 2 frames per tick to catch up.
    const needed = Math.min(targetFrames - session.framesWritten, 2);
    const writeBuf = Buffer.allocUnsafe(src.length);
    src.copy(writeBuf);
    for (let i = 0; i < needed; i++) {
      session.videoPipe.write(writeBuf);
      session.framesWritten++;
    }
  }, Math.round(1000 / INPUT_FPS)); // 66ms — fires at 15fps
}


function restartFfmpeg(session) {
  const oldFfmpeg = session.ffmpeg;
  const oldVideoPipe = session.videoPipe;
  const oldAudioPipe = session.audioPipe;

  if (session.videoWriteTimer) {
    clearInterval(session.videoWriteTimer);
    session.videoWriteTimer = null;
  }
  session.framesWritten = 0;

  session.ffmpeg = null;
  session.videoPipe = null;
  session.audioPipe = null;

  if (oldFfmpeg) {
    setTimeout(() => { try { oldVideoPipe?.end(); } catch {} try { oldAudioPipe?.end(); } catch {} }, 100);
    setTimeout(() => { try { oldFfmpeg.kill('SIGTERM'); } catch {} }, 3000);
    const killTimer = setTimeout(() => {
      if (oldFfmpeg.exitCode !== null || oldFfmpeg.signalCode !== null) return;
      try { oldFfmpeg.kill('SIGKILL'); } catch {}
    }, 10000);
    oldFfmpeg.once('exit', () => clearTimeout(killTimer));
  }

  createFfmpegProcess(session);
}

function forceVp8(sdp) {
  return sdp.split('\r\n').reduce((lines, line) => {
    if (line.startsWith('m=video')) {
      // Keep only VP8 payload type
      const parts = line.split(' ');
      const header = parts.slice(0, 3);
      const payloads = parts.slice(3);
      // Find VP8 payload number from a=rtpmap lines
      const vp8Payload = sdp.match(/a=rtpmap:(\d+) VP8\//i)?.[1];
      const filtered = vp8Payload ? payloads.filter(pt => pt === vp8Payload) : payloads;
      lines.push([...header, ...filtered].join(' '));
    } else {
      lines.push(line);
    }
    return lines;
  }, []).join('\r\n');
}

function startSession({ liveInputId, ingestUrl, streamKey, sdpOffer, title, iceServers }) {
  const resolvedIceServers = Array.isArray(iceServers)
    ? iceServers
    : [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
  const hasTurn = resolvedIceServers.some((s) => String(s.urls).startsWith('turn') || (Array.isArray(s.urls) && s.urls.some((u) => u.startsWith('turn'))));
  console.log('[relay] iceServers count=%d hasTurn=%s', resolvedIceServers.length, hasTurn);
  const pc = new RTCPeerConnection({
    bundlePolicy: 'max-bundle',
    iceServers: resolvedIceServers,
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
    videoWriteTimer: null,
    latestFrameBuf: null,
    timerStartedAt: 0,
    videoWidth: 1280,
    videoHeight: 720,
    videoFps: 30,
    audioSampleRate: 48000,
    audioChannels: 2,
    hasVideo: false,
    hasAudio: false,
    firstVideoAt: 0,
    lastVideoFrameAt: 0,
    ffmpegStartCount: 0,
    ffmpegStartedAt: 0,
    inactivityTimer: null,
    stopping: false,
    frameCount: 0,
    framesWritten: 0,
    audioPackets: 0,
    audioSamples: 0,
    audioNonSilentPackets: 0,
    audioObservedSampleRate: null,
    audioObservedChannels: null,
    ffmpegProgress: null,
    ffmpegExit: null,
    ffmpegError: null,
    iceLogged: false,
  };

  sessions.set(session.id, session);
  console.log('[relay] session created=%s liveInputId=%s', session.id, liveInputId);

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') stopSession(session.id);
  };
  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    console.log('[relay] ICE state=%s session=%s', s, session.id);
    if ((s === 'connected' || s === 'completed') && !session.iceLogged) {
      session.iceLogged = true;
    }
  };
  pc.onicegatheringstatechange = () => {
    console.log('[relay] ICE gathering=%s session=%s', pc.iceGatheringState, session.id);
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log('[relay] local candidate type=%s protocol=%s session=%s', e.candidate.type, e.candidate.protocol, session.id);
    } else {
      console.log('[relay] ICE gathering complete session=%s', session.id);
    }
  };
  pc.onicecandidateerror = (event) => {
    console.warn('[relay] ICE candidate error code=%s session=%s', event.errorCode, session.id);
  };

  pc.ontrack = (event) => {
    const track = event.track;
    console.log('[relay] ontrack kind=%s id=%s session=%s', track?.kind, track?.id, session.id);
    if (!track) return;

    if (track.kind === 'video') {
      session.hasVideo = true;
      track.onended = () => { console.log('[relay] video track ended session=%s', session.id); stopSession(session.id); };
      session.videoSink = new RTCVideoSink(track);
      console.log('[relay] RTCVideoSink created track.readyState=%s session=%s', track.readyState, session.id);
      setTimeout(() => console.log('[relay] 3s check: frameCount=%d session=%s', session.frameCount, session.id), 3000);
      let _frameLogCount = 0;
      session.videoSink.onframe = ({ frame }) => {
        if (!frame || session.stopping) return;
        if (_frameLogCount < 3) { console.log('[relay] frame#%d session=%s size=%dx%d bytes=%d', ++_frameLogCount, session.id, frame.width, frame.height, frame.data?.byteLength ?? -1); }

        // Start FFmpeg on the first usable frame. Mobile browsers can emit low-res
        // warm-up frames and then pause before the canvas track reaches target size.
        if (!session.ffmpeg && session.rtmpTarget) {
          const now = Date.now();
          if (!session.firstVideoAt) session.firstVideoAt = now;
          const hasFrameSize = Number.isFinite(frame.width) && Number.isFinite(frame.height) && frame.width > 0 && frame.height > 0;
          if (hasFrameSize) {
            session.videoWidth = TARGET_WIDTH;
            session.videoHeight = TARGET_HEIGHT;
          }
          const waited = now - session.firstVideoAt;
          const audioReady = session.hasAudio || waited > 1000;
          if (hasFrameSize && audioReady) {
            const audioSource = session.hasAudio ? 'webrtc' : 'silence';
            console.log('[relay] starting ffmpeg — session=%s res=%dx%d audioSource=%s waited=%dms ffmpegStart#%d',
              session.id, session.videoWidth, session.videoHeight, audioSource, waited, ++session.ffmpegStartCount);
            createFfmpegProcess(session);
          }
        }

        session.frameCount++;
        session.lastVideoFrameAt = Date.now();

        if (!frame.data) return;
        const byteLen = frame.data.byteLength ?? frame.data.length ?? frame.data.buffer.byteLength;
        // YUV420p I420: wrtc allocates UV planes with ceil(w/2)*ceil(h/2) for odd dimensions
        const ew = session.videoWidth, eh = session.videoHeight;
        const expectedSize = ew * eh + Math.ceil(ew / 2) * Math.ceil(eh / 2) * 2;

        let pipeData;
        if (byteLen !== expectedSize) {
          const fw = typeof frame.width === 'number' ? frame.width : 0;
          const fh = typeof frame.height === 'number' ? frame.height : 0;
          if (fw > 0 && fh > 0) {
            const src = Buffer.from(frame.data.buffer, frame.data.byteOffset ?? 0, byteLen);
            pipeData = scaleI420(src, fw, fh, TARGET_WIDTH, TARGET_HEIGHT);
            if (session.frameCount <= 3) console.log('[relay] scaled frame %dx%d → %dx%d session=%s', fw, fh, TARGET_WIDTH, TARGET_HEIGHT, session.id);
          } else {
            return;
          }
        } else {
          pipeData = Buffer.allocUnsafe(byteLen);
          pipeData.set(new Uint8Array(frame.data.buffer, frame.data.byteOffset ?? 0, byteLen));
        }

        if (!session.latestFrameBuf || session.latestFrameBuf.length !== pipeData.length) {
          session.latestFrameBuf = Buffer.allocUnsafe(pipeData.length);
        }
        pipeData.copy(session.latestFrameBuf);

        // Primary rate-limited write: one frame per target interval.
        // More reliable than setInterval under event-loop load since this runs in the WebRTC callback.
        if (session.videoPipe && session.timerStartedAt) {
          const elapsed = Date.now() - session.timerStartedAt;
          const targetFrames = Math.floor(elapsed / (1000 / INPUT_FPS));
          if (targetFrames > session.framesWritten) {
            const writeBuf = Buffer.allocUnsafe(session.latestFrameBuf.length);
            session.latestFrameBuf.copy(writeBuf);
            session.videoPipe.write(writeBuf);
            session.framesWritten++;
            // Periodic timing log: every 5s (25 frames at 5fps)
            if (session.framesWritten % 25 === 0) {
              console.log('[relay] video timing: written=%d elapsed=%ds target=%ds session=%s',
                session.framesWritten, Math.round(elapsed / 1000),
                Math.round(session.framesWritten / INPUT_FPS), session.id);
            }
          }
        }

        if (!session.inactivityTimer) {
          session.inactivityTimer = setInterval(() => {
            if (Date.now() - session.lastVideoFrameAt > INACTIVITY_MS) {
              if (session.ffmpeg && session.latestFrameBuf) {
                console.warn('[relay] video frame gap=%dms; keeping ffmpeg alive with last frame session=%s', Date.now() - session.lastVideoFrameAt, session.id);
                session.lastVideoFrameAt = Date.now();
                return;
              }
              console.log('[relay] inactivity timeout gap=%dms session=%s', Date.now() - session.lastVideoFrameAt, session.id);
              stopSession(session.id);
            }
          }, 250);
        }
      };
    }

    if (track.kind === 'audio') {
      session.hasAudio = true;
      track.onended = () => stopSession(session.id);
      session.audioSink = new RTCAudioSink(track);
      let audioParamsLogged = false;
      session.audioSink.ondata = (data) => {
        if (!data?.samples) return;
        if (diagnosticsEnabled) {
          session.audioPackets++;
          session.audioSamples += data.numberOfFrames || 0;
          session.audioObservedSampleRate = data.sampleRate;
          session.audioObservedChannels = data.channelCount;
          if (data.samples.some((sample) => Math.abs(sample) > 100)) session.audioNonSilentPackets++;
        }
        // Capture real audio params from first packet and update session before FFmpeg starts
        if (!audioParamsLogged) {
          audioParamsLogged = true;
          const sr = data.sampleRate ?? session.audioSampleRate;
          const ch = data.channelCount ?? session.audioChannels;
          if (sr !== session.audioSampleRate || ch !== session.audioChannels) {
            session.audioSampleRate = sr;
            session.audioChannels = ch;
          }
          console.log('[relay] audio params — sampleRate=%d channels=%d bitsPerSample=%d numberOfFrames=%d samplesLength=%d session=%s',
            sr, ch, data.bitsPerSample ?? 16, data.numberOfFrames ?? -1, data.samples?.length ?? -1, session.id);
        }
        // Explicit byte count: data.samples is Int16Array, 2 bytes per sample.
        const sampleBytes = data.samples.length * 2;
        const buf = Buffer.from(data.samples.buffer, data.samples.byteOffset ?? 0, sampleBytes);
        if (!session.audioPipe) return;
        session.audioPipe.write(buf);
      };
    }
  };

  const vp8Match = sdpOffer.match(/a=rtpmap:(\d+) VP8\//i);
  const h264Match = sdpOffer.match(/a=rtpmap:(\d+) H264\//i);
  console.log('[relay] offer codecs — VP8=%s H264=%s session=%s', !!vp8Match, !!h264Match, session.id);

  return pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer })
    .then(() => pc.createAnswer())
    .then((answer) => pc.setLocalDescription(answer))
    .then(async () => {
      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const done = () => {
          clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        };
        const check = () => { if (pc.iceGatheringState === 'complete') done(); };
        const timer = setTimeout(done, 8000);
        pc.addEventListener('icegatheringstatechange', check);
      });
      return { sessionId: session.id, sdpAnswer: pc.localDescription?.sdp || '' };
    });
}

function stopSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || session.stopping) return false;
  session.stopping = true;
  sessions.delete(sessionId);
  console.log('[relay] stop session=%s', sessionId);

  if (session.inactivityTimer) {
    clearInterval(session.inactivityTimer);
    session.inactivityTimer = null;
  }
  if (session.videoWriteTimer) {
    clearInterval(session.videoWriteTimer);
    session.videoWriteTimer = null;
    console.log('[relay] write timer stopped framesWritten=%d session=%s', session.framesWritten, sessionId);
  }
  try { session.audioSink?.stop?.(); } catch {}
  try { session.videoSink?.stop?.(); } catch {}
  try { session.pc?.close?.(); } catch {}

  const ffmpeg = session.ffmpeg;
  const videoPipe = session.videoPipe;
  const audioPipe = session.audioPipe;
  session.videoPipe = null;
  session.audioPipe = null;

  if (!ffmpeg) return true;

  // Shutdown: SIGTERM first so FFmpeg flushes encoder + finalizes RTMPS while connection is still open.
  // Ending pipes before SIGTERM causes FFmpeg to write the FLV finalizer when Cloudflare has already
  // closed the RTMPS connection → write error → exit 255 → truncated/corrupted recording.
  setTimeout(() => { try { ffmpeg.kill('SIGTERM'); } catch {} }, 100);
  setTimeout(() => {
    try { videoPipe?.end(); } catch {}
    try { audioPipe?.end(); } catch {}
  }, 500);
  const killTimer = setTimeout(() => {
    if (ffmpeg.exitCode !== null || ffmpeg.signalCode !== null) return;
    try { ffmpeg.kill('SIGKILL'); } catch {}
  }, 10000);
  ffmpeg.once('exit', () => clearTimeout(killTimer));

  return true;
}

app.get('/', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    sessions: sessions.size,
    maxSessions: MAX_CONCURRENT_SESSIONS,
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    authRequired: !!RELAY_AUTH_TOKEN,
    nodeVersion: process.version,
  });
});

if (diagnosticsEnabled) {
  app.get('/sessions/:sessionId', async (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Unknown session' }); return; }
    try {
      const stats = await session.pc.getStats();
      const reports = [...stats.values()];
      const pair = reports.find((report) => report.type === 'candidate-pair' && report.nominated && report.state === 'succeeded');
      const local = pair && stats.get(pair.localCandidateId);
      const remote = pair && stats.get(pair.remoteCandidateId);
      res.json({
        connectionState: session.pc.connectionState,
        iceConnectionState: session.pc.iceConnectionState,
        selectedPair: pair ? {
          localType: local?.candidateType, remoteType: remote?.candidateType,
          protocol: local?.protocol, currentRoundTripTime: pair.currentRoundTripTime,
          bytesReceived: pair.bytesReceived, bytesSent: pair.bytesSent,
        } : null,
        inbound: reports.filter((report) => report.type === 'inbound-rtp').map((report) => ({
          kind: report.kind, bytesReceived: report.bytesReceived, packetsReceived: report.packetsReceived,
          packetsLost: report.packetsLost, jitter: report.jitter, framesDecoded: report.framesDecoded,
        })),
        frameCount: session.frameCount, framesWritten: session.framesWritten,
        audioPackets: session.audioPackets, audioSamples: session.audioSamples,
        audioNonSilentPackets: session.audioNonSilentPackets,
        audioSampleRate: session.audioObservedSampleRate, audioChannels: session.audioObservedChannels,
        ffmpegPid: session.ffmpeg?.pid, ffmpegProgress: session.ffmpegProgress,
        ffmpegExit: session.ffmpegExit, ffmpegError: session.ffmpegError,
        videoBufferedBytes: session.videoPipe?.writableLength || 0,
        audioBufferedBytes: session.audioPipe?.writableLength || 0,
        processRss: process.memoryUsage().rss,
        processCpuMicros: process.cpuUsage(),
      });
    } catch { res.status(500).json({ error: 'Stats unavailable' }); }
  });
}

app.post('/sessions', async (req, res) => {
  try {
    if (RELAY_AUTH_TOKEN) {
      const provided = req.get('x-relay-token') || '';
      if (provided !== RELAY_AUTH_TOKEN) {
        console.warn('[relay] 401 missing/invalid x-relay-token');
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
    }
    if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
      console.warn('[relay] 429 session cap reached: %d/%d', sessions.size, MAX_CONCURRENT_SESSIONS);
      res.status(429).json({ error: 'relay at capacity', current: sessions.size, max: MAX_CONCURRENT_SESSIONS });
      return;
    }
    const { liveInputId, ingestUrl, streamKey, sdpOffer, title, iceServers } = req.body || {};
    if (!liveInputId || !ingestUrl || !streamKey || !sdpOffer) {
      res.status(400).json({ error: 'Missing liveInputId, ingestUrl, streamKey, or sdpOffer' });
      return;
    }
    const result = await startSession({ liveInputId, ingestUrl, streamKey, sdpOffer, title, iceServers });
    res.json(result);
  } catch (err) {
    console.error('[relay] session create failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'failed to start session' });
  }
});

app.delete('/sessions/:sessionId', (req, res) => {
  const ok = stopSession(req.params.sessionId);
  res.status(200).json({ ok, alreadyClosed: !ok });
});

const server = existsSync(certPath) && existsSync(keyPath)
  ? https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath) }, app)
  : http.createServer(app);
const protocol = server instanceof https.Server ? 'https' : 'http';

server.listen(port, host, () => {
  console.log(`[relay] listening on ${protocol}://${host}:${port} — ffmpeg=${ffmpegPath} fps=${INPUT_FPS} mode=cfr maxSessions=${MAX_CONCURRENT_SESSIONS} authRequired=${!!RELAY_AUTH_TOKEN}`);
});
