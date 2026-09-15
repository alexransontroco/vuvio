import type { Request, Response } from 'express';
import { db, collections } from '../shared/firestore.js';
import { cloudflareCustomerCode } from '../config/env.js';
import type { StreamDocument } from '../types/stream.js';

const APP_URL = 'https://vuvio.app';
const DEFAULT_IMAGE = `${APP_URL}/icon-512.png`;

function cloudflareThumbnailUrl(uid: string | null | undefined): string | null {
  if (!uid) return null;
  const code = cloudflareCustomerCode.value() || process.env.CLOUDFLARE_CUSTOMER_CODE;
  if (!code) return null;
  return `https://customer-${code}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
}

type ShareableLive = Partial<StreamDocument> & {
  name?: string;
  streamer?: string;
  creatorName?: string;
  experienceTitle?: string;
  job?: string;
  subcategory?: string;
  country?: string;
  locationLabel?: string;
  viewers?: string | number;
  viewerLabel?: string | number;
  image?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  cloudflareUid?: string;
  cloudflareLiveInputId?: string;
};

function escape(str: string | null | undefined): string {
  return (str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${APP_URL}${url}`;
  return null;
}

function viewerText(stream: ShareableLive): string | null {
  if (typeof stream.currentViewerCount === 'number' && stream.currentViewerCount > 0) {
    return `${stream.currentViewerCount} watching`;
  }

  const raw = stream.viewers ?? stream.viewerLabel;
  if (typeof raw === 'number' && raw > 0) return `${raw} watching`;
  if (typeof raw === 'string' && raw.trim()) return `${raw.trim()} watching`;
  return null;
}

function buildTitle(stream: ShareableLive, fallback: string): string {
  const title = firstText(stream.title, stream.experienceTitle);
  if (title) return title;

  const creator = firstText(stream.streamer, stream.creatorName, stream.name);
  return creator ? `${creator} is live on Vuvio` : fallback;
}

function buildDescription(stream: ShareableLive): string {
  const parts: string[] = [];
  const activity = Array.isArray(stream.subcategories) ? stream.subcategories[0] : firstText(stream.subcategory, stream.job);
  const location = firstText(stream.locationLabel, stream.city, stream.country);
  const viewers = viewerText(stream);

  if (activity) parts.push(activity);
  if (location) parts.push(location);
  if (viewers) parts.push(viewers);
  return parts.join(' · ') || 'Watch live on Vuvio';
}

function buildRecapDescription(stream: ShareableLive): string {
  const parts: string[] = [];
  if (typeof stream.durationSeconds === 'number' && stream.durationSeconds > 0) {
    const min = Math.floor(stream.durationSeconds / 60);
    parts.push(`${min} min live`);
  }
  const activity = Array.isArray(stream.subcategories) ? stream.subcategories[0] : firstText(stream.subcategory, stream.job);
  const location = firstText(stream.locationLabel, stream.city, stream.country);
  if (activity) parts.push(activity);
  if (location) parts.push(location);
  return parts.join(' · ') || 'Replay available on Vuvio';
}

function buildImage(stream: ShareableLive): string {
  return absoluteUrl(firstText(
    stream.highlightThumbnailUrl,
    stream.thumbnailUrl,
    stream.coverImageUrl,
    stream.image,
  )) ?? cloudflareThumbnailUrl(stream.cloudflareUid ?? stream.cloudflareLiveInputId) ?? DEFAULT_IMAGE;
}

async function getShareableLive(streamId: string): Promise<ShareableLive | null> {
  const streamSnap = await db.collection(collections.streams).doc(streamId).get();
  if (streamSnap.exists) return streamSnap.data() as ShareableLive;

  const activeLiveSnap = await db.collection('activeLives').doc(streamId).get();
  if (activeLiveSnap.exists) return activeLiveSnap.data() as ShareableLive;

  const createdSnap = await db.collection('activeLives').doc(`created-${streamId}`).get();
  if (createdSnap.exists) return createdSnap.data() as ShareableLive;

  return null;
}

function renderHtml(title: string, description: string, image: string, shareUrl: string, destUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${escape(image)}" />
  <meta property="og:image:width" content="512" />
  <meta property="og:image:height" content="512" />
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

export async function ogMetaHandler(req: Request, res: Response, streamId: string, isRecap = false) {
  const destUrl = isRecap ? `${APP_URL}/live/${streamId}/recap` : `${APP_URL}/watch?live=${streamId}`;
  const shareUrl = isRecap ? `${APP_URL}/share/live/${streamId}/recap` : `${APP_URL}/share/live/${streamId}`;

  let title = isRecap ? 'Watch the replay on Vuvio' : 'Watch live on Vuvio';
  let description = isRecap ? 'Replay available on Vuvio' : 'POV live streaming — join the experience.';
  let image = DEFAULT_IMAGE;
  const stream = await getShareableLive(streamId);

  if (stream) {
    title = buildTitle(stream, title);
    description = isRecap ? buildRecapDescription(stream) : buildDescription(stream);
    image = buildImage(stream);
  }

  const html = renderHtml(title, description, image, shareUrl, destUrl);

  const body = Buffer.from(html, 'utf-8');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Content-Length', String(body.length));
  res.set('Accept-Ranges', 'none');
  res.status(200).end(body);
}
