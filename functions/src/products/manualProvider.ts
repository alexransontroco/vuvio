import { ProductProvider, ProductSearchQuery, ExternalProduct } from './productProvider.js';

export class ManualProductProvider implements ProductProvider {
  readonly id = 'manual';

  canHandle(_query: ProductSearchQuery): boolean {
    return false;
  }

  async search(_query: ProductSearchQuery): Promise<ExternalProduct[]> {
    return [];
  }

  async getProduct(_externalId: string): Promise<ExternalProduct | null> {
    return null;
  }
}
