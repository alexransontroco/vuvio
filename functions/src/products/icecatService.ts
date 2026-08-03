/**
 * Icecat Product Data Service
 *
 * Provides access to Icecat's product database for authorized accounts.
 * Handles product search, data mapping, and image management.
 *
 * Documentation: https://icecat.biz/en/publish/xml-p-datasheet
 *
 * NOTE: Requires valid Icecat credentials (ICECAT_USERNAME, ICECAT_API_KEY)
 * These must be set as Firebase Function secrets.
 */

import fetch from 'node-fetch';
import { logger } from 'firebase-functions';

interface IcecatConfig {
  username: string;
  apiKey: string;
  language: string;
  market: string;
}

interface IcecatSearchResult {
  product_id: string;
  brand_name: string;
  product_name: string;
  category?: string;
  image_url?: string;
  spec_sheet_url?: string;
}

interface IcecatProductData {
  product_id: string;
  brand: string;
  name: string;
  category?: string;
  description?: string;
  specs?: Record<string, string>;
  images?: {
    thumbnail?: string;
    full?: string;
  };
  identifiers?: {
    gtin?: string;
    ean?: string;
    mpn?: string;
  };
  url?: string;
}

const ICECAT_API_BASE = 'https://icecat.biz/api/product';
const ICECAT_FREE_API_BASE = 'https://icecat.biz/xml_t.asp';

/**
 * Search for products in Icecat
 * Uses the free XML API with limited results
 *
 * @param query - Product name, brand, or model number
 * @param config - Icecat API configuration
 * @returns Array of search results
 */
export async function searchIcecatProducts(
  query: string,
  config: IcecatConfig
): Promise<IcecatSearchResult[]> {
  try {
    if (!query || query.length < 2) {
      logger.info('[Icecat] Search query too short');
      return [];
    }

    logger.info(`[Icecat] Searching for: ${query}`);

    // Use free API endpoint for search
    // This is a simple search that returns limited results
    const searchUrl = new URL(ICECAT_FREE_API_BASE);
    searchUrl.searchParams.append('action', 'make_request');
    searchUrl.searchParams.append('type', 'CatalogSearch.xml');
    searchUrl.searchParams.append('username', config.username);
    searchUrl.searchParams.append('usertoken', config.apiKey);
    searchUrl.searchParams.append('lang_id', getLangId(config.language));
    searchUrl.searchParams.append('market_id', getMarketId(config.market));
    searchUrl.searchParams.append('search', query);

    const response = await fetchWithTimeout(searchUrl.toString(), {
      method: 'GET',
      timeout: 10000,
    });

    if (!response.ok) {
      logger.error(`[Icecat] API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const xmlText = await response.text();

    // Parse simple XML response
    // In production, use a proper XML parser like xml2js
    const results = parseIcecatSearchXml(xmlText);

    logger.info(`[Icecat] Found ${results.length} products`);
    return results;
  } catch (error) {
    logger.error('[Icecat] Search error:', error);
    return [];
  }
}

/**
 * Get detailed product information from Icecat
 *
 * @param productId - Icecat product ID
 * @param config - Icecat API configuration
 * @returns Detailed product data
 */
export async function getIcecatProduct(
  productId: string,
  config: IcecatConfig
): Promise<IcecatProductData | null> {
  try {
    logger.info(`[Icecat] Fetching product: ${productId}`);

    const url = new URL(ICECAT_API_BASE);
    url.searchParams.append('username', config.username);
    url.searchParams.append('usertoken', config.apiKey);
    url.searchParams.append('lang_id', getLangId(config.language));
    url.searchParams.append('market_id', getMarketId(config.market));
    url.searchParams.append('product_id', productId);

    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      timeout: 10000,
    });

    if (!response.ok) {
      logger.warn(`[Icecat] Product not found: ${productId}`);
      return null;
    }

    const xmlText = await response.text();
    const productData = parseIcecatProductXml(xmlText);

    return productData;
  } catch (error) {
    logger.error(`[Icecat] Product fetch error for ${productId}:`, error);
    return null;
  }
}

/**
 * Normalize Icecat product data to Vuvio format
 */
export function mapIcecatToVuvioProduct(
  icecatData: IcecatProductData,
  category: string
): Record<string, unknown> {
  const searchTerms = [
    icecatData.brand.toLowerCase(),
    icecatData.name.toLowerCase(),
  ];

  if (icecatData.identifiers?.mpn) {
    searchTerms.push(icecatData.identifiers.mpn.toLowerCase());
  }

  // Extract model number from name if present
  const nameWords = icecatData.name.split(/[\s\-]+/);
  searchTerms.push(...nameWords.map((w) => w.toLowerCase()).filter((w) => w.length > 2));

  return {
    brand: icecatData.brand,
    name: icecatData.name,
    category,
    description: icecatData.description,

    // Image URLs - prefer high-quality versions
    thumbnailUrl: icecatData.images?.thumbnail,
    originalImageUrl: icecatData.images?.full,

    // External identifiers for deduplication
    source: 'icecat' as const,
    sourceProductId: icecatData.product_id,
    sourceProductUrl: `https://icecat.biz/p/${icecatData.product_id}`,
    sourceImageUrl: icecatData.images?.full,

    gtin: icecatData.identifiers?.gtin,
    ean: icecatData.identifiers?.ean,
    mpn: icecatData.identifiers?.mpn,

    imageSource: 'official' as const,
    imageStatus: icecatData.images?.thumbnail ? 'ready' : 'pending',

    searchTerms: [...new Set(searchTerms)].filter((t) => t),

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Simple XML parser for Icecat search response
 * In production, use xml2js or similar library
 */
function parseIcecatSearchXml(xml: string): IcecatSearchResult[] {
  const results: IcecatSearchResult[] = [];

  // Simple regex-based parsing - replace with proper XML parser in production
  const productPattern = /<Product[^>]*>/g;
  const matches = xml.match(productPattern) || [];

  matches.forEach((productTag) => {
    const productId = extractAttribute(productTag, 'ID');
    const brandName = extractAttribute(productTag, 'Brand');
    const productName = extractAttribute(productTag, 'Title');

    if (productId && brandName && productName) {
      results.push({
        product_id: productId,
        brand_name: brandName,
        product_name: productName,
      });
    }
  });

  return results;
}

/**
 * Simple XML parser for detailed product response
 */
function parseIcecatProductXml(xml: string): IcecatProductData {
  return {
    product_id: extractAttribute(xml, 'ID'),
    brand: extractAttribute(xml, 'Brand'),
    name: extractAttribute(xml, 'Title'),
    images: {
      thumbnail: extractImageUrl(xml, 'thumbnail'),
      full: extractImageUrl(xml, 'high'),
    },
    identifiers: {
      gtin: extractSpecValue(xml, 'GTIN'),
      ean: extractSpecValue(xml, 'EAN'),
      mpn: extractSpecValue(xml, 'MPN'),
    },
  };
}

/**
 * Extract XML attribute value
 */
function extractAttribute(xml: string, attrName: string): string {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Extract image URL from Icecat XML
 */
function extractImageUrl(xml: string, type: string): string | undefined {
  // Look for picture elements
  const regex = new RegExp(`<Picture[^>]*type="${type}"[^>]*src="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Extract specification value from XML
 */
function extractSpecValue(xml: string, specName: string): string | undefined {
  const regex = new RegExp(`<${specName}>([^<]*)<`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Convert language code to Icecat language ID
 */
function getLangId(language: string): string {
  const langMap: Record<string, string> = {
    en: '1',
    de: '3',
    fr: '4',
    es: '8',
    it: '9',
    nl: '11',
    pt: '15',
    ru: '25',
    ja: '31',
    zh: '33',
  };
  return langMap[language.toLowerCase()] || '1'; // Default to English
}

/**
 * Convert market code to Icecat market ID
 */
function getMarketId(market: string): string {
  const marketMap: Record<string, string> = {
    GB: '1',
    US: '2',
    DE: '3',
    FR: '4',
    ES: '5',
    IT: '6',
    NL: '7',
    CH: '8',
    BE: '9',
    AU: '10',
    CA: '11',
    JP: '12',
  };
  return marketMap[market.toUpperCase()] || '1'; // Default to GB
}

/**
 * Fetch with timeout protection
 */
async function fetchWithTimeout(
  url: string,
  options: { method?: string; timeout?: number } = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout || 30000
  );

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      signal: controller.signal as never,
      headers: {
        'User-Agent': 'Vuvio/1.0',
      },
    } as never);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
