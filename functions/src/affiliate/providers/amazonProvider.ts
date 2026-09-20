import * as crypto from 'crypto';
import { logger } from 'firebase-functions';
import { AffiliateProvider, AffiliateQuery, AffiliateOffer } from '../affiliateTypes.js';

interface AmazonConfig {
  accessKey: string;
  secretKey: string;
  associateTag: string;
  marketplace: string; // e.g. 'www.amazon.fr'
  region: string;      // e.g. 'eu-west-1'
  country: string;     // e.g. 'FR'
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function buildAuthHeader(
  method: string,
  path: string,
  host: string,
  region: string,
  accessKey: string,
  secretKey: string,
  amzDate: string,
  dateStamp: string,
  target: string,
  body: string,
): string {
  const service = 'ProductAdvertisingAPI';

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = sha256Hex(body);

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export class AmazonAffiliateProvider implements AffiliateProvider {
  readonly id: string;

  constructor(private config: AmazonConfig) {
    this.id = `amazon:${config.country}`;
  }

  canHandle(query: AffiliateQuery): boolean {
    if (!this.config.accessKey || !this.config.secretKey) return false;
    return !!(query.brand || query.name || query.mpn || query.gtin);
  }

  async resolve(query: AffiliateQuery): Promise<AffiliateOffer[]> {
    try {
      const keywords = [query.brand, query.name].filter(Boolean).join(' ').trim();
      if (!keywords) return [];

      const host = `webservices.${this.config.marketplace.replace('www.', '')}`;
      const path = '/paapi5/searchitems';
      const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
      const dateStamp = amzDate.slice(0, 8);

      const body = JSON.stringify({
        Keywords: keywords,
        Resources: ['ItemInfo.Title', 'Offers.Listings.Price', 'Images.Primary.Medium'],
        PartnerTag: this.config.associateTag,
        PartnerType: 'Associates',
        SearchIndex: 'All',
        Marketplace: this.config.marketplace,
        ItemCount: 3,
      });

      const authHeader = buildAuthHeader(
        'POST', path, host, this.config.region,
        this.config.accessKey, this.config.secretKey,
        amzDate, dateStamp, target, body,
      );

      const response = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers: {
          'content-encoding': 'amz-1.0',
          'content-type': 'application/json; charset=utf-8',
          'host': host,
          'x-amz-date': amzDate,
          'x-amz-target': target,
          'Authorization': authHeader,
        },
        body,
      });

      if (!response.ok) {
        logger.warn(`[AmazonProvider] API error ${response.status}:`, await response.text());
        return [];
      }

      const data = await response.json() as {
        SearchResult?: {
          Items?: Array<{ DetailPageURL?: string; ASIN?: string }>;
        };
      };

      const items = data.SearchResult?.Items ?? [];
      return items.slice(0, 1).map((item) => ({
        merchant: `Amazon ${this.config.country}`,
        affiliateUrl: item.DetailPageURL ?? '',
        country: this.config.country,
      })).filter((o) => o.affiliateUrl);
    } catch (err) {
      logger.warn('[AmazonProvider] resolve failed:', err);
      return [];
    }
  }
}
