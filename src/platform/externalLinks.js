import { Browser } from '@capacitor/browser';
import { isNativePlatform, VUVIO_WEB_ORIGIN } from './platform.js';

export function isInternalVuvioUrl(url) {
  try {
    const parsed = new URL(url, VUVIO_WEB_ORIGIN);
    return parsed.hostname === 'vuvio.app' || parsed.hostname === 'www.vuvio.app';
  } catch {
    return false;
  }
}

export async function openExternalUrl(url) {
  if (!url) return;
  if (isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
