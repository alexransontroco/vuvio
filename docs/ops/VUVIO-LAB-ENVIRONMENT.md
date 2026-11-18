# Vuvio-Lab — Environnement expérimental

Status: Current
Last reviewed: 2026-11-18
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
| `package.json`     | `name: vuvio`                            | `name: vuvio-lab`, `version: 0.1.0-lab`          |
| Deploy prod        | Autorisé (`firebase deploy …`)           | **Bloqué** par guard script + fake project id    |

## Protections techniques contre un deploy prod depuis le Lab

Trois couches défensives empêchent qu'un `firebase deploy` lancé depuis Vuvio-Lab n'atteigne `vuvio-bf328` :

1. **`scripts/guard-no-prod-deploy.js`** — invoqué via `predeploy` hooks dans `firebase.json` pour `hosting`, `functions`, `firestore`, `storage`. Affiche un message rouge et exit 1.
2. **`.firebaserc`** — `default: vuvio-lab-emulator` (projet qui n'existe pas). Même si le guard était contourné, `firebase deploy` échouerait à l'authentification du projet.
3. **`package.json` → `scripts.deploy`** — définit `deploy` comme `exit 1` avec un message explicite. Protège les workflows automatisés qui feraient `npm run deploy`.

**Pas de GitHub Actions** dans ce repo au moment de la mise en place (vérifié : `.github/workflows/` n'existe pas). Si un workflow est ajouté plus tard, il faut explicitement exclure la branche `experimental` du trigger de deploy.

## Lancer les deux environnements en parallèle

### Terminal 1 — Vuvio stable (prod-like)

```bash
cd /Users/alexandreranson/Desktop/vuvio
npm run dev                   # http://localhost:5173
```

### Terminal 2 — Vuvio-Lab émulateurs

```bash
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm install                   # première fois seulement
firebase emulators:start --only auth,firestore,storage,functions
# ou : npm run emulators
# UI Firebase : http://localhost:4000
```

### Terminal 3 — Vuvio-Lab Vite

```bash
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm run dev                   # http://localhost:5174
```

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

## Fichiers clés

- `/Users/alexandreranson/Desktop/Vuvio-Lab/CLAUDE.md` — règles pour Claude Code dans le Lab.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/AGENTS.md` — bannière Lab + instructions agents.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/.env.local` — flags `VITE_USE_EMULATORS=1` + ports.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/src/firebase.js` — wiring émulateurs gardé par `VITE_USE_EMULATORS`.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/firebase.json` — `predeploy` hooks + bloc `emulators`.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/.firebaserc` — projet fictif `vuvio-lab-emulator`.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/scripts/guard-no-prod-deploy.js` — script de garde.
- `/Users/alexandreranson/Desktop/Vuvio-Lab/package.json` — nom `vuvio-lab`, scripts Lab (dev 5174, emulators, deploy stub).

## À vérifier côté utilisateur

- Installer les dépendances Lab : `cd ~/Desktop/Vuvio-Lab && npm install` (dépendances déjà listées, mais `node_modules` n'est pas partagé entre worktrees).
- Avoir Firebase CLI installé globalement (`firebase --version`) et authentifié (`firebase login`). La CLI est nécessaire pour `firebase emulators:start`.
- Si Java n'est pas installé : les émulateurs Firestore/Storage l'exigent. `java --version`. Sinon : `brew install openjdk`.
- Tester le guard : `cd ~/Desktop/Vuvio-Lab && firebase deploy --only hosting --project vuvio-bf328` → doit afficher le message rouge et exit 1.

## Références

- [Git Worktree docs](https://git-scm.com/docs/git-worktree)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Vite env modes](https://vitejs.dev/guide/env-and-mode.html)
