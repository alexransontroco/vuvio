Status: Current
Read before coding: Sécurité des lives publics, privés et réservés aux abonnés. Ne pas annoncer un live privé comme sécurisé avant validation Firestore et Cloudflare.

# Audit de sécurité des lives — 21 novembre 2026

Périmètre : branche `fix/creator-acquisition-mvp`, PR #2. Audit du code et des règles locales, vérification sur l'émulateur Firestore avec le projet fictif `demo-vuvio-security`, puis inventaire ciblé en lecture seule de Firebase et Cloudflare. Aucun déploiement ni changement des ressources de production. La landing page et les branches expérimentales restent hors périmètre.

## Conclusion

**Les modes Private et Followers ne sont pas sécurisés en production.** Les règles Firestore déployées autorisent encore la lecture et la mise à jour anonymes de `activeLives`. L'API et les aperçus de partage publiés exposent encore des métadonnées Followers. Plus grave, `/api/cloudflare/inputs` répond anonymement avec les clés d'ingest des 12 inputs actuels. La décision produit du MVP est **Public Only**. Les corrections ci-dessous sont présentes dans la branche et testées localement ; aucun déploiement ni traitement des ressources existantes n'a été effectué.

## Correction Public Only préparée dans la branche

- Start Live et Schedule affichent Private/Followers comme temporairement indisponibles. `parseVisibility` rejette explicitement ces valeurs côté API avant la création d'un input Cloudflare ; activation et démarrage d'anciens programmes non publics sont aussi refusés.
- Les nouveaux `activeLives` publics portent `publicSafe: true`, `visibility: public`, `privacy: Everyone`. Le client ne copie plus `streamKey` ni `webRTCUrl` dans Firestore ou dans son cache local. Les règles refusent les clés d'ingest et les champs ajoutés hors liste approuvée dans les créations et modifications ; elles réservent les écritures du document au propriétaire. Les spectateurs conservent leurs sous-collections de chat et de signalisation pour les lives publics. Les lectures des sous-collections privées sont refusées.
- Les requêtes publiques Watch, Map, notifications et profils filtrent `publicSafe == true` ; deux index de collection sont déclarés. Les requêtes du créateur par `creatorUid` et les lectures d'administration restent distinctes. L'unique document `activeLives` actuel sans marqueur restera inaccessible publiquement après activation, sauf assainissement et approbation explicites.
- `createLiveInputHandler` exige un document public approuvé appartenant à l'appelant avant toute opération Cloudflare et ne crée plus de document de secours. Les endpoints de lecture stream/gear/replay refusent les ressources non publiques ; la création d'URL d'upload replay vérifie le propriétaire et le statut public. Les diagnostics Cloudflare, qui exposaient sans authentification toutes les clés d'input et permettaient de créer un input test, exigent désormais un compte administrateur avec claim `admin` ou email autorisé **vérifié**. Le même durcissement s'applique aux lectures Firestore réservées à l'administration. Les sorties multistream ne peuvent plus être ajoutées à un live non public.
- Les aperçus Open Graph ne reprennent les données que des `streams` publics ou des `activeLives` publics approuvés. Les liens d'un live non public conservent une présentation générique. La vérification de propriété des highlights accepte le champ `creatorUid` utilisé par les lives du client. Les URLs HLS publiques et `requireSignedURLs: false` restent inchangés pour les lives publics.

### Validation locale de cette correction

L'émulateur Firestore valide **18/18 scénarios** : lecture et création publiques, refus Private/Followers, refus des sous-collections privées, refus de la liste brute et des écritures anonymes/étrangères, gestion par le propriétaire, rejet des clés d'ingest, des champs inconnus et d'une adresse administrateur non vérifiée. Les deux tests supplémentaires vérifient que l'API publique refuse un stream Followers et que l'aperçu Open Graph masque les données Followers et Private tout en conservant celles d'un stream public. Le scénario de migration confirme qu'un ancien document public contenant un champ d'ingest reste inaccessible, devient lisible après un assainissement **simulé uniquement sur l'émulateur**, puis redevient inaccessible après restauration de sa sauvegarde fictive ; le document privé reste inaccessible. Les tests Functions valident **4/4 politiques** de visibilité, de propriété et d'administration ; les **3/3 tests de liens** passent. Les builds frontend et Functions passent sous Node 22. Aucun test sur un live Cloudflare réel ou navigateur Instagram n'a été effectué. Ces résultats ne remplacent pas une validation de bout en bout après mise en service.

Après synchronisation avec `main` au commit `2bd97bb` (configuration des secrets Functions), les **16 tests Firestore initiaux**, **4 tests Functions** et **3 tests de liens** sont repassés ; les deux builds réussissent. Les deux tests supplémentaires de routes publiques portent le total de l'émulateur à 18. Le code applicatif n'a pas été modifié depuis ces builds.

### Inventaire Firebase initial, avant suppression volontaire — 23 novembre 2026

Projet contrôlé : `vuvio-bf328`. Le script n'a exécuté que des lectures Admin SDK ; aucune règle, donnée, entrée Cloudflare ou ressource Storage n'a été modifiée. Les résultats ci-dessous sont agrégés et n'incluent ni clé ni identifiant de live.

| Ensemble | Constat |
| --- | --- |
| `activeLives` | 58 documents examinés ; tous `ended`, tous `privacy: Everyone`, aucun `publicSafe`, 51 références à un input Cloudflare. Les 58 portent au moins un **champ** d'ingest, mais aucune **valeur d'identifiant d'ingest non vide** n'a été détectée. La présence d'un champ vide ou nul suffit néanmoins à bloquer la règle de lecture directe et impose son retrait avant un éventuel marquage public. |
| `streams` | 11 documents examinés ; 2 en visibilité `followers` (1 `scheduled`, 1 `completed`). Un de ces deux documents référence un input Cloudflare. Un document signalé par l'inventaire référence un enregistrement ; son accès CDN n'a pas été vérifié. |

Ces 58 documents `activeLives` ont depuis été supprimés volontairement par le propriétaire du projet : **aucune migration de ce lot n'est à préparer**. L'inventaire est conservé comme trace historique des risques identifiés. Les deux documents Followers restent non publics. Aucun projet Vuvio de préproduction distinct n'est configuré dans ce dépôt ni apparu dans la liste des projets accessibles ; seule la simulation sur l'émulateur a été réalisée.

### Vérification ciblée des deux streams Followers — 23 novembre 2026

Les deux documents appartiennent au même compte Firebase ; son profil existe. Le document programmé ne référence ni input Cloudflare ni URL HLS ou replay. Le document terminé référence un input, mais l'API Cloudflare répond `404` pour cet input et retourne une liste de zéro enregistrement pour son identifiant. Ses URL HLS et playback existantes répondent `204` sans authentification, sans manifeste vidéo lisible. Aucun replay n'est référencé par ces deux documents. Ces vérifications ne prouvent pas l'absence d'autres vidéos orphelines ou de liens déjà partagés ; aucune ressource n'a été modifiée.

Une nouvelle lecture des deux documents confirme qu'aucun ne référence de miniature ou de couverture dans les champs courants (`coverImageUrl`, `image`, `thumbnailUrl`, `thumbnail`). Le risque résiduel des couvertures Storage publiques demeure général, sans couverture référencée par ces deux streams.

L'unique replay référencé dans les 58 anciens `activeLives` concerne un document `Everyone` terminé. Son manifeste HLS répond `200` sans authentification et est lisible ; l'API Cloudflare confirme un enregistrement prêt, avec `requireSignedURLs: false`. Ce comportement est cohérent avec un replay public, sous réserve de confirmer manuellement que son contenu était bien destiné à rester public. Aucun identifiant, URL, propriétaire ou secret n'est reproduit dans ce rapport.

### Suppression volontaire et état actuel — 23 novembre 2026

Le propriétaire du projet a confirmé avoir **volontairement supprimé les anciens documents `activeLives`**. La baisse observée de 60 documents à 18 h 53 UTC à un nouveau document à 18 h 55 UTC n'est donc ni une disparition inexpliquée ni un incident à investiguer. Les chiffres de l'inventaire initial sont historiques ; les documents supprimés ne font plus partie d'un lot à migrer. Aucune restauration, sauvegarde historique ou recherche de la cause n'est prévue. Aucune ressource de production n'a été modifiée pendant cet audit.

L'inventaire actuel de `vuvio-bf328` contient **un `activeLives`**, terminé et déclaré `privacy: Everyone`, sans `visibility` canonique ni `publicSafe`. Les champs d'ingest présents sont vides. Il référence une couverture et un input Cloudflare existant, configuré pour l'enregistrement automatique sans URL signées ; l'API ne liste aucune vidéo pour cet input et son URL HLS répond `204` sans manifeste lisible. Après activation des nouvelles règles, ce document restera inaccessible publiquement tant qu'il n'est pas assaini et approuvé. Comme il est terminé et n'a pas de replay référencé, on peut aussi décider de le laisser non publié ; cette décision doit être explicite avant la bascule.

La collection `streams` contient **11 documents : neuf Public et deux Followers**. Le Followers programmé n'a ni input, vidéo, replay, miniature ou URL HLS. Le Followers terminé référence un ancien input qui répond `404` côté Cloudflare ; sa liste de vidéos est vide, son URL HLS répond `204` sans manifeste lisible, et il n'a ni replay ni miniature référencés. Ces contrôles ciblés ne démontrent pas l'absence de tout autre lien déjà partagé.

L'API Cloudflare liste **12 inputs existants**, dont un seul est référencé par les documents Firestore actuellement présents ; les 11 autres n'ont aucun enregistrement retourné par leurs endpoints `/videos`. Les 12 ont `recording.requireSignedURLs: false`. Cela convient seulement aux vidéos réellement publiques ; l'absence de référence Firestore ne prouve pas à elle seule l'absence d'usage ou de divulgation passée. L'ancien replay `Everyone` relevé avant la suppression des documents reste accessible anonymement avec un manifeste HLS valide (`200`) ; son contenu doit être confirmé comme public si la suppression des documents visait aussi à retirer l'accès aux vidéos. La liste de vidéos de tout le compte Cloudflare n'a pas été rapprochée de façon exhaustive des anciens documents ; on ne peut pas exclure d'autres vidéos orphelines sur cette seule vérification ciblée. Aucune URL ni aucun identifiant n'est reproduit ici.

### Protections réellement déployées — lecture seule

- La release Firestore publiée **n'a pas** le marqueur `publicSafe` dans la règle `activeLives` et autorise encore lecture et mise à jour anonymes. La règle corrigée de la PR n'est pas déployée.
- L'API anonyme `GET /api/streams/:id` renvoie `404` pour le Followers programmé, mais `200` avec son titre et son URL HLS pour le Followers terminé. Les deux pages `/share/live/:id` renvoient `200` et incluent leur titre dans l'aperçu Open Graph. Les corrections de la PR masquent ces données dans les tests locaux.
- L'API anonyme `GET /api/cloudflare/inputs` renvoie `200` et contient une clé d'ingest et une URL d'ingest non vides pour **chacun des 12 inputs**. Aucune clé n'a été affichée ou enregistrée pendant le contrôle. Les clés doivent être considérées exposées ; la PR ajoute un contrôle administrateur vérifié, mais un déploiement ne révoque pas les clés déjà divulguées. Aucun endpoint de gestion n'a été appelé en écriture.

### Traitement avant mise en service — non exécuté

1. Décider si l'unique `activeLives` terminé doit rester visible. Si oui, examiner son contenu et sa couverture, retirer ses champs d'ingest vides et tout champ sensible, puis lui attribuer explicitement `visibility: public`, `privacy: Everyone` et `publicSafe: true` avec vérification de concurrence. Sinon, le laisser sans marqueur ; les nouvelles règles le masqueront. Ne pas recréer les documents volontairement supprimés ni transformer les deux `streams` Followers en Public.
2. Cartographier les 12 inputs Cloudflare et leur usage réel avant toute opération. Après fermeture de l'endpoint de diagnostic, préparer la rotation ou révocation des 12 clés exposées selon les mécanismes Cloudflare vérifiés, avec vérification de l'impact sur les diffusions et liens publics. Les 11 inputs sans référence Firestore et sans vidéo listée sont des candidats à revue, **pas** à suppression automatique.
3. Confirmer la destination de l'ancien replay public encore lisible sans Firestore. Ne modifier ni supprimer cette vidéo sans décision explicite. Garder les `streams` Followers hors des listes et aperçus publics ; vérifier après mise en service que leur API et leurs liens restent génériques et que leur HLS ne devient pas lisible.
4. Tester une bascule coordonnée Functions, frontend, index et règles sur un environnement approprié, puis un vrai live public HLS anonyme sur appareils. Refaire l'inventaire des documents présents juste avant le déploiement pour détecter tout nouveau live non assaini. Aucun de ces changements de production n'est autorisé dans cette session.

### Décision de fusion et de déploiement

| Étape | État et blocage précis |
| --- | --- |
| Fusion de la PR #2 | La branche est synchronisée avec `main`, sans conflit ni fichier Workshop/Together/Realtime SFU. Les 18 tests émulateur et les sept tests Functions/liens passent ; les builds du même code applicatif ont réussi. Aucun défaut de code supplémentaire n'est confirmé pour la fusion, mais la PR reste en brouillon et la revue/validation du propriétaire est requise. Fusionner ne protège pas la production tant que les règles et Functions ne sont pas déployées. |
| Déploiement des corrections | **Bloqué** tant que la séquence de mise en service et la gestion des 12 clés d'ingest exposées ne sont pas validées. Il faut fermer l'endpoint de diagnostic, puis révoquer ou renouveler les clés concernées sans interrompre les diffusions utiles ; les anciennes clés ne cessent pas d'être valides par simple déploiement. Décider aussi du sort de l'unique `activeLives` non marqué et de l'ancien replay public. |
| Validation après déploiement | Vérifier en production que les règles refusent les écritures anonymes, que les deux streams Followers ne divulguent plus leurs métadonnées via API/OG, que l'endpoint Cloudflare exige un administrateur vérifié, et qu'un nouveau live public se crée et se lit anonymement en HLS sur appareils. Ces essais ne sont pas réalisés ici. |

### Compatibilité MVP — contrôle du code et limites des essais

| Parcours | Contrôle effectué | Essai encore nécessaire |
| --- | --- | --- |
| Start Live, démarrage et arrêt | Création publique autorisée dans l'émulateur ; création Private/Followers rejetée dans les règles et Functions ; propriétaire seul autorisé à modifier. Le flux d'arrêt conserve le document pour le replay. | Caméra et vrai input Cloudflare sur préproduction. |
| Diffusion, HLS anonyme, Watch et Live Now | Le lecteur HLS primaire et le placement du live demandé en tête du feed sont conservés. La requête du feed public avec `publicSafe` passe sur l'émulateur. | Live réel, plusieurs spectateurs, iPhone/Android/Instagram intégré. |
| Upcoming et programmation | L'API liste les programmes publics ; les anciens programmes Followers restent visibles seulement à leur créateur et leur bouton Start est désactivé. La création publique reste acceptée. | Parcours de programmation sur un environnement complet. |
| Commentaires et signalisation P2P | Écriture et lecture d'un commentaire public ainsi que création anonyme d'un watcher testées sur l'émulateur ; sous-collections privées refusées. | Chat et fallback P2P pendant un vrai live. |
| Profils et notifications | Les requêtes publiques portent `publicSafe` ; les index nécessaires sont déclarés. | Lecture sur Firestore avec index construits et comptes réels. |
| Replays et highlights | L'ancien replay `Everyone` reste lisible sur Cloudflare malgré la suppression volontaire de son document Firestore ; ownership de génération des highlights accepte `creatorUid`. | Traitement complet d'un nouveau replay/highlight et décision sur le maintien de l'ancien replay. |
| Liens Instagram, `ref`, UTM, Open Graph | Trois tests de liens passent ; l'aperçu d'un document non public reste générique par le code. | Aperçu réel sur Instagram/WhatsApp et ouverture sur appareil. |

### Inventaire et ordre de mise en service — aucune étape exécutée en production

1. En environnement autorisé, exécuter `node functions/scripts/auditLiveVisibility.mjs --project=<id>` avec un compte Admin SDK dédié. Ce script est en lecture seule, signale les ID, les variantes de visibilité, la présence de secrets, d'inputs, de replays et de couvertures ; il ne sort aucune clé. Vérifier le projet et le volume de documents avant l'exécution. Les valeurs à traiter incluent `private`, `followers`, `followers-only`, `Private`, `Followers`, l'absence de visibilité et tout autre libellé inattendu.
2. Établir la liste des inputs Cloudflare, replays, highlights et couvertures liés aux documents non publics. Examiner les usages, la diffusion active et les liens déjà partagés. Vérifier séparément l'accès CDN avec l'ID seul. Les URLs non signées des ressources existantes restent potentiellement accessibles même lorsque Firestore les masque. Réserver toute restriction Cloudflare, révocation ou rotation de clé à une intervention validée avec plan d'impact et possibilité de retour arrière ; ne supprimer aucun live ni enregistrement automatiquement.
3. Avant de rendre les nouvelles règles actives, décider du sort de l'unique `activeLives` terminé actuellement présent. Ne poser `publicSafe: true` que sur un document explicitement approuvé et assaini ; sinon le laisser masqué par les nouvelles règles. Contrôler aussi tout nouveau document déjà marqué : les anciennes règles autorisent encore sa falsification. Prévoir une vérification de concurrence entre inventaire et bascule.
4. Tester sur un environnement de préproduction la compilation, les index, les règles, les Functions et le frontend ensemble. Vérifier la lecture anonyme d'un nouveau live public, la programmation/activation, HLS multi-spectateurs, chat/P2P, OG, replay et le retour créateur. Fermer l'endpoint de diagnostic, puis traiter les clés d'ingest exposées avec une intervention distincte validée. Aucun déploiement n'est effectué ici.

### Risques résiduels

- Le marqueur `publicSafe` garantit la requête publique seulement si l'inventaire préalable et tous les écrivains Admin SDK le posent exclusivement sur des documents assainis. Les règles ne filtrent ni les champs ni les résultats et ne s'appliquent pas à l'Admin SDK. Une validation des données existantes est obligatoire.
- `storage.rules` permet encore la lecture publique des `live-covers`; un lien de couverture non publique déjà connu peut rester accessible. Les protéger via une règle Storage consultant Firestore nécessiterait un accès interservices, des lectures facturées et des essais pour les miniatures Upcoming. Aucun changement Storage non testé n'a été appliqué.
- Les inputs et enregistrements Cloudflare préexistants avec `requireSignedURLs: false` restent accessibles selon leurs réglages Cloudflare. Le code de cette branche empêche d'en créer de nouveaux en mode non public, sans révoquer les anciens. Les **12 clés d'ingest confirmées lisibles anonymement** doivent être considérées compromises jusqu'à une rotation/révocation validée.

## Accès observés avant correction

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

## Preuve initiale avant correction

Le premier essai sur les anciennes règles donnait **2 réussites et 4 échecs**, reproduisant les accès indus. `test/liveVisibility.emulator.test.mjs` a ensuite été adapté à la décision Public Only et passe maintenant entièrement. Exécuter la version actuelle avec un projet d'émulateur `demo-...` :

```bash
firebase emulators:start --only firestore --project demo-vuvio-security --config firebase.security-emulator.json
FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 GCLOUD_PROJECT=demo-vuvio-security node --test test/liveVisibility.emulator.test.mjs
```

| Cas | Attendu | Observé |
| --- | --- | --- |
| Anonyme → public | Autorisé | Autorisé |
| Anonyme/non autorisé → Private | Refusé | Autorisé |
| Créateur → Private | Autorisé | Autorisé |
| Abonné → Followers, non abonné refusé | Refusés dans le MVP Public Only | Tous autorisés avant correction |
| Liste anonyme mélangeant les visibilités | Refusée | Autorisée |
| Modification anonyme d'un live | Refusée | Autorisée |

Le test manuel complémentaire confirme que les réponses anonymes incluent les champs fictifs `hlsManifestUrl` et `streamKey`. Aucun vrai secret n'a été utilisé. Pour les tests futurs, employer l'émulateur et vérifier séparément le CDN Cloudflare avec un input de test, un token autorisé et un token expiré. Les règles Firestore ne filtrent pas les résultats : les requêtes publiques devront porter la contrainte de visibilité appropriée, avec une stratégie distincte pour les lives du créateur et des abonnés.

Validation complémentaire : `npm run build` (frontend) et `npm --prefix functions run build` réussissent avec Node 22 ; les trois tests de liens publics de `test/liveLinks.test.mjs` réussissent. Le build Vite signale des ressources absentes au moment de la compilation et des avertissements de taille de bundles, sans échec. Aucun test vidéo réel ni test d'aperçu sur un crawler Instagram ou WhatsApp n'a été effectué.

## Options archivées de l'audit initial

### Option A — pilotes publics uniquement (retenue)

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
