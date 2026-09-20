# Changelog — Vuvio

Historique des sessions de travail, du plus récent au plus ancien.

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
