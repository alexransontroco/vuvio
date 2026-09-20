# Firebase Deployment Fix — TypeScript Compilation

Historical fix log for the first successful Cloud Functions deployment.

---

## Fixes Applied

### 1. Firebase Storage not initialized
Activate Storage in the Firebase console before deploying functions that use it.  
Link: https://console.firebase.google.com/project/vuvio-bf328/storage

### 2. `Response` type import
`Response` is not exported from `firebase-functions/v2/https`. Import from `express` instead:

```typescript
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
```

Affected files: `analyticsTrackStreamEvent.ts`, all `streams/*.ts`, `gear/attachGearToStream.ts`, `cloudflare/cloudflareWebhook.ts`, `products/processProductImage.ts`.

### 3. Cloudflare API response typing

```typescript
interface CloudflareApiResponse {
  success?: boolean;
  result?: Record<string, unknown>;
  errors?: Array<{ code: number; message: string }>;
}
const body = await response.json().catch(() => ({})) as CloudflareApiResponse;
```

### 4. NodeNext module resolution — `.js` extensions required
With `moduleResolution: "NodeNext"`, relative imports need explicit `.js` extensions:

```typescript
import { getEnvConfig } from '../config/env.js';
```

### 5. `tsconfig.json` — wrong `rootDir`
`rootDir: "."` caused output at `lib/src/index.js` instead of `lib/index.js`.

```json
{
  "rootDir": "src",
  "include": ["src/**/*.ts"]
}
```

### 6. Missing `@types/node-fetch`

```bash
npm install --save-dev @types/node-fetch
```

### 7. Cloudflare test routes — API updates
`getEnvConfig()` → `getCloudflareEnv()`, `listLiveInputs()` → `client.listLiveInputs()`, use `.ingestUrl` property.

---

## Pending (still required)

Enable Secret Manager API in GCP before first deploy:  
https://console.developers.google.com/apis/api/secretmanager.googleapis.com/overview?project=vuvio-bf328

---

## Warnings (non-blocking)

- Node.js 20 runtime deprecation: 2026-10-31 — plan upgrade
- `firebase-functions@6.0.1` is outdated — upgrade carefully (potential breaking changes)
