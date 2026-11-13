import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { isNativePlatform } from './platform.js';

export async function initializeMobilePlatform() {
  if (!isNativePlatform()) return;

  document.documentElement.classList.add('is-capacitor');

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050816' });
  } catch (err) {
    console.warn('[mobile] status bar init failed:', err.message);
  }

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: true });
  } catch (err) {
    console.warn('[mobile] keyboard init failed:', err.message);
  }

  window.addEventListener('load', () => {
    SplashScreen.hide().catch((err) => {
      console.warn('[mobile] splash hide failed:', err.message);
    });
  }, { once: true });
}
