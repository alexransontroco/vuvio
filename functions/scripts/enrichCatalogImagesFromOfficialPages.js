import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const catalogPath = resolve(rootDir, 'vuvio_catalog_official_verified_v1.json');

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absoluteUrl(value, base) {
  if (!value) return '';
  try {
    return new URL(decodeHtml(value), base).toString();
  } catch {
    return '';
  }
}

function metaContent(html, patterns, base) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const url = absoluteUrl(match?.[1], base);
    if (url) return url;
  }
  return '';
}

function extractJsonLdImages(html, base) {
  const images = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]).trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const image = node?.image;
        if (typeof image === 'string') images.push(absoluteUrl(image, base));
        if (Array.isArray(image)) {
          image.forEach((item) => {
            if (typeof item === 'string') images.push(absoluteUrl(item, base));
            else if (typeof item?.url === 'string') images.push(absoluteUrl(item.url, base));
          });
        }
        if (typeof image?.url === 'string') images.push(absoluteUrl(image.url, base));
      }
    } catch {
      // Some sites include invalid JSON-LD. Ignore and keep scanning meta tags.
    }
  }
  return images.filter(Boolean);
}

function imageQualityScore(url, product) {
  const normalized = url.toLowerCase();
  let score = 0;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(normalized)) score += 4;
  if (/1200|1600|1920|2000|large|hero|product|gallery|pdp|media|static|cdn/.test(normalized)) score += 3;
  if (!/logo|icon|favicon|sprite|placeholder|avatar/.test(normalized)) score += 4;
  for (const token of `${product.brand} ${product.name}`.toLowerCase().split(/\s+/).filter((part) => part.length > 2)) {
    if (normalized.includes(token.replace(/[^a-z0-9]/g, ''))) score += 1;
  }
  return score;
}

function extractImageUrl(html, pageUrl, product) {
  const candidates = [
    metaContent(html, [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    ], pageUrl),
    ...extractJsonLdImages(html, pageUrl),
  ].filter(Boolean);

  return [...new Set(candidates)]
    .map((url) => ({ url, score: imageQualityScore(url, product) }))
    .sort((a, b) => b.score - a.score)[0]?.url || '';
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; VuvioCatalogBot/1.0)',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return {
    finalUrl: response.url,
    html: await response.text(),
  };
}

async function enrichCatalog() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const summary = { enriched: 0, alreadyHadImage: 0, notFound: 0, failed: 0 };
  const details = [];

  for (const product of catalog) {
    if (product.thumbnailUrl) {
      summary.alreadyHadImage += 1;
      details.push({ id: product.id, action: 'already-had-image' });
      continue;
    }

    try {
      const page = await fetchPage(product.sourceProductUrl);
      const imageUrl = extractImageUrl(page.html, page.finalUrl || product.sourceProductUrl, product);
      if (!imageUrl) {
        summary.notFound += 1;
        details.push({ id: product.id, action: 'not-found' });
        continue;
      }

      product.thumbnailUrl = imageUrl;
      product.imageSource = 'official-manufacturer';
      product.imageRightsStatus = 'provider-hosted';
      summary.enriched += 1;
      details.push({ id: product.id, action: 'enriched', thumbnailUrl: imageUrl });
    } catch (error) {
      summary.failed += 1;
      details.push({ id: product.id, action: 'failed', error: error.message });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ summary, details }, null, 2));
}

enrichCatalog().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
