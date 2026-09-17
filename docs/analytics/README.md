# Analytics Docs

Analytics architecture, audit, status, and integration notes.

Status: Current index  
Last reviewed: 2026-09-05  
Read before coding: Yes, for analytics events, dashboards, tracking, or admin stats.

## Current Reality

- Analytics docs include both architecture and rollout/status notes.
- Some phase docs are archived and may describe older implementation states.
- Admin-only analytics and stream stats should remain protected.

## Do Not Regress

- Do not add event spam on Watch navigation.
- Do not track personally sensitive data without explicit design and privacy review.
- Do not expose analytics dashboards to non-admin users.
- Do not change event names or schemas without updating this folder.

## Start Here

- [analytics-architecture.md](analytics-architecture.md) — analytics architecture.
- [data-analytics-audit.md](data-analytics-audit.md) — data and analytics audit.
- [ANALYTICS-INTEGRATION-MANAGEMENT.md](ANALYTICS-INTEGRATION-MANAGEMENT.md) — analytics integration management.
- [ANALYTICS-STATUS.md](ANALYTICS-STATUS.md) — analytics status notes.

## Archived Guides

- [../archive/README-ANALYTICS.md](../archive/README-ANALYTICS.md) — previous analytics entry point.
- [../archive/ANALYTICS-GUIDE-SIMPLE.md](../archive/ANALYTICS-GUIDE-SIMPLE.md) — previous simplified guide.

## Before Done

- `npm run build` passes.
- Event volume is bounded for repeated Watch/Explore renders.
- Any new event includes owner, trigger, payload shape, and privacy note.
