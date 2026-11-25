# Audit de préparation MVP — Vuvio

Status: Audit de code — validation runtime partielle
Last reviewed: 2026-11-24
Read before coding: Required before prioritizing or changing MVP behavior, auth, streaming, replay, privacy, or Firebase rules.

## Synthèse

Cet audit part de `origin/dev` au commit `9b7ce8b8bf97fa574aafec4ce68a4411c66911d3`, dans un worktree dédié. Il combine lecture des routes/services/règles, inspection des tests présents et tentatives d’exécution locale. Il ne constitue pas une validation de bout en bout : aucun compte de test Firebase/Cloudflare n’a été utilisé et aucune donnée distante n’a été modifiée.

### Décision de lancement

Le code ne permet pas encore de considérer le MVP prêt pour un lancement public sans réserve. Les principaux bloqueurs sont la suppression de compte inopérante, des contrôles de confidentialité qui ne gouvernent pas réellement les données publiques, l’absence de canal opérationnel de modération, des actions de profil qui ne sont pas toutes branchées, et une base de démonstration encore visible dans des parcours utilisateurs. Le chemin de diffusion/replay exige un essai E2E sur un environnement de test avant validation.

### Légende d’état

- **Fonctionnelle et testée** : parcours validé par un test automatisé pertinent ou un E2E documenté.
- **Fonctionnelle mais non testée** : implémentation présente; aucun test pertinent identifié/exécuté.
- **Partiellement fonctionnelle** : chemin principal présent mais persistance, erreur, rôle ou étape manquante.
- **Simulée / mock** : données ou comportement de démonstration.
- **Non implémentée** : aucun traitement effectif identifié.
- **Cassée** : le comportement affiché ne peut pas produire l’action promise.
- **Expérimentale** : POC ou interface de test, non validée pour le parcours MVP.

Les 61 tests signalés par le projet couvrent principalement des utilitaires/services isolés. Leur existence ne valide pas les parcours Firebase, les permissions réelles, le streaming ou les notifications sur appareil.

## Résultats de validation de cet audit

| Contrôle | Résultat | Portée |
|---|---|---|
| Frontend `npm ci` (Node 20.20.2) | Réussi depuis `package-lock.json` | `node_modules` ignoré par Git. |
| Frontend `npm test` (Node 20.20.2) | Échec partiel : **50 réussis / 1 échoué sur 51** | `src/services/analytics/__tests__/analyticsQueue.test.ts` → `should respect max queue size` dépasse le timeout de 5 s; la boucle émet de nombreux warnings. Assertion non supprimée ni contournée. |
| Frontend `npm run build` (Node 20.20.2) | Réussi en 4 min 50 s | Vite 6.4.3; deux assets non résolus (`/intro/pov-piano-dubai.jpg`, `/assets/brand/profil.png`), imports Firebase dynamiques/statique, chunks >500 kB (`react-globe.gl` ~2.1 MB, `index` ~1.44 MB, `maps` ~1.05 MB). |
| Functions `npm ci` (Node 22.23.3) | Réussi depuis `functions/package-lock.json` | `functions/node_modules` ignoré par Git. |
| Functions `npm test` (Node 22.23.3) | Réussi : **10/10** | Compilation des tests incluse; pas de validation Emulator/E2E. |
| Functions `npm run build` (Node 22.23.3) | Réussi | `tsc -p tsconfig.json`. |
| Node fourni par `/usr/local/bin` | Incompatible avec macOS Catalina (`dyld: Symbol not found`, binaire construit pour macOS 13.5) | Node 20.20.2 pour frontend et 22.23.3 pour Functions ont fonctionné via NVM. |
| Recherche des clés React | Aucun warning correspondant observé dans la sortie Vitest; aucun cas confirmé par inspection statique ciblée | Les listes Watch, MobileView, Profile et PrivacySettings inspectées ont une clé. Le warning navigateur antérieurement signalé reste à confirmer sur les parcours courants. |
| Accès Admin Docs | Présent par découverte automatique | `AdminDocsPage.jsx` importe `../../docs/**/*.md`; le build passe, mais l’accès visuel n’a pas été cliqué dans le navigateur. |

**Environnements** : Node 20.20.2 est utilisé ici pour le frontend conformément à `.nvmrc`; `functions/package.json` exige Node 22 pour les Cloud Functions. Ces versions ne sont pas interchangeables. La compatibilité Catalina du binaire Node actuellement sélectionné par défaut reste un problème distinct de la version de Node requise.

## Registre des constats

### A-01 — Suppression de compte : handler serveur existant, interface non reliée

- **Priorité** : P0
- **Fonctionnalité / état** : suppression de compte — **partiellement fonctionnelle**.
- **Fichiers** : `src/routes/SettingsPage.jsx`, `src/services/authService.js`, `firestore.rules`.
- **Attendu** : confirmation irréversible, réauthentification si nécessaire, suppression/désactivation Auth, traitement des données personnelles et confirmation visible.
- **Réel** : le bouton ouvre une confirmation; `handleConfirm` remet `pendingAction` à `null` sans appel de service. Un handler serveur existe déjà dans `functions/src/users/deleteOwnAccount.ts`, importé et routé par `functions/src/index.ts` (`DELETE /api/users/me`). Il vérifie un `auth_time` récent, refuse un live actif, efface les fichiers utilisateur, l’équipement, le profil et le compte Auth. `users/{uid}` interdit le delete client, ce qui est cohérent avec le traitement Admin SDK. Le parcours frontend ne l’appelle pas.
- **Preuve / reproduction** : ouvrir Réglages → Supprimer mon compte → confirmer; la modale se ferme et le compte reste connecté. Côté serveur, inspecter `functions/src/index.ts` lignes 44 et 90, puis `functions/src/users/deleteOwnAccount.ts`. Le handler a été introduit par le commit `2aeed4f8b92a47ef890ac4b749887165bfb20805` et est présent dans `origin/dev`.
- **Correction proposée** : réutiliser le handler et son endpoint; ne pas en créer un second. Brancher confirmation/réauthentification à l’appel bearer-authenticated, afficher les erreurs de conflit et de suppression. Auditer avant activation le périmètre de suppression/conservation, les références aux lives/messages/UGC et les échecs partiels; ajouter tests Functions/Emulator idempotents.
- **Complexité** : M–L (intégration UI M; audit de cascade et durcissement L).

### A-02 — Paramètres de confidentialité non appliqués aux données publiques

- **Priorité** : P0
- **Fonctionnalité / état** : confidentialité du profil — **partiellement fonctionnelle**.
- **Fichiers** : `src/routes/PrivacySettingsPage.jsx`, `src/hooks/useLiveActivityPrivacy.js`, `src/services/profileService.js`, `firestore.rules`.
- **Attendu** : les choix de visibilité déterminent réellement qui peut lire le profil, les abonnements et la présence; leur état reflète la valeur persistée.
- **Réel** : `users/{uid}` est lisible par tous dans Firestore. « Tout le monde » est codé en dur comme sélectionné; « abonnés seulement » est désactivé. « Afficher dans Explore » est désactivé/Coming Soon. Le réglage Globe est local et son application serveur/règles n’est pas démontrée.
- **Preuve / reproduction** : ouvrir Confidentialité; changer « Afficher sur le globe », se reconnecter sur un autre appareil/compte et vérifier la visibilité. Le profil Firestore reste public selon la règle de lecture. Code `PrivacySettingsPage.jsx` lignes 93–113; `firestore.rules` lignes 7–10.
- **Correction proposée** : distinguer données publiques et privées, enregistrer les préférences par UID, filtrer côté serveur/UI et appliquer des règles cohérentes; ne jamais présenter un contrôle désactivé comme une garantie de confidentialité.
- **Complexité** : L.

### A-03 — Mise à jour d’un live trop permissive

- **Priorité** : P0
- **Fonctionnalité / état** : sécurité des sessions live — **risque de sécurité**.
- **Fichiers** : `firestore.rules`, `src/routes/WatchPage.jsx`, services de cycle de vie des lives.
- **Attendu** : le créateur ne peut modifier que les champs permis à chaque état; champs de sécurité, URL de replay, statut et compteurs sont contrôlés par backend.
- **Réel** : `activeLives/{liveId}` autorise le propriétaire à modifier « any field » sans whitelist de champs ni contrôle de transition. Les créations vérifient seulement UID et `status == live`.
- **Preuve / reproduction** : inspection des règles, `firestore.rules` lignes 68–83. Aucun test Emulator des tentatives interdites n’est présent/annoncé ici.
- **Correction proposée** : déplacer les transitions sensibles au backend et limiter les mises à jour client aux champs nécessaires avec validation d’état/format. Garder le document live après fin pour les tâches replay, conformément à l’architecture.
- **Complexité** : L.

### A-04 — Aucun flux de modération exploitable pour les signalements

- **Priorité** : P0
- **Fonctionnalité / état** : signaler un utilisateur / traiter les abus — **partiellement fonctionnelle**.
- **Fichiers** : `src/services/messagingService.js`, `src/routes/ConversationPage.jsx`, `src/components/ReportProblemForm.jsx`, `src/services/reportProblemService.js`, `firestore.rules`, `functions/src/index.ts`.
- **Attendu** : stocker un signalement protégé, accuser réception seulement après acceptation, fournir une file/outillage admin et un statut de traitement.
- **Réel** : `reportUser()` ne fait qu’ajouter `reportedReason` au document de conversation partagé avec l’autre participant. Le formulaire problème prépare un `mailto:`; l’application ne reçoit pas de ticket. Pas de collection/modèle de signalement et de workflow de traitement identifiés dans les règles/route Functions.
- **Preuve / reproduction** : signaler depuis une conversation puis inspecter le document conversation; le formulaire support affiche un lien pour ouvrir l’e-mail et n’envoie rien seul. Voir `messagingService.js` lignes 482–489 et `ReportProblemForm.jsx`.
- **Correction proposée** : endpoint/collection dédiée avec accès restreint, preuve/rate limit, statut, rétention et interface admin; distinguer un e-mail préparé d’un ticket reçu.
- **Complexité** : L.

### A-05 — Une confirmation de suppression ne déclenche aucune action

- **Priorité** : P1
- **Fonctionnalité / état** : bouton de suppression — inclus dans A-01; anomalie de bouton confirmée.
- **Fichiers** : `src/routes/SettingsPage.jsx`.
- **Attendu** : la confirmation appelle un traitement et affiche succès/erreur.
- **Réel** : le handler ferme seulement la modale.
- **Preuve / reproduction** : même reproduction que A-01; `onConfirm={handleConfirm}` aux lignes 185–193.
- **Correction proposée** : relier la confirmation au handler déjà présent A-01; afficher chargement/succès/erreur et ne pas masquer une suppression partielle.
- **Complexité** : M avec A-01.

### A-06 — Rappels spectateur uniquement locaux

- **Priorité** : P1
- **Fonctionnalité / état** : rappels de lives — **partiellement fonctionnelle**.
- **Fichiers** : `src/services/upcomingReminderService.js`, `src/routes/ExplorePage.jsx`, `src/routes/AllUpcomingPage.jsx`, `src/routes/HomePage.jsx`, `src/routes/WatchPage.jsx`, `functions/src/streams/remindScheduledStreams.ts`, `functions/src/index.ts`.
- **Attendu** : un rappel choisi par le spectateur survit aux appareils/session et déclenche une notification au bon moment.
- **Réel** : le bouton spectateur écrit `vuvio-upcoming-reminders` dans `localStorage` et `setTimeout` ne fait que résoudre l’opération après 260 ms. Le scheduler Functions existe, mais traite les streams programmés et notifie leur créateur; il ne consomme pas ces rappels spectateur.
- **Preuve / reproduction** : activer un rappel puis consulter `localStorage`; ouvrir le compte sur un autre appareil ou vider les données navigateur : le rappel disparaît. Scheduler référencé dans `functions/src/index.ts` autour des lignes 182–186.
- **Correction proposée** : stocker le lien UID/live côté Firestore/backend et distribuer la notification selon les préférences/permissions; prévoir désinscription, déduplication et expiration.
- **Complexité** : L.

### A-07 — Les raccourcis du profil personnel « Favoris » et « Notifications » ne naviguent pas

- **Priorité** : P1
- **Fonctionnalité / état** : actions du profil personnel — **cassées pour ces deux boutons**.
- **Fichiers** : `src/routes/ProfilePage.jsx`.
- **Attendu** : ouvrir le contenu favori ou les notifications.
- **Réel** : les deux entrées ont `action: null`; le bouton exécute `action ?? (() => {})`.
- **Preuve / reproduction** : depuis son profil, cliquer sur Favoris et Notifications : aucun changement. Lignes 760–780.
- **Correction proposée** : brancher aux routes fonctionnelles ou retirer/indiquer clairement l’état indisponible.
- **Complexité** : S–M.

### A-08 — Préférences de profil dispersées en local et dans Firestore

- **Priorité** : P1
- **Fonctionnalité / état** : onboarding et préférences — **partiellement fonctionnelle**.
- **Fichiers** : `src/routes/OnboardingPage.jsx`, `src/context/AuthContext.jsx`, `src/services/profileService.js`, `src/routes/PrivacySettingsPage.jsx`, `src/services/followService.js`.
- **Attendu** : préférences et progression associées au compte, cohérentes entre appareils et après réinstallation.
- **Réel** : l’onboarding écrit des préférences dans le profil Firestore (notamment `preferredCategories` / `preferredActivities`), mais les préférences de confidentialité et une partie des abonnements/rappels reposent sur `localStorage`. `AuthContext` fusionne aussi des modifications locales de profil au chargement, sans mécanisme de synchronisation/version visible.
- **Preuve / reproduction** : comparer les clés `vuvio:*` du navigateur et les champs du profil depuis un second appareil; le code `followService.js` n’utilise que le stockage local.
- **Correction proposée** : documenter une source de vérité par préférence, lier au UID, gérer migration et conflits; ne pas considérer la fusion locale comme une sauvegarde distante.
- **Complexité** : M–L.

### A-09 — Découverte et recherche mélangent contenu réel et contenu de démonstration

- **Priorité** : P1
- **Fonctionnalité / état** : Watch/Explore/recherche — **partiellement fonctionnelle avec mocks**.
- **Fichiers** : `src/services/streamService.js`, `src/data/mockStreams.js`, `src/routes/ExplorePage.jsx`, `src/routes/WatchPage.jsx`, `src/services/messagingService.js`, `src/data/mockMessages.js`, `src/data/creatorProfiles.js`.
- **Attendu** : distinguer sans ambiguïté lives réels, replays, comptes et données de démonstration; la recherche renvoie les comptes disponibles réellement.
- **Réel** : `streamService` retourne des fixtures synchrones (`Promise.resolve(streams)`); Explore/Watch complètent leurs flux avec des streams mock; `messagingService.searchUsers()` fusionne les profils locaux de démonstration avec les profils Firestore. Des compteurs/présences synthétiques existent dans les données fixtures.
- **Preuve / reproduction** : utiliser Explore sans live réel puis chercher dans Messages; comparer les identifiants renvoyés à `users`. Les sources sont `streamService.js` et `searchUsers()`.
- **Correction proposée** : mode démo explicitement signalé et désactivable, badges non ambigus, métriques jamais affichées comme réelles; recherche réelle séparée de la découverte mock.
- **Complexité** : M.

### A-10 — Envoi de message optimiste sans retour d’échec à l’utilisateur

- **Priorité** : P1
- **Fonctionnalité / état** : messagerie — **partiellement fonctionnelle**.
- **Fichiers** : `src/services/messagingService.js`, `src/routes/ConversationPage.jsx`, `firestore.rules`.
- **Attendu** : message confirmé ou état d’échec permettant de réessayer; blocage/signalement effectifs et cohérents entre conversations.
- **Réel** : `sendMessage` ajoute immédiatement un message optimiste; l’échec Firestore est seulement écrit en console puis la fonction retourne le message comme si envoyé. Les états bloqué/signalé résident sur le document conversation partagé, pas sur une relation de blocage globale; les règles autorisent tout participant à mettre à jour tout champ du document conversation.
- **Preuve / reproduction** : envoyer un message sous compte sans permission/réseau puis constater que l’UI peut garder le texte optimiste; code `messagingService.js` autour de l’envoi (console d’erreur puis return). Inspecter `firestore.rules` bloc conversations.
- **Correction proposée** : statut pending/failed, rollback/réessai et règle de mise à jour whitelistée; modèle blocage/signalement par utilisateur et refus des nouveaux messages côté backend/règles.
- **Complexité** : L.

### A-11 — Chat public et questions/réponses non validés contre les abus

- **Priorité** : P1
- **Fonctionnalité / état** : chat live, questions et réactions — **fonctionnelles côté code, non testées en E2E**.
- **Fichiers** : `src/routes/WatchPage.jsx`, `src/routes/StudioPage.jsx`, `firestore.rules`.
- **Attendu** : messages autorisés seulement pour spectateurs admissibles; filtrage/modération, limites de débit, signalement et suppression opérateur.
- **Réel** : règles imposent identité et longueur sur commentaires/questions, mais les collections sont lisibles publiquement; `stars` et les documents P2P watchers ont une création/update sans authentification ou vérification d’UID (watchers commentés « no auth restriction »). Aucun contrôle de débit/modération robuste ne ressort de la règle.
- **Preuve / reproduction** : `firestore.rules` lignes 85–103 et règles comments/questions. Pas de test Emulator d’accès anonyme ou d’abus identifié dans le jeu courant.
- **Correction proposée** : tester/resserrer chaque opération avec Firebase Emulator, ajouter quotas/modération backend et valider effets des règles avant toute modification; préserver le chemin HLS et le move-to-front Watch.
- **Complexité** : L.

### A-12 — Paramètres de confidentialité des messages mal adaptés aux permissions actuelles

- **Priorité** : P1
- **Fonctionnalité / état** : préférences de messagerie — **partiellement fonctionnelles**.
- **Fichiers** : `src/routes/PrivacySettingsPage.jsx`, `src/services/messagingService.js`, `firestore.rules`.
- **Attendu** : « qui peut m’écrire », présence et accusés de lecture appliqués au moment de créer/lire un message.
- **Réel** : les préférences sont sauvegardées dans `localStorage`; les règles de création d’une conversation ne vérifient pas `whoCanMessage` et les règles de messages ne vérifient pas le blocage ou ces préférences. Les flags d’interface ne prouvent donc pas la restriction serveur.
- **Preuve / reproduction** : changer le réglage « personne » et tenter l’envoi depuis un autre compte de test; comparer à `firestore.rules` conversations/messages, qui vérifie participant/expéditeur mais pas le choix du destinataire.
- **Correction proposée** : appliquer les préférences dans une fonction de création/envoi sécurisée et aux règles; définir la politique de messages entrants/existants et tester avec deux comptes de test.
- **Complexité** : L.

### A-13 — Équipement : stockage hybride et association à un live à valider

- **Priorité** : P1
- **Fonctionnalité / état** : équipement — **partiellement fonctionnel, non testé E2E**.
- **Fichiers** : `src/services/equipmentService.js`, `src/routes/EquipmentManagePage.jsx`, `src/routes/ProfileGearPage.jsx`, `src/components/BottomNav.jsx`, `firestore.rules`.
- **Attendu** : ajout/modification/suppression persistants, propriétaire seul, partage public contrôlé, association exacte au live et restauration multi-appareil.
- **Réel** : service hybride local/Firestore avec fallback local si Firestore indisponible; le code indique une migration depuis localStorage. Les règles limitent par `creatorId`, mais aucune validation serveur de schéma/volume n’est visible. L’association au live est un parcours distinct à couvrir sur le schéma final.
- **Preuve / reproduction** : CRUD puis reconnexion sur un autre appareil; contrôler `creatorEquipment` et les IDs d’équipement enregistrés dans `activeLives`. `equipmentService.js` autour de l’initialisation/migration; `firestore.rules` bloc creatorEquipment.
- **Correction proposée** : tests Emulator de CRUD propriétaire/non-propriétaire, stratégie explicite de migration/conflit et validation d’existence/propriété lors de l’association.
- **Complexité** : M.

### A-14 — Récapitulatif/replay inclut des données de démonstration et une fin de live liée à la navigation

- **Priorité** : P1
- **Fonctionnalité / état** : fin, replay, highlights, recap — **partiellement fonctionnels et non testés E2E**; certaines vues sont mock.
- **Fichiers** : `src/routes/LiveRecapPage.jsx`, `src/routes/LiveSummaryPage.jsx`, `src/data/liveRecapMock.js`, `src/components/live-recap/LiveRecapHero.jsx`, `functions/src/highlights/*`, règles `activeLives`.
- **Attendu** : fin idempotente indépendante de la navigation, replay lié au bon live, statistiques/chat réels ou marqués manquants, highlights publiés après traitement.
- **Réel** : le recap utilise un fallback `liveRecapMock`; son hero affiche un contenu et une durée hardcodés. Un effet de nettoyage dans `LiveRecapPage` auto-termine le live au démontage/navigation, ce qui rend le cycle de vie dépendant de la sortie de page. Les erreurs du poll replay sont ignorées et la vue Summary n’affiche la vidéo que si `playbackUrl` est déjà présent, alors que le recap écoute `replayUrl`. La génération highlights contient encore un TODO pour l’assemblage.
- **Preuve / reproduction** : ouvrir un recap sans données réelles; naviguer hors de la page avant fin de traitement; comparer `playbackUrl` et `replayUrl`. Voir `LiveRecapPage.jsx` lignes 90–165, `LiveSummaryPage.jsx`, `LiveRecapHero.jsx` et TODO dans `functions/src/highlights/generateHighlight.ts`.
- **Correction proposée** : séparer le mock du parcours utilisateur, utiliser une seule source/état replay et un endpoint de fin idempotent explicite; états pending/failed visibles; vérifier la capacité d’enregistrement Cloudflare en staging.
- **Complexité** : L.
- **Garde-fou** : ne jamais supprimer `activeLives/{id}` dans le flux de fin; le backend de replay en a besoin. Ne pas changer la priorité HLS ni le feed Watch URL-first.

### A-15 — Paramètres de notification et notifications push non validés sur appareil

- **Priorité** : P1
- **Fonctionnalité / état** : notifications et rappels — **partiellement fonctionnelles**.
- **Fichiers** : `src/services/notificationService.js`, `src/platform/notifications.js`, `src/hooks/useStreamReminders.ts`, `functions/src/notifications/*`, `functions/src/index.ts`, `firestore.rules`.
- **Attendu** : permission explicite, token installé/renouvelé, livraison push et navigation vers le live; statut compréhensible si refus/échec.
- **Réel** : notifications Firestore in-app et schedulers backend sont présents; le chemin push Capacitor et la correspondance entre `stream_reminder` / préférences de rappel ne sont pas validés sur appareils. La règle autorise la création par l’utilisateur seulement avec une whitelist limitée; certains payloads serveur contiennent des champs additionnels (ex. `streamTitle`, `minutesBefore`, `label`) et passent via Admin SDK, mais la compatibilité UI/tri doit être testée.
- **Preuve / reproduction** : pas de test d’appareil ou de livraison push réalisé; comparer `remindScheduledStreams.ts`, `notificationService.js` et `firestore.rules` notifications.
- **Correction proposée** : matrice de payloads, tests Functions/règles et appareils iOS/Android; distinguer notification in-app, push et rappel local.
- **Complexité** : M–L.

### A-16 — États de recherche/erreur parfois silencieux

- **Priorité** : P2
- **Fonctionnalité / état** : Explore/recherche, profil créateur, messagerie — **partiellement fonctionnels**.
- **Fichiers** : `src/services/creatorService.js`, `src/services/messagingService.js`, `src/services/notificationService.js`, routes concernées.
- **Attendu** : distinguer « aucun résultat » d’une erreur réseau/permission; proposer réessai.
- **Réel** : `searchCreators` retourne `[]` après erreur, `subscribeNotifications` transforme toute erreur en liste vide et le chargement de profil dans `AuthContext` retombe sur `null`; pour l’utilisateur, une permission ou panne peut ressembler à un état vide.
- **Preuve / reproduction** : provoquer une erreur permission/réseau sur un compte de test; observer l’état vide. Code `creatorService.js`, `notificationService.js`, `AuthContext.jsx`.
- **Correction proposée** : résultats typés `{data,error}`, états loading/empty/error explicites et action de réessai; conserver un fallback seulement s’il est clairement indiqué.
- **Complexité** : M.

### A-17 — Données de partage/SEO peuvent représenter un contenu fictif comme du réel

- **Priorité** : P2
- **Fonctionnalité / état** : partage de live et pages découverte SEO — **partiellement fonctionnels, mock**.
- **Fichiers** : `functions/src/og/ogMetaHandler.ts`, `src/routes/DiscoverCategoryPage.jsx`, `src/utils/seoData.js`, `src/data/mockStreams.js`.
- **Attendu** : un lien de partage vers un live valide doit présenter les métadonnées et l’image de ce live; un contenu inexistant doit être déclaré indisponible.
- **Réel** : le handler OG contient `mockShareLives`; les pages catégories s’alimentent via les fixtures `mockStreams`, avec `uploadDate` statique dans le JSON-LD.
- **Preuve / reproduction** : partager un ID fixture/inconnu et comparer la carte OG à l’ID Firestore; inspecter `mockShareLives` et `getCategoryStreams`.
- **Correction proposée** : différencier ID réel/mock et éviter d’émettre des métadonnées structurées de vidéo récente pour des fixtures.
- **Complexité** : M.

### A-18 — Création/configuration d’un live et diffusion: implémentation présente, non certifiée

- **Priorité** : P1
- **Fonctionnalité / état** : création, préconfiguration, diffusion créateur/spectateur — **fonctionnelle au niveau du code mais non testée E2E sur cette révision**; le chemin multi-diffusion est optionnel.
- **Fichiers** : `src/components/BottomNav.jsx`, `src/routes/WatchPage.jsx`, `src/services/streamDestinationsService.js`, `functions/src/cloudflare/*`, `firestore.rules`.
- **Attendu** : démarrer/arrêter une diffusion réelle, permissions caméra/micro, HLS multi-viewers, erreurs Cloudflare intelligibles, aucune fuite de stream key.
- **Réel** : code WHIP/Cloudflare et la lecture HLS primaire sont présents; WHEP viewer est intentionnellement désactivé. Le chemin dépend des secrets, domaines, SDK appareil et règles distantes, non fournis au worktree. La configuration destination interdit la propriété `streamKey` dans les règles et le service indique ne jamais stocker les clés.
- **Preuve / reproduction** : la source confirme les chemins mais pas la disponibilité des secrets ou l’ingest/replay réel. Exiger test staging avec deux viewers et contrôle des journaux/règles.
- **Correction proposée** : exécuter une matrice E2E staging (permissions, perte réseau, reconnect, deux viewers HLS, end/replay, destination secondaire); traiter séparément les erreurs de permissions et de service.
- **Complexité** : L.
- **Garde-fou** : ne pas activer SFU/PAUSE-RESUME comme chemin de production; conserver HLS primaire et le move-to-front de `liveId`.

### A-19 — POC SFU et Pause/Resume hors périmètre de validation MVP

- **Priorité** : P2
- **Fonctionnalité / état** : realtime SFU et pause — **expérimentaux**.
- **Fichiers** : `src/routes/AdminRealtimeTestPage.jsx`, `functions/src/realtimeTest/realtimeSFUService.ts`, `src/components/live/PauseLiveSheet.jsx`, parties dédiées de `WatchPage.jsx`.
- **Attendu** : les parcours expérimentaux restent isolés et ne remplacent pas la diffusion MVP validée.
- **Réel** : composants/services et route de test existent; aucune validation de charge/interop production n’est apportée par les tests présents. Cet audit n’a activé ni modifié ces fonctions.
- **Preuve / reproduction** : inspection des routes et imports; confirmer avant lancement que l’UI publique n’expose aucune action Pause/Resume qui persiste un état serveur non testé.
- **Correction proposée** : garder derrière route/flag admin, ajouter tests dédiés et retirer toute affordance ambiguë du flux MVP tant que validée.
- **Complexité** : M.

### A-20 — Avertissement React « missing key » non reproduit avec l’environnement disponible

- **Priorité** : P2 (à confirmer)
- **Fonctionnalité / état** : rendu des listes — **non concluante**.
- **Fichiers examinés** : `src/routes/WatchPage.jsx`, `src/routes/ProfilePage.jsx`, `src/routes/PrivacySettingsPage.jsx`, `src/components/desktop/MobileView.jsx` et recherches des rendus `.map()` dans `src/`.
- **Attendu** : aucune erreur console React « Each child in a list should have a unique key » sur les parcours courants.
- **Réel** : les listes explicitement examinées possèdent des clés (`live.id`, `item.id`, valeur stable). Le warning signalé antérieurement n’a pas été reproduit; exécution Vitest/build impossible ici faute de Vite/Vitest/TypeScript installés. Les recherches textuelles ne garantissent pas un audit AST exhaustif de tous les composants.
- **Preuve / reproduction** : statique; tenter `npm test` et `npm run build` a renvoyé les binaires manquants. À refaire avec dépendances installées, console navigateur ouverte et parcours Watch/Explore/Profile/Admin.
- **Correction proposée** : relever la stack React complète, identifier la liste à l’origine, choisir une clé stable et ajouter une assertion/rendu de test si le warning est reproductible. Ne pas ajouter d’index comme clé par défaut.
- **Complexité** : S une fois la source localisée.

## Couverture par domaine

| Domaine | État à ce stade | Niveau de preuve / réserve |
|---|---|---|
| Auth inscription / connexion / Google popup / reset mot de passe | **Fonctionnelle mais non testée E2E** | Firebase Auth est intégré; aucune validation de configuration, domaines autorisés, email vérifié, réauthentification ni compte réel de test. |
| Suppression de compte | **Partiellement fonctionnelle** | Handler serveur `deleteOwnAccount.ts` et route API déjà présents; interface non branchée (A-01). |
| Onboarding | **Partiellement fonctionnel** | Profil/préférences écrits, mais persistance multi-appareil et reprise après interruption à tester. |
| Profil personnel / public | **Partiellement fonctionnel** | Profil public lu depuis Firestore; overrides localStorage et raccourcis no-op (A-07/A-08). Compteurs/sections d’exemple à distinguer des valeurs réelles. |
| Equipment CRUD | **Partiellement fonctionnel** | Stockage hybride et règles propriétaire; migration/association/reconnexion à valider (A-13). |
| Watch / Explore / recherche / filtres | **Partiellement fonctionnels + mock** | Sources mixtes; recherche messages fusionne mock et réel (A-09). Pas de mesure de qualité/latence Firestore. |
| Création et configuration live | **Fonctionnelle mais non testée E2E** | Le code existe; secrets/services/device restent non validés (A-18). |
| Créateur pendant le live | **Partiellement fonctionnel / non testé E2E** | Contrôles, questions, chat et destinations présents; sécurité de cycle de vie/règles à corriger/valider (A-03/A-11). |
| Spectateur, chat, questions, réactions, follow | **Partiellement fonctionnels** | Écriture Firestore présente, contraintes d’accès/modération insuffisantes; follow local et distant coexistent (A-08/A-11). |
| Fin/replay/highlights/recap | **Partiellement fonctionnels + fallback mock** | Dépendance Cloudflare et données réelles à valider (A-14). |
| Partage | **Partiellement fonctionnel** | Partage Web/native présent; métadonnées OG incluent fixtures (A-17). Pas de validation des applis sociales externes. |
| Notifications / rappel / messagerie | **Partiellement fonctionnels** | In-app/backend présents; rappel spectateur local et push non vérifié (A-06/A-15); envoi et erreurs messagerie (A-10). |
| Confidentialité / Firebase | **Risque P0** | Profil public, update live large, conversation/champs génériques et watcher non authentifié (A-02/A-03/A-10/A-11/A-12). Pas de tests Emulator observés pour chaque rôle. |
| Signalement / blocage | **Partiellement fonctionnels / traitement non implémenté** | Le report écrit dans conversation; blocage conversationnel; pas de case management (A-04/A-10). |
| Administration / erreurs | **Partiellement fonctionnels** | Admin Docs découvre le rapport; certaines fonctions admin lisent Firestore. Les erreurs de recherche/notifications/profil peuvent se transformer en résultats vides (A-16). |
| SFU / pause-resume | **Expérimentaux** | Hors validation MVP (A-19). |

## Ordre de traitement recommandé

1. **P0 sécurité et confiance** : A-01 suppression, A-02 confidentialité, A-03 règles `activeLives`, A-04 canal de modération.
2. **P1 fiabilité des parcours** : A-06 rappels spectateur, A-07 boutons profil, A-08 préférence/source de vérité, A-10 messagerie, A-11 chat/règles, A-12 paramètres messages, A-14 replay/recap, A-15 notifications, A-18 certification E2E.
3. **P1/P2 produit** : A-09 marquage mocks, A-13 équipement multi-appareil, A-16 erreurs visibles, A-17 partage réel.
4. **Avant clôture de stabilité** : exécuter A-20 sous navigateur et tests automatisés; garder A-19 isolé.

## Plan de correction P0 — reprise de la prochaine session

Ce plan est préparatoire : aucune réimplémentation ni changement Firebase n’a été effectué par l’audit. Toujours travailler dans un worktree dédié depuis le dernier `origin/dev`, re-vérifier le remote, les stashes et les autres worktrees avant les changements.

### P0.1 — Brancher et fiabiliser la suppression de compte

**Inventaire existant**

- Handler déjà intégré à `origin/dev` : `functions/src/users/deleteOwnAccount.ts`, route `DELETE /api/users/me` dans `functions/src/index.ts`, commit d’origine `2aeed4f8b92a47ef890ac4b749887165bfb20805`.
- L’interface `src/routes/SettingsPage.jsx` ne fait que fermer la modale. Le contrôle Firestore `allow delete: if false` sur `users/{uid}` n’empêche pas l’Admin SDK et ne doit pas être assoupli.
- Le handler vérifie une authentification récente (10 min), bloque si un live est actif, nettoie le préfixe Storage, `creatorEquipment`, le profil et le compte Auth; il supprime la réservation username si elle correspond.

**Étapes**

1. Lire le handler, `authenticateUser`, format d’erreur API, wrapper frontend d’appels Functions et le commit d’origine avant toute modification; ne pas dupliquer le handler.
2. Définir avec la politique produit les données conservées/supprimées et les dépendances (lives/replays, commentaires/questions, messages/conversations, notifications, gear, username, Storage). Ne supprimer ni replay ni preuve requise avant cette décision.
3. Brancher le bouton Settings au endpoint avec token Firebase, état pending, reauthentification lorsque `auth_time` dépasse 10 min, erreur lisible, puis déconnexion/nettoyage local après succès uniquement.
4. Tester au Functions unit/emulator : non-auth, auth expirée, live actif, compte sans fichiers, Storage en erreur, username déjà réattribué, appel répété, nettoyage incomplet. Vérifier le refus des opérations post-suppression.

**Critère d’acceptation** : une confirmation efface réellement le compte selon la politique approuvée; erreurs récupérables restent visibles, aucun faux succès, endpoint idempotent ou échec partiel documenté/rejouable.

### P0.2 — Appliquer les paramètres de confidentialité aux lectures réelles

**Inventaire existant**

- `PrivacySettingsPage.jsx` conserve certains choix en `localStorage`; les réglages d’activité passent par `useLiveActivityPrivacy`; `showInExplore` et visibilité followers-only sont désactivés.
- `users/{uid}` est publiquement lisible. Des champs publics et privés sont réunis dans le même document. Aucun changement retrouvé dans les branches/worktrees consultés qui applique la visibilité aux règles Firestore.

**Étapes**

1. Cartographier chaque réglage UI vers une donnée et ses lecteurs: visibilité profil, Explore/globe, abonnements, statut live/visionnage, messages.
2. Définir la sémantique et les valeurs par défaut; distinguer champs publics et privés. Garder le comportement public annoncé tant qu’une migration/règle cohérente n’est pas prête.
3. Persister les préférences au compte, migrer proprement le stockage local et rendre l’UI reflétant la valeur effective (désactivé/Coming Soon si non supporté).
4. Adapter requêtes/Cloud Functions et règles; les règles Firestore ne peuvent pas filtrer champ par champ dans un document public, donc envisager une séparation de documents plutôt qu’une promesse d’accès conditionnel fictive.
5. Tester Emulator avec propriétaire, follower, utilisateur non-follow et anonyme, plus deux appareils; vérifier les index et listes Explore/globe.

**Critère d’acceptation** : chaque choix a un effet observable et cohérent après reconnexion; aucune donnée supposée privée n’est accessible par lecture directe Firestore/endpoint; les boutons désactivés ne prétendent pas appliquer une préférence.

### P0.3 — Restreindre les écritures Firestore `activeLives`

**Inventaire existant**

- `firestore.rules` permet au propriétaire de modifier tout champ d’un live (`resource.data.creatorUid == request.auth.uid`). Création ne vérifie que `creatorUid` et `status == live`.
- `fix/creator-acquisition-mvp` contient une whitelist `approvedLiveFields` pour le chemin Pause/Resume expérimental. Elle est spécifique à sa branche et ne constitue pas une politique complète des champs de production; ne pas l’importer telle quelle sans validation.
- Exigences invariantes du projet : document live conservé après fin pour replay; HLS viewer primaire; live URL placé en tête du feed; ne pas activer SFU/Pause-Resume involontairement.

**Étapes**

1. Construire une matrice opération/champs pour create, heartbeat, start, end, replay webhook, compteurs, metadata, commentaires et champs Pause/Resume expérimentaux.
2. Identifier les écritures client directes et celles faites par Admin SDK; déplacer au backend les transitions protégées et définir une whitelist par transition.
3. Refuser les champs de rôle/owner, `cloudflareLiveInputId`, `replayUrl`, statut et métriques dans les updates client hors opérations autorisées; valider types, bornes et ancien/nouvel état.
4. Ajouter tests Firebase Emulator positifs/négatifs par rôle, y compris accès anonyme aux champs publics, viewers et autre créateur. Vérifier que le replay peut encore lire le document terminé.
5. Différer séparément les champs Pause/Resume tant que l’expérience n’est pas validée; ne pas fusionner le POC SFU dans ce durcissement.

**Critère d’acceptation** : seules les transitions nécessaires fonctionnent; un créateur ne peut pas modifier les champs serveur protégés; les règles sont vérifiées Emulator et le chemin HLS/replay conserve ses invariants.

### P0.4 — Créer un pipeline de signalement et de modération exploitable

**Inventaire existant**

- `messagingService.reportUser()` écrit seulement `reportedReason` sur la conversation partagée; blocage est lui aussi un champ de conversation.
- Le formulaire de problème prépare un e-mail `mailto:`; il ne crée pas de ticket.
- `AdminDocsPage.jsx` contient déjà un panneau « Moderation », mais c’est une vue des trust scores/tier utilisateurs, pas une file de signalements ni un workflow d’action.
- `docs/moderation.md` décrit l’orientation SafeSearch/modération vidéo et le trust score; plusieurs étapes vidéo et la collection d’audit y restent marquées à faire. `updateTrustScore.ts` consomme un `reportCount`, mais le document indique que ce compteur est réservé / sans pipeline opérationnel.
- Analytics connaît l’événement `stream_reported`, ce qui ne constitue ni stockage de preuve ni traitement de cas.

**Étapes**

1. Définir les types de cible (user/live/comment/question/message), motifs, urgence, politique anti-abus, rétention, confidentialité, SLA et rôles d’accès admin.
2. Créer un seul endpoint/collection canonique (pas un second report handler) avec identité vérifiée, payload whitelisté, rate limiting, déduplication et identifiants de cible; garder le reporter privé et ne pas exposer le rapport à l’accusé.
3. Ajouter états de traitement/audit (nouveau, en revue, action, clos), attribution admin et actions modérées explicitement autorisées; relier le trust score uniquement après stockage validé et éviter suspension automatique sur signalement brut.
4. Réutiliser le panneau AdminDocs ou l’admin existant en ajoutant une vraie file séparée des scores; protéger chaque requête côté serveur et règles.
5. Brancher les boutons Report dans Conversation/Watch/Profile et le formulaire problème sur le pipeline; ne plus annoncer réception quand le mail n’est pas envoyé.
6. Tester permissions/abus/rate limit, confidentialité reporter, actions admin et erreurs sur Emulator; faire une répétition staging avec cas fictifs uniquement.

**Critère d’acceptation** : chaque signalement accepté produit un dossier admin traçable; un échec n’affiche pas de succès; seuls les admins autorisés lisent/traitent le dossier; le blocage empêche réellement nouveaux messages/interactions selon la politique choisie.

### Recherche inter-branches/worktrees effectuée

| Candidat | Localisation / preuve | Conclusion pour la réimplémentation |
|---|---|---|
| Suppression de compte | `functions/src/users/deleteOwnAccount.ts`, intégré dans `origin/dev` via `index.ts`; commit `2aeed4f8…` | Réutiliser et compléter le handler; le défaut P0 est d’abord le câblage UI et la couverture de cascade/erreurs, pas l’absence d’endpoint. |
| Suppression de compte dans stash | `stash@{3}` (`codex-account-fixes-dev-transfer`) contient fonctions/auth/profil/gear, mais aucun fichier `deleteOwnAccount.ts` propre dans le stash inspecté | Ne pas appliquer le stash; le handler versionné est la source existante. |
| Modération admin | Panneau `ModerationPanel` dans `src/routes/AdminDocsPage.jsx` aux worktrees `/private/tmp/vuvio-dev-synced` et `/private/tmp/vuvio-audit-fixes` | Réutiliser la page comme point d’entrée possible; le panneau actuel liste les trust tiers, il n’est pas une file de rapports. |
| Modération documentée | `docs/moderation.md` présent sur `origin/dev` et branche release/main | C’est un plan SafeSearch + trust score, pas un système de signalement livré; respecter les cases « À faire ». |
| Reporting actuel | `src/services/messagingService.js`, `ConversationPage.jsx`; analytics `stream_reported` | Ne pas confondre champ conversation/événement analytics avec report workflow. Aucun handler/collection de reports opérationnel retrouvé dans Functions/règles. |
| Confidentialité | worktrees consultés gardent la préférence locale et les contrôles Coming Soon; aucune implémentation distante trouvée | Il faut concevoir la source de vérité et la forme des documents avant de coder; ne pas copier un réglage local en prétendant renforcer les règles. |
| Règles lives | branche `fix/creator-acquisition-mvp` inclut whitelist `approvedLiveFields` liée à pause/resume | Piste limitée à étudier; n’est ni une implémentation complète ni à intégrer automatiquement au MVP stable. |

Worktrees consultés en lecture seule : `vuvio-mvp-audit`, `vuvio-dev-synced`, `vuvio-dev-reconcile`, `vuvio-audit-fixes`, `vuvio-pr2`, `vuvio-release-financial` et `Vuvio-Lab`. Aucun de leurs fichiers n’a été modifié.

## Plan minimal de validation avant lancement

1. Installer les dépendances verrouillées dans un environnement Node 20.20.2 pour frontend et Node 22 pour Functions; exécuter tous les tests et builds sans modifier ni supprimer d’assertion.
2. Configurer Firebase Emulator et deux comptes de test; tester les règles comme propriétaire, autre utilisateur et anonyme (profils, lives, commentaires, questions, watchers, messages, équipement, notifications, signalements).
3. Tester signup/login/reset/suppression et onboarding sur deux appareils/session; confirmer l’effacement/portabilité et l’état d’erreur.
4. Tester une diffusion staging de bout en bout avec un créateur et au moins deux spectateurs HLS, perte réseau, fin, polling replay et génération highlight. Aucun test destructif production.
5. Vérifier signalement/blocage et une livraison de notifications sur iOS et Android; contrôler le contenu visible en UI, les notifications Firestore et l’admin.
6. Capturer console navigateur Watch/Explore/Profile/Equipment/Privacy/Recap et isoler le warning React, s’il est encore présent.

## Limites de cet audit

- Analyse conduite sur code et configurations de `origin/dev`, pas sur environnement de préproduction doté de secrets/services.
- Impossible de prétendre que les parcours affichés comme fonctionnels ont été validés sans E2E Firebase/Cloudflare. Les tests unitaires existants ne couvrent pas cette preuve.
- Tests frontend partiellement rouges (un timeout Vitest); build frontend réussi avec avertissements ci-dessus. Tests/build Functions réussis. Le rapport ne vaut pas approbation de release.
- Aucun changement de comportement, règle Firebase, route streaming/globe ou configuration de déploiement n’a été fait.
- Les exigences de confidentialité, de suppression et de modération doivent être confirmées avec la politique de conservation applicable avant implémentation.
