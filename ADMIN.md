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
| 🔴 Haute | Fusionner `HomePage` + `WatchPage` en `<LiveFeed>` partagé | Code live feed dupliqué, bugs asymétriques |
| 🔴 Haute | Décider la stratégie replay/enregistrement | RTMPS relay revert le 2026-08-20, Cloudflare WHIP n'enregistre pas automatiquement |
| 🟡 Moyenne | Refaire les clusters du globe | Repartir par altitude et vérifier les counts après zoom |
| 🟡 Moyenne | Bascule `/globe` vers GlobeTest2 | MapLibre encore utilisé sur `/globe` |
| 🟡 Moyenne | Migration gear localStorage → Firestore | Chemin Firestore préparé, migration non faite |
| 🟠 Basse | Extraction i18n — 350+ chaînes hardcodées | Non planifié |
| 🟠 Basse | Tracking affilié équipement (clics/commission) | `affiliateUrl` présent, backend manquant |
| 🟠 Basse | Messagerie Firestore | Schéma doc, non implémenté |

---

**URL prod :** https://vuvio-bf328.web.app
