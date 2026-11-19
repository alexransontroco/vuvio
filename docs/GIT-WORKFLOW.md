# Git workflow — Vuvio

Last updated: 2026-11-16

## Three principal branches

| Branch         | Role                                      | Deploys?                 |
| -------------- | ----------------------------------------- | ------------------------ |
| `main`         | Production. Stable. Always releasable.    | Yes (manual, on demand)  |
| `dev`          | Daily work. Integration of new features.  | No (local/preview only)  |
| `experimental` | Wild experiments, labs, PoCs.             | No (local only)          |

Everything else is a feature branch, backup branch, or worktree branch — short-lived.

## Golden rules

1. **Never commit directly on `main`** — merge from `dev` once validated.
2. **Never deploy from `dev` or `experimental`** — only from `main`.
3. **Never force-push `main`** — ever.
4. **Experimental features stay on `experimental` or `exp/*` branches** until they stabilize, then move to `dev`.
5. **Backup before any destructive op** — `git bundle create` the whole repo first.

## Daily workflow

### Start a new feature
```bash
git checkout dev
git pull origin dev
git checkout -b feat/<short-slug>
# work, commit as you go
```

### Merge feature → dev
```bash
git checkout dev
git merge --no-ff feat/<short-slug>
git push origin dev
git branch -d feat/<short-slug>  # local cleanup
git push origin --delete feat/<short-slug>  # remote cleanup
```

### Promote `dev` → `main` (release)
```bash
git checkout main
git pull origin main
git merge --ff-only dev        # should fast-forward if dev is strictly ahead
git push origin main
# then deploy:
npx vite build && firebase deploy --only hosting:vuvio-bf328
```

If `main` has diverged from `dev` (hotfixes applied directly), `--ff-only` fails — rebase `dev` on `main` first.

### Experimental work
```bash
git checkout experimental
git pull origin experimental
git checkout -b exp/<slug>
# play
```
When something from `exp/*` matures:
```bash
git checkout dev
git merge --no-ff exp/<slug>
```

## Branch naming

- `feat/<slug>` — new feature targeting `dev`
- `fix/<slug>` — bug fix targeting `dev` or `main`
- `exp/<slug>` — experimental, targeting `experimental`
- `chore/<slug>` — tooling, deps, docs
- `backup/<description>` — safety pointers, never deleted
- `hotfix/<slug>` — emergency fix on `main` (rare)

## Recovery

Full repo state at 2026-11-16 (pre-reorg) is preserved:

- Bundle: `~/Desktop/vuvio-backup-2026-11-16/vuvio-full-20261119-1747.bundle`
- Backup branches: `backup/pre-reorg-2026-11-16/<original-branch-name>`

To restore any branch:
```bash
git branch <name>-restored backup/pre-reorg-2026-11-16/<name>
```

To restore everything from the bundle:
```bash
git clone ~/Desktop/vuvio-backup-2026-11-16/vuvio-full-20261119-1747.bundle vuvio-restored
```

## What goes where — current snapshot (2026-11-16)

- **POV reorganization** → on `phase-4-realtime-poc` (commit `ba457de`), not yet merged to `dev` or `main`.
- **Landing redesign + globe-test-7 + Realtime SFU** → on `phase-4-realtime-poc` (`fdc3753`).
- **Vuvio-Lab environment** → on `experimental` (`8b9ee01`), physical workspace at `~/Desktop/Vuvio-Lab/`.
- **Waitlist + PasswordGate removal** → on `main` and `dev` (`cd1fd7d`).
