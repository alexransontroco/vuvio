import sharp from 'sharp';
import { db, collections } from '../shared/firestore.js';
import { cloudflareCustomerCode } from '../config/env.js';
const APP_URL = 'https://vuvio-bf328.web.app';
const DEFAULT_IMAGE = 'https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/mockup-dubai-thumb.jpg';
const LOGO_IMAGE = `${APP_URL}/assets/logo/vuvio-logo.png`;
const STORAGE_BASE = 'https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/';
const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;
const WATERMARK_SIZE = 126;
function cloudflareThumbnailUrl(uid) {
    if (!uid)
        return null;
    const code = cloudflareCustomerCode.value() || process.env.CLOUDFLARE_CUSTOMER_CODE;
    if (!code)
        return null;
    return `https://customer-${code}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
}
const mockShareLives = {
    'guitar-solo-pov-paris': {
        id: 'guitar-solo-pov-paris',
        title: 'Guitar solo session - jazz & blues improvisation',
        description: 'POV guitar session from Paris.',
        streamer: 'Leo Marchais',
        subcategory: 'Guitar',
        city: 'Paris',
        country: 'France',
        viewers: 3210,
        image: `${STORAGE_BASE}mock-videos/videos/guitar-thumb.jpg`,
    },
    'metal-drummer-pov-berlin': {
        id: 'metal-drummer-pov-berlin',
        title: 'POV drumming at a massive festival crowd',
        description: 'Live drums from Berlin with full crowd energy.',
        streamer: 'Kai Brandt',
        subcategory: 'Drums',
        city: 'Berlin',
        country: 'Germany',
        viewers: 8940,
        image: `${STORAGE_BASE}mock-videos/videos/drummer-thumb.jpg`,
    },
    'piano-pov-dubai': {
        id: 'piano-pov-dubai',
        title: 'Golden Hour piano arrangement',
        description: 'Sunset piano session from Dubai.',
        streamer: 'Costantino C.',
        subcategory: 'Piano',
        city: 'Dubai',
        country: 'UAE',
        viewers: 5620,
        image: `${STORAGE_BASE}mock-videos/live-mockups/mockup-dubai-thumb.jpg`,
    },
    'feuchaterton-live-paris': {
        id: 'feuchaterton-live-paris',
        title: 'Feu! Chatterton live in Paris',
        description: 'A live music POV session on Vuvio.',
        streamer: 'Feu! Chatterton',
        subcategory: 'Live music',
        city: 'Paris',
        country: 'France',
        image: `${STORAGE_BASE}mock-videos/videos/feuchaterton-thumb.jpg`,
    },
};
function escape(str) {
    return (str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function firstText(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim())
            return value.trim();
    }
    return null;
}
function truncate(str, max) {
    if (str.length <= max)
        return str;
    return `${str.slice(0, max - 1).trim()}…`;
}
function absoluteUrl(url) {
    if (!url)
        return null;
    if (/^https?:\/\//i.test(url))
        return url;
    if (url.startsWith('/'))
        return `${APP_URL}${url}`;
    return null;
}
function shareableImageUrl(url) {
    const absolute = absoluteUrl(url);
    if (!absolute)
        return null;
    if (!/\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(absolute))
        return null;
    return absolute;
}
function imageContentType() {
    return 'image/jpeg';
}
function viewerText(stream) {
    if (typeof stream.currentViewerCount === 'number' && stream.currentViewerCount > 0) {
        return `${stream.currentViewerCount} watching`;
    }
    const raw = stream.viewers ?? stream.viewerLabel;
    if (typeof raw === 'number' && raw > 0)
        return `${raw} watching`;
    if (typeof raw === 'string' && raw.trim())
        return `${raw.trim()} watching`;
    return null;
}
function creatorText(stream) {
    return firstText(stream.streamer, stream.creatorName, stream.name);
}
function buildTitle(stream, fallback) {
    const title = firstText(stream.title, stream.experienceTitle);
    const creator = creatorText(stream);
    if (title && creator)
        return truncate(`${title} - ${creator} is live on Vuvio`, 95);
    if (title)
        return truncate(`${title} - live on Vuvio`, 95);
    return creator ? `${creator} is live on Vuvio` : fallback;
}
function buildDescription(stream) {
    const parts = [];
    const activity = Array.isArray(stream.subcategories) ? stream.subcategories[0] : firstText(stream.subcategory, stream.job);
    const location = firstText(stream.locationLabel, stream.city, stream.country);
    const viewers = viewerText(stream);
    const description = firstText(stream.description);
    if (description)
        parts.push(description);
    if (activity)
        parts.push(activity);
    if (location)
        parts.push(location);
    if (viewers)
        parts.push(viewers);
    return truncate(parts.join(' · ') || 'Join this POV live on Vuvio.', 180);
}
function buildRecapDescription(stream) {
    const parts = [];
    const description = firstText(stream.description);
    if (description)
        parts.push(description);
    if (typeof stream.durationSeconds === 'number' && stream.durationSeconds > 0) {
        const min = Math.floor(stream.durationSeconds / 60);
        parts.push(`${min} min live`);
    }
    const activity = Array.isArray(stream.subcategories) ? stream.subcategories[0] : firstText(stream.subcategory, stream.job);
    const location = firstText(stream.locationLabel, stream.city, stream.country);
    if (activity)
        parts.push(activity);
    if (location)
        parts.push(location);
    return truncate(parts.join(' · ') || 'Replay available on Vuvio', 180);
}
function buildImage(stream) {
    return shareableImageUrl(firstText(stream.highlightThumbnailUrl, stream.thumbnailUrl, stream.coverImageUrl, stream.image)) ?? cloudflareThumbnailUrl(stream.recordingUid ?? stream.cloudflareVideoId) ?? DEFAULT_IMAGE;
}
async function getShareableLive(streamId) {
    const streamSnap = await db.collection(collections.streams).doc(streamId).get();
    if (streamSnap.exists)
        return enrichCreator(streamSnap.data());
    const activeLiveSnap = await db.collection('activeLives').doc(streamId).get();
    if (activeLiveSnap.exists)
        return enrichCreator(activeLiveSnap.data());
    const createdSnap = await db.collection('activeLives').doc(`created-${streamId}`).get();
    if (createdSnap.exists)
        return enrichCreator(createdSnap.data());
    if (mockShareLives[streamId])
        return mockShareLives[streamId];
    return null;
}
async function enrichCreator(stream) {
    if (creatorText(stream))
        return stream;
    const uid = firstText(stream.creatorId, stream.creatorUid);
    if (!uid)
        return stream;
    const userSnap = await db.collection('users').doc(uid).get().catch(() => null);
    const user = userSnap?.exists ? userSnap.data() : null;
    const creatorName = firstText(user?.displayName, user?.name, user?.username);
    return creatorName ? { ...stream, creatorName } : stream;
}
function renderHtml(title, description, image, shareUrl, destUrl) {
    const imageType = imageContentType();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${escape(image)}" />
  <meta property="og:image:secure_url" content="${escape(image)}" />
  <meta property="og:image:type" content="${imageType}" />
  <meta property="og:image:width" content="${SHARE_IMAGE_WIDTH}" />
  <meta property="og:image:height" content="${SHARE_IMAGE_HEIGHT}" />
  <meta property="og:image:alt" content="${escape(title)}" />
  <meta property="og:url" content="${escape(shareUrl)}" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:site_name" content="Vuvio" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(title)}" />
  <meta name="twitter:description" content="${escape(description)}" />
  <meta name="twitter:image" content="${escape(image)}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(destUrl)});</script>
  <p><a href="${escape(destUrl)}">${escape(title)}</a></p>
</body>
</html>`;
}
async function getLogoWatermark() {
    const response = await fetch(LOGO_IMAGE);
    if (!response.ok)
        throw new Error(`Failed to fetch Vuvio logo: ${response.status}`);
    const logo = Buffer.from(await response.arrayBuffer());
    const logoPng = await sharp(logo)
        .trim()
        .resize(86, 86, { fit: 'contain' })
        .png()
        .toBuffer();
    const backdrop = Buffer.from(`<svg width="${WATERMARK_SIZE}" height="${WATERMARK_SIZE}" viewBox="0 0 ${WATERMARK_SIZE} ${WATERMARK_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${WATERMARK_SIZE}" height="${WATERMARK_SIZE}" rx="34" fill="rgba(3, 8, 18, 0.68)" filter="url(#shadow)"/>
</svg>`);
    return sharp(backdrop)
        .composite([{ input: logoPng, left: 20, top: 20 }])
        .png()
        .toBuffer();
}
async function renderShareImage(sourceUrl) {
    const response = await fetch(sourceUrl);
    if (!response.ok)
        throw new Error(`Failed to fetch share image: ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    return sharp(source)
        .resize(SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT, { fit: 'cover', position: 'centre' })
        .composite([{ input: await getLogoWatermark(), left: 44, top: 38 }])
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
}
export async function ogMetaHandler(req, res, streamId, isRecap = false) {
    const destUrl = isRecap ? `${APP_URL}/live/${streamId}/recap` : `${APP_URL}/watch?live=${streamId}`;
    const shareUrl = isRecap ? `${APP_URL}/share/live/${streamId}/recap` : `${APP_URL}/share/live/${streamId}`;
    const shareImageUrl = `${shareUrl}/image?v=vuvio-logo`;
    let title = isRecap ? 'Watch the replay on Vuvio' : 'Watch live on Vuvio';
    let description = isRecap ? 'Replay available on Vuvio' : 'POV live streaming — join the experience.';
    let image = DEFAULT_IMAGE;
    const stream = await getShareableLive(streamId);
    if (stream) {
        title = buildTitle(stream, title);
        description = isRecap ? buildRecapDescription(stream) : buildDescription(stream);
        image = buildImage(stream);
    }
    const html = renderHtml(title, description, shareImageUrl, shareUrl, destUrl);
    const body = Buffer.from(html, 'utf-8');
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Length', String(body.length));
    res.set('Accept-Ranges', 'none');
    res.status(200).end(body);
}
export async function ogImageHandler(req, res, streamId, isRecap = false) {
    let image = DEFAULT_IMAGE;
    const stream = await getShareableLive(streamId);
    if (stream) {
        image = buildImage(stream);
    }
    try {
        const body = await renderShareImage(image);
        res.set('Cache-Control', isRecap ? 'public, max-age=3600' : 'public, max-age=300');
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', String(body.length));
        res.status(200).end(body);
    }
    catch (error) {
        console.error('[og-image] Failed to render share image:', error);
        const fallback = await renderShareImage(DEFAULT_IMAGE);
        res.set('Cache-Control', 'public, max-age=300');
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', String(fallback.length));
        res.status(200).end(fallback);
    }
}
