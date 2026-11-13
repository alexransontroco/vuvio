import { LocalProductProvider } from './localProvider.js';
import { IcecatProductProvider } from './icecatProvider.js';
import { ManualProductProvider } from './manualProvider.js';
import { UpcItemDbProvider } from './upcItemDbProvider.js';
import { EbayCatalogProvider } from './ebayCatalogProvider.js';
export class ProductRegistry {
    providers = [];
    register(provider) {
        this.providers.push(provider);
    }
    async search(query) {
        const eligibleProviders = this.providers.filter((p) => p.canHandle(query));
        const allResults = await Promise.allSettled(eligibleProviders.map((p) => p.search(query)));
        const flat = [];
        for (const result of allResults) {
            if (result.status === 'fulfilled') {
                flat.push(...result.value);
            }
        }
        return this.deduplicate(flat, query.limit || 20);
    }
    async getProduct(providerId, externalId) {
        const provider = this.providers.find((p) => p.id === providerId);
        if (!provider)
            return null;
        return provider.getProduct(externalId);
    }
    deduplicate(products, limit) {
        const seen = {
            gtin: new Set(),
            brandMpn: new Set(),
            providerExtId: new Set(),
            namesBrand: new Set(),
        };
        const result = [];
        for (const product of products) {
            if (product.gtin) {
                if (seen.gtin.has(product.gtin))
                    continue;
                seen.gtin.add(product.gtin);
            }
            if (product.ean) {
                if (seen.gtin.has(product.ean))
                    continue;
                seen.gtin.add(product.ean);
            }
            if (product.brand && product.mpn) {
                const key = `${product.brand.toLowerCase()}:${product.mpn.toLowerCase()}`;
                if (seen.brandMpn.has(key))
                    continue;
                seen.brandMpn.add(key);
            }
            const extKey = `${product.provider}:${product.externalId}`;
            if (seen.providerExtId.has(extKey))
                continue;
            seen.providerExtId.add(extKey);
            const nameKey = `${product.brand.toLowerCase()}:${product.normalizedName}`;
            if (seen.namesBrand.has(nameKey))
                continue;
            seen.namesBrand.add(nameKey);
            result.push(product);
            if (result.length >= limit)
                break;
        }
        // Back-fill thumbnailUrl from other providers for results that have none
        try {
            const thumbnailByName = new Map();
            for (const p of products) {
                if (p.thumbnailUrl && p.brand && p.normalizedName) {
                    const key = `${p.brand.toLowerCase()}:${p.normalizedName}`;
                    if (!thumbnailByName.has(key))
                        thumbnailByName.set(key, p.thumbnailUrl);
                }
            }
            return result.map((p) => {
                if (p.thumbnailUrl || !p.brand || !p.normalizedName)
                    return p;
                const key = `${p.brand.toLowerCase()}:${p.normalizedName}`;
                const url = thumbnailByName.get(key);
                return url ? { ...p, thumbnailUrl: url } : p;
            });
        }
        catch {
            return result;
        }
    }
}
export function createProductRegistry(config) {
    const registry = new ProductRegistry();
    registry.register(new LocalProductProvider());
    if (config.icecat?.username && config.icecat?.password) {
        registry.register(new IcecatProductProvider(config.icecat));
    }
    if (config.ebay?.clientId && config.ebay?.clientSecret) {
        registry.register(new EbayCatalogProvider(config.ebay));
    }
    registry.register(new UpcItemDbProvider());
    registry.register(new ManualProductProvider());
    return registry;
}
