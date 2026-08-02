import { getCloudflareEnv } from '../config/env.js';
export async function highlightConfig(req, res) {
    const env = getCloudflareEnv();
    const available = Boolean(env.accountId && env.apiToken);
    res.json({
        available,
        version: '1.0',
    });
}
