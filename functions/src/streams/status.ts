import type { StreamStatus } from '../types/stream.js';

export function assertStatus(current: StreamStatus, allowed: StreamStatus[], action: string) {
  if (!allowed.includes(current)) {
    return `${action} is not allowed while stream is ${current}`;
  }
  return null;
}
