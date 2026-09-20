import { defineSecret } from 'firebase-functions/params';
export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');
export const cloudflareWebhookSecret = defineSecret('CLOUDFLARE_WEBHOOK_SECRET');
export const cloudflareCustomerCode = defineSecret('CLOUDFLARE_CUSTOMER_CODE');
export const openaiApiKey = defineSecret('OPENAI_API_KEY');
export const meteredApiKey = defineSecret('METERED_API_KEY');
export const meteredAppName = defineSecret('METERED_APP_NAME');
// Icecat API Configuration
export const icecatUsername = defineSecret('ICECAT_USERNAME');
// ICECAT_PASSWORD is the account password used for Basic Auth.
// Falls back to ICECAT_API_KEY for backward compatibility.
export const icecatPassword = defineSecret('ICECAT_PASSWORD');
export const amazonPaAccessKey = defineSecret('AMAZON_PA_ACCESS_KEY');
export const amazonPaSecretKey = defineSecret('AMAZON_PA_SECRET_KEY');
export const amazonAssociateTagFr = defineSecret('AMAZON_ASSOCIATE_TAG_FR');
export const awinApiKey = defineSecret('AMAZON_AWIN_API_KEY');
export const awinPublisherId = defineSecret('AWIN_PUBLISHER_ID');
export const icecatLanguage = process.env.ICECAT_LANGUAGE || 'en';
export const icecatMarket = process.env.ICECAT_MARKET || 'GB';
export const STREAM_TIMEOUTS = {
    reconnectAfterSeconds: 30,
    endAfterSeconds: 180,
    minHeartbeatWriteIntervalSeconds: 10,
};
function sv(secret, envKey) {
    try {
        return secret.value() || process.env[envKey] || '';
    }
    catch {
        return process.env[envKey] || '';
    }
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
        apiKey: sv(meteredApiKey, 'METERED_API_KEY'),
        appName: sv(meteredAppName, 'METERED_APP_NAME'),
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
        amazonAccessKey: sv(amazonPaAccessKey, 'AMAZON_PA_ACCESS_KEY'),
        amazonSecretKey: sv(amazonPaSecretKey, 'AMAZON_PA_SECRET_KEY'),
        amazonAssociateTagFr: sv(amazonAssociateTagFr, 'AMAZON_ASSOCIATE_TAG_FR'),
        awinApiKey: sv(awinApiKey, 'AMAZON_AWIN_API_KEY'),
        awinPublisherId: sv(awinPublisherId, 'AWIN_PUBLISHER_ID'),
    };
}
