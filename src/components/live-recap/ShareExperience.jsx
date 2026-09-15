import { Clapperboard, Copy, Download, Link2, Share2, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import './share-experience.css';

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function statValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function buildShareStats(live) {
  const isMoving = Boolean(live.distance || live.distanceKm || live.averageSpeed || live.averagePace || live.routePoints?.length);
  if (isMoving) {
    return [
      { label: 'Distance', value: statValue(live.distance ?? (live.distanceKm ? `${live.distanceKm} km` : null)) },
      { label: 'Duration', value: formatDuration(live.durationSeconds) },
      { label: live.averagePace ? 'Avg pace' : 'Avg speed', value: statValue(live.averagePace ?? live.averageSpeed ?? live.averageSpeedKmh) },
      { label: 'Peak', value: statValue(live.peakViewers) },
    ].filter((item) => item.value !== '-').slice(0, 4);
  }

  return [
    { label: 'Duration', value: formatDuration(live.durationSeconds) },
    { label: 'Viewers', value: statValue(live.viewerCount) },
    { label: 'Peak', value: statValue(live.peakViewers) },
    { label: 'Category', value: statValue(live.category) },
  ].filter((item) => item.value !== '-').slice(0, 4);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('No image source'));
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = src;
  });
}

function coverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, maxSize, minSize) {
  let size = maxSize;
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
  }
  return size;
}

async function createStoryImage(live, stats) {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#102A42');
  background.addColorStop(0.5, '#071621');
  background.addColorStop(1, '#031018');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  try {
    const image = await loadImage(live.image);
    coverImage(ctx, image, 0, 0, width, height);
  } catch {
    const fallback = ctx.createRadialGradient(280, 420, 40, 280, 420, 900);
    fallback.addColorStop(0, '#2FE88A');
    fallback.addColorStop(0.46, '#135D8F');
    fallback.addColorStop(1, '#031018');
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, width, height);
  }

  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,0.22)');
  shade.addColorStop(0.42, 'rgba(0,0,0,0.08)');
  shade.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, 72, 78, 196, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#F5FBFF';
  ctx.font = '800 28px Inter, system-ui, sans-serif';
  ctx.fillText('Vuvio', 104, 115);

  ctx.fillStyle = '#F5FBFF';
  fitText(ctx, live.title, 900, 82, 46);
  const words = live.title.split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > 890 && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });
  if (current) lines.push(current);
  lines.slice(0, 3).forEach((line, index) => ctx.fillText(line, 72, 1190 + index * 88));

  ctx.fillStyle = 'rgba(245,251,255,0.82)';
  ctx.font = '700 32px Inter, system-ui, sans-serif';
  ctx.fillText(live.creatorName, 72, 1468);
  ctx.fillStyle = 'rgba(245,251,255,0.68)';
  ctx.font = '650 28px Inter, system-ui, sans-serif';
  ctx.fillText(live.place, 72, 1514);

  const statTop = 1592;
  stats.slice(0, 4).forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 72 + col * 468;
    const y = statTop + row * 112;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, x, y, 420, 84, 24);
    ctx.fill();
    ctx.fillStyle = '#F5FBFF';
    ctx.font = '800 32px Inter, system-ui, sans-serif';
    ctx.fillText(item.value, x + 26, y + 38);
    ctx.fillStyle = 'rgba(245,251,255,0.58)';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText(item.label.toUpperCase(), x + 26, y + 66);
  });

  ctx.fillStyle = 'rgba(245,251,255,0.76)';
  ctx.font = '700 26px Inter, system-ui, sans-serif';
  ctx.fillText('Watch the replay on Vuvio', 72, 1840);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render story image'));
    }, 'image/png', 0.94);
  });
}

async function shareNative(payload) {
  if (navigator.share) {
    await navigator.share(payload);
    return true;
  }
  return false;
}

export default function ShareExperience({ live }) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => buildShareStats(live), [live]);
  const liveId = String(live.id || '').replace(/^created-/, '');
  const shareUrl = liveId
    ? `${window.location.origin}/share/live/${encodeURIComponent(liveId)}/recap`
    : (live.shareUrl || window.location.href);
  const highlightUrl = live.highlightUrl || live.replayUrl || shareUrl;
  const safeId = String(live.id || 'live').replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  const copyLink = async (url = shareUrl) => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const shareText = useMemo(() => {
    const lines = [
      `Watch my Vuvio live recap: ${live.title}`,
      `${live.creatorName} · ${live.place}`,
      ...stats.map((item) => `${item.label}: ${item.value}`),
      shareUrl,
    ];
    return lines.filter(Boolean).join('\n');
  }, [live.creatorName, live.place, live.title, shareUrl, stats]);

  const copyText = async () => {
    await navigator.clipboard?.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleShareRecap = async () => {
    setSharing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 360));
    try {
      const blob = await createStoryImage(live, stats);
      const file = new File([blob], `vuvio-${safeId}-recap.png`, { type: 'image/png' });
      const payload = {
        title: live.title,
        text: shareText,
        url: shareUrl,
      };
      if (navigator.canShare?.({ files: [file] })) payload.files = [file];
      const shared = await shareNative(payload);
      if (!shared) await copyLink();
    } catch (error) {
      console.warn('[ShareExperience] Recap share failed:', error.message);
      await copyLink();
    } finally {
      window.setTimeout(() => setSharing(false), 360);
    }
  };

  const handleShareHighlight = async () => {
    try {
      const shared = await shareNative({
        title: `${live.title} highlight`,
        text: 'Watch this Vuvio highlight.',
        url: highlightUrl,
      });
      if (!shared) await copyLink(highlightUrl);
    } catch (error) {
      console.warn('[ShareExperience] Highlight share failed:', error.message);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await createStoryImage(live, stats);
      downloadBlob(blob, `vuvio-${safeId}-story.png`);
    } catch (error) {
      console.warn('[ShareExperience] Download failed:', error.message);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Share2 size={16} />
        Share
      </button>

      {open ? (
        <div className="share-experience-modal" role="dialog" aria-modal="true" aria-label="Share live recap">
          <button type="button" className="share-experience-modal__backdrop" onClick={() => setOpen(false)} aria-label="Close share options" />
          <section className={`share-experience${sharing ? ' is-sharing' : ''}`} aria-label="Share your experience">
            <button type="button" className="share-experience__close" onClick={() => setOpen(false)} aria-label="Close share options">
              <X size={17} />
            </button>

            <div className="share-experience__preview-wrap">
              <article className="share-story-card">
                <img src={live.image} alt="" loading="lazy" />
                <div className="share-story-card__shade" />
                <div className="share-story-card__brand">Vuvio</div>
                <div className="share-story-card__route" aria-hidden="true">
                  <svg viewBox="0 0 180 120">
                    <path d="M12 92 C42 48, 62 118, 93 58 S143 12, 169 38" />
                    <circle cx="12" cy="92" r="5" />
                    <circle cx="169" cy="38" r="5" />
                  </svg>
                </div>
                <div className="share-story-card__content">
                  <span>{live.category || 'Live recap'}</span>
                  <h3>{live.title}</h3>
                  <p>{live.creatorName} · {live.place}</p>
                  <div className="share-story-card__stats">
                    {stats.map((item) => (
                      <div key={item.label}>
                        <strong>{item.value}</strong>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
              <span className="share-experience__spark share-experience__spark--one" />
              <span className="share-experience__spark share-experience__spark--two" />
            </div>

            <div className="share-experience__panel">
              <div className="share-experience__heading">
                <span><Sparkles size={16} /> Share your experience</span>
                <h3>A polished recap is ready to send.</h3>
                <p>Share the vertical story card, your best highlight, or a formatted message with the replay link.</p>
              </div>

              <pre className="share-experience__text">{shareText}</pre>

              <div className="share-experience__actions">
                <button type="button" className="share-experience__action is-primary" onClick={handleShareRecap}>
                  <Share2 size={17} />
                  Share recap
                </button>
                <button type="button" className="share-experience__action" onClick={handleShareHighlight}>
                  <Clapperboard size={17} />
                  Share highlight
                </button>
                <button type="button" className="share-experience__action" onClick={handleDownload}>
                  <Download size={17} />
                  Download card
                </button>
                <button type="button" className="share-experience__action" onClick={copyText}>
                  <Copy size={17} />
                  {copied ? 'Copied' : 'Copy text'}
                </button>
                <button type="button" className="share-experience__action" onClick={() => copyLink()}>
                  {copied ? <Copy size={17} /> : <Link2 size={17} />}
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
