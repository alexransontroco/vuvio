import { ProductProvider, ProductSearchQuery, ExternalProduct } from './productProvider.js';
import { LocalProductProvider } from './localProvider.js';
import { IcecatProductProvider } from './icecatProvider.js';
import { ManualProductProvider } from './manualProvider.js';

export class ProductRegistry {
  private providers: ProductProvider[] = [];

  register(provider: ProductProvider): void {
    this.providers.push(provider);
  }

  async search(query: ProductSearchQuery): Promise<ExternalProduct[]> {
    const eligibleProviders = this.providers.filter((p) => p.canHandle(query));

    const allResults = await Promise.allSettled(
      eligibleProviders.map((p) => p.search(query))
    );

    const flat: ExternalProduct[] = [];
    for (const result of allResults) {
      if (result.status === 'fulfilled') {
        flat.push(...result.value);
      }
    }

    return this.deduplicate(flat, query.limit || 20);
  }

  async getProduct(providerId: string, externalId: string): Promise<ExternalProduct | null> {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) return null;
    return provider.getProduct(externalId);
  }

  private deduplicate(products: ExternalProduct[], limit: number): ExternalProduct[] {
    const seen = {
      gtin: new Set<string>(),
      brandMpn: new Set<string>(),
      providerExtId: new Set<string>(),
      namesBrand: new Set<string>(),
    };

    const result: ExternalProduct[] = [];

    for (const product of products) {
      if (product.gtin) {
        if (seen.gtin.has(product.gtin)) continue;
        seen.gtin.add(product.gtin);
      }
      if (product.ean) {
        if (seen.gtin.has(product.ean)) continue;
        seen.gtin.add(product.ean);
      }

      if (product.brand && product.mpn) {
        const key = `${product.brand.toLowerCase()}:${product.mpn.toLowerCase()}`;
        if (seen.brandMpn.has(key)) continue;
        seen.brandMpn.add(key);
      }

      const extKey = `${product.provider}:${product.externalId}`;
      if (seen.providerExtId.has(extKey)) continue;
      seen.providerExtId.add(extKey);

      const nameKey = `${product.brand.toLowerCase()}:${product.normalizedName}`;
      if (seen.namesBrand.has(nameKey)) continue;
      seen.namesBrand.add(nameKey);

      result.push(product);
      if (result.length >= limit) break;
    }

    return result;
  }
}

export function createProductRegistry(config: {
  icecat?: { username: string; password: string; language: string; market: string };
}): ProductRegistry {
  const registry = new ProductRegistry();

  registry.register(new LocalProductProvider());

  if (config.icecat?.username && config.icecat?.password) {
    registry.register(new IcecatProductProvider(config.icecat));
  }

  registry.register(new ManualProductProvider());

  return registry;
}
