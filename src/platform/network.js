import { Network } from '@capacitor/network';
import { isNativePlatform } from './platform.js';

export async function getCurrentNetworkStatus() {
  if (!isNativePlatform()) {
    return { connected: navigator.onLine, connectionType: 'unknown' };
  }
  return Network.getStatus();
}

export function initNetworkStatus() {
  if (!isNativePlatform()) return undefined;

  let removeListener;
  Network.addListener('networkStatusChange', (status) => {
    window.dispatchEvent(new CustomEvent('vuvio:network-status', { detail: status }));
  }).then((handle) => {
    removeListener = handle;
  }).catch((err) => {
    console.warn('[mobile] network listener failed:', err.message);
  });

  return () => {
    removeListener?.remove?.();
  };
}
