import { Request, Response } from 'express';
import { sendError, ApiError } from '../shared/errors.js';
import { AffiliateResolver } from './affiliateResolver.js';
import { getAffiliateEnv } from '../config/env.js';

function buildResolver() {
  const env = getAffiliateEnv();
  return new AffiliateResolver({
    amazon: env.amazonAccessKey && env.amazonSecretKey
      ? { accessKey: env.amazonAccessKey, secretKey: env.amazonSecretKey, associateTagFr: env.amazonAssociateTagFr }
      : undefined,
    awin: env.awinApiKey && env.awinPublisherId
      ? { apiKey: env.awinApiKey, publisherId: env.awinPublisherId }
      : undefined,
  });
}

export async function resolveAffiliateHandler(req: Request, res: Response): Promise<void> {
  try {
    const { brand, name, mpn, gtin, productId, category, country } = req.body as {
      brand?: string;
      name?: string;
      mpn?: string;
      gtin?: string;
      productId?: string;
      category?: string;
      country?: string;
    };

    if (!brand && !name && !mpn && !gtin) {
      throw new ApiError('bad_request', 'Provide at least one of: brand, name, mpn, gtin');
    }

    const resolver = buildResolver();
    const offers = await resolver.resolve({ brand, name, mpn, gtin, productId, category, country });

    res.json({ success: true, count: offers.length, offers });
  } catch (error) {
    sendError(res, error);
  }
}
