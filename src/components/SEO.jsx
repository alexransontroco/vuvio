import { useEffect } from 'react';

const SITE_URL = 'https://vuvio.app';
const DEFAULT_TITLE = 'Vuvio - Metiers, passions et experiences en direct';
const DEFAULT_DESCRIPTION = 'Decouvrez le monde en direct a travers le regard de ceux qui le vivent. Metiers, passions, voyages, artisanat, sport, musique et experiences reelles en POV.';
const DEFAULT_IMAGE = 'https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/mock-videos/live-mockups/mockup-dubai-thumb.jpg';

function absoluteUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${SITE_URL}${value}`;
  return `${SITE_URL}/${value.replace(/^\/+/, '')}`;
}

function setMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') el.removeAttribute(key);
    else el.setAttribute(key, value);
  });
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(data) {
  document.head.querySelectorAll('script[data-vuvio-jsonld="true"]').forEach((el) => el.remove());
  const blocks = Array.isArray(data) ? data.filter(Boolean) : [data].filter(Boolean);
  blocks.forEach((block) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.vuvioJsonld = 'true';
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  });
}

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical = '/',
  robots = 'index,follow',
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd = null,
}) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(canonical) || SITE_URL;
    const imageUrl = absoluteUrl(image) || DEFAULT_IMAGE;

    document.title = title;
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', { name: 'robots', content: robots });
    setLink('canonical', canonicalUrl);

    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
    setMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: imageUrl });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Vuvio' });

    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });

    setJsonLd(jsonLd);

    return () => {
      document.head.querySelectorAll('script[data-vuvio-jsonld="true"]').forEach((el) => el.remove());
    };
  }, [title, description, canonical, robots, image, type, jsonLd]);

  return null;
}

export { SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, DEFAULT_TITLE };
