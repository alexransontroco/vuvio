Status: Current

# Changelog — Vuvio

Historique des sessions de travail, du plus récent au plus ancien.

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
