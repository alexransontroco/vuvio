# Gear System Implementation Guide

Status: MVP implementation reference, partially current  
Last reviewed: 2026-09-18  
Read before coding: Yes, for structured gear-management work.

> Persistence and product integration should be checked against current code. Some functionality is localStorage-oriented. Firestore sync, affiliate click tracking, and commission attribution are still open.

Do not regress:
- Preserve public gear display and live gear snapshots.
- Preserve sponsor/affiliate disclosure where monetized gear appears.
- Keep UI copy in English.

---

## Architecture

```
Activities (20) → Categories (50+) → Subcategories (optional) → Brands (250+) → Models (user-defined)
```

Works entirely with local JSON data files. No Firestore required for basic functionality.

---

## Data Files (`src/data/gear/`)

| File | Records | Purpose |
|---|---|---|
| `activities.json` | 20 | Cycling, Surfing, Photography, etc. |
| `categories.json` | 50+ | Bike, Helmet, Camera, etc. |
| `subcategories.json` | 40+ | Road Bike, Mountain Bike, etc. |
| `brands.json` | 250+ | Global brands with category associations |
| `activityGearMappings.json` | 20 | Activities → priority-ranked categories |

---

## Service Layer (`src/services/gearService.ts`)

Key functions:
- `getAllActivities()`, `getActivityById()`
- `getSuggestedCategoriesForActivity(activity)`
- `searchBrands(query, categoryId)` — fuzzy, ignores case/spaces/dashes/accents
- `checkForDuplicate(userItems, newItem)`
- `createUserGearItem(userId, data)`
- `validateGearItem(item)`

---

## UI Components (`src/components/gear/`)

6-step wizard: `GearActivityPicker` → `GearCategoryPicker` → `GearSubcategoryPicker` → `GearBrandPicker` → `GearModelInput` → `GearDetailsForm`

State management: `GearAddWizard.jsx`  
Display: `GearItemCard.jsx`  
Page: `src/routes/ProfileGearPage.jsx`

Route: `/profile/gear` (protected, added to `src/App.jsx`)

---

## Developer API

```javascript
import { getSuggestedCategoriesForActivity, searchBrands, checkForDuplicate, createUserGearItem } from '@/services/gearService';

const results = searchBrands('go pro', 'camera');
// → [{ id: 'gopro', label: 'GoPro', ... }]

const result = checkForDuplicate(userItems, newItem);
if (result.isDuplicate) { /* warn user */ }

const item = createUserGearItem(userId, {
  activityId: 'cycling',
  categoryId: 'bike',
  brandName: 'Canyon',
  modelName: 'Aeroad CF SLX',
  source: 'catalog',
});
```

---

## Current State

### Implemented
- 20 activities, 50+ categories, 40+ subcategories, 250+ brands
- Fuzzy search, category-filtered brand search
- 6-step wizard with duplicate detection
- Responsive, mobile-first design (dark theme, 40px min touch targets)
- Accessibility (ARIA, keyboard nav, reduced motion)

### Not yet hooked up
- localStorage persistence
- Firestore sync (`users/{userId}/gearItems`)
- Image upload (GearImageUploader exists)
- Public profile display
- Live gear selector

---

## Architecture Decisions

- **JSON files vs Firestore** — No network latency, offline-capable, easy to update, can migrate anytime.
- **Local state vs Context** — State is per-page, easier to test and connect to Firestore independently.
- **Wizard pattern** — Progressive disclosure, mobile-friendly, accessible linear flow.
- **No UI framework** — Smaller bundle, full control, consistent with Vuvio design.

---

## Phase 2 (ready to implement)

1. `localStorage.setItem('vuvio:user-gear', JSON.stringify(items))` for persistence
2. Firestore: `users/{userId}/gearItems`
3. Profile display component
4. Live gear selector

## Phase 3 (monetization)

1. AI normalization via Claude API
2. Affiliate links + click tracking
3. Brand verification badges, sponsored gear
