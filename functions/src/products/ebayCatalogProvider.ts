import { logger } from 'firebase-functions';
import { ProductProvider, ProductSearchQuery, ExternalProduct, normalizeProductName } from './productProvider.js';

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

export interface EbayCatalogConfig {
  clientId: string;
  clientSecret: string;
  marketplaceId: string;
  acceptLanguage: string;
}

interface EbayToken {
  access_token?: string;
  expires_in?: number;
}

interface EbayItemSummary {
  itemId?: string;
  epid?: string;
  title?: string;
  brand?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: { imageUrl?: string }[];
  itemWebUrl?: string;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function cleanName(title: string, brand?: string): string {
  const trimmed = title.trim();
  if (brand && trimmed.toLowerCase().startsWith(brand.toLowerCase())) {
    const rest = trimmed.slice(brand.length).replace(/^[\s\-–]+/, '');
    const stop = rest.search(/\s[\-–|,]\s/);
    return (stop > 0 ? rest.slice(0, stop) : rest).trim() || trimmed;
  }
  const stop = trimmed.search(/\s[\-–|,]\s/);
  return (stop > 0 ? trimmed.slice(0, stop) : trimmed).trim();
}

function inferBrand(title: string): string {
  return title.trim().split(/\s+/)[0] ?? '';
}

export class EbayCatalogProvider implements ProductProvider {
  readonly id = 'ebayCatalog';

  constructor(private config: EbayCatalogConfig) {}

  canHandle(query: ProductSearchQuery): boolean {
    if (!this.config.clientId || !this.config.clientSecret) return false;
    return !!(query.text || query.gtin || query.ean || query.upc || query.mpn);
  }

  private async getToken(): Promise<string | null> {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) {
      return cachedToken.token;
    }

    const credentials = Buffer.from(`${this.config.clientId.trim()}:${this.config.clientSecret.trim()}`).toString('base64');
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: SCOPE,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn(`[EbayCatalog] Token error ${response.status}:`, text.slice(0, 200));
      return null;
    }

    const data = await response.json() as EbayToken;
    if (!data.access_token) return null;

    cachedToken = {
      token: data.access_token,
      expiresAt: now + Math.max((data.expires_in ?? 7200) - 120, 60) * 1000,
    };
    return cachedToken.token;
  }

  async search(query: ProductSearchQuery): Promise<ExternalProduct[]> {
    const token = await this.getToken();
    if (!token) return [];

    try {
      const params = new URLSearchParams({
        limit: String(Math.min((query.limit ?? 10) * 3, 50)),
        fieldgroups: 'MATCHING_ITEMS',
      });

      if (query.text) {
        params.set('q', /^guit$/i.test(query.text.trim()) ? 'guitare' : query.text);
      } else if (query.gtin || query.ean || query.upc) {
        params.set('q', query.gtin ?? query.ean ?? query.upc ?? '');
      } else if (query.mpn && query.brand) {
        params.set('q', `${query.brand} ${query.mpn}`);
      } else {
        return [];
      }

      const response = await fetch(`${SEARCH_URL}?${params}`, {
        signal: AbortSignal.timeout(6000),
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': this.config.marketplaceId,
          'Accept-Language': this.config.acceptLanguage,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn(`[EbayCatalog] Search error ${response.status}:`, text.slice(0, 200));
        return [];
      }

      const data = await response.json() as EbaySearchResponse;
      const seen = new Map<string, ExternalProduct>();
      for (const item of (data.itemSummaries ?? [])) {
        const title = item.title;
        if (!title) continue;
        const brand = item.brand || inferBrand(title);
        const name = cleanName(title, brand);
        if (!brand || !name) continue;
        const thumbnailUrl = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl;
        const product: ExternalProduct = {
          externalId: item.itemId ?? item.epid ?? `ebay-${encodeURIComponent(title).slice(0, 40)}`,
          provider: 'ebayCatalog',
          brand,
          name,
          normalizedName: normalizeProductName(name),
          thumbnailUrl,
          imageRightsStatus: 'unknown',
          imageSource: 'ebayCatalog',
          imageRightsSource: 'ebay-api-license-public-display-conditional',
          imageAllowedUsages: [],
          imageRightsCheckedAt: new Date().toISOString(),
          imageRightsExpiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          imageProductId: item.itemId,
          sourceProductUrl: item.itemWebUrl,
          canImport: false,
        };
        const key = `${brand.toLowerCase()}:${product.normalizedName}`;
        const existing = seen.get(key);
        if (!existing || (!existing.thumbnailUrl && thumbnailUrl)) {
          seen.set(key, product);
        }
      }
      return Array.from(seen.values());
    } catch (err) {
      logger.warn('[EbayCatalog] search failed:', err);
      return [];
    }
  }

  async getProduct(): Promise<ExternalProduct | null> {
    return null;
  }
}
