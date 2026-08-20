import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { getCloudflareEnv } from '../config/env.js';
import { createLiveInput, listLiveInputs, createCloudflareClient } from './cloudflareClient.js';

export async function getCloudflareConfig(req: Request, res: Response) {
  const env = getCloudflareEnv();

  res.json({
    accountIdConfigured: !!env.accountId,
    apiTokenConfigured: !!env.apiToken,
    webhookSecretConfigured: !!env.webhookSecret,
    customerCodeConfigured: !!env.customerCode,
    customerCode: env.customerCode || null,
    message: env.apiToken ? null : '⚠️ Cloudflare API token not configured',
  });
}

export async function getCloudflareInputs(req: Request, res: Response) {
  try {
    const rawInputs = await listLiveInputs();

    if (!rawInputs || rawInputs.length === 0) {
      res.json({ inputs: [], message: 'No live inputs found' });
      return;
    }

    const client = createCloudflareClient();
    const inputs: any[] = [];

    for (const input of rawInputs) {
      try {
        if (input.uid) {
          const fullInput = await client.getLiveInput(input.uid);
          inputs.push(fullInput);
        } else {
          inputs.push(input);
        }
      } catch (err) {
        inputs.push(input);
      }
    }

    res.json({
      inputs: inputs.map((input) => ({
        name: input.name || 'Untitled',
        uid: input.uid,
        connected: input.connected || false,
        ingestUrl: input.ingestUrl,
        streamKey: input.streamKey,
        playbackUrl: input.playbackUrl,
        hlsManifestUrl: input.hlsManifestUrl,
      })),
    });
  } catch (error: any) {
    console.error('Error listing live inputs:', error);
    res.status(500).json({ error: `Failed to list live inputs: ${error.message}` });
  }
}

export async function getRawVideos(req: Request, res: Response) {
  const liveInputId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!liveInputId) { res.status(400).json({ error: 'Missing ?id=' }); return; }
  const { accountId, apiToken } = getCloudflareEnv();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${liveInputId}/videos`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const body = await response.json();
  res.json(body);
}

export async function getRawLiveInput(req: Request, res: Response) {
  const liveInputId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!liveInputId) { res.status(400).json({ error: 'Missing ?id=' }); return; }
  const { accountId, apiToken } = getCloudflareEnv();
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${liveInputId}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const body = await response.json();
  res.json(body);
}

export async function postCreateTestInput(req: Request, res: Response) {
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

    res.json({
      input: {
        name: input.name,
        uid: input.uid,
        ingestUrl: input.ingestUrl,
        streamKey: input.streamKey,
        playbackUrl: input.playbackUrl,
        hlsManifestUrl: input.hlsManifestUrl,
      },
      message: 'Live input created successfully. Copy RTMPS URL and Stream Key from Cloudflare Dashboard.',
    });
  } catch (error: any) {
    console.error('Error creating test input:', error);
    res.status(500).json({ error: `Failed to create live input: ${error.message}` });
  }
}
