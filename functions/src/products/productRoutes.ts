import { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/firestore.js';
import { ApiError, sendError } from '../shared/errors.js';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { icecatUsername, icecatLanguage, icecatMarket } from '../config/env.js';
import { createProductRegistry } from './productRegistry.js';
import { checkProductExists, mergeProductData } from './deduplicateProduct.js';
import { normalizeProductName, ExternalProduct } from './productProvider.js';

function getIcecatPassword(): string {
  return process.env.ICECAT_PASSWORD || process.env.ICECAT_API_KEY || '';
}

function buildSearchTerms(product: ExternalProduct): string[] {
  const parts: string[] = [
    normalizeProductName(product.brand),
    ...normalizeProductName(product.name).split(' ').filter((w) => w.length > 1),
  ];
  if (product.mpn) {
    parts.push(normalizeProductName(product.mpn));
  }
  return [...new Set(parts)].filter((t) => t.length > 0);
}

function buildRegistryConfig() {
  const username = icecatUsername.value();
  const password = getIcecatPassword();
  return {
    icecat:
      username && password
        ? { username, password, language: icecatLanguage, market: icecatMarket }
        : undefined,
  };
}

export async function searchProductsHandler(req: Request, res: Response): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const gtin = typeof req.query.gtin === 'string' ? req.query.gtin : undefined;
    const ean = typeof req.query.ean === 'string' ? req.query.ean : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50);

    if (!q && !brand && !gtin && !ean) {
      throw new ApiError('bad_request', 'Provide at least one of: q, brand, gtin, ean');
    }

    const query = {
      text: q,
      brand,
      gtin,
      ean,
      category,
      limit,
    };

    const registry = createProductRegistry(buildRegistryConfig());
    const results = await registry.search(query);

    res.json({ success: true, count: results.length, results });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getProductHandler(
  req: Request,
  res: Response,
  productId: string
): Promise<void> {
  try {
    const providerId = typeof req.query.provider === 'string' ? req.query.provider : 'local';
    const registry = createProductRegistry(buildRegistryConfig());
    const product = await registry.getProduct(providerId, productId);

    if (!product) {
      throw new ApiError('not_found', `Product not found: ${productId}`);
    }

    res.json({ success: true, product });
  } catch (error) {
    sendError(res, error);
  }
}

export async function importProductHandler(req: Request, res: Response): Promise<void> {
  try {
    await authenticateUser(req as never);

    const { providerId, externalId, category } = req.body as {
      providerId?: string;
      externalId?: string;
      category?: string;
    };

    if (!providerId || typeof providerId !== 'string') {
      throw new ApiError('bad_request', 'Missing or invalid providerId');
    }
    if (!externalId || typeof externalId !== 'string') {
      throw new ApiError('bad_request', 'Missing or invalid externalId');
    }
    if (!category || typeof category !== 'string') {
      throw new ApiError('bad_request', 'Missing or invalid category');
    }

    const registry = createProductRegistry(buildRegistryConfig());
    const product = await registry.getProduct(providerId, externalId);

    if (!product) {
      throw new ApiError('not_found', `Product not found: ${providerId}/${externalId}`);
    }

    const firestoreDoc: Record<string, unknown> = {
      brand: product.brand,
      name: product.name,
      normalizedName: product.normalizedName,
      normalizedBrand: normalizeProductName(product.brand),
      category,
      description: product.description,
      thumbnailUrl: product.thumbnailUrl,
      gtin: product.gtin,
      ean: product.ean,
      mpn: product.mpn,
      provider: product.provider,
      externalProductId: product.externalId,
      sourceProductUrl: product.sourceProductUrl,
      imageSource: product.imageUrls?.[0]?.sourceProvider,
      imageRightsStatus: product.imageUrls?.[0]?.rightsStatus,
      searchTerms: buildSearchTerms(product),
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const dupCheck = await checkProductExists(firestoreDoc);

    let productId: string;
    let isNew: boolean;

    if (dupCheck.exists && dupCheck.productId) {
      logger.info(`[Import] Product already exists (${dupCheck.conflictField}): ${dupCheck.productId}`);
      await mergeProductData(dupCheck.productId, firestoreDoc);
      productId = dupCheck.productId;
      isNew = false;
    } else {
      const docRef = await db.collection('products').add(firestoreDoc);
      productId = docRef.id;
      isNew = true;
      logger.info(`[Import] Product created: ${productId} from ${providerId}`);
    }

    res.json({
      success: true,
      productId,
      isNew,
      provider: product.provider,
      imageSource: product.imageUrls?.[0]?.sourceProvider,
    });
  } catch (error) {
    sendError(res, error);
  }
}
