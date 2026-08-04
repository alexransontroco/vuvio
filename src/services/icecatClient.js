const API_BASE = '/api';

async function getAuthToken() {
  try {
    const { auth } = await import('../firebase.js');
    if (!auth.currentUser) throw new Error('Not authenticated');
    return await auth.currentUser.getIdToken();
  } catch {
    return '';
  }
}

/**
 * Search products via the Vuvio backend API.
 * Supports text, brand, gtin, ean, category query params.
 */
export async function searchProductsAPI(query, { brand, gtin, ean, category, limit = 20 } = {}) {
  if (!query && !brand && !gtin && !ean) return [];

  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (brand) params.set('brand', brand);
    if (gtin) params.set('gtin', gtin);
    if (ean) params.set('ean', ean);
    if (category) params.set('category', category);
    params.set('limit', String(limit));

    const response = await fetch(`${API_BASE}/products/search?${params}`);

    if (!response.ok) {
      console.warn('[ProductAPI] Search failed:', response.status);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[ProductAPI] Search error:', error);
    return [];
  }
}

/**
 * Import a product from an external provider into Vuvio.
 * @param {string} providerId - e.g. 'icecat'
 * @param {string} externalId - provider-specific product ID
 * @param {string} category - Vuvio category
 */
export async function importProduct(providerId, externalId, category) {
  if (!providerId || !externalId || !category) {
    throw new Error('Missing providerId, externalId, or category');
  }

  const token = await getAuthToken();

  const response = await fetch(`${API_BASE}/products/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ providerId, externalId, category }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Import failed: ${response.status}`);
  }

  return response.json();
}

// Legacy alias — kept for components still using the old name
export async function searchIcecatProducts(query, limit = 20) {
  return searchProductsAPI(query, { limit });
}

// Legacy alias
export async function importIcecatProduct(externalId, category) {
  return importProduct('icecat', externalId, category);
}

export function categorizeIcecatProduct(product) {
  const name = (product.name || product.product_name || '').toLowerCase();
  const brand = (product.brand || product.brand_name || '').toLowerCase();

  if (name.includes('camera') || name.includes('action') || brand.includes('gopro') || brand.includes('dji')) return 'recording';
  if (name.includes('mic') || name.includes('microphone') || brand.includes('rode')) return 'audio';
  if (name.includes('bike') || name.includes('cycle') || name.includes('gravel')) return 'activity';
  if (name.includes('mount') || name.includes('tripod') || name.includes('bracket')) return 'power_accessories';

  return 'recording';
}
