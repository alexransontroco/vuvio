# Ops Docs

Deployment fixes and miscellaneous operational notes.

Status: Current index  
Last reviewed: 2026-11-18  
Read before coding: Use when changing Firebase deploy, hosting, build, or environment behavior.

## Current Reality

- Production hosting uses Firebase project `vuvio-bf328`.
- Frontend deployment and backend deployment are separate operations.
- Build output and Firebase cache files can change after `npm run build` or deploy commands.

## Do Not Regress

- Do not deploy functions when only hosting was requested.
- Do not deploy hosting when the user asked for local-only work.
- Do not commit secrets, local credentials, or generated credentials.
- Do not treat stale Firebase/browser cache symptoms as source errors without checking the current build.

## Start Here

- [FIREBASE-DEPLOYMENT-FIX.md](FIREBASE-DEPLOYMENT-FIX.md) — Firebase deployment troubleshooting.
- [modifications.md](modifications.md) — miscellaneous modification notes.
- [AI-DEV-TOOLS-CLAUDE-MEM-OMNIROUTE.md](AI-DEV-TOOLS-CLAUDE-MEM-OMNIROUTE.md) — Claude-Mem et OmniRoute : tentatives d'install locales (bloquées par macOS 10.15), auto-hébergement VPS Linux envisagé.

## Before Done

- `npm run build` passes before reporting implementation work complete.
- Deployment target is explicit.
- Any production URL reported is from the command output or known Firebase project config.
