# Gear Docs

Creator equipment and gear-management documentation.

Status: Current index  
Last reviewed: 2026-09-18  
Read before coding: Yes, for profile gear, creator equipment, live setup, sponsor, or affiliate changes.

## Current Reality

- Gear exists in two related areas: creator equipment for profiles/lives and a structured gear-management flow.
- Some gear paths still use localStorage-oriented behavior.
- Firestore migration/sync is an open product and engineering task.
- Affiliate URLs exist in the model, but backend click tracking and commission attribution are not complete.

## Do Not Regress

- Do not hardcode mock media or gear image storage URLs outside the centralized data files.
- Do not remove sponsor/affiliate disclosure UI when showing monetized gear.
- Do not assume localStorage gear is multi-device synced.
- Do not rename `/profile/equipment` or `/profile/gear` behavior without checking current routes.

## Start Here

- [GEAR_SYSTEM_QUICKSTART.md](GEAR_SYSTEM_QUICKSTART.md) — testing and usage quickstart.
- [GEAR_SYSTEM_IMPLEMENTATION.md](GEAR_SYSTEM_IMPLEMENTATION.md) — full implementation reference.

## Before Done

- `npm run build` passes.
- Own-profile gear management still opens.
- Public profile gear still renders for viewers.
- Live start flow still allows selecting or skipping gear.
- Existing equipment snapshots on lives still display.
