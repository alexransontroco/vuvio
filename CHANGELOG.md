Status: Current

# Changelog — Vuvio

Historique des sessions de travail, du plus récent au plus ancien.

---

## 2026-11-13 — Globe Test 6 (suite) : pivot CARTO→Stadia + MAX_ZOOM 14→18 + compteur réel

Deuxième passe sur `/globe-test-6` après vérification côté réseau (curl multi-zoom).

**Pivot fournisseur de tuiles : CARTO Dark Matter → Stadia Maps `alidade_smooth_dark`**
- Le CDN public `basemaps.cartocdn.com/dark_all/*` est **paywallé en 2026** : renvoie un PNG placeholder 2513 bytes identique pour tous les niveaux de zoom (vérifié `z=2, 5, 10, 14, 16, 18` via curl — même etag `wm-da89c20e77c1-dark`).
- Stadia Maps `alidade_smooth_dark` : même famille OSS Dark Matter (données OSM, rendu OpenMapTiles), gratuit sur localhost sans clé, ~20-100 kB par tuile réelle.
- URL : `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}[@2x].png[?api_key=...]`
- Attribution mise à jour : **© OpenStreetMap, © Stadia Maps, © OpenMapTiles**.
- `VITE_CARTO_API_KEY` conservé comme nom de variable (rétrocompat .env.local) mais sert maintenant de clé Stadia pour la prod.

**`CARTO_MAX_ZOOM = 14` → `TILES_MAX_ZOOM = 18`**
- 14 était insuffisant pour lire les noms de rues à Montmartre (tuile ~150 m à cette latitude).
- 18 permet de distinguer les immeubles individuels, cap imposé par Stadia pour `alidade_smooth_dark`.

**Compteur de tuiles passé en PerformanceObserver**
- Avant : incrément dans la fonction `buildCartoTileUrl` → approximatif (comptait les URLs générées, pas les fetchs réels, ignorait les cache hits).
- Après : `PerformanceObserver({ type: 'resource', buffered: true })` filtré sur `tiles.stadiamaps.com`, détecte aussi les erreurs via `responseStatus >= 400` (Chrome 120+) ou `decodedBodySize === 0 && transferSize === 0` (Safari fallback).
- Nouveau champ **Errors** dans le panneau diag, en rouge si > 0.

**Support @2x retina adaptatif**
- Desktop retina (`pointer: fine` + DPR > 1.25) → tuiles `@2x.png` (~2.8× plus lourdes mais labels nets au zoom 16-18).
- Mobile (`pointer: coarse`) → toujours @1x pour protéger cellular + GPU mémoire (iPhone DPR 3 aurait pris 9× le payload).

**Panneau diag enrichi**
- Nouveau : Errors (code couleur vert/rouge), Max zoom, Key (clé masquée `XXXX…XXXX` ou `(none, localhost dev)`).
- La clé API complète n'apparaît **jamais** dans le DOM ni les logs (fonction `maskedKey()` qui tronque à 4 chars de chaque côté).

**Transition globe ↔ tuiles**
- `requestTileMode(next)` orchestre un fade-out 350 ms + swap + fade-in 450 ms via la wrapper `gt2-globe-offset`.
- Fade-out → swap `tileMode` → délai 500 ms (sens original→vector, laisse charger les premières tuiles) ou 0 ms (vector→original, texture cached) → fade-in.
- `cubic-bezier(0.4, 0, 0.2, 1)`. Le starfield reste visible pendant la transition (fond cosmique ininterrompu).
- **Auto-switch sur altitude** (hystérésis 0.4 / 0.65) : au-dessus de 0.65 on reste en texture monde, en-dessous de 0.4 on bascule en tuiles. Détection dans le RAF existant via `autoSideRef`, zéro boucle (requestTileMode no-op si déjà aligné).
- Boutons Original/Vector gardés comme override manuel : `setTileModeManual` aligne `autoSideRef` sur le choix user pour que l'auto reprenne proprement au prochain crossing du seuil.

**Fichiers modifiés** (GT6 uniquement, zéro impact prod)
- `src/components/globe/GlobeTest6.jsx` : nouveau tile provider, PerformanceObserver, retina heuristic, `requestTileMode` transition
- `.env.local` : ajout `VITE_CARTO_API_KEY=` vide avec commentaire explicatif

---

## 2026-11-13 — Globe Test 6 : copie fidèle du globe de prod + mode CARTO Dark Matter

Nouveau prototype `/globe-test-6` (`src/components/globe/GlobeTest6.jsx` + `src/routes/GlobeTest6Page.jsx`). **Copie indépendante** de GlobeTest2 (le vrai globe de prod derrière `/globe` et `/map`) — aucune modif du globe de prod, aucun risque de régression.

**Stack conservée** : react-globe.gl + Three.js + EffectComposer. Mêmes markers HTML clusters/avatar, mêmes filtres, mêmes starfield/cards/sheet. Rendering 100% identique en mode `original`.

**Nouveauté : moteur de tuiles CARTO Dark Matter** — branché via le prop natif `globeTileEngineUrl` de react-globe.gl :
- Fonction `buildCartoTileUrl(x, y, z)` qui renvoie `https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png` avec subdomain rotation pour parallélisme CDN.
- Zoom plafonné à **CARTO_MAX_ZOOM = 14** (suffisant pour vue quartier, évite flood).
- Clef API optionnelle via `VITE_CARTO_API_KEY` (free public tier OK pour prototype).
- Attribution OSM + CARTO affichée bottom-left (obligation licence) uniquement quand mode CARTO actif.
- Wrapper `cartoTileEngine` compte les requêtes tuiles pour le panneau de diagnostic.

**Panneau diagnostic top-right** (toujours visible, repliable en pill `Diag`) :
- Toggle **Original ↔ CARTO** (tileMode state) — bascule à chaud sans rechargement.
- Readouts : **FPS** (code couleur vert/jaune/rouge), altitude, zoom équivalent, nb tuiles chargées, mode actif.
- Boutons presets : Reset (altitude 2.8), France, Paris, Montmartre — tous via `globe.pointOfView()` avec tween 1.2-1.6s.

**4 lives mockés à Montmartre** (`GT6_PARIS_MOCKS`) concaténés dans `enrichedStreams` pour avoir du contenu visible aux presets Paris/Montmartre : Chef Camille (bistro), Marie-Rose (cabaret), Lucien Petit (neo-bistro), Bruno D. (wine & tapas). Adresses publiques uniquement, pas de vraies données broadcaster.

**FPS sampler** : buffer ring de 60 timestamps dans `fpsBufRef`, flush `setFpsState` toutes les 500 ms. Zéro impact perf (pas de re-render pendant le frame, juste push dans un Array).

**Route** : `/globe-test-6` lazy dans `src/App.jsx`. GlobeTest2 reste intact à `/globe`.

---

## 2026-11-13 — CurrentGlobe : identité Midnight Blue + détail progressif + perf

**Repaint complet CurrentGlobe** (`src/components/globe/CurrentGlobe.jsx`) — tout sur le globe de prod.
- `STYLE_URL` passé de `positron-nolabels` → **`dark-matter-gl-style`** (vector tiles OSM/CARTO avec labels inclus).
- `brightenBaseGlobe` réécrit : nouvelle fonction qui surcharge le paint de **chaque layer** avec la palette Vuvio Midnight Blue définie en constante `PAL`.
- Palette : espace `#030816` · océans `#07182E` · continents `#102B46` (low `#0B1F35`, urban `#17375C`) · routes tiered `#5A7EA0` (motorway) / `#41617C` (primary) / `#2B445C` (minor) · parcs `#164A49` · atmosphère cyan `#248BEB` · marqueurs Live `#36D9A0` · labels `#D8E6F2` + dim `#8EA3BA` + halo `#030816`.
- `setFog` + `setSky` recoloré cyan Vuvio au lieu du gris précédent, `atmosphere-blend` interpolé par zoom.
- **Labels maintenant visibles** (ne sont plus cachés en bloc) : pays/villes/quartiers repeints en palette Vuvio, POI icon-only cachés pour éviter conflit avec Live markers. Détail progressif géré nativement par les `minzoom` du style vector.
- Buildings peints en `landHigh` avec opacité 0.78 pour la lecture urbaine au zoom quartier.
- Zéro imagerie satellite, zéro texture globale étirée — tout rendu depuis les vector tiles.

**Perf CurrentGlobe** (même fichier)
- SVG unsharp-mask filter rendu opt-in via `?sharpen=1` (défaut : désactivé, gros gain GPU).
- `pixelRatio` MapLibre capé à **1** sur mobile (pointer:coarse), **1.25** sur desktop.
- `PULSE_INTERVAL` : 240 → **480 ms** (deux fois moins de `setPaintProperty`).
- Boucle RAF pulse **skippée quand zoom > 3** (markers quasi invisibles au zoom ville, économise 6 `setPaintProperty` par frame).

**Attribution** : OSM/CARTO conservée (obligation licence non-commercial free use), styling MapLibre par défaut.

---

## 2026-11-13 — Globe Test 5 : prototype résolution haute au zoom quartier

Nouveau prototype `/globe-test-5` qui résout le problème de netteté au zoom ville/quartier sans toucher à la prod (`/globe` reste sur GlobeTest2).

**Choix technique : MapLibre GL v5 en `projection: 'globe'`**
- Déjà dans les deps (zéro ajout), pas de Cesium/tiles custom Three.js.
- LOD natif via raster tiles CartoCDN **Dark Matter No Labels** (zoom 0→17).
- Transition globe→plan automatique quand on zoome.
- Atmosphère/halo via `setSky()` natif + overlay starfield canvas (repris de CurrentGlobe).

**Composant** (`src/components/globe/GlobeTest5.jsx`, ~380 lignes) :
- 6 phases pré-cadrées (Globe → Europe → France → Paris → Montmartre → Restaurant), navigables par pills ou raccourcis clavier `1`→`6`.
- 6 lives mockés dont 3 à Paris (bistro Montmartre, peintre Sacré-Cœur, croisière Seine).
- Marqueurs `circle` + glow, taille qui grossit avec le zoom (expressions MapLibre `interpolate`).
- Panneau diagnostic (FPS / zoom / pitch / tiles / load ms / heap MB) activable via `?debug=1`.
- Carte live avec image + bouton Watch quand on clique un marqueur.
- Pas d'auth, pas de bottom sheet, pas de clusters — focus pur sur la démonstration zoom.

**Styles** (`src/styles/pages/globe-test-5.css`) :
- Dark cinématique (#060d16, cyan #28D8DF, violet #B47BFF).
- Pills de phase avec gradient Vuvio, HUD diagnostic en vert.
- Responsive mobile (pills raccourcies, card bottom).

**Route** : ajoutée dans `src/App.jsx` lazy comme les autres `GlobeTest*`.

Bundle : 12.26 kB / 4.70 kB gzip. Zéro nouvelle dépendance.

---

## 2026-11-13 — Fix animation deeplink globe + optimisations lag zoom-out

Problème : navigation `/globe?live=X` affichait le globe zoomé direct (pas d'animation) OU avec un spin rapide au début. Et la fermeture d'un live (croix) laggait pendant le zoom out.

**Animation deeplink in — fix complet** (`src/components/globe/GlobeTest2.jsx`) :
- Ajout `animateIn={false}` sur `<Globe>` — désactive le fly-in par défaut de react-globe.gl qui causait le "spin rapide" au montage.
- Ajout prop `onGlobeReady={() => setGlobeReady(true)}` + state `globeReady` — l'effet deeplink attend que le tween system soit prêt avant `pointOfView`. Sans ça, l'appel était fait avant init du tween system → animation sautée.
- State `povSettled` (false si deeplink) + opacity 0 → 1 sur `.gt2-globe-offset` après snap. Cache la position par défaut du globe pendant 1-2 frames.
- Séquence finale : snap à altitude 2.8 sur target (duration 0) → fade in 220ms → pause 350ms → zoom pur altitude 2.8 → 0.55 sur 900ms → `setSelectedStream(target)` à la fin (1300ms total). `setSelectedStream` est déféré pour ne pas déclencher ringsData / re-render pendant le tween.

**Optimisations lag zoom-out** (`recenter()` + CSS) :
- Tout le state cleanup (`setSelectedStream(null)`, `setExpandedClusterId(null)`, `setSearchParams`, `autoRotate=true`) différé via `setTimeout(720)` — le tween caméra de 700ms tourne sans aucun re-render React concurrent.
- State transient `isClosingSelection` + classe `.is-closing` sur `.test-globe-card` → la carte fade out immédiatement via CSS (opacity+translateY 180-220ms) pendant que le state reste stable.
- `backdrop-filter: blur(22px)` retiré dès `.is-closing` — c'était le plus gros coupable du lag (re-composition GPU du blur à chaque frame du tween).
- CSS marker transition opacity déplacée sur la règle `.has-selected` au lieu de `.gt2-marker` → au déselect, 150+ markers reviennent à opacity 1 instantanément (plus de 150 transitions CSS parallèles qui stuttent).
- `pauseStarsRef` + skip de `drawStars` pendant le close → ~180 arcs canvas 2D par frame (sin/cos/arc/fill) mis en pause pendant le tween.
- `expandedClusterId` cleanup déféré → évite le rebuild de clusters + DOM markers (CSS2DRenderer) pendant l'animation.

---

## 2026-11-11 — 3 POV ajoutés + fixes UX (liveReady, globe landing, positions overlay live)

- **3 POV demo ajoutés** (checklist CLAUDE.md complète) :
  - `street-food-chengdu-pov` — Chen Wei, vendeur night market Chengdu (jiaozi).
  - `kitchen-service-pov` — Mateo Rossi, line cook Milan (service samedi soir).
  - `watercolor-sketch-pov` — Mia Tanaka, illustratrice aquarelle Kyoto.
  - Upload vidéos + thumbnails sur `mock-videos/live-mockups/` (public ACL). Entrées dans `mockVideoUrls.js`, `mockStreams.js`, `mapStreams.js`, et `demoVideoLiveIds` dans `WatchPage.jsx`.
- **Bug fix WatchPage : liveReady** (`src/routes/WatchPage.jsx:2459`) — quand on entre via `/explore/live` → `/watch?live=X&mode=view`, le gating `live.id === liveId` cachait l'UI (streamer, boutons) sur TOUS les lives suivants après swipe. Fix : `liveReady = !liveId || liveFeed.some(item => item.id === liveId)`. Une fois le live demandé dans le feed, l'UI reste visible sur les lives suivants.
- **Landing globe cover plus horizontal** (`src/styles/pages/landing.css`) — `.vuvio-landing__visual img` passe de `object-fit: cover` à `contain` + `object-position: center` pour ne plus cropper les côtés de `landing-cover-globe.png`.
- **Positions overlay live** (`src/styles/pages/live.css`) :
  - `.live-location-globe` top `14px` → `32px` (boussole descendue).
  - `.live-actions` bottom `nav+safe+24px` → `nav+safe+10px` (boutons verticaux descendus).
  - `.live-feed__details` bottom `safe+10px` → `safe+24px` (streamer+ville remontés).

---

## 2026-11-11 — Fix Go Live tap avant caméra prête

- **Bug** : taper "Go Live" avant que la preview caméra soit affichée lançait le live avec `cameraStream=null` → `hasCameraStream: false`, et le viewer tombait sur un POV démo (vélo). Impossible de récupérer le vrai flux, obligeait à relancer.
- **Cause** (`src/components/BottomNav.jsx`) : `handleGoLive` utilisait `streamRef.current` sans vérifier que `getUserMedia` avait résolu (`cameraState === 'active'`).
- **Fix** :
  - `handleGoLive` retourne tôt si `cameraState !== 'active'` ou `!streamRef.current`.
  - Bouton `start-live-go` passe `disabled={cameraState !== 'active'}` — le CSS existant (`opacity: 0.55`, `cursor: not-allowed`) le grise automatiquement.
  - Libellé dynamique : affiche `Starting camera…` / `Camera access denied` / `Camera needs HTTPS` / `No camera available` au lieu de "Go Live" tant que la cam n'est pas prête.

---

## 2026-11-10 — Studio desktop Q&A companion (`/studio`)

- **Objectif** : permettre au streamer de répondre aux questions au clavier depuis un ordi pendant que son téléphone filme (activités statiques type cuisine, moto parkée, lecture, etc.).
- **Route** : `/studio` (auto-détecte le live actif du user connecté via `activeLives` where `creatorUid == uid && status == 'live'`) + `/studio/:liveId` (explicite). Protected route.
- **Fichiers nouveaux** : `src/routes/StudioPage.jsx` — subscribe au live doc + `subscribeToQuestions`, layout 2 colonnes (sidebar sticky avec cover/stats/durée + feed scrollable), textarea desktop (Enter = envoyer, Maj+Entrée = retour ligne), questions non-répondues en premier.
- **Styles** : `src/styles/pages/live.css` append `.studio-*` (~290 lignes). Dark theme, responsive @900px → stack single column.
- **Point d'entrée** : bouton Monitor icon dans `creator-live-hud` (à côté de Share) — un tap copie `window.location.origin/studio` dans le presse-papier + toast "Lien Studio copié". Le streamer colle l'URL dans son navigateur desktop.
- **Backend réutilisé** : `liveQAService.js` (`subscribeToQuestions`, `answerQuestion`) + règles Firestore `activeLives/{liveId}/questions` déjà alignées (update autorisé si `auth.uid == creatorUid`). Aucun changement côté règles.
- **Limites volontaires (MVP)** : pas de preview HLS du live dans le Studio (latence 5-10s pas utile ici — le streamer voit déjà la scène de ses yeux), pas de chat général (focus Q&A uniquement), pas de modération.

---

## 2026-11-10 — Intro V2 cinematic (`/intro-preview`)

- **Objectif** : passer d'un onboarding animé classique à un **voyage visuel continu**. Les éléments de chaque scène deviennent ceux de la suivante.
- **Architecture refonte** : au lieu de scènes `AnimatePresence mode="wait"` qui se démontent, V2 utilise un **root persistant + layers**. Un seul `<video>` POV reste monté en permanence ; sa shape (fullscreen → card → fullscreen → dot) est animée par framer-motion `layout` prop en changeant la className selon la phase. Overlays (Watch/Live/Equipment/Globe/StartLive/Enter) sont des layers indépendants qui apparaissent/disparaissent en `AnimatePresence`.
- **Phases V2** : welcome 7.2s → watch 4.8s → live 5.6s → equipment 4.8s → globe 6.8s → startlive 4.2s → enter 5.2s. **Total ~38.6s** (dans la cible 35-40s).
- **Nouveau montage V2** : `povs-montage-v2.mp4` 6.2s / 2.3MB / 720×1280. 3 clips de 2.3s équilibrés : chef slicing (@93.5s), moto route sinueuse (@18s), VTT descente (@46s). Crossfades 0.35s. V1 préservée (`povs-montage.mp4` + route `/intro-preview-v1`).
- **Transitions clés** :
  - **Welcome → Watch** : POV fullscreen rétrécit vers une carte Live (86% × 46% à 24% du haut), Watch chrome s'assemble autour (header, catégories, meta, bottom nav).
  - **Watch → Live** : la carte s'étend fullscreen via `layout` prop, chat/creator/actions apparaissent. Pulse "tap" sur la carte à 3.4s pour simuler l'interaction.
  - **Live → Equipment** : le Live reste visible (dimmed via `.introv2-live--dim`), sheet bottom slide-up sur 50% de hauteur, 3 items stagger (GoPro, RODE, Chef whites). Backpack halo pulse pendant la phase live pour anticiper.
  - **Live → Globe (signature)** : POV morph vers un **point cyan 14px glow** (z-index 15 au-dessus du globe z-index 12), Globe fade-in en arrière-plan avec camera keyframes (planet → Europe → Paris alt 0.95), 7 points demo apparaissent à 1.8s, rotation auto.
  - **Globe → StartLive** : Globe fade à 35% opacity, StartLive overlay par-dessus, bouton create pulse.
  - **Start → Enter** : phase finale avec halo cyan, logo + tagline + CTA unique "Enter Vuvio". Click = **cyan reveal mask** qui grandit (620ms) puis navigation vers `/watch` — pas d'écran blanc.
- **Globe preload** : lazy import `react-globe.gl` + Image() preload de la texture earth-night **dès phase equipment** (index ≥ 3). Pendant le chargement : backdrop stars CSS visible immédiatement. Camera ne bouge que `ready === true`.
- **Narration pills** : 5 captions courtes (Discover real experiences / Be there. Ask questions. / Discover their gear. / Explore the world, live. / Share your perspective.) qui fade in après 500ms puis sort à la transition.
- **Polish** : exit reveal mask cyan (expand from center), `prefers-reduced-motion` coupe tous les loops. Bouton "Next" caché sur la phase finale pour éviter la redondance avec le CTA. Gradient dim adaptatif pour la phase Watch (clair sur la carte, sombre haut/bas pour lisibilité du chrome).
- **Fichiers nouveaux** : `src/components/intro/v2/IntroOrchestratorV2.jsx` + `v2/layers/{PovLayer,WelcomeLayer,WatchLayer,LiveLayer,EquipmentLayer,GlobeLayer,StartLiveLayer,EnterLayer,NarrationPill}.jsx` ; `src/styles/components/intro-v2.css` (~730 lignes, préfixe `.introv2-*` pour cohabiter avec V1).
- **V1 préservée** : `IntroOrchestratorV1.jsx` + `IntroPreviewV1Page.jsx` + route `/intro-preview-v1`. Montage V1 intact.
- **Build** : `IntroPreviewPage` V2 = 19.47KB (5.49KB gzip), plus léger que V1 (22.15KB). react-globe.gl toujours chunk séparé 2MB.

---

## 2026-11-09 — Landing page vuvio.app + splash après landing

- **LandingPage** (`/`) : page publique bilingue EN/FR (toggle dans la topbar), hero avec cover globe + CTA cyan « Tester l'app », 3 sections info (Vision/Produit/Pour qui), grille 4 features, CTA final + contact `hello@vuvio.app`, footer. CSS responsive (960/780/540px).
- **PasswordGate** : gate sessionStorage sur `vuvio.app` / `www.vuvio.app` uniquement (bypass sur localhost + `vuvio-bf328.web.app`). Hash FNV-like, pas de mot de passe en clair dans le code.
- **Splash déplacé** : `SplashScreen` ne joue plus au boot sur `/`. Il se déclenche *après* la landing : CTA `enterApp()` pose `sessionStorage['vuvio-splash-queued']='1'` puis `navigate('/watch')`. `App.jsx` écoute le changement de location, consomme le flag et affiche le splash 5.5s. Direct `/watch` reste splash-free.
- **Routing** : `/` est maintenant `LandingPage` (hors AppShell). `/watch` reste l'entrée app.

## 2026-11-09 — Intro cinématique « Enter Vuvio » (`/intro-preview`)

- **Montage POV** : `public/intro/povs-montage.mp4` — 14.4s, 720×1280, 3.7MB. 3 clips de 5s avec crossfades 0.6s : chef (Moody Rooster 62–67s), moto (route sinueuse 17–22s), VTT descente (46–51s). Crop vertical centré, léger grading teal, fade-in/out. Poster JPG généré (`povs-poster.jpg`).
- **Route** : `/intro-preview` publique, sans AppShell/BottomNav, lazy-loaded. `IntroPreviewPage` verrouille le scroll body, rend `<IntroOrchestrator>`.
- **IntroOrchestrator** : 6 scènes en `AnimatePresence mode="wait"`, progress bar segmentée animée par RAF, boutons Back/Next/Skip, raccourcis clavier ← → Esc. Respect `prefers-reduced-motion`.
- **Scènes** :
  - `SceneColdOpen` : BrandMark + halo bleu + tagline « See the world through their eyes. » + montage vidéo qui apparaît en fondu derrière.
  - `SceneWatch` : header Watch stylisé, tabs, FeaturedLiveCard animée (parallax + badge LIVE + count-up viewers 0→2847 + spotlight), zoom final avant transition.
  - `SceneLive` : vidéo plein écran, creator pill, chat scripté (4 bulles, délais 900/2100/3400/4700ms), compteur likes incrémenté, actions droite, composer bas.
  - `SceneEquipment` : backdrop flouté, spotlight + bouton Backpack qui secoue, bottom sheet qui monte avec 5 items stagger (GoPro, RODE, Sony, iPhone, chef whites).
  - `SceneGlobe` : `react-globe.gl` lazy, 7 POVs démo, caméra animée via `pointOfView()` en 3 keyframes (planète → Europe → Paris alt 0.85), pill « Demo · 7 POVs » et carte de sélection simulée à la fin.
  - `SceneStartLive` : UI Start Live (pas d'accès caméra — poster à la place), fake BottomNav avec bouton Vuvio+ highlighté, phase finale « Your world. A new perspective. » + CTA Enter Vuvio.
- **Composants nouveaux** : `src/components/intro/{IntroOrchestrator,IntroVideo}.jsx` + `scenes/*.jsx` ; `src/styles/components/intro.css`.
- **Deps** : `framer-motion@14.11.1` installé (compat React 19). Icônes lucide réutilisées.
- **Perf** : Globe lazy-split (2MB chunk à part), videos muted + playsInline + preload=auto, fallback `.intro-video-fallback` si la vidéo échoue, preview camera = image statique (pas un lecteur), reduced-motion coupe les vidéos de fond non essentielles.
- **Pas touché** : OnboardingPage, logique métier, pas de gating first-visit (à faire plus tard).

## 2026-11-09 — Perf globes : sharpening off, cap DPR, mémoïsation

- **GlobeTest2** : `ENABLE_GLOBE_SHARPENING = false` par défaut. Le EffectComposer (RenderPass + UnsharpMask + GammaCorrection) doublait le coût GPU par frame. Opt-in via `?sharpen=1`.
- **GlobeTest2** : cap DPR à 1.5 sur mobile (`matchMedia('(pointer: coarse)')`), 2 sur desktop. `antialias: true` → `false` dans rendererConfig (redondant avec DPR élevé).
- **GlobeTest2** : `enrichedMapStreams` mémoïsé une fois (static), séparé de `createdLives.map(enrichExperience)`. Nouveau `displayedStreams` memoized pour ne pas recréer le filtre htmlElementsData à chaque render.
- **GlobeTest3/4** : `pixelRatio` MapLibre capé à 1.5 mobile / 2 desktop (au lieu de `window.devicePixelRatio` uncapped, qui pouvait monter à 3-4 sur high-DPI).
- **CurrentGlobe** : GeoJSON `buildCollection(liveStreams)` mémoïsé — `source.setData` ne rebuilde plus les features à chaque render.

## 2026-10-25 — Bug fixes : globe zoom, equipment page, React keys, ConversationPage

- **Globe zoom** : altitude `0.28` → `1.2` dans GlobeTest2 — clic boussole depuis WatchPage affichait un gros plan sombre au lieu d'une vue continentale.
- **Equipment page** : bouton "Add equipment" dupliqué supprimé de l'empty state (déjà présent dans le header) ; empty state centré avec `margin-top: 20vh`.
- **React keys** : `LiveRecapPageSimple` — fetch comments enrichi avec `d.id` pour clé stable ; `WatchPage outputStatuses` — keyed par `o.name ?? o.provider`.
- **ConversationPage** : `conversation?.messages.length` → `conversation?.messages?.length` (optional chaining manquant, crash potentiel si conversation devient undefined).
- Build + deploy Firebase OK.

## 2026-10-25 — Fix globe : marqueurs mal géolocalisés / dans l'espace

- **Cause** : Three.js CSS2DRenderer (v0.186) positionne les marqueurs HTML via `element.style.transform` inline, ce qui override la CSS class `transform: translate(-50%, -100%)`. Résultat : le centre de l'élément atterrissait sur le point 3D au lieu du bas (le dot), poussant la bubble à mi-hauteur dans le globe — et pour les hautes latitudes, dans le vide.
- **Fix** : suppression du `transform` CSS (inefficace), remplacement par `padding-bottom: 70px` sur `.gt2-marker`. Calcul : bubble 52px + stem 18px + dot center 3.5px = 73.5px depuis le haut ; padding-bottom 70px → total 147px → center 73.5px = exactement le dot. Le dot ancre la surface, la bubble flotte au-dessus.

## 2026-10-25 — Pages légales complètes : Privacy Policy, Terms of Service, Community Guidelines

- Mise à jour de `legalConfig.js` : date → October 25, 2026 (s'applique à toutes les pages légales).
- Création de `CommunityGuidelinesPage.jsx` (18 sections) avec table des matières dépliable, accessible via `/guidelines`.
- Route `/guidelines` ajoutée dans `App.jsx` (lazy-loaded).
- Lien "Community Guidelines" ajouté dans Settings (groupe support, icône BookOpen), avec traductions EN/FR (`communityGuidelines`).
- Lien "By going live you agree to our Community Guidelines" ajouté dans le Start a Live flow (BottomNav.jsx, juste sous le bouton Go Live).
- Lien "Read the Community Guidelines" ajouté dans ReportProblemPage, au-dessus du formulaire.
- Build + deploy Firebase OK.

## 2026-10-22 — Décision : simplifier la configuration Instagram

- À la demande du propriétaire, enregistrement du parcours cible : URL RTMPS mémorisée/préremplie, bouton d'ouverture de Live Producer, un seul collage de la nouvelle clé par live et confirmation de diffusion dans Instagram.
- Conserver les clés en mémoire pour la session ; ne pas promettre une récupération automatique sans intégration officielle vérifiée.
- Décision et tâche ajoutées à `ADMIN.md`. Aucune implémentation, modification de l'ingestion ou mise en production effectuée ; YouTube reste reporté.

## 2026-10-22 — Première réception image et son confirmée dans Instagram

- Essai réel depuis Vuvio : navigateur → relais local → RTMPS Cloudflare → output Instagram. Le propriétaire confirme image et son dans Instagram Live Producer. Lecture spectateur externe et latence Instagram non vérifiées.
- Cause de l'échec précédent confirmée : le navigateur utilisait encore Cloud Run. Activation du mode existant `/watch?relayLocal=1`, sans changement du Live principal ; WebRTC connecté, codec VP8, `FINAL MODE: rtmps-relay`.
- Relevés locaux : 897 → 1 552 frames reçues, audio non silencieux confirmé, aucune perte RTP déclarée, sortie FFmpeg ~30 fps / 1,01× sur ~2 min 34 s, ~1,78 Mbit/s ; aucun échec FFmpeg au relevé final de 06:21:47 UTC.
- `ADMIN.md` documente la preuve utilisateur, les métriques et les limites : mobile, réseau distant/TURN, durée prolongée, spectateurs et isolation des pannes restent à qualifier. Aucun succès de production annoncé ; YouTube reporté.
- Recommandation : réutiliser le convertisseur et Cloudflare, puis évaluer un seul hôte adapté à ICE après traitement de l'isolation du Live principal. Aucun déploiement, nouveau service ou modification des secrets de production.

## 2026-10-22 — Validation locale du relais WebRTC → RTMPS

- Ordre de validation modifié ensuite par le propriétaire : Instagram en premier, YouTube reporté. Relais local disponible ; attente d'une session Live Producer et d'un fichier privé `/tmp/vuvio-instagram-test.json`. Aucun test de réception Instagram effectué ni déploiement engagé.

- Tests locaux autorisés après audit, sans modification de l'ingestion principale, des secrets de production ou des services déployés. Validation YouTube en attente de l'URL/clé et du lien du live privé/non répertorié du propriétaire.
- Environnement corrigé dans les commandes locales : runtime Node compatible avec le Mac, chemins explicites des certificats HTTPS. ICE direct UDP avec configuration vide explicite ; aucun TURN nécessaire pour la boucle locale, aucun TURN distant validé.
- `relay/server.js` : diagnostics locaux optionnels (ICE/RTP, frames, audio utile, buffers, progression FFmpeg, ressources), collecte ICE sans écraser le logger, séparateur URL/clé RTMP corrigé, secrets masqués dans les logs FFmpeg et cible retirée des logs/réponses, suppression du dump audio partagé.
- Ajout des tests reproductibles `relay/local-test.mjs` et `relay/browser-test.mjs`, avec médias synthétiques ; aucun périphérique réel capturé. Le premier teste une réception RTMPS chiffrée, le second Chrome desktop et une connexion témoin indépendante.
- Mesures sur 60 s : ICE ~89 ms, 862 frames reçues au dernier relevé, 1 738 frames décodées à la sortie ; latence locale médiane 333 ms / p95 635 ms ; encodage à vitesse réelle, aucune perte RTP dans les relevés. Signal 1 kHz retrouvé à plusieurs positions du flux. Ces chiffres ne représentent pas YouTube, un réseau distant ou une caméra mobile.
- Test Chrome ~20 s : vidéo H.264 et son AAC réellement décodés depuis la sortie RTMPS ; fréquence 1 kHz conservée. Après arrêt de la session relais, la connexion témoin continue de recevoir la vidéo et les pistes source restent live. Parcours réel Vuvio non rejoué : défaut de couplage output/ingestion toujours ouvert.
- Limites : fin et alignement audio/vidéo à qualifier (capture audio de 58,65 s sur le test Node de 60 s), paramètres audio historiques non généralisés, Safari/iOS/Android et réception YouTube non validés. Aucun investissement d'hébergement recommandé à ce stade.
- Documentation : `ADMIN.md` contient commandes de reprise, preuves, métriques, coûts et distinction entre RTMPS local et réception plateforme. Aucun build frontend ni déploiement effectué.

## 2026-10-22 — Audit architectural multistream et diagnostic ICE

- Vérification du build `9fae1f37-ada7-452f-b46d-d5edbcfc3dec` terminé avec succès ; révision `rtmps-relay-00009-8r4` prête, digest conforme et 100 % du trafic. Déploiement réussi ne signifie pas médias reçus.
- Documentation officielle Cloudflare vérifiée : WHIP ne fournit actuellement ni HLS/replay ni Live Outputs RTMP/SRT. Le mode recording automatique et une URL HLS construite ne suffisent pas. La documentation actuelle annonce WHEP multi-spectateurs ; aucun changement du player effectué.
- Sonde ICE sur la révision active, sans capture ni média, sans destination réelle : HTTP 200, SDP accepté, answer avec candidats host uniquement, aucun relay, aucune paire nominée ni réponse STUN après 12 s. Session de diagnostic supprimée et fermeture confirmée. Ce test ne valide ni une diffusion ni un navigateur mobile.
- TURN : 404 observés sur le backend pendant les précédents essais ; aucun secret/variable Metered rattaché à la révision API déployée. Le code local prévoit ces secrets. Le fallback public testé n'a pas produit de candidat relay. Validité des credentials Metered non testée ; un nouvel appel sans authentification retourne 401.
- La sonde sans média déclenche aussi ontrack et des callbacks audio : ces logs ne constituent pas une preuve de réception audio/vidéo. FFmpeg attend la première frame décodée, donc l'échec ICE intervient en amont du RTMPS.
- Défauts identifiés, non corrigés : sélection d'outputs qui contourne WHIP sans fallback inverse, statut live dès création API, WHIP déclaré connecté après SDP et HLS annoncé sans preuve, absence de trickle ICE, CPU/session Cloud Run à traiter, paramètres audio et contre-pression à valider après connexion.
- Recommandation soumise à confirmation : conserver Firebase/Cloudflare, réutiliser un seul convertisseur RTMPS sur un hôte adapté après validation locale. Cloud Run avec TURN n'est pas impossible en principe, mais le chemin actuellement testé n'est pas opérationnel. Migration vers une ingestion RTMPS unique rend le relais critique : risque documenté avant changement.
- `ADMIN.md` : preuves, comparaison des solutions, coûts, problèmes restants et matrice Vuvio → YouTube → Instagram → trois destinations, incluant échec isolé d'un output. Aucun test réel plateforme exécuté ; multistream non validé.
- Vérification : `node --check` réussi pour le relais et webrtcService. Aucun build de production nécessaire pour ces modifications documentaires. Aucun changement runtime, déploiement ou nouveau service créé pendant l'audit. Seule la documentation est corrigée ; les problèmes fonctionnels restent ouverts.

## 2026-10-22 — Multistream : YouTube + fix ICE timeout + logging Cloudflare

**Ajout YouTube dans Start Live :**
- `BottomNav.jsx` : bouton YouTube ajouté dans "Broadcast to" (entre Vuvio et Instagram), même UX que Instagram (Configure / Ready)

**Fix ICE timeout relay :**
- `webrtcService.js` : timeout ICE connection 3s → 12s (connexion "connecting" mais timeout avant "connected" sur certains réseaux)
- Ajout `oniceconnectionstatechange` log pour diagnostique futur

**Diagnostic HTTP 404 outputs Cloudflare :**
- `cloudflareClient.ts` : réécriture `createLiveOutput` en raw fetch pour logger le body complet (HTTP status, errors[], messages[]) — permet d'identifier si le 404 vient d'un plan/feature Cloudflare non activé
- Erreur Cloudflare remonte maintenant avec message détaillé dans les Cloud Functions logs

---

## 2026-10-22 — Ajout 3 vidéos POV mockups

Ajout de 3 nouveaux streams mockup POV uploadés depuis `videospov/`.

- **Busy Friday Chef** (`busy-friday-chef-pov`) — Moody Rooster, Wolverhampton UK, cuisine
- **C'était Chaud Weekend** (`cetait-chaud-weekend-pov`) — randonnée Provence, France
- **Goggins Mentality** (`goggins-mentality-pov`) — endurance athlete, San Diego US

Fichiers modifiés : `mockVideoUrls.js`, `mockStreams.js`, `WatchPage.jsx` (demoVideoLiveIds), `mapStreams.js`.

---

## 2026-10-22 — Analytics : Avg. Time on Site

Ajout du tracking de durée de session et de la stat card "Avg. Time on Site" dans l'analytics dashboard.

**Frontend :**
- `analyticsTypes.ts` : ajout de l'event `session_end`
- `analyticsSession.ts` : expose `getSessionCreatedAt()`
- `analyticsService.ts` : `trackSessionEnd(durationSeconds)` + `setupSessionEndTracking()` (listeners `visibilitychange` + `pagehide`)
- `usePageTracking.ts` : appel de `setupSessionEndTracking()` une fois par session
- `AnalyticsPage.jsx` : agrégation `totalSessionDurationSeconds / sessionEndCount` + stat card "Avg. Time on Site" avec icône Clock

**Backend (`functions/src/analytics/ingestEvents.ts`) :**
- Ajout de `session_end` dans `WEBSITE_EVENTS`
- Handler `case 'session_end'` : incrémente `totalSessionDurationSeconds` + `totalSessionDurationSeconds_{env}` et `sessionEndCount` + `sessionEndCount_{env}` dans `websiteStats`

---

## 2026-10-22 — Fix : 4 bugs rouges auth/streaming

**BUG-1 — ForgotPasswordPage** (`src/routes/ForgotPasswordPage.jsx`) :
- Déjà corrigé dans une session précédente : `setSent(true)` n'est appelé que dans le success path, jamais dans le catch.

**BUG-2 — SignupPage Google redirect** (`src/routes/SignupPage.jsx`) :
- Ajout d'un flag `redirecting` dans `handleGoogle` : si `signInWithGoogle()` retourne `null` (flow mobile redirect), `redirecting = true` et le `finally` ne réinitialise pas `setGoogleBusy(false)` — le bouton reste en état busy pendant la redirection comme attendu.

**BUG-3 — webrtcService permission denied** (`src/services/webrtcService.js`) :
- Déjà corrigé dans une session précédente : `NotAllowedError`, `PermissionDeniedError`, `NotFoundError`, `NotReadableError` sont catchés avec des messages utilisateur clairs en anglais.

**BUG-4 — WatchPage HLS fatal error** (`src/routes/WatchPage.jsx`) :
- Quand HLS épuise ses retries, `watchStatus('fallback')` était déjà setté.
- Nouveau : quand P2P épuise également tous ses retries (MAX_RETRIES = 12), `watchStatus('error')` est maintenant setté dans les deux chemins (`.catch` et callback disconnect).
- UI : affiche "Stream unavailable. Try again later." (sans spinner) au lieu du spinner "Connecting live" infini.

---

## 2026-10-16 — Multistream : diffusion simultanée Vuvio + RTMP externe

**Feature : simulcasting vers Instagram / YouTube / RTMP custom**

**Backend — `functions/src/`** :
- `cloudflare/cloudflareClient.ts` : ajout de `createLiveOutput`, `deleteLiveOutput`, `listLiveOutputs` (Cloudflare Live Outputs API)
- `cloudflare/liveOutputHandlers.ts` (nouveau) : handlers `createLiveOutputHandler`, `deleteLiveOutputHandler`, `listLiveOutputsHandler` avec vérification de propriété via `activeLives`
- `index.ts` : 3 nouvelles routes POST/DELETE/GET `/cloudflare/live-input/{id}/outputs`, `DELETE` ajouté aux méthodes CORS

**Frontend — `src/`** :
- `services/streamDestinationsService.js` (nouveau) : gestion des destinations Firestore (URL uniquement) + module-level `sessionDestinations` Map (stream keys session-only, jamais persistées), `createCloudflareOutput`, `deleteCloudflareOutput`
- `components/StreamDestinationSheet.jsx` (nouveau) : sheet de configuration Instagram/YouTube/RTMP custom avec champ stream key (password + eye toggle), note de sécurité "clé jamais sauvegardée"
- `components/BottomNav.jsx` : section "Broadcast to" dans StartLiveFlow, `savedDestinations` chargés depuis Firestore, `registerLiveDestinations` au lancement, pill multistream dans les indicateurs créateur, sheet de statuts par destination
- `routes/WatchPage.jsx` : création des CF Live Outputs après le live input dans `setupBroadcast`, suppression des outputs dans `endLive`, affichage de l'état par destination
- `styles/components.css` : CSS complet pour `start-live-broadcast`, `start-live-dest*`, `dest-sheet*`, `creator-multistream-pill`, `creator-multistream-sheet*`, `start-live-go__sub`

**Fix live ended screen** :
- `WatchPage.jsx` : `prevCreatedLivesRef` détecte maintenant les changements de `status` (pas seulement la disparition du document)
- Direct fallback + broadcast watcher gèrent `status === 'completed'` et `'cancelled'` (le backend `finishStream` écrit `completed`, pas `ended`)
- `broadcastEndedRef` corrige le bug de stale closure dans le fallback direct

**Firestore rules** :
- Nouvelle sous-collection `users/{uid}/streamDestinations/{destId}` avec blocage explicite du champ `streamKey`

**Config nécessaire (non automatisée)** :
- Aucune nouvelle variable d'environnement — les clés Cloudflare existantes (`CF_ACCOUNT_ID`, `CF_API_TOKEN`) sont réutilisées
- Instagram/YouTube : l'utilisateur doit obtenir ses propres Stream URL + Stream Key depuis les plateformes

---

## 2026-10-14 — i18n Equipment : traduction complète de EquipmentKit

**Nouvelles clés i18n dans le namespace `equipment`** (EN + FR) :
- `viewer.*` : titre en 3 parties (titlePart1/titleKeyword/titlePart2), subtitle, activityGroup, recordingGroup, mainBadge, viewProduct, affiliateDisclosure
- `ownership.*` : borrowed, sponsored, brandProvided
- `disclosure.*` : title, body, learnMore
- `gearInLive.*` : title, subtitle, capturedWith, activityGroup, viewLive
- `selector.*` : tous les labels du sélecteur (14 clés dont pluriels et interpolations subcategory)
- `quickAdd.*` : tous les labels du formulaire d'ajout rapide
- `manage.*` : hide, show, setDefault, unsetDefault
- `affiliateLink`, `defaultType`, `item_one`, `item_other`

**`src/components/equipment/EquipmentKit.jsx`** :
- Import `useTranslation` ajouté
- 10 composants branchés sur `t()` : EquipmentBadge, EquipmentCategoryCard, EquipmentItemRow, EquipmentDisclosure, GearInLive, EquipmentSelector, QuickAddEquipmentForm, EquipmentViewerSheet, EquipmentManageActions
- Aucune string EN hardcodée restante dans le composant

---

## 2026-10-05 — Share Live redesign + watermark canvas + Live Recap redesign

**Share Live — nouveau système**
- `src/services/shareService.js` : architecture propre — `getLiveShareUrl`, `buildShareText`, `shareNative`, `shareToWhatsApp`, `shareToFacebook`, `shareToX`, `copyLiveLink`
- `src/services/shareWatermark.js` : watermark canvas 9:16 (1080×1920) avec `toSafeUrl()` (fetch→blob pour contourner le taint CORS), logo Vuvio bas-gauche + "LIVE ON VUVIO" en cyan
- `ShareLiveSheet.jsx` redesign : 1 seul écran, grille 3×2 (TikTok, Instagram, Facebook, WhatsApp, Messages, X), preview thumbnail immédiate + section watermark async, Copy link pleine largeur
- Texte de partage : `"Hey ! I'm live on Vuvio, join me! — {titre}"`
- Watermark généré systématiquement au mount (plus conditionné à `canShareFile()`)
- Bouton "Save to photos" quand watermark prêt
- Facebook : `facebook.com/sharer?u=` (OG tags, pas de watermark image — nécessite backend)

**Live Recap — redesign visuel**
- Tokens design Vuvio (variables CSS) au lieu des couleurs hardcodées
- Vidéo 16:9 avec pill RECAP + bouton play overlay
- Stats 4 cards (2×2 mobile, 4 colonnes desktop), icônes couleur : bleu/violet/cyan/or
- Insight card avec sparkle et `{n} people joined your live`
- Bouton Done → cyan Vuvio (plus de gradient violet/bleu)
- Messages : séparateurs fins, row name+timestamp

---

## 2026-10-05 — Fix flash Watch page après live ended + optimisation connexion viewer

**Fix flash "Watch" au retour depuis live ended**
- Supprimé `setBroadcastEnded(false)` dans les handlers "Back to Watch" et le timer auto-navigate — ce reset prématuré faisait disparaître l'overlay une frame avant la navigation, révélant brièvement le feed
- Ajouté un `useEffect` qui reset `broadcastEnded` + `endedLiveSnap` uniquement quand `liveId` disparaît de l'URL (i.e. après que la navigation soit complète)

---

## 2026-10-05 — Connecting live plus rapide + fix permissions liveQA

**Viewer connection accélérée**
- Ajout d'un fast path `getDoc(activeLives/{liveId})` au montage de `LiveViewer` quand `liveId` est dans l'URL
- `liveReady` devient `true` dès que ce single-doc fetch revient (~50ms) au lieu d'attendre la collection query `where('status','==','live')` (~200-500ms)
- Résultat : viewer connection démarre nettement plus tôt

**Fix Firestore rules — liveQA questions**
- Règles `activeLives/{liveId}/questions` déjà en place mais version déployée était stale
- Re-déploiement `firebase deploy --only firestore:rules` → erreur `[liveQAService] onSnapshot error: Missing or insufficient permissions` disparue

---

## 2026-10-05 — eBay product search : images + fix déploiement Cloud Run

**eBay Browse API (Switch depuis Commerce Catalog API)**
- Passage de `commerce/catalog/v1_beta` → `buy/browse/v1/item_summary/search` (scope `api_scope`) : l'API Catalog exige une approbation eBay spéciale (`invalid_scope`)
- Parsing adapté : `itemSummaries`, `image.imageUrl`, `thumbnailImages[0].imageUrl`, `itemWebUrl`
- Déduplication interne par `brand:normalizedName` avant de retourner les résultats (listings eBay très dupliqués)
- Fetch `limit × 3` items (max 50) avant déduplication pour avoir assez de résultats uniques

**Backfill thumbnails**
- Après déduplication, copie les `thumbnailUrl` eBay vers les produits locaux qui n'en ont pas (même clé `brand:normalizedName`)
- Guards null sur `brand` et `normalizedName` + try/catch pour éviter crash si produit mal formé

**ProductThumbnail — plus d'icône d'erreur**
- Remplacement du fallback `AlertCircle` (icône rouge cassée) par `getCategoryIcon(category)` quand l'image ne charge pas

**EquipmentManagePage — préservation thumbnailUrl**
- `handleProductSelect` préserve maintenant `externalId`, `provider`, `thumbnailUrl`, `sourceProductUrl` lors de la sélection d'un produit eBay

**Fix déploiement Cloud Run bloqué**
- Révision `api-00150-kov` en état "Container import failed" bloquait tous les nouveaux déploiements Firebase
- La révision `api-00152-kif` (créée par un re-deploy) était Ready:True mais sans trafic
- Fix via `gcloud run services update-traffic --to-revisions=api-00152-kif=100`
- Credentials eBay injectés via `functions/.env` (plain env vars) en contournement des secrets Firebase sans alias UUID

---

## 2026-10-05 — Globe navigation fluide + écran "live ended" viewer

**Globe — navigation boussole → live**
- Snap immédiat aux coordonnées cibles (altitude 1.1) avant le zoom-in (0.28), évite le grand pan depuis l'Afrique
- Guard ref `navigatedToLiveRef` : empêche les re-déclenchements multiples du `pointOfView` (effet se retriggait à chaque recompute des clusters)
- `autoRotate = false` quand `?live=` est présent, évite la rotation qui interférait à 300ms pendant l'animation
- Zoom-out vers accueil réduit : 1600ms → 700ms

**Écran "live ended" côté viewer**
- Overlay fixé `position: fixed; z-index: 9000` s'affiche désormais même sans `endedLiveSnap` (fallback "The livestream has ended")
- Détection robuste via `prevCreatedLivesRef` : compare `createdLives` avant/après pour détecter un live disparu, couvre le cas `/watch` sans `liveId` dans l'URL (streamer qui regarde son propre live sur mobile)
- Abonnement Firestore direct sur `liveId` (prop stable) en fallback, indépendant du feed qui recompute
- Fix : timer auto-navigate appelle maintenant `setBroadcastEnded(false)` avant `navigate('/watch')` pour éviter que la Watch page reste en état "ended"

---

## 2026-10-05 — Live Q&A : questions spectateurs + réponses streamer

Fonctionnalité complète de questions/réponses pendant un Live.

**Côté spectateur (LiveViewer)**
- Bouton `HelpCircle` dans `live-actions` → ouvre un composer flottant "Poser une question…"
- La question est sauvegardée dans `activeLives/{liveId}/questions/` (Firestore) avec `type: "question"`, `answered: false`, auteur, avatar, timestamp
- Apparaît immédiatement dans l'overlay chat local
- Quand le streamer répond, la réponse apparaît automatiquement dans le chat overlay avec un label "· Host"

**Côté streamer (CreatorLiveSession)**
- Bouton `MessageCircle` avec badge cyan dans le HUD (à gauche du bouton share)
- Badge affiche le nombre de questions non lues
- Clic → ouvre `LiveQASheet` (bottom sheet 45vh max)
- Liste les questions par ordre décroissant, chaque carte : avatar + prénom + texte + bouton "Répondre"
- Clic "Répondre" → champ inline, rappel de la question, envoi via `updateDoc` (answered: true, answer: {...})
- Questions répondues affichent "Répondu" (badge cyan) et la réponse en bloc teinté

**Architecture Firestore**
- Collection : `activeLives/{liveId}/questions/{questionId}`
- Champs : `text, type, authorId, authorName, authorAvatar, createdAt, answered, answer?: {text, authorId, authorName, createdAt}`
- Questions persistées après la fin du Live pour récap / future Inbox

**Fichiers**
- Nouveau : `src/services/liveQAService.js` (subscribeToQuestions, sendQuestion, answerQuestion)
- Nouveau : `src/components/LiveQASheet.jsx`
- Modifié : `src/routes/WatchPage.jsx` (imports, états, useEffects, boutons, composer)
- Modifié : `src/styles/pages/live.css` (styles HUD badge, sheet, cartes Q&A)
- Modifié : `firestore.rules` (sous-collection questions avec règles create/update/delete)

---

## 2026-10-04 — Analytics : tableau Recent Visitors

Section "Recent Visitors" ajoutée sous les cartes WEBSITE : liste les 30 derniers visiteurs uniques triés par `lastSeenAt` desc, avec first seen, last seen, nb sessions, et badge new/returning.

Bugfix inclus : `website.recentVisitors` assigné avant `const website = {}` → ReferenceError → tous les stats crashaient.

---

## 2026-10-04 — Analytics bugfix : règles Firestore manquantes (websiteStats + visitorActivity)

**Symptôme :** dashboard affichait 0 pour toutes les métriques Website (Sessions, Page Views, Unique Visitors, New Visitors).

**Cause :** `websiteStats` et `visitorActivity` n'avaient aucune règle dans `firestore.rules`. Les lectures client SDK étaient refusées par défaut. Les écritures backend (admin SDK) fonctionnaient — les données étaient bien là.

**Fix :** ajout de `allow read: if isAdmin()` pour les deux collections dans `firestore.rules`. Déployé avec `firebase deploy --only firestore:rules`.

---

## 2026-10-04 — Analytics Phase 3 : Unique Visitors / New / Returning

### Problème identifié et corrigé

- Dashboard Phase 2 affichait **Sessions** là où il fallait **Unique Visitors** — ce sont deux métriques différentes (une session ≠ un visiteur unique)
- Sessions = nb de `session_start` events (peut être > visiteurs si même personne = plusieurs tabs/jours)
- Unique Visitors nécessite une déduplication par `anonymousId`

### Nouvelle collection Firestore : `visitorActivity/{anonymousId}`

- Un document par visiteur unique (clé = `anonymousId` UUID localStorage)
- Champs : `firstSeenAt`, `firstSeenDate`, `lastSeenAt`, `lastSeenDate`, `lastCountedDate`, `totalSessions`
- `lastCountedDate` = date de la dernière fois où ce visiteur a été compté pour un jour donné (dédup par jour)

### Logique de déduplication (`ingestEvents.ts` → `updateVisitorStats()`)

- Sur chaque `session_start` accepté : transaction Firestore sur `visitorActivity/{anonymousId}`
- **Nouveau visiteur** (`visitorActivity` n'existe pas) → `newVisitors++` + `uniqueVisitors++` dans `websiteStats`
- **Visiteur connu, premier retour aujourd'hui** (`lastCountedDate !== today`) → `returningVisitors++` + `uniqueVisitors++`
- **Visiteur déjà compté aujourd'hui** → aucun incrément (juste mise à jour `lastSeenAt`)
- Compteurs env-suffixed aussi : `uniqueVisitors_prod`, `newVisitors_dev`, etc.

### Dashboard mis à jour

- Section WEBSITE : 8 cartes au lieu de 5
  - **Unique Visitors** (primaire, avec delta N-1)
  - **New Visitors** + **Returning Visitors** (cartes secondaires)
  - Sessions, Page Views (cartes secondaires)
  - Registered Users, Sign-ups, Taux Visitor→Signup (dénominateur = `uniqueVisitors`, pas sessions)
- Requêtes `getCountFromServer` sur `visitorActivity` pour les métriques cross-période si besoin

### Fichiers modifiés

- `functions/src/analytics/ingestEvents.ts` — `updateVisitorStats()` + appel sur `session_start`
- `src/routes/AnalyticsPage.jsx` — 8 cartes WEBSITE + requêtes `visitorActivity`

---

## 2026-10-04 — Analytics Phase 2 : Website & Acquisition

### Nouveaux événements Analytics

- `page_view` — déclenché à chaque changement de route (hook `usePageTracking`)
- `session_start` — déclenché une fois par session navigateur avec données d'acquisition
- `sign_up` — déclenché quand un nouveau profil est créé dans AuthContext
- `login` — type disponible (non encore déclenché sur chaque login)

### Tracking SPA

- Nouveau hook `src/hooks/usePageTracking.ts` — écoute les changements de route via `useLocation`
- Normalisation des routes : `/profile/abc123` → `{ pageType: 'profile', pagePath: '/profile/:id' }`
- Routes admin/internal/desktop ignorées
- Composant `<PageTracker />` dans App.jsx

### Session & Acquisition

- `analyticsSession.ts` : méthodes `isNewSession()`, `markSessionStarted()`, `getOrCaptureAcquisition()`
- Capture UTM params (`utm_source`, `utm_medium`, `utm_campaign`) prioritaires sur referrer
- Attribution referrer : google / instagram / facebook / linkedin / twitter / referral / direct
- Données stockées en sessionStorage (per-session)

### Auto-enrichissement des événements

- `analyticsQueue.ts` : `environment` (`production` / `development`) et `deviceType` (`mobile` / `desktop` / `tablet`) attachés automatiquement à chaque événement

### Backend (`ingestEvents.ts`)

- Les événements `page_view`, `session_start`, `sign_up`, `login` sont maintenant acceptés sans `streamId`
- Écriture directe dans `websiteStats/{YYYY-MM-DD}` avec `FieldValue.increment` — pas de scheduled aggregation supplémentaire
- Compteurs par environnement (`pageViews_prod`, `sessions_dev`, etc.)
- Compteurs par page type (`pv_watch`, `pv_explore`, etc.)
- Compteurs par source (`source_instagram`, `source_direct`, etc.)
- Compteurs par device (`device_mobile`, `device_desktop`, etc.)

### Dashboard AnalyticsPage

- Nouvelle section **WEBSITE** : Sessions, Page Views, Registered Users (≠ Visitors), Sign-ups, Taux visitor→signup
- Nouvelle section **ACQUISITION** : Traffic Sources + Top Pages (côte à côte)
- Nouvelle section **CONVERSION** : Funnel Visitors → Signups → Watched Live avec taux entre étapes
- Section **CONTENT** : Stream Views, Live Now, Impressions, Engagement
- Section **LIVE ACTIVITY** : graphique + tableaux existants
- Filtre Environment (Production / Development / All) dans le header
- Label "Registered Users" (pas "Total Users")

### Dev vs Production

- `environment: 'development'` si `import.meta.env.DEV` ou hostname localhost
- `environment: 'production'` sinon
- Dashboard filtre par défaut sur Production
- Les stats dev ne polluent pas les stats production

### RGPD

- `anonymousId` = UUID random, sans fingerprinting, sans IP, sans données personnelles
- Pas d'email/nom dans les événements Analytics
- Les UID Firebase ne sont pas exposés dans le dashboard
- **Note** : un bandeau de consentement cookie devra être ajouté avant le lancement public (RGPD EU require consent for localStorage analytics tracking)

### Fichiers modifiés

- `src/services/analytics/analyticsTypes.ts` — nouveaux types d'événements + champs
- `src/services/analytics/analyticsSession.ts` — acquisition + isNewSession
- `src/services/analytics/analyticsQueue.ts` — auto-attach environment + deviceType
- `src/services/analytics/analyticsService.ts` — trackPageView, trackSessionStart, trackSignUp, trackLogin
- `src/hooks/usePageTracking.ts` — nouveau hook
- `src/App.jsx` — PageTracker
- `src/context/AuthContext.jsx` — trackSignUp sur nouveau compte
- `functions/src/analytics/ingestEvents.ts` — events website + websiteStats writes
- `src/routes/AnalyticsPage.jsx` — nouvelles sections + env filter
- `src/styles/pages/analytics.css` — styles section labels, two-col, funnel

---

## 2026-10-04 — Analytics audit & correction des bugs critiques

### Audit complet de l'Analytics existant

Diagnostic exhaustif du système Analytics custom (pas Firebase Analytics — système entièrement custom avec file d'attente localStorage → endpoint `/analytics/events` → Firestore).

### Bugs corrigés (5 bugs critiques, cause des métriques à zéro)

**Bug 1 — Mauvais endroit d'écriture des stats** (`ingestEvents.ts`)
- Les stats étaient écrites dans `streams/{id}/stats/current` (sous-collection)
- Mais `aggregateStreamStats()` lisait depuis le document racine `streams/{id}`
- Fix : écriture maintenant sur le document racine du stream via `tx.update(streamRef(streamId), update)`

**Bug 2 & 3 — `aggregateCreatorStats` et `aggregateCategoryStats` lisaient le mauvais champ** (`aggregateStats.ts`)
- Lisaient `streamDoc.data().stats` (champ inexistant) au lieu de `streamDoc.data()`
- Fix : lecture depuis le document racine directement

**Bug 4 — Mismatch de nom d'événement pour le comptage unique viewers**
- Les deux fonctions queryaient `eventName == 'viewer_joined'` mais Firestore stocke le nom frontend original `'stream_view_started'`
- Fix : corrigé dans `aggregateCreatorStats` et `aggregateCategoryStats`

**Bug 5 — `stream_view_3_seconds` mappait sur `view_10_seconds`** (`ingestEvents.ts`)
- Fix : mapping corrigé → `view_3_seconds`, case `retention3s` ajouté au switch
- Bonus : case `viewer_left` ajouté pour accumuler `totalWatchTime` depuis `metadata.activeWatchDurationSeconds`

**Bug 6 — `setUserId` jamais appelé** (`AuthContext.jsx`)
- `analyticsService.setUserId()` existait mais n'était jamais appelé au login/logout
- Fix : appelé dans `onAuthStateChanged` callback → tous les événements incluent maintenant le `userId`

### Corrections des poids d'affinité (`aggregateUserAnalytics`)
- Clés corrigées pour correspondre aux noms d'événements réels stockés en Firestore
- `viewer_joined` → `stream_view_started`, `view_10_seconds` → `stream_view_10_seconds`, etc.

### Ce qui fonctionne maintenant (après déploiement functions)
- `impressions`, `viewStarts`, `retention3s/10s/30s`, `skips`, `follows`, `shares`, `totalWatchTime` seront correctement incrémentés sur le document stream
- `aggregateStreamStats` calculera correctement les taux (engagementScore, skipRate, retentionXsRate)
- `aggregateCreatorStats` et `aggregateCategoryStats` liront les bonnes données
- Unique viewers comptés correctement
- `userId` attaché aux événements pour les utilisateurs connectés

### À faire avant de voir les données dans le dashboard
1. Déployer les functions : `cd functions && npm run build && firebase deploy --only functions`
2. Générer du vrai trafic (visites, vues de streams)
3. Attendre le prochain cycle d'agrégation (toutes les 5 minutes)

---

## 2026-09-29 — Session 3 — Profile UX, catégories playlists, cover vide

### Liens sociaux
- Sortis du conteneur `<article>` — affichés librement sous la section infos, avec label "Liens" en petit caps au-dessus
- Police 14px, `margin-top: 20px`, `margin-bottom: 24px`

### Shortcuts profil
- Désormais visibles sur tous les onglets (y compris À propos) — condition `activeTab !== 'about'` supprimée

### Catégories playlists Spotify
- `EditProfilePage` : sélecteur horizontal de catégories (Général + toutes les `ACTIVITY_CATEGORIES` avec icône + couleur)
- Champ `category` sauvegardé dans l'objet playlist Firestore
- `PlaylistsSection` : playlists groupées par catégorie, header icône+label avant chaque groupe
- Badge catégorie coloré sur chaque carte playlist

### Cover vide
- `.creator-cover--empty ~ .creator-profile-content { margin-top: -8px }` — profil remonte automatiquement quand pas de photo de couverture

### Nettoyage
- Bloc "Equipment used / Confirm the gear" supprimé de `EquipmentManagePage`

---

## 2026-09-29 — Session 2 — i18n countdown, socials, mini globe, /discover supprimé

### i18n countdown
- **`countdown.js`** : ajout `makeCountdownLabels(t)` — helper qui construit l'objet labels depuis `t()`
- **`en.json` / `fr.json`** : section `countdown.*` (10 clés : dateUnavailable, liveNow, startingSoon, startsIn, today, tomorrow…)
- **Call sites mis à jour** : `WatchPage`, `HomePage`, `ExplorePage`, `GlobeTest2` passent tous `makeCountdownLabels(t)` aux fonctions `getCountdownState` et `formatLocalSchedule` — plus aucun texte en dur en anglais

### Liens sociaux profil
- **`ProfilePage`** `AboutTab` : `<button>` → `<a target="_blank" rel="noopener noreferrer">` avec href construit proprement
  - Instagram : `https://instagram.com/<username>` (strip `@`)
  - YouTube : `https://youtube.com/@<username>`
  - Website : prefix `https://` si absent
- **CSS** `profile.css` : `.about-section__link` — hover cyan Vuvio + underline

### Mini globe canvas (WatchPage + HomePage)
- **`GlobeMini`** : composant canvas dessinant un vrai globe équirectangulaire centré sur les coordonnées du stream
  - Océan dégradé bleu nuit, continents bleu-ardoise foncé (`rgba(24,64,84)`), contour cyan Vuvio
  - Marqueur cyan à la bonne longitude **et latitude** du stream (bug corrigé : était toujours au centre vertical)
  - Polygones continents améliorés : Amérique du Nord/Sud, Europe, Scandinavie, Afrique, Arabie, Eurasie, SE Asia maritime, Australie, Islande, Japon
  - Spéculaire + halo atmosphère cyan
- Remplace le globe CSS gradient précédent dans les deux pages

### /discover supprimé
- Route `/discover` → `<Navigate to="/watch" replace />`
- Toutes les navigations `navigate('/discover')` et `` navigate(`/discover?live=...`) `` remplacées par `/watch`
- `MapPage` simplifié : plus de branchement `/watch` vs `/discover`
- `ProfilePage` back button : `isOwnProfile ? navigate('/discover') : navigate(-1)` → `navigate(-1)` pour tout le monde

---

## 2026-09-29 — Session 3 — Profil : socials, playlists, shortcuts, i18n

### Liens sociaux
- **Logos en couleur** : Instagram (dégradé), YouTube (rouge), Globe (Lucide) — icônes inline SVG
- **Fix URL YouTube** : strip `?themeRefresh=1` et autres query params du `value` affiché
- **Style** : liste verticale, 15px, pas de pill, icône + username alignés

### Playlists (EditProfilePage + PlaylistsSection)
- **EditProfilePage** : carte playlist redesignée — logo Spotify vert 28px + nom + badge "Spotify" vert + poubelle discrète, plus d'URL brute affichée
- **PlaylistsSection (profil)** : logo Spotify dans le titre, dans le badge plateforme (vert #1ED760) et dans le bouton "Open in Spotify"
- **i18n** : clés `editProfile.*` ajoutées (playlists, playlistName, playlistUrl, playlistAdd, erreurs) + strings en dur remplacés par `t()`

### Shortcuts profil
- **Cachés sur l'onglet About** : `OwnProfileShortcuts` masqué quand `activeTab === 'about'`
- **Style refait** : bloc unique arrondi, rows séparés par fine bordure, 15px, icônes cyan, style liste iOS

### i18n complet
- **`editProfile`** : clé racine ajoutée dans `fr.json` + `en.json` (toutes les clés playlist + images profil)
- **`reportProblem`** : section complète ajoutée (12 catégories, success/error)
- **`terms`** + **`privacy`** : sections complètes ajoutées

---

## 2026-09-29 — Profil stats, confidentialité, pages légales i18n

### Statistiques profil
- **`ProfileStats`** `ProfilePage.jsx` : ajout `totalViews` + `totalLiveHours` en second rang, visible uniquement si `liveCount > 0`
- **`formatHours()`** : nouvelle fonction (k h au-dessus de 1000 h)
- **CSS** `profile.css` : `.creator-stats-wrap` flex column + `.creator-stats--secondary` pour le second rang

### Page stats personnelle `/profile/stats`
- **`CreatorStatsPage.jsx`** : nouvelle page — 4 stat cards (Lives, Abonnés, Vues, Heures) + liste des 50 derniers lives depuis `activeLives` filtré sur `creatorUid`
- **Router** `App.jsx` : route `/profile/stats` (ProtectedRoute)
- **Shortcut** `OwnProfileShortcuts` : "Statistiques" navigue vers `/profile/stats` (était `null`)

### Page confidentialité `/settings/privacy`
- **`PrivacySettingsPage.jsx`** : nouvelle page avec 4 sections — Visibilité du profil, Messages privés, Activité de visionnage, Données & légal
- Réutilise `getMessagePreferences`, `useLiveActivityPrivacy`, localStorage `vuvio:privacy-settings`
- Badges "Bientôt" sur les options non encore implémentées (profil privé, abonnés-only, Explore)
- **Router** `App.jsx` : route `/settings/privacy` (ProtectedRoute)
- **`SettingsPage`** : item "Confidentialité" navigue vers `/settings/privacy`

### i18n — Pages légales
- **`fr.json` + `en.json`** : ajout sections `terms` (19 articles CGU), `privacy` (politique confidentialité complète avec tableaux finalités + conservation), `reportProblem` (formulaire signalement complet avec 12 catégories)
- Toutes les clés manquantes remplies avec du vrai contenu adapté à Vuvio

---

## 2026-09-28 — Session 2 — UX équipement, live badge, recap, étoile

- **Badge LIVE** `ShareLiveSheet` : rouge → cyan Vuvio (`rgba(43,217,200)`) + texte/dot foncé pour le contraste
- **Recap cover** `LiveRecapPageSimple` : image nette au premier plan (thumbFg) par-dessus le fond flouté (thumbBg)
- **Étoile broadcaster** : animation ralentie 1.4s → 2.2s (CSS + timeout JS synchronisés)
- **Supprimer équipement** `EquipmentManagePage` : `window.confirm` supprimé, bouton Remove fonctionne direct sur iOS
- **Équipement profil** : suppression des 47 demo items du seed + filtre `provider !== 'demo'` en localStorage ; `EQUIPMENT_CATALOG` séparé pour lookup des lives mockups (IDs toujours résolus)
- **Nudge équipement** : encadré pointillé cyan affiché en haut de l'onglet Equipment quand vide (remplace "About sponsorships" qui disparaît temporairement)
- **Catégories équipement** : affichées même à 0 item (plus d'empty state qui masquait tout)
- **Firestore** : collection `creatorEquipment` vidée pour tous les vrais profils

---

## 2026-09-28 — QA audit — 4 bugs P1 corrigés

- **BUG-10** `ExplorePage` : follow/unfollow met à jour le bouton immédiatement (état optimiste local, plus besoin d'attendre Firestore)
- **BUG-11** `ConversationPage` : "Watch Live" navigue vers le bon stream (`/watch?live=ID&mode=view`) au lieu de `/watch` sans ID
- **BUG-15** `creatorService.searchCreators` : remplacé le full-scan de la collection `users` par un `where('usernameNormalized', ...)` + `limit(20)` côté serveur
- **BUG-16** `useNotifications` : skeleton maintenu pendant `authLoading` pour éviter le flash "pas de notifs" à l'init

---

## 2026-09-27 — Session 2 — Globe, viewer streaming, live recap

### Globe (`/globe-test-2`)
- Cadre gris transparent retiré de la status bar Live/Recent/Upcoming (suppression `border` + `backdrop-filter`)
- Couleurs des marqueurs par catégorie restaurées via `--marker-color` CSS var depuis `familyColor` → vert `#4CD97B` (earth), orange `#FF8A1F` (air), cyan `#2AB8C8` (water)
- Couleur earth rendue plus vive : `#45B86B` → `#4CD97B`
- Boutons zoom/locate descendus sous la nav bar (`bottom: calc(var(--safe-bottom) + 8px)`)
- Globe remonté : `translateY(16%)` → `translateY(8%)`
- Zoom cluster : offset lat `-5°` → les markers apparaissent légèrement au-dessus du centre écran

### Viewer streaming (WatchPage)
- **Live ended screen** : remplacé render-time detection (buggy) par deux `useEffect` — un track le live réel regardé (`watchingLiveRef`), un détecte sa disparition de `createdLives` et déclenche l'écran
- **Double essais** : effets HLS/P2P et WHEP ne démarrent plus avant `liveReady=true` (plus de run à blanc avec URLs vides avant que Firestore charge)
- **Flash de live aléatoire** : `liveReady` gate les métadonnées (nom, ville, viewers) jusqu'à ce que le bon live soit chargé
- Marqueurs live globe : `--marker-color` CSS var appliqué au dot + stem + animations

### LiveRecap
- Suppression de tous les états "Replay unavailable" / "Replay processing…" dans `LiveRecapPageSimple.jsx` → remplacé par le screenshot du live sans overlay

---

## 2026-09-27 — Viewer UX polish — live ended screen, WHEP race fix, globe & Explore fixes
`🐛 Fix` + `✨ Polish` | Live ended screen, WHEP retry, globe position, Explore card

### Live ended screen (viewer side)
- Ajout détection render-time : quand le live actif disparaît de `createdLives` (broadcaster a terminé), `broadcastEnded=true` + `endedLiveSnap` capturé avant que le feed change
- Corrige la race condition Firestore : la query `status=live` retirait le live du feed avant que l'individual doc listener ne fire → aucun écran "Live ended" n'apparaissait
- Écran affiché 5s avec thumbnail, avatar, nom du broadcaster, boutons "View profile" et "Back to Watch"

### WHEP / HLS race condition (cross-device)
- `anySourceWonRef` : empêche WHEP tardif d'écraser P2P/HLS déjà connecté
- WHEP retry on 409 (stream Cloudflare pas encore prêt) : jusqu'à 10 tentatives toutes les 3s
- `combinedStream.addTrack()` : corrige audio-only quand Cloudflare envoie les tracks dans des streams séparés
- `whepConnectedRef` : empêche l'effet principal de réinitialiser WHEP quand `whepFailed` change

### Globe (`/globe-test-2`)
- Altitude initiale : 2.3 → 2.8 (plus dézoomé)
- Position verticale : `translateY(16%)` → `translateY(8%)` (moins bas)
- Status bar Live/Recent/Upcoming : centrage corrigé (suppression du ciblage `first-of-type`)

### Explore page
- Notification bell sur ProfilePage : ouvre le même NotifPopover que sur Explore
- Clé i18n manquantes pour Messages (`messages.filters.*`, `messages.empty.*`)
- Cluster sheet : max 3 items visibles, scroll pour le reste
- Nouveau live en temps réel : scroll automatique vers le début du live row quand un nouveau broadcaster apparaît

### ReplayPlayer
- Spinner "replay indisponible" remplacé par le thumbnail du live (avec overlay sombre)

---

## 2026-09-26 — WHEP viewer — multi-viewer live WebRTC via Cloudflare
`🚀 Feature` | WHEP, multi-viewer illimité, cross-réseau, ~2-3s latence

### Architecture
- **WHEP** (WebRTC HTTP Egress) : chaque viewer se connecte directement à Cloudflare Stream en WebRTC
- Illimité simultanés, cross-réseau (4G/5G/WiFi/desktop), latence ~2-3s
- Priorité : WHEP → HLS → P2P (fallback)

### Implémentation
- Nouveau `startWhepViewer` / `stopWhepViewer` dans `webrtcService.js`
  - POST SDP offer → Cloudflare → SDP answer → DTLS → stream
  - Livraison du stream uniquement à `connectionState === 'connected'`
  - Timeout fetch 15s + ICE gathering max 8s
- Path WHEP inséré avant HLS dans le viewer effect de `WatchPage.jsx`
- `capturedWhepUrl` déclaré au scope de `setupBroadcast` et écrit dans Firestore (comme `hlsManifestUrl`) dès le démarrage
- Propagation Firestore → `createdLives` élargie à `whepUrl`

### Confirmé en logs
```
[VIEWER] trying WHEP
[WHEP] ontrack: video / audio
[WHEP] connectionState: connecting → connected
[WHEP] DTLS connected — delivering stream
[VIEWER] WHEP connected
```

---

## 2026-09-26 — Multi-viewer live via HLS Cloudflare CDN
`🚀 Feature` + `🐛 Fix` | Multi-viewer, ingest WHIP, Safari HLS

### Objectif
Permettre à des dizaines de viewers simultanés (monde entier, comptes différents) de regarder un même live — pas seulement le premier viewer P2P.

### Architecture retenue
- **WHIP** (WebRTC HTTP Ingest) → Cloudflare Stream → **HLS CDN** pour tous les viewers
- P2P reste comme fallback rapide pour le même WiFi (démarre en parallèle après 3 échecs HLS)
- Relay RTMPS comme fallback ingest si WHIP échoue

### Fix 1 — Firestore write découplé de l'ingest (`WatchPage.jsx`)
- **Avant** : `hlsManifestUrl` écrit dans Firestore APRÈS que WHIP/relay soit connecté → viewers attendaient jusqu'à 25s avant de commencer leurs retries HLS → 60s window gaspillée
- **Après** : Firestore (`hlsManifestUrl` + `cloudflareLiveInputId`) mis à jour IMMÉDIATEMENT après `startBroadcast`. WHIP/relay tournent en background (IIFE fire-and-forget). Viewers ont 60s complètes pour que Cloudflare soit prêt (~25-30s). 

### Fix 2 — Safari HLS : manifest vide + fetch timeout
- Cloudflare peut retourner un manifest `#EXTM3U` valide mais sans segments (pipeline pas encore prêt) → Safari mettait `video.src`, l'erreur déclenchait un retry, 20× → "Reconnecting live"
- Fix : vérifier que le manifest contient `#EXTINF` ou `#EXT-X-STREAM-INF` avant de passer à `video.src`
- Ajout d'un AbortController avec timeout 8s sur le fetch manifest Safari (évite les réponses qui bloquent)
- `MAX_HLS_RETRIES` : 20 → 30 (fenêtre 60s → 90s)

### Ingest status indicator (broadcaster)
- `● HLS active — unlimited viewers` : WHIP connecté
- `● Relay active — unlimited viewers` : relay connecté
- `⚠ Stream not reaching Cloudflare — viewers limited to 1` : les deux ont échoué

### État au déploiement
- Mobile (même WiFi) : fonctionne ✓
- Safari desktop (autre réseau) : fix déployé, résultat à confirmer

---

## 2026-09-26 — Fix écran noir viewer Chrome desktop → mobile
`🐛 Fix` | WebRTC — `connectionState` gating

### Problème
- Viewer mobile voyait écran noir (mais pouvait commenter) quand le broadcaster était sur Chrome desktop
- `ontrack` se déclenche au parsing SDP, bien avant que le DTLS soit terminé et que les frames transitent réellement
- `video.srcObject = stream` + spinner caché immédiatement → vidéo noire jusqu'à la fin du DTLS (ou jamais si cross-réseau)

### Fix — `webrtcService.js` `watchBroadcast`
- `ontrack` capture le stream dans `pendingStream` mais ne le livre plus à WatchPage
- `onconnectionstatechange` livre `pendingStream` uniquement quand `connectionState === 'connected'` (DTLS complet, frames qui transitent)
- `onconnectionstatechange` défini tôt (avant ICE gathering) + check post-`setDoc` pour les cas ultra-rapides (même device)

### Bonus — overlay diagnostic `?debug=viewer`
- Ajouter `?debug=viewer` à l'URL du watch pour voir readyState, conn/ice state, tracks en temps réel depuis mobile

---

## 2026-09-25 — Fix P2P live viewer (écran noir)
`🐛 Fix` | WebRTC signaling + Firestore rules

### Problème
- Viewer P2P voyait un écran noir même si les logs indiquaient "playback started"
- `ontrack` se déclenche au parsing SDP (pas à la réception des frames) → faux positif
- Le `setDoc` du watcher Firestore échouait silencieusement → broadcaster ne recevait jamais la réponse SDP → DTLS incomplet → aucune frame ne transitait

### Fix 1 — Firestore rules (`firestore.rules`)
- Règle watcher simplifiée : `allow create, update` sans restriction sur `watcherUid`
- La restriction `watcherUid == request.auth.uid` échouait pour les viewers authentifiés avec `merge:true`

### Fix 2 — setDoc non-fatal (`webrtcService.js`)
- Answer write wrappé dans try/catch silencieux
- Évite la boucle de retry infinie qui détruisait la connexion P2P fonctionnelle

---

## 2026-09-25 — Globe UX + Explore polish
`✨ Feature` `🎨 Design` | Globe redesign, cluster sheet, live markers

### Globe — marqueurs live
- Points live pulsent en taille (core scale) + luminosité via sinusoïde, chaque point a sa propre phase (désynchronisés)
- Vitesse de pulsation réduite (0.38×) — plus lent et organique
- Halos (rings) adaptatifs : rayon proportionnel à l'altitude (`altitudeRef`), plus petits en zoom proche
- Rayon max rings réduit, opacité basse (0.4), vitesse et période irrégulières par point (hash sur ID)
- `coreBaseScale` stocké dans `markerRefs` pour que l'animation puisse scaler correctement

### Globe — interactions
- Cliquer un live déjà zoomé : garde l'altitude actuelle si elle est déjà plus basse que 1.2 (pas de dézoom)
- Fermer la cluster sheet : revient à la position initiale (lat 10, lng 14, altitude 3.4) ET réactive l'autoRotation

### Globe — cluster bottom sheet redesign
- **Thumbnail** 58×58px, coins arrondis
- **Bouton Watch** pill cyan (`linear-gradient #3ef0e8 → #1ec8d4`) remplace l'icône play
- **Nom créateur** affiché en cyan clair sous le titre du live
- **Double action** : tap sur thumbnail/texte → profil créateur (`/profile/:creatorUid`) ; tap Watch → live
- **Titre contextuel** : "3 lives in Paris" si tous les lives ont une ville, sinon "3 lives nearby"
- Viewers formatés avec `.toLocaleString()` (2,087 au lieu de 2087)
- Sheet plus grande (border-radius 22px), animation avec fade-in

### Explore / Notifications
- Popover notifications : fond opaque `#0e1a2b`, largeur 260px, padding compact
- Message "aucune notification" : padding réduit → popover très compact quand vide

### Divers
- `CurrentGlobePage` simplifié : plus de mode-pill tabs (Current/Test2)
- Firestore rules : watchers subcollection accepte viewers anonymes (`watcherUid = null`)
- `ProfilePage` : suppression du guard "login required" pour les profils publics
- Nav label "Explorer" → "Explore" (fr.json)
- Explore cards (Live Now, Nearby, Upcoming) : passage à CSS grid `grid-auto-columns` — plus de flex + marges négatives

---

## 2026-09-24 — Design finition — Vuvio Product Reference (docs/)
`🎨 Design` | Session design deck présentation

### Pages corrigées
- **Page 1 (cover)** : suppression des blocs texte surchargés, tagline épurée ; ajout de deux téléphones flottants (Watch + Explore) sur la droite pour remplir l'espace vide
- **Page 2** : remplacement photos problématiques, dégradé masquant les labels embarqués
- **Page 3** : grille position-grid fixée à hauteur réelle, formule ancrée en bas
- **Page 4** : remplacement icones sprite par 7 icones neon individuelles (icon-spectateur/createur/marques.png) — bien plus lisibles
- **Page 5** : refonte complète — grille 3×2 égale pour les 6 surfaces (Watch, Globe, Explore, Profil, Replay & Recap, Équipement) ; tous les vrais screenshots app utilisés ; plus de hiérarchie inégale (hero/mini)
- **Page 7** : piliers plus contrastés (backdrop-filter renforcé)
- **Page 8** : business-grid à hauteur fixe, remplit la slide
- **Page 10** : risk-road à hauteur 750px, blockquote ancré sans gap

### Assets ajoutés
- `screens/explore.png`, `screens/profil.png`, `screens/equipement.png` — vrais screenshots app
- `assets/icon-watch.png`, `icon-explore.png`, `icon-globe.png`, `icon-spectateur.png`, `icon-profil.png`, `icon-createur.png`, `icon-marques.png` — icones neon individuelles

---

## 2026-09-24 — Explore UX, notifications popover, fix Edit Profile
`✨ Feature` `🐛 Fix` | Session UI + bugs profil

### Notifications — popover bulle
- Cloche dans `ExploreHeader` ouvre maintenant un popover positionné sous le bouton (plus de page dédiée)
- Backdrop invisible pour fermer au clic extérieur, flèche CSS pointant vers la cloche
- `NotifPopover` + `NotifItem` inline dans `ExplorePage`, réutilise les classes CSS `notif-*`

### Explore — cartes live enrichies
- Ville/pays des lives maintenant affichés en **vert** (`#4cd97b`) sur les miniatures
- Avatar (initiale ou photo) + nom du créateur ajoutés en bas de chaque carte live et nearby

### Fix Edit Profile — sauvegardes perdues
- **Cause racine** : `saveOwnCreatorProfile` envoyait tout `EMPTY_PROFILE_BASE` à Firestore (dont `followingCount: 0`, `liveCount: 0`) → rejeté par les règles de sécurité Firestore → données jamais persistées
- **Fix** : seuls les champs éditables sont envoyés à Firestore (`displayName`, `bio`, `profession`, `city`, `country`, `languages`, `categories`, URLs, `playlists`, `avatarUrl`, `coverUrl`)
- **Fix** : `effect2` dans `EditProfilePage` (reset sur changement UID) supprimé — causait une réinitialisation du formulaire à vide après chaque init
- **Fix** : `setLocalUserProfile` dans `AuthContext` — met à jour le contexte immédiatement après save, sans repassage Firestore
- **Fix** : `loadProfile` dans `AuthContext` — merge les données localStorage (champs éditables) par-dessus les données Firestore au chargement
- Bouton Camera direct sur la photo de profil supprimé (édition photo uniquement via Edit Profile)
- Images base64 (trop volumineuses pour Firestore) strippées avant envoi Firestore, conservées en localStorage

---

## 2026-09-24 — Notifications : système complet (index, dedup, messages, bell profil)
`✨ Feature` | Session notifications — finalisation

### Firestore index
- Ajout index `notifications` (collectionGroup) sur `createdAt DESC` dans `firestore.indexes.json`

### liveNotifications (opt-in fan-out)
- `followCreator` + `unfollowCreator` maintenant synchronisent aussi `liveNotifications` array
- `setLiveNotifications(uid, creatorUid, enabled)` nouveau helper dans `creatorService.js`
- `fanOutCreatorLive` utilise `liveNotifications` au lieu de `followedCreators` + pagination (500/page)

### Cloche profil branchée
- `ProfilePage` : `notificationsEnabled` initialisé depuis `userProfile.liveNotifications.includes(creatorId)` (plus depuis `viewedProfile.notificationsEnabled`)
- Toggle cloche → `setLiveNotifications()` Firestore en temps réel

### Remind me — état persisté
- `getRemindedStreamIds(uid)` dans `notificationService.js` — charge les streamIds déjà rappelés
- `ExplorePage` charge les IDs au mount et les passe en prop `isReminded` aux `UpcomingCard` et `UpcomingDetailSheet`

### notifyNewMessage — Cloud Function
- Trigger `onDocumentCreated('conversations/{convId}/messages/{msgId}')` → écrit `message_received` dans `users/{recipientId}/notifications`
- NotificationsPage : type `message_received` → icône MessageCircle, clic navigue vers `/messages/{conversationId}`

### new_follower deduplication
- Cache doc `users/{creatorUid}/followerNotifCache/{followerUid}` — skip si notifié dans les 24h

---

## 2026-09-24 — Notifications : Cloud Functions fan-out (scope b)
`✨ Feature` | Session notifications Cloud Functions

### Cloud Functions Firestore triggers
- **`fanOutCreatorLive`** — `onDocumentCreated('activeLives/{liveId}')` : quand un live démarre, fan-out vers tous les followers (jusqu'à 500 via `array-contains`) → écrit `creator_live` dans `users/{followerUid}/notifications`
- **`notifyNewFollower`** — `onDocumentUpdated('users/{uid}')` : détecte les UIDs ajoutés à `followedCreators` → écrit `new_follower` dans `users/{creatorUid}/notifications` pour chaque nouveau follower

### Standardisation du path notifications
- `remindScheduledStreams.ts` mis à jour : écrit maintenant dans `users/{creatorId}/notifications` (plus dans `notifications/{creatorId}/items`)
- Tous les types (remind_me, stream_reminder, creator_live, new_follower) dans le même subcollection

### Firestore rules
- Ajout règle `users/{uid}/notifications/{notifId}` : lecture/création/update (read only) pour le propriétaire, write admin SDK depuis les fonctions

### NotificationsPage mise à jour
- Navigation au clic : `creator_live` → `/watch`, `new_follower` → `/profile/:uid`, `stream_reminder` → `/watch`
- Ajout icône `CalendarClock` pour `stream_reminder`

---

## 2026-09-24 — Système de notifications Firestore (backend minimal)
`✨ Feature` | Session notifications

### Architecture notifications
- **`src/services/notificationService.js`** — CRUD Firestore sur `users/{uid}/notifications/{id}` : `subscribeNotifications`, `createNotification`, `markRead`, `markAllRead` (batch)
- **`src/hooks/useNotifications.js`** — hook React avec subscription onSnapshot, `unreadCount`, `markRead`, `markAllRead`
- **`src/routes/NotificationsPage.jsx`** — page dédiée : liste triée par date, état lu/non-lu, "Tout marquer comme lu", skeleton loader, empty state
- **`src/styles/pages/notifications.css`** — styles : items unread surlignés cyan, dot badge, skeleton animé, empty state

### Intégration Explore
- Bell icon dans `ExploreHeader` → navigue vers `/notifications` avec badge de non-lus
- Bouton "Remind me" dans `UpcomingCard` + `UpcomingDetailSheet` → écrit une notification `remind_me` dans Firestore si connecté
- Fallback local si non connecté (state local uniquement)

### Améliorations à faire (scope b — Cloud Functions)
- `new_follower` : fan-out quand quelqu'un te follow
- `creator_live` : alertes quand un créateur suivi part en live
- Aggregation des notifs groupées (ex: "5 personnes ont aimé ton live")

---

## 2026-09-22 — Globe Test 2 : redesign marqueurs HTML (clusters + dots)
`✨ Feature` | Session globe redesign

### GlobeTest2 — marqueurs HTML CSS
- Remplacé le système `objectsData` + `objectThreeObject` (Three.js Sprites avec glow/halo/ripple) par `htmlElementsData` + `htmlElement` (éléments DOM CSS)
- **Clusters** : bulle sombre semi-transparente, bordure cyan, chiffre blanc centré — `.gt2-cluster-marker`
- **Lives individuels** : petit point cyan avec pulse animation — `.gt2-dot-marker`
- **Tap sur cluster → bottom sheet** (au lieu de zoom-expand) : liste des lives de la zone avec image, titre, meta, bouton Play — `.gt2-cluster-sheet`
- Supprimé l'animation breathing RAF complexe (Three.js back-face visibility, glow/halo blink/ripple)
- Conservé : étoiles + étoiles filantes canvas, autorotate, zoom controls, filter bottom sheet, card live sélectionné, rings de sélection

---

## 2026-09-22 — Relay local fonctionnel, fixes relay timing, recap cover & download
`🐛 Fix` `✨ Feature` | Session live relay + recap

### Relay local — setup complet
- Identifié que `VITE_API_PROXY_TARGET` doit être passé comme var shell et non dans `.env.local` (Vite ne lit pas `.env.local` dans `vite.config.js`)
- Commande correcte : `VITE_API_PROXY_TARGET=http://127.0.0.1:5001 npm run dev`
- `functions/.env.local` : `RTMPS_RELAY_URL=https://localhost:8787` (HTTPS, le relay utilise des certs TLS)
- Relay tourne en HTTPS sur port 8787, les certs sont dans `certs/`

### Fix write timer relay — drift pendant montée Chrome VP8
- **Problème :** backup timer à 500ms/max 4 frames = 8fps backup insuffisant pendant la montée en résolution Chrome (318→427→639→854px, ~20-130s). Résultat : replay tronqué + vidéo au ralenti.
- **Fix (`relay/server.js`) :** timer à 66ms (1000/INPUT_FPS) avec max 2 frames/tick → 15fps garanti même pendant la montée Chrome
- **Validation :** `written=N elapsed=Xs target=Xs` parfait sur toute la durée, 3 lives consécutifs ✅

### Firebase Storage rules
- Ajout règle `live-covers/{uid}/{liveId}/{filename}` — 403 corrigé sur l'upload de la photo de couverture

### Page "Live ended" viewer
- Photo de couverture affichée en fond tamisé sur l'écran "ended their livestream"
- Styles `.live-ended-screen__cover` ajoutés dans `live.css`

### Recap card — cover image + download
- `RecapCard` utilisait `liveData.image` (souvent vide) → maintenant `coverImageUrl ?? thumbnailUrl ?? image`
- Pre-fetch de la cover en data URL au chargement → `toPng` (html-to-image) n'a plus d'erreur CORS
- Download et Share image fonctionnels

---

## 2026-09-22 — GlobeTest2 par défaut, clusters, texture locale et doc produit
`✨ Feature` `⚙️ Tweak` `📝 Docs` | Session globe + documentation stratégique

### Routage globe
- `/globe` et `/map` pointent maintenant vers `GlobeTest2Page`.
- `CurrentGlobePage` reste accessible via `/globe-current` et `/map-current`.
- Le switch haut garde le contexte : depuis `/map`, "Current" va vers `/map-current`; depuis `/globe`, il va vers `/globe-current`.
- Préchargement après boot changé vers `GlobeTest2Page`.

### GlobeTest2 — visuel et interaction
- Texture externe `three-globe` rapatriée en local : `public/assets/globe/earth-night-threeglobe-4k.jpg`.
- Texture NASA/GIBS 4K testée puis conservée en asset expérimental : `public/assets/globe/earth-night-4k.jpg`.
- Retour au look couleur de l'ancien globe, sans filtre CSS canvas.
- Points live recalibrés en couleurs plus vives : air `#4f8dff`, earth `#45e56a`, water/default `#27ddeb`.
- Pulsation des points transformée en vrai clignotement de balise : flash court puis retombée nette.
- Auto-rotation coupée quand un live ou un cluster est sélectionné, reprise au recentrage.

### GlobeTest2 — clusters
- Ajout d'un regroupement des lives proches par zone.
- Les zones denses s'affichent comme clusters avec compteur.
- Clic sur cluster : zoom renforcé vers la zone, arrêt rotation, ouverture du cluster.
- Les lives du cluster ouvert sont affichés en rosace avec markers compacts pour distinguer les streams proches.
- La sélection, le ring et la card live utilisent la position visuelle du marker.

### GlobeTest2 — essais abandonnés
- Mode carte tuilée MapLibre testé puis retiré : visuellement trop éloigné de l'expérience globe.
- Bump map locale testée puis retirée : rendu globe gris.
- Couche blanche de clignotement testée puis retirée : effet jugé moins bon que la balise colorée.

### Documentation
- Ajout d'une tâche ouverte sur le flou au zoom proche : tester swap 4K→8K/16K ou limiter le zoom max.
- Création du document produit complet Vuvio : storytelling, fonctionnement, architecture, modèle business, go-to-market et roadmap.
- Intégration des inspirations Strava/Polarsteps : Experiences post-live, profils comme collections, Adventures/Series, globe Discover/mémoire, recap partageable, challenges éditoriaux.

**Build :** non lancé à la demande explicite de ne pas build/deploy sans instruction.

---

## 2026-09-21 — GlobeTest2 tweaks + Splash ralenti
`⚙️ Tweak` | Petite session polish

### GlobeTest2
- Points live agrandis : `coreScale` 0.7→1.1 / 1.8→2.6 ; `baseScale` 6.5→9.5 / 10.5→14.5
- Points désaturés : `#438cff`/`#56df70`/`#32d8e5` → `#8ab3e8`/`#a3d6a9`/`#8fd0d6`
- Core semi-transparent (opacity 0.75)
- Clignotement plus rapide et contrasté : `t * 1.2` → `t * 2.4`, halo opacity 0.10–0.65
- Altitude initiale 4.2 → 3.4 (globe plus grand)
- Globe descendu de 30px (wrapper `translateY(30px)` inclut le canvas d'étoiles)
- Étoiles ~2.25x plus nombreuses (divisor 18000→8000, min 80→180)
- Boutons +/−/center descendus (offset bottom 480→380px)
- Panneau "GlobeTest2 dev" supprimé + states inutilisés nettoyés

### Splash screen
- Durée totale +2s : setTimeout 3700→5700ms
- Animations ralenties : V's 2600→3800ms, Dot delay 1800→2600 / duration 2000→2800, Breath 600→900ms, Glow/Title delay 3000→4400 / duration →1200ms

---

## 2026-09-20 — Follow button, FollowingPage, Edit live, Splash, Bottom nav, color-scheme
`🐛 Bug` `✨ Feature` `⚙️ Tweak` | Session complète

### Bouton Follow dans WatchPage
- Animation identique à l'étoile : 3 icônes `UserPlus` cyan s'envolent en rafale (delays 0/80/155ms) au clic
- `followPulse` + `followBursts` states, keyframe `live-follow-float` dans `live.css`
- `is-pulsing` sur le bouton (220ms)
- Follow déjà fonctionnel (localStorage via `setFollowingCreator`) — animation ajoutée seulement

### FollowingPage — affichage 0 following corrigé
- Cause : `liveCreatorId = live.creatorUid || live.id` donne des IDs comme `surfer-ericeira` que `creatorProfiles` ne connaît pas
- Fix : lookup supplémentaire dans `newPovStreams` → nom, job, ville, image correctement résolus

### Edit live — bouton Cancel dans le sheet
- `ScheduleLiveSheet` accepte `existingLive`, `onCancel` props
- Titre dynamique "Edit live" vs "Schedule a live"
- Bouton rouge "Cancel this live" (icône Trash2) visible uniquement en mode edit
- `manageLive(live)` passe le live sélectionné, `editingLive` state dans ProfilePage
- `UpcomingLiveCard` : `onManage(live)` au lieu de `onManage()`

### Splash screen
- Animations V : 2100ms → 2600ms
- Dot/cercle : 1350ms → 2000ms, délai 1500ms → 1800ms (arrive plus lentement)
- Titre et glow décalés à 3000ms pour suivre le dot
- Durée totale réduite de 1.5s : fade-out 5200ms → 3700ms, unmount 7000ms → 5500ms

### Bottom nav Midnight Sky
- Fond `rgba(3, 17, 32, 0.92)` (quasiment noir) → `rgba(7, 26, 54, 0.94)` (navy en accord avec le gradient du thème)

### iOS color-scheme
- `color-scheme: dark` sur `html` dans `base.css`
- `<meta name="color-scheme" content="dark">` dans `index.html`
- Empêche iOS en mode clair système d'appliquer des couleurs claires aux safe-areas

---

## 2026-09-20 — Live Recap : fixes timecodes, étoile, UX
`🐛 Bug` `✨ UX` | `src/routes/LiveRecapPageSimple.jsx`

- Étoile : couleur `#eab308` (jaune) → `#22c55e` (vert) — cohérent avec la WatchPage
- Timecodes messages : fallback `timestamp - startedAt` quand `liveElapsedSeconds` vaut 0/null
- Tous les messages affichés (plus de cap à 5)
- Debug rows (Live input, Video ID…) déplacés dans le collapsible "Raw data" — pas visibles par défaut
- Note "Replay only available in relay mode" dans la section replay quand pas de replay

**Build :** ✓

---

## 2026-09-20 — Splash screen raccourci de 2s
`⚙️ Tweak` | `src/components/SplashScreen.jsx`, `src/context/AuthContext.jsx`

- Fade-out : `7200ms → 5200ms`
- Unmount : `9000ms → 7000ms`
- Total splash : 7 sec au lieu de 9

---

## 2026-09-19 → 2026-09-20 — GlobeTest2 : polish visuel, stars overlay, zoom compensation
`✨ Feature` | `src/components/globe/GlobeTest2.jsx`

### Zoom compensation & tailles markers
- Formule `zoomScale = clamp(altitude / 4.2, 0.22, 2.6)` — markers grandissent quand on dézoom, rétrécissent quand on zoom in, sans devenir énormes
- Base sizes : `coreScale = lerp(0.7, 1.8)`, `baseScale = lerp(6.5, 10.5)` selon nb de viewers (0 → 2000)
- Altitude initiale : `4.2` (globe entier visible avec marge autour)

### Glow & ripple pulsation
- Fréquence de pulsation : `t * 1.2` (2× plus rapide qu'avant)
- Opacity range : `0.35 + v * 0.50` (plus contrasté)
- Scale range : `0.85 + v * 0.28` (respiration plus visible)
- Halo ripple inchangé : cercle qui s'expand et fade

### Atmosphère
- `atmosphereAltitude={0.20}` (vs 0.12 par défaut, x1.7 plus épaisse)
- `atmosphereColor="#55d8ff"` (cyan un peu plus clair)

### Stars + shooting stars overlay
- Canvas 2D absolute par-dessus le globe, `pointer-events: none`, `zIndex: 1`
- Reprend la logique de `CurrentGlobe.drawAtmosphericHalo` — twinkle multi-fréquence + cross-spike sur étoiles brillantes
- **Étoiles plus petites** : `size = 0.35 + 0.9` (vs 0.7 + 1.6 dans CurrentGlobe)
- **Shooting stars aléatoires** : n'importe quel bord (top/right/bottom/left), direction aléatoire
- **Line-segment ↔ circle test** : skip toute trajectoire coupant le globe (marge 1.05×)
- **Moins fréquentes** : `period 22-46s`, `shootingSlots = altitude > 2.0 ? 2 : 1` (vs 4/2 avant)
- Estimation `globeRadius` à partir de l'altitude via formule FOV : `h / (0.93 * (altitude + 1))`
- Skip complet quand `altitude < 0.9` (zoom proche, étoiles invisibles de toute façon)

### Rendering quality
- `renderer.setPixelRatio(min(devicePixelRatio, 2))` sur retina
- Anisotropy max sur la texture terre (fix flou en angle oblique) — via `scene.traverse` après 1500ms
- Texture reste `earth-night.jpg` (2048×1024) — texture 4K NASA prévue via Firebase si besoin
- **Note** : react-globe.gl utilise une texture unique, pas de tile streaming comme Mapbox — pixellisation légère à haut zoom est intrinsèque

### Close card = recenter
- Bouton X de la card appelle `recenter()` : reset POV `{lat:10, lng:14, altitude:4.2}`, `setSelectedStream(null)`, `autoRotate = true`

---

## 2026-09-18 (session 2) — Splash screen, droits admin, badge profil

### Splash screen
- `SplashScreen.jsx` : réécriture animation SVG — LEFT_V + RIGHT_V glissent depuis les côtés (1500ms), DOT tombe du haut avec rebond (950ms delay 1100ms), titre "Vuvio" fade-in (700ms delay 1900ms)
- Titre : 42px, `letter-spacing: -0.01em`, `text-shadow` (style BrandMark)
- Durée : fade-out à 7.2s, unmount à 9s
- Fix durée : `App.jsx` — `useRef` capture `location.pathname` au mount → le redirect `/` → `/watch` ne tue plus le splash
- Background vidéo conservé (`landing-loop2.mp4`)

### Droits admin — Douglas & Cecilia
- Emails récupérés depuis Firebase Auth : `doug.benchetrit@gmail.com`, `cecilia.ranson@outlook.com`
- Ajout dans les 5 checks admin : `AnalyticsPage`, `AdminDocsPage`, `AdminInvestorCrmPage`, `AdminMarketingPage`, `functions/src/analytics/debugAnalytics.ts`

### Badge admin profil
- `ProfilePage.jsx` : badge "Admin" visible sur le profil des 3 admins (UIDs hardcodés)
- Clique → `/admin`
- `profile.css` : `.profile-admin-badge` — pill cyan avec logo SVG Vuvio miniature

### ADMIN.md
- Suppression de la tâche "Fusionner HomePage + WatchPage en LiveFeed" (fait)

---

## 2026-09-18 — Thème Midnight Sky
`✨ Feature` | `src/styles/`, `src/context/`, `src/routes/SettingsPage.jsx`

### Remplacement du thème Blue par Midnight Sky
- Suppression des thèmes `vuvio-blue` et `ink-blue` (tokens + fichiers CSS)
- Nouveau thème `midnight-sky` : palette navy profond (`#07172D` → `#0D2948`), mint `#48E6C1`, bleu `#2386D1`
- `tokens.css` : bloc `[data-theme="midnight-sky"]` avec variables sémantiques complètes
- `theme-midnight-sky.css` : overrides composants (nav, explore, auth, settings, modals, inputs…)
- `main.jsx` : import mis à jour (`theme-midnight-sky.css` remplace les deux anciens fichiers)
- `SettingsPage.jsx` : sélecteur réduit à 2 swatches — **Dark** + **Midnight Sky**
- `ThemeContext.jsx` : migration automatique localStorage (`vuvio-blue`/`ink-blue` → `midnight-sky`)
- Thème Dark (`:root`) intact, aucune régression

### Background photo Midnight Sky
- Image : 3ème panneau (ciel étoilé / Voie Lactée) extrait du moodboard de référence
- Upload Firebase Storage : `assets/themes/midnight-sky-bg.jpg` (public)
- `body` + `.app-canvas--desktop` : image fixe en `cover` + overlay navy semi-transparent
- Pages (Explore, Home, Messages, Profile, Settings…) : `background: transparent` → l'image transparaît
- Splash, Auth, Onboarding : image directement en fond avec overlay dédié
- Cards avec `backdrop-filter: blur()` pour effet verre sur le ciel

**Build :** ✓

---

## 2026-09-17 — Relay RTMPS, splash screen, équipements, trust score, prefetch HLS
`✨ Feature` `🐛 Bug` `📄 Docs` | Session complète — nombreux fichiers

### Fix relay RTMPS (replay tronqué)
- `relay/server.js` : ajout `scaleI420()` — scaling YUV420p en JS vers `854×480` fixe, FFmpeg ne redémarre plus jamais sur upgrades de résolution Chrome (318×180 → 854×480 sur ~20s)
- Avant : chaque upgrade = nouveau segment Cloudflare = replay tronqué. Après : `ffmpegStart#1` seulement, replay pleine durée ✓
- Timer live (`recordingActive`) : démarre quand le relay confirme la connexion, pas au clic "go live"
- ReplayPlayer : retry automatique sur erreur 424 (Cloudflare encore en processing)
- Commits : `2bbd088` `6e7283c` `aab8520` `d0f07f9` `e7b69bc`

### Splash screen
- Nouveau logo PNG (`public/assets/logo/vuvio-logo.png`) — forme vv, dégradé bleu→cyan, fond transparent
- `SplashScreen.jsx` : utilise `<img>` avec `drop-shadow` teal + animation fade-in
- `components.css` : `.splash-screen__logo-img` + `.splash-screen__brand-name`

### Équipements — 0 par défaut sur les nouveaux comptes
- `equipmentService.js` : `seedItems = []` (au lieu de `demoEquipmentItems`) pour les deux fonctions `getEquipmentLibrary`
- Migration Firestore supprimée (Firestore toujours prioritaire sur localStorage)
- Script `functions/scripts/clearAllEquipment.js` : suppression des 137 documents `creatorEquipment` existants

### Consolidation docs admin
- Suppression des redondances entre `README.md`, `ADMIN.md`, `AGENTS.md` et `docs/`
- `ADMIN.md` recentré sur les tâches ouvertes et sources de vérité
- `docs/moderation.md` créé : plan complet modération vidéo (Vision API SafeSearch) + trust score interne

### Trust Score interne
- `functions/src/users/updateTrustScore.ts` : score 0–100, tiers `new/standard/trusted/at-risk/suspended`
- Appelé depuis `endStream.ts` à chaque fin de live (fire-and-forget)
- Scheduled function quotidienne `updateTrustScoresScheduled`
- `listLiveStreams.ts` : filtre `at-risk` et `suspended` du globe et de l'explore
- Onglet **Moderation** dans AdminDocsPage : créateurs avec score, tier et filtres

### Prefetch HLS viewer (réduction délai au clic)
- `WatchPage.jsx` : prefetch manifests HLS adjacents au changement d'index
- `ExplorePage.jsx` : prefetch manifest au survol (`onMouseEnter`) des cartes live
- HLS.js : `startFragPrefetch: true`, `maxBufferLength: 8`, `liveSyncDurationCount: 2`

### AdminDocs — source unique
- History : lit `CHANGELOG.md` directement (plus de copie statique en dur)
- Open Tasks : parsées depuis `ADMIN.md` au build (plus de `ADMIN_TASKS` hardcodé)
- Onglet Moderation ajouté

**Build :** ✓

---

## 2026-09-09 — Refonte admin docs en cockpit
`✨ UX` | `AdminDocsPage.jsx` `admin-docs.css` `CHANGELOG.md`

**Contexte :** La page `/admin/docs` était difficile à lire parce qu’elle affichait surtout un lecteur Markdown brut.

**Fix :**
- Ajout des onglets `Overview`, `Tasks`, `History`, `Docs`, `Rules`
- Mise en avant des tâches ouvertes, sources de vérité, règles critiques et historique récent
- Historique branché automatiquement sur `CHANGELOG.md`

**Build :** ✓

---

## 2026-09-09 — Fix scroll équipement sur mobile
`🐛 Bug` | `HomePage.jsx` `EquipmentKit.jsx` `components.css`

**Problème :** Sur mobile, scroller dans le sheet équipement déclenchait le swipe de navigation du live feed.

**Cause :** `HomePage.jsx` a sa propre copie du live feed swipeable avec son propre `onPointerDown`, sans protection contre le sheet équipement. Les portals React (`createPortal`) font remonter les events via l'arbre React (pas le DOM) — les pointer events du sheet atteignaient donc le handler du live feed.

**Fix :**
- `HomePage.jsx` `onPointerDown` : ajout `if (equipmentSheetOpen) return;` + `.equipment-viewer-sheet` dans `closest()`
- `HomePage.jsx` `onPointerMove` : ajout `if (equipmentSheetOpen || !pointerStart.current) return;`
- `EquipmentKit.jsx` : ajout `stopPropagation` sur tous les pointer events du container sheet

**Testé :** iPhone ✓

**Dette identifiée :** `HomePage` et `WatchPage` ont leur live feed dupliqué → à fusionner en `<LiveFeed>` partagé (suivi dans `ADMIN.md`).

---

## 2026-09-04 — Simplification UX "Start a live"
`✨ UX` | `BottomNav.jsx` `components.css`

**Contexte :** Lancement d'un stream quasi immédiat : + → preview caméra → texte → catégorie → Go Live.

**Constat :** La grande majorité du travail était déjà fait dans `StartLiveFlow`. Seule modification réelle : panel "More categories" — suppression des labels groupe Air/Earth/Water, affichage flat trié alphabétiquement.

**Build :** ✓ 2475 modules

---

## 2026-09-03 — Consolidation docs + création journal
`📄 Docs` | `journal.architecture.md`

Lecture de tous les fichiers mémoire + exploration codebase. Consolidation d'une vingtaine de `.md` épars en un journal unique. Correction section streaming (relay RTMPS revert le 20 août, commit `6d49ac3`).

---

## Sessions non documentées (août–sept 2026)
`git log` pour détail — analytics Firestore fixes, RTMPS relay ingest, HLS-first playback, webhook fix, analytics resilient queries.
