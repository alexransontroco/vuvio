import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from './platform.js';

export async function hapticImpact(style = ImpactStyle.Medium) {
  if (!isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch (err) {
    console.warn('[mobile] haptic impact failed:', err.message);
  }
}

export async function hapticSuccess() {
  if (!isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (err) {
    console.warn('[mobile] haptic notification failed:', err.message);
  }
}
