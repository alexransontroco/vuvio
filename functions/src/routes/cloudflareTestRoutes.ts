import * as functions from 'firebase-functions';
import { getCloudflareEnv } from '../config/env.js';
import { createCloudflareClient } from '../cloudflare/cloudflareClient.js';

export const cloudflareConfigStatus = functions.https.onCall(async (data, context) => {
  const env = getCloudflareEnv();

  return {
    accountIdConfigured: !!env.accountId,
    apiTokenConfigured: !!env.apiToken,
    webhookSecretConfigured: !!env.webhookSecret,
    customerCodeConfigured: !!env.customerCode,
    customerCode: env.customerCode || null,
    message: env.apiToken ? null : '⚠️ Cloudflare API token not configured',
  };
});

export const cloudflareListInputs = functions.https.onCall(async (data, context) => {
  try {
    const client = createCloudflareClient();
    const inputs = await client.listLiveInputs();

    if (!inputs || inputs.length === 0) {
      return { inputs: [], message: 'No live inputs found' };
    }

    return {
      inputs: inputs.map((input) => ({
        name: input.name || 'Untitled',
        uid: input.uid,
        connected: input.connected || false,
        ingestUrl: input.ingestUrl,
        streamKey: input.streamKey,
        playbackUrl: input.playbackUrl,
        hlsManifestUrl: input.hlsManifestUrl,
      })),
    };
  } catch (error: any) {
    functions.logger.error('Error listing live inputs:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to list live inputs: ${error.message}`
    );
  }
});

export const cloudflareCreateTestInput = functions.https.onCall(async (data, context) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const testName = `vuvio-test-${timestamp}`;
    const testStreamId = `test-stream-${timestamp}`;

    const client = createCloudflareClient();
    const input = await client.createLiveInput({
      streamId: testStreamId,
      title: testName,
    });

    if (!input) {
      throw new Error('Failed to create live input: Cloudflare API returned null');
    }

    return {
      input: {
        name: input.name,
        uid: input.uid,
        ingestUrl: input.ingestUrl,
        streamKey: input.streamKey,
        playbackUrl: input.playbackUrl,
        hlsManifestUrl: input.hlsManifestUrl,
      },
      message: 'Live input created successfully. Copy RTMPS URL and Stream Key from Cloudflare Dashboard.',
    };
  } catch (error: any) {
    functions.logger.error('Error creating test input:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to create live input: ${error.message}`
    );
  }
});
