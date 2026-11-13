import { App as CapacitorApp } from '@capacitor/app';
import { isAndroid } from './platform.js';

export function initAndroidBackButton({ navigate, getPath }) {
  if (!isAndroid()) return undefined;

  let removeListener;
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const path = getPath?.() || window.location.pathname;
    const liveCritical = path === '/watch' || path.startsWith('/live/');

    if (canGoBack && window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (liveCritical) return;
    CapacitorApp.exitApp();
  }).then((handle) => {
    removeListener = handle;
  }).catch((err) => {
    console.warn('[mobile] android back listener failed:', err.message);
  });

  return () => {
    removeListener?.remove?.();
  };
}
