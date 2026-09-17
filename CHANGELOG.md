# Changelog — Vuvio

Historique des sessions de travail, du plus récent au plus ancien.

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
