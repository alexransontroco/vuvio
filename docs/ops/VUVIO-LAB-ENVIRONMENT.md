# Vuvio-Lab — Environnement expérimental

Status: Current
Last reviewed: 2026-11-18 (finalisation : badge LAB, `npm run lab`, persistance émulateurs, stubs CF/Amazon/Awin)
Read before coding: Required avant tout dev multi-worktree, modif Firebase emulators, ou transfert de feature du lab vers la prod.

## Contexte

Vuvio-Lab est une copie expérimentale de Vuvio créée via **git worktree**. Elle permet de prototyper librement (features, refactos, tests de dépendances) sans risquer de casser la prod (`vuvio-bf328`) ni la worktree stable.

- **Chemin Lab** : `/Users/alexandreranson/Desktop/Vuvio-Lab`
- **Chemin stable** : `/Users/alexandreranson/Desktop/vuvio`
- **Branche Lab** : `experimental` (poussée sur `origin/experimental`)
- **Branche stable** : `main` (et autres branches en cours)
- **Les deux worktrees partagent le même `.git` sous-jacent** mais chaque dossier a son working tree indépendant.

## Architecture d'isolation

| Dimension          | Vuvio stable                             | Vuvio-Lab                                        |
|--------------------|------------------------------------------|--------------------------------------------------|
| Chemin             | `~/Desktop/vuvio`                        | `~/Desktop/Vuvio-Lab`                            |
| Branche git        | `main` / `phase-4-*`                     | `experimental`                                   |
| Port Vite          | `5173`                                   | `5174` (via `npm run dev` → `vite --port 5174`)  |
| Firebase           | Projet réel `vuvio-bf328`                | Émulateurs locaux (Auth 9099, FS 8080, Storage 9199, Functions 5001) |
| `.firebaserc`      | `default: vuvio-bf328`                   | `default: vuvio-lab-emulator` (fictif)           |
| `.env.local`       | Clés Firebase prod                       | `VITE_FIREBASE_PROJECT_ID=vuvio-lab-emulator`    |
| `package.json`     | `name: vuvio`                            | `name: vuvio-lab`, `version: 0.1.0-lab`          |
| Node runtime Functions | `nodejs22`                           | `nodejs20` (Node 22 requiert macOS 11+)          |
| `functions/.env`   | Credentials réels (CF, Amazon, Awin…)    | Stubs `lab-stub-do-not-use` partout              |
| Deploy prod        | Autorisé (`firebase deploy …`)           | **Bloqué** par guard script + fake project id    |
| Badge UI           | —                                        | Pastille rouge/orange `LAB` top-left             |

## Protections techniques contre un deploy prod depuis le Lab

Quatre couches défensives empêchent qu'un déploiement lancé depuis Vuvio-Lab n'atteigne `vuvio-bf328` :

1. **`scripts/guard-no-prod-deploy.js`** — invoqué via `predeploy` hooks dans `firebase.json` pour `hosting`, `functions`, `firestore`, `storage`. Affiche un message rouge et exit 1.
2. **`.firebaserc`** — `default: vuvio-lab-emulator` (projet qui n'existe pas). Même si le guard était contourné, `firebase deploy` échouerait à l'authentification du projet.
3. **`package.json` → `scripts.deploy`** — définit `deploy` comme `exit 1` avec un message explicite. Protège les workflows automatisés qui feraient `npm run deploy`.
4. **`src/firebase.js` — garde runtime** — l'app refuse de s'initialiser si `VITE_FIREBASE_PROJECT_ID` ne commence pas par `vuvio-lab`, et si `VITE_USE_EMULATORS != "1"`. Impossible d'ouvrir le Lab en pointant par erreur sur un projet réel.

### Pas de fallback silencieux vers la prod

- Les stubs de `functions/.env` (`lab-stub-do-not-use`) cassent explicitement tout appel sortant vers Cloudflare Stream / Amazon PA / Awin / eBay si une fonction est déclenchée.
- `.env.local` remplace également `VITE_API_PROXY_TARGET` pour pointer `http://127.0.0.1:5001` (émulateur Functions local) — jamais `api-4clo52m3sq-ew.a.run.app` (Cloud Run prod).
- Firebase Cloud Messaging n'a pas d'émulateur officiel ; avec projectId fictif, aucune notif réelle n'est envoyée.

**Pas de GitHub Actions** dans ce repo au moment de la mise en place (vérifié : `.github/workflows/` n'existe pas). Si un workflow est ajouté plus tard, il faut explicitement exclure la branche `experimental` du trigger de deploy.

## Lancer les deux environnements en parallèle

### Terminal 1 — Vuvio stable (prod-like)

```bash
cd /Users/alexandreranson/Desktop/vuvio
npm run dev                   # http://localhost:5173
```

### Terminal 2 — Vuvio-Lab (émulateurs + Vite en une commande)

```bash
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm install                   # première fois seulement
npm --prefix functions install # première fois seulement
npm run lab                   # lance émulateurs + Vite, Ctrl+C arrête tout proprement
```

- UI Firebase : http://127.0.0.1:4000
- App Lab : http://localhost:5174 (badge rouge `LAB` top-left)

### Alternative — lancement séparé (deux terminaux)

```bash
# Terminal 2a
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm run emulators             # émulateurs + persistance .emulator-data/

# Terminal 2b
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm run dev                   # http://localhost:5174
```

### Node version

- Le Lab utilise `nodejs20` (déclaré dans `.nvmrc`, `firebase.json`, `functions/package.json`) car **Node 22 requiert macOS 11+** et la machine tourne encore sous Catalina 10.15.7.
- Si tu as `nvm` : `nvm use` lit `.nvmrc` et switche automatiquement. Sinon, Node 18 (ta version actuelle) marche aussi, avec un warning `EBADENGINE` sans conséquence.
- La version stable (prod) reste sur `nodejs22`.

### Persistance des données

- `.emulator-data/` contient un snapshot auto-exporté à l'arrêt propre (`Ctrl+C`) et ré-importé au prochain lancement.
- Les users créés, documents Firestore, blobs Storage et comptes test survivent entre sessions.
- Pour repartir d'une base vide : `rm -rf .emulator-data/* && npm run lab`.
- `.emulator-data/` est gitignoré — rien ne part dans le repo.

## Sauvegarder une expérimentation

Depuis le Lab :

```bash
cd /Users/alexandreranson/Desktop/Vuvio-Lab
git add -A
git commit -m "lab: <description>"
git push                      # pousse sur origin/experimental
```

## Transférer une feature du Lab vers la prod

**Règle** : jamais de merge `experimental` → `main`. Cherry-pick uniquement, feature par feature.

Depuis la worktree stable :

```bash
cd /Users/alexandreranson/Desktop/vuvio
git checkout main
git fetch origin experimental
git log origin/experimental --oneline       # repérer les SHAs à promouvoir
git cherry-pick <sha1> [<sha2> ...]
# tester localement
npm run build
# déployer
firebase deploy --only hosting:vuvio-bf328
```

En cas de conflit sur un cherry-pick : résoudre, `git add`, `git cherry-pick --continue`.

## Supprimer / recréer le Lab

### Supprimer la worktree sans toucher à la branche

```bash
cd /Users/alexandreranson/Desktop/vuvio
git worktree remove /Users/alexandreranson/Desktop/Vuvio-Lab
# la branche `experimental` reste sur origin
```

### Recréer à l'identique

```bash
cd /Users/alexandreranson/Desktop/vuvio
git worktree add /Users/alexandreranson/Desktop/Vuvio-Lab experimental
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm install
```

### Reset total (⚠️ supprime les expérimentations non mergées)

```bash
cd /Users/alexandreranson/Desktop/vuvio
git worktree remove -f /Users/alexandreranson/Desktop/Vuvio-Lab
git push origin --delete experimental
git branch -D experimental
# puis recréer : git worktree add ../Vuvio-Lab -b experimental main
```

## Limitations et points de vigilance

- **Cloudflare Stream, eBay API, Awin, Amazon PA API, Segment, etc.** — pas d'émulateur. Si une feature expérimentale touche ces services, utiliser des stubs/mocks dans le code ou un sandbox account dédié. **Ne jamais réutiliser les clés prod** dans `.env.local` du Lab.
- **Firestore rules** — les règles `firestore.rules` du Lab sont chargées par l'émulateur. Les modifier localement est sans danger (ne partent pas en prod). Les porter vers la prod via cherry-pick si besoin.
- **Dépendances `functions/`** — l'émulateur Functions utilise le code TypeScript compilé de `functions/lib/`. Après modif, lancer `npm --prefix functions run build` dans le Lab avant de relancer les émulateurs.
- **`mockVideoUrls.js`** — pointe vers `storage.googleapis.com/vuvio-bf328.firebasestorage.app/…` (prod). Lecture seule, pas de risque, mais la vidéo ne s'affichera pas si pas de connexion. Pour tester 100% offline, uploader les mocks dans l'émulateur Storage.
- **Service Workers / PWA** — si la Lab et la prod sont ouvertes dans le même navigateur sur `localhost:5173` et `:5174`, le SW peut mélanger les caches. Préférer deux profils de navigateur distincts.
- **Push notifications** — Firebase Cloud Messaging ne supporte pas d'émulateur officiel. Les notifs testées dans le Lab utiliseront les clés de l'app Firebase configurée dans `.env.local` (ici fictive → pas de notifs). Tester les notifs sur la prod stable uniquement.
- **Pas de CI auto-deploy actuel**, donc aucun risque passif. À re-vérifier si un workflow GitHub Actions est ajouté.

## Badge LAB dans l'UI

Pastille permanente rouge/orange en haut à gauche, visible sur toutes les routes. Pulse rythmée pour distinguer du logo d'app.

- Composant : `src/components/LabBadge.jsx`, style `src/styles/components/lab-badge.css`, monté une seule fois depuis `AppShell.jsx`.
- Désactiver temporairement pour screenshots : ajouter `?nolab=1` à l'URL.
- Respecte `prefers-reduced-motion` (la pulse s'arrête).

Le composant **n'existe que dans la branche `experimental`**. Un cherry-pick naïf qui porterait `AppShell.jsx` vers `main` doit retirer les imports `LabBadge` — ou laisser `LabBadge` absent et accepter que `main` ne connaît pas ce fichier (l'import échouerait au build). À surveiller lors du transfert de features touchant `AppShell`.

## Fichiers clés

- `CLAUDE.md` — règles pour Claude Code dans le Lab.
- `AGENTS.md` — bannière Lab + instructions agents.
- `.env.local` — flags `VITE_USE_EMULATORS=1`, ports, projectId fictif `vuvio-lab-emulator`.
- `src/firebase.js` — wiring émulateurs **+ garde runtime** (refus de projet non-lab, refus de `VITE_USE_EMULATORS!=1`, health probe émulateurs).
- `firebase.json` — `runtime: nodejs20`, `predeploy` hooks, bloc `emulators`.
- `.firebaserc` — projet fictif `vuvio-lab-emulator`.
- `.nvmrc` — `20` (Node 22 incompatible Catalina).
- `functions/.env` — stubs `lab-stub-do-not-use` pour Cloudflare / Amazon / Awin / eBay.
- `functions/package.json` — engines `node: 20`.
- `scripts/guard-no-prod-deploy.js` — script de garde predeploy.
- `scripts/launch-lab.sh` — lanceur unifié (émulateurs + Vite + cleanup).
- `package.json` — nom `vuvio-lab`, scripts Lab (`lab`, `emulators`, `dev --port 5174`, `deploy: exit 1`).
- `.emulator-data/` — snapshot persistant des émulateurs (gitignoré).
- `src/components/LabBadge.jsx` + `src/styles/components/lab-badge.css` — badge visuel.

## État au 2026-11-18

**Testé ✓**
- `git worktree add`, push sur `origin/experimental`.
- `node scripts/guard-no-prod-deploy.js` → exit 1 avec bannière rouge.
- `npm install` + `npm --prefix functions install` (OK, warning EBADENGINE sur Node 18 sans conséquence).
- `java --version` via Temurin 17 LTS (installé en .pkg, Homebrew HS sur Catalina).
- `firebase emulators:start` → Auth/Firestore/Storage up, Functions loaded.

**À valider manuellement**
- `npm run lab` : lance tout bout à bout + Ctrl+C clean.
- Badge `LAB` affiché en top-left sur toutes les routes.
- Rechargement de l'app en l'absence des émulateurs → warning visible dans la console (`[Vuvio-Lab] Firebase emulators appear to be offline`).
- Export/import automatique de `.emulator-data/` entre deux `npm run lab` (créer un user test, redémarrer, vérifier qu'il est toujours là).
- Guard runtime : poser `VITE_FIREBASE_PROJECT_ID=vuvio-bf328` dans `.env.local` → l'app refuse de charger.

**Limites connues**
- Node 22 non installable sur Catalina (requis macOS 11+) → Lab downgradé en nodejs20. Avant tout cherry-pick vers `main`, bien revérifier que le code reste compatible nodejs22 (le prod runtime).
- Homebrew abandonne Catalina (API `packages.catalina.jws.json` retourne 404) ; tout install système doit passer par .pkg direct.
- Firebase Cloud Messaging n'a pas d'émulateur ; les notifs push sont **désactivées de fait** dans le Lab.
- Cloudflare Stream, eBay API, Awin, Amazon PA API n'ont pas d'émulateur Firebase ; les stubs dans `functions/.env` cassent tout appel sortant. Pour tester une feature impliquant ces services réellement, créer un projet Firebase + comptes sandbox dédiés (demander validation avant).

## Références

- [Git Worktree docs](https://git-scm.com/docs/git-worktree)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Vite env modes](https://vitejs.dev/guide/env-and-mode.html)
