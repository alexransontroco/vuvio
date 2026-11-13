import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from './platform.js';

const PUBLIC_HOSTS = new Set(['vuvio.app', 'www.vuvio.app']);

export function routeFromVuvioUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!PUBLIC_HOSTS.has(url.hostname)) return null;

    if (url.pathname.startsWith('/share/live/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      const liveId = parts[2];
      if (liveId && parts[3] === 'recap') return `/live/${encodeURIComponent(liveId)}/recap`;
      if (liveId) return `/watch?live=${encodeURIComponent(liveId)}&mode=view`;
    }

    if (/^\/live\/[^/]+$/.test(url.pathname)) {
      const liveId = url.pathname.split('/')[2];
      return `/watch?live=${encodeURIComponent(liveId)}&mode=view`;
    }

    return `${url.pathname}${url.search}${url.hash}` || '/watch';
  } catch (err) {
    console.warn('[mobile] invalid deep link:', err.message);
    return null;
  }
}

export function initDeepLinks(navigate) {
  if (!isNativePlatform()) return undefined;

  let removeListener;
  CapacitorApp.addListener('appUrlOpen', (event) => {
    const route = routeFromVuvioUrl(event.url);
    if (route) navigate(route);
  }).then((handle) => {
    removeListener = handle;
  }).catch((err) => {
    console.warn('[mobile] deep link listener failed:', err.message);
  });

  return () => {
    removeListener?.remove?.();
  };
}
