import wrtc from '@roamhq/wrtc';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const relayUrl = new URL(process.env.TEST_RELAY_URL || 'https://127.0.0.1:8787');
const seconds = Number(process.env.TEST_SECONDS || 60);
const output = process.env.TEST_OUTPUT || '/tmp/vuvio-relay-local';
const ffmpeg = process.env.FFMPEG_PATH || '/usr/local/bin/ffmpeg';
const iceServers = process.env.TEST_ICE_FILE
  ? JSON.parse(fs.readFileSync(process.env.TEST_ICE_FILE, 'utf8')).iceServers : [];
const destination = process.env.TEST_DEST_FILE
  ? JSON.parse(fs.readFileSync(process.env.TEST_DEST_FILE, 'utf8')) : null;
if (destination && (!destination.url?.startsWith('rtmps://') || !destination.streamKey)) {
  throw new Error('Expected a test RTMPS URL and streamKey in TEST_DEST_FILE');
}
const report = { startedAt: new Date().toISOString(), syntheticMedia: true, seconds, samples: [] };
const log = (event, data) => console.log(event, JSON.stringify(data));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const call = (method, path, body) => new Promise((resolve, reject) => {
  const request = https.request(new URL(path, relayUrl), {
    method, rejectUnauthorized: process.env.TEST_TRUST_LOCAL_CERT === '1' ? false : true,
    headers: { 'Content-Type': 'application/json' },
  }, (response) => {
    let body = '';
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => {
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid relay JSON')); }
    });
  });
  request.setTimeout(15000, () => request.destroy(new Error('HTTP timeout')));
  request.on('error', reject);
  if (body) request.write(JSON.stringify(body));
  request.end();
});
const gather = (pc) => new Promise((resolve, reject) => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const timer = setTimeout(() => {
    pc.removeEventListener('icegatheringstatechange', check);
    reject(new Error('ICE gathering incomplete; refusing a partial SDP'));
  }, 12000);
  const check = () => {
    if (pc.iceGatheringState !== 'complete') return;
    clearTimeout(timer);
    pc.removeEventListener('icegatheringstatechange', check);
    resolve();
  };
  pc.addEventListener('icegatheringstatechange', check);
});
const candidateSummary = (sdp) => sdp.split(/\r?\n/).filter((line) => line.startsWith('a=candidate:')).map((line) => {
  const parts = line.split(' ');
  return { type: parts[parts.indexOf('typ') + 1], protocol: parts[2] };
});
const { RTCPeerConnection, nonstandard: { RTCVideoSource, RTCAudioSource } } = wrtc;
const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceTransportPolicy: process.env.TEST_FORCE_TURN === '1' ? 'relay' : 'all' });
const video = new RTCVideoSource();
const audio = new RTCAudioSource();
const videoTrack = video.createTrack();
const audioTrack = audio.createTrack();
pc.addTransceiver(videoTrack, { direction: 'sendonly' });
pc.addTransceiver(audioTrack, { direction: 'sendonly' });
let receiver;
let receiverExit;
let tunnel;
let sessionId;
let audioTimer;
let videoTimer;
let audioSamples = 0;
let sourceFrames = 0;
let decodedFrames = 0;
let received = Buffer.alloc(0);
let mediaStartedAt;
const latencies = [];
const sockets = new Set();
const deadline = setTimeout(() => { console.error('TEST_DEADLINE'); process.exit(2); }, (seconds + 45) * 1000);

try {
  await call('GET', '/healthz');
  if (!destination) {
    receiver = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'warning', '-fflags', 'nobuffer', '-probesize', '32768', '-analyzeduration', '0',
      '-listen', '1', '-i', 'rtmp://127.0.0.1:19350/live/test',
      '-map', '0:v', '-map', '0:a', '-c', 'copy', '-y', `${output}.flv`,
      '-map', '0:v', '-an', '-vf', 'crop=240:16:0:0,format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    receiverExit = new Promise((resolve) => receiver.on('exit', (code, signal) => resolve({ code, signal })));
    receiver.stderr.on('data', (chunk) => log('RECEIVER', chunk.toString().trim()));
    receiver.stdout.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      while (received.length >= 240 * 16) {
        const frame = received.subarray(0, 240 * 16);
        let marker = 0;
        for (let bit = 0; bit < 24; bit++) if (frame[8 * 240 + bit * 10 + 5] > 128) marker += 2 ** bit;
        if (mediaStartedAt && marker > 0) latencies.push(performance.now() - mediaStartedAt - marker);
        decodedFrames++;
        received = received.subarray(240 * 16);
      }
    });
    receiver.on('error', (error) => log('RECEIVER_ERROR', error.code));
    await delay(500);
    if (receiver.exitCode !== null) throw new Error('Local RTMP receiver failed to start');
    tunnel = tls.createServer({
      cert: fs.readFileSync(fileURLToPath(new URL('../certs/cert.pem', import.meta.url))),
      key: fs.readFileSync(fileURLToPath(new URL('../certs/key.pem', import.meta.url))),
    }, (socket) => {
      const upstream = net.connect(19350, '127.0.0.1');
      for (const connection of [socket, upstream]) {
        sockets.add(connection);
        connection.on('close', () => sockets.delete(connection));
        connection.on('error', () => { socket.destroy(); upstream.destroy(); });
      }
      socket.pipe(upstream).pipe(socket);
    });
    await new Promise((resolve, reject) => { tunnel.once('error', reject); tunnel.listen(19351, '127.0.0.1', resolve); });
  }
  pc.onicecandidateerror = (event) => log('ICE_ERROR', { code: event.errorCode });
  pc.oniceconnectionstatechange = () => log('ICE_STATE', pc.iceConnectionState);
  let connectedResolve;
  let connectedReject;
  const connected = new Promise((resolve, reject) => { connectedResolve = resolve; connectedReject = reject; });
  pc.onconnectionstatechange = () => {
    log('CONNECTION_STATE', pc.connectionState);
    if (pc.connectionState === 'connected') connectedResolve();
    if (pc.connectionState === 'failed') connectedReject(new Error('ICE failed'));
  };
  await pc.setLocalDescription(await pc.createOffer());
  await gather(pc);
  report.offerCandidates = candidateSummary(pc.localDescription.sdp);
  log('OFFER_CANDIDATES', report.offerCandidates);
  const started = performance.now();
  const target = destination || { url: 'rtmps://127.0.0.1:19351/live', streamKey: 'test' };
  const answer = await call('POST', '/sessions', {
    liveInputId: `local-test-${Date.now()}`, ingestUrl: target.url, streamKey: target.streamKey,
    sdpOffer: pc.localDescription.sdp, iceServers,
  });
  sessionId = answer.sessionId;
  report.answerCandidates = candidateSummary(answer.sdpAnswer);
  await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdpAnswer });
  let connectionTimer;
  try {
    await Promise.race([connected, new Promise((_, reject) => {
      connectionTimer = setTimeout(() => reject(new Error('ICE connectivity timeout')), 12000);
    })]);
  } finally { clearTimeout(connectionTimer); }
  report.iceConnectedMs = performance.now() - started;
  log('ICE_CONNECTED_MS', report.iceConnectedMs);
  mediaStartedAt = performance.now();
  videoTimer = setInterval(() => {
    const width = 854, height = 480;
    const data = new Uint8ClampedArray(width * height * 3 / 2);
    data.fill(128);
    data.fill(32, 0, width * height);
    const marker = Math.floor(performance.now() - mediaStartedAt);
    for (let bit = 0; bit < 24; bit++) {
      const value = marker & (1 << bit) ? 220 : 32;
      for (let row = 0; row < 16; row++) data.fill(value, row * width + bit * 10, row * width + bit * 10 + 10);
    }
    const x = (sourceFrames * 8) % (width - 80);
    for (let row = 120; row < 360; row++) data.fill(210, row * width + x, row * width + x + 80);
    video.onFrame({ width, height, data });
    sourceFrames++;
  }, 1000 / 15);
  audioTimer = setInterval(() => {
    const expected = Math.floor((performance.now() - mediaStartedAt) / 10) * 480;
    for (let packet = 0; packet < 3 && audioSamples < expected; packet++) {
      const samples = new Int16Array(480);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.round(10000 * Math.sin(2 * Math.PI * 1000 * (audioSamples + i) / 48000));
      audioSamples += 480;
      audio.onData({ samples, sampleRate: 48000, bitsPerSample: 16, channelCount: 1, numberOfFrames: 480 });
    }
  }, 5);
  for (let elapsed = 0; elapsed < seconds; elapsed += 5) {
    await delay(Math.min(5, seconds - elapsed) * 1000);
    const stats = await call('GET', `/sessions/${sessionId}`);
    let processResources = '';
    if (stats.ffmpegPid) processResources = execFileSync('/bin/ps', ['-p', String(stats.ffmpegPid), '-o', '%cpu=,rss='], { encoding: 'utf8' }).trim();
    const sample = { elapsed: Math.round(performance.now() - mediaStartedAt), sourceFrames, sourceAudioSamples: audioSamples, decodedFrames, ffmpegCpuRss: processResources, ...stats };
    report.samples.push(sample);
    log('SAMPLE', sample);
    if (stats.connectionState !== 'connected') throw new Error('Connection lost during media test');
    if (stats.ffmpegError || stats.ffmpegExit) throw new Error('FFmpeg failed during media test');
    if (elapsed >= 5 && !stats.frameCount) throw new Error('No decoded video frames');
    if (elapsed >= 10 && !stats.ffmpegProgress) throw new Error('Encoder has not produced output');
    if (elapsed >= 10 && !stats.audioNonSilentPackets) throw new Error('No non-silent audio received');
    if (elapsed >= 10 && !destination && !decodedFrames) throw new Error('Local RTMPS output not decoded');
  }
  report.transportPassed = true;
} catch (error) {
  report.error = error.message;
  log('TEST_ERROR', error.message);
  process.exitCode = 1;
} finally {
  clearInterval(videoTimer);
  clearInterval(audioTimer);
  if (sessionId) {
    try { report.cleanup = await call('DELETE', `/sessions/${sessionId}`); } catch (error) { report.cleanupError = error.message; }
  }
  videoTrack.stop();
  audioTrack.stop();
  pc.close();
  if (receiver) {
    const exit = await Promise.race([receiverExit, delay(4000).then(() => null)]);
    if (!exit) receiver.kill('SIGTERM');
    report.receiverExit = exit;
  }
  for (const socket of sockets) socket.destroy();
  if (tunnel) await new Promise((resolve) => tunnel.close(resolve));
  latencies.sort((a, b) => a - b);
  report.localDecodedFrames = decodedFrames;
  report.localReceiveLatencyMs = latencies.length ? {
    count: latencies.length, p50: latencies[Math.floor(latencies.length * 0.5)], p95: latencies[Math.floor(latencies.length * 0.95)], max: latencies.at(-1),
  } : null;
  report.platformReceptionVerified = false;
  fs.writeFileSync(`${output}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  clearTimeout(deadline);
  log('REPORT', { file: `${output}.json`, transportPassed: report.transportPassed || false, platformReceptionVerified: false, latency: report.localReceiveLatencyMs });
  setTimeout(() => process.exit(process.exitCode || 0), 250);
}
