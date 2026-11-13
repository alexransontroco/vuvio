Status: Current

# Vuvio — Document complet de référence

## Résumé

Vuvio est une application mobile-first de live streaming POV.

L'idée centrale est simple : permettre à quelqu'un de voir le monde à travers les yeux d'une autre personne, en Live.

Un spectateur n'ouvre pas seulement une vidéo. Il entre dans un point de vue : un pêcheur en mer, un cycliste dans les Alpes, un guide à Tokyo, un artisan dans son atelier, un skieur, un cuisinier, un musicien, un pilote de drone, un secouriste, un agriculteur, un voyageur.

Vuvio veut rendre l'exploration du réel aussi immédiate qu'un swipe social, mais avec une profondeur que les formats courts n'ont pas : le lieu, la personne, le Live, l'équipement, le replay et le contexte.

## Vision

La plupart des plateformes vidéo montrent des contenus montés, optimisés, scénarisés. Vuvio part dans l'autre direction : le réel, maintenant, depuis le terrain.

Le produit repose sur trois intuitions :

1. Les gens veulent voir ce que les autres vivent vraiment.
2. Le Live est plus fort quand il est incarné par un lieu et un point de vue.
3. L'équipement utilisé par les créateurs fait naturellement partie de l'expérience.

Vuvio n'est pas seulement une app de live. C'est une carte vivante des perspectives humaines.

Une inspiration produit importante vient de Strava et Polarsteps, sans copier leur positionnement.

Vuvio peut prendre à Strava l'idée qu'une activité terminée garde une valeur durable, construit le profil de son auteur et peut nourrir une communauté. Vuvio peut prendre à Polarsteps l'idée que plusieurs moments géographiques peuvent devenir une histoire, une mémoire et un parcours à revisiter.

Source interne liée : [`Vuvio_Inspirations_Strava_Polarsteps.md`](../Vuvio_Inspirations_Strava_Polarsteps.md).

La synthèse adaptée à Vuvio :

```text
Live
 ↓
Experience
 ↓
Profile memory
 ↓
Adventure / Series
 ↓
Globe as living memory
```

Formule :

> Vuvio = Live + Discovery + Memory.

## Storytelling

Le monde est rempli de moments que personne ne voit.

Un boulanger commence sa nuit quand la ville dort. Un guide traverse une rue de Kyoto sous la pluie. Un marin répare une voile. Un cycliste monte un col. Un photographe attend la lumière. Un artisan façonne un objet. Un skieur descend une pente au lever du jour.

Ces moments existent, mais ils sont souvent invisibles.

Vuvio transforme ces instants en portes d'entrée.

Le spectateur ne consomme pas seulement du contenu. Il choisit un point sur le globe, touche un signal live, et entre dans une perspective.

Le créateur ne produit pas seulement une vidéo. Il partage son regard, son geste, son environnement et son matériel.

La promesse :

> Voir le monde en Live, à hauteur humaine.

## Produit

### Expérience spectateur

Le spectateur peut :

- découvrir des lives depuis le feed Watch ;
- explorer des lives sur le globe ;
- filtrer par activité, environnement ou statut ;
- ouvrir un live depuis une carte ou une page Explore ;
- suivre un créateur ;
- envoyer des messages ;
- regarder un replay ou un recap quand disponible ;
- consulter le profil, les prochains lives et l'équipement du créateur.

### Expérience créateur

Le créateur peut :

- démarrer un live POV ;
- programmer un live ;
- gérer son profil public ;
- déclarer son équipement ;
- construire une audience autour de ses activités ;
- être découvert via le globe, Explore, les profils et les replays.

### Globe

Le globe est une pièce centrale de l'identité produit.

Il doit donner le sentiment que la planète est vivante. Chaque point est un signal humain : quelqu'un est quelque part, en train de montrer ce qu'il voit.

État actuel :

- `/globe` et `/map` utilisent `GlobeTest2`.
- `CurrentGlobe` reste accessible via `/globe-current` et `/map-current`.
- `GlobeTest2` utilise `react-globe.gl` et Three.js.
- Les lives proches sont regroupés en clusters avec compteur.
- Cliquer un cluster zoome sur la zone, arrête la rotation et révèle les lives individuels.
- Les points d'un cluster ouvert sont compacts pour éviter la superposition.

Limite connue :

- Le globe utilise une texture unique. À fort zoom, l'image finit par s'étirer.
- La prochaine piste est un swap texture 4K vers 8K/16K au zoom proche, avec limite de zoom pour préserver la qualité visuelle.

### Live

Le live est prioritairement diffusé en HLS pour les spectateurs.

Le chemin WebRTC WHEP Cloudflare n'est pas le viewer principal, car il ne supporte qu'un viewer simultané par live input. Vuvio garde HLS comme chemin multi-viewer.

Priorité viewer :

```text
HLS Cloudflare
 ↓
P2P WebRTC fallback
```

### Replay et recap

Le replay dépend du fait que le document `activeLives/{liveId}` reste disponible après la fin du live, afin que les jobs backend puissent lire `cloudflareLiveInputId`.

Règle critique :

```text
Ne jamais supprimer activeLives/{liveId} dans le flux end-live côté client.
```

La suppression doit rester server-side via `checkStreamHeartbeats`.

### Experiences

Un live ne devrait pas simplement disparaître quand il se termine.

L'inspiration Strava la plus utile est la transformation d'une activité réelle en objet durable. Pour Vuvio, un live terminé peut devenir une **Experience**.

Exemple :

```text
Cycling through the Alps

Créateur: Alex
Catégorie: Cycling
Lieu: Chamonix, France
Durée: 1 h 42
Replay: disponible
Highlights: disponibles
Équipement: GoPro, vélo, casque
Date: ...
Réactions/commentaires: ...
Partage: ...
```

Une Experience peut contenir :

- miniature ;
- titre ;
- créateur ;
- catégorie ;
- lieu ;
- durée ;
- replay ;
- highlights ;
- équipement ;
- description ;
- statistiques pertinentes ;
- bouton de partage.

Elle peut apparaître :

- sur le profil du créateur ;
- dans Explore ;
- sur le globe ;
- dans une recherche ;
- dans une catégorie ;
- dans un lien externe.

Priorité produit : haute.

### Adventures / Series

L'inspiration Polarsteps la plus intéressante est la transformation de plusieurs moments en histoire.

Plusieurs lives peuvent former une **Adventure**, une **Series** ou un **Journey**.

Exemples :

```text
Sailing across the Mediterranean
France → Italy
5 jours — 4 lives
```

Ou hors voyage :

```text
Building a handmade guitar
1. Choix du bois
2. Découpe
3. Assemblage
4. Finition
5. Premier essai
```

Ou :

```text
Recording an EP
1. Répétition
2. Studio
3. Overdubs
4. Mix
5. Concert de lancement
```

L'Adventure peut exister avant d'être terminée :

- prochains lives ;
- notifications ;
- suivi ;
- page dédiée ;
- recap final.

Cela crée une raison de revenir :

> Voir la suite.

Priorité produit : moyenne, après stabilisation des Experiences individuelles.

### Globe comme mémoire

Aujourd'hui, le globe sert principalement à découvrir le live.

À terme, il peut aussi devenir une mémoire géographique des expériences.

Filtres possibles :

```text
Live       — ce qui se passe maintenant
Upcoming   — ce qui arrive bientôt
Discover   — ce qui s'est déjà passé
```

Exemple : un utilisateur explore Tokyo.

Il peut voir :

- un live actuel dans un marché ;
- une visite prévue le soir ;
- un replay d'un artisan ;
- une promenade nocturne passée ;
- une expérience culinaire passée.

Cela résout un problème important des plateformes live au démarrage : même lorsqu'il y a peu de lives simultanés, le globe peut rester riche grâce aux Experiences passées.

Priorité produit : moyenne à haute une fois replay, highlights et Experiences stabilisés.

### Replay synchronisé à un parcours

Pour certaines activités mobiles, le replay peut être associé à un parcours.

Pertinent pour :

- vélo ;
- randonnée ;
- bateau ;
- running ;
- visite de ville ;
- road trip ;
- voyage.

Moins pertinent pour :

- artisan ;
- cuisinier ;
- musicien ;
- atelier fixe.

Exemple :

```text
00:00 — départ de Chamonix
32:18 — vue panoramique
1:06:40 — arrivée au sommet
```

Un spectateur pourrait toucher un point sur le parcours et ouvrir le moment correspondant dans le replay.

Règle vie privée :

- localisation volontaire ;
- configurable ;
- approximative si besoin ;
- désactivable.

### Explore

Explore est la surface de découverte structurée.

Elle combine :

- les lives réels Firestore, épinglés en haut ;
- les streams mock/demo ;
- les lives proches ;
- les upcoming lives ;
- les catégories ;
- la recherche et les filtres.

### Profils

Le profil créateur rassemble :

- identité ;
- lives passés ;
- lives programmés ;
- favoris ;
- équipement ;
- actions follow/message/notifications.

À terme, le profil peut devenir une page publique de découverte et de conversion.

Avec l'inspiration Strava, le profil ne doit pas seulement montrer qui est le créateur. Il doit progressivement montrer ce qu'il a fait découvrir.

Structure possible :

```text
Profile
 ↓
Experiences
 ↓
Upcoming
 ↓
Equipment
 ↓
About
 ↓
Adventures / Series
```

Le profil devient une collection d'expériences.

> Voici le monde que cette personne nous fait découvrir.

### Équipement

L'équipement est un pilier produit et business.

Le spectateur se demande naturellement :

> Quelle caméra utilise-t-il ?
> Quel vélo ?
> Quel micro ?
> Quel outil ?
> Quelle planche ?

Vuvio répond à cette curiosité sans interrompre le live.

Principe :

```text
Équipement d'abord.
Commerce ensuite.
```

## Architecture technique

### Frontend

Stack :

- React 19 ;
- Vite 6 ;
- React Router v6 ;
- i18next ;
- Three.js / react-globe.gl ;
- MapLibre pour certaines cartes historiques ;
- HLS.js pour la lecture HLS.

Routes importantes :

- `/watch` : feed/live viewer ;
- `/explore` : découverte ;
- `/globe` : globe principal Test2 ;
- `/map` : alias globe principal Test2 ;
- `/globe-current` : ancien globe MapLibre ;
- `/map-current` : ancien globe MapLibre côté map ;
- `/profile/:id` : profils ;
- `/settings` : réglages ;
- `/admin/*` : surfaces internes.

### Backend

Stack :

- Firebase Cloud Functions v2 ;
- Node 20 ;
- Firestore ;
- Firebase Auth ;
- Firebase Storage ;
- Cloudflare Stream.

Collections principales :

- `activeLives` ;
- `users` ;
- collections liées aux messages, profils, analytics, équipement selon modules.

### Streaming

Chaîne live :

```text
Broadcaster
 ↓ WHIP
Cloudflare Stream input
 ↓ HLS
Spectateurs
```

Le backend crée le live input Cloudflare, stocke `hlsManifestUrl`, `whepUrl` et `cloudflareLiveInputId`, puis les spectateurs consomment HLS.

### Auth

Auth Firebase :

- email/password ;
- Google popup.

Règle :

```text
Google Sign-In utilise signInWithPopup, jamais signInWithRedirect.
```

### Internationalisation

Vuvio supporte maintenant une base EN/FR :

- contexte langue ;
- sélection automatique ou manuelle ;
- sheet de langue ;
- textes principaux extraits dans i18n.

L'objectif reste de garder une UX cohérente, sans mélange accidentel de langues dans les parcours publics.

### Thèmes

Thèmes en cours :

- `midnight-sky` par défaut ;
- `azure-sky` ajouté ;
- ancien `default` encore présent comme fallback historique.

## Modèle business

### Principe

Vuvio ne doit pas commencer comme une app publicitaire.

Le coeur de valeur est l'expérience :

```text
Point de vue
 ↓
Découverte
 ↓
Confiance
 ↓
Contexte
 ↓
Monétisation naturelle
```

### Sources de revenus possibles

#### 1. Affiliation équipement

Le modèle le plus naturel à court terme.

Quand un spectateur consulte l'équipement d'un créateur, Vuvio peut proposer des offres externes :

```text
Live
 ↓
Équipement
 ↓
Produit
 ↓
Marchand externe
 ↓
Commission potentielle
```

Avantages :

- pas de stock ;
- pas de paiement à gérer ;
- pas de SAV marchand ;
- cohérent avec la curiosité du spectateur ;
- monétisation non intrusive.

Architecture recommandée :

```text
Catalogue équipement Vuvio
 ↓
Resolver produit
 ↓
Resolver offres
 ↓
Amazon / Awin / partenaires / fallback manuel
```

#### 2. Partenariats marques

À moyen terme, Vuvio peut vendre aux marques une présence liée aux usages réels :

- GoPro pour action/outdoor ;
- DJI pour drone ;
- Fender pour musique ;
- Decathlon pour sport/outdoor ;
- marques d'outils, cuisine, mobilité, photo, pêche, etc.

La valeur commerciale vient des données d'usage :

```text
Quels produits sont utilisés ?
Dans quelles activités ?
Par quels créateurs ?
Quels lives déclenchent des clics ?
Quels pays/catégories génèrent l'intention ?
```

#### 3. Sponsoring contextualisé

Possible plus tard, mais avec une règle stricte :

```text
Ne jamais présenter un produit sponsorisé comme s'il était réellement utilisé par le créateur.
```

La confiance dans l'équipement est plus importante que le revenu court terme.

#### 4. Abonnements / features créateurs

Possibilités futures :

- analytics créateur ;
- meilleure programmation ;
- replay/recap avancés ;
- pages profil enrichies ;
- outils de monétisation ;
- équipement avancé ;
- diffusion multi-plateforme.

#### 5. Revenue share créateurs

Possible plus tard, surtout sur affiliation.

Mais à ne pas faire trop tôt car cela implique :

- balances ;
- paiements ;
- fiscalité ;
- fraude ;
- KYC ;
- support.

## Go-to-market

### Cibles initiales

Vuvio doit démarrer avec des créateurs dont le point de vue a une valeur visuelle immédiate :

- outdoor ;
- sport ;
- voyage ;
- guides locaux ;
- artisans ;
- cuisine ;
- musique ;
- métiers de terrain ;
- drone ;
- mer/montagne ;
- événements locaux.

### Pourquoi ces créateurs ?

Leur contenu est naturellement POV, géographique et équipé.

Ils donnent au spectateur une raison claire d'ouvrir :

```text
Je veux voir ce que cette personne voit.
```

### Croissance

Mécaniques de croissance :

- partage de live ;
- replay/recap partageable ;
- Experience partageable ;
- Adventure partageable ;
- profils publics ;
- équipement consultable ;
- événements programmés ;
- notifications ;
- globe comme surface de découverte.

### Challenges éditoriaux

Vuvio peut s'inspirer de Strava sans créer une culture de performance.

Les challenges doivent encourager l'exploration, pas le score.

Exemples :

- Sunrise Around the World ;
- A Day at Work ;
- Life at Sea ;
- Behind the Craft ;
- One City, Many Perspectives.

À éviter :

- classements agressifs ;
- heures de live comme compétition ;
- métriques qui poussent à streamer sans valeur.

Priorité : plus tard, quand les catégories et Experiences sont solides.

## Positionnement

Vuvio n'est pas Twitch.

Twitch est centré sur le streamer, la communauté et le divertissement longue durée.

Vuvio est centré sur le point de vue, le monde réel et la découverte située.

Vuvio n'est pas TikTok.

TikTok est centré sur l'algorithme et le format court monté.

Vuvio est centré sur le live, le lieu et l'expérience incarnée.

Vuvio n'est pas Google Maps.

Google Maps montre des lieux.

Vuvio montre des gens en train de vivre quelque chose dans ces lieux.

Formule courte :

> TikTok montre ce qui performe. Google Maps montre où aller. Vuvio montre ce que quelqu'un voit maintenant.

### Ce qu'il ne faut pas copier

De Strava, Vuvio ne doit pas copier :

- obsession performance ;
- vitesse ;
- distance ;
- records ;
- classements permanents ;
- culture compétitive.

De Polarsteps, Vuvio ne doit pas copier :

- focalisation exclusive voyage/vacances ;
- journal personnel trop lourd ;
- tracking GPS permanent ;
- expérience centrée uniquement sur le road trip.

Vuvio doit rester plus large :

```text
métiers
passions
activités
lieux
rencontres
événements
terrain
```

## Roadmap produit

### Court terme

- Stabiliser `/globe` avec GlobeTest2.
- Vérifier rendu build/prod.
- Améliorer clusters et sélection de lives proches.
- Tester texture 8K/16K ou swap au zoom.
- Transformer un live terminé en Experience.
- Afficher les Experiences sur les profils.
- Regrouper replay, highlights et équipement dans l'Experience.
- Créer un partage propre d'une Experience.
- Finaliser i18n visible EN/FR.
- Nettoyer les assets non suivis.
- Valider replay/relay local et prod.

### Moyen terme

- Ajouter Discover sur le globe pour les Experiences passées.
- Rendre Upcoming plus visible et suivable.
- Regrouper plusieurs Experiences en Adventures / Series.
- Catalogue équipement plus robuste.
- Resolver produits/offres.
- Analytics équipement et clics.
- Admin équipement.
- Amélioration replay/recap.
- Profils publics plus partageables.
- Programmation live plus complète.

### Long terme

- Parcours GPS synchronisé au replay pour les activités pertinentes.
- Recap automatique d'une Adventure : carte, étapes, highlights.
- Challenges éditoriaux autour des catégories.
- Partenariats marques.
- Revenue share créateurs.
- Outils créateurs premium.
- Globe avec rendu proche plus détaillé.
- Découverte événementielle par région/activité.

## Règles à préserver

- HLS reste le viewer principal.
- Ne pas prioriser WHEP pour les spectateurs multiples.
- Ne pas supprimer `activeLives/{liveId}` dans le flow end-live.
- Quand `?live=ID` est présent, mettre ce live en premier dans le feed Watch.
- Google auth reste en popup.
- Les mock URLs restent centralisées.
- L'équipement doit rester authentique.
- La monétisation ne doit pas dégrader l'immersion live.

## Personas

### Le spectateur explorateur

Il veut voyager, apprendre, observer, découvrir.

Il n'a pas forcément une intention précise. Il ouvre Vuvio pour voir ce qui se passe quelque part dans le monde.

Ses besoins :

- découvrir vite ;
- comprendre où il est ;
- entrer dans un live sans friction ;
- passer facilement d'une perspective à une autre ;
- retrouver les créateurs intéressants.

### Le spectateur passionné

Il suit une activité spécifique :

- vélo ;
- surf ;
- cuisine ;
- pêche ;
- photo ;
- drone ;
- musique ;
- artisanat ;
- montagne ;
- voyage.

Il cherche des lives qui lui apprennent quelque chose ou lui donnent envie de pratiquer.

Ses besoins :

- filtres par activité ;
- créateurs crédibles ;
- équipement consultable ;
- replays utiles ;
- notifications sur les prochains lives.

### Le créateur terrain

Il fait déjà quelque chose d'intéressant dans le réel.

Il n'est pas forcément un streamer professionnel. Sa force est son activité.

Ses besoins :

- démarrer un live vite ;
- être découvert sans devoir maîtriser tous les codes sociaux ;
- montrer son contexte ;
- programmer ses lives ;
- valoriser son profil ;
- partager son équipement.

### La marque partenaire

Elle veut comprendre comment ses produits sont utilisés dans des contextes réels.

Ses besoins :

- visibilité authentique ;
- données d'usage ;
- catégories pertinentes ;
- créateurs alignés ;
- campagnes contextualisées ;
- mesure des clics/intérêts.

## Parcours utilisateurs

### Parcours spectateur — découverte spontanée

```text
Ouvre Vuvio
 ↓
Voit le globe ou le feed Watch
 ↓
Repère un signal live
 ↓
Entre dans un POV
 ↓
Suit / message / partage
 ↓
Consulte profil, replay ou équipement
```

### Parcours spectateur — intention par activité

```text
Ouvre Explore
 ↓
Filtre par sport / métier / environnement
 ↓
Compare les lives
 ↓
Regarde un créateur
 ↓
Sauvegarde ou suit
 ↓
Active une notification pour le prochain live
```

### Parcours créateur — live immédiat

```text
Connexion
 ↓
Prépare titre / catégorie / équipement
 ↓
Démarre caméra
 ↓
Stream WHIP vers Cloudflare
 ↓
Spectateurs regardent en HLS
 ↓
Replay / recap / profil enrichissent la suite
```

### Parcours créateur — live programmé

```text
Programme un live
 ↓
Le live apparaît dans profil / Explore
 ↓
Spectateurs demandent rappel
 ↓
Créateur démarre à l'heure prévue
 ↓
Audience initiale plus forte
```

## Métriques clés

### Activation

- première session avec live regardé ;
- temps avant premier live ;
- taux de clic depuis globe vers Watch ;
- taux de clic depuis Explore vers Watch ;
- compte créé après session anonyme.

### Engagement spectateur

- minutes regardées par session ;
- lives regardés par session ;
- follow par live regardé ;
- messages envoyés ;
- partages ;
- retours à J+1 / J+7.

### Engagement créateur

- lives démarrés ;
- lives programmés ;
- durée moyenne de live ;
- fréquence de live par créateur ;
- profils complétés ;
- équipement ajouté ;
- replays consultés.

### Monétisation

- ouvertures panneau équipement ;
- clics produits ;
- taux clic produit / live view ;
- top catégories équipement ;
- top marchands ;
- top créateurs générant intention produit ;
- revenu affilié estimé puis réel.

### Qualité technique

- taux de démarrage HLS ;
- temps jusqu'à première frame ;
- erreurs HLS ;
- fallback P2P ;
- réussite replay ;
- latence moyenne ;
- crash/session.

## Stratégie contenu et créateurs

### Les bons premiers créateurs

Les meilleurs créateurs initiaux ne sont pas forcément les plus gros influenceurs.

Ce sont ceux dont le point de vue est immédiatement compréhensible :

- "je vois quelque chose que tu ne vois pas" ;
- "je fais quelque chose que tu aimerais apprendre" ;
- "je suis dans un lieu où tu aimerais être" ;
- "j'utilise un équipement qui t'intéresse".

Exemples :

- guide local en ville ;
- surfeur ;
- cycliste ;
- artisan ;
- musicien de rue ou studio ;
- cuisinier ;
- drone pilot ;
- pêcheur ;
- photographe ;
- agriculteur ;
- mécanicien ;
- skieur ;
- navigateur.

### Recrutement créateurs

Approche recommandée :

1. Identifier des niches visuelles.
2. Trouver 20 à 50 créateurs par niche.
3. Leur proposer un usage simple : "montre ton point de vue en live".
4. Les aider à programmer un premier live.
5. Récupérer les retours sur friction, qualité vidéo, découverte et équipement.

### Promesse créateur

> Vous n'avez pas besoin d'inventer du contenu. Votre activité est déjà intéressante. Vuvio vous aide à la montrer en Live.

## Risques

### Risque technique

Le live demande de la stabilité.

Risques :

- ingestion instable ;
- replay non disponible ;
- latence ;
- coût vidéo ;
- différences navigateur/mobile ;
- permissions caméra ;
- build/deploy qui change le rendu globe.

Réponse :

- HLS comme viewer principal ;
- relay/replay testé séparément ;
- logs explicites ;
- validation build uniquement avant release/déploiement ;
- documentation des règles critiques.

### Risque contenu

Une plateforme live peut être vide si les créateurs ne streament pas.

Réponse :

- programmation de lives ;
- créateurs pilotes ;
- mock/demo seulement comme remplissage temporaire ;
- profils et replays pour créer de la valeur hors Live.

### Risque business

L'affiliation peut générer peu au début.

Réponse :

- la considérer comme infrastructure et apprentissage ;
- mesurer l'intention produit ;
- utiliser les données pour partenariats marques ;
- ne pas dépendre uniquement de la commission court terme.

### Risque UX

Le globe peut être beau mais difficile à utiliser si les points se superposent.

Réponse :

- clusters ;
- ouverture de clusters ;
- points compacts ;
- filtres par activité ;
- amélioration texture/zoom.

## Pitch deck synthétique

### Slide 1 — Problème

Le live streaming actuel est centré sur le divertissement, pas sur l'exploration du monde réel.

Les plateformes sociales montrent ce qui performe, mais pas ce que quelqu'un voit maintenant, quelque part.

### Slide 2 — Solution

Vuvio est une carte vivante de lives POV.

Chaque point est une perspective humaine en Live.

### Slide 3 — Produit

- Globe live ;
- feed Watch ;
- Explore par activité ;
- profils créateurs ;
- replay/recap ;
- équipement.

### Slide 4 — Pourquoi maintenant

- caméras mobiles meilleures ;
- HLS/cloud streaming plus accessible ;
- créateurs de niche plus nombreux ;
- fatigue des feeds algorithmiques ;
- intérêt croissant pour expériences authentiques et terrain.

### Slide 5 — Différenciation

Vuvio combine :

- live ;
- géolocalisation ;
- POV ;
- équipement ;
- profils ;
- monétisation contextualisée.

### Slide 6 — Business model

Phase 1 :

- affiliation équipement ;
- analytics produit ;
- validation des catégories.

Phase 2 :

- partenariats marques ;
- sponsoring contextualisé ;
- outils créateurs premium.

Phase 3 :

- revenue share créateurs ;
- campagnes par activité/région ;
- commerce plus avancé.

### Slide 7 — Go-to-market

Commencer par niches visuelles :

- outdoor ;
- sport ;
- voyage ;
- craft ;
- food ;
- musique ;
- métiers de terrain.

Construire une base de créateurs pilotes, programmer des lives, générer des replays et mesurer l'intention.

### Slide 8 — Moat

- base de créateurs terrain ;
- graphe activité × lieu × équipement ;
- données d'intention produit ;
- expérience globe différenciante ;
- archive de replays situés.

### Slide 9 — Roadmap

- stabilisation live/replay ;
- GlobeTest2 production ;
- clusters et zoom ;
- équipement/catalogue ;
- affiliation ;
- analytics ;
- partenariats.

### Slide 10 — Vision

Devenir l'interface live du monde réel.

## Pitch court

Vuvio est une carte vivante de lives POV.

L'utilisateur ouvre le globe, voit des signaux live autour du monde, touche un point et entre dans le regard de quelqu'un : un sportif, un artisan, un guide, un voyageur, un musicien, un professionnel de terrain.

La plateforme transforme le live en exploration située, puis relie naturellement les créateurs, leurs replays, leurs profils et leur équipement.

Le modèle économique commence par l'affiliation équipement et peut évoluer vers les partenariats marques, le sponsoring contextualisé et des outils premium créateurs.

## Pitch investisseur

Vuvio construit une nouvelle couche de découverte live : des perspectives humaines géolocalisées, accessibles depuis un globe et organisées par activité.

Le produit combine trois marchés :

- live streaming ;
- discovery/social video ;
- commerce contextualisé par équipement.

La différenciation vient du POV live, de la carte/globe comme interface de découverte, et du lien naturel entre activité réelle et produits utilisés.

À court terme, Vuvio valide l'usage avec des créateurs visuels et des lives terrain. À moyen terme, l'équipement devient une couche de monétisation via affiliation. À long terme, les données d'usage ouvrent des partenariats marques ciblés par activité, territoire et intention.

## Phrase manifeste

Vuvio existe pour donner envie de regarder le monde autrement : non pas comme une carte, non pas comme un feed infini, mais comme une collection de regards humains, vivants, situés, accessibles en Live.
