import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sampleRate = 24000;
const duration = 24;
const channels = 2;
const samples = sampleRate * duration;
const outputDir = join(process.cwd(), 'public/assets/audio');

const tracks = [
  { id: 'biking-dolomites', profile: 'downhill mountain bike' },
  { id: 'road-cyclist-mallorca', profile: 'smooth road cycling climb' },
  { id: 'motorbike-srinagar', profile: 'valley motorcycle ride' },
  { id: 'skate-portland', profile: 'longboard riverside pavement' },
  { id: 'buggy-marrakesh', profile: 'desert buggy track' },
  { id: 'horseback-cappadocia', profile: 'horseback sunset trail' },
  { id: 'runner-prague', profile: 'urban runner old town' },
  { id: 'dog-trainer-berlin', profile: 'quiet leash training walk' },
  { id: 'sailor-split', profile: 'sailing marina wind' },
  { id: 'glacier-guide-iceland', profile: 'glacier edge wind and ice' },
];

let seed = 9127;

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function noise() {
  return random() * 2 - 1;
}

function sine(time, frequency, phase = 0) {
  return Math.sin(time * frequency * Math.PI * 2 + phase);
}

function softClip(value) {
  return Math.tanh(value * 1.25);
}

function pulse(time, interval, width = 0.04, offset = 0) {
  const phase = (((time + offset) % interval) + interval) % interval;
  return Math.exp(-(phase / interval) / width);
}

function burst(time, at, width = 0.035) {
  const distance = Math.abs(time - at);
  return Math.exp(-(distance * distance) / (2 * width * width));
}

function filteredNoise(state, key, amount) {
  state[key] = (state[key] ?? 0) + (noise() - (state[key] ?? 0)) * amount;
  return state[key];
}

function wobble(time, rate, depth = 1) {
  return 1 + sine(time, rate) * depth;
}

function fade(index) {
  const fadeSamples = sampleRate * 0.45;
  return Math.min(1, index / fadeSamples, (samples - index) / fadeSamples);
}

function eventSeries(interval, jitter, start = 0) {
  const events = [];
  let time = start;
  while (time < duration + 1) {
    time += interval + (random() - 0.5) * jitter;
    events.push(time);
  }
  return events;
}

const generatedEvents = new Map();

function eventsFor(name, interval, jitter, start) {
  if (!generatedEvents.has(name)) {
    generatedEvents.set(name, eventSeries(interval, jitter, start));
  }
  return generatedEvents.get(name);
}

function eventTexture(time, events, width, tone, amount = 1) {
  let value = 0;
  for (const event of events) {
    if (Math.abs(time - event) < width * 5) {
      value += burst(time, event, width) * sine(time - event, tone) * amount;
    }
  }
  return value;
}

function povSample(profile, time, state) {
  const low = filteredNoise(state, 'low', 0.012);
  const mid = filteredNoise(state, 'mid', 0.045);
  const high = filteredNoise(state, 'high', 0.24);
  const air = filteredNoise(state, 'air', 0.1);

  switch (profile) {
    case 'downhill mountain bike': {
      const wind = (mid * 0.055 + high * 0.016) * wobble(time, 0.16, 0.12);
      const tire = low * 0.055 + sine(time, 72 + low * 4) * 0.024;
      const gravel = pulse(time, 0.24, 0.05) * high * 0.032;
      const brakeEvents = eventsFor(profile, 5.2, 2.1, 2.8);
      const brakes = eventTexture(time, brakeEvents, 0.045, 720, 0.018);
      const freehub = pulse(time, 0.18, 0.018) * sine(time, 540) * 0.007;
      return wind + tire + gravel + brakes + freehub;
    }

    case 'smooth road cycling climb': {
      const wind = (mid * 0.048 + high * 0.012) * wobble(time, 0.12, 0.08);
      const asphalt = low * 0.046 + sine(time, 82 + low * 3) * 0.018;
      const chain = pulse(time, 0.33, 0.038) * (0.011 + Math.abs(high) * 0.004);
      const breath = Math.max(0, sine(time, 0.64)) * mid * 0.012;
      return wind + asphalt + chain + breath;
    }

    case 'valley motorcycle ride': {
      const rpm = 64 + sine(time, 0.21) * 9 + low * 10;
      const engine = sine(time, rpm) * 0.24 + sine(time, rpm * 2.02) * 0.12 + sine(time, rpm * 3.96) * 0.035;
      const road = mid * 0.13 + high * 0.04;
      const wind = air * 0.12 * wobble(time, 0.31, 0.34);
      const throttle = Math.max(0, sine(time, 0.17)) * 0.08;
      return engine * (1 + throttle) + road + wind;
    }

    case 'longboard riverside pavement': {
      const wheelTone = sine(time, 138 + low * 18) * 0.11 + sine(time, 274) * 0.035;
      const pavement = mid * 0.22 + high * 0.055;
      const cracks = pulse(time, 0.34, 0.028) * high * 0.32;
      const carve = sine(time, 0.42) * mid * 0.08;
      return wheelTone + pavement + cracks + carve;
    }

    case 'desert buggy track': {
      const rpm = 49 + sine(time, 0.27) * 13 + low * 16;
      const engine = sine(time, rpm) * 0.27 + sine(time, rpm * 2.1) * 0.16 + sine(time, rpm * 4.2) * 0.045;
      const dust = mid * 0.18 + high * 0.07;
      const bumps = pulse(time, 0.18, 0.05) * low * 0.22 + pulse(time, 0.71, 0.035) * 0.19;
      return engine + dust + bumps;
    }

    case 'horseback sunset trail': {
      const hoofA = pulse(time, 0.54, 0.035) * 0.26;
      const hoofB = pulse(time, 0.54, 0.035, 0.18) * 0.21;
      const hoofC = pulse(time, 0.54, 0.042, 0.31) * 0.16;
      const dirt = (hoofA + hoofB + hoofC) * (0.65 + high * 0.5);
      const leather = eventTexture(time, eventsFor(profile, 1.8, 0.55, 0.6), 0.025, 420, 0.055);
      const breeze = mid * 0.08 + air * 0.035;
      return dirt + leather + breeze;
    }

    case 'urban runner old town': {
      const stride = 0.52 + sine(time, 0.08) * 0.03;
      const left = pulse(time, stride, 0.032) * 0.28;
      const right = pulse(time, stride, 0.032, stride / 2) * 0.24;
      const shoe = (left + right) * (0.8 + high * 0.35);
      const breath = Math.max(0, sine(time, 1.05)) * (0.04 + Math.abs(mid) * 0.12);
      const city = filteredNoise(state, 'city', 0.018) * 0.06 + sine(time, 220 + low * 7) * 0.018;
      return shoe + breath + city;
    }

    case 'quiet leash training walk': {
      const steps = pulse(time, 0.62, 0.045) * 0.11 + pulse(time, 0.42, 0.035, 0.18) * 0.08;
      const leash = eventTexture(time, eventsFor(profile, 1.35, 0.75, 0.5), 0.018, 760, 0.12);
      const park = mid * 0.075 + air * 0.025;
      return steps + leash + park;
    }

    case 'sailing marina wind': {
      const water = low * 0.13 + mid * 0.22;
      const waveEvents = eventsFor(profile, 1.45, 0.5, 0.3);
      const splashes = eventTexture(time, waveEvents, 0.11, 210, 0.24) + eventTexture(time, waveEvents, 0.045, 920, 0.08);
      const rigging = eventTexture(time, eventsFor(`${profile}-rig`, 2.8, 1.2, 1.1), 0.035, 1320, 0.065);
      const wind = air * 0.12 * wobble(time, 0.18, 0.35);
      return water + splashes + rigging + wind;
    }

    case 'glacier edge wind and ice': {
      const wind = (mid * 0.28 + high * 0.08) * wobble(time, 0.11, 0.42);
      const iceTicks = eventTexture(time, eventsFor(profile, 3.1, 1.6, 1.4), 0.018, 1180, 0.13);
      const distantCrack = eventTexture(time, eventsFor(`${profile}-crack`, 7.8, 3.2, 4.2), 0.14, 82, 0.18);
      return wind + iceTicks + distantCrack;
    }

    default:
      return mid * 0.12 + high * 0.03;
  }
}

function profilePan(profile, time) {
  switch (profile) {
    case 'downhill mountain bike':
    case 'longboard riverside pavement':
      return sine(time, 0.31) * 0.22;
    case 'sailing marina wind':
      return sine(time, 0.16) * 0.32;
    case 'valley motorcycle ride':
    case 'desert buggy track':
      return sine(time, 0.12) * 0.12;
    default:
      return sine(time, 0.09) * 0.08;
  }
}

function writeWav(profile) {
  const pcm = new Int16Array(samples * channels);
  const state = {};

  for (let i = 0; i < samples; i += 1) {
    const time = i / sampleRate;
    const center = softClip(povSample(profile, time, state)) * fade(i);
    const pan = profilePan(profile, time);
    const left = center * Math.sqrt((1 - pan) / 2) * 0.62;
    const right = center * Math.sqrt((1 + pan) / 2) * 0.62;

    pcm[i * 2] = Math.max(-32767, Math.min(32767, Math.round(left * 32767)));
    pcm[i * 2 + 1] = Math.max(-32767, Math.min(32767, Math.round(right * 32767)));
  }

  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < pcm.length; i += 1) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }

  return buffer;
}

mkdirSync(outputDir, { recursive: true });

for (const track of tracks) {
  generatedEvents.clear();
  seed = 9127 + track.id.length * 101;
  writeFileSync(join(outputDir, `${track.id}.wav`), writeWav(track.profile));
}
