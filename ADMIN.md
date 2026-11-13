Status: Current
Read before coding: Check open tasks and current project decisions before changing docs, admin, globe, or streaming behavior.

# Admin — Vuvio

Point d'entrée unique pour naviguer dans la doc du projet.

---

## Changelog
→ [`CHANGELOG.md`](./CHANGELOG.md) — Historique des sessions (ce qui a été fait, quand, pourquoi)

---

## Sources de vérité

| Sujet | Source |
|-------|--------|
| Règles critiques pour agents IA | [`AGENTS.md`](./AGENTS.md) |
| Tâches ouvertes et arbitrages | `ADMIN.md` |
| Historique des sessions | [`CHANGELOG.md`](./CHANGELOG.md) |
| Vue d'ensemble produit/architecture | [`journal.architecture.md`](./journal.architecture.md) |
| Détail technique par domaine | [`docs/`](./docs/) |

---

## Agents IA

→ [`docs/agents.md`](./docs/agents.md) — Documentation complète des agents, exemples d'utilisation, flows couverts, historique des audits.

| Agent | Rôle | Lancer avec |
|-------|------|-------------|
| `vuvio-qa` | Audit code, bug reports, régressions | `"run a QA audit on [feature]"` |
| `vuvio-product` | Évaluation features, scope MVP | `"vuvio-product: évalue l'idée de [X]"` |
| `vuvio-launch` | Créateurs, outreach, séquence lancement | `"vuvio-launch: trouve des créateurs [X]"` |

---

## État actuel — 18 oct. 2026

### Features en prod

| Feature | Statut | Notes |
|---------|--------|-------|
| Live créateur (WebRTC WHIP) | ⚠️ Déployé, chemin média à revalider | Audit du 22 octobre : la négociation SDP est annoncée comme connexion ; vérifier les médias réels |
| Viewer HLS Cloudflare CDN (N viewers) | ⚠️ Déployé, dépend de l'ingestion | Cloudflare ne fournit pas HLS depuis WHIP actuellement ; voir audit ci-dessous et bug Safari |
| Live Q&A (questions/réponses) | ✅ Prod | |
| Live Recap (stats, cover, vidéo) | ✅ Prod | |
| Écran "live ended" viewer | ✅ Fix déployé | Backend écrit `completed` pas `ended` — corrigé |
| **Multistream** (Instagram / RTMP) | ⚠️ Déployé, non validé | Code en prod, jamais testé en vrai — voir section ci-dessous |
| Équipement + affiliate links | ✅ Prod | Amazon PA API v5 + Awin |
| EquipmentKit i18n FR/EN | ✅ Prod | |
| Profil (stats, liens sociaux, playlists) | ✅ Prod | |
| Messagerie Firestore | ✅ Prod | |
| Notifications (remind_me) | ✅ Prod | |
| Share + watermark canvas | ✅ Prod | Facebook = OG tags only (pas de watermark) |
| Analytics (sparklines, trends, filtres) | ✅ Prod | |
| Globe react-globe.gl (`/globe-test-2`) | ✅ Prod | |

---

## Multistream — parcours Instagram simplifié à réaliser

**Décision enregistrée le 22 octobre 2026 à la demande du propriétaire : viser un seul collage de clé par live, sans retaper l'adresse RTMPS. Cette amélioration n'est pas encore implémentée.**

- Réutiliser l'URL de destination déjà sauvegardée et la préremplir ; la garder modifiable si Instagram fournit une autre adresse.
- Ajouter un bouton pour ouvrir Instagram Live Producer depuis la configuration Instagram.
- Le créateur copie la nouvelle clé de sa session et la colle dans Vuvio ; la clé reste en mémoire pour la session, sans stockage persistant supplémentaire.
- Après lancement dans Vuvio, afficher la confirmation à effectuer dans Instagram ; ne pas confondre prévisualisation et publication effective.
- Ne pas promettre une connexion Instagram entièrement automatique : aucun accès officiel permettant de récupérer automatiquement les informations de session n'a été confirmé. Enregistrer une ancienne clé ne résout pas son renouvellement. Référence de parcours : [Restream, connexion Instagram et renouvellement de clé](https://support.restream.io/en/articles/6379108-stream-to-instagram).
- YouTube reste reporté. Aucun changement de l'ingestion, nouveau service ou déploiement autorisé par cette simple prise de note.

## Multistream — réception Instagram confirmée le 22 octobre 2026

**Première preuve réelle : le propriétaire confirme voir l'image animée et entendre le son dans Instagram Live Producer (« oui tout »).** Chaîne utilisée : navigateur Vuvio → relais HTTPS/WebRTC local → RTMPS Cloudflare → Live Output Instagram. Cela valide la réception dans Live Producer, pas une lecture par un spectateur Instagram externe ni une infrastructure de production.

- Live Vuvio : `created-1792649931828` ; input Cloudflare : `cb73d2cae399b05fc8d7f4e16f186ac6` ; session relais : `752a8214-a941-408a-9e9b-d7f8744a5de2`.
- Première tentative échouée : URL du relais Cloud Run encore sélectionnée, timeout ICE, `FINAL MODE: none`. Le log « WHIP still active » était inexact pour cette branche.
- Relance via `https://localhost:5175/watch?relayLocal=1` : override confirmé vers `https://localhost:8787`, WebRTC connecté en VP8, `FINAL MODE: rtmps-relay`. Aucun changement de l'architecture principale requis pour sélectionner ce mode de test existant.
- Deux relevés de la session réelle : connexion ICE directe UDP host/host, RTT ~1 ms ; frames reçues 897 → 1 552 ; audio non silencieux 657 → 741 callbacks ; aucune perte RTP déclarée dans les statistiques audio/vidéo.
- Dernier relevé à 06:21:47 UTC : sortie FFmpeg ~2 min 34 s, ~30 fps, vitesse 1,01×, débit moyen ~1,78 Mbit/s, aucun échec/exit FFmpeg ; buffers audio/vidéo nuls au relevé. Le flux contient des images dupliquées ; la cadence d'images source et le jitter doivent encore être qualifiés sur mobile et réseau distant.
- Ressources ponctuelles pendant la session caméra : relais ~15,5 % d'un cœur / ~70 Mo RSS ; FFmpeg ~20,4 % / ~30 Mo RSS. Ce sont des mesures sur le Mac, pas un dimensionnement de serveur.
- L'API TURN renvoie encore 404 et des erreurs ICE 701 existent sur des candidats auxiliaires. Elles n'empêchent pas le chemin local direct sélectionné ; aucune allocation TURN opérationnelle hors LAN n'est démontrée.
- Artifacts : `/tmp/vuvio-instagram-session-stats.json` et `/tmp/vuvio-instagram-session-stats-final.json`. Réception Instagram fondée sur confirmation du propriétaire ; aucune capture audio/vidéo de la plateforme effectuée par l'agent. Latence de bout en bout Instagram non mesurée.

**Restant :** lecture spectateur Vuvio HLS et Instagram externe, test mobile et autre réseau, test de durée prolongée, panne isolée d'un output et du relais dans le parcours produit. Le défaut existant de couplage entre sélection d'outputs et ingestion n'est pas corrigé. YouTube reste reporté à la demande du propriétaire.

**Recommandation après cette preuve :** conserver le convertisseur existant et la redistribution Cloudflare ; aucun second relais nécessaire pour Instagram. Évaluer ensuite un seul hôte avec réseau ICE adapté, plutôt que poursuivre les déploiements Cloud Run inchangés. La migration doit traiter authentification, capacité, TURN éventuel et isolation du Live principal avant mise en production. Aucun hôte provisionné, secret de production modifié ou nouveau service déployé. Les coûts de livraison Cloudflare existants et la machine/connexion locale s'appliquent ; coût d'hébergement final non engagé.

## Multistream — validation locale du 22 octobre 2026

**Ordre actualisé à la demande du propriétaire : Instagram en premier ; YouTube reporté.** Le banc RTMPS existant accepte la destination Instagram via `TEST_DEST_FILE=/tmp/vuvio-instagram-test.json`, avec `{"url":"rtmps://…","streamKey":"…"}`. Attendre la nouvelle session Live Producer et le fichier privé du propriétaire ; contrôler d'abord image et son dans la prévisualisation, sans lancement public automatique. La création de l'output Cloudflare sera un test distinct après réception directe confirmée. Aucun envoi Instagram effectué à ce stade.

**Approche autorisée : tester localement le relais existant avec YouTube, sans modifier l'architecture du Live principal, les secrets de production ou les services déployés. Validation YouTube en attente des informations du compte de test.**

### Environnement et périmètre

- Relais lié à `127.0.0.1:8787`, HTTPS avec les certificats de développement existants ; aucune exposition Internet ajoutée.
- Depuis le sous-dossier `relay`, le shell sélectionnait `/usr/local/bin/node`, incompatible avec macOS 10.15.7 (erreur dyld avant démarrage). Runtime local utilisé : `/Users/alexandreranson/.nvm/versions/node/v18.20.8/bin/node`. C'est un environnement de diagnostic, pas un choix de runtime pour l'hébergement final.
- Un lancement depuis la racine nécessitait aussi les chemins explicites des certificats ; sinon le serveur démarrait en HTTP et le client HTTPS échouait avec `wrong version number`. Cause corrigée dans la commande de test.
- ICE local : serveurs explicitement vides, connexion directe UDP sans TURN. Cela évite le fallback public et l'appel à l'API de production pendant ces tests. Aucun secret de production ou fichier `.env` modifié. TURN reste à valider pour des clients hors LAN / réseaux restrictifs ; le succès local ne le prouve pas.
- `WatchPage.jsx` et `webrtcService.js` n'ont pas été modifiés pendant cette validation. Leurs modifications antérieures sont conservées.

### Modifications locales du relais

- `relay/server.js` : diagnostic activable uniquement par `RTMPS_RELAY_DIAGNOSTICS=1`, avec stats de session ICE/RTP, frames, audio non silencieux, buffers et progression FFmpeg. Le mode normal n'expose pas cette route de diagnostic.
- Configuration ICE vide désormais respectée pour un test direct ; callback de collecte ICE ajouté sans écraser les logs existants.
- Assemblage URL RTMP et clé avec un seul séparateur : les URLs YouTube copiées sans slash final ne doivent pas être concaténées directement à la clé.
- Retrait de la cible complète des logs et de la réponse de création ; masquage de la clé dans stderr FFmpeg, y compris lorsque les lignes arrivent en fragments. Retrait du dump audio partagé et systématique.
- `relay/local-test.mjs` : source WebRTC synthétique (image animée et signal 1 kHz), réception RTMPS locale chiffrée avec capture FLV, mesure de latence par marqueur encodé dans l'image, métriques et nettoyage des sessions. Peut utiliser une destination externe via un fichier privé.
- `relay/browser-test.mjs` : profil Chrome temporaire isolé, canvas et oscillateur audio ; réception RTMPS locale et connexion WebRTC témoin partageant les pistes. Aucun périphérique réel capturé ni live Firestore créé.
- Paramètres d'encodage et facteur audio historique non réécrits : fréquence audio vérifiée dans les fichiers décodés. Le comportement avec d'autres formats audio reste à mesurer.

### Résultats réellement obtenus

| Test | Résultat mesuré | Limites |
|------|-----------------|---------|
| Relais d'origine, source Node, RTMP local, 20 s | ICE en 554 ms, frames reçues, sortie H.264 854×480 / AAC 48 kHz stéréo ; son décodé à 1 000 Hz | Synthétique, même machine, RTMP non chiffré |
| Source Node → relais → RTMPS local, 60 s | ICE en 89 ms ; 862 frames reçues au dernier relevé ; 1 738 frames décodées par le récepteur ; aucun paquet perdu dans les relevés ; FFmpeg à ~30 fps / ~1× | Source 15 fps volontairement dupliquée à 30 fps ; aucune caméra mobile |
| Latence locale de la mire | Médiane 333 ms, p95 635 ms, maximum 1 314 ms | Génération → décodage local ; inclut buffers du récepteur de test ; aucune mesure YouTube |
| Audio du test RTMPS de 60 s | Signal décodé à 1 000 Hz aux fenêtres 2 s, 25 s et 50 s | Tonalité, pas voix ; capture audio de 58,65 s, fin/alignement audio-vidéo à approfondir |
| Ressources sur la mire Node | FFmpeg ~16–19 % CPU au début, RSS ~27 Mo ; relais RSS ~68–90 Mo sur les relevés | Une session synthétique ; ni dimensionnement VPS ni capacité simultanée démontrés |
| Chrome 128 → relais → RTMPS local, ~20 s | ICE connecté, image animée, 293 frames reçues au dernier relevé, H.264/AAC reçu ; signal décodé à 1 000 Hz aux fenêtres 2 s, 10 s et 15 s | Chrome desktop headless ; Safari/iOS/Android non testés |
| Arrêt de la session relais avec connexion témoin | La connexion témoin reste connectée : 305 → 378 frames décodées, son RMS ~0,143 avant/après ; pistes source toujours live | Test isolé ; ne valide pas le parcours produit Vuvio |
| YouTube | Non exécuté : URL RTMPS, clé et lien du live de test demandés au propriétaire | Aucun succès de réception plateforme annoncé |
| Live Vuvio normal pendant panne du relais | Non rejoué de bout en bout | Le défaut existant « output sélectionné → contourne WHIP » reste ouvert ; aucune garantie produit nouvelle |

Les sorties RTMP locales se terminent avec une fermeture réseau lors de la suppression de session. Le code FFmpeg 255 après SIGTERM ne doit pas être confondu avec une panne en cours de diffusion ; les captures restent décodables. La finalisation/alignement exact des fins de flux n'est pas encore qualifié.

Artifacts locaux : `/tmp/vuvio-relay-local.json`, `/tmp/vuvio-relay-local.flv`, `/tmp/vuvio-relay-browser.json`, `/tmp/vuvio-relay-browser.flv`. Les rapports distinguent explicitement la réception plateforme non vérifiée.

### Reprise des tests

Depuis la racine du projet, démarrer le relais local avec le runtime compatible :

```bash
RTMPS_RELAY_HOST=127.0.0.1 RTMPS_RELAY_DIAGNOSTICS=1 \
RTMPS_RELAY_CERT=certs/cert.pem RTMPS_RELAY_KEY=certs/key.pem \
FFMPEG_PATH=/usr/local/bin/ffmpeg \
/Users/alexandreranson/.nvm/versions/node/v18.20.8/bin/node relay/server.js
```

Dans un autre terminal, en conservant ce runtime Node :

```bash
TEST_TRUST_LOCAL_CERT=1 TEST_SECONDS=60 node relay/local-test.mjs
node relay/browser-test.mjs
```

Pour YouTube : créer un live privé/non répertorié, démarrage automatique désactivé. Le propriétaire place localement l'URL RTMPS et la clé dans `/tmp/vuvio-youtube-test.json` (`{"url":"rtmps://…/live2","streamKey":"…"}`), protège ce fichier avec `chmod 600` et fournit le lien du live. Ne jamais committer la clé. L'envoi se fera ensuite avec :

```bash
TEST_TRUST_LOCAL_CERT=1 TEST_SECONDS=120 \
TEST_DEST_FILE=/tmp/vuvio-youtube-test.json \
TEST_OUTPUT=/tmp/vuvio-relay-youtube node relay/local-test.mjs
```

Cette commande transmet directement à YouTube pour isoler la chaîne WebRTC → RTMPS ; elle ne valide pas encore la redistribution par les outputs Cloudflare. Contrôler ensuite l'image et le son dans YouTube Studio puis dans le lecteur spectateur. Une progression FFmpeg seule ne valide pas YouTube. Ne poursuivre vers Cloudflare/Instagram qu'après identification de toute erreur constatée.

**Coûts / décision d'hébergement :** tests locaux sans nouvel abonnement, hors machine et connexion existantes. Le test direct YouTube ne traverse pas Cloudflare. Aucun coût d'un hôte ou du TURN privé n'a été engagé. Le succès local prouve le fonctionnement du convertisseur sur ce Mac ; aucune recommandation définitive d'achat/VPS avant réception réelle YouTube, validation mobile et mesure d'une source représentative.

## Multistream — audit du 22 octobre 2026

**État : phases A/B documentées ; correction de l'ingestion et migration non engagées, approche à confirmer. Aucune réception réelle YouTube/Instagram validée.** Cet audit remplace les hypothèses de la documentation de septembre sur WHIP/HLS et sur l'impossibilité absolue de WebRTC via Cloud Run.

### Déploiement réellement observé

- Build `9fae1f37-ada7-452f-b46d-d5edbcfc3dec` : `SUCCESS`, terminé le 22 octobre à 05:31:52 UTC.
- Image du relais : `sha256:da336e779d951790369132974a4fd6a06a1c0e60bffa56ea452291d24a637d5f`.
- Révision `rtmps-relay-00009-8r4` : Ready à 05:33:18 UTC, 100 % du trafic ; digest conforme au build. FFmpeg configuré à `/usr/bin/ffmpeg`.
- Configuration : 2 vCPU, 2 GiB, min 1 / max 3 instances, concurrence HTTP 160, timeout HTTP 3600 s. Aucun réglage explicite désactivant le throttling CPU observé. Ces réglages ne constituent pas une capacité vidéo mesurée.
- Les anciennes sessions avec `frameCount=0` concernaient les révisions précédentes. La nouvelle révision a uniquement été testée ici avec une sonde ICE sans média.

### Capacités Cloudflare vérifiées

Sources officielles consultées le 22 octobre 2026 : [WebRTC, limitations](https://developers.cloudflare.com/stream/webrtc-beta/#limitations), [simulcast](https://developers.cloudflare.com/stream/stream-live/simulcasting/), [tarification](https://developers.cloudflare.com/stream/pricing/).

- WHIP et WHEP fonctionnent ensemble. L'ingestion WHIP ne fournit actuellement ni HLS/DASH, ni enregistrement, ni redistribution RTMP/SRT. Activer `recording.mode=automatic` ou construire une URL HLS ne change pas ces limitations.
- Une ingestion RTMP/SRT permet la distribution classique et les Live Outputs ; Cloudflare annonce jusqu'à 50 destinations simultanées par input. Les outputs peuvent être activés/désactivés pendant le live.
- La documentation WebRTC actuelle annonce des milliers de spectateurs WHEP, contrairement à l'ancienne limite de 1 conservée dans `AGENTS.md`. Ne pas réactiver WHEP sur cette seule base : le player Vuvio doit faire l'objet d'une validation séparée.
- Conclusion : pour un navigateur mobile conservant Cloudflare, le chemin HLS et les Live Outputs, une conversion vers RTMPS/SRT reste nécessaire. Elle n'impose ni ce relais précis, ni Cloud Run, ni un relais par destination.

### Diagnostic ICE et médias

Sonde exécutée vers la révision active, session `aa407f78-f74b-47a1-a360-dd17b0e81f24`, entre 05:51:14 et 05:51:35 UTC. Aucun périphérique capturé, aucun média généré, cible RTMPS fictive `example.invalid`, aucun input/output Cloudflare créé. Session supprimée, HTTP 200 et fermeture confirmée dans les logs.

- Client Node avec la bibliothèque wrtc déjà installée, STUN Google et TURN public OpenRelay de secours (TCP/TLS 443). Ce test n'utilise pas les credentials Metered privés et ne valide pas un navigateur mobile.
- Offer : candidats `host` et `srflx`, aucun `relay` ; erreurs locales 701. Answer Cloud Run : candidats `host` uniquement, aucun `srflx` ni `relay` dans le SDP transmis.
- `POST /sessions` HTTP 200 ; à 12 s après application de l'answer : connexion `connecting`, ICE `checking`, aucune paire nominée, aucune réponse STUN aux paires testées. Les compteurs d'octets des paires restent nuls. Cela reproduit un défaut de transport sans dépendre de l'encodeur vidéo, d'Instagram ou des clés RTMP.
- Logs historiques API : `/turn-credentials` HTTP 404 à 05:14:36 et 05:25:39 UTC. La révision API déployée `api-00164-piv` ne présente aucun rattachement `METERED_API_KEY` / `METERED_APP_NAME`, alors que le code local les prévoit. Le handler local renvoie 404 si ces valeurs manquent ; le body historique n'a pas été conservé. Un appel sans authentification pendant l'audit renvoie 401, ce qui confirme que la route existe actuellement, sans valider ses credentials.
- Le frontend utilise silencieusement OpenRelay si l'appel TURN échoue ou dépasse 1,2 s. `hasTurn=true` prouve seulement la présence d'URLs, pas une allocation TURN réussie. Le relais reçoit la configuration ICE envoyée par le navigateur.
- Cloud Run services expose l'entrée HTTP/gRPC, pas les sockets ICE arbitraires du conteneur. STUN seul ne suffit pas à rendre ce conteneur joignable. Un chemin TURN sortant fonctionnel pourrait permettre WebRTC ; le qualifier d'impossible dans tous les cas serait excessif. Sources : [contrat Cloud Run](https://docs.cloud.google.com/run/docs/container-contract), [réseau sortant TCP/UDP](https://docs.cloud.google.com/run/docs/securing/security), [CPU hors requêtes](https://docs.cloud.google.com/run/docs/configuring/billing-settings).
- Offer et answer sont transmises une seule fois après 5 s / 8 s de collecte ; aucun échange ultérieur des candidats n'existe. Un candidat obtenu après l'envoi est perdu. Le callback de collecte du serveur remplace aussi le logger initial.
- `ontrack` apparaît après application de l'offer, avant connexion ICE. La sonde sans média a aussi produit un callback audio 16 kHz : ces événements ne prouvent pas la réception du micro. Il faut contrôler RTP reçu, frames décodées et signal audio utile.
- FFmpeg démarre dans `RTCVideoSink.onframe`. Sans frame décodée, le transcodage et RTMPS n'ont pas commencé. Les anciens logs sont compatibles avec le blocage réseau reproduit, mais ne permettent pas de reconstituer les candidats ni la paire sélectionnée de chaque ancienne session.

### Défauts à corriger après confirmation

- `WatchPage.jsx` ignore WHIP lorsqu'un output existe, puis tente le relais sans fallback WHIP après échec. Une destination externe peut donc supprimer le chemin d'ingestion principal.
- `createLiveInputHandler.ts` renvoie `status: 'live'` après création API ; le frontend reprend cet état sans preuve de réception externe.
- `startWhipConnection` annonce la connexion après `setRemoteDescription`, sans attendre ICE/DTLS ni contrôler les médias. L'indicateur « HLS active » sur le mode WHIP contredit les capacités documentées.
- Le démarrage attend la création des outputs dans la même requête backend. Les destinations doivent être traitées sans empêcher ou retarder indéfiniment le Live principal.
- Après connexion, vérifier aussi le facteur audio `sampleRate * 3`, le démarrage sur présence de piste plutôt que sur premiers échantillons utiles, la contre-pression des pipes et le canvas mobile. Ce sont des risques distincts du défaut ICE ; aucune correction audio n'est validée ici.
- Sessions en mémoire locale avec jusqu'à trois instances : une suppression peut atteindre une autre instance. Aucun mécanisme de routage de session démontré. Aucun timeout serveur avant première frame ; le dump audio partagé et les logs de cible RTMP complète nécessitent également une correction avant exploitation publique.

### Architecture recommandée, à confirmer

Conserver Firebase et Cloudflare. Réutiliser un seul convertisseur WebRTC → H.264/AAC → RTMPS sur un hôte joignable en ICE, puis laisser Cloudflare distribuer HLS, replay et outputs. Valider d'abord le relais local existant ; déplacer ce même composant sur un hôte adapté seulement après preuve audio/vidéo. Aucun service ni abonnement supplémentaire créé pendant cet audit.

| Option | Fiabilité / complexité / maintenance | Latence / mobile / multiplateforme | Coûts et décision |
|--------|-------------------------------------|------------------------------------|------------------|
| WHIP direct → outputs Cloudflare | Très simple mais incompatible avec les capacités actuelles | Navigateur compatible ; redistribution indisponible | Écartée pour le multistream |
| Relais existant sur hôte avec réseau ICE accessible → RTMPS → Cloudflare | Réutilise le code ; entretien d'un seul service, dimensionnement et authentification à prévoir | WebRTC puis transcodage/HLS ; tester Safari/Chrome mobile ; outputs gérés par Cloudflare | Recommandation conditionnelle ; hôte, trafic et TURN éventuel à chiffrer |
| Cloud Run actuel + TURN opérationnel | Possible en principe ; ajoute dépendance TURN, CPU continu et gestion des sessions | Chemin réseau supplémentaire ; navigateurs à tester ; mêmes outputs | Ne pas poursuivre les déploiements à l'aveugle ; vérifier allocation TURN et CPU avant tout nouvel essai |
| Transport navigateur HTTPS/WebSocket vers FFmpeg sur Cloud Run | Évite ICE mais remplace le transport, impose buffers/reconnexion et gestion de session | Latence des fragments ; codecs MediaRecorder/Safari à valider | Alternative de seconde intention ; davantage de développement |
| Encodeur RTMPS externe, par exemple OBS | Simple pour isoler Cloudflare et les plateformes | Bon test de contrôle, ne répond pas au lancement unique depuis le navigateur mobile | Outil de diagnostic, pas architecture produit retenue |

**Conséquence à arbitrer avant migration :** une ingestion RTMPS unique rend le relais critique pour le flux Cloudflare. Une panne d'output doit être isolée par Cloudflare et ne jamais redémarrer l'ingestion. Une panne du relais lui-même est différente : WHIP n'est pas un remplacement transparent pour des spectateurs HLS, car les deux chemins de lecture sont incompatibles actuellement. Conserver strictement WHIP pour le principal et créer une branche externe demanderait un second chemin et/ou une évolution du player : complexité et risque supplémentaires, non engagés.

Coût Cloudflare publié : 1 USD / 1 000 minutes livrées, outputs RTMP/SRT compris ; 5 USD/mois par capacité de 1 000 minutes stockées ; ingestion/encodage inclus. Deux destinations pendant 60 min correspondent à 120 minutes livrées, soit 0,12 USD, hors spectateurs, stockage et infrastructure. Coût exact d'un hôte/TURN et capacité simultanée non mesurés. Le relais Cloud Run existant conserve une instance minimale ; coût réel non audité.

### Validation à effectuer, YouTube en premier

| Étape | Preuve exigée | État de cet audit |
|-------|---------------|------------------|
| Vuvio seul | Image animée et voix sur au moins deux spectateurs distincts, dont mobile et autre réseau ; vérifier HLS réellement disponible | Non rejoué |
| Vuvio + YouTube | Réception image/son dans Live Control Room puis lecture spectateur ; corrélation des compteurs d'ingestion et de sortie | Non exécuté |
| Vuvio + Instagram | Prévisualisation Live Producer puis lecture spectateur image/son, avec URL/clé de session valides | Non exécuté |
| Vuvio + YouTube + Instagram | Réception simultanée sur les trois ; désactiver/casser un output et vérifier que Vuvio et l'autre destination continuent sans redémarrage | Non exécuté |

YouTube : [paramètres d'encodage officiels](https://support.google.com/youtube/answer/2853702), RTMPS conseillé, H.264/AAC appropriés, contrôler débit et GOP. Instagram : documentation Live Producer inaccessible sans authentification / réponse 429 pendant l'audit ; les critères d'éligibilité et paramètres actuels doivent être vérifiés dans le compte cible, sans supposer qu'une clé enregistrée reste valable.

Contrôles exécutés : lectures Cloud Build/Cloud Run/logs, sonde de signalisation/ICE sans média, `node --check relay/server.js` et `node --check src/services/webrtcService.js` réussis. Aucun test réel plateforme ni build de production exécuté : seule la documentation a été modifiée. Aucune refonte, correction runtime ou mise en production effectuée.

## Multistream — composants existants

**Pourquoi :** permet au créateur de broadcaster simultanément sur Vuvio + Instagram/YouTube/RTMP custom. Argument clé pour le lancement — le créateur n'a pas à choisir entre Vuvio et ses canaux existants.

**Ce qui est déployé :**
- `StreamDestinationSheet.jsx` — UI de config Instagram / YouTube / RTMP custom
- `streamDestinationsService.js` — Stream URL sauvegardée en Firestore, Stream Key en mémoire session uniquement (jamais persistée)
- `BottomNav.jsx` — section "Broadcast to" dans le flow Start Live, pill multistream pendant le live
- `WatchPage.jsx` — création des CF Live Outputs au `setupBroadcast`, suppression au `endLive`
- Backend CF (`liveOutputHandlers.ts`) — routes POST/DELETE/GET sur `/cloudflare/live-input/{id}/outputs`

**Ce qui N'est PAS validé :**
- Essais Instagram réalisés : outputs créés mais aucune réception vidéo/audio confirmée. YouTube non validé ; suivre la matrice ci-dessus.
- Instagram génère une nouvelle stream key à chaque live → l'utilisateur doit la ressaisir manuellement à chaque fois (comportement normal, documenté dans l'UI)

**Pour tester :** suivre la matrice de validation ci-dessus, YouTube en premier. La présence d'un output dans Cloudflare et sa suppression ne prouvent pas la réception vidéo/audio.

---

## Tâches ouvertes

| Priorité | Tâche | Contexte |
|----------|-------|---------|
| 🟡 Moyenne | Simplifier la configuration Instagram à un collage par live | URL sauvegardée préremplie, bouton Live Producer, nouvelle clé en mémoire ; décision enregistrée, non implémentée |
| 🔴 Haute | Qualifier la preuve Instagram avant décision d'hébergement | Image et son confirmés dans Live Producer via relais local ; mobile, réseaux distants et isolation produit restants ; YouTube reporté |
| 🔴 Haute | Corriger l'isolation du Live principal et les statuts non vérifiés | Outputs sélectionnés contournent WHIP ; création API affichée « Live » ; HLS annoncé à tort sur WHIP |
| 🔴 Haute | Valider Vuvio, puis YouTube, Instagram, puis les trois | Preuve image/son et défaillance isolée d'un output ; aucun succès plateforme confirmé |
| 🟡 Moyenne | Retirer les console.log `[live-ended]` | Ajoutés pour debug — à supprimer une fois la détection de fin validée |
| 🟡 Moyenne | Refaire les clusters du globe | Repartir par altitude et vérifier les counts après zoom |
| 🟡 Moyenne | GlobeTest2 — tuiles carte au zoom proche | Remplacer la texture raster (pixelisée au zoom) par des tuiles MapLibre en projection globe |
| 🟡 Moyenne | Migration gear localStorage → Firestore | Chemin Firestore préparé, migration non faite |
| 🟡 Moyenne | Interface admin override trust score | Voir et modifier manuellement le tier d'un créateur |
| 🟡 Moyenne | Implémentation modération vidéo (Vision API) | Architecture documentée dans `docs/moderation.md` |
| 🟠 Basse | Extraction i18n — ~200 chaînes hardcodées restantes | EquipmentKit fait. Reste : WatchPage, BottomNav, etc. |
| 🟠 Basse | Tracking affilié équipement (clics/commission) | `affiliateUrl` présent, backend manquant |
| 🟠 Basse | Facebook watermark share | Nécessite backend pour générer l'image OG |

---

## Bugs connus

| ID | Sévérité | Flow | Problème |
|----|----------|------|---------|
| BUG-SAFARI | 🔴 | Viewer | Safari cross-réseau : voit "reconnecting live". Diagnostic : Network tab → `manifest/video.m3u8` |
| BUG-1 | ✅ Fixed | Auth | `setSent(true)` appelé même en cas d'erreur ForgotPassword → déjà corrigé (success path only) |
| BUG-2 | ✅ Fixed | Auth | Google Sign-In mobile : `setGoogleBusy(false)` jamais appelé sur le flow redirect → flag `redirecting` ajouté dans `finally` |
| BUG-3 | ✅ Fixed | Start Live | Permission caméra refusée → `DOMException` non traduite → déjà corrigé (NotAllowedError/PermissionDeniedError catchés) |
| BUG-4 | ✅ Fixed | Watch | HLS + P2P exhaustion → `watchStatus('error')` + message "Stream unavailable. Try again later." affiché |
| BUG-5 | 🟡 | Auth | Validation email vide sans message d'erreur visible (ForgotPassword) |
| BUG-6 | 🟡 | Globe | `expandedClusterId` peut pointer un cluster inexistant après refresh |
| BUG-7 | 🟡 | Start Live | Pas de skeleton pendant vérif autorisation → rendu `null` silencieux |
| BUG-8 | 🟡 | Auth | Signup ignore `returnTo` → redirige vers `/profile` au lieu de la page d'origine |

---

**URL prod :** https://vuvio-bf328.web.app
