import { logger } from 'firebase-functions';
import { db } from '../../shared/firestore.js';
import { AffiliateProvider, AffiliateQuery, AffiliateOffer } from '../affiliateTypes.js';

interface ManualLinkDoc {
  brand?: string;
  modelKeywords?: string[];
  offers: AffiliateOffer[];
}

export class ManualAffiliateProvider implements AffiliateProvider {
  readonly id = 'manual';

  canHandle(_query: AffiliateQuery): boolean {
    return true;
  }

  async resolve(query: AffiliateQuery): Promise<AffiliateOffer[]> {
    try {
      const searchTerms = [
        query.brand?.toLowerCase(),
        query.name?.toLowerCase(),
        query.mpn?.toLowerCase(),
        query.gtin?.toLowerCase(),
      ].filter(Boolean) as string[];

      if (searchTerms.length === 0) return [];

      const snapshot = await db.collection('affiliateLinks').get();
      const results: AffiliateOffer[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data() as ManualLinkDoc;
        const keywords = [
          data.brand?.toLowerCase(),
          ...(data.modelKeywords ?? []).map((k) => k.toLowerCase()),
        ].filter(Boolean) as string[];

        const matched = searchTerms.some((term) =>
          keywords.some((kw) => kw.includes(term) || term.includes(kw))
        );

        if (matched && Array.isArray(data.offers)) {
          results.push(...data.offers);
        }
      }

      return results;
    } catch (err) {
      logger.warn('[ManualAffiliateProvider] Firestore lookup failed:', err);
      return [];
    }
  }
}
