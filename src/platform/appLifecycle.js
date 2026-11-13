import { App as CapacitorApp } from '@capacitor/app';
import { isNativePlatform } from './platform.js';

export function initAppLifecycle() {
  if (!isNativePlatform()) return undefined;

  const removers = [];
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('vuvio:app-state', { detail: { isActive } }));
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] appStateChange listener failed:', err.message);
  });

  CapacitorApp.addListener('pause', () => {
    window.dispatchEvent(new CustomEvent('vuvio:app-pause'));
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] pause listener failed:', err.message);
  });

  CapacitorApp.addListener('resume', () => {
    window.dispatchEvent(new CustomEvent('vuvio:app-resume'));
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] resume listener failed:', err.message);
  });

  return () => removers.forEach((handle) => handle.remove?.());
}
