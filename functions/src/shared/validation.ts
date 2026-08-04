import { ApiError } from './errors.js';
import type { StreamEnvironment, StreamVisibility } from '../types/stream.js';

const environments = new Set<StreamEnvironment>(['land', 'water', 'air', 'urban', 'other']);
const visibilities = new Set<StreamVisibility>(['public', 'followers', 'private']);

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('bad_request', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
}

export function stringField(input: Record<string, unknown>, key: string, options: { required?: boolean; max?: number } = {}) {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.required) throw new ApiError('bad_request', `${key} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new ApiError('bad_request', `${key} must be a string`);
  const trimmed = value.trim();
  if (options.required && !trimmed) throw new ApiError('bad_request', `${key} is required`);
  if (options.max && trimmed.length > options.max) throw new ApiError('bad_request', `${key} is too long`);
  return trimmed;
}

export function stringArray(input: Record<string, unknown>, key: string, maxItems: number, maxLength = 48) {
  const value = input[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError('bad_request', `${key} must be an array`);
  if (value.length > maxItems) throw new ApiError('bad_request', `${key} has too many items`);
  return [...new Set(value.map((item) => {
    if (typeof item !== 'string') throw new ApiError('bad_request', `${key} must contain strings`);
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > maxLength) throw new ApiError('bad_request', `${key} contains an invalid value`);
    return trimmed;
  }))];
}

export function parseEnvironment(value: unknown): StreamEnvironment {
  if (typeof value !== 'string' || !environments.has(value as StreamEnvironment)) {
    throw new ApiError('bad_request', 'environment is invalid');
  }
  return value as StreamEnvironment;
}

export function parseVisibility(value: unknown): StreamVisibility {
  if (value === undefined || value === null) return 'public';
  if (typeof value !== 'string' || !visibilities.has(value as StreamVisibility)) {
    throw new ApiError('bad_request', 'visibility is invalid');
  }
  return value as StreamVisibility;
}

export function parseApproximateLocation(input: Record<string, unknown>) {
  const location = input.approximateLocation;
  if (location === undefined || location === null) return null;
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new ApiError('bad_request', 'approximateLocation is invalid');
  }
  const raw = location as Record<string, unknown>;
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new ApiError('bad_request', 'latitude is invalid');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ApiError('bad_request', 'longitude is invalid');
  }
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
  };
}

export function parseLimit(value: unknown, fallback = 20, max = 50) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export function safeMetadata(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('bad_request', 'metadata must be an object');
  }
  const json = JSON.stringify(value);
  if (json.length > 2048) throw new ApiError('bad_request', 'metadata is too large');
  return JSON.parse(json) as Record<string, unknown>;
}
