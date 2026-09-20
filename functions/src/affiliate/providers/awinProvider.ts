import { logger } from 'firebase-functions';
import { AffiliateProvider, AffiliateQuery, AffiliateOffer } from '../affiliateTypes.js';

interface AwinConfig {
  apiKey: string;
  publisherId: string;
  country: string;
  language: string;
}

export class AwinAffiliateProvider implements AffiliateProvider {
  readonly id: string;

  constructor(private config: AwinConfig) {
    this.id = `awin:${config.country}`;
  }

  canHandle(query: AffiliateQuery): boolean {
    if (!this.config.apiKey || !this.config.publisherId) return false;
    return !!(query.brand || query.name);
  }

  async resolve(query: AffiliateQuery): Promise<AffiliateOffer[]> {
    try {
      const searchTerm = [query.brand, query.name].filter(Boolean).join(' ').trim();
      if (!searchTerm) return [];

      const params = new URLSearchParams({
        search: searchTerm,
        searchType: 'product',
        language: this.config.language,
        countryCode: this.config.country,
        limit: '3',
      });

      const url = `https://productdata.awin.com/datafeed/list/apikey/${this.config.apiKey}/lang/${this.config.language}/cus/${this.config.publisherId}/fbn/1/format/json/?${params}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });

      if (!response.ok) {
        logger.warn(`[AwinProvider] API error ${response.status}`);
        return [];
      }

      const data = await response.json() as Array<{
        product_name?: string;
        merchant_product_id?: string;
        aw_deep_link?: string;
        merchant_name?: string;
      }>;

      if (!Array.isArray(data) || data.length === 0) return [];

      return data.slice(0, 1).map((item) => ({
        merchant: item.merchant_name ?? 'Awin',
        affiliateUrl: item.aw_deep_link ?? '',
        country: this.config.country,
      })).filter((o) => o.affiliateUrl);
    } catch (err) {
      logger.warn('[AwinProvider] resolve failed:', err);
      return [];
    }
  }
}
