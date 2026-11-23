import { isNativePlatform } from './platform.js';

export async function requestVuvioMediaStream(constraints = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not available in this environment.');
  }

  const defaultConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: true,
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      ...defaultConstraints,
      ...constraints,
    });
  } catch (err) {
    if (isNativePlatform()) {
      console.warn('[mobile] media permission or capture failed:', err.name, err.message);
    }
    throw err;
  }
}
