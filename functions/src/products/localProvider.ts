import { db } from '../shared/firestore.js';
import { ProductProvider, ProductSearchQuery, ExternalProduct, normalizeProductName } from './productProvider.js';

function docToExternal(id: string, data: FirebaseFirestore.DocumentData): ExternalProduct {
  return {
    externalId: id,
    provider: 'local',
    brand: String(data.brand ?? ''),
    name: String(data.name ?? ''),
    normalizedName: String(data.normalizedName ?? normalizeProductName(String(data.name ?? ''))),
    category: data.category ? String(data.category) : undefined,
    description: data.description ? String(data.description) : undefined,
    gtin: data.gtin ? String(data.gtin) : undefined,
    ean: data.ean ? String(data.ean) : undefined,
    upc: data.upc ? String(data.upc) : undefined,
    mpn: data.mpn ? String(data.mpn) : undefined,
    thumbnailUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : undefined,
    sourceProductUrl: data.sourceProductUrl ? String(data.sourceProductUrl) : undefined,
    canImport: false,
  };
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
      const normalized = normalizeProductName(query.text);
      const words = normalized.split(' ').filter((w) => w.length > 1);
      if (words.length === 0) return [];
      const snap = await ref
        .where('searchTerms', 'array-contains', words[0])
        .limit(limit)
        .get();
      return snap.docs.map((d) => docToExternal(d.id, d.data()));
    }

    return [];
  }

  async getProduct(externalId: string): Promise<ExternalProduct | null> {
    const doc = await db.collection('products').doc(externalId).get();
    if (!doc.exists) return null;
    return docToExternal(doc.id, doc.data()!);
  }
}
