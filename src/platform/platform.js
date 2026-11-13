import { Capacitor } from '@capacitor/core';

export const VUVIO_WEB_ORIGIN = 'https://vuvio.app';

export function getPlatform() {
  return Capacitor.getPlatform();
}

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function isIOS() {
  return getPlatform() === 'ios';
}

export function isAndroid() {
  return getPlatform() === 'android';
}

export function getAnalyticsPlatform() {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'web';
}

export function toPublicVuvioUrl(url = '/') {
  if (!url) return VUVIO_WEB_ORIGIN;
  try {
    const parsed = new URL(url, VUVIO_WEB_ORIGIN);
    if (parsed.hostname === 'localhost' || parsed.protocol === 'capacitor:') {
      return `${VUVIO_WEB_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return `${VUVIO_WEB_ORIGIN}${String(url).startsWith('/') ? '' : '/'}${url}`;
  }
}
