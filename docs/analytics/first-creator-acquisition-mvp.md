Status: Current
Read before coding: Audit du parcours d'acquisition des premiers créateurs et plan de la prochaine itération MVP. Phase 3 non autorisée à l'implémentation.

# Premiers créateurs — audit et préparation du MVP

Date : 21 novembre 2026. Périmètre : application MVP principale. Constats établis par lecture du code local ; tests réels Instagram, appareils et production encore nécessaires. Aucun déploiement effectué.

## Parcours visiteur et liens

| Point | État constaté | Preuve / limite |
| --- | --- | --- |
| Regarder sans compte | Disponible pour `/watch?live=ID` : route publique, lecture `activeLives` publique, HLS prioritaire, P2P de secours. | `src/App.jsx`, `firestore.rules`, `src/routes/WatchPage.jsx`. Chat, suivi et autres actions peuvent demander un compte. |
| Ouvrir un live précis | `/live/ID`, `/watch/ID` et `/share/live/ID` conservent l'ID et les paramètres vers `/watch?live=ID&mode=view`. Le propriétaire connecté conserve sa route de diffusion `/live/ID`. Un ID absent ou non démarré affiche un état explicite ; un live terminé affiche l'écran de fin existant. | `src/App.jsx`, `src/routes/LivePage.jsx`, `src/routes/WatchPage.jsx`. Le live demandé reste placé en tête de `liveFeed`. |
| Lien de partage | `getLiveShareUrl()` produit `/share/live/ID`, les partages natifs, WhatsApp, Facebook, X et copie réutilisent cette URL. Un argument `ref` facultatif, borné à 80 caractères alphanumériques, points, tirets et underscores, peut maintenant produire `?ref=slug`. | `src/services/shareService.js`. Aucun créateur pilote n'est encore lié automatiquement à un slug. |
| Aperçu social | La réécriture Firebase `/share/**` appelle `ogMetaHandler`, qui construit titre, description, image 1200×630 et balises Twitter à partir d'un live public. Les paramètres `ref` et UTM valides traversent cette page vers le lecteur. Les métadonnées d'un live marqué privé ou réservé aux abonnés ne sont plus exposées par cette page. | `firebase.json`, `functions/src/og/ogMetaHandler.ts`. `/live/ID` sert le HTML générique Vite aux robots ; diffuser `/share/live/ID?ref=slug` pour avoir l'aperçu dynamique. |
| Instagram, iPhone, Android, desktop | `playsInline`, Safari HLS natif, `hls.js` et partage natif/fallback existent. Le navigateur intégré Instagram et la reprise après ouverture externe n'ont pas été validés sur appareils réels. | `src/routes/WatchPage.jsx`, `src/platform/sharing.js`, `src/platform/deepLinks.js`. Autoplay et comportement des liens peuvent varier selon navigateur. |

Pour les pilotes, utiliser le format `https://vuvio.app/share/live/ID?ref=warren`. `https://vuvio.app/live/ID?ref=warren` est aussi ouvrable par un visiteur, mais n'a pas d'aperçu par live côté robot. Un lien vers un live futur n'a pas encore de page d'attente dédiée garantie. Tester avec un vrai live public, hors session et dans Instagram, avant diffusion aux communautés.

Les liens directs vers un live déclaré `private` ou `followers` montrent « indisponible » au non-propriétaire. Ce contrôle d'interface ne sécurise pas les données : `firestore.rules` autorise toujours la lecture de `activeLives` sans compte, et les flux privés peuvent encore apparaître dans d'autres listes. **Ne pas promettre de confidentialité pour ces modes avant une révision séparée des règles et des parcours concernés.** Les pilotes publics ne sont pas bloqués par ce constat.

## Notifications et installation

| Fonction | État réel |
| --- | --- |
| Live starting soon | La fonction planifiée `remindScheduledStreams` envoie à **l'auteur** des notifications internes à H−60/H−15 ; ce n'est pas un rappel visiteur. |
| Live started | `fanOutCreatorLive` écrit des notifications Firestore aux abonnés optants lors de la création d'un `activeLives`. Le hook `useFollowedCreatorNotifications` montre aussi un toast tant que l'onglet est ouvert. Vérifier le déploiement effectif de la fonction. |
| Live ended | Écran de fin côté Watch et UI de fin côté créateur ; aucun envoi de notification « terminé » vérifié. |
| Remind Me visiteur | `saveUpcomingReminder` écrit dans `localStorage` après un délai simulé ; pas de livraison de rappel, pas d'email, pas de mise à jour d'horaire. Les cartes disent désormais « Save on this device » / « Saved on this device » et utilisent une icône de marque-page : c'est un enregistrement local uniquement. |
| Push / FCM | Le code Capacitor sait demander une permission et recevoir un jeton natif, sans raccordement vérifié à l'envoi serveur. Aucun `firebase/messaging`, jeton FCM web, abonnement Push API ni événement `push` dans `public/sw.js`. Pas de push web opérationnel, y compris PWA iPhone. |
| PWA | Manifest `standalone` et icônes présentes ; service worker enregistré hors plateforme native, cache de coque et navigation. Détection standalone limitée à `authService.shouldUseRedirect`. Aucun bouton d'installation, `beforeinstallprompt` ou aide iPhone. Installation Android/iPhone non testée sur appareil. |

## Analytics existants

Le service d'événements enregistre `page_view`, `session_start`, `sign_up`, `login`, débuts/fins de visionnage, seuils 3/10/30 secondes et durée active. Il utilise des identifiants anonymes en stockage local, une session en stockage de session et capture source/referrer/UTM au début de session. L'administration affiche visiteurs uniques, nouveaux, récurrents, sessions, inscriptions, conversion globale, vues et durée. Les agrégats de site proviennent de `websiteStats` ; les vues de `streamStats`. Sources : `src/services/analytics/`, `functions/src/analytics/`, `src/routes/AnalyticsPage.jsx`.

Ces mesures ne donnent **pas encore** un entonnoir fiable par créateur. `ref` traverse les liens mais n'est pas lié à un identifiant pilote dans les événements, et les agrégats d'inscription ne sont pas ventilés par créateur. Les viewers d'un créateur incluent aussi des découvertes internes ; ils ne sont pas des visiteurs acquis par ses liens. Le calcul actuel « returning » dans le tableau est `uniqueVisitors - newVisitors`, alors que l'agrégateur possède son propre compteur de récurrents : valider la définition avant de publier des chiffres. La mesure de retour à 7 jours n'existe pas dans le tableau.

## Highlights

Le backend contient demande de génération, statut et traitement de highlights à partir des replays ; la page récapitulative possède une bande de highlights. L'onglet Highlights du profil annonce encore « bientôt ». La génération réelle dépend de la disponibilité d'un enregistrement Cloudflare et de sa piste audio ; la chaîne active d'ingest doit être testée avant toute promesse de clip. Le futur partage Instagram peut réutiliser le clip et `shareService` sans reconstruire la génération. Sources : `functions/src/highlights/`, `functions/src/videoProcessing/processVideoAnalysisJob.ts`, `src/components/live-recap/LiveHighlights.jsx`, `src/routes/ProfilePage.jsx`.

## Corrections de la phase 2 initiale

1. Redirection publique des liens directs vers le lecteur avec ID conservé ; les créateurs propriétaires gardent la diffusion.
2. Conservation des paramètres d'acquisition dans les liens web, les liens natifs et le HTML Open Graph. Le paramètre `ref` peut être ajouté explicitement à `getLiveShareUrl`.
3. Pour un lien direct vers un live absent, non démarré ou restreint, message explicite et retour vers Watch ; un live terminé conserve son écran de fin.
4. Upcoming ne prétend plus qu'un programme est en direct uniquement parce que son heure est passée. Image de repli corrigée, texte du marque-page local clarifié. La liste programmée est chargée une fois à l'ouverture ; son actualisation automatique lors du démarrage reste à développer.
5. Les aperçus OG masquent les données des lives signalés privés ou réservés aux abonnés. À cette étape initiale, Cloudflare Stream, Firebase Auth, les règles Firestore et le système analytics n'avaient pas été modifiés. La restriction Public Only ultérieure est documentée dans `docs/backend/live-visibility-security-audit.md`.

## Vérification de cette branche

La branche `fix/creator-acquisition-mvp` a ensuite reçu le `main` du commit `fc8e210`, qui conserve les changements récents de landing et de qualité vidéo. Le worktree expérimental et ses modifications locales n'ont pas été modifiés.

Trois tests Node ciblés (`test/liveLinks.test.mjs`) passent : URL sans et avec `ref`, conservation de `ref` et des UTM dans les liens natifs et récapitulatifs, rejet d'un hôte étranger. `npm run build` et `npm --prefix functions run build` passent dans le worktree isolé avec les dépendances locales existantes. Le build frontend signale seulement des références d'images non résolues et des avertissements de taille/partition des bundles. `git diff --check` passe. Les routes React, l'authentification, HLS et les cartes Upcoming ont été vérifiées dans le code ; aucun navigateur automatisé ou environnement Firebase de test n'était disponible pour une validation de bout en bout.

Restent à tester sur appareils et comptes réels : visiteur Instagram/Safari/Android/desktop, visiteur connecté, propriétaire en diffusion, live terminé, aperçu Meta/WhatsApp/Instagram, autoplay et diffusion multi-spectateur. Un aperçu Instagram ne peut pas être déclaré validé par la seule lecture des balises OG. Les corrections Public Only sont préparées mais non déployées ; les modes privés restent hors MVP jusqu'à une protection Firestore et Cloudflare complète.

## Phase 3 — plan à valider, non implémenté

### 1. Upcoming Lives

Réutiliser la création `streams` planifiée, `ScheduleLiveFlow`, `useScheduledStreams` et la section Upcoming de Watch. Rendre les champs existants cohérents (titre, catégorie, date locale avec fuseau, description distincte) et ajouter une miniature publique à la ressource serveur avec validation de propriété et de taille. Ajouter une page publique du programme, ou un état dédié du lecteur, adressable par URL avant le démarrage. Afficher l'image fixe et l'heure locale ; basculer dans Live Now uniquement quand le statut serveur est effectivement `live`. Prévoir annulation et changement d'horaire sans changer l'ID partagé. Éviter une écoute Firestore par carte ; réutiliser l'API/listener existant.

### 2. Remind Me

Première itération : email transactionnel et export `.ics`/calendrier. Formulaire sans compte, confirmation d'adresse par lien à durée limitée, stockage serveur privé des demandes, opt-in horodaté limité au rappel, anti-abus par IP/adresse et purge après l'événement. N'envoyer le rappel qu'au passage réel en `live`, via tâche idempotente ; changement d'horaire/annulation doit mettre à jour ou annuler les rappels et liens de calendrier. Ne jamais inscrire les emails dans `activeLives` ou un document Firestore public. Séparer consentement marketing du rappel transactionnel. Le bouton local actuel doit être remplacé ou clairement annoncé comme simple marque-page lors de cette étape. Push web en deuxième itération : abonnement serveur, retrait et gestion des permissions ; Android navigateur compatible, iPhone uniquement PWA installée si supportée, avec email/calendrier toujours proposés. Aucun prompt d'installation pendant la lecture.

### 3. Acquisition créateur

Depuis l'administration, attribuer le statut pilote à un UID Firebase et un slug unique immuable, validé côté serveur et non éditable par le client. Générer les liens `/share/live/ID?ref=slug`; enregistrer `ref` d'entrée sur les événements existants avec une règle d'attribution explicite (par exemple premier lien pilote valide de la session, fenêtre bornée). Agréger par pilote : visites uniques attribuées, vues issues des liens, demandes de rappel, inscriptions, conversion et cohorte J+7. Séparer dans les rapports **audience totale des lives** et **visiteurs attribués par lien**. Dédupliquer par identifiant pseudonyme, minimiser la durée de conservation, documenter la base légale/consentement avec le responsable RGPD, permettre refus et suppression ; éviter un identifiant persistant avant le consentement si celui-ci est requis. Réutiliser les événements et `websiteStats`/`streamStats` plutôt que bâtir un deuxième pipeline. Ne pas exposer UID, emails ou événements individuels dans l'administration publique.

### 4. Après le live, PWA et partage

Après validation du noyau, ajouter suivi du créateur, prochain live et une ou deux recommandations à l'écran de fin. Proposer l'installation dans Profile et après une expérience terminée, avec instructions iPhone et détection standalone. Tester la génération des highlights sur un replay réel, puis partager un clip existant avec URL attribuée.

## Coûts et portes de lancement

Coûts supplémentaires probables : lectures/écritures Firestore pour programmes, demandes et agrégats ; exécutions Cloud Functions/Cloud Scheduler ; fournisseur d'email transactionnel et délivrabilité ; stockage des miniatures et clips ; bande passante Cloudflare HLS ; trafic d'analytics et géolocalisation tierce actuelle. Le push web ajoute gestion des abonnements et support, sans être nécessaire au premier pilote. Chiffrage à établir après volume réel des pilotes.

Avant lancement : tester un lien `/share/live/ID?ref=slug` sur iPhone Safari, Instagram intégré, Android Chrome/Instagram et desktop, en navigation privée et connecté ; vérifier aperçu Meta/WhatsApp, accès sans compte, priorité du bon live, son/autoplay après geste, HLS multi-viewer et inscription après visionnage. Tester aussi refus de consentement et validation des événements, puis décider seulement ensuite de la phase 3.
