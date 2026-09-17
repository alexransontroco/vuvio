# i18n Docs

Internationalization references.

Status: Current index  
Last reviewed: 2026-09-05  
Read before coding: Yes, for visible UI text or locale behavior.

## Current Reality

- i18next infrastructure exists.
- Many visible strings are still hardcoded in English.
- The product rule is that visible app UI text remains English unless a specific localization task changes that.

## Do Not Regress

- Do not add French visible UI text just because the user gives instructions in French.
- Do not mix locale keys and raw strings in the same edited component without a deliberate reason.
- Do not change auth or routing behavior while extracting strings.

## Start Here

- [i18n-audit-report.md](i18n-audit-report.md) — current i18n audit.

## Before Done

- `npm run build` passes.
- New visible UI copy is English.
- Any extracted strings preserve current user-facing wording.
