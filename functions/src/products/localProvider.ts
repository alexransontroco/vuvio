import { db } from '../shared/firestore.js';
import { ProductProvider, ProductSearchQuery, ExternalProduct, normalizeProductName } from './productProvider.js';

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function compact(value: string): string {
  return normalizeProductName(value).replace(/\s+/g, '');
}

function queryTerms(text: string): string[] {
  const normalized = normalizeProductName(text);
  const words = normalized.split(' ').filter((w) => w.length > 1);
  return [...new Set([normalized, compact(normalized), ...words].filter((term) => term.length > 1))].slice(0, 10);
}

function docToExternal(id: string, data: FirebaseFirestore.DocumentData): ExternalProduct {
  const officialProductUrl = data.officialProductUrl || data.productUrl || data.sourceProductUrl;
  return {
    externalId: id,
    provider: 'local',
    brand: String(data.brand ?? ''),
    name: String(data.name ?? ''),
    normalizedName: String(data.normalizedName ?? normalizeProductName(String(data.name ?? ''))),
    category: data.category ? String(data.category) : undefined,
    subcategory: data.subcategory ? String(data.subcategory) : undefined,
    description: data.description ? String(data.description) : undefined,
    aliases: arrayOfStrings(data.aliases),
    tags: arrayOfStrings(data.tags),
    gtin: data.gtin ? String(data.gtin) : undefined,
    ean: data.ean ? String(data.ean) : undefined,
    upc: data.upc ? String(data.upc) : undefined,
    mpn: data.mpn ? String(data.mpn) : undefined,
    productUrl: officialProductUrl ? String(officialProductUrl) : undefined,
    officialProductUrl: officialProductUrl ? String(officialProductUrl) : undefined,
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
    imageRightsStatus: data.imageRightsStatus,
    imageSource: data.imageSource ? String(data.imageSource) : undefined,
    imageRightsSource: data.imageRightsSource ? String(data.imageRightsSource) : undefined,
    imageAllowedUsages: Array.isArray(data.imageAllowedUsages) ? data.imageAllowedUsages.filter((value): value is string => typeof value === 'string') : undefined,
    imageRightsCheckedAt: data.imageRightsCheckedAt ? String(data.imageRightsCheckedAt) : undefined,
    imageRightsExpiresAt: data.imageRightsExpiresAt ? String(data.imageRightsExpiresAt) : undefined,
    imageProductId: data.imageProductId ? String(data.imageProductId) : undefined,
    imageHostingStatus: data.imageHostingStatus ? String(data.imageHostingStatus) : undefined,
    sourceProductUrl: officialProductUrl ? String(officialProductUrl) : undefined,
    canImport: false,
  };
}

function productScore(product: ExternalProduct, terms: string[]): number {
  const haystackParts = [
    product.brand,
    product.name,
    `${product.brand} ${product.name}`,
    ...(product.aliases ?? []),
    ...(product.tags ?? []),
  ];
  const haystack = haystackParts.map(normalizeProductName);
  const compactHaystack = haystack.map(compact);

  let score = 0;
  for (const term of terms) {
    const compactTerm = compact(term);
    if (normalizeProductName(`${product.brand} ${product.name}`) === term || compact(`${product.brand} ${product.name}`) === compactTerm) score += 12;
    else if (normalizeProductName(product.name) === term || compact(product.name) === compactTerm) score += 10;
    else if (normalizeProductName(product.brand) === term || compact(product.brand) === compactTerm) score += 5;
    else if (haystack.some((value) => value === term) || compactHaystack.some((value) => value === compactTerm)) score += 4;
    else if (haystack.some((value) => value.includes(term)) || compactHaystack.some((value) => value.includes(compactTerm))) score += 2;
  }
  return score;
}

export class LocalProductProvider implements ProductProvider {
  readonly id = 'local';

  canHandle(query: ProductSearchQuery): boolean {
    return !!(query.text || query.gtin || query.ean || query.brand || query.mpn);
  }

  async search(query: ProductSearchQuery): Promise<ExternalProduct[]> {
    const ref = db.collection('products');
    const limit = query.limit || 20;

    if (query.gtin) {
      const snap = await ref.where('gtin', '==', query.gtin).limit(limit).get();
      return snap.docs.map((d) => docToExternal(d.id, d.data()));
    }

    if (query.ean) {
      const snap = await ref.where('ean', '==', query.ean).limit(limit).get();
      return snap.docs.map((d) => docToExternal(d.id, d.data()));
    }

    if (query.brand && query.mpn) {
      const snap = await ref
        .where('brand', '==', query.brand)
        .where('mpn', '==', query.mpn)
        .limit(limit)
        .get();
      return snap.docs.map((d) => docToExternal(d.id, d.data()));
    }

    if (query.text) {
      const termsToTry = queryTerms(query.text);
      if (termsToTry.length === 0) return [];

      const snaps = await Promise.all(
        termsToTry.map((term) =>
          ref.where('searchTerms', 'array-contains', term).limit(limit).get()
        )
      );
      const seen = new Set<string>();
      const results: ExternalProduct[] = [];
      for (const snap of snaps) {
        for (const d of snap.docs) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push(docToExternal(d.id, d.data()));
          }
        }
      }
      return results
        .map((product) => ({ product, score: productScore(product, termsToTry) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.product.brand.localeCompare(b.product.brand) || a.product.name.localeCompare(b.product.name))
        .map(({ product }) => product)
        .slice(0, limit);
    }

    return [];
  }

  async getProduct(externalId: string): Promise<ExternalProduct | null> {
    const doc = await db.collection('products').doc(externalId).get();
    if (!doc.exists) return null;
    return docToExternal(doc.id, doc.data()!);
  }
}
