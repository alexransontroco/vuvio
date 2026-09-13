/**
 * Icecat API Routes
 *
 * POST /api/products/search-icecat - Search for products in Icecat
 * POST /api/products/import-icecat - Import a product from Icecat
 */
import { logger } from 'firebase-functions';
import { db } from '../shared/firebaseAdmin.js';
import { searchIcecatProducts, getIcecatProduct, mapIcecatToVuvioProduct, } from './icecatService.js';
import { checkProductExists, mergeProductData } from './deduplicateProduct.js';
import { icecatUsername, icecatApiKey, icecatLanguage, icecatMarket, } from '../config/env.js';
import { ApiError, sendError } from '../shared/errors.js';
export async function searchIcecatHandler(req, res) {
    try {
        const { query, limit = 20 } = req.body;
        if (!query || typeof query !== 'string' || query.length < 2) {
            throw new ApiError('invalid_input', 'Search query must be at least 2 characters');
        }
        // Check if Icecat is configured
        const username = icecatUsername.value();
        const apiKey = icecatApiKey.value();
        if (!username || !apiKey) {
            logger.warn('[Icecat] API not configured - falling back to local search');
            // Fall back to local search only
            return searchLocalProducts(query, res);
        }
        const config = {
            username,
            apiKey,
            language: icecatLanguage,
            market: icecatMarket,
        };
        // Search in Icecat
        const icecatResults = await searchIcecatProducts(query, config);
        // Enrich with local data if available
        const enrichedResults = await enrichSearchResults(icecatResults, query);
        res.json({
            success: true,
            source: 'icecat',
            count: enrichedResults.length,
            results: enrichedResults.slice(0, limit),
        });
    }
    catch (error) {
        sendError(res, error);
    }
}
export async function importIcecatHandler(req, res) {
    try {
        const { productId, category } = req.body;
        if (!productId || typeof productId !== 'string') {
            throw new ApiError('invalid_input', 'Missing or invalid productId');
        }
        if (!category || typeof category !== 'string') {
            throw new ApiError('invalid_input', 'Missing or invalid category');
        }
        // Verify user is authenticated
        const auth = req.headers.authorization;
        if (!auth) {
            throw new ApiError('unauthorized', 'Missing authentication');
        }
        // Check if Icecat is configured
        const username = icecatUsername.value();
        const apiKey = icecatApiKey.value();
        if (!username || !apiKey) {
            throw new ApiError('service_unavailable', 'Icecat service not configured');
        }
        const config = {
            username,
            apiKey,
            language: icecatLanguage,
            market: icecatMarket,
        };
        // Fetch product from Icecat
        const icecatProduct = await getIcecatProduct(productId, config);
        if (!icecatProduct) {
            throw new ApiError('not_found', 'Product not found in Icecat');
        }
        // Map to Vuvio format
        const vuvioProduct = mapIcecatToVuvioProduct(icecatProduct, category);
        // Check for duplicates
        const dupCheck = await checkProductExists(vuvioProduct);
        let importedProductId;
        if (dupCheck.exists && dupCheck.productId) {
            // Update existing product with new data
            logger.info(`[Icecat] Product already exists (${dupCheck.conflictField}): ${dupCheck.productId}`);
            await mergeProductData(dupCheck.productId, vuvioProduct);
            importedProductId = dupCheck.productId;
        }
        else {
            // Create new product document
            const docRef = await db
                .collection('products')
                .add({
                ...vuvioProduct,
                normalizedName: normalizeForIndex(String(vuvioProduct.name)),
                normalizedBrand: normalizeForIndex(String(vuvioProduct.brand)),
            });
            importedProductId = docRef.id;
            logger.info(`[Icecat] Product imported: ${importedProductId}`);
        }
        res.json({
            success: true,
            productId: importedProductId,
            isUpdate: dupCheck.exists,
            conflictField: dupCheck.conflictField,
        });
    }
    catch (error) {
        sendError(res, error);
    }
}
/**
 * Search local products when Icecat is not available
 */
async function searchLocalProducts(query, res) {
    try {
        const normalizedQuery = query.toLowerCase();
        const snapshot = await db
            .collection('products')
            .where('searchTerms', 'array-contains', normalizedQuery)
            .limit(20)
            .get();
        const results = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json({
            success: true,
            source: 'local',
            count: results.length,
            results,
        });
    }
    catch (error) {
        logger.error('[Search] Local search error:', error);
        res.json({
            success: true,
            source: 'local',
            count: 0,
            results: [],
        });
    }
}
/**
 * Enrich Icecat results with local product data if available
 */
async function enrichSearchResults(icecatResults, query) {
    if (icecatResults.length === 0) {
        // If Icecat returned nothing, search locally
        const normalizedQuery = query.toLowerCase();
        const snapshot = await db
            .collection('products')
            .where('searchTerms', 'array-contains', normalizedQuery)
            .limit(20)
            .get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            source: 'local',
        }));
    }
    // Map Icecat results to product format
    return icecatResults.map((result) => ({
        source: 'icecat',
        sourceProductId: result.product_id,
        brand: result.brand_name,
        name: result.product_name,
        canImport: true,
    }));
}
/**
 * Normalize text for Firestore indexing
 */
function normalizeForIndex(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
