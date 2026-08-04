import { logger } from 'firebase-functions';

export interface IcecatConfig {
  username: string;
  password: string;
  language: string;
  market: string;
}

type IcecatErrorType = 'not_found' | 'access_denied' | 'rate_limited' | 'parse_error' | 'network_error';

export class IcecatError extends Error {
  constructor(readonly type: IcecatErrorType, message: string) {
    super(message);
    this.name = 'IcecatError';
  }
}

export interface IcecatProductData {
  icecatId: string;
  brand: string;
  name: string;
  mpn?: string;
  gtin?: string[];
  ean?: string;
  category?: string;
  description?: string;
  thumbnailUrl?: string;
  highResImageUrl?: string;
  gallery?: string[];
  sourceUrl: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const productCache = new Map<string, CacheEntry<IcecatProductData>>();
const searchCache = new Map<string, CacheEntry<IcecatProductData[]>>();
const PRODUCT_CACHE_TTL = 24 * 60 * 60 * 1000;
const SEARCH_CACHE_TTL = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL = 30 * 60 * 1000;

let tokenBucketCount = 10;
let tokenBucketLastRefill = Date.now();
const TOKEN_BUCKET_MAX = 10;
const TOKEN_BUCKET_REFILL_MS = 60 * 1000;

function acquireToken(): boolean {
  const now = Date.now();
  const elapsed = now - tokenBucketLastRefill;
  if (elapsed >= TOKEN_BUCKET_REFILL_MS) {
    tokenBucketCount = TOKEN_BUCKET_MAX;
    tokenBucketLastRefill = now;
  }
  if (tokenBucketCount <= 0) {
    return false;
  }
  tokenBucketCount--;
  return true;
}

// Icecat authenticates via app_key URL parameter, not Basic Auth.
// username + app_key are both added to the URLSearchParams before the request.
function addIcecatAuth(params: URLSearchParams, config: IcecatConfig): void {
  params.set('UserName', config.username);
  if (config.password) {
    params.set('app_key', config.password);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIcecatResponse(data: Record<string, unknown>): IcecatProductData {
  const generalInfo = data.GeneralInfo as Record<string, unknown> | undefined;
  if (!generalInfo) {
    throw new IcecatError('parse_error', 'Missing GeneralInfo in Icecat response');
  }

  const icecatId = String(generalInfo.IcecatId ?? '');
  const brand = String(generalInfo.BrandName ?? '');
  const name = String(generalInfo.ProductName ?? '');
  const mpn = generalInfo.BrandPartCode ? String(generalInfo.BrandPartCode) : undefined;

  const gtinRaw = generalInfo.GTIN as string[] | undefined;
  const gtin = Array.isArray(gtinRaw) && gtinRaw.length > 0 ? gtinRaw : undefined;

  const categoryRaw = generalInfo.Category as Record<string, unknown> | undefined;
  let category: string | undefined;
  if (categoryRaw) {
    const nameArr = categoryRaw.Name as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(nameArr) && nameArr.length > 0) {
      category = String(nameArr[0].Value ?? '');
    }
  }

  const summaryRaw = generalInfo.SummaryDescription as Record<string, unknown> | undefined;
  const description = summaryRaw?.LongSummaryDescription
    ? String(summaryRaw.LongSummaryDescription)
    : undefined;

  const imageRaw = data.Image as Record<string, unknown> | undefined;
  const thumbnailUrl = imageRaw?.ThumbPic ? String(imageRaw.ThumbPic) : undefined;
  const highResImageUrl = imageRaw?.HighPic ? String(imageRaw.HighPic) : undefined;

  const galleryRaw = data.Gallery as Array<Record<string, unknown>> | undefined;
  let gallery: string[] | undefined;
  if (Array.isArray(galleryRaw) && galleryRaw.length > 0) {
    const sorted = [...galleryRaw].sort((a, b) => {
      const aMain = a.IsMain ? 1 : 0;
      const bMain = b.IsMain ? 1 : 0;
      return bMain - aMain;
    });
    gallery = sorted
      .map((g) => String(g.Pic ?? ''))
      .filter((url) => url.length > 0);
  }

  return {
    icecatId,
    brand,
    name,
    mpn,
    gtin,
    category,
    description,
    thumbnailUrl,
    highResImageUrl,
    gallery,
    sourceUrl: `https://icecat.biz/p/${icecatId}`,
  };
}

async function fetchFromIcecat(
  url: string,
  config: IcecatConfig,
  retryCount = 0
): Promise<Record<string, unknown>> {
  if (!acquireToken()) {
    throw new IcecatError('rate_limited', 'Icecat rate limit exceeded (local token bucket)');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vuvio/1.0',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    throw new IcecatError('network_error', `Icecat fetch failed: ${String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 200) {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new IcecatError('parse_error', 'Failed to parse Icecat JSON response');
    }
    return (json as Record<string, unknown>).data as Record<string, unknown>;
  }

  if (response.status === 404) {
    throw new IcecatError('not_found', `Icecat: product not found`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new IcecatError('access_denied', 'Icecat credentials invalid or insufficient access');
  }

  if (response.status === 429) {
    if (retryCount >= 3) {
      throw new IcecatError('rate_limited', 'Icecat rate limited after 3 retries');
    }
    const waitMs = Math.pow(2, retryCount) * 1000;
    await sleep(waitMs);
    return fetchFromIcecat(url, config, retryCount + 1);
  }

  throw new IcecatError('network_error', `Icecat unexpected status: ${response.status}`);
}

export async function fetchIcecatProduct(
  identifier: { gtin?: string; brand?: string; mpn?: string; icecatId?: string },
  config: IcecatConfig
): Promise<IcecatProductData> {
  let cacheKey: string;
  let urlParams: URLSearchParams;

  if (identifier.gtin) {
    cacheKey = `gtin:${identifier.gtin}`;
    urlParams = new URLSearchParams({ GTIN: identifier.gtin, lang: config.language });
  } else if (identifier.brand && identifier.mpn) {
    cacheKey = `brand:${identifier.brand}:mpn:${identifier.mpn}`;
    urlParams = new URLSearchParams({ Brand: identifier.brand, prod_id: identifier.mpn, lang: config.language });
  } else if (identifier.icecatId) {
    cacheKey = `icecatId:${identifier.icecatId}`;
    urlParams = new URLSearchParams({ icecat_id: identifier.icecatId, lang: config.language });
  } else {
    throw new IcecatError('network_error', 'fetchIcecatProduct: no valid identifier provided');
  }

  // app_key and UserName go in URL params (Icecat rejects them in Authorization header)
  addIcecatAuth(urlParams, config);

  const cached = productCache.get(cacheKey);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    }
    productCache.delete(cacheKey);
  }

  const url = `https://live.icecat.biz/api?${urlParams.toString()}`;

  let data: Record<string, unknown>;
  try {
    data = await fetchFromIcecat(url, config);
  } catch (err) {
    if (err instanceof IcecatError && err.type === 'not_found') {
      productCache.set(cacheKey, {
        data: null as unknown as IcecatProductData,
        expiresAt: Date.now() + NEGATIVE_CACHE_TTL,
      });
    }
    throw err;
  }

  const product = parseIcecatResponse(data);
  productCache.set(cacheKey, { data: product, expiresAt: Date.now() + PRODUCT_CACHE_TTL });
  return product;
}

export async function searchIcecat(
  query: string,
  config: IcecatConfig,
  limit = 20
): Promise<IcecatProductData[]> {
  const cacheKey = `search:${config.language}:${query}:${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const urlParams = new URLSearchParams({ keywords: query, lang: config.language, limit: String(limit) });
  addIcecatAuth(urlParams, config);

  const url = `https://live.icecat.biz/api/search?${urlParams.toString()}`;

  if (!acquireToken()) {
    logger.warn('[Icecat] Rate limited during search, returning empty');
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vuvio/1.0',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    clearTimeout(timeoutId);
    logger.warn('[Icecat] Search request failed:', err);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    logger.warn('[Icecat] Search endpoint not available on this account');
    return [];
  }

  if (!response.ok) {
    logger.warn(`[Icecat] Search returned ${response.status}`);
    return [];
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    logger.warn('[Icecat] Failed to parse search response');
    return [];
  }

  const items = (json as Record<string, unknown>).data as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) {
    return [];
  }

  const results: IcecatProductData[] = [];
  for (const item of items) {
    try {
      results.push(parseIcecatResponse(item));
    } catch {
      // skip unparseable items silently
    }
  }

  searchCache.set(cacheKey, { data: results, expiresAt: Date.now() + SEARCH_CACHE_TTL });
  return results;
}
