import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const catalogPath = resolve(rootDir, 'vuvio_catalog_official_verified_v1.json');
const envPath = resolve(__dirname, '../.env');

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenScore(product, candidate) {
  const target = new Set(normalize(`${product.brand} ${product.name} ${product.mpn || ''}`).split(' ').filter(Boolean));
  const source = normalize(`${candidate.brand} ${candidate.name} ${candidate.mpn || ''}`);
  let score = 0;
  for (const token of target) {
    if (source.includes(token)) score += token.length > 2 ? 2 : 1;
  }
  if (normalize(candidate.brand) === normalize(product.brand)) score += 6;
  if (product.mpn && normalize(candidate.mpn) === normalize(product.mpn)) score += 8;
  return score;
}

function parseIcecatProduct(data) {
  const generalInfo = data?.GeneralInfo || {};
  const image = data?.Image || {};
  const gallery = Array.isArray(data?.Gallery) ? data.Gallery : [];
  const galleryUrls = gallery
    .sort((a, b) => Number(Boolean(b.IsMain)) - Number(Boolean(a.IsMain)))
    .map((item) => String(item.Pic || item.ThumbPic || ''))
    .filter(Boolean);

  return {
    icecatId: String(generalInfo.IcecatId || ''),
    brand: String(generalInfo.BrandName || ''),
    name: String(generalInfo.ProductName || ''),
    mpn: generalInfo.BrandPartCode ? String(generalInfo.BrandPartCode) : '',
    thumbnailUrl: String(image.ThumbPic || image.LowPic || galleryUrls[0] || ''),
    highResImageUrl: String(image.HighPic || image.Pic500x500 || image.Pic || galleryUrls[0] || ''),
  };
}

async function fetchIcecat(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Vuvio/1.0',
    },
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json?.data || null;
}

async function fetchByBrandMpn(product, config) {
  if (!product.mpn) return null;
  const params = new URLSearchParams({
    UserName: config.ICECAT_USERNAME,
    app_key: config.ICECAT_API_KEY,
    Brand: product.brand,
    ProductCode: product.mpn,
    lang: config.ICECAT_LANGUAGE || 'en',
  });
  const data = await fetchIcecat(`https://live.icecat.biz/api?${params.toString()}`);
  return data ? parseIcecatProduct(data) : null;
}

async function searchByText(product, config) {
  const params = new URLSearchParams({
    UserName: config.ICECAT_USERNAME,
    app_key: config.ICECAT_API_KEY,
    keywords: `${product.brand} ${product.name}`,
    lang: config.ICECAT_LANGUAGE || 'en',
    limit: '8',
  });
  const data = await fetchIcecat(`https://live.icecat.biz/api/search?${params.toString()}`);
  if (!Array.isArray(data)) return null;

  const candidates = data
    .map(parseIcecatProduct)
    .filter((candidate) => candidate.thumbnailUrl || candidate.highResImageUrl)
    .map((candidate) => ({ ...candidate, score: tokenScore(product, candidate) }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.score >= 8 ? candidates[0] : null;
}

async function enrichCatalog() {
  const [catalogText, envText] = await Promise.all([
    readFile(catalogPath, 'utf8'),
    readFile(envPath, 'utf8'),
  ]);
  const catalog = JSON.parse(catalogText);
  const config = parseEnv(envText);
  if (!config.ICECAT_USERNAME || !config.ICECAT_API_KEY) {
    throw new Error('Missing ICECAT_USERNAME or ICECAT_API_KEY in functions/.env');
  }

  const summary = { enriched: 0, alreadyHadImage: 0, notFound: 0 };
  const details = [];

  for (const product of catalog) {
    if (product.thumbnailUrl) {
      summary.alreadyHadImage += 1;
      details.push({ id: product.id, action: 'already-had-image' });
      continue;
    }

    let match = await fetchByBrandMpn(product, config);
    if (!match?.thumbnailUrl && !match?.highResImageUrl) {
      match = await searchByText(product, config);
    }

    const imageUrl = match?.thumbnailUrl || match?.highResImageUrl || '';
    if (!imageUrl) {
      summary.notFound += 1;
      details.push({ id: product.id, action: 'not-found' });
      continue;
    }

    product.thumbnailUrl = imageUrl;
    product.imageSource = 'icecat';
    product.imageRightsStatus = 'provider-hosted';
    product.icecatId = match.icecatId || undefined;
    summary.enriched += 1;
    details.push({
      id: product.id,
      action: 'enriched',
      icecatId: match.icecatId,
      matchedName: `${match.brand} ${match.name}`.trim(),
      thumbnailUrl: imageUrl,
    });

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ summary, details }, null, 2));
}

enrichCatalog().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
