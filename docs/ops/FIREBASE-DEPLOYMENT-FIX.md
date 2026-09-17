# Firebase Deployment Fix - TypeScript Compilation Resolution

## Problème Initial
Lors du tentative de déployer avec `firebase deploy`, plusieurs erreurs TypeScript se sont produites empêchant la compilation des Cloud Functions. Le projet n'avait jamais été déployé auparavant avec succès.

## Étapes de Résolution

### 1. **Initialisation Firebase Storage**
- **Problème**: Firebase Storage n'était pas configuré sur le projet
- **Solution**: Accès à la console Firebase et activation de Storage via le bouton "Get Started"
- **Lien**: https://console.firebase.google.com/project/vuvio-bf328/storage

### 2. **Erreurs de Types TypeScript - Response**
- **Problème**: `Response` n'était pas exporté depuis `firebase-functions/v2/https`
- **Fichiers affectés**:
  - `src/analytics/trackStreamEvent.ts`
  - `src/streams/*.ts` (createStream, startStream, endStream, heartbeatStream, listLiveStreams, getStream)
  - `src/gear/attachGearToStream.ts`
  - `src/cloudflare/cloudflareWebhook.ts`
  - `src/cloudflare/testRouteHandlers.ts`
  - `src/products/processProductImage.ts`

- **Solution**: Importer `Response` depuis `express` au lieu de `firebase-functions`:
```typescript
// ❌ Avant
import type { Request, Response } from 'firebase-functions/v2/https';

// ✅ Après
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
```

### 3. **Erreurs de Typing - Cloudflare API Response**
- **Problème**: La réponse JSON de l'API Cloudflare était typée comme `unknown`, causant des erreurs d'accès aux propriétés `.success` et `.result`
- **Fichier**: `src/cloudflare/cloudflareClient.ts`

- **Solution**: Ajouter une interface pour typer correctement la réponse:
```typescript
interface CloudflareApiResponse {
  success?: boolean;
  result?: Record<string, unknown>;
  errors?: Array<{ code: number; message: string }>;
}

// Utilisation
const body = await response.json().catch(() => ({})) as CloudflareApiResponse;
if (!response.ok || body?.success === false) {
  // Traitement d'erreur
}
```

### 4. **Erreurs d'Imports - Node16 Module Resolution**
- **Problème**: `moduleResolution: "NodeNext"` require des extensions `.js` pour les imports relatifs
- **Fichier affecté**: `src/routes/cloudflareTestRoutes.ts`

- **Solution**: Ajouter les extensions `.js` aux imports relatifs:
```typescript
// ❌ Avant
import { getEnvConfig } from '../config/env';

// ✅ Après  
import { getEnvConfig } from '../config/env.js';
```

### 5. **Erreur de Configuration TypeScript - rootDir**
- **Problème**: `tsconfig.json` avait `"rootDir": "."` qui compilait `src/index.ts` vers `lib/src/index.js` au lieu de `lib/index.js`
- **Impact**: Firebase Function couldn't find `functions/lib/index.js`

- **Solution**: Changer rootDir et include pattern:
```json
// ❌ Avant
{
  "rootDir": ".",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}

// ✅ Après
{
  "rootDir": "src",
  "include": ["src/**/*.ts"]
}
```

**Raison**: 
- `rootDir: "src"` garantit que les fichiers dans `src/` compilent directement vers `lib/` sans préserver la structure de dossier
- Exclure `test/**/*.ts` du build principal car les fichiers de test doivent être compilés séparément

### 6. **Dépendances Manquantes - node-fetch**
- **Problème**: Type declaration manquante pour le module `node-fetch`
- **Solution**: Installation du package types:
```bash
npm install --save-dev @types/node-fetch
```

### 7. **Mise à Jour - Cloudflare Test Routes**
- **Problème**: Le fichier `src/routes/cloudflareTestRoutes.ts` utilisait l'ancienne API et les mauvaises signatures de fonction
- **Changements**:
  - Remplacer `getEnvConfig()` par `getCloudflareEnv()`
  - Remplacer `listLiveInputs()` par `client.listLiveInputs()`
  - Remplacer `createLiveInput()` par `client.createLiveInput()`
  - Utiliser les propriétés correctes de `CloudflareLiveInput` (pas `.rtmps?.uri`, mais `.ingestUrl`)

## Résultats

### ✅ Réussis
- Les Cloud Functions compilent maintenant sans erreurs TypeScript
- `lib/index.js` existe au bon endroit
- Firebase configuration est prête pour le déploiement

### ⏳ En Attente
- **API Secret Manager**: Doit être activée manuellement dans la console GCP
  - Lien: https://console.developers.google.com/apis/api/secretmanager.googleapis.com/overview?project=vuvio-bf328
  - Action: Cliquer sur "Enable"
  - Attendre 1-2 minutes que l'activation se propage

### ⚠️ Avertissements à Adresser Ultérieurement
1. **Runtime Node.js 20**: Sera décommissionné le 2026-10-31
   - Recommandation: Mettre à jour vers une version plus récente
   
2. **firebase-functions version outdated**: La version 6.0.1 est considérée comme ancienne
   - Recommandation: `npm install --save firebase-functions@latest`
   - ⚠️ Cela peut causer des breaking changes

## Prochaines Étapes

1. **Activation de Secret Manager API**:
   ```
   1. Aller sur: https://console.developers.google.com/apis/api/secretmanager.googleapis.com/overview?project=vuvio-bf328
   2. Cliquer sur "Enable"
   3. Attendre 1-2 minutes
   ```

2. **Relancer le déploiement**:
   ```bash
   firebase deploy
   ```

3. **Vérifier le déploiement** via la console Firebase

## Structure des Fichiers Affectés

```
functions/
├── src/
│   ├── analytics/
│   ├── cloudflare/
│   │   ├── cloudflareClient.ts (typing fixes)
│   │   ├── cloudflareWebhook.ts (import fixes)
│   │   └── testRouteHandlers.ts (import fixes)
│   ├── config/
│   │   └── env.ts (utilisé par les routes)
│   ├── gear/
│   │   └── attachGearToStream.ts (import fixes)
│   ├── products/
│   │   └── processProductImage.ts (import + Buffer fix)
│   ├── routes/
│   │   └── cloudflareTestRoutes.ts (API updates)
│   ├── streams/
│   │   ├── createStream.ts (import fixes)
│   │   ├── startStream.ts (import fixes)
│   │   ├── endStream.ts (import fixes)
│   │   ├── heartbeatStream.ts (import fixes)
│   │   ├── listLiveStreams.ts (import fixes)
│   │   └── getStream.ts (import fixes)
│   └── index.ts
├── package.json (node-fetch types added)
└── tsconfig.json (rootDir and include fixes)
```

## Commit Git

```
Fix Cloud Functions TypeScript compilation and Firebase deployment

52 files changed, 119 insertions(+), 65 deletions(-)
```

## Tests Effectués

- ✅ `npm run build` compile sans erreurs
- ✅ Tous les fichiers `.ts` compilent correctement vers `lib/`
- ✅ `lib/index.js` existe et est accessible
- ✅ Structure d'imports est correcte

## Références

- [Firebase Functions Runtime Support](https://cloud.google.com/functions/docs/runtime-support)
- [TypeScript Module Resolution](https://www.typescriptlang.org/tsconfig#moduleResolution)
- [Firebase Secret Manager](https://firebase.google.com/docs/functions/config-env)
