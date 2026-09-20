# Globe Docs

Globe and map experiment notes.

Status: Current index  
Last reviewed: 2026-09-18  
Read before coding: Yes, for `/globe`, `/map`, GlobeTest2, marker, clustering, or Watch navigation changes.

## Current Reality

- `/globe` is still the production map/globe route, backed by the current MapLibre-oriented implementation.
- GlobeTest2 is the active 3D experiment and should not be assumed production-stable.
- Clustering was intentionally simplified after count/zoom bugs and should be rebuilt incrementally.

## Do Not Regress

- Do not break Explore/Globe to Watch deep-link behavior.
- Do not reintroduce clustering count mismatches without step-by-step validation.
- Do not swap production `/globe` to an experimental route without explicit product decision.

## Start Here

- [GLOBE_TEST_PREMIUM_CHANGES.md](GLOBE_TEST_PREMIUM_CHANGES.md) — premium globe test changes.

## Before Done

- `npm run build` passes.
- Selecting a live marker/card opens the correct live.
- `?live=ID` still makes the selected live play first in Watch.
