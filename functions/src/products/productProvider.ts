export type ImageRightsStatus = 'authorized' | 'provider-hosted' | 'manual-approved' | 'unknown';

export interface ProductImage {
  imageUrl: string;
  sourceProvider: string;
  sourceUrl: string;
  sourceProductId?: string;
  rightsStatus: ImageRightsStatus;
}

export interface ExternalProduct {
  externalId: string;
  provider: string;
  brand: string;
  name: string;
  normalizedName: string;
  category?: string;
  description?: string;
  gtin?: string;
  ean?: string;
  upc?: string;
  mpn?: string;
  thumbnailUrl?: string;
  imageUrls?: ProductImage[];
  sourceProductUrl?: string;
  canImport: boolean;
}

export interface ProductSearchQuery {
  text?: string;
  brand?: string;
  mpn?: string;
  gtin?: string;
  ean?: string;
  upc?: string;
  category?: string;
  limit?: number;
}

export interface ProductProvider {
  readonly id: string;
  canHandle(query: ProductSearchQuery): boolean;
  search(query: ProductSearchQuery): Promise<ExternalProduct[]>;
  getProduct(externalId: string): Promise<ExternalProduct | null>;
}

export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
