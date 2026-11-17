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

### Paramètre 3: CF App ID + App Secret

**Localisation:** https://dash.cloudflare.com/
1. Workers & Pages → **Realtime**
2. Trouver ton app Realtime (ou en créer une)
3. Copier **App ID** (UUID format)
4. Copier **App Secret** (keep private — used for room-level access control)
5. **Communiquer l'ID uniquement; le Secret ne doit jamais être partagé**

**Important:** App Secret is required server-side for creating sessions + managing room access. Never expose to client.

---

## 2. Configuration Locale Sécurisée (`.env.local`)

**Fichier:** `functions/.env.local` (NE PAS committer)

```bash
# Cloudflare Realtime credentials
CF_API_TOKEN=your_token_here_1234567890abcdef
CF_ACCOUNT_ID=1a2b3c4d5e6f7g8h
CF_APP_ID=550e8400-e29b-41d4-a716-446655440000
CF_APP_SECRET=your_app_secret_keep_private

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

## 4. Vérifier la Configuration (Local + Emulator)

### Step 1: Verify Functions Build
```bash
cd functions
npm run build  # Must compile TypeScript with no errors
```

### Step 2: Firebase Emulator Test (REQUIRED BEFORE PRODUCTION)
```bash
# Start Firestore + Functions emulator
firebase emulators:start --only firestore,functions

# In another terminal, authenticate as test user
firebase auth:import /path/to/test-users.json --hash-algo=bcrypt

# Call createRealtimeSession function (emulator port 5001)
# Requires Authorization header with valid ID token from test user
```

### Step 3: Room Access Control Verification
```bash
# 1. Create session as User A via function
# → Firestore rtcSessions/{sessionId} created with userId=A

# 2. Try to access session as User B (different UID)
# → Expected: Firestore rule denies read access
# → Actual: Verify rule enforcement via Emulator

# 3. User A re-creates same room
# → Expected: Cloudflare SFU generates new sessionId
# → Actual: Verify sessionId uniqueness in Firestore audit log
```

### Step 4: Verification Success Criteria
- ✅ Functions compile (`npm run build` exit=0)
- ✅ Firestore Emulator runs without errors
- ✅ Firebase Functions Emulator callable endpoint responds at http://localhost:5001
- ✅ Firestore rule `resource.data.userId == request.auth.uid` enforces user isolation
- ✅ createRealtimeSession returns `{success, sessionId, answer}`
- ✅ Unauthorized users cannot read other users' sessions

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

## 7. Cloudflare SFU Authentication Verification

**CRITICAL:** Firebase Auth is NOT sufficient for SFU room access control. CF Realtime SFU requires separate authentication.

### Verify CF API Token Permissions
```bash
# 1. Test CF API Token validity
curl -X GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/realtime/apps \
  -H "Authorization: Bearer {CF_API_TOKEN}" \
  -H "Content-Type: application/json"

# Expected: 200 OK + list of Realtime apps
# If 403: Token lacks Realtime scope (create new token with Realtime Read+Write)
```

### Verify CF App ID + Secret Configuration
```bash
# 1. Get CF Realtime app details
curl -X GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/realtime/apps/{APP_ID} \
  -H "Authorization: Bearer {CF_API_TOKEN}"

# Expected: 200 OK + app details including appSecret
# Note: appSecret is returned here but should be stored securely in CF_APP_SECRET env var
```

### Verify Server-Side Room Access Control
- **Firebase Auth** → Authenticates user identity (UID)
- **Firestore Rules** → Controls access to rtcSessions collection
- **CF App Secret** → Server-side credential for creating sessions + managing track access
- **Room-Level Isolation** → CF Realtime SFU routes tracks only to authorized participants (server verifies via appSecret)

**Security Model:**
1. Client: Sends offer (unauthenticated) → Firebase Function validates auth
2. Server: Creates CF RTC session using App Secret (private)
3. Server: Returns answer SDP to client
4. Client: Initiates WebRTC connection using answer
5. SFU: Accepts media from client, routes to authorized participants only

---

## 8. Checklist Pré-Test

**Build & Config**
- [ ] `functions/.env.local` créé avec 4 paramètres: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_APP_ID`, `CF_APP_SECRET`
- [ ] `functions/.env.local` dans `.gitignore` (vérifier: `git check-ignore functions/.env.local`)
- [ ] `firebase functions:config:set` **NOT utilisé** (deprecated)

**TypeScript & Build**
- [ ] `npm run build` complète sans erreur TS
- [ ] `cd functions && npm run build` complète sans erreur TS

**Firebase Emulator**
- [ ] `firebase emulators:start --only firestore,functions` démarre sans erreur
- [ ] Firestore rules: `resource.data.userId == request.auth.uid` enforces user isolation
- [ ] Test rule via Emulator: User A creates session → User B cannot read it

**CF Realtime Verification**
- [ ] CF API Token valid: GET `/accounts/{ID}/realtime/apps` returns 200 OK
- [ ] CF App ID exists and has appSecret configured
- [ ] `CF_APP_SECRET` stored securely in `functions/.env.local`
- [ ] No secrets exposed in Git history

**Local Dev**
- [ ] `npm run dev` démarre sur http://localhost:5173 sans erreur
- [ ] `/admin/realtime-test` accessible (requires admin login)
- [ ] `createRealtimeSession` Firebase Function callable from frontend

**HTTPS Local Testing**
- [ ] ngrok tunnel (`ngrok http 5173`) ou mDNS prêt
- [ ] 2 devices can reach HTTPS URL (same local network or via ngrok)
- [ ] Camera + microphone permissions work on both devices

**Documentation**
- [ ] All 8 sections of REALTIME_SETUP_SECURE.md reviewed
- [ ] Docs accessible from Admin → Docs page (if integrated)

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
