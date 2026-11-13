import { Share } from '@capacitor/share';
import { isNativePlatform, toPublicVuvioUrl } from './platform.js';

export async function shareVuvioContent({ title = 'Vuvio', text = '', url = '/', files } = {}) {
  const publicUrl = toPublicVuvioUrl(url);

  if (isNativePlatform()) {
    try {
      await Share.share({ title, text, url: publicUrl, dialogTitle: title });
      return { success: true, native: true };
    } catch (err) {
      if (err?.message?.toLowerCase?.().includes('cancel')) return { success: false, cancelled: true };
      console.warn('[mobile] native share failed:', err.message);
    }
  }

  if (navigator.share) {
    try {
      if (files?.length && navigator.canShare?.({ files })) {
        await navigator.share({ title, text, url: publicUrl, files });
      } else {
        await navigator.share({ title, text, url: publicUrl });
      }
      return { success: true, native: false };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      console.warn('[share] web share failed:', err.message);
    }
  }

  try {
    await navigator.clipboard.writeText(publicUrl);
    return { success: true, fallback: 'copied' };
  } catch {
    return { success: false, fallback: 'copy-failed' };
  }
}
