# Vuvio Docs

This folder contains strategic, commercial and technical references, plus historical implementation notes.

For current project context, start with:

- [../AGENTS.md](../AGENTS.md) — critical rules agents must follow.
- [../journal.architecture.md](../journal.architecture.md) — source of truth for architecture, decisions, and open questions.
- [../README.md](../README.md) — short project overview and command map.
- [vuvio-complete-overview.md](vuvio-complete-overview.md) — complete product, storytelling, architecture, business model, and roadmap reference.
- [vuvio-reference-produit-non-technique.md](vuvio-reference-produit-non-technique.md) — non-technical product reference for vision, app experience, business model, launch, and storytelling.
- [../Vuvio_Inspirations_Strava_Polarsteps.md](../Vuvio_Inspirations_Strava_Polarsteps.md) — inspiration notes for Experiences, Adventures, profile memory, and geographic discovery.

## Admin Docs Classification

Admin Docs classifies Markdown files from their path and their top metadata lines.

Add `Status:` at the very top of a Markdown file to mark it as classified:

```md
Status: Current
Read before coding: Source of truth before touching GlobeTest2 behavior.

# Globe Test 2
```

Use these status values as a convention:

- `Status: Current` — active source of truth.
- `Status: Current index` — active folder index.
- `Status: Partially current` — useful, but verify code before relying on it.
- `Status: Historical note` — preserved context, not current behavior.
- `Status: Requires verification` — needs a code or product check before use.

`Read before coding:` is optional. When present, the file appears in the "Read before coding" area of Admin Docs.

The domain is inferred from the folder:

- `docs/strategy/` → Strategy
- `docs/business/` → Business
- `docs/growth/` → Growth & Marketing
- `docs/globe/` → Globe
- `docs/backend/` → Backend
- `docs/streaming/` → Streaming
- `docs/analytics/` → Analytics
- `docs/gear/` → Gear
- `docs/products/` → Products
- `docs/i18n/` → i18n
- `docs/ops/` → Ops
- `docs/archive/` → Archive
- root files like `README.md`, `ADMIN.md`, and `CHANGELOG.md` → Command Center

Command Center files should each have a clear role:

- `README.md` — project entry point.
- `ADMIN.md` — open tasks and active decisions.
- `CHANGELOG.md` — session history.
- `AGENTS.md` — critical rules for coding agents.
- `journal.architecture.md` — product and architecture journal.
- `Vuvio_Inspirations_Strava_Polarsteps.md` — product inspiration notes.

## Strategy, Business & Growth

- [strategy/](strategy/) — positioning, personas / JTBD, decisions and assumptions.
- [business/](business/) — business model, workshop monetization, unit economics.
- [growth/](growth/) — go-to-market, creator acquisition and marketing experiments.

These are strategy documents, not automatically implemented features or validated market findings. The existing [monetization.md](monetization.md) remains the in-depth Equipment affiliate strategy, and [analytics/first-creator-acquisition-mvp.md](analytics/first-creator-acquisition-mvp.md) remains the source for technical acquisition limitations.

## Domain Guides

- [backend/](backend/) — backend, Firestore, messaging, and stream lifecycle references.
- [analytics/](analytics/) — analytics architecture, audit, status, and integration notes.
- [gear/](gear/) — creator gear and equipment system.
- [products/](products/) — product catalog, Icecat, thumbnails, and affiliate/product references.
- [streaming/](streaming/) — relay architecture, live/replay pipeline, Cloudflare, highlights.
- [globe/](globe/) — globe experiment notes.
- [i18n/](i18n/) — internationalization audit.
- [ops/](ops/) — deployment fixes and miscellaneous modification notes.

## Historical Notes

Phase completion and one-off fix documents live in [archive/](archive/). Treat them as historical context, not current source of truth.
