import { defineSecret } from 'firebase-functions/params';

export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');
export const cloudflareWebhookSecret = defineSecret('CLOUDFLARE_WEBHOOK_SECRET');
export const cloudflareCustomerCode = defineSecret('CLOUDFLARE_CUSTOMER_CODE');
export const openaiApiKey = defineSecret('OPENAI_API_KEY');
export const googleSheetsCredentials = defineSecret('GOOGLE_SHEETS_CREDENTIALS');

// Metered / Amazon-PA / Awin : secrets non provisionnés en prod.
// Les getters correspondants lisent uniquement process.env et renvoient '' si absent.
// Les handlers (turnCredentialsHandler, affiliateRoutes) tolèrent les valeurs vides (fallback "not configured" / undefined provider).

// Icecat API Configuration
export const icecatUsername = defineSecret('ICECAT_USERNAME');
// ICECAT_PASSWORD is the account password used for Basic Auth.
// Falls back to ICECAT_API_KEY for backward compatibility.
export const icecatPassword = defineSecret('ICECAT_PASSWORD');
export const ebayClientId = defineSecret('EBAY_CLIENT_ID');
export const ebayClientSecret = defineSecret('EBAY_CLIENT_SECRET');
export const icecatLanguage = process.env.ICECAT_LANGUAGE || 'en';
export const icecatMarket = process.env.ICECAT_MARKET || 'GB';
export const ebayMarketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_FR';
export const ebayAcceptLanguage = process.env.EBAY_ACCEPT_LANGUAGE || 'fr-FR';

export const STREAM_TIMEOUTS = {
  reconnectAfterSeconds: 30,
  endAfterSeconds: 180,
  minHeartbeatWriteIntervalSeconds: 10,
} as const;

function sv(secret: { value(): string }, envKey: string): string {
  try { return secret.value() || process.env[envKey] || ''; }
  catch { return process.env[envKey] || ''; }
}

export function getCloudflareEnv() {
  return {
    accountId: sv(cloudflareAccountId, 'CLOUDFLARE_ACCOUNT_ID'),
    apiToken: sv(cloudflareApiToken, 'CLOUDFLARE_API_TOKEN'),
    webhookSecret: sv(cloudflareWebhookSecret, 'CLOUDFLARE_WEBHOOK_SECRET'),
    customerCode: sv(cloudflareCustomerCode, 'CLOUDFLARE_CUSTOMER_CODE'),
  };
}

export function getMeteredEnv() {
  return {
    apiKey: process.env.METERED_API_KEY || '',
    appName: process.env.METERED_APP_NAME || '',
  };
}

export function getOpenAIEnv() {
  return {
    apiKey: openaiApiKey.value() || process.env.OPENAI_API_KEY || '',
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
  };
}

export function getAffiliateEnv() {
  return {
    amazonAccessKey: process.env.AMAZON_PA_ACCESS_KEY || '',
    amazonSecretKey: process.env.AMAZON_PA_SECRET_KEY || '',
    amazonAssociateTagFr: process.env.AMAZON_ASSOCIATE_TAG_FR || '',
    awinApiKey: process.env.AMAZON_AWIN_API_KEY || '',
    awinPublisherId: process.env.AWIN_PUBLISHER_ID || '',
  };
}

export function getEbayEnv() {
  return {
    clientId: sv(ebayClientId, 'EBAY_CLIENT_ID'),
    clientSecret: sv(ebayClientSecret, 'EBAY_CLIENT_SECRET'),
    marketplaceId: ebayMarketplaceId,
    acceptLanguage: ebayAcceptLanguage,
  };
}
