# Gear System — Quick Start

Status: MVP testing quickstart, partially current  
Last reviewed: 2026-09-18  
Read before coding: Use with [README.md](README.md) and verify current routes before testing.

> `/profile/gear` is the current gear management route. Gear persistence is localStorage-oriented; Firestore sync is not implemented.

---

## Test Paths

### 1. Happy path
Navigate to `http://localhost:5173/profile/gear` → Add gear → Activity: Cycling → Category: Bike → Subcategory: Road Bike → Brand: Canyon → Model: Aeroad CF SLX → Add.

Expected: card appears under "Cycling" section with edit/remove actions.

### 2. Custom brand
Same flow but search for a brand not in the database (e.g. "Van Nicholas") → click "Add 'Van Nicholas' manually".

Expected: card appears with "Custom" badge.

### 3. Duplicate detection
Add the same gear twice → warning popup appears. Choose "Add anyway" to allow a second copy.

### 4. Fuzzy search
All of these should find "GoPro": `gopro`, `go pro`, `GoPro`, `GOPRO`, `go-pro`.

### 5. Mobile / responsive
Test at 320px, 375px, 480px. Buttons min 40×40px, no horizontal scroll, wizard fits viewport.

### 6. Keyboard navigation
`Tab` / `Shift+Tab` between buttons, `Enter` to activate, `Escape` to cancel wizard.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page | Clear cache (Cmd+Shift+R) |
| Import errors in console | Ensure `npm run dev` is running |
| Styles missing | Check CSS files are imported |
| Wizard won't advance | Brand and model are required |

---

## Current State

Gear is stored in component state only — lost on refresh. Phase 2 will add localStorage/Firestore persistence.

For full architecture, see [GEAR_SYSTEM_IMPLEMENTATION.md](GEAR_SYSTEM_IMPLEMENTATION.md).
