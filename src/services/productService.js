/**
 * Product Service
 * Manages product data with Firestore storage and localStorage caching
 * Provides methods for product retrieval, search, and image processing status updates
 */

import { db, storage } from '../firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';
import {
  demoProducts,
  getDemoProduct,
  getDemoProductsByCategory,
} from '../data/productModel.js';

const PRODUCTS_COLLECTION = 'products';
const CACHE_KEY = 'vuvio_products_cache';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Get cached products from localStorage
 * @returns {Object|null}
 */
function getCachedProducts() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Error reading product cache:', error);
    return null;
  }
}

/**
 * Save products to localStorage cache
 * @param {Array} products
 */
function setCachedProducts(products) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: products,
      })
    );
  } catch (error) {
    console.warn('Error saving product cache:', error);
  }
}

/**
 * Get product by ID
 * Tries Firestore first, then falls back to demo data
 * @param {string} productId
 * @returns {Promise<Object|null>}
 */
export async function getProduct(productId) {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        ...snapshot.data(),
      };
    }

    // Fallback to demo data
    return getDemoProduct(productId);
  } catch (error) {
    console.warn(`Error fetching product ${productId}:`, error);
    // Fallback to demo data
    return getDemoProduct(productId);
  }
}

/**
 * Get all products by category
 * @param {string} categoryId
 * @returns {Promise<Array>}
 */
export async function getProductsByCategory(categoryId) {
  try {
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('category', '==', categoryId),
      orderBy('brand'),
      orderBy('name')
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Append demo products from same category
    const demoInCategory = getDemoProductsByCategory(categoryId);
    const demoIds = new Set(products.map(p => p.id));
    const newDemoProducts = demoInCategory.filter(p => !demoIds.has(p.id));

    return [...products, ...newDemoProducts];
  } catch (error) {
    console.warn(`Error fetching products for category ${categoryId}:`, error);
    // Fallback to demo data
    return getDemoProductsByCategory(categoryId);
  }
}

/**
 * Search products by name or brand
 * Tries Firestore first, then falls back to demo data only if permission/network error
 * @param {string} query - Search term
 * @returns {Promise<Array>}
 * @throws {Error} Firebase permission or network errors
 */
export async function searchProducts(searchQuery) {
  if (!searchQuery || searchQuery.length < 2) {
    return [];
  }

  const normalizedQuery = searchQuery.toLowerCase();

  try {
    // Get products from Firestore (limited search)
    // Firestore doesn't support full-text search, so we fetch a larger set
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const firestoreProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Combine with demo products
    const allProducts = [...firestoreProducts, ...demoProducts];

    // Filter by name, brand, or searchTerms
    return allProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const brand = (product.brand || '').toLowerCase();
      const searchTerms = (product.searchTerms || []).map(t => t.toLowerCase());

      return name.includes(normalizedQuery) ||
             brand.includes(normalizedQuery) ||
             searchTerms.some(term => term.includes(normalizedQuery));
    });
  } catch (error) {
    // Log the actual error for debugging
    console.error('Product search error:', error.code || error.message, error);

    // Re-throw permission and network errors to let UI handle them
    if (error.code === 'permission-denied' ||
        error.code === 'unavailable' ||
        error.code === 'network-error' ||
        error.message?.includes('Failed to get document') ||
        error.message?.includes('permission')) {
      throw error;
    }

    // For other errors, fallback to demo data search
    console.warn('Falling back to demo products due to:', error.code);
    return demoProducts.filter(product => {
      const name = (product.name || '').toLowerCase();
      const brand = (product.brand || '').toLowerCase();
      const searchTerms = (product.searchTerms || []).map(t => t.toLowerCase());

      return name.includes(normalizedQuery) ||
             brand.includes(normalizedQuery) ||
             searchTerms.some(term => term.includes(normalizedQuery));
    });
  }
}

/**
 * Create a new product
 * @param {Object} productData - Product data (without id, timestamps)
 * @returns {Promise<Object>} - Created product with id
 */
export async function createProduct(productData) {
  try {
    const now = Date.now();
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...productData,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      ...productData,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

/**
 * Update product with image processing status
 * Called after image processing is complete
 * @param {string} productId
 * @param {string} status - 'pending' | 'processing' | 'ready' | 'failed'
 * @param {Object} urls - Thumbnail URLs { small, medium, large }
 * @param {string} [error] - Error message if failed
 * @returns {Promise<void>}
 */
export async function updateProductImageStatus(productId, status, urls = {}, error = null) {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);

    const imageStatus = {
      status,
      updatedAt: Date.now(),
    };

    if (urls && Object.keys(urls).length > 0) {
      imageStatus.urls = urls;
    }

    if (error) {
      imageStatus.error = error;
    }

    await updateDoc(docRef, {
      imageStatus,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error(`Error updating product image status for ${productId}:`, error);
    throw error;
  }
}

/**
 * Get image from Firebase Storage
 * @param {string} storagePath - Path in Storage (e.g., 'products/product-id/thumbnail-160.webp')
 * @returns {Promise<Uint8Array>}
 */
export async function getProductImageFromStorage(storagePath) {
  try {
    const fileRef = ref(storage, storagePath);
    const bytes = await getBytes(fileRef);
    return bytes;
  } catch (error) {
    console.error(`Error fetching image from storage ${storagePath}:`, error);
    throw error;
  }
}

/**
 * Clear product cache
 * Useful after batch updates
 */
export function clearProductCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('Error clearing product cache:', error);
  }
}

/**
 * Preload products by category (useful for UI preparation)
 * @param {string} categoryId
 * @returns {Promise<Array>}
 */
export async function preloadProductCategory(categoryId) {
  try {
    const products = await getProductsByCategory(categoryId);
    // Cache in memory and localStorage
    const categoryCache = {
      timestamp: Date.now(),
      categoryId,
      products,
    };
    sessionStorage.setItem(
      `products_category_${categoryId}`,
      JSON.stringify(categoryCache)
    );
    return products;
  } catch (error) {
    console.error(`Error preloading category ${categoryId}:`, error);
    return getDemoProductsByCategory(categoryId);
  }
}

/**
 * Get all product categories with product counts
 * @returns {Promise<Array>}
 */
export function getProductName(product) {
  return product?.name || product?.displayName || 'Unknown Product';
}

export function getProductThumbnailUrl(product, size = 'medium') {
  if (!product) return null;
  const sizeKey = `thumbnail_${size}`;
  return product?.images?.[sizeKey] || product?.thumbnailUrl || product?.imageUrl || null;
}

export async function getProductCategoriesWithCounts() {
  try {
    const categoryCounts = {};

    // Get all products and count by category
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      limit(1000) // Limit to prevent excessive reads
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => {
      const category = doc.data().category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Add demo products to counts
    demoProducts.forEach(product => {
      categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    });

    return categoryCounts;
  } catch (error) {
    console.warn('Error getting category counts:', error);
    // Return counts from demo data only
    const counts = {};
    demoProducts.forEach(product => {
      counts[product.category] = (counts[product.category] || 0) + 1;
    });
    return counts;
  }
}
