/**
 * Product Helper Functions
 * Utilities for product operations in Cloud Functions
 */
import { getFirestore } from 'firebase-admin/firestore';
/**
 * Get product reference
 */
export function productRef(productId) {
    return getFirestore().collection('products').doc(productId);
}
/**
 * Get product by ID
 */
export async function getProduct(productId) {
    const snap = await productRef(productId).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/**
 * List products by category
 */
export async function getProductsByCategory(categoryId) {
    const snapshot = await getFirestore()
        .collection('products')
        .where('category', '==', categoryId)
        .limit(100)
        .get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    }));
}
/**
 * Search products by name or brand
 */
export async function searchProducts(query) {
    if (!query || query.length < 2)
        return [];
    const normalizedQuery = query.toLowerCase();
    // Fetch limited set of products and filter client-side
    // Firestore doesn't support full-text search natively
    const snapshot = await getFirestore()
        .collection('products')
        .limit(100)
        .get();
    return snapshot.docs
        .filter(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();
        const brand = (data.brand || '').toLowerCase();
        return name.includes(normalizedQuery) || brand.includes(normalizedQuery);
    })
        .map(doc => ({
        id: doc.id,
        ...doc.data(),
    }));
}
