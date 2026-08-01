import * as functions from 'firebase-functions';
import { getEnvConfig } from '../config/env';
import { createLiveInput, listLiveInputs } from '../cloudflare/cloudflareClient';
export const cloudflareConfigStatus = functions.https.onCall(async (data, context) => {
    const env = getEnvConfig();
    return {
        accountIdConfigured: !!env.CLOUDFLARE_ACCOUNT_ID,
        apiTokenConfigured: !!env.CLOUDFLARE_API_TOKEN,
        webhookSecretConfigured: !!env.CLOUDFLARE_WEBHOOK_SECRET,
        customerCodeConfigured: !!env.CLOUDFLARE_CUSTOMER_CODE,
        customerCode: env.CLOUDFLARE_CUSTOMER_CODE || null,
        message: env.CLOUDFLARE_API_TOKEN ? null : '⚠️ Cloudflare API token not configured',
    };
});
export const cloudflareListInputs = functions.https.onCall(async (data, context) => {
    try {
        const inputs = await listLiveInputs();
        if (!inputs || inputs.length === 0) {
            return { inputs: [], message: 'No live inputs found' };
        }
        return {
            inputs: inputs.map((input) => ({
                name: input.name || 'Untitled',
                uid: input.uid,
                connected: input.connected || false,
                ingestUrl: input.rtmps?.uri || null,
                streamKey: input.rtmps?.streamKey || null,
                playbackUrl: input.playback?.url || null,
                hlsManifestUrl: input.playback?.hls || null,
            })),
        };
    }
    catch (error) {
        functions.logger.error('Error listing live inputs:', error);
        throw new functions.https.HttpsError('internal', `Failed to list live inputs: ${error.message}`);
    }
});
export const cloudflareCreateTestInput = functions.https.onCall(async (data, context) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const testName = `vuvio-test-${timestamp}`;
        const input = await createLiveInput({
            name: testName,
            description: 'Vuvio diagnostic test live input',
        });
        if (!input) {
            throw new Error('Failed to create live input: Cloudflare API returned null');
        }
        return {
            input: {
                name: input.name,
                uid: input.uid,
                ingestUrl: input.rtmps?.uri || input.ingestUrl,
                streamKey: input.rtmps?.streamKey || input.streamKey,
                playbackUrl: input.playback?.url || input.playbackUrl,
                hlsManifestUrl: input.playback?.hls || input.hlsManifestUrl,
            },
            message: 'Live input created successfully. Copy RTMPS URL and Stream Key from Cloudflare Dashboard.',
        };
    }
    catch (error) {
        functions.logger.error('Error creating test input:', error);
        throw new functions.https.HttpsError('internal', `Failed to create live input: ${error.message}`);
    }
});
