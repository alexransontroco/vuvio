const BASE_URL = '/api';

function normalizeProductResult(product) {
  const provider = product.provider ?? 'local';
  const externalId = product.externalId ?? product.id;
  return {
    ...product,
    id: product.id ?? `${provider}:${externalId}`,
    externalId,
    provider,
  };
}

export async function searchProducts(query, { signal, limit = 10, category } = {}) {
  if (!query?.trim()) return [];
  try {
    const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
    if (category) params.set('category', category);
    const res = await fetch(`${BASE_URL}/products/search?${params}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(normalizeProductResult);
  } catch (err) {
    if (err?.name === 'AbortError') return [];
    console.warn('[productSearchService] search failed:', err);
    return [];
  }
}

export async function resolveAffiliateOffers({ brand, name, mpn, gtin, productId, category } = {}) {
  if (!brand && !name && !mpn && !gtin) return [];
  try {
    const res = await fetch(`${BASE_URL}/affiliate/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand, name, mpn, gtin, productId, category }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.offers ?? [];
  } catch (err) {
    console.warn('[productSearchService] resolve failed:', err);
    return [];
  }
}
