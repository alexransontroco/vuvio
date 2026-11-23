// ─── Vuvio Share Service ──────────────────────────────────────────────────────
//
// Architecture:
//   shareService.js      — URL building + share dispatch (this file)
//   shareWatermark.js    — canvas watermark for images / future video clips
//   ShareLiveSheet.jsx   — UI layer (imports from here)
//
// Deep link format:
//   /share/live/{liveId}          → public live watch page
//   /share/live/{liveId}/recap    → post-live recap
//
// When Vuvio native app deep-link routing is implemented, these URLs should
// resolve to in-app screens. For now they open the web player.

import { shareVuvioContent } from '../platform/sharing.js';

const toPublicId = (id) => (id ?? 'demo').replace(/^created-/, '');

export const getLiveShareUrl = (liveId, ref = '') => {
  const id = toPublicId(liveId);
  const creatorRef = /^[a-zA-Z0-9._-]{1,80}$/.test(ref) ? `?ref=${encodeURIComponent(ref)}` : '';
  return `https://vuvio.app/share/live/${encodeURIComponent(id)}${creatorRef}`;
};

export const buildShareText = (live) => {
  const title = live?.title ?? live?.description ?? null;
  const base = "Hey ! I'm live on Vuvio, join me!";
  return title ? `${base} — ${title}` : base;
};

// ─── Per-destination share ────────────────────────────────────────────────────

// WhatsApp: direct wa.me link (no system sheet, works on all platforms)
export const shareToWhatsApp = (live) => {
  const url = getLiveShareUrl(live?.id);
  const text = encodeURIComponent(`${buildShareText(live)}\n${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
};

// Facebook: sharer URL (uses OG tags for link preview)
export const shareToFacebook = (live) => {
  const url = getLiveShareUrl(live?.id);
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    '_blank',
    'noopener,noreferrer',
  );
};

// X (Twitter): direct intent URL
export const shareToX = (live) => {
  const url = getLiveShareUrl(live?.id);
  const text = encodeURIComponent(buildShareText(live));
  const encodedUrl = encodeURIComponent(url);
  window.open(
    `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
    '_blank',
    'noopener,noreferrer',
  );
};

// Native share (TikTok, Instagram, Messages, general fallback)
// Optionally attaches an image file for platforms that support it (iOS/Android).
// Returns { success, cancelled, fallback? }
export const shareNative = async (live, { imageFile } = {}) => {
  const url = getLiveShareUrl(live?.id);
  const title = 'Watch live on Vuvio';
  const text = buildShareText(live);

  try {
    return await shareVuvioContent({
      title,
      text,
      url,
      files: imageFile ? [imageFile] : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') return { success: false, cancelled: true };
    console.warn('[shareNative]', err.message);
    // Last resort: copy
    await copyLiveLink(live?.id);
    return { success: true, fallback: 'copied' };
  }
};

// Copy link to clipboard — resolves true on success
export const copyLiveLink = async (liveId) => {
  const url = getLiveShareUrl(liveId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};

// ─── Payload builder (future: highlight / replay / clip sharing) ──────────────
//
// This is an extension point for when we add:
//   shareClip(live, clipBlob)        — short video highlight
//   shareReplay(live, replayUrl)     — post-live replay link
//   shareAIHighlight(live, hlBlob)   — AI-generated highlight clip
//
// All should route through shareNative/shareToWhatsApp/etc. above,
// with the appropriate payload built by buildSharePayload().

export const ShareContext = {
  LIVE: 'live',
  CLIP: 'clip',
  REPLAY: 'replay',
  HIGHLIGHT: 'highlight',
};

export const buildSharePayload = (live, context = ShareContext.LIVE) => ({
  url: getLiveShareUrl(live?.id),
  text: buildShareText(live),
  title: 'Watch live on Vuvio',
  context,
});
