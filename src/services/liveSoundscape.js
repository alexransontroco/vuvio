const MASTER_GAIN = 0.86;

let audioContext;
let noiseBuffer;

function getAudioContext() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

function resumeAudio() {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    context.resume();
  }
  return context;
}

function getNoiseBuffer(context) {
  if (noiseBuffer) return noiseBuffer;

  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const output = buffer.getChannelData(0);

  for (let i = 0; i < output.length; i += 1) {
    output[i] = Math.random() * 2 - 1;
  }

  noiseBuffer = buffer;
  return noiseBuffer;
}

function connectGain(context, destination, value) {
  const gain = context.createGain();
  gain.gain.value = value;
  gain.connect(destination);
  return gain;
}

function addNoiseLayer(context, destination, { gain = 0.08, frequency = 900, q = 0.8, type = 'bandpass' }) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const output = connectGain(context, destination, gain);

  source.buffer = getNoiseBuffer(context);
  source.loop = true;
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  source.connect(filter);
  filter.connect(output);
  source.start();

  return () => source.stop();
}

function addOscillator(context, destination, { gain = 0.06, frequency = 90, type = 'sine' }) {
  const oscillator = context.createOscillator();
  const output = connectGain(context, destination, gain);

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(output);
  oscillator.start();

  return { oscillator, stop: () => oscillator.stop() };
}

function addPulse(context, destination, { gain = 0.08, frequency = 180, duration = 0.06, type = 'triangle' }) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const output = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(output);
  output.connect(destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function addStartTone(context, destination) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const output = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(620, now);
  oscillator.frequency.exponentialRampToValueAtTime(380, now + 0.14);
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  oscillator.connect(output);
  output.connect(destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
}

function addRepeatingPulse(context, destination, options) {
  const tick = () => addPulse(context, destination, options);
  tick();
  const interval = window.setInterval(tick, options.interval);
  return () => window.clearInterval(interval);
}

function soundProfile(live) {
  const id = live.id;

  if (id.includes('motorbike') || id.includes('buggy')) return 'engine';
  if (id.includes('biking') || id.includes('cyclist')) return 'bike';
  if (id.includes('skate')) return 'wheels';
  if (id.includes('horseback')) return 'trail';
  if (id.includes('runner')) return 'steps';
  if (id.includes('sailor') || id.includes('surf')) return 'water';
  if (id.includes('glacier') || id.includes('helicopter') || id.includes('lofoten')) return 'wind';
  if (id.includes('train')) return 'rail';
  if (id.includes('chef')) return 'kitchen';
  if (id.includes('firefighter')) return 'drill';
  return 'ambient';
}

function buildProfile(context, destination, profile) {
  const stops = [];

  if (profile === 'engine') {
    const engine = addOscillator(context, destination, { type: 'sawtooth', frequency: 68, gain: 0.055 });
    const rumble = addOscillator(context, destination, { type: 'sine', frequency: 36, gain: 0.06 });
    stops.push(engine.stop, rumble.stop);
    stops.push(addNoiseLayer(context, destination, { gain: 0.055, frequency: 420, q: 0.9 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 180, gain: 0.035, frequency: 92, duration: 0.045 }));
    return stops;
  }

  if (profile === 'bike') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.07, frequency: 1500, q: 0.8 }));
    stops.push(addNoiseLayer(context, destination, { gain: 0.04, frequency: 260, q: 1.2 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 230, gain: 0.035, frequency: 210, duration: 0.035 }));
    return stops;
  }

  if (profile === 'wheels') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.075, frequency: 720, q: 2.2 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 130, gain: 0.03, frequency: 260, duration: 0.026 }));
    return stops;
  }

  if (profile === 'trail' || profile === 'steps') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.04, frequency: 900, q: 0.7 }));
    stops.push(addRepeatingPulse(context, destination, { interval: profile === 'trail' ? 420 : 330, gain: 0.07, frequency: 130, duration: 0.075 }));
    return stops;
  }

  if (profile === 'water') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.08, frequency: 620, q: 0.6, type: 'lowpass' }));
    stops.push(addNoiseLayer(context, destination, { gain: 0.04, frequency: 1900, q: 1.1 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 760, gain: 0.045, frequency: 180, duration: 0.12 }));
    return stops;
  }

  if (profile === 'rail') {
    const tone = addOscillator(context, destination, { type: 'sine', frequency: 72, gain: 0.04 });
    stops.push(tone.stop);
    stops.push(addNoiseLayer(context, destination, { gain: 0.055, frequency: 520, q: 1.4 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 210, gain: 0.052, frequency: 150, duration: 0.045 }));
    return stops;
  }

  if (profile === 'kitchen') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.035, frequency: 1300, q: 0.9 }));
    stops.push(addRepeatingPulse(context, destination, { interval: 1120, gain: 0.035, frequency: 520, duration: 0.05 }));
    return stops;
  }

  if (profile === 'drill') {
    stops.push(addNoiseLayer(context, destination, { gain: 0.06, frequency: 380, q: 0.9 }));
    stops.push(addNoiseLayer(context, destination, { gain: 0.035, frequency: 1600, q: 0.7 }));
    return stops;
  }

  stops.push(addNoiseLayer(context, destination, { gain: 0.055, frequency: 760, q: 0.65 }));
  stops.push(addNoiseLayer(context, destination, { gain: 0.035, frequency: 1800, q: 0.75 }));
  return stops;
}

export function createLiveSoundscape(live) {
  const context = resumeAudio();
  const compressor = context.createDynamicsCompressor();
  const master = connectGain(context, compressor, MASTER_GAIN);

  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.22;
  compressor.connect(context.destination);

  addStartTone(context, master);
  const stops = buildProfile(context, master, soundProfile(live));

  return {
    stop() {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      window.setTimeout(() => {
        stops.forEach((stop) => stop());
        master.disconnect();
        compressor.disconnect();
      }, 180);
    },
  };
}
