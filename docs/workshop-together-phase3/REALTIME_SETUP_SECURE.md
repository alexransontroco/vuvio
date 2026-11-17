# Cloudflare Realtime SFU — Setup Sécurisé (Phase 4 PoC)

**IMPORTANT:** Aucun secret Cloudflare ne doit être transmis par chat ou saisi directement. Voici comment récupérer et configurer les paramètres en toute sécurité.

---

## 1. Récupérer les Paramètres Cloudflare (IDS UNIQUEMENT, PAS SECRETS)

### Paramètre 1: Account ID

**Localisation:** https://dash.cloudflare.com/
1. Dans le menu gauche: **Workers & Pages**
2. Vue d'ensemble → Copier **Account ID** (format: 12 caractères hex)
3. **Communiquer UNIQUEMENT l'ID, jamais le secret**

### Paramètre 2: CF API Token (À CRÉER SÉCURISEMENT)

**Ne JAMAIS:**
- Partager en chat
- Mettre dans Git
- Envoyer par email

**À FAIRE:**
1. https://dash.cloudflare.com/profile/api-tokens
2. Créer token: "Create Token" → "Create Custom Token"
3. Permissions: `Account` → `Realtime` (Read + Write)
4. Restriction IP: (optionnel, pour Firebase only)
5. TTL: 90 jours max
6. **Copier immédiatement dans `.env.local` (voir étape 3)**
7. **NE PAS le copier ailleurs, NE PAS le montrer**

### Paramètre 3: CF App ID

**Localisation:** https://dash.cloudflare.com/
1. Workers & Pages → **Realtime**
2. Trouver ton app Realtime (ou en créer une)
3. Copier **App ID** (UUID format)
4. **Communiquer l'ID uniquement**

---

## 2. Configuration Locale Sécurisée (`.env.local`)

**Fichier:** `functions/.env.local` (NE PAS committer)

```bash
# Cloudflare Realtime credentials
CF_API_TOKEN=your_token_here_1234567890abcdef
CF_ACCOUNT_ID=1a2b3c4d5e6f7g8h
CF_APP_ID=550e8400-e29b-41d4-a716-446655440000

# Optional: Logging level
CF_LOG_LEVEL=debug
```

**Protéger le fichier:**
```bash
# Ajouter à .gitignore (vérifier qu'il y est)
echo "functions/.env.local" >> .gitignore

# Vérifier que git n'a pas suivi le fichier
git check-ignore functions/.env.local  # Doit retourner le chemin
```

---

## 3. Déploiement Sécurisé des Secrets (Firebase Secret Manager)

**Option A: Développement Local (`.env.local`)**
- Déjà en place ci-dessus
- Testé sur `npm run dev`
- Pas de secret en prod

**Option B: Production (Firebase Secret Manager) — À FAIRE UNIQUEMENT APRÈS VALIDATION**

```bash
# 1. Activer Secret Manager sur Firebase project
gcloud services enable secretmanager.googleapis.com

# 2. Créer secrets (toi-même, pas via chat)
gcloud secrets create CF_API_TOKEN --data-file=- <<< "your_token"
gcloud secrets create CF_ACCOUNT_ID --data-file=- <<< "your_account_id"
gcloud secrets create CF_APP_ID --data-file=- <<< "your_app_id"

# 3. Accorder accès à Firebase Cloud Functions
PROJECT_ID=$(gcloud config get-value project)
FUNCTION_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud secrets add-iam-policy-binding CF_API_TOKEN \
  --member=serviceAccount:${FUNCTION_EMAIL} \
  --role=roles/secretmanager.secretAccessor

# Répéter pour CF_ACCOUNT_ID et CF_APP_ID
```

**Modifier Firebase Function pour lire les secrets:**

```typescript
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const name = `projects/${process.env.GCP_PROJECT}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({name});
  return version.payload?.data?.toString() || '';
}

// Dans createRealtimeSession:
const CF_API_TOKEN = await getSecret('CF_API_TOKEN');
const CF_ACCOUNT_ID = await getSecret('CF_ACCOUNT_ID');
const CF_APP_ID = await getSecret('CF_APP_ID');
```

---

## 4. Vérifier la Configuration (Local)

```bash
# 1. Build Firebase Functions
cd functions
npm run build

# 2. Test local avec Emulator
firebase emulators:start --only functions

# 3. Dans un autre terminal, appeler la fonction:
curl -X POST http://localhost:5001/vuvio-bf328/us-central1/createRealtimeSession \
  -H "Content-Type: application/json" \
  -d '{
    "offer": {
      "type": "offer",
      "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n..."
    }
  }'
```

**Résultat attendu:**
```json
{
  "success": true,
  "sessionId": "abc-123-def",
  "answer": {
    "type": "answer",
    "sdp": "v=0\r\n..."
  }
}
```

---

## 5. Firestore Rules Sécurisées (CORRIGÉES)

**Fichier:** `firestore.rules`

```javascript
// RTC Sessions collection (private)
match /rtcSessions/{sessionId} {
  // User can only read their own session
  allow read: if request.auth != null && 
              resource.data.userId == request.auth.uid;
  
  // Only Firebase Function can create (via admin SDK)
  allow create: if false; // Functions use admin SDK, bypass rules
  
  // No direct updates from client
  allow update: if false;
  
  // No deletes from client
  allow delete: if false;
}

// RTC Rooms (optional: for participant coordination)
match /rtcRooms/{roomId} {
  // Any authenticated user can read (room is public within invited users)
  allow read: if request.auth != null;
  
  // Functions create
  allow create: if false;
  
  // No updates from client
  allow update: if false;
  allow delete: if false;
}
```

**Deploy:**
```bash
firebase deploy --only firestore:rules
```

---

## 6. Test HTTPS Local (Pour Vrais Téléphones)

**Option A: ngrok (Gratuit, facile)**

```bash
# 1. Installer ngrok
# Voir: https://ngrok.com/download

# 2. Exposer localhost:5173 en HTTPS public
ngrok http 5173
# Résultat: https://abc-123-ngrok.app

# 3. Sur téléphone/autre appareil:
# Ouvrir: https://abc-123-ngrok.app/admin/realtime-test
```

**Option B: localhost avec mDNS (Local network)**

```bash
# 1. Sur développement machine:
npm run dev  # http://localhost:5173

# 2. Sur téléphone (même réseau Wi-Fi):
# Trouver IP locale: ifconfig | grep inet
# Ex: 192.168.1.100

# 3. Accéder: http://192.168.1.100:5173/admin/realtime-test
# (Pas HTTPS, mais OK pour dev local)
```

---

## 7. Checklist Pré-Test

- [ ] `functions/.env.local` créé avec 3 paramètres
- [ ] `functions/.env.local` dans `.gitignore`
- [ ] `firebase functions:config:set` **NOT utilisé** (deprecated)
- [ ] `functions/src/realtimeTest/realtimeSFUService.ts` déployée localement
- [ ] Firestore rules actualisées (rtcSessions collection)
- [ ] `npm run dev` démarre sans erreur
- [ ] `firebase emulators:start` fonctionne
- [ ] ngrok ou mDNS prêt pour 2 téléphones
- [ ] Firestore rules testées sur Emulator

---

## 8. Accès Téléphones (2 appareils minimum)

**Appareil A:**
```
http://localhost:5173/admin/realtime-test (desktop)
OU
https://abc-123-ngrok.app/admin/realtime-test (si ngrok)
OU
http://192.168.1.100:5173/admin/realtime-test (si mDNS)
```

**Appareil B:** Même URL sur appareil différent

**Test:**
1. Appareil A: "Create / Join Room"
2. Copier Room ID
3. Appareil B: Coller Room ID, "Join Room"
4. Vérifier vidéo bidirectionnelle + audio

---

## NE PAS FAIRE

❌ Partager CF API Token par chat/email  
❌ Mettre tokens dans Git  
❌ Utiliser `firebase functions:config:set` (deprecated)  
❌ Utiliser `export CF_API_TOKEN=...` en prod  
❌ Communiquer secrets via Slack  
❌ Déployer sans Firebase Secret Manager en prod  

---

**Sources:**
- [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- [Firebase Secret Manager](https://cloud.google.com/secret-manager/docs)
- [ngrok Documentation](https://ngrok.com/docs)
