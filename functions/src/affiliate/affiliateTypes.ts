export interface AffiliateOffer {
  merchant: string;
  affiliateUrl: string;
  country: string | null;
  price?: number;
  currency?: string;
  imageUrl?: string;
}

export interface AffiliateQuery {
  brand?: string;
  name?: string;
  mpn?: string;
  gtin?: string;
  productId?: string;
  category?: string;
  country?: string;
}

export interface AffiliateProvider {
  readonly id: string;
  canHandle(query: AffiliateQuery): boolean;
  resolve(query: AffiliateQuery): Promise<AffiliateOffer[]>;
}
