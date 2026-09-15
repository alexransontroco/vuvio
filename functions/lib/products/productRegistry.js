import { LocalProductProvider } from './localProvider.js';
import { IcecatProductProvider } from './icecatProvider.js';
import { ManualProductProvider } from './manualProvider.js';
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
        return result;
    }
}
export function createProductRegistry(config) {
    const registry = new ProductRegistry();
    registry.register(new LocalProductProvider());
    if (config.icecat?.username && config.icecat?.password) {
        registry.register(new IcecatProductProvider(config.icecat));
    }
    registry.register(new ManualProductProvider());
    return registry;
}
