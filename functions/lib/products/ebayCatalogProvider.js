import { logger } from 'firebase-functions';
import { normalizeProductName } from './productProvider.js';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';
let cachedToken = null;
function cleanName(title, brand) {
    const trimmed = title.trim();
    if (brand && trimmed.toLowerCase().startsWith(brand.toLowerCase())) {
        const rest = trimmed.slice(brand.length).replace(/^[\s\-–]+/, '');
        const stop = rest.search(/\s[\-–|,]\s/);
        return (stop > 0 ? rest.slice(0, stop) : rest).trim() || trimmed;
    }
    const stop = trimmed.search(/\s[\-–|,]\s/);
    return (stop > 0 ? trimmed.slice(0, stop) : trimmed).trim();
}
function inferBrand(title) {
    return title.trim().split(/\s+/)[0] ?? '';
}
export class EbayCatalogProvider {
    config;
    id = 'ebayCatalog';
    constructor(config) {
        this.config = config;
    }
    canHandle(query) {
        if (!this.config.clientId || !this.config.clientSecret)
            return false;
        return !!(query.text || query.gtin || query.ean || query.upc || query.mpn);
    }
    async getToken() {
        const now = Date.now();
        if (cachedToken && cachedToken.expiresAt > now + 60_000) {
            return cachedToken.token;
        }
        const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
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
        const data = await response.json();
        if (!data.access_token)
            return null;
        cachedToken = {
            token: data.access_token,
            expiresAt: now + Math.max((data.expires_in ?? 7200) - 120, 60) * 1000,
        };
        return cachedToken.token;
    }
    async search(query) {
        const token = await this.getToken();
        if (!token)
            return [];
        try {
            const params = new URLSearchParams({
                limit: String(Math.min((query.limit ?? 10) * 3, 50)),
                fieldgroups: 'MATCHING_ITEMS',
            });
            if (query.text) {
                params.set('q', query.text);
            }
            else if (query.gtin || query.ean || query.upc) {
                params.set('q', query.gtin ?? query.ean ?? query.upc ?? '');
            }
            else if (query.mpn && query.brand) {
                params.set('q', `${query.brand} ${query.mpn}`);
            }
            else {
                return [];
            }
            const response = await fetch(`${SEARCH_URL}?${params}`, {
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
            const data = await response.json();
            const seen = new Map();
            for (const item of (data.itemSummaries ?? [])) {
                const title = item.title;
                if (!title)
                    continue;
                const brand = item.brand || inferBrand(title);
                const name = cleanName(title, brand);
                if (!brand || !name)
                    continue;
                const thumbnailUrl = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl;
                const product = {
                    externalId: item.itemId ?? item.epid ?? `ebay-${encodeURIComponent(title).slice(0, 40)}`,
                    provider: 'ebayCatalog',
                    brand,
                    name,
                    normalizedName: normalizeProductName(name),
                    thumbnailUrl,
                    sourceProductUrl: item.itemWebUrl,
                    canImport: false,
                };
                const key = `${brand.toLowerCase()}:${product.normalizedName}`;
                const existing = seen.get(key);
                if (!existing || (!existing.thumbnailUrl && thumbnailUrl)) {
                    seen.set(key, product);
                }
            }
            return Array.from(seen.values()).slice(0, query.limit ?? 10);
        }
        catch (err) {
            logger.warn('[EbayCatalog] search failed:', err);
            return [];
        }
    }
    async getProduct() {
        return null;
    }
}
