import { defineSecret } from 'firebase-functions/params';

export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');
export const cloudflareWebhookSecret = defineSecret('CLOUDFLARE_WEBHOOK_SECRET');
export const cloudflareCustomerCode = defineSecret('CLOUDFLARE_CUSTOMER_CODE');
export const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Icecat API Configuration
export const icecatUsername = { value: () => process.env.ICECAT_USERNAME || '' };
// ICECAT_PASSWORD is the account password used for Basic Auth.
// Falls back to ICECAT_API_KEY for backward compatibility.
export const icecatPassword = { value: () => process.env.ICECAT_PASSWORD || process.env.ICECAT_API_KEY || '' };
export const icecatLanguage = process.env.ICECAT_LANGUAGE || 'en';
export const icecatMarket = process.env.ICECAT_MARKET || 'GB';

export const STREAM_TIMEOUTS = {
  reconnectAfterSeconds: 30,
  endAfterSeconds: 180,
  minHeartbeatWriteIntervalSeconds: 10,
} as const;

export function getCloudflareEnv() {
  return {
    accountId: cloudflareAccountId.value() || process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: cloudflareApiToken.value() || process.env.CLOUDFLARE_API_TOKEN || '',
    webhookSecret: cloudflareWebhookSecret.value() || process.env.CLOUDFLARE_WEBHOOK_SECRET || '',
    customerCode: cloudflareCustomerCode.value() || process.env.CLOUDFLARE_CUSTOMER_CODE || '',
  };
}

export function getOpenAIEnv() {
  return {
    apiKey: openaiApiKey.value() || process.env.OPENAI_API_KEY || '',
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
  };
}
