import { defineSecret } from 'firebase-functions/params';
export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');
export const cloudflareWebhookSecret = defineSecret('CLOUDFLARE_WEBHOOK_SECRET');
export const cloudflareCustomerCode = defineSecret('CLOUDFLARE_CUSTOMER_CODE');
export const STREAM_TIMEOUTS = {
    reconnectAfterSeconds: 30,
    endAfterSeconds: 180,
    minHeartbeatWriteIntervalSeconds: 10,
};
export function getCloudflareEnv() {
    return {
        accountId: cloudflareAccountId.value() || process.env.CLOUDFLARE_ACCOUNT_ID || '',
        apiToken: cloudflareApiToken.value() || process.env.CLOUDFLARE_API_TOKEN || '',
        webhookSecret: cloudflareWebhookSecret.value() || process.env.CLOUDFLARE_WEBHOOK_SECRET || '',
        customerCode: cloudflareCustomerCode.value() || process.env.CLOUDFLARE_CUSTOMER_CODE || '',
    };
}
