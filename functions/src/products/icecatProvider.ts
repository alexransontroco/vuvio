import { logger } from 'firebase-functions';
import { ProductProvider, ProductSearchQuery, ExternalProduct, ProductImage, normalizeProductName } from './productProvider.js';
import { fetchIcecatProduct, searchIcecat, IcecatError, IcecatConfig, IcecatProductData } from './icecatService.js';

export class IcecatProductProvider implements ProductProvider {
  readonly id = 'icecat';

  constructor(private config: IcecatConfig) {}

  canHandle(query: ProductSearchQuery): boolean {
    return !!(query.gtin || query.ean || query.upc || (query.brand && query.mpn) || query.text);
  }

  async search(query: ProductSearchQuery): Promise<ExternalProduct[]> {
    try {
      if (query.gtin || query.ean || query.upc) {
        const gtin = query.gtin || query.ean || query.upc;
        const product = await fetchIcecatProduct({ gtin }, this.config);
        return [this.mapToExternal(product)];
      }

      if (query.brand && query.mpn) {
        const product = await fetchIcecatProduct({ brand: query.brand, mpn: query.mpn }, this.config);
        return [this.mapToExternal(product)];
      }

      if (query.text) {
        const results = await searchIcecat(query.text, this.config, query.limit || 20);
        return results.map((p) => this.mapToExternal(p));
      }

      return [];
    } catch (error) {
      if (error instanceof IcecatError) {
        if (error.type === 'not_found') {
          logger.info(`[Icecat] Not found: ${JSON.stringify(query)}`);
          return [];
        }
        if (error.type === 'rate_limited') {
          logger.warn('[Icecat] Rate limited, skipping');
          return [];
        }
        if (error.type === 'access_denied') {
          logger.error('[Icecat] Access denied - check credentials');
          return [];
        }
      }
      logger.error('[Icecat] Search error:', error);
      return [];
    }
  }

  async getProduct(externalId: string): Promise<ExternalProduct | null> {
    try {
      const product = await fetchIcecatProduct({ icecatId: externalId }, this.config);
      return this.mapToExternal(product);
    } catch (error) {
      if (error instanceof IcecatError && error.type === 'not_found') {
        return null;
      }
      logger.error(`[Icecat] getProduct error for ${externalId}:`, error);
      return null;
    }
  }

  private mapToExternal(data: IcecatProductData): ExternalProduct {
    const imageUrls: ProductImage[] = [];

    if (data.highResImageUrl) {
      imageUrls.push({
        imageUrl: data.highResImageUrl,
        sourceProvider: 'icecat',
        sourceUrl: data.sourceUrl,
        sourceProductId: data.icecatId,
        rightsStatus: 'provider-hosted',
      });
    }

    if (data.gallery) {
      for (const url of data.gallery) {
        if (url !== data.highResImageUrl) {
          imageUrls.push({
            imageUrl: url,
            sourceProvider: 'icecat',
            sourceUrl: data.sourceUrl,
            sourceProductId: data.icecatId,
            rightsStatus: 'provider-hosted',
          });
        }
      }
    }

    return {
      externalId: data.icecatId,
      provider: 'icecat',
      brand: data.brand,
      name: data.name,
      normalizedName: normalizeProductName(data.name),
      category: data.category,
      description: data.description,
      gtin: data.gtin?.[0],
      mpn: data.mpn,
      thumbnailUrl: data.thumbnailUrl,
      imageUrls,
      sourceProductUrl: data.sourceUrl,
      canImport: true,
    };
  }
}
