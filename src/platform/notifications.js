import { PushNotifications } from '@capacitor/push-notifications';
import { isNativePlatform } from './platform.js';

function notificationRoute(data = {}) {
  if (data.type === 'live' && data.liveId) return `/watch?live=${encodeURIComponent(data.liveId)}&mode=view`;
  if (data.type === 'replay' && data.liveId) return `/live/${encodeURIComponent(data.liveId)}/recap`;
  if (data.type === 'profile' && data.creatorId) return `/profile/${encodeURIComponent(data.creatorId)}`;
  return null;
}

export async function requestPushNotifications() {
  if (!isNativePlatform()) return { registered: false, reason: 'web' };

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return { registered: false, reason: 'denied' };

  await PushNotifications.register();
  return { registered: true };
}

export function initPushNotificationRouting(navigate) {
  if (!isNativePlatform()) return undefined;

  const removers = [];
  PushNotifications.addListener('registration', (token) => {
    window.dispatchEvent(new CustomEvent('vuvio:push-token', { detail: { token: token.value } }));
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] push registration listener failed:', err.message);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.warn('[mobile] push registration failed:', error.error);
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] push error listener failed:', err.message);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const route = notificationRoute(event.notification?.data);
    if (route) navigate(route);
  }).then((handle) => removers.push(handle)).catch((err) => {
    console.warn('[mobile] push action listener failed:', err.message);
  });

  return () => removers.forEach((handle) => handle.remove?.());
}
