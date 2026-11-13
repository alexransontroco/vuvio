# VUVIO — Document de référence complet

**Version :** 1.0 — 22 septembre 2026  
**Objet :** vision, produit, état déclaré, architecture, modèle économique, lancement et décisions.  
**Statut :** document de travail ; les caractéristiques du dépôt et du déploiement n'ont **pas** été auditées pour cette édition.  
**Source principale :** `vuvio-complete-overview.md` fourni pour cette refonte.  
**Public :** fondateurs, équipe produit et technique, collaborateurs et partenaires selon les sections partagées.

> **Règle de lecture** — Ce document distingue ce qui est **décrit par le document source** de ce qui est **proposé** pour le produit, le lancement ou l'organisation. Les mentions « décrit » ne constituent pas une vérification du code ou de la production. Aucune fonctionnalité ne doit être considérée comme opérationnelle uniquement parce qu'elle figure ici.

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Vision, promesse et positionnement](#2-vision-promesse-et-positionnement)
3. [Publics et cas d'usage](#3-publics-et-cas-dusage)
4. [Principes produit et définition du POV](#4-principes-produit-et-définition-du-pov)
5. [Parcours et fonctionnalités](#5-parcours-et-fonctionnalités)
6. [État du projet et niveau de vérification](#6-état-du-projet-et-niveau-de-vérification)
7. [Architecture technique et règles de préservation](#7-architecture-technique-et-règles-de-préservation)
8. [Sécurité, vie privée et modération](#8-sécurité-vie-privée-et-modération)
9. [Monétisation et modèle économique](#9-monétisation-et-modèle-économique)
10. [Acquisition, lancement et communauté](#10-acquisition-lancement-et-communauté)
11. [MVP, critères d'acceptation et roadmap](#11-mvp-critères-dacceptation-et-roadmap)
12. [Mesure, coûts et pilotage](#12-mesure-coûts-et-pilotage)
13. [Décisions à trancher et risques](#13-décisions-à-trancher-et-risques)
14. [Organisation et maintenance documentaire](#14-organisation-et-maintenance-documentaire)
15. [Pitchs et formulations de référence](#15-pitchs-et-formulations-de-référence)
16. [Annexes opérationnelles](#16-annexes-opérationnelles)

---

## 1. Résumé exécutif

**Vuvio** est une application *mobile-first* de live streaming en point de vue subjectif (**POV**). Son idée centrale est de permettre à une personne de découvrir, en direct, ce qu'une autre voit et vit : une sortie à vélo, une journée de pêche, un métier de terrain, une visite de ville, un atelier, une activité sportive ou musicale.

L'expérience cherche à associer la simplicité d'une découverte par swipe à un contexte plus riche : **le point de vue, la personne, le lieu, l'activité, le direct, puis le replay et l'équipement quand ils sont disponibles**.

Vuvio articule trois surfaces de découverte complémentaires :

- **Watch :** entrer immédiatement dans un live et passer au suivant.
- **Explore :** trouver des lives, créateurs ou activités à l'aide de catégories, d'une recherche et de filtres.
- **Globe :** explorer des perspectives situées géographiquement et accéder aux lives depuis la carte vivante du monde.

Le créateur peut partager une activité réelle, retrouver son audience et, selon les fonctionnalités disponibles, programmer des directs, publier ou rendre accessibles des replays et déclarer le matériel utilisé. Le spectateur peut découvrir une expérience et consulter l'équipement associé sans interrompre le live.

**Hypothèse économique de référence :** commencer par l'affiliation sur l'équipement véritablement utilisé, puis étudier les partenariats marques, le sponsoring contextualisé et les outils premium pour créateurs. Ces pistes sont **des hypothèses commerciales, pas des revenus établis**.

**Enjeu prioritaire pour le lancement :** vérifier et rendre fiable le parcours complet « démarrer un live → le découvrir → le regarder à plusieurs → le terminer → retrouver son replay », avec des mécanismes de sécurité et de modération adaptés à une application géolocalisée en direct.

---

## 2. Vision, promesse et positionnement

### 2.1 La vision

Le monde est rempli de moments que l'on ne voit pas : un boulanger commence sa nuit, un guide traverse Kyoto sous la pluie, un marin répare une voile, un cycliste gravit un col, un artisan façonne un objet, un photographe attend la bonne lumière. Le spectateur n'assiste plus seulement à une vidéo ; il entre dans une perspective humaine, depuis un endroit précis, au moment où quelque chose se passe.

> **Promesse de marque :** « Voir le monde en direct, à hauteur humaine. »

> **Formule interne :** Vuvio, une carte vivante des perspectives humaines.

### 2.2 Les trois intuitions fondatrices

1. Une partie du public souhaite découvrir ce que les autres vivent réellement.
2. Le direct devient plus intelligible et plus intéressant lorsqu'il est rattaché à un lieu, une activité et un point de vue.
3. Les objets et outils réellement utilisés par le créateur font partie du contexte de l'expérience.

**À valider :** ces intuitions guident le produit ; elles ne sont pas des résultats d'étude d'usage à ce stade.

### 2.3 Ce que Vuvio cherche à apporter

| Dimension | Proposition Vuvio |
| --- | --- |
| Point d'entrée | Une expérience réelle à découvrir maintenant. |
| Format | Live prioritairement POV ; replay ou récap selon disponibilité. |
| Contexte | Créateur, activité et localisation adaptée aux choix de confidentialité. |
| Découverte | Watch, Explore et globe géographique. |
| Prolongement | Profil, prochains lives, communauté et équipement. |
| Commerce | Informations sur l'équipement d'abord ; offres marchandes éventuelles ensuite. |

### 2.4 Positionnement : distinguer, sans simplifier à l'excès

- **Par rapport aux réseaux de vidéos courtes :** Vuvio met l'accent sur une expérience située et en direct plutôt que sur le seul enchaînement de vidéos montées. Les autres plateformes proposent également des fonctionnalités live ; la différence revendiquée réside dans la combinaison **POV + lieu + exploration + équipement**.
- **Par rapport aux plateformes de streaming :** Vuvio privilégie la découverte d'une activité et d'un environnement réels plutôt qu'une expérience principalement organisée autour d'un streamer ou d'un programme.
- **Par rapport aux cartes :** le globe de Vuvio ne sert pas seulement à montrer où se trouve un lieu, mais à faire découvrir le point de vue d'une personne présente sur le terrain.

**Phrase de travail :** « Choisissez un endroit, découvrez ce qui s'y passe et entrez dans le regard de quelqu'un, en direct. »

---

## 3. Publics et cas d'usage

### 3.1 Le spectateur

Le spectateur veut découvrir un lieu, un métier, une passion ou un événement sans nécessairement connaître le créateur à l'avance. Il peut arriver pour une exploration spontanée, chercher une activité particulière ou retrouver une personne qu'il suit déjà.

**Exemples d'intentions :** voir une session de surf ; observer le travail d'un artisan ; découvrir un quartier ; suivre une randonnée ; comprendre comment un musicien ou un cuisinier exerce son activité ; revoir un moment marquant après le direct.

### 3.2 Le créateur

Le créateur souhaite partager ce qu'il voit et fait, avec une mise en route simple et un minimum d'opérations pendant l'activité. Son profil, ses futurs lives et ses replays peuvent prolonger cette rencontre.

**Familles décrites dans la source :** outdoor, sport, voyage, guides locaux, artisans, cuisine, musique, métiers de terrain, drone, mer, montagne et événements locaux.

### 3.3 Partenaires et marques — hypothèse à tester

Les marques pourraient s'intéresser à la présence de leurs produits dans des usages réels. Le potentiel commercial dépendra notamment d'une audience effective, de données d'attribution fiables, de la qualité des déclarations d'équipement et d'un cadre clair sur les contenus sponsorisés.

---

## 4. Principes produit et définition du POV

### 4.1 Principes non négociables de conception

1. **Le réel d'abord :** le produit reste centré sur des activités et environnements réellement partagés.
2. **POV comme format de référence :** le spectateur doit pouvoir comprendre ce que voit ou fait le créateur.
3. **Entrée dans le live sans friction :** ouvrir ou lancer un live exige le moins d'étapes possible, sans sacrifier les autorisations et la sécurité.
4. **Le lieu enrichit la découverte sans exposer inutilement les personnes :** granularité de localisation et consentement doivent être conçus explicitement.
5. **Un globe utile plutôt que décoratif :** ses signaux permettent d'identifier, filtrer et ouvrir un live.
6. **Équipement authentique :** les produits déclarés utilisés et les produits sponsorisés doivent rester visuellement et fonctionnellement distingués.
7. **Monétisation secondaire :** l'accès au direct et sa lisibilité priment sur les sollicitations commerciales.

Les principes 4 et 5 sont des **recommandations de conception** ajoutées lors de cette refonte ; les autres reprennent ou explicitent les orientations du document source.

### 4.2 Périmètre du POV — proposition à valider

Le document source pose le POV comme principe mais ne décrit pas complètement les exceptions. Définition de travail proposée : **une captation qui permet au spectateur de découvrir une activité depuis la perspective de la personne qui la réalise ou la traverse**.

| Situation | Traitement proposé |
| --- | --- |
| Caméra portée ou tenue montrant le champ de vision du créateur | Format POV de référence. |
| Caméra fixe orientée vers les mains, le plan de travail ou l'activité du créateur | À accepter si elle transmet clairement son geste et son environnement ; définir le signalement dans l'interface. |
| Captation externe d'un spectacle ou d'un événement | À évaluer comme format distinct ou exception, sans la faire passer pour un POV strict. |
| Drone | Définir une catégorie et des règles spécifiques : le point de vue est aérien et non celui du corps du créateur. |
| Replay d'une vidéo préenregistrée présenté comme live | À interdire ou à étiqueter de manière explicite si un format de diffusion différée est créé. |

**Décision ouverte :** établir les formats admis au lancement et leur étiquetage. Les lignes ci-dessus ne décrivent pas une politique déjà implémentée.

---

## 5. Parcours et fonctionnalités

### 5.1 Watch — découverte immédiate

**Intention :** regarder un live en plein écran, passer rapidement à un autre et accéder au contexte utile sans détourner l'attention de la vidéo.

Fonctionnalités mentionnées dans la source : feed Watch et ouverture d'un live, consultation du créateur et de son équipement. Une règle particulière est documentée : lorsqu'un lien contient `?live=ID`, le live correspondant doit être placé en premier dans le feed Watch.

**À documenter / tester :** chargement, état d'attente, indisponibilité du live, passage d'un live à l'autre, comportement des overlays, reprise audio/vidéo, ouvertures depuis partage, messages et accès au profil.

### 5.2 Explore — découverte structurée

La source décrit Explore comme une page combinant les lives réels Firestore **épinglés en haut**, les streams mock/demo, les lives proches, les prochains lives, les catégories, la recherche et les filtres.

**Recommandation :** dans l'environnement public, identifier sans ambiguïté les contenus de démonstration ou les exclure du catalogue destiné aux utilisateurs réels. Un mock ne doit pas être présenté comme un live réel.

**Responsabilité produit proposée :** Explore répond à « Je cherche une activité, un métier, une personne ou une catégorie », là où Watch répond à « Montre-moi quelque chose maintenant ».

### 5.3 Globe — découverte géographique

Le globe est une surface centrale de l'identité de Vuvio. Les points doivent signaler qu'une personne partage une activité depuis un lieu, sans devenir envahissants.

**État décrit par la source, non audité ici :**

- `/globe` et `/map` utilisent `GlobeTest2` ;
- `CurrentGlobe` reste accessible via `/globe-current` et `/map-current` ;
- `GlobeTest2` utilise `react-globe.gl` et Three.js ;
- les lives proches sont groupés en clusters avec compteur ;
- ouvrir un cluster zoome vers la zone, stoppe la rotation et révèle des lives individuels ;
- les points d'un cluster ouvert sont compacts pour limiter les superpositions.

**Limite décrite :** le globe utilise une texture unique qui devient visuellement insuffisante à fort zoom. La source propose d'étudier le passage d'une texture 4K vers 8K/16K au zoom proche avec une limite de zoom.

**Critères de conception proposés :** lisibilité sur mobile, filtrage par activité/métier/statut, animation discrète, accès direct au live, gestion du faible nombre de lives, pas de latence de chargement disproportionnée et réduction du niveau de détail sur appareils moins puissants. La piste 8K/16K doit être mesurée en mémoire, temps de chargement et performances avant adoption.

### 5.4 Démarrer et programmer un live

Le document source indique que le créateur peut démarrer et programmer un live POV, gérer son profil et déclarer son équipement. Il ne précise ni les écrans complets de création ni le statut réel de chaque étape.

**Parcours minimal proposé pour le lancement :** ouvrir « Start Live » → vérifier les autorisations caméra/micro → renseigner uniquement les éléments indispensables (titre ou activité, choix de visibilité et de localisation) → prévisualiser → démarrer → mettre fin au live clairement. Les options non essentielles doivent rester facultatives ou accessibles après le lancement lorsque c'est possible.

**À confirmer :** permissions, modèle de données des lives programmés, annulation, notifications aux abonnés, déconnexion pendant le live, échec du flux et fin d'un live resté orphelin.

### 5.5 Replay et récap

Le replay et le récap prolongent la durée de vie d'une expérience. Le spectateur peut les consulter lorsqu'ils sont disponibles ; le créateur peut être retrouvé à partir de ces contenus.

**Règle technique décrite :** ne pas supprimer `activeLives/{liveId}` dans le flux de fin de live côté client, car le backend a besoin de retrouver `cloudflareLiveInputId` pour ses traitements. La source indique que la suppression doit rester côté serveur via `checkStreamHeartbeats`.

**À décider / vérifier :** délai de disponibilité, échec du traitement, politique de conservation, visibilité des replays, suppression à la demande, intégrité du lien entre live terminé et média final, disponibilité et coût de génération des récaps.

### 5.6 Profils, communauté et messages

Le profil créateur décrit dans la source regroupe identité, lives passés, lives programmés, favoris, équipement et actions follow/message/notifications. La disponibilité exacte de ces fonctions en production reste à confirmer.

**Proposition :** une page de profil publique compréhensible en dehors de l'application peut soutenir le partage ; elle ne doit pas exposer de données privées ou d'informations de localisation non choisies par le créateur.

### 5.7 Équipement

L'équipement répond à une question naturelle : « Qu'utilise la personne que je regarde ? » Cela peut concerner une caméra, un vélo, un micro, un outil, une planche ou un autre objet lié à l'activité.

> **Principe de référence :** « Équipement d'abord. Commerce ensuite. »

Le parcours de base distingue : **activité réelle → équipement déclaré → fiche produit → offre externe facultative**. Les éventuelles recommandations sponsorisées ne doivent jamais être représentées comme des objets effectivement utilisés s'ils ne le sont pas.

**À vérifier :** provenance des produits, validation des déclarations, photos et descriptions, états sans offre, clics d'affiliation, information commerciale, fonctionnement sans réseau et gestion des produits introuvables.

### 5.8 Langues et thèmes

La source décrit une base d'internationalisation **EN/FR** : contexte de langue, sélection automatique ou manuelle, panneau de sélection et extraction des principaux textes dans i18n. Son objectif est d'éviter les mélanges accidentels de langues sur les parcours publics.

Thèmes décrits : `midnight-sky` par défaut, `azure-sky` ajouté et ancien `default` conservé comme fallback historique.

**Critère proposé :** tester les parcours principaux dans les deux langues et les différents thèmes, notamment les états vides, les erreurs, l'accessibilité visuelle et les petits écrans.

---

## 6. État du projet et niveau de vérification

### 6.1 Une classification commune

| Statut | Définition | Preuve attendue |
| --- | --- | --- |
| **Vérifié en production** | Fonctionne sur le site / l'application réellement accessible aux utilisateurs. | Test daté, environnement et résultat consignés. |
| **Vérifié en développement** | Fonctionne sur branche ou environnement de test identifié. | Chemin du code, scénario et résultat du test. |
| **Implémenté, non vérifié** | Le code ou la configuration semble exister ; aucun test concluant n'est enregistré. | Audit et test à réaliser. |
| **En développement** | Fonctionnalité partiellement développée. | Travail restant et responsable. |
| **Prévu** | Décision produit actée, sans preuve d'implémentation. | Spécification / ticket. |
| **À étudier** | Idée, alternative ou hypothèse non arbitrée. | Critères de décision. |

**Important :** le document source ne fournit ni test daté ni audit du dépôt. La table ci-dessous reflète **uniquement ce que la source décrit** et ne distribue pas artificiellement des statuts « vérifié ».

### 6.2 Inventaire initial à auditer

| Domaine | État rapporté par la source | Vérification à enregistrer |
| --- | --- | --- |
| Watch et ouverture d'un live | Feed et viewer décrits ; règle `?live=ID` indiquée. | Navigation, lecteur, partage, état hors ligne et nombre de spectateurs. |
| Explore | Lives Firestore, mocks, catégories, proximité et upcoming mentionnés. | Données réelles / démo, filtres, recherche et tri. |
| Globe | `GlobeTest2` déclaré actif sur `/globe` et `/map`; clusters décrits. | Routes, rendu mobile, performances, zoom et sélection. |
| Start Live / programmation | Possibilités énoncées. | Parcours complet, autorisations, programmation et erreurs. |
| Streaming | Publication WHIP et lecture HLS décrites. | Émission et lecture sur appareils / réseaux réels. |
| Replay / récap | Dépendance backend et règle de conservation identifiées. | Fin de live, jobs, disponibilité et suppression. |
| Profils et social | Fonctionnalités énumérées. | Écrans, persistance, permissions et notifications. |
| Équipement | Pilier produit avec principe d'authenticité. | Catalogue, déclaration, fiches, offres et suivi des clics. |
| Authentification | Email/password et Google popup décrits. | Connexion, déconnexion, erreurs et fournisseurs réellement actifs. |
| Internationalisation | Base EN/FR décrite. | Couverture complète des écrans, fallbacks et préférences. |
| Thèmes | `midnight-sky`, `azure-sky`, fallback `default` décrits. | Réglages, contraste et cohérence des pages. |
| Sécurité / modération | **Non détaillées dans la source.** | Politique, parcours de signalement, mesures opérationnelles. |
| Administration / analytics | Routes et collections mentionnées sans inventaire détaillé. | Accès, rôles, données disponibles et confidentialité. |

### 6.3 Registre de vérification — à remplir dans le dépôt

Pour toute fonctionnalité critique, consigner :

```text
Fonctionnalité :
Statut :
Branche / commit :
Environnement (local, staging, production) :
Appareil / navigateur :
Scénario de test :
Résultat :
Bug ou limitation :
Date de vérification :
Responsable :
Lien vers ticket / capture / log :
```

**Aucune ligne de ce registre n'est préremplie comme « test réussi » sans preuve.**

---

## 7. Architecture technique et règles de préservation

> Cette section retranscrit l'architecture **décrite dans la source**. Les versions de bibliothèques, les routes, les noms de fonctions et les comportements doivent être confirmés sur le dépôt avant une migration ou une modification sensible.

### 7.1 Frontend décrit

- React 19 ; Vite 6 ; React Router v6 ; i18next ; Three.js / `react-globe.gl` ; MapLibre pour certaines cartes historiques ; HLS.js pour la lecture HLS.

| Route décrite | Rôle indiqué |
| --- | --- |
| `/watch` | Feed / viewer live. |
| `/explore` | Recherche et découverte. |
| `/globe`, `/map` | Globe principal `GlobeTest2`. |
| `/globe-current`, `/map-current` | Ancien globe / vues historiques décrites. |
| `/profile/:id` | Profil utilisateur / créateur. |
| `/settings` | Réglages. |
| `/admin/*` | Surfaces internes. |

### 7.2 Backend et données décrits

- Firebase Cloud Functions v2 ; Node 20 ; Firestore ; Firebase Auth ; Firebase Storage ; Cloudflare Stream.
- Collections explicitement nommées : `activeLives`, `users`. La source mentionne d'autres collections pour messages, profils, analytics et équipement **sans en donner les noms ou schémas exhaustifs**.

**À documenter ultérieurement depuis le code :** schémas de collections et index ; rôles et règles Firestore / Storage ; déclencheurs de fonctions ; processus d'archivage ; environnements et configuration ; secrets et droits d'accès ; webhooks ; règles de rétention.

### 7.3 Parcours de diffusion décrit

```text
Créateur / broadcaster
       │ publication WHIP
       ▼
Cloudflare Stream live input
       │ manifest HLS
       ▼
Lecteur spectateur / multi-viewer
```

Le backend est décrit comme créant le live input Cloudflare et stockant `hlsManifestUrl`, `whepUrl` et `cloudflareLiveInputId`.

**Priorité de lecture documentée :** HLS Cloudflare d'abord, puis P2P WebRTC comme fallback. La source précise que WHEP Cloudflare n'est pas retenu comme lecteur principal pour les spectateurs multiples et rapporte une limitation d'un viewer simultané par live input. **Avant d'en faire une règle générale sur Cloudflare, revalider cette limitation au regard du service et de la configuration réellement utilisés.**

**Point ouvert :** la source mentionne la validation « replay/relay local et prod » dans la roadmap sans décrire complètement le composant relay, son hébergement ou son rôle effectif. Ne pas supposer qu'un chemin de diffusion particulier est actuellement actif : documenter le flux réel à partir du code, des variables d'environnement et des tests avant tout choix d'infrastructure.

### 7.4 Cycle de vie d'un live et replay

```text
Live créé → live diffusé → fin demandée → état terminal enregistré
                                  │
                                  ▼
                       traitements backend / replay
                                  │
                                  ▼
                           archivage / nettoyage
```

**Invariant source :** ne pas supprimer `activeLives/{liveId}` lors de la fin du live côté client. Le backend doit disposer de `cloudflareLiveInputId` pour ses traitements. La source attribue le nettoyage serveur à `checkStreamHeartbeats`.

**À vérifier avant modification :** la fonction serveur est bien déployée ; elle ne supprime rien avant la fin des traitements ; les jobs sont idempotents ou protégés contre les doubles exécutions ; un live orphelin est récupérable ; le replay reste lié à son créateur et à son profil.

### 7.5 Authentification

La source décrit Firebase email/password et la connexion Google via `signInWithPopup` ; elle demande explicitement de ne pas utiliser `signInWithRedirect` dans l'architecture actuelle.

**À vérifier avant changement :** compatibilité navigateur (particulièrement mobile), domaines autorisés, causes historiques de ce choix, comportement après fermeture de popup et parcours utilisateur sans session.

### 7.6 Règles de préservation listées dans la source

1. HLS reste le chemin principal de lecture multi-viewer **dans l'architecture décrite**.
2. Ne pas promouvoir WHEP en viewer principal sans revalidation technique et tests multi-spectateurs.
3. Ne pas supprimer `activeLives/{liveId}` côté client au moment de la fin du live.
4. Lorsque `?live=ID` est présent, donner la priorité à ce live dans Watch.
5. Conserver le Google Sign-In en popup tant que la décision d'architecture n'a pas été revue et testée.
6. Maintenir la centralisation des URL de mock.
7. Distinguer équipement réellement utilisé et contenu commercial.
8. Préserver l'immersion du live face aux sollicitations de monétisation.

### 7.7 Qualité, performance et exploitation — propositions

- **Observabilité :** mesurer succès / échec de création du live, temps avant première image, rebuffering, erreurs de lecture, échec replay et nettoyage des lives orphelins.
- **Tests représentatifs :** iPhone Safari, Android Chrome, desktop ; Wi-Fi et réseau mobile ; faible débit et reprise réseau ; lecture simultanée sur plusieurs comptes.
- **Performance du globe :** établir des budgets de temps de chargement, de mémoire et de fluidité adaptés aux appareils ciblés avant tout passage en textures très haute résolution.
- **Déploiement :** identifier les environnements, branches, déclencheurs de déploiement, règles d'accès et procédure de retour arrière ; ne pas déduire un déploiement automatique d'une simple modification Git.
- **Coûts :** suivre séparément ingestion, diffusion, stockage, replay, fonctions, base de données, bande passante et éventuel serveur relay.

Ces pratiques sont recommandées ; leur présence en production **n'est pas attestée par le document source**.

---

## 8. Sécurité, vie privée et modération

> **Section proposée pour combler un manque du document source.** Elle décrit un chantier et des arbitrages à réaliser, pas des dispositifs déjà en place. Les obligations juridiques doivent être validées pour les pays de lancement avec un conseil compétent.

### 8.1 Risques propres à Vuvio

Une vidéo géolocalisée en temps réel peut exposer des tiers filmés sans leur accord, la position précise ou les habitudes d'un créateur, des lieux sensibles, des mineurs, des informations personnelles et des situations dangereuses. Le replay peut prolonger cette exposition au-delà du direct.

### 8.2 Politique de géolocalisation — décision prioritaire

**Proposition de départ :** ne pas rendre obligatoire la publication de coordonnées exactes. Permettre au créateur de choisir une granularité géographique adaptée : zone approximative, ville/région ou absence de localisation publique si le produit l'autorise. La position technique nécessaire au service et la position affichée publiquement doivent être traitées comme deux informations distinctes.

À arbitrer : localisation à l'inscription et au live ; changement de position pendant le direct ; lives à domicile ; affichage sur le globe ; conservation des données de trajet ; précision des lives passés / replays.

### 8.3 Modération et signalements — parcours proposé

1. Règles de communauté publiées et acceptées.
2. Signalement accessible depuis un live, un replay et un profil, avec catégories compréhensibles.
3. File d'examen interne, rôles et délais de traitement définis.
4. Mesures graduées : avertissement, masquage, arrêt du live, suspension et appel / contestation selon la gravité et le cadre applicable.
5. Traçabilité minimale des décisions et limitation de l'accès aux données sensibles.
6. Procédure spécifique pour les urgences ou menaces imminentes, à définir avec soin.

**À préciser :** mesures automatisées éventuelles, ce qu'elles détectent réellement, supervision humaine, faux positifs, traitement des contenus enregistrés et disponibilité de l'équipe de modération pendant les heures de live.

### 8.4 Vie privée et protection des données — travaux à cadrer

Documenter les catégories de données collectées, la finalité, la base légale le cas échéant, les durées de conservation, les fournisseurs impliqués, les droits des utilisateurs, les modalités de suppression et le fonctionnement des paramètres publics/privés. Traiter explicitement l'image des tiers et la présence de mineurs. Examiner les règles applicables avant l'ouverture à plusieurs pays.

### 8.5 Critères de lancement de cette section

**Proposition :** aucun lancement public tant que les règles d'usage, le parcours de signalement, les réglages de localisation, les autorisations d'accès aux données et le traitement des incidents graves ne sont pas documentés, attribués à un responsable et testés de bout en bout.

---

## 9. Monétisation et modèle économique

### 9.1 Principes

L'expérience du spectateur précède la monétisation. Vuvio ne cherche pas, au démarrage, à construire une application saturée de publicité. L'équipement intervient d'abord comme information contextuelle utile ; la recommandation marchande vient ensuite, si elle répond à une intention réelle du spectateur.

```text
Point de vue → Découverte → Confiance → Contexte → Offre pertinente éventuelle
```

### 9.2 Affiliation équipement — piste initiale

**Parcours envisagé :** live → équipement réellement utilisé → fiche produit → offre d'un marchand externe → commission **éventuelle** selon le programme partenaire et la conversion attribuée.

**Atouts potentiels :** absence de stock propre, pas de gestion directe du paiement marchand ou du SAV de la commande, compatibilité avec la curiosité du spectateur et possibilité d'éviter les interruptions du live. Ce sont des bénéfices du modèle envisagé, pas la preuve d'une rentabilité.

**Architecture cible proposée dans la source :**

```text
Catalogue équipement Vuvio
          ↓
Resolver produit
          ↓
Resolver offres
          ↓
Amazon / Awin / partenaires / fallback manuel
```

Le document source **n'établit pas** que ces intégrations marchandes sont opérationnelles ni qu'un programme d'affiliation est approuvé.

**Points à définir :** source de vérité du catalogue ; règles de correspondance produit ; disponibilité des offres par pays ; liens absents ou expirés ; tracking et consentement appropriés ; signalement des liens rémunérés ; attribution ; réconciliation des commissions ; traitement des retours, annulations et devises.

### 9.3 Partenariats marques — moyen terme

Le document source cite, à titre d'exemples, des marques liées à l'action/outdoor, au drone, à la musique, au sport ou aux outils. Elles constituent des **illustrations de catégories de partenaires**, non des partenariats signés.

L'offre commerciale pourrait, à terme, relier une marque à des créateurs ou activités pertinentes. La source envisage de mesurer notamment quels produits sont utilisés, dans quelles activités, quels contenus déclenchent des clics et quelles catégories géographiques manifestent un intérêt.

**Condition préalable :** une audience, des données agrégées fiables, des règles de confidentialité claires et des formats commerciaux distincts du contenu authentique.

### 9.4 Sponsoring contextualisé

**Règle absolue issue de la source :** ne jamais présenter comme réellement utilisé un produit sponsorisé qui ne l'est pas.

**Proposition UX :** distinguer au minimum « Utilisé par le créateur » et « Sponsorisé / suggestion », et rendre la relation commerciale intelligible lorsqu'elle existe.

### 9.5 Abonnements et outils premium — hypothèses futures

Le document source envisage : analytics créateur, programmation avancée, replays/récaps enrichis, profils améliorés, outils de monétisation, équipement avancé et multistream. **Aucune de ces idées n'est ici présentée comme une offre premium déjà vendue.**

### 9.6 Partage de revenus créateurs — à étudier plus tard

Un partage de revenus d'affiliation pourrait rendre l'équipement plus intéressant pour les créateurs, mais exigerait des règles d'éligibilité, de la comptabilité des droits, des paiements, de la fiscalité, des contrôles de fraude, de l'identification réglementaire selon les cas et un support dédié. Le document source recommande de ne pas lancer trop tôt cette complexité.

### 9.7 Hypothèses économiques à mesurer

Ne pas fixer de chiffre d'affaires prévisionnel sans données. Mesurer d'abord : nombre de lives contenant de l'équipement ; taux d'ouverture des fiches ; taux de clic sortant ; qualité de l'attribution ; conversions et commissions réellement remontées ; revenu net après coûts d'exploitation. Une forte consultation de l'équipement ne démontre pas à elle seule l'intention d'achat.

---

## 10. Acquisition, lancement et communauté

### 10.1 Premiers créateurs ciblés

La source propose de commencer avec les créateurs dont le point de vue possède une valeur visuelle immédiate : outdoor, sport, voyage, guides locaux, artisans, cuisine, musique, métiers de terrain, drone, mer/montagne et événements locaux.

**Hypothèse d'acquisition :** ces activités se prêtent au POV, sont associées à des lieux reconnaissables et suscitent des questions concrètes sur le matériel ou les gestes du créateur.

### 10.2 Équilibre offre / demande

**Proposition :** organiser des rendez-vous de diffusion à l'avance, en petit nombre et sur quelques catégories fortes, pour éviter un globe vide et pouvoir observer les comportements réels. Cette démarche doit être présentée comme un test d'acquisition, pas comme un programme déjà lancé.

### 10.3 Boucles de découverte et de partage

La source décrit comme mécaniques possibles : partage des lives, récap/replay partageable, profil public, équipement consultable, événements programmés, notifications et globe comme surface de découverte.

**Parcours à tester :** lien partagé → ouverture sur le bon live → possibilité de regarder sans confusion → découverte du profil / d'autres lives → éventuel retour dans l'application.

### 10.4 Premiers entretiens et tests utilisateurs — proposition

Interroger des spectateurs et créateurs sur la compréhension du POV, l'intérêt de Watch versus globe, la qualité du direct, l'acceptabilité de la localisation et la place de l'équipement. Observer les comportements plutôt que demander seulement si le concept « plaît ».

**À consigner :** profil du participant, scénario testé, difficulté observée, fréquence, décision produit et résultat après correction.

---

## 11. MVP, critères d'acceptation et roadmap

### 11.1 Périmètre proposé pour une première ouverture publique

Le document source ne définit pas une liste de critères de lancement fermée. Le périmètre ci-dessous est **une proposition**, à valider par l'équipe selon les ressources disponibles.

**Parcours indispensables :**

- Un créateur autorisé peut démarrer un live réel depuis son téléphone et y mettre fin.
- Le live apparaît de façon cohérente dans les surfaces de découverte retenues pour le lancement.
- Plusieurs spectateurs peuvent ouvrir le même live ; la lecture est suffisamment stable sur les appareils ciblés.
- Le spectateur peut identifier le créateur et l'activité ; le système gère proprement les cas de live absent ou terminé.
- Les autorisations et choix de visibilité / localisation sont explicites.
- Le replay apparaît quand promis, ou un état d'indisponibilité compréhensible est affiché.
- Le signalement d'un contenu et le traitement d'un incident disposent d'un parcours opérationnel.
- L'authentification, les règles d'accès aux données et la suppression / déconnexion sont testées.

**Peut rester secondaire au lancement, sous réserve de décision :** texture globe 8K/16K, catalogue d'affiliation multi-marchands, sponsoring, programme de rémunération des créateurs, outils premium et multistream. La programmation de live, les messages, les notifications et les récaps automatiques demandent un arbitrage explicite : ne pas les promettre publiquement si le parcours n'est pas prêt.

### 11.2 Recette de bout en bout — proposition

| ID | Test d'acceptation | Résultat à renseigner |
| --- | --- | --- |
| LIVE-01 | Création d'un live depuis un compte créateur autorisé. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-02 | Lecture du même live par plusieurs comptes / appareils. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-03 | Ouverture du live depuis Watch, Explore et le globe. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-04 | Lien de partage `?live=ID` ouvrant le bon live en priorité. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-05 | Perte de connexion / reprise / arrêt volontaire / arrêt inattendu. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-06 | Fin de live sans suppression client prématurée de `activeLives/{liveId}`. | ☐ Non testé ☐ OK ☐ Échec |
| LIVE-07 | Traitement backend puis accès au replay ou message d'échec explicite. | ☐ Non testé ☐ OK ☐ Échec |
| GEO-01 | Respect de la granularité / confidentialité de localisation choisie. | ☐ Non testé ☐ OK ☐ Échec |
| SAFE-01 | Signalement, réception interne et action de modération. | ☐ Non testé ☐ OK ☐ Échec |
| AUTH-01 | Inscription, connexion, récupération d'accès et déconnexion. | ☐ Non testé ☐ OK ☐ Échec |
| UX-01 | Parcours central utilisable en anglais et français sur les thèmes publiés. | ☐ Non testé ☐ OK ☐ Échec |
| PERF-01 | Temps de chargement et fluidité acceptables sur appareils cibles. | ☐ Non testé ☐ OK ☐ Échec |

La colonne est volontairement **non renseignée** : aucun test n'a été exécuté dans le cadre de la rédaction de ce fichier.

### 11.3 Court terme — reprendre et ordonner la source

**Fiabilité du produit :** stabiliser `/globe` avec `GlobeTest2` ; vérifier le rendu build / production ; améliorer clusters et sélection ; finaliser l'i18n visible EN/FR ; valider replay/relay en local et production ; nettoyer les assets non suivis.

**Évaluation technique :** tester la pertinence de textures 8K/16K ou d'un changement de texture au zoom, sans dégrader les appareils ciblés.

**Ajouts proposés pour le lancement :** vérifier le parcours live multi-viewer de bout en bout ; documenter les choix de localisation ; mettre en place les voies de signalement et les procédures d'incident ; organiser des tests utilisateurs.

### 11.4 Moyen terme — source

Catalogue équipement plus robuste ; resolver produits/offres ; analytics équipement et clics ; administration équipement ; amélioration replay/récap ; profils publics davantage partageables ; programmation de lives plus complète.

### 11.5 Long terme — source

Partenariats marques ; partage de revenus créateurs ; outils premium ; rendu du globe plus détaillé à fort zoom ; découverte événementielle par région et activité.

### 11.6 Règle de priorisation proposée

Arbitrer chaque évolution selon : **impact sur le parcours live réel**, sécurité / confidentialité, fiabilité, fréquence du problème, coût / complexité et validation de l'intérêt par les utilisateurs. Une amélioration visuelle spectaculaire ne doit pas masquer un échec de création, de lecture ou de fin de live.

---

## 12. Mesure, coûts et pilotage

> **Propositions d'indicateurs** : le document source parle d'analytics mais ne fournit pas de métriques réelles ni d'objectifs chiffrés. Ne pas présenter les indicateurs ci-dessous comme déjà instrumentés.

### 12.1 Usage et liquidité du live

- Créateurs ayant lancé au moins un vrai live sur une période définie.
- Nombre de lives diffusés, terminés normalement et interrompus.
- Heures de live et heures visionnées ; nombre de spectateurs simultanés.
- Délai avant première image et taux d'échec au démarrage / à la lecture.
- Nombre de lives accessibles au même moment, par tranche horaire et catégorie.
- Retour des spectateurs et des créateurs sur des périodes définies.

### 12.2 Découverte et qualité de l'expérience

- Entrées dans un live depuis Watch, Explore, globe, profil et partage.
- Temps nécessaire pour trouver un live intéressant ; sorties avant première image.
- Ouverture / fermeture des clusters, usage des filtres, taux d'ouverture après sélection d'un point.
- Consultations de replay et erreurs de génération.

### 12.3 Équipement et affiliation

- Lives avec équipement renseigné ; ouverture de fiche ; clic sortant marchand.
- Conversions attribuées lorsque remontées par les partenaires ; commissions confirmées et corrections éventuelles.
- Répartition des clics par activité ou type d'équipement **dans le respect de la confidentialité**.

### 12.4 Coûts techniques et unit economics

| Poste à suivre | Question opérationnelle |
| --- | --- |
| Cloudflare Stream | Quel coût par minute ingérée, délivrée et conservée selon l'offre en vigueur ? |
| Éventuel relay | Un coût fixe, du trafic ou des heures d'exécution sont-ils engagés ? |
| Firebase | Quel coût pour fonctions, lectures/écritures, stockage et réseau ? |
| Replay / récap | Quel coût de traitement, stockage et consultation par live ? |
| Modération et support | Combien de temps / ressources mobilisés par incident et par créateur actif ? |

Ne pas ajouter de tarifs ou de marges dans ce document sans facture, grille tarifaire datée ou mesure d'utilisation.

---

## 13. Décisions à trancher et risques

### 13.1 Registre des décisions ouvertes

| Sujet | Question à résoudre | Preuve / arbitrage nécessaire |
| --- | --- | --- |
| Définition du POV | Quels formats et exceptions admettre au lancement ? | Règles de contenu et tests créateurs. |
| Localisation | Quelle précision afficher et quelles options donner au créateur ? | Prototype UX, analyse vie privée, règles de publication. |
| Parcours MVP | Programmation, messages, récap : obligatoires ou différés ? | Tests utilisateur, coût et stabilité. |
| Architecture relay | Quel flux exact est actuellement utilisé et quel hébergement retenir ? | Audit code/configuration, tests et comparaison des coûts. |
| WHEP et fallback | Quelles capacités et limites réelles pour l'architecture choisie ? | Docs du fournisseur, configuration et tests multi-viewer datés. |
| Replay | Quand est-il disponible et quand nettoyer les données du live ? | Tests de cycle de vie et règles de rétention. |
| Globe | Le gain d'une texture haute définition justifie-t-il son coût ? | Mesures appareil, poids des assets et fluidité. |
| Démonstrations | Comment distinguer les mocks des lives publics ? | Règles par environnement et contrôle visuel. |
| Affiliation | Quel premier programme et quel niveau de tracking ? | Conditions contractuelles, choix UX et suivi des commissions. |
| Responsabilités | Qui décide, développe, teste, modère et autorise un lancement ? | Tableau des rôles et validations. |

### 13.2 Principaux risques à suivre — analyse proposée

**Risque de confiance :** géolocalisation trop précise, replay non maîtrisé, équipement déclaré à tort ou contenu démo présenté comme réel.  
**Risque technique :** live impossible à lancer ou regarder à plusieurs, perte de réseau, replay orphelin, déploiement non contrôlé.  
**Risque de découverte :** globe séduisant mais vide ou lent, mauvaise répartition des lives dans le temps et les catégories.  
**Risque économique :** coûts de vidéo supérieurs à la valeur générée, affiliation peu convertissante, trop de complexité commerciale avant l'usage.  
**Risque opérationnel :** absence de procédure de signalement, d'accès administrateur sécurisé ou de responsable d'incident.

### 13.3 Décisions déjà consignées dans la source

| Orientation décrite | Périmètre et réserve |
| --- | --- |
| HLS comme viewer principal | Choix rapporté pour la diffusion multi-viewer ; revalider dans l'architecture actuelle avant migration. |
| Conservation de `activeLives/{liveId}` à la fin côté client | Dépendance replay décrite ; préserver jusqu'à audit du traitement serveur. |
| Google Auth via popup | Choix d'implémentation décrit ; vérifier sa justification navigateur. |
| `GlobeTest2` comme route principale | Routage décrit ; confirmer l'état des routes du dépôt. |
| Équipement authentique avant commerce | Principe produit et commercial à conserver. |

**Aucune date historique, personne décisionnaire ou résultat de test n'est inventé pour ces décisions.**

---

## 14. Organisation et maintenance documentaire

### 14.1 Place de ce fichier

Ce document doit rester **l'entrée principale** : il décrit la vision, les parcours, l'état du projet, les règles importantes et les liens vers les dossiers spécialisés. Il ne doit pas devenir le seul lieu où sont copiés des milliers de lignes de spécifications, logs ou schémas de base de données.

### 14.2 Structure documentaire proposée

```text
VUVIO/docs/
  00-vuvio-overview.md            ← ce document de référence
  01-product-ux.md                 ← parcours, écrans, décisions POV et design
  02-technical-architecture.md    ← architecture, données, streaming, sécurité technique
  03-business-monetization.md     ← équipements, affiliation, partenariats, hypothèses
  04-launch-roadmap.md             ← backlog, tests, bugs et jalons
  05-safety-moderation.md          ← localisation, confidentialité, règles et incidents
  06-strategy-funding.md           ← acquisition, équipe, partenaires, financement
  07-decisions-history.md          ← décisions datées et alternatives écartées
  adr/                             ← décisions d'architecture si besoin
```

**Cette arborescence est une proposition et n'affirme pas que ces fichiers existent.**

### 14.3 Discipline de mise à jour

- Mettre à jour le **statut** d'une fonctionnalité uniquement avec une preuve de test ou une référence au travail réalisé.
- Écrire séparément **ce qui est**, **ce qui est décidé** et **ce qui est proposé**.
- Ajouter la date, le responsable et la raison aux décisions qui peuvent être contestées ou révisées.
- Lorsqu'un choix technique change, répercuter la modification sur les parcours concernés et la roadmap.
- Ne conserver aucun mot de passe, jeton, identifiant sensible ou secret dans les fichiers de documentation partagés.
- Distinguer la version publique du document (vision, usage, promesse) de sa version interne (infrastructure, incidents, coûts et sécurité opérationnelle).

### 14.4 Fiche type d'une décision

```markdown
## Décision — [titre]
- Statut : proposée / acceptée / remplacée
- Date : AAAA-MM-JJ
- Responsable :
- Contexte :
- Options étudiées :
- Choix :
- Motifs et compromis :
- Conséquences techniques / produit :
- Critère de réévaluation :
- Sources / tests :
```

---

## 15. Pitchs et formulations de référence

### 15.1 Pitch très court

**Vuvio permet de découvrir le monde en direct à travers les yeux de ceux qui le vivent.** Choisissez un live dans Watch, recherchez une activité dans Explore ou touchez un point sur le globe pour entrer dans une perspective réelle.

### 15.2 Pitch produit

Vuvio est une application de live POV centrée sur la découverte de lieux, d'activités et de métiers. Une personne diffuse ce qu'elle voit ; les spectateurs peuvent la découvrir depuis un feed, une recherche ou un globe, puis retrouver son profil, ses prochains lives, ses replays et son équipement lorsque ces contenus sont disponibles. L'objectif est de rendre l'exploration d'une expérience réelle aussi immédiate qu'un swipe.

### 15.3 Pitch partenaire ou investisseur — sans promesse non prouvée

Vuvio développe une interface de découverte de perspectives humaines géolocalisées en direct. Le projet relie trois expériences : vidéo live, exploration sociale et information contextuelle sur l'équipement utilisé. La différenciation recherchée est la combinaison du POV, du globe et de la découverte par activité. La première étape est de valider l'usage et la fiabilité du produit auprès de créateurs et spectateurs réels. L'affiliation équipement est la première hypothèse de monétisation ; partenariats, sponsoring contextualisé et services premium pourront être étudiés une fois l'usage démontré.

### 15.4 Manifeste

Le monde est une collection de regards humains, vivants et situés. Vuvio veut permettre de les rencontrer au moment où ils existent : non pas seulement voir un lieu sur une carte, mais découvrir ce qu'une personne y voit et y fait.

---

## 16. Annexes opérationnelles

### Annexe A — Vérification du dépôt avant publication de cette documentation

**À demander à la personne ou à l'outil ayant accès au code :**

1. Relever la branche, le commit, la date du dernier déploiement et l'environnement réellement testé.
2. Confirmer les versions de React, Vite, React Router, i18next, Three.js, `react-globe.gl`, MapLibre, HLS.js, Node et Cloud Functions.
3. Identifier l'implémentation réelle de toutes les routes listées, particulièrement `/globe`, `/map`, `/globe-current` et `/map-current`.
4. Tracer l'ensemble du chemin broadcaster → Cloudflare → viewer, y compris un éventuel relay, fallback et variables d'environnement **sans copier les secrets**.
5. Confirmer le nombre de spectateurs simultanés réellement testé, la configuration WHEP et le comportement HLS.
6. Tracer fin de live → jobs de replay → suppression / archivage `activeLives/{liveId}` et vérifier `checkStreamHeartbeats`.
7. Vérifier le fonctionnement de `?live=ID` depuis un lien externe.
8. Recenser les fonctionnalités créateur, Explore, profil, messages, notifications, programmation et équipement par statut réel.
9. Confirmer les flux de connexion Google et email sur les navigateurs visés.
10. Distinguer les données démo des données publiques et identifier les modes de publication.
11. Recenser les fonctionnalités de modération, confidentialité, suppression et permissions réellement présentes.
12. Mettre à jour la section 6 et le registre de décisions avec des preuves, puis seulement marquer un parcours « vérifié ».

### Annexe B — Glossaire

| Terme | Sens dans ce document |
| --- | --- |
| POV | Point de vue subjectif ou perspectif du créateur, dont le périmètre exact reste à arbitrer. |
| Live input | Ressource côté fournisseur vidéo utilisée pour recevoir le flux du créateur. |
| WHIP | Protocole de publication de média WebRTC, indiqué dans la chaîne d'émission source. |
| HLS | Protocole de diffusion vidéo retenu comme lecture principale dans l'architecture source. |
| WHEP | Protocole de lecture WebRTC discuté comme alternative, non prioritaire dans l'architecture source. |
| Relay | Composant intermédiaire possible de la chaîne de diffusion ; sa présence et son rôle actifs sont à auditer. |
| Replay | Enregistrement consultable après le direct, lorsque disponible. |
| Récap | Sélection ou synthèse de moments du live ; méthode de production non précisée ici. |
| Cluster | Regroupement de plusieurs points de live proches sur le globe. |
| Resolver | Logique prévue pour identifier un produit ou trouver une offre marchande pertinente. |
| Mock / démo | Donnée de démonstration distincte d'un live réel. |
| MVP | Première version permettant de tester la valeur du produit avec un périmètre maîtrisé. |

### Annexe C — Sources, limites et historique de l'édition

**Source exploitée :** document Markdown original `vuvio-complete-overview.md` transmis pour refonte. Son contenu a été réorganisé et développé sans en présenter les affirmations techniques comme des observations indépendamment vérifiées.

**Ajouts de cette édition :** classification des statuts ; inventaire d'audit ; définition de travail du POV ; responsabilités différenciées de Watch / Explore / globe ; section sécurité / vie privée / modération ; critères de recette MVP ; tableaux de mesure ; registre de décisions ; discipline documentaire.

**Informations non disponibles dans cette source :** état exact du dépôt et de la production ; identité et responsabilités formelles de l'équipe ; résultats des tests ; revenus ou partenariats conclus ; métriques d'usage ; coûts constatés ; calendrier ferme de lancement ; audit juridique. Ces éléments ne doivent pas être inventés ou inférés de la seule description du produit.

**Historique :**

| Version | Date | Modification |
| --- | --- | --- |
| 1.0 | 22 septembre 2026 | Refonte structurée du document de référence, avec séparation entre état rapporté, propositions, tests et décisions. |

