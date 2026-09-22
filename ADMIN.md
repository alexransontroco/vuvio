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

## Agents IA

→ [`docs/agents.md`](./docs/agents.md) — Documentation complète des agents, exemples d'utilisation, flows couverts, historique des audits.

| Agent | Rôle | Lancer avec |
|-------|------|-------------|
| `vuvio-qa` | Audit code, bug reports, régressions | `"run a QA audit on [feature]"` |
| `vuvio-product` | Évaluation features, scope MVP | `"vuvio-product: évalue l'idée de [X]"` |
| `vuvio-launch` | Créateurs, outreach, séquence lancement | `"vuvio-launch: trouve des créateurs [X]"` |

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

## Bugs QA — Audit 2026-09-23

Audit initial des 5 flows critiques (auth, Watch, Globe, Start Live, streaming).

### 🔴 MAJEURS

| ID | Flow | Fichier | Problème |
|----|------|---------|---------|
| BUG-1 | Auth | `src/routes/ForgotPasswordPage.jsx:23-26` | `setSent(true)` appelé même en cas d'erreur → l'utilisateur voit toujours "Email envoyé" même si ça a échoué |
| BUG-2 | Auth | `src/routes/SignupPage.jsx:74-102` | Google Sign-In mobile : `setGoogleBusy(false)` jamais appelé sur le flow redirect → bouton bloqué indéfiniment |
| BUG-3 | Start Live | `src/services/webrtcService.js:395` | Permission caméra/micro refusée → `DOMException` non traduite, aucun message clair à l'utilisateur |
| BUG-4 | Watch | `src/routes/WatchPage.jsx:2302-2320` | HLS playback fatal error → fallback silencieux, spectateur sans feedback visuel |

### 🟡 MINEURS

| ID | Flow | Fichier | Problème |
|----|------|---------|---------|
| BUG-5 | Auth | `src/routes/ForgotPasswordPage.jsx:14,19` | Validation email vide sans message d'erreur visible |
| BUG-6 | Globe | `src/components/globe/GlobeTest2.jsx:42-106` | `expandedClusterId` peut pointer un cluster qui n'existe plus après refresh des données |
| BUG-7 | Start Live | `src/routes/LivePage.jsx:30-50` | Pas de skeleton/loader pendant la vérification d'autorisation → rendu `null` silencieux |
| BUG-8 | Auth | `src/routes/SignupPage.jsx:35,88` | Signup ignore `returnTo` → redirige vers `/profile` au lieu de la page d'origine |

---

**URL prod :** https://vuvio-bf328.web.app
