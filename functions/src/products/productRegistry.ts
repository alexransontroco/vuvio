import { ProductProvider, ProductSearchQuery, ExternalProduct, normalizeProductName } from './productProvider.js';
import { LocalProductProvider } from './localProvider.js';
import { IcecatProductProvider } from './icecatProvider.js';
import { ManualProductProvider } from './manualProvider.js';
import { UpcItemDbProvider } from './upcItemDbProvider.js';
import { EbayCatalogProvider, EbayCatalogConfig } from './ebayCatalogProvider.js';
import { logger } from 'firebase-functions';

function searchScore(product: ExternalProduct, query: ProductSearchQuery): number {
  const text = normalizeProductName(query.text ?? '');
  if (!text) return 100;
  const full = normalizeProductName(`${product.brand} ${product.name}`);
  const name = normalizeProductName(product.name);
  if (full === text || name === text) return 300;
  const words = [full, name, ...(product.aliases ?? []), ...(product.tags ?? []), product.subcategory ?? '']
    .map(normalizeProductName).join(' ').split(' ').filter(Boolean);
  const guitarQuery = /^guit(?:ar|are)?$/.test(text);
  const guitarMatch = words.some((word) => /^guitar|^guitare/.test(word));
  if (guitarQuery && !guitarMatch) return 0;
  const tokens = text.split(' ');
  const nameWords = name.split(' ');
  let score = tokens.every((token) => nameWords.some((word) => word.startsWith(token))) ? 170 :
    tokens.every((token) => words.some((word) => word.startsWith(token))) ? 110 :
      full.includes(text) ? 65 : 0;
  if (guitarQuery && guitarMatch) score += 70;
  if (guitarQuery && (normalizeProductName(product.subcategory ?? '').includes('guitar') || /\b(guitar|guitare)\b/.test(name))) score += 35;
  if (query.category && product.category === query.category) score += 12;
  const accessoryWords = /\b(batterie|battery|chargeur|charger|housse|case|etui|logo|autocollant|sticker|partition|livre|book|dvd|accordeur|tuner|pedale|pedal|pickguard|body|reparation|pieces?|replacement|compatible|pour|for)\b/;
  if (accessoryWords.test(full) && !accessoryWords.test(text)) score -= guitarQuery ? 160 : tokens.length > 1 ? 85 : 0;
  return score;
}

export class ProductRegistry {
  private providers: ProductProvider[] = [];

  register(provider: ProductProvider): void {
    this.providers.push(provider);
  }

  async search(query: ProductSearchQuery): Promise<ExternalProduct[]> {
    const eligibleProviders = this.providers.filter((p) => p.canHandle(query));
    const local = eligibleProviders.find((provider) => provider.id === 'local');
    let localResults: ExternalProduct[] = [];
    if (local) {
      try {
        localResults = await local.search(query);
      } catch {
        localResults = [];
      }
    }
    const skipExternalDiscovery = !!query.text && localResults.length >= (query.limit ?? 20) &&
      localResults.every((product) => searchScore(product, query) >= 110);
    const allResults = await Promise.allSettled(
      eligibleProviders.filter((provider) => provider !== local && (!skipExternalDiscovery || provider.id === 'icecat')).map((provider) => provider.search(query))
    );

    const flat: ExternalProduct[] = [...localResults];
    const searchedProviders = eligibleProviders.filter((provider) => provider !== local && (!skipExternalDiscovery || provider.id === 'icecat'));
    for (let index = 0; index < allResults.length; index++) {
      const result = allResults[index];
      if (result.status === 'fulfilled') {
        flat.push(...result.value);
      } else if (process.env.FUNCTIONS_EMULATOR === 'true') {
        logger.warn('[Equipment search] Provider failed', { provider: searchedProviders[index].id, error: String(result.reason) });
      }
    }

    const ranked = flat.map((product) => ({ product, score: searchScore(product, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || Number(b.product.provider === 'local') - Number(a.product.provider === 'local'))
      .map(({ product }) => product);
    const results = this.deduplicate(ranked, query.limit || 20);
    const icecat = this.providers.find((provider) => provider.id === 'icecat');
    let enriched = 0;
    if (icecat) {
      let attempts = 0;
      for (let index = 0; index < results.length && attempts < 3; index++) {
        const candidate = results[index];
        if (candidate.provider === 'icecat' || !(candidate.gtin || candidate.ean || candidate.upc || (candidate.brand && candidate.mpn))) continue;
        attempts++;
        const directMatch = flat.find((product) => product.provider === 'icecat' &&
          ((candidate.gtin && product.gtin === candidate.gtin) ||
            (candidate.ean && product.ean === candidate.ean) ||
            (candidate.brand && candidate.mpn && normalizeProductName(product.brand) === normalizeProductName(candidate.brand) && normalizeProductName(product.mpn ?? '') === normalizeProductName(candidate.mpn))));
        const detail = directMatch || (await icecat.search({ gtin: candidate.gtin, ean: candidate.ean, upc: candidate.upc, brand: candidate.brand, mpn: candidate.mpn }))[0];
        if (!detail || (candidate.gtin && detail.gtin && candidate.gtin !== detail.gtin) ||
          (candidate.mpn && detail.mpn && normalizeProductName(candidate.mpn) !== normalizeProductName(detail.mpn))) continue;
        results[index] = {
          ...candidate,
          description: candidate.description || detail.description,
          gtin: candidate.gtin || detail.gtin,
          mpn: candidate.mpn || detail.mpn,
          thumbnailUrl: detail.thumbnailUrl || candidate.thumbnailUrl,
          imageRightsStatus: detail.thumbnailUrl ? detail.imageRightsStatus : candidate.imageRightsStatus,
          imageSource: detail.thumbnailUrl ? detail.imageSource : candidate.imageSource,
          imageRightsSource: detail.thumbnailUrl ? detail.imageRightsSource : candidate.imageRightsSource,
          imageAllowedUsages: detail.thumbnailUrl ? detail.imageAllowedUsages : candidate.imageAllowedUsages,
          imageRightsCheckedAt: detail.thumbnailUrl ? detail.imageRightsCheckedAt : candidate.imageRightsCheckedAt,
          imageRightsExpiresAt: detail.thumbnailUrl ? detail.imageRightsExpiresAt : candidate.imageRightsExpiresAt,
          imageProductId: detail.thumbnailUrl ? detail.imageProductId : candidate.imageProductId,
          imageHostingStatus: detail.thumbnailUrl ? detail.imageHostingStatus : candidate.imageHostingStatus,
          icecatId: detail.externalId,
          enrichedBy: 'icecat',
        };
        enriched++;
      }
    }
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      logger.info('[Equipment search]', { query: query.text || 'identifier', providers: searchedProviders.map((provider, index) => ({ provider: provider.id, results: allResults[index].status === 'fulfilled' ? allResults[index].value.length : 0 })), localResults: localResults.length, enriched, imageCandidates: results.filter((item) => item.thumbnailUrl).length, authorizedImages: results.filter((item) => item.thumbnailUrl && ['authorized', 'manual-approved'].includes(item.imageRightsStatus ?? '')).length, excludedByRelevance: flat.length - ranked.length });
    }
    return results;
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
      const codes = [...new Set([product.gtin, product.ean, product.upc].filter((code): code is string => !!code))];
      const brandMpn = product.brand && product.mpn ? `${product.brand.toLowerCase()}:${product.mpn.toLowerCase()}` : null;
      const extKey = `${product.provider}:${product.externalId}`;
      const nameKey = `${product.brand.toLowerCase()}:${product.normalizedName}`;
      if (codes.some((code) => seen.gtin.has(code)) ||
        (brandMpn && seen.brandMpn.has(brandMpn)) ||
        seen.providerExtId.has(extKey) || seen.namesBrand.has(nameKey)) continue;
      codes.forEach((code) => seen.gtin.add(code));
      if (brandMpn) seen.brandMpn.add(brandMpn);
      seen.providerExtId.add(extKey);
      seen.namesBrand.add(nameKey);

      result.push(product);
      if (result.length >= limit) break;
    }

    return result;
  }
}

export function createProductRegistry(config: {
  icecat?: { username: string; password: string; language: string; market: string };
  ebay?: EbayCatalogConfig;
}): ProductRegistry {
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
