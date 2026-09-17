# Journal d'Architecture — Vuvio

> Document vivant. Chaque session ajoute une entrée numérotée en bas.  
> Rédigé en français. Création : 2026-09-03.  
> Vue d'ensemble produit et architecture.  
> Les tâches ouvertes vivent dans `ADMIN.md`; les règles agent vivent dans `AGENTS.md`.

---

## 1. Vision et concept

### 1.1 L'idée centrale

Vuvio est une **plateforme de streaming live spécialisée dans l'outdoor et l'aventure**. L'ambition : permettre à des créateurs (alpinistes, surfeurs, trail runners, guides, parapentistes…) de **diffuser en direct depuis le terrain**, et à une communauté de passionnés de les regarder, interagir et découvrir du contenu immersif ancré dans des lieux réels.

Deux différences fondamentales avec YouTube Live ou Twitch :
1. **Le lieu est premier** — chaque stream est géolocalisé. Le globe 3D est l'interface de découverte principale, pas un algorithme.
2. **L'équipement est un objet de communauté** — le créateur expose son gear (caméra, casque, chaussures…) avec liens affiliés. Vecteur de monétisation et de conversation.

### 1.2 Règles de développement importantes

→ Voir [`AGENTS.md`](./AGENTS.md).

### 1.3 Stratégie marché (Europe)

Expansion prévue en 4 marchés européens :

| Marché | TAM estimé | Cible Y1 | Phase |
|---|---|---|---|
| Espagne | €10-16M | €7-10M | Phase 1 (août-sep) |
| Italie | €9-13M | €1.8-2.8M | Phase 1 (août-sep) |
| France | €18-22M | €2.1-3.5M | Phase 2 (oct-nov) |
| Allemagne | €15-19M | €2.9-4.2M | Phase 2 (oct-nov) |

Budget GTM total : €130-170k. Cible : 5-15k utilisateurs en 60 jours.  
Catégories prioritaires : gastronomie (40-50%), artisanat (25-45%), aventure (20-35%).  
Risque réglementaire : France = CNIL complexe, Allemagne = GDPR strict.

---

## 2. Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React 19, Vite 6, React Router v6 |
| **Hébergement** | Firebase Hosting (`vuvio-bf328.web.app`) |
| **Backend** | Firebase Cloud Functions v2 (Node.js 20, TypeScript) |
| **Base de données** | Firestore (NoSQL, temps réel) |
| **Vidéo live** | Cloudflare Stream (WHIP ingest → HLS playback ; relay RTMPS revert) |
| **Globe 3D** | react-globe.gl + Three.js |
| **Globe alternatif** | CesiumJS (route `/globe-cesium`) |
| **Carte 2D** | MapLibre GL (route `/globe` production) |
| **WebRTC** | PeerJS (frontend) |
| **IA highlights** | OpenAI Whisper (transcription) + GPT-4o-mini (analyse) |
| **Produits/gear** | Icecat API |
| **TURN server** | Metered (`turn.vuvio.app:3478`) |
| **Internationalisation** | i18next (infra en place, extraction incomplète) |

### 2.1 Déploiement

```bash
# Frontend
node_modules/.bin/vite build
firebase deploy --only hosting:vuvio-bf328  # nom du site obligatoire

# Backend
firebase deploy --only functions
```

- **Région Functions** : `europe-west1`
- **Timeout** : 540s, 2 GiB RAM

### 2.2 Secrets backend (Firebase Secret Manager)

`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_WEBHOOK_SECRET`, `CLOUDFLARE_CUSTOMER_CODE`, `OPENAI_API_KEY`, `ICECAT_USERNAME`, `ICECAT_PASSWORD`, `METERED_API_KEY`, `METERED_APP_NAME`

---

## 3. Architecture du streaming live

### 3.1 Pipeline actuel (post-revert, août 2026)

```
Browser (créateur)
    ↓ WebRTC / WHIP
Cloudflare Stream Live Input
    ↓ HLS manifest
Browser (spectateur)
    ↓ hls.js
WatchPage
```

**Important** : Le relay RTMPS (`relay/server.js`) a été **revert le 20 août 2026** (commit `6d49ac3`). Le dossier `relay/` contient encore Dockerfile et scripts de test mais plus de code actif. Le streaming passe à nouveau directement par WebRTC/WHIP vers Cloudflare.

### 3.2 Pourquoi le relay avait été créé (contexte historique)

Cloudflare Stream n'enregistre pas les streams WebRTC/WHIP — seuls RTMPS/SRT obtiennent `recording.mode=automatic`. Le relay servait de pont FFmpeg pour contourner ça. Il a été revert pour des raisons à documenter lors de la prochaine décision sur l'enregistrement.

### 3.3 Cycle de vie d'un stream

```
draft → scheduled → preparing → connecting → live → reconnecting → ending → processing → completed
                                                                              ↓
                                                                           failed / cancelled
```

### 3.4 Webhook Cloudflare

- Header : `Webhook-Signature: time=<ts>,sig1=<hex>`
- Extraction : regex `/sig1=([0-9a-f]+)/i`
- Met à jour `activeLives/{streamId}` avec `replayUrl` quand encodage terminé
- `LiveRecapPage` n'affiche le player que quand `readyToStream === true`

### 3.5 Règle critique : ne jamais supprimer les docs live dans `endLive`

Les documents `activeLives/{liveId}` sont nécessaires pour le polling replay après la fin du stream.

---

## 4. Firestore — collections et schéma

| Collection | Rôle |
|---|---|
| `users/{uid}` | Profils (displayName, photoURL, role, accountStatus, followerCount…) |
| `usernames/{username}` | Réservation des noms d'utilisateur |
| `activeLives/{liveId}` | Sessions live actives |
| `activeLives/{liveId}/watchers` | Présence temps réel des spectateurs (signaling WebRTC) |
| `activeLives/{liveId}/comments` | Commentaires live (max 500 chars) |
| `activeLives/{liveId}/stars` | Réactions live |
| `creatorEquipment/{id}` | Équipement des créateurs |
| `videoProcessingJobs/{id}` | Jobs d'analyse vidéo post-live |
| `conversations/{id}` | Fils de messages directs |
| `conversations/{id}/messages` | Messages individuels (max 2000 chars) |
| `products/{id}` | Catalogue produits |
| `streamStats/{id}` | Stats agrégées par stream (admin only) |
| `creatorStats/{id}` | Stats par créateur (admin only) |
| `categoryStats/{id}` | Stats par catégorie (admin only) |
| `analyticsEvents/{id}` | Événements bruts (admin only) |

**Accès admin** : `alexandre.ranson@gmail.com` ou emails `@vuvio.app`

---

## 5. Routes frontend

### Publiques
- `/watch` — Lecteur live (HLS via hls.js)
- `/explore` — Découverte avec filtres
- `/globe`, `/map` — Globe production (MapLibre 2D, CurrentGlobe)
- `/profile/:creatorId` — Profil public créateur
- `/live/:liveId/summary` — Récap partageable post-live

### Lab / expérimental (globe)
- `/globe-test-2` — **GlobeTest2** (react-globe.gl, développement actif)
- `/globe-cinematic` — GlobeCinematic
- `/globe-lab` — VuvioGlobeLab
- `/globe-test` — GlobeTestPremium (Three.js, atmosphère cyan)
- `/globe-cesium` — Version Cesium

### Protégées (auth requise)
- `/live/:liveId` — Broadcast live
- `/live/:liveId/recap` — Récap post-live
- `/messages`, `/messages/:conversationId` — Messagerie
- `/profile/equipment`, `/profile/gear` — Gestion équipement
- `/internal/streams` — Admin streams

---

## 6. Globe 3D — GlobeTest2

### 6.1 Contexte

GlobeTest2 (`/globe-test-2`) est la version principale du globe en développement actif. Réécrite de MapLibre (2D) vers react-globe.gl (3D) pour correspondre à un mockup précis.

### 6.2 Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/components/globe/GlobeTest2.jsx` | Composant principal |
| `src/routes/GlobeTest2Page.jsx` | Wrapper route — passe `[...createdLives, ...mapStreams]` |
| `src/styles/pages/globe-test.css` | Classes CSS `.g2-*` |
| `src/data/globeTest2Data.js` | Données test — préfixe ID `test2-base-` |

### 6.3 Texture du globe

**Utiliser le CDN uniquement** : `//unpkg.com/three-globe/example/img/earth-night.jpg`  
Le fichier local `/assets/globe/earth-night.jpg` est trop petit (1774×887px) et apparaît gris.

### 6.4 Design des marqueurs (mockup)

- `.g2-avatar__bubble` : 52px, bordure cyan 2.5px, anneau lumineux extérieur
- `.g2-avatar__stem` + `.g2-avatar__dot` : tige/épingle vers la surface
- `.g2-modebar` : pill sombre en haut, tab actif avec soulignement cyan (pas fond rempli)
- `.g2-card__watch` : pill complète (border-radius 999px), gradient cyan, 50px hauteur

### 6.5 Bugs corrigés

- **Card se ferme instantanément** : `justSelectedRef` (flag 80ms empêche `onGlobeClick` après clic avatar)
- **Watch Live — mauvais live** : extraction ID original en retirant préfixe `test2-base-`, fallback hash déterministe

### 6.6 Clusters — état actuel

Clusters supprimés volontairement après des bugs de count (badge "14" mais zoom montrait 3). À reconstruire **une étape à la fois** avec validation à chaque étape. Actuellement : `clusterLives` retourne `{ clusters: [], individuals: lives.slice(0, 100) }`.

---

## 7. Système d'équipement (Gear)

### 7.1 Implémentation (juillet 2026)

24 fichiers créés (~3500 LOC). Taxonomie : 20 activités → 50+ catégories → sous-catégories → 250+ marques → modèles libres.

### 7.2 Wizard d'ajout (6 étapes)

Activité → Catégorie → Sous-catégorie → Marque → Modèle → Détails

### 7.3 Composants clés

`GearAddWizard`, `GearItemCard`, `GearThumbnail`, `GearDetailsForm`, `GearCategoryPicker`, `GearBrandPicker`, `GearImageUploader`, `GearModelInput`, `GearActivityPicker`

### 7.4 Stockage

- **Actuellement** : JSON-based (localStorage)
- **Chemin Firestore préparé** : `users/{userId}/gearItems`
- **Collection Firestore** : `creatorEquipment/{id}` (ownerId, type, category, brand, model, imageUrl, affiliateUrl, visibility)

### 7.5 Intégration Icecat

Source de données produits via API Icecat (marque, modèle, catégorie, images, GTIN/EAN/MPN).  
Endpoints backend : `POST /api/products/search-icecat`, `POST /api/products/import-icecat`.  
Protection SSRF : whitelist de domaines pour les images.

---

## 8. Système produits

### 8.1 Implémentation (Phase 1 & 2)

12 fichiers, 3064 LOC. 25 produits démo (GoPro, DJI, RODE, Canyon, POC).

### 8.2 Architecture

- **Frontend** : `productService.js` (Firestore CRUD + cache localStorage 1h TTL), `imageProcessingService.js` (validation URL/MIME/téléchargement)
- **Backend** : `POST /api/products/process-image` — valide URL, télécharge (50MB max), valide MIME par magic bytes
- **Composants** : `ProductThumbnail`, `ProductSearch`

---

## 9. Analytics

### 9.1 Architecture client

3 couches :
1. **Session** — IDs stables (session/anonymous/user) via sessionStorage/localStorage
2. **Queue** — in-memory + localStorage, dédup, batch max 500 events
3. **HTTP client** — retry avec backoff exponentiel vers `POST /api/analytics/events`

### 9.2 Événements trackés

**Client** : `stream_impression`, `viewer_joined`, `viewer_left`, `view_10_seconds`, `view_30_seconds`, `stream_skipped`, `follow_creator`, `share`, `gear_opened`, `gear_clicked`, `comment_sent`, `report_submitted`

**Serveur** : `stream_created`, `stream_activated`, `stream_started`, `heartbeat`, `connection_lost`, `connection_restored`, `stream_ended`

### 9.3 Agrégation (Cloud Functions planifiées)

| Fonction | Fréquence | Rôle |
|---|---|---|
| `checkStreamHeartbeats` | 1 min | Santé streams, nettoyage |
| `aggregateStatsScheduled` | 5 min | Stats stream/créateur/catégorie |
| `aggregateUserAnalyticsScheduled` | 1h | Analytics par utilisateur |
| `processHighlightsScheduled` | 1 min | Génération highlights IA |
| `remindScheduledStreamsScheduled` | 1 min | Rappels streams planifiés |

---

## 10. Highlights IA (post-live)

### 10.1 Pipeline

```
MediaRecorder (WebM)
    ↓ Firebase Storage
Firestore job créé
    ↓ backend
FFmpeg → MP3 16kHz mono
    ↓
OpenAI Whisper (transcription timestampée)
    ↓
GPT-4o-mini (analyse → 3-5 moments clés)
    ↓
FFmpeg → clips MP4
    ↓ Firebase Storage (URLs signées, expire 7 jours)
```

### 10.2 Modèles

- Transcription : `OPENAI_TRANSCRIPTION_MODEL=whisper-1`
- Analyse : `OPENAI_ANALYSIS_MODEL=gpt-4o-mini`

### 10.3 Frontend

- `videoAnalysisService.js` — gestion jobs
- `highlightService.js` — logique UI
- `highlightApiService.js` — client API
- Route : `/live/:liveId/recap` (LiveRecapPage)
- Composant résumé : `/live/:liveId/summary` (LiveSummaryPage — `LiveSummaryHero`, `LiveSummaryStats`, `HighlightGenerator`)

---

## 11. Messagerie

### 11.1 Schéma Firestore (planifié)

```
conversations/{conversationId}
  - participants: [uid1, uid2]
  - lastMessage: { text, timestamp, senderId }
  - unreadCount: { uid1: 0, uid2: 2 }

conversations/{conversationId}/messages/{messageId}
  - type: text | live | replay | profile | location | system
  - text: string (max 2000 chars)
  - senderId: uid
  - status: sent | delivered | read
```

### 11.2 Règles de sécurité

- Seuls les participants peuvent lire/écrire
- `senderId` doit correspondre à `auth.uid`
- Écriture des champs highlight interdite en direct (passe par le backend uniquement)

---

## 12. Internationalisation

- **Infra** : i18next configuré
- **État** : 350+ chaînes anglaises hardcodées à extraire (phase future)
- **Corrigé** : labels français dans EditProfilePage, ProfilePage, globe/map (`Actuel`→`Current`, `Recentrer`→`Recenter`)
- **HTML** : `lang="en"` (corrigé depuis `fr`)
- **Déféré** : IDs/paths en français dans les icônes

---

## 13. API Cloud Functions — routes complètes

**Streams** : `POST /api/streams`, `GET /api/streams/live`, `GET /api/streams/scheduled`, `POST /api/streams/:id/activate`, `GET /api/streams/:id`, `POST /api/streams/:id/start`, `POST /api/streams/:id/heartbeat`, `POST /api/streams/:id/end`, `POST /api/streams/:id/finish`, `POST /api/streams/:id/upload-url`

**Globe** : `GET /api/globe/streams`

**Gear** : `POST /api/streams/:id/gear`, `GET /api/streams/:id/gear`

**Analytics** : `POST /api/streams/:id/events`, `POST /api/analytics/events`, `GET /api/analytics/debug`

**Produits** : `GET /api/products/search`, `GET /api/products/:id`, `POST /api/products/import`, `POST /api/products/process-image`

**Highlights** : `POST /api/lives/:id/highlight`, `GET /api/lives/:id/highlight-status`, `DELETE /api/lives/:id/highlight/:jobId`, `GET /api/highlight-config`

**Cloudflare** : `POST /api/cloudflare/live-input/create`, `GET /api/cloudflare/config`, `GET /api/cloudflare/inputs`, `POST /api/webhooks/cloudflare`

**Divers** : `GET /api/turn-credentials`, `GET /api/share/live/:id`, `GET /api/share/live/:id/recap`

---

## 14. Questions ouvertes / Arbitrages en cours

→ Suivis dans [`ADMIN.md`](./ADMIN.md), section "Tâches ouvertes".

---

## Journal des sessions

→ Déplacé dans [`CHANGELOG.md`](./CHANGELOG.md)
