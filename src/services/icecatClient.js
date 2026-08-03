/**
 * Icecat Client Service
 *
 * Frontend client for Icecat product integration.
 * Communicates with backend API which manages credentials.
 */

const API_BASE = '/api';

/**
 * Search for products in Icecat
 * Falls back to local products if Icecat is unavailable
 *
 * @param {string} query - Product brand, name, or model
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Search results
 */
export async function searchIcecatProducts(query, limit = 20) {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/products/search-icecat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      console.warn('[Icecat] Search failed:', response.status);
      return [];
    }

    const data = await response.json();
    console.log(`[Icecat] Found ${data.count} products (source: ${data.source})`);
    return data.results || [];
  } catch (error) {
    console.error('[Icecat] Search error:', error);
    return [];
  }
}

/**
 * Import a product from Icecat
 *
 * @param {string} productId - Icecat product ID
 * @param {string} category - Vuvio category (recording, audio, etc.)
 * @returns {Promise<Object>} Imported product data
 */
export async function importIcecatProduct(productId, category) {
  if (!productId || !category) {
    throw new Error('Missing productId or category');
  }

  try {
    const response = await fetch(`${API_BASE}/products/import-icecat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({ productId, category }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Import failed');
    }

    const data = await response.json();
    console.log(`[Icecat] Product imported: ${data.productId}`);
    return data;
  } catch (error) {
    console.error('[Icecat] Import error:', error);
    throw error;
  }
}

/**
 * Get Firebase auth token for backend API
 */
async function getAuthToken() {
  try {
    const { auth } = await import('../firebase.js');
    if (!auth.currentUser) {
      throw new Error('Not authenticated');
    }
    return await auth.currentUser.getIdToken();
  } catch (error) {
    console.warn('[Auth] Could not get token:', error);
    return '';
  }
}

/**
 * Determine product category from Icecat data
 */
export function categorizeIcecatProduct(product) {
  const name = (product.product_name || '').toLowerCase();
  const brand = (product.brand_name || '').toLowerCase();

  // Camera/recording devices
  if (
    name.includes('camera') ||
    name.includes('gopro') ||
    name.includes('dji') ||
    name.includes('action') ||
    name.includes('360')
  ) {
    return 'recording';
  }

  // Microphones
  if (name.includes('mic') || name.includes('microphone') || brand.includes('rode')) {
    return 'audio';
  }

  // Bikes
  if (name.includes('bike') || name.includes('cycle') || name.includes('gravel')) {
    return 'activity';
  }

  // Accessories
  if (
    name.includes('mount') ||
    name.includes('clip') ||
    name.includes('bracket') ||
    name.includes('tripod')
  ) {
    return 'power_accessories';
  }

  // Bikes & Components
  if (
    name.includes('helmet') ||
    name.includes('shoe') ||
    name.includes('fork') ||
    name.includes('frame')
  ) {
    return 'activity';
  }

  return 'recording'; // Default
}
