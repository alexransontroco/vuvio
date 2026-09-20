import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
import { ManualAffiliateProvider } from './providers/manualProvider.js';
import { AmazonAffiliateProvider } from './providers/amazonProvider.js';
import { AwinAffiliateProvider } from './providers/awinProvider.js';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
function cacheKey(query) {
    const parts = [
        query.brand?.toLowerCase().replace(/\s+/g, '-'),
        query.name?.toLowerCase().replace(/\s+/g, '-'),
        query.mpn?.toLowerCase(),
        query.gtin,
    ].filter(Boolean);
    return parts.join(':');
}
async function loadFromCache(key) {
    try {
        const doc = await db.collection('affiliateCache').doc(key).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const age = Date.now() - (data.cachedAt?.toMillis?.() ?? 0);
        if (age > CACHE_TTL_MS)
            return null;
        return data.offers;
    }
    catch {
        return null;
    }
}
async function writeToCache(key, offers) {
    try {
        await db.collection('affiliateCache').doc(key).set({
            offers,
            cachedAt: FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger.warn('[affiliateResolver] Cache write failed:', err);
    }
}
export class AffiliateResolver {
    providers;
    constructor(config) {
        this.providers = [new ManualAffiliateProvider()];
        if (config.amazon?.accessKey && config.amazon.secretKey) {
            this.providers.push(new AmazonAffiliateProvider({
                accessKey: config.amazon.accessKey,
                secretKey: config.amazon.secretKey,
                associateTag: config.amazon.associateTagFr,
                marketplace: 'www.amazon.fr',
                region: 'eu-west-1',
                country: 'FR',
            }));
        }
        if (config.awin?.apiKey && config.awin.publisherId) {
            this.providers.push(new AwinAffiliateProvider({
                apiKey: config.awin.apiKey,
                publisherId: config.awin.publisherId,
                country: 'FR',
                language: 'fr',
            }));
        }
    }
    async resolve(query) {
        const key = cacheKey(query);
        if (key) {
            const cached = await loadFromCache(key);
            if (cached)
                return cached;
        }
        const eligible = this.providers.filter((p) => p.canHandle(query));
        const results = await Promise.allSettled(eligible.map((p) => p.resolve(query)));
        const offers = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                offers.push(...result.value);
            }
        }
        const deduped = deduplicateOffers(offers);
        if (key && deduped.length > 0) {
            writeToCache(key, deduped).catch(() => { });
        }
        return deduped;
    }
}
function deduplicateOffers(offers) {
    const seen = new Set();
    return offers.filter((o) => {
        const key = `${o.merchant}:${o.country}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
