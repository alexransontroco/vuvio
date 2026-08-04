import { logger } from 'firebase-functions';
import { ProductProvider, ProductSearchQuery, ExternalProduct, ImageRightsStatus } from './productProvider.js';

export interface AffiliateFeedConfig {
  providerId: string;
  name: string;
  feedUrl?: string;
  feedType: 'csv' | 'xml' | 'json';
  categories?: string[];
  imageRightsStatus: ImageRightsStatus;
}

export class AffiliateFeedProvider implements ProductProvider {
  readonly id: string;

  constructor(private config: AffiliateFeedConfig) {
    this.id = `affiliate:${config.providerId}`;
  }

  canHandle(_query: ProductSearchQuery): boolean {
    return false;
  }

  async search(_query: ProductSearchQuery): Promise<ExternalProduct[]> {
    logger.info(`[AffiliateFeedProvider] Feed "${this.config.name}" (${this.config.providerId}) is not yet imported`);
    return [];
  }

  async getProduct(_externalId: string): Promise<ExternalProduct | null> {
    return null;
  }
}
