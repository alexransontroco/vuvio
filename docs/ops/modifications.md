# Vuvio — Journal des modifications

Mémoire de travail pour suivre les changements faits sur le projet.

---

## 2026-07-24 — Reprise du contexte (Codex)

État observé au démarrage :
- Branche `main`, nombreux fichiers modifiés/non-suivis.
- Changements couvrant React/Vite, PWA, Explore/Live/Map/Profile, navigation, mock data, styles, assets audio, Firebase/Vite config.
- Nouveaux fichiers non suivis : Settings/Help/Privacy/Terms/Messages/Globe Lab, services profile/messaging/follow/report, composants, icônes.
- Aucun commit Git fait pendant cette reprise.

---

## 2026-07-24 — Correction globe `Actuel` sur `/map`

**Problème** : mode `Actuel` affichait les contrôles mais pas le globe (dépendance au style distant Carto qui ne chargeait pas).

**Tentatives** :
1. Remplacement du style distant par un style MapLibre local minimal — Globe toujours invisible.
2. Suppression du terrain distant (erreurs 404 `demotiles.maplibre.org`) + fallback HTML/CSS — Toujours invisible.
3. Restauration depuis prod `https://vuvio.app/map` (style Carto `dark-matter-nolabels`, marqueurs canvas, clusters) — Toujours invisible en local.
4. Restauration depuis `vuvio copy 2` (version fonctionnelle connue) — Toujours invisible.

**Solution finale** : Fallback `live-map__fallback-globe` permanent utilisant `/globe/earth-night.jpg`, positionné au-dessus du canvas MapLibre (`z-index: 3`). Suppression de l'état React `mapLoaded`. Le canvas MapLibre tourne en arrière-plan ; si MapLibre charge en prod, il est visible en dessous.

**Fichiers modifiés** : `src/components/map/LiveMap.jsx`, `src/styles/pages/map.css`
