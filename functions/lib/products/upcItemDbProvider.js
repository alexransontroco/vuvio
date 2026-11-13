import { logger } from 'firebase-functions';
import { normalizeProductName } from './productProvider.js';
const BASE_URL = 'https://api.upcitemdb.com/prod/trial/search';
function cleanBrand(raw) {
    if (!raw)
        return '';
    // UPC brands are sometimes all-caps, normalise to title-case if so
    if (raw === raw.toUpperCase()) {
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    return raw;
}
function extractName(item) {
    const title = item.title ?? '';
    const brand = cleanBrand(item.brand);
    if (brand && title.toLowerCase().startsWith(brand.toLowerCase())) {
        const trimmed = title.slice(brand.length).replace(/^[\s\-–]+/, '');
        // Take everything before the first separator/long description
        const stop = trimmed.search(/\s[\-–|]\s/);
        return (stop > 0 ? trimmed.slice(0, stop) : trimmed).trim() || title;
    }
    // Take up to first separator
    const stop = title.search(/\s[\-–|,]\s/);
    return (stop > 0 ? title.slice(0, stop) : title).trim();
}
export class UpcItemDbProvider {
    id = 'upcitemdb';
    canHandle(query) {
        return !!(query.gtin || query.ean || query.upc);
    }
    async search(query) {
        const code = query.gtin ?? query.ean ?? query.upc;
        if (!code)
            return [];
        try {
            const params = new URLSearchParams({
                s: code,
                type: 'product',
                match_mode: '1',
                limit: String(Math.min(query.limit ?? 10, 10)),
            });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            let response;
            try {
                response = await fetch(`${BASE_URL}?${params}`, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Vuvio/1.0' },
                });
            }
            finally {
                clearTimeout(timeoutId);
            }
            if (!response.ok) {
                logger.warn(`[UpcItemDb] HTTP ${response.status}`);
                return [];
            }
            const data = await response.json();
            if (data.code === 'TOO_FAST' || data.code === 'EXCEED_LIMIT') {
                logger.warn('[UpcItemDb] Rate limited:', data.code);
                return [];
            }
            const items = data.items ?? [];
            const results = [];
            for (const item of items) {
                const brand = cleanBrand(item.brand);
                const name = extractName(item);
                if (!brand || !name)
                    continue;
                const thumbnailUrl = (item.images ?? [])[0];
                results.push({
                    externalId: item.ean ?? item.upc ?? item.elid ?? `upc-${Math.random()}`,
                    provider: 'upcitemdb',
                    brand,
                    name,
                    normalizedName: normalizeProductName(name),
                    description: item.description ? item.description.slice(0, 200) : undefined,
                    gtin: item.ean,
                    upc: item.upc,
                    thumbnailUrl,
                    canImport: false,
                });
            }
            return results;
        }
        catch (err) {
            if (err?.name === 'AbortError')
                return [];
            logger.warn('[UpcItemDb] search failed:', err);
            return [];
        }
    }
    async getProduct(externalId) {
        return null;
    }
}
