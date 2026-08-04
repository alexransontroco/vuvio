# Journal des modifications VuVio

Ce fichier sert de memoire de travail pour suivre les changements faits sur le projet.
Chaque nouvelle intervention de Codex doit ajouter une entree datee ici avant la reponse finale.

## 2026-07-24 - Reprise du contexte

Etat local observe :

- Branche active : `main`.
- Beaucoup de fichiers modifies sont deja presents dans le working tree.
- Les changements couvrent notamment l'application Vite/React, le manifeste PWA, le service worker, les pages Explore/Live/Map/Profile, des composants de navigation/cartes, les donnees mock, les styles, les assets audio et la configuration Firebase/Vite.
- Plusieurs nouveaux fichiers non suivis existent, dont des pages Settings/Help/Privacy/Terms/Messages/Globe Lab, des services profile/messaging/follow/report, des composants d'aide/legal/settings/splash/globe, des icones, des assets et la configuration Firebase.
- Aucun commit ou nettoyage Git n'a ete fait pendant cette reprise.

Decision de suivi :

- A partir de cette entree, chaque modification effectuee par Codex dans cette conversation doit etre resumee dans ce fichier.
- Les changements deja presents avant cette reprise ne sont pas attribues a Codex ici, sauf verification explicite fichier par fichier.

## 2026-07-24 - Serveur local

- Lancement du serveur de developpement Vite avec `npm run dev -- --host 0.0.0.0`.
- URLs disponibles :
  - Desktop local : `http://localhost:5173/`
  - Mobile/reseau local : `http://192.168.1.172:5173/`
- Le serveur tourne dans la session Codex `8406`.

## 2026-07-24 - Correction affichage ancien globe

- Probleme observe : sur `/map`, le mode `Actuel` affichait les controles et les filtres mais pas le globe.
- Cause probable : `LiveMap` dependait du style distant Carto (`https://basemaps.cartocdn.com/...`) pour declencher le chargement MapLibre. Si cette ressource reseau ne charge pas, les couches locales VuVio ne sont jamais ajoutees.
- Changement effectue dans `src/components/map/LiveMap.jsx` :
  - Remplacement du style distant par un style MapLibre local minimal (`BASE_GLOBE_STYLE`).
  - Conservation de la texture locale `/globe/earth-night.jpg` comme rendu principal du globe.
  - Encapsulation du terrain distant dans `addTerrainIfAvailable()` pour que son echec ne bloque pas le rendu.
  - Suppression du layer texte de comptage des clusters, qui demandait des glyphes externes.
- Verification :
  - Le dev server a applique le changement via HMR.
  - `http://localhost:5173/map` repond en HTTP 200.
  - Aucun log d'erreur Vite apres le hot reload.
  - `npm run build` a ete tente mais interrompu apres environ deux minutes bloque sur `transforming...`.

## 2026-07-24 - Ancien globe, deuxieme passe

- Nouvelle capture utilisateur : le mode `Actuel` restait vide et la console Chrome affichait des erreurs `404` sur `https://demotiles.maplibre.org/terrain-tiles/...`.
- Changement effectue :
  - Suppression complete de l'ajout du terrain distant MapLibre dans `src/components/map/LiveMap.jsx`.
  - Suppression du fog MapLibre pour eviter l'avertissement `calculateFogMatrix is not supported on globe projection`.
  - Passage du background MapLibre local en transparent.
  - Ajout d'une sphere HTML/CSS de secours dans `LiveMap` utilisant l'asset local `/globe/earth-night.jpg`.
  - Ajout du style correspondant dans `src/styles/pages/map.css`, avec animation lente de la texture.
- Verification :
  - Vite a applique le hot reload sur `LiveMap.jsx` et `map.css`.
  - `http://localhost:5173/globe/earth-night.jpg` repond en HTTP 200.
  - `http://localhost:5173/map` repond en HTTP 200.

## 2026-07-24 - Restauration du modele prod pour Actuel

- Demande utilisateur : revenir au modele visible sur `https://vuvio.app/map` pour le mode `Actuel`, et garder le prototype separe dans `Lab`.
- Reference recuperee :
  - HTML de production `https://vuvio.app/map`.
  - Bundle JS `/assets/index-B7EGBG_r.js`.
  - Bundle CSS `/assets/index-Bo4nerTS.css`.
- Changement effectue :
  - `src/components/map/LiveMap.jsx` reprend le modele de production :
    - style MapLibre Carto `dark-matter-nolabels`;
    - suppression du terrain distant et du fallback HTML/CSS ajoute precedemment;
    - marqueurs canvas par famille d'experience (`air`, `earth`, `water`);
    - clusters discrets, hit-area dediee, anneau de selection et auto-rotation;
    - filtrage par famille et sous-categorie via props.
  - `src/routes/MapPage.jsx` remplace les filtres `En direct / A venir` par `Tout / Air / Terre / Eau`, avec compteurs de lives.
  - `src/styles/pages/map.css` revient au placement prod :
    - globe MapLibre remonte dans l'ecran;
    - controles zoom/recentrage a gauche;
    - barre `Tout / Air / Terre / Eau` en bas au-dessus de la navigation.
- Verification :
  - HMR Vite applique sur `LiveMap.jsx`, `MapPage.jsx` et `map.css`.
  - `http://localhost:5173/src/components/map/LiveMap.jsx` repond en HTTP 200.
  - `http://localhost:5173/src/routes/MapPage.jsx` repond en HTTP 200.
  - `http://localhost:5173/map` repond en HTTP 200.
  - `npm run build` a ete retente mais reste bloque sur `transforming...`; il a ete interrompu apres environ une minute.

## 2026-07-24 - Restauration depuis `vuvio copy 2`

- L'utilisateur a fourni le chemin `/Users/alexandreranson/vuvio copy 2`, qui contient une version ou le globe `Actuel` s'affiche correctement.
- Comparaison faite entre cette copie et le repo actif sur :
  - `src/components/map/LiveMap.jsx`
  - `src/routes/MapPage.jsx`
  - `src/styles/pages/map.css`
- Changement effectue :
  - Remplacement de `src/components/map/LiveMap.jsx` par la version fonctionnelle de `vuvio copy 2`.
  - Remplacement de `src/styles/pages/map.css` par la version fonctionnelle de `vuvio copy 2`.
  - Rajout uniquement du style `.map-engine-switch` pour conserver le switch local `Actuel / Lab`.
  - `src/routes/MapPage.jsx` n'a pas ete remplace integralement afin de garder le mode `Lab` existant.
- Verification :
  - Vite a applique le HMR sur `LiveMap.jsx` et `map.css`.
  - `http://localhost:5173/src/components/map/LiveMap.jsx` repond en HTTP 200.
  - `http://localhost:5173/src/styles/pages/map.css` repond en HTTP 200.
  - `http://localhost:5173/map` repond en HTTP 200.

## 2026-07-24 - Fallback visible pour globe Actuel

- Nouvelle capture utilisateur : apres restauration depuis `vuvio copy 2`, le mode `Actuel` affiche toujours les controles et filtres mais le globe MapLibre reste invisible en local.
- Observation : la console Chrome ne montre pas d'erreur MapLibre, probablement parce que les erreurs de style/tuiles sont absorbees par `map.on('error', () => {})`.
- Changement effectue :
  - Ajout dans `src/components/map/LiveMap.jsx` d'un fallback visuel `live-map__fallback-globe` utilisant `/globe/earth-night.jpg`.
  - Le fallback est visible tant que MapLibre n'a pas emis l'evenement `load`.
  - Quand MapLibre charge correctement, la classe `is-map-loaded` masque automatiquement le fallback.
  - Ajout du style correspondant dans `src/styles/pages/map.css`, place sur la meme zone que l'ancien globe.
- Verification :
  - Vite a applique le HMR sur `LiveMap.jsx` et `map.css`.
  - `http://localhost:5173/globe/earth-night.jpg` repond en HTTP 200.
  - `http://localhost:5173/src/components/map/LiveMap.jsx` repond en HTTP 200.
  - `http://localhost:5173/map` repond en HTTP 200.

## 2026-07-24 - Fallback force au-dessus du canvas

- Retour utilisateur : le globe n'etait toujours pas visible.
- Cause probable : MapLibre emettait `load` ou affichait un canvas opaque vide, ce qui masquait le fallback.
- Changement effectue :
  - Suppression de l'etat React `mapLoaded` dans `LiveMap`.
  - Le fallback `live-map__fallback-globe` reste permanent.
  - Le fallback passe au-dessus du canvas MapLibre (`z-index: 3`) et sous la vignette/controles.
  - Le canvas MapLibre passe derriere (`z-index: 1`).
- Verification :
  - Vite a applique le HMR sur `LiveMap.jsx` et `map.css`.
  - `http://localhost:5173/src/components/map/LiveMap.jsx` repond en HTTP 200.
  - `http://localhost:5173/src/styles/pages/map.css` repond en HTTP 200.
