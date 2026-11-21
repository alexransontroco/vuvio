Status: Current
Read before coding: Sécurité des lives publics, privés et réservés aux abonnés. Ne pas annoncer un live privé comme sécurisé avant validation Firestore et Cloudflare.

# Audit de sécurité des lives — 21 novembre 2026

Périmètre : branche `fix/creator-acquisition-mvp`, PR #2. Audit du code et des règles locales, puis vérification sur l'émulateur Firestore avec le projet fictif `demo-vuvio-security`. Aucun accès aux données de production, déploiement ou appel à un live Cloudflare réel. La landing page et les branches expérimentales restent hors périmètre.

## Conclusion

**Les modes Private et Followers ne sont pas sécurisés.** Un identifiant de live connu permet de lire les métadonnées et les URLs de lecture dans `activeLives`. Les entrées Cloudflare Live sont configurées avec `requireSignedURLs: false`, y compris lors de `ensureRecordingEnabled`. Le filtrage React et l'aperçu Open Graph générique de la PR ne protègent ni la base ni la vidéo. Le MVP public continue de fonctionner sans inscription et doit rester ainsi.

## Accès observés

| Surface | Comportement actuel et preuve |
| --- | --- |
| `activeLives/{id}` | `allow read: if true` et `allow update: if true` dans `firestore.rules`. L'émulateur confirme lecture et modification anonymes d'un document `Private`. Le document peut contenir titre, confidentialité, HLS/WHEP, identifiant Cloudflare, signalisation P2P et, dans le parcours programmé, `streamKey` copié par `createLocalLive`. |
| Liste `activeLives` | L'émulateur renvoie simultanément les lives `Everyone`, `Private` et `Followers`. `getCreatedLives` et `subscribeToCreatedLives` demandent tous les documents `status == live`, puis les pages Watch/Discover les utilisent. Un filtre visuel ne protège pas une requête Firestore. |
| `streams` | Les règles Firestore client ne déclarent aucun `match /streams` : accès direct client refusé par défaut. Les Functions Admin contournent les règles. `listLiveStreams` filtre `visibility == public` et `listScheduledStreams` ne retourne que les programmes publics hors `creator=me`. Mais `GET /api/streams/:id` accepte sans authentification un stream non public dès que son statut est `live` ou `completed` et retourne `playbackUrl` et `hlsManifestUrl`. |
| Replay | `getReplayStatus` ne refuse un autre UID que si un UID authentifié existe ; une requête anonyme passe ce contrôle et peut recevoir l'URL replay d'un document connu. Les uploads replay utilisent aussi `requireSignedURLs: false`. Les règles Storage autorisent la lecture publique des miniatures `live-covers`. |
| Open Graph | La PR renvoie une image et un texte génériques pour les documents marqués `private` ou `followers`/`Private` ou `Followers`. Ce contrôle de présentation ne limite pas l'accès Firestore ou Cloudflare. Aucun test sur crawler réel n'a été fait. |
| Cloudflare HLS/WHEP | `createLiveInput` et `ensureRecordingEnabled` fixent `recording.requireSignedURLs: false` et `allowedOrigins: []`. La documentation Cloudflare indique que le live input ID utilise ces réglages et qu'une vidéo non signée est consultable avec son ID. L'accès CDN d'un vrai live privé n'a pas été essayé ; la configuration actuelle et le contrat Cloudflare suffisent à établir l'absence de contrôle d'autorisation par utilisateur. |
| P2P | `watchBroadcast` lit l'offre dans `activeLives/{id}` et écrit sous `watchers`. Les règles de la racine et de `watchers` sont publiques ; la connaissance de l'ID permet d'essayer une connexion sans contrôle d'abonnement. |
| Création/écriture | `createLiveInputHandler` authentifie l'appelant mais ne vérifie pas qu'il possède `streamId` avant de modifier `activeLives/{id}`. Les règles client autorisent toute mise à jour anonyme, ce qui permet aussi de falsifier visibilité, statut et URL. |

Les champs de visibilité ne sont pas normalisés : `streams` utilise `visibility` (`public`, `private`, `followers`), tandis que le live client utilise surtout `privacy` (`Everyone`, `Private`, `Followers`). Les lives plus anciens ou créés par le chemin Cloudflare de secours peuvent manquer de champ canonique. Une règle nouvelle basée sur un seul de ces champs bloquerait des lives publics ou laisserait des exceptions. Les abonnements sont enregistrés dans `users/{uid}.followedCreators`, modifiables par l'utilisateur concerné ; aucun modèle d'invitation explicite pour Private n'est présent.

## Test Firestore reproductible

`test/liveVisibility.emulator.test.mjs` crée trois documents fictifs (public, privé, abonnés) et un profil d'abonné. Exécuter avec l'émulateur Firestore d'un projet `demo-...` et `FIRESTORE_EMULATOR_HOST` défini. Le test exprime la politique attendue, pas le comportement actuel. L'essai sur les règles de cette branche donne **2 réussites et 4 échecs attendus** :

```bash
firebase emulators:start --only firestore --project demo-vuvio-security --config firebase.security-emulator.json
FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 GCLOUD_PROJECT=demo-vuvio-security node --test test/liveVisibility.emulator.test.mjs
```

| Cas | Attendu | Observé |
| --- | --- | --- |
| Anonyme → public | Autorisé | Autorisé |
| Anonyme/non autorisé → Private | Refusé | Autorisé |
| Créateur → Private | Autorisé | Autorisé |
| Abonné → Followers, non abonné refusé | Autorisé/refusé | Tous autorisés |
| Liste anonyme mélangeant les visibilités | Refusée | Autorisée |
| Modification anonyme d'un live | Refusée | Autorisée |

Le test manuel complémentaire confirme que les réponses anonymes incluent les champs fictifs `hlsManifestUrl` et `streamKey`. Aucun vrai secret n'a été utilisé. Pour les tests futurs, employer l'émulateur et vérifier séparément le CDN Cloudflare avec un input de test, un token autorisé et un token expiré. Les règles Firestore ne filtrent pas les résultats : les requêtes publiques devront porter la contrainte de visibilité appropriée, avec une stratégie distincte pour les lives du créateur et des abonnés.

Validation complémentaire : `npm run build` (frontend) et `npm --prefix functions run build` réussissent avec Node 22 ; les trois tests de liens publics de `test/liveLinks.test.mjs` réussissent. Le build Vite signale des ressources absentes au moment de la compilation et des avertissements de taille de bundles, sans échec. Aucun test vidéo réel ni test d'aperçu sur un crawler Instagram ou WhatsApp n'a été effectué.

## Plan minimal à faire valider avant implémentation

### Option A — pilotes publics uniquement

Suspendre les choix Private et Followers dans Start Live et refuser côté Functions leur création ou activation tant que la protection vidéo n'est pas prête. Garder le parcours public, HLS et le partage inchangés. Inventorier les sessions et enregistrements non publics déjà créés, retirer ou sécuriser leurs accès Cloudflare et les secrets exposés avant de déclarer ce mode indisponible. Cette option ne remplit pas encore la table d'accès Private/Followers ; elle évite de créer de nouveaux lives faussement privés pendant les pilotes. Elle exige une décision produit et une migration prudente des sessions existantes.

### Option B — véritables lives privés et abonnés

1. Définir un champ `visibility` canonique sur chaque `activeLives`, migrer les documents existants sans interrompre les replays, et séparer les métadonnées publiques des secrets d'ingest. Ajouter un modèle d'autorisation explicite pour Private ; préciser si suivre librement un créateur suffit pour Followers.
2. Réécrire les règles Firestore : `get` public anonyme, Private propriétaire/invités, Followers propriétaire/abonnés vérifiés ; `list` et toutes les requêtes Watch/Discover compatibles ; mises à jour limitées au propriétaire et aux champs nécessaires ; sous-collections P2P, commentaires et questions alignées. Tester les six cas de l'émulateur et les transitions de statut.
3. Corriger les Functions Admin qui contournent les règles : `getStream`, `getReplayStatus`, `createLiveInputHandler`, URLs d'upload/replay et réponses de highlights. Vérifier la propriété avant toute mutation et appliquer la visibilité avant toute réponse.
4. Pour les entrées non publiques, activer `requireSignedURLs` sur Cloudflare Live et sur les enregistrements, y compris dans `ensureRecordingEnabled`. Distribuer des tokens courts par endpoint authentifié et autorisé ; ne pas livrer une URL HLS/WHEP brute à un lecteur non autorisé. Tester HLS, WHEP, replay et highlights avec et sans token. Le public conserve ses URLs HLS existantes. Restreindre ou désactiver P2P pour ces modes jusqu'à preuve que sa signalisation suit la même politique.
5. Traiter les inputs/enregistrements déjà créés avec accès non signé, les liens et caches partagés, puis vérifier avec Cloudflare que les anciens IDs seuls ne fonctionnent plus. Examiner aussi les miniatures Storage publiques. Déployer uniquement après tests émulateur et validation sur un environnement Cloudflare de test.

Cette option touche le modèle de données, les règles, plusieurs Functions, le lecteur et le cycle replay. Elle dépasse une correction locale sûre et ne doit pas être engagée sans validation explicite. Une règle Firestore isolée laisserait la vidéo accessible ; un changement Cloudflare isolé pourrait casser le visionnage public et les replays.

## Sources techniques

- Code local : `firestore.rules`, `storage.rules`, `src/services/createdLiveService.js`, `src/services/webrtcService.js`, `src/routes/WatchPage.jsx`, `functions/src/streams/{getStream,getReplayStatus,listLiveStreams}.ts`, `functions/src/cloudflare/{cloudflareClient,createLiveInputHandler}.ts`.
- Cloudflare : [Secure your Stream](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/), [Start a live stream](https://developers.cloudflare.com/stream/stream-live/start-stream-live/), [Watch a live stream](https://developers.cloudflare.com/stream/stream-live/watch-live-stream/).
- Firebase : [Securely query data](https://firebase.google.com/docs/firestore/security/rules-query).
