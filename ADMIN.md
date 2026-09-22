Status: Current
Read before coding: Check open tasks and current project decisions before changing docs, admin, globe, or streaming behavior.

# Admin — Vuvio

Point d'entrée unique pour naviguer dans la doc du projet.

---

## Changelog
→ [`CHANGELOG.md`](./CHANGELOG.md) — Historique des sessions (ce qui a été fait, quand, pourquoi)

---

## Sources de vérité

| Sujet | Source |
|-------|--------|
| Règles critiques pour agents IA | [`AGENTS.md`](./AGENTS.md) |
| Tâches ouvertes et arbitrages | `ADMIN.md` |
| Historique des sessions | [`CHANGELOG.md`](./CHANGELOG.md) |
| Vue d'ensemble produit/architecture | [`journal.architecture.md`](./journal.architecture.md) |
| Détail technique par domaine | [`docs/`](./docs/) |

---

## Tâches ouvertes

| Priorité | Tâche | Contexte |
|----------|-------|---------|
| 🔴 Haute | Déployer le relay sur VPS OVH avant bêta publique | Cloud Run bloque UDP/ICE — replay impossible en prod sans VPS. Voir `docs/streaming/relay-infrastructure.md` |
| 🟡 Moyenne | Refaire les clusters du globe | Repartir par altitude et vérifier les counts après zoom |
| 🟡 Moyenne | Vérifier `/globe` → GlobeTest2 après déploiement | `/globe` et `/map` pointent maintenant vers GlobeTest2 ; vérifier rendu build/prod |
| 🟡 Moyenne | GlobeTest2 — tuiles carte au zoom proche | Remplacer la texture raster (pixelisée au zoom) par des tuiles MapLibre en projection globe (MapLibre 3+ `projection: 'globe'`). Déjà dans le projet. Garder les étoiles/marqueurs en overlay HTML/CSS. |
| 🟡 Moyenne | Migration gear localStorage → Firestore | Chemin Firestore préparé, migration non faite |
| 🟡 Moyenne | Interface admin override trust score | Voir et modifier manuellement le tier d'un créateur |
| 🟡 Moyenne | Implémentation modération vidéo (Vision API) | Architecture documentée dans `docs/moderation.md` |
| 🟠 Basse | Extraction i18n — 350+ chaînes hardcodées | Non planifié |
| 🟠 Basse | Tracking affilié équipement (clics/commission) | `affiliateUrl` présent, backend manquant |

---

**URL prod :** https://vuvio-bf328.web.app
