// ─── Vuvio Share Watermark Service ───────────────────────────────────────────
//
// Generates watermarked assets for social sharing.
//
// Current capabilities:
//   ✓ createWatermarkedThumbnail(imageUrl) — 9:16 JPEG with Vuvio logo
//   ✗ createWatermarkedVideoClip()         — requires live buffer (not yet available)
//
// Watermark position rationale:
//   Bottom-left at ~16px margin keeps the logo away from:
//     - TikTok's right-side action buttons (like, comment, share, profile)
//     - Instagram's bottom "Send message" bar and top progress indicator
//     - Vuvio player UI elements
//
// "LIVE ON VUVIO" text appears on top of the watermarked thumbnail.
// When video clip sharing is added, display it for ~1.5s then fade to logo only.

const LOGO_URL = '/assets/logo/vuvio-logo.png';
const CANVAS_W = 1080;
const CANVAS_H = 1920; // 9:16

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// Fetch a remote image as an object URL to bypass canvas CORS taint.
// Falls back to the original URL (works for same-origin assets like the logo).
async function toSafeUrl(url) {
  if (!url) return null;
  // Same-origin (local assets) — no fetch needed
  if (url.startsWith('/') || url.startsWith(window.location.origin)) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    // CORS failed — return original and let canvas taint (export may fail but image renders)
    return url;
  }
}

// Draw the thumbnail as a cover-fit image on canvas
function drawThumbnailCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const tw = img.width * scale;
  const th = img.height * scale;
  const tx = (w - tw) / 2;
  const ty = (h - th) / 2;
  ctx.drawImage(img, tx, ty, tw, th);
}

// Returns a Blob (image/jpeg) of the watermarked 9:16 thumbnail.
// Fetches the thumbnail via blob URL to avoid canvas CORS taint.
// Falls back gracefully if the source image or logo fail to load.
export async function createWatermarkedThumbnail(thumbnailUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  // Base: dark Vuvio background
  ctx.fillStyle = '#04131f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Thumbnail — fetch as blob to avoid CORS taint on canvas
  if (thumbnailUrl) {
    try {
      const safeUrl = await toSafeUrl(thumbnailUrl);
      const thumb = await loadImage(safeUrl);
      drawThumbnailCover(ctx, thumb, CANVAS_W, CANVAS_H);
      if (safeUrl !== thumbnailUrl) URL.revokeObjectURL(safeUrl);
    } catch {
      // No image — dark background only
    }
  }

  // Dark gradient vignette bottom 55%
  const vignette = ctx.createLinearGradient(0, CANVAS_H * 0.45, 0, CANVAS_H);
  vignette.addColorStop(0, 'rgba(4,19,31,0)');
  vignette.addColorStop(1, 'rgba(4,19,31,0.82)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const margin = 64;

  // "LIVE ON VUVIO" — bottom-left, above logo
  ctx.font = '700 38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(53,227,220,0.92)';
  ctx.letterSpacing = '5px';
  ctx.fillText('LIVE ON VUVIO', margin, CANVAS_H - margin - 54);

  // Vuvio logo watermark — bottom-left (same-origin, no CORS issue)
  try {
    const logo = await loadImage(LOGO_URL);
    const logoH = 34;
    const logoW = Math.round((logo.width / logo.height) * logoH);
    ctx.globalAlpha = 0.90;
    ctx.drawImage(logo, margin, CANVAS_H - margin - logoH, logoW, logoH);
    ctx.globalAlpha = 1;
  } catch {
    // Text fallback if logo file missing
    ctx.font = '800 34px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.letterSpacing = '3px';
    ctx.fillText('VU·VIO', margin, CANVAS_H - margin);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      0.92,
    ),
  );
}

// Lightweight logo-only watermark for contexts where "LIVE ON VUVIO" text is not needed
export async function createLogoWatermarkedThumbnail(thumbnailUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#04131f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (thumbnailUrl) {
    try {
      const thumb = await loadImage(thumbnailUrl);
      drawThumbnailCover(ctx, thumb, CANVAS_W, CANVAS_H);
    } catch {}
  }

  const margin = 52;

  try {
    const logo = await loadImage(LOGO_URL);
    const logoH = 28;
    const logoW = Math.round((logo.width / logo.height) * logoH);
    ctx.globalAlpha = 0.80;
    ctx.drawImage(logo, margin, CANVAS_H - margin - logoH, logoW, logoH);
    ctx.globalAlpha = 1;
  } catch {
    ctx.font = '700 28px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('VUVIO', margin, CANVAS_H - margin);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))),
      'image/jpeg',
      0.92,
    ),
  );
}

// Whether the current browser can share files via navigator.share
export function canShareFile() {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({
      files: [new File([''], 'test.jpg', { type: 'image/jpeg' })],
    });
  } catch {
    return false;
  }
}

// ─── Video sharing ────────────────────────────────────────────────────────────
//
// Video clip sharing requires access to the live stream buffer (e.g., a
// MediaStream from the camera, or a recorded segment from the relay server).
//
// Architecture for when this becomes available:
//   1. Obtain a short MediaStream segment (last N seconds) from the camera
//      OR fetch a pre-signed clip URL from the relay / Cloudflare
//   2. Pipe through a canvas with Vuvio watermark overlay:
//        frames 0–45  (0–1.5s @ 30fps): "LIVE ON VUVIO" centered, fades out
//        frames 46–∞:  thumbnail content + logo-only watermark in bottom-left
//   3. Encode via MediaRecorder (video/webm on Android, video/mp4 on iOS HLS)
//   4. Return Blob → pass to shareNative({ imageFile: blob }) in shareService

export const VIDEO_SHARE_CAPABILITY = {
  available: false,
  reason: 'Requires live buffer access — not yet implemented',
};
