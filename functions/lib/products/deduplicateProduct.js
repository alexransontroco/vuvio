/**
 * Product Deduplication Service
 *
 * Prevents importing the same product multiple times from different sources.
 * Matches products by GTIN/EAN, MPN + brand, and normalized name + brand.
 */
import { db } from '../shared/firestore.js';
import { logger } from 'firebase-functions';
/**
 * Check if a product already exists in Firestore
 * Uses multiple matching strategies to find duplicates
 */
export async function checkProductExists(productData) {
    try {
        const productsRef = db.collection('products');
        // 1. Check by GTIN/EAN
        if (productData.gtin) {
            const gtinSnapshot = await productsRef
                .where('gtin', '==', productData.gtin)
                .limit(1)
                .get();
            if (!gtinSnapshot.empty) {
                const existingDoc = gtinSnapshot.docs[0];
                return {
                    exists: true,
                    productId: existingDoc.id,
                    conflictField: 'gtin',
                    existingData: existingDoc.data(),
                };
            }
        }
        if (productData.ean) {
            const eanSnapshot = await productsRef
                .where('ean', '==', productData.ean)
                .limit(1)
                .get();
            if (!eanSnapshot.empty) {
                const existingDoc = eanSnapshot.docs[0];
                return {
                    exists: true,
                    productId: existingDoc.id,
                    conflictField: 'ean',
                    existingData: existingDoc.data(),
                };
            }
        }
        // 2. Check by MPN + brand
        if (productData.mpn && productData.brand) {
            const mpnSnapshot = await productsRef
                .where('mpn', '==', productData.mpn)
                .where('brand', '==', productData.brand)
                .limit(1)
                .get();
            if (!mpnSnapshot.empty) {
                const existingDoc = mpnSnapshot.docs[0];
                return {
                    exists: true,
                    productId: existingDoc.id,
                    conflictField: 'mpn+brand',
                    existingData: existingDoc.data(),
                };
            }
        }
        // 3. Check by normalized name + brand
        if (productData.name && productData.brand) {
            const normalizedName = normalizeName(String(productData.name));
            const normalizedBrand = normalizeName(String(productData.brand));
            const nameSnapshot = await productsRef
                .where('normalizedName', '==', normalizedName)
                .where('normalizedBrand', '==', normalizedBrand)
                .limit(1)
                .get();
            if (!nameSnapshot.empty) {
                const existingDoc = nameSnapshot.docs[0];
                return {
                    exists: true,
                    productId: existingDoc.id,
                    conflictField: 'name+brand',
                    existingData: existingDoc.data(),
                };
            }
        }
        // 4. Check by Icecat ID (for re-imports)
        if (productData.sourceProductId) {
            const icecatSnapshot = await productsRef
                .where('sourceProductId', '==', productData.sourceProductId)
                .limit(1)
                .get();
            if (!icecatSnapshot.empty) {
                const existingDoc = icecatSnapshot.docs[0];
                return {
                    exists: true,
                    productId: existingDoc.id,
                    conflictField: 'sourceProductId',
                    existingData: existingDoc.data(),
                };
            }
        }
        return { exists: false };
    }
    catch (error) {
        logger.error('Deduplication check error:', error);
        // On error, don't block the import - log and continue
        return { exists: false };
    }
}
/**
 * Update existing product with new data from external source
 * Merges rather than replaces to preserve user-added data
 */
export async function mergeProductData(productId, newData) {
    try {
        const productRef = db.collection('products').doc(productId);
        const existingDoc = await productRef.get();
        if (!existingDoc.exists) {
            throw new Error(`Product not found: ${productId}`);
        }
        const existing = existingDoc.data();
        const merged = {
            ...existing,
            // Don't override user-specific fields
            ...newData,
            // Preserve user data
            userNotes: existing?.userNotes,
            userAdded: existing?.userAdded,
            userImageUrl: existing?.userImageUrl,
            // Track update
            updatedAt: new Date().toISOString(),
            updatedBy: 'icecat',
        };
        await productRef.update(merged);
        logger.info(`[Dedup] Merged product: ${productId}`);
    }
    catch (error) {
        logger.error(`[Dedup] Merge error for ${productId}:`, error);
        throw error;
    }
}
/**
 * Normalize product name for comparison
 * Removes special chars, lowercases, standardizes spaces
 */
function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}
