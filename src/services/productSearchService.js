import { seedProducts } from './seedProducts.js';
import { equipmentImageForUsage } from '../data/equipmentVisual.js';

const BASE_URL = '/api';
const SEARCH_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map();
const debugSearch = import.meta.env?.DEV;

const catalogAdditions = [
  { id: 'fender-stratocaster', brand: 'Fender', name: 'Stratocaster', category: 'activity', subcategory: 'electric_guitar', aliases: ['Fender Strat'], tags: ['electric guitar'] },
  { id: 'bosch-gsr-12v', brand: 'Bosch Professional', name: 'GSR 12V', category: 'activity', subcategory: 'tool_drill', aliases: ['Bosch GSR 12V'], tags: ['cordless drill', 'driver'] },
  { id: 'kitchenaid-artisan', brand: 'KitchenAid', name: 'Artisan', category: 'activity', subcategory: 'stand_mixer', aliases: ['Kitchen Aid Artisan'], tags: ['stand mixer', 'kitchen'] },
  { id: 'makita-dhp482', brand: 'Makita', name: 'DHP482', category: 'activity', subcategory: 'tool_drill', aliases: ['DHP482Z'], tags: ['cordless hammer drill'] },
  { id: 'le-creuset-dutch-oven', brand: 'Le Creuset', name: 'Dutch Oven', category: 'activity', subcategory: 'cookware', aliases: ['Le Creuset Cocotte'], tags: ['cast iron cookware'] },
  { id: 'roland-fp-30x', brand: 'Roland', name: 'FP-30X', category: 'activity', subcategory: 'digital_piano', aliases: ['FP30X'], tags: ['digital piano', 'keyboard'] },
];

const catalog = [...seedProducts, ...catalogAdditions];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function oneEditApart(a, b) {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

function relevance(product, query) {
  const full = normalize(`${product.brand} ${product.name}`);
  const name = normalize(product.name);
  if (full === query || name === query) return 200;
  const values = [full, name, ...(product.aliases ?? []).map(normalize)].filter(Boolean);
  const context = [product.subcategory, product.equipmentType, ...(product.tags ?? [])].map(normalize).filter(Boolean);
  const compactQuery = query.replaceAll(' ', '');
  const tokens = query.split(' ').filter(Boolean);
  const words = values.flatMap((value) => value.split(' '));
  const contextWords = context.flatMap((value) => value.split(' '));
  const guitarQuery = tokens.length === 1 && /^guit(?:ar|are)?$/.test(query);
  const guitarMatch = guitarQuery && [...words, ...contextWords].some((word) => /^guitar|^guitare/.test(word));
  const guitarCore = guitarQuery && (normalize(product.subcategory).includes('guitar') || /\b(guitar|guitare)\b/.test(name));
  const accessoryWords = /\b(batterie|battery|chargeur|charger|housse|case|etui|logo|autocollant|sticker|partition|livre|book|dvd|accordeur|tuner|pedale|pedal|pickguard|body|reparation|pieces?|replacement|compatible|pour|for)\b/;
  const accessoryPenalty = accessoryWords.test(full) && !accessoryWords.test(query) ? guitarQuery ? 160 : tokens.length > 1 ? 85 : 0 : 0;
  if (values.some((value) => value.replaceAll(' ', '') === compactQuery)) return 190 - accessoryPenalty;
  if (values.some((value) => value.startsWith(query))) return 150 + Number(guitarMatch) * 30 + Number(guitarCore) * 35 - accessoryPenalty;
  const direct = tokens.every((token) => words.some((word) => word.startsWith(token)));
  if (direct) return 115 + Number(guitarMatch) * 45 + Number(guitarCore) * 35 - accessoryPenalty;
  const contextual = tokens.every((token) => [...words, ...contextWords].some((word) => word.startsWith(token))) || guitarMatch;
  if (contextual) return 80 + Number(guitarMatch) * 40 + Number(guitarCore) * 35 - accessoryPenalty;
  if (values.some((value) => value.includes(query))) return 45;
  if (tokens.every((token) => words.some((word) => oneEditApart(token, word)))) return 15;
  return 0;
}

export function searchLocalProducts(query, { limit = 10, category } = {}) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];
  return catalog
    .map((product) => ({ product, score: relevance(product, normalizedQuery) + (category && product.category === category ? 12 : 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.brand.localeCompare(b.product.brand) || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map(({ product, score }) => ({
      id: product.id,
      externalId: product.id,
      provider: 'vuvioCatalog',
      source: 'vuvioCatalog',
      brand: product.brand,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory,
      equipmentType: product.subcategory?.replaceAll('_', ' ') || product.category,
      aliases: product.aliases ?? [],
      thumbnailUrl: product.thumbnailUrl ?? null,
      imageRightsStatus: product.imageRightsStatus ?? null,
      imageSource: product.imageSource ?? null,
      imageRightsSource: product.imageRightsSource ?? null,
      imageAllowedUsages: product.imageAllowedUsages ?? [],
      imageRightsCheckedAt: product.imageRightsCheckedAt ?? null,
      imageRightsExpiresAt: product.imageRightsExpiresAt ?? null,
      imageProductId: product.imageProductId ?? null,
      imageHostingStatus: product.imageHostingStatus ?? null,
      tags: product.tags ?? [],
      matchScore: score,
      canImport: false,
    }));
}

function normalizeProductResult(product) {
  const provider = product.provider ?? 'local';
  const externalId = product.externalId ?? product.id;
  const imageRights = product.imageRightsStatus ?? product.imageUrls?.[0]?.rightsStatus;
  return {
    id: product.id ?? `${provider}:${externalId}`,
    externalId,
    provider,
    source: provider,
    brand: product.brand ?? '',
    name: product.name ?? '',
    category: product.category,
    subcategory: product.subcategory,
    equipmentType: product.subcategory?.replaceAll('_', ' ') || product.category,
    thumbnailUrl: product.thumbnailUrl ?? null,
    imageRightsStatus: imageRights ?? null,
    imageSource: product.imageSource ?? product.imageUrls?.[0]?.sourceProvider ?? null,
    imageRightsSource: product.imageRightsSource ?? null,
    imageAllowedUsages: product.imageAllowedUsages ?? [],
    imageRightsCheckedAt: product.imageRightsCheckedAt ?? null,
    imageRightsExpiresAt: product.imageRightsExpiresAt ?? null,
    imageProductId: product.imageProductId ?? product.icecatId ?? externalId,
    imageHostingStatus: product.imageHostingStatus ?? null,
    mpn: product.mpn ?? null,
    gtin: product.gtin ?? null,
    enrichedBy: product.enrichedBy ?? null,
    icecatId: product.icecatId ?? null,
    tags: product.tags ?? [],
    canImport: false,
  };
}

function mergeResults(local, external, query, limit, category) {
  const seen = new Set();
  return [...local, ...external]
    .filter((product) => product.brand && product.name)
    .map((product) => ({ product, score: relevance(product, normalize(query)) + (category && product.category === category ? 12 : 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.product.provider === 'vuvioCatalog') - Number(a.product.provider === 'vuvioCatalog'))
    .filter(({ product }) => {
      const key = normalize(`${product.brand} ${product.name}`).replaceAll(' ', '');
      if (seen.has(key)) return false;
      seen.add(key);
      if (product.provider === 'vuvioCatalog') {
        for (const alias of product.aliases ?? []) {
          const aliasKey = normalize(alias).replaceAll(' ', '');
          if (aliasKey) seen.add(aliasKey);
          const brandedAliasKey = normalize(`${product.brand} ${alias}`).replaceAll(' ', '');
          if (brandedAliasKey) seen.add(brandedAliasKey);
        }
      }
      return true;
    })
    .slice(0, limit)
    .map(({ product, score }) => ({ ...product, matchScore: score }));
}

export async function searchProducts(query, { signal, limit = 10, category, onLocal } = {}) {
  const trimmed = query?.trim() ?? '';
  if (trimmed.length < 2) return [];
  const local = searchLocalProducts(trimmed, { limit, category });
  onLocal?.(local);
  if (signal?.aborted || trimmed.length < 3) return local;
  const cacheKey = `${normalize(trimmed)}|${category ?? ''}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, SEARCH_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
    const res = await fetch(`${BASE_URL}/products/search?${params}`, { signal: controller.signal });
    if (!res.ok) throw Object.assign(new Error(`Product search HTTP ${res.status}`), { status: res.status });
    const data = await res.json();
    const external = (data.results ?? []).map(normalizeProductResult);
    const results = mergeResults(local, external, trimmed, limit, category);
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    if (searchCache.size > 100) searchCache.delete(searchCache.keys().next().value);
    if (debugSearch) console.debug('[Equipment search]', {
      query: trimmed,
      http: res.status,
      providers: Object.fromEntries([...new Set(external.map((item) => item.provider))].map((provider) => [provider, external.filter((item) => item.provider === provider).length])),
      results: results.length,
      imageCandidates: results.filter((item) => item.thumbnailUrl).length,
      authorizedImages: results.filter((item) => equipmentImageForUsage(item, 'search-preview')).length,
      imageExclusions: {
        missingUrl: results.filter((item) => !item.thumbnailUrl).length,
        unverifiedRights: results.filter((item) => item.thumbnailUrl && !equipmentImageForUsage(item, 'search-preview')).length,
      },
    });
    return results;
  } catch (err) {
    if (signal?.aborted) return local;
    if (debugSearch) console.warn('[Equipment search]', { query: trimmed, error: err?.message || 'unavailable', localResults: local.length });
    if (local.length) return local;
    throw err;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function resolveAffiliateOffers({ brand, name, mpn, gtin, productId, category } = {}) {
  if (!brand && !name && !mpn && !gtin) return [];
  try {
    const res = await fetch(`${BASE_URL}/affiliate/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, name, mpn, gtin, productId, category }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.offers ?? [];
  } catch (err) {
    console.warn('[productSearchService] resolve failed:', err);
    return [];
  }
}
