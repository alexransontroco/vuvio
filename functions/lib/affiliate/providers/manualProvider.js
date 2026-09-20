import { logger } from 'firebase-functions';
import { db } from '../../shared/firestore.js';
export class ManualAffiliateProvider {
    id = 'manual';
    canHandle(_query) {
        return true;
    }
    async resolve(query) {
        try {
            const searchTerms = [
                query.brand?.toLowerCase(),
                query.name?.toLowerCase(),
                query.mpn?.toLowerCase(),
                query.gtin?.toLowerCase(),
            ].filter(Boolean);
            if (searchTerms.length === 0)
                return [];
            const snapshot = await db.collection('affiliateLinks').get();
            const results = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const keywords = [
                    data.brand?.toLowerCase(),
                    ...(data.modelKeywords ?? []).map((k) => k.toLowerCase()),
                ].filter(Boolean);
                const matched = searchTerms.some((term) => keywords.some((kw) => kw.includes(term) || term.includes(kw)));
                if (matched && Array.isArray(data.offers)) {
                    results.push(...data.offers);
                }
            }
            return results;
        }
        catch (err) {
            logger.warn('[ManualAffiliateProvider] Firestore lookup failed:', err);
            return [];
        }
    }
}
