# Vuvio-Lab — Instructions pour Claude

> **Tu travailles dans Vuvio-Lab**, une copie expérimentale de Vuvio (git worktree sur la branche `experimental`).
> La version stable est à `/Users/alexandreranson/Desktop/vuvio` (branches `main` / `phase-4-realtime-poc` / …).
> **Rien de ce qui est fait ici ne doit toucher la production** tant que ce n'est pas transféré via cherry-pick.

## Règles critiques

1. **Ne jamais déployer** depuis cette worktree. Le script `scripts/guard-no-prod-deploy.js` bloque tout `firebase deploy`, `.firebaserc` pointe sur un projet fictif, et `npm run deploy` exit 1 immédiatement. Ne pas contourner ces garde-fous.
2. **Ne jamais toucher `/Users/alexandreranson/Desktop/vuvio/**`** depuis ici. Si l'utilisateur demande un fix pour la version stable, lui rappeler qu'il faut `cd` dans l'autre worktree.
3. **Toutes les opérations Firebase passent par les émulateurs locaux** (Auth 9099, Firestore 8080, Storage 9199, Functions 5001). Voir `src/firebase.js` : le wiring est gardé par `VITE_USE_EMULATORS=1` dans `.env.local`.
4. **Ne jamais créer de projet Firebase payant** (`vuvio-lab-dev`, etc.) sans accord explicite. Les émulateurs couvrent 100% du dev.
5. **Services tiers** : si une feature expérimentale utilise Cloudflare Stream, eBay API, Awin, Amazon PA API, Segment, etc., utiliser des stubs ou des sandbox accounts. Ne jamais réutiliser les clés prod.
6. **Port Vite** : `npm run dev` utilise déjà `--port 5174`. Ne pas le changer (5173 est réservé à la Vuvio stable qui tourne en parallèle).

## Workflow

### Lancer le lab

```bash
cd /Users/alexandreranson/Desktop/Vuvio-Lab
npm install                 # première fois seulement
npm run emulators &         # terminal 1 : Firebase emulators
npm run dev                 # terminal 2 : Vite sur http://localhost:5174
```

### Sauvegarder une expérimentation

```bash
git add -A
git commit -m "lab: <description>"
git push                    # pousse sur origin/experimental
```

### Transférer une feature stabilisée vers la prod

Depuis **l'autre worktree** (Vuvio stable) :

```bash
cd /Users/alexandreranson/Desktop/vuvio
git checkout main
git fetch origin experimental
git log origin/experimental --oneline     # repérer les SHAs à promouvoir
git cherry-pick <sha1> [<sha2> ...]
npm run build
firebase deploy --only hosting:vuvio-bf328
```

> **Ne jamais merger `experimental` → `main`** directement. Cherry-pick uniquement, feature par feature.

## Ce qui est OK ici

- Casser des choses, prototyper, essayer des refactos profonds.
- Modifier `src/firebase.js`, les règles Firestore locales, `firebase.json`, `.firebaserc`.
- Changer de version de dépendance pour tester (mais noter le motif dans `CHANGELOG.md` local).
- Supprimer des fichiers, tester des migrations, etc.

## Ce qui n'est pas OK ici

- Déployer sur `vuvio-bf328`.
- Modifier la worktree stable.
- Utiliser des clés API prod (Firebase, Cloudflare Stream, eBay, Awin, Amazon PA API).
- Pousser sur `main`.
- Supprimer la worktree stable (`git worktree remove /Users/alexandreranson/Desktop/vuvio`).

## Fin de session

1. Mettre à jour le `CHANGELOG.md` de cette worktree (préfixe `LAB:`).
2. Mettre à jour les mémoires dans `/Users/alexandreranson/.claude/projects/-Users-alexandreranson-Desktop-vuvio/memory/` **avec le préfixe `lab_*`** pour les apprentissages qui ne s'appliquent qu'ici.
3. Si une feature est prête pour la prod, l'indiquer dans `CHANGELOG.md` et fournir le SHA à cherry-pick.
