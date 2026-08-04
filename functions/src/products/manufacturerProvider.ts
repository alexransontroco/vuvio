import { logger } from 'firebase-functions';
import { ProductProvider, ProductSearchQuery, ExternalProduct } from './productProvider.js';

export interface ManufacturerConfig {
  providerId: string;
  brand: string;
  sourceType: 'api' | 'feed' | 'manual';
  baseUrl?: string;
  credentialsSecret?: string;
  imageUsagePolicy?: string;
}

export class ManufacturerProductProvider implements ProductProvider {
  readonly id: string;

  constructor(private config: ManufacturerConfig) {
    this.id = `manufacturer:${config.providerId}`;
  }

  canHandle(query: ProductSearchQuery): boolean {
    if (!query.brand) return false;
    return query.brand.toLowerCase() === this.config.brand.toLowerCase();
  }

  async search(_query: ProductSearchQuery): Promise<ExternalProduct[]> {
    logger.info(`[ManufacturerProvider] Feed for brand "${this.config.brand}" (${this.config.providerId}) is not yet connected`);
    return [];
  }

  async getProduct(_externalId: string): Promise<ExternalProduct | null> {
    return null;
  }
}
