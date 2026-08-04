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

function isDevFallbackAllowed() {
  return Boolean(import.meta.env?.DEV);
}

export function normalizeProduct(product, id = product?.id) {
  if (!product) return null;
  const imageStatusValue = typeof product.imageStatus === 'string'
    ? product.imageStatus
    : product.imageStatus?.status;
  const normalizedStatus = product.status ?? imageStatusValue ?? 'unknown';
  const thumbnailUrl = product.thumbnailUrl
    || product.images?.thumbnail_medium
    || product.images?.medium
    || product.imageStatus?.urls?.medium
    || product.imageUrl
    || null;

  return {
    ...product,
    id,
    name: product.name ?? product.model ?? product.displayName ?? 'Unknown product',
    category: product.category ?? 'activity',
    thumbnailUrl,
    provider: product.provider ?? (product.imageSource === 'placeholder' ? 'demo' : 'firestore'),
    imageSource: product.imageSource ?? (thumbnailUrl ? 'unknown' : 'placeholder'),
    status: normalizedStatus,
  };
}

async function getFirestoreProduct(productId) {
  const docRef = doc(db, PRODUCTS_COLLECTION, productId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return normalizeProduct(snapshot.data(), snapshot.id);
}

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
    const firestoreProduct = await getFirestoreProduct(productId);
    if (firestoreProduct) return firestoreProduct;

    // Fallback to demo data
    return normalizeProduct(getDemoProduct(productId), productId);
  } catch (error) {
    console.warn(`Error fetching product ${productId}:`, error);
    // Fallback to demo data
    return normalizeProduct(getDemoProduct(productId), productId);
  }
}

/**
 * Product resolver for equipment.
 * Firestore `products` is the source of truth. Local/demo fallback is only used
 * in development or when the local product is explicitly a placeholder/demo.
 */
export async function resolveEquipmentProduct(productId, { allowLocalFallback = isDevFallbackAllowed() } = {}) {
  if (!productId) return null;

  try {
    const firestoreProduct = await getFirestoreProduct(productId);
    if (firestoreProduct) return firestoreProduct;
  } catch (error) {
    console.warn(`[productService] Firestore product resolve failed for ${productId}:`, error.message);
  }

  const localProduct = normalizeProduct(getDemoProduct(productId), productId);
  if (!localProduct) return null;

  const isPlaceholder = localProduct.provider === 'demo'
    || localProduct.imageSource === 'placeholder'
    || localProduct.status === 'placeholder';

  if (allowLocalFallback || isPlaceholder) {
    return {
      ...localProduct,
      provider: localProduct.provider ?? 'demo',
      imageSource: localProduct.imageSource ?? 'placeholder',
      status: localProduct.status ?? 'placeholder',
      isLocalFallback: true,
    };
  }

  return null;
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
    const products = snapshot.docs.map(doc => normalizeProduct(doc.data(), doc.id)).filter(Boolean);

    // Append demo products only in development as explicit placeholders.
    const demoInCategory = import.meta.env.DEV ? getDemoProductsByCategory(categoryId) : [];
    const demoIds = new Set(products.map(p => p.id));
    const newDemoProducts = demoInCategory
      .map((product) => normalizeProduct({ ...product, provider: product.provider ?? 'demo' }, product.id))
      .filter((product) => product && !demoIds.has(product.id));

    return [...products, ...newDemoProducts];
  } catch (error) {
    console.warn(`Error fetching products for category ${categoryId}:`, error);
    // Fallback to demo data
    return import.meta.env.DEV ? getDemoProductsByCategory(categoryId) : [];
  }
}

/**
 * Search products by name or brand
 * Tries Firestore first, then falls back to demo data only if permission/network error
 * @param {string} query - Search term
 * @returns {Promise<Array>}
 * @throws {Error} Firebase permission or network errors
 */
export async function searchProducts(searchQuery, categoryId = null) {
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
    const firestoreProducts = snapshot.docs.map(doc => normalizeProduct(doc.data(), doc.id)).filter(Boolean);

    // Demo products are development/placeholder fallback, never authoritative.
    const firestoreIds = new Set(firestoreProducts.map((p) => p.id));
    const newDemoProducts = (import.meta.env.DEV ? demoProducts : [])
      .map((product) => normalizeProduct({ ...product, provider: product.provider ?? 'demo' }, product.id))
      .filter((product) => product && !firestoreIds.has(product.id));
    const allProducts = [...firestoreProducts, ...newDemoProducts];

    // Filter by name, brand, or searchTerms
    return allProducts.filter(product => {
      if (categoryId && product.category !== categoryId) return false;
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
    if (!import.meta.env.DEV) return [];

    return demoProducts.map((product) => normalizeProduct(product, product.id)).filter(product => {
      if (categoryId && product.category !== categoryId) return false;
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
