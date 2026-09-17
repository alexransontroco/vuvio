# Vuvio Handoff

Date: 2026-07-24  
Project path: `/Users/alexandreranson/vuvio`  
Local dev URL: `http://localhost:5174/`  
Mobile LAN URL: `http://192.168.1.172:5174/`  
Production URL: `https://vuvio-bf328.web.app`

## Current Context

This project is the active Vuvio app. Do not work in `/Users/alexandreranson/vuvio copy 2` unless explicitly asked. The user wants all visible app UI text in English, even when giving instructions in French.

The app is a React/Vite project with MapLibre/Three globe views, creator profiles, Explore/Discover, live viewer, bottom navigation, and local mock/demo data.

## Run Commands

Use Node from the user's nvm path:

```bash
PATH=/Users/alexandreranson/.nvm/versions/node/v18.20.8/bin:$PATH npm run dev -- --host 0.0.0.0 --port 5174 --force
```

Build:

```bash
PATH=/Users/alexandreranson/.nvm/versions/node/v18.20.8/bin:$PATH npm run build
```

Deploy:

```bash
PATH=/Users/alexandreranson/.nvm/versions/node/v18.20.8/bin:$PATH firebase deploy --only hosting
```

If the browser shows stale import errors, restart Vite with `--force` and hard refresh the browser.

## Latest Fixed Runtime Errors

### lucide `Broadcast` export error

The browser previously showed:

```text
EquipmentKit.jsx:4 Uncaught SyntaxError: lucide-react does not provide an export named 'Broadcast'
```

The source now uses `Radio` instead of `Broadcast` in:

`src/components/equipment/EquipmentKit.jsx`

If this appears again, it is likely stale Vite/browser cache or the user is on another port.

### `ChevronRight is not defined`

The browser then showed:

```text
ProfilePage.jsx:630 Uncaught ReferenceError: ChevronRight is not defined
```

Fixed by adding `ChevronRight` to the lucide import in:

`src/routes/ProfilePage.jsx`

Build passed after this fix.

## Equipment Feature Implemented

The user requested a complete but simple streamer equipment system for profiles, lives, sponsors, and future affiliation. UI must remain English.

### Files Created

`src/data/equipmentModel.js`

- Defines equipment categories:
  - `recording`
  - `audio`
  - `activity`
  - `streaming`
  - `power_accessories`
- Defines ownership statuses:
  - `owned`
  - `borrowed`
  - `sponsored`
  - `brand_provided`
- Adds demo equipment for Alex POV:
  - GoPro HERO13 Black
  - DJI Osmo Action 4
  - GoPro Chesty Mount
  - DJI Mic 2
  - RODE VideoMicro
  - Canyon Spectral CF 8
  - POC Kortal Race MIPS
  - LiveU Solo
  - Mobile 5G Connection
  - Anker Power Bank
  - SanDisk Extreme Pro 256GB
- Exports `demoLiveEquipmentIds`.

`src/services/equipmentService.js`

- Uses localStorage for now.
- Keys:
  - `vuvio:equipment-library`
  - `vuvio:last-live-equipment`
- Main functions:
  - `getEquipmentLibrary`
  - `saveEquipmentLibrary`
  - `subscribeToEquipment`
  - `addEquipmentItem`
  - `updateEquipmentItem`
  - `removeEquipmentItem`
  - `groupEquipmentByCategory`
  - `equipmentLabel`
  - `getDefaultEquipmentIds`
  - `getLastLiveEquipmentIds`
  - `rememberLiveEquipmentSetup`
  - `getEquipmentSelection`
  - `buildEquipmentSnapshots`
  - `normalizeEquipmentItem`

`src/components/equipment/EquipmentKit.jsx`

Reusable equipment UI:

- `EquipmentIcon`
- `EquipmentBadge`
- `EquipmentCategoryCard`
- `EquipmentItemRow`
- `EquipmentDisclosure`
- `GearInLive`
- `EquipmentSelector`
- `QuickAddEquipmentForm`
- `EquipmentViewerSheet`
- `EquipmentManageActions`
- `PrimaryEquipmentSummary`

`src/routes/EquipmentManagePage.jsx`

Private equipment management page.

Route:

`/profile/equipment`

Features:

- Add equipment
- Edit equipment
- Remove equipment with confirmation text
- Show/hide on profile
- Set/unset default
- Product link
- Affiliate link
- Optional image URL
- Notes
- Ownership status

### Files Modified

`src/App.jsx`

- Lazy imports `EquipmentManagePage`.
- Adds route `/profile/equipment`.

`src/routes/ProfilePage.jsx`

- Public profile tabs:
  - Lives
  - About
  - Equipment
  - Highlights
- Supports `?tab=equipment`.
- Adds public Equipment tab:
  - Header `My Equipment`
  - Subtitle `The gear I use to capture and stream my POV experiences.`
  - Category cards
  - Category detail panel
  - `Gear in this live`
  - affiliate disclosure
  - sponsorship info modal
  - partnership inquiry card
  - manage button on own profile

`src/components/BottomNav.jsx`

- Start live flow now includes a gear selection section once a title exists.
- Actions:
  - `Use previous setup`
  - `Your default setup`
  - `Add equipment`
  - `Skip for now`
- On live launch:
  - saves `equipment`
  - saves `equipmentSnapshots`
  - calls `rememberLiveEquipmentSetup`

`src/services/createdLiveService.js`

- `createLocalLive(draft)` now stores:
  - `equipment`
  - `equipmentSnapshots`
  - `equipmentConfirmed: false`
  - `equipmentUpdatedAt`

`src/routes/ExplorePage.jsx`

- Adds gear button in Discover/live viewer.
- Opens `EquipmentViewerSheet`.
- `View full setup` routes to:
  - `/profile/${creatorId}?tab=equipment`

`src/routes/LivePage.jsx`

- Adds gear button in live viewer.
- Opens `EquipmentViewerSheet`.

`src/styles/components.css`

- Shared equipment styles:
  - selector
  - rows
  - badges
  - quick add
  - viewer sheet

`src/styles/pages/profile.css`

- Profile equipment tab and private equipment management styles:
  - `.equipment-tab`
  - `.equipment-category-card`
  - `.gear-in-live`
  - `.equipment-disclosure`
  - `.equipment-manage-screen`
  - `.equipment-private-form`
  - related responsive styles

## Equipment Data Model

Current TypeScript-like model target:

```ts
type EquipmentCategory =
  | "recording"
  | "audio"
  | "activity"
  | "streaming"
  | "power_accessories";

type EquipmentOwnership =
  | "owned"
  | "borrowed"
  | "sponsored"
  | "brand_provided";

type EquipmentItem = {
  id: string;
  userId: string;
  category: EquipmentCategory;
  brand: string;
  model: string;
  equipmentType?: string;
  imageUrl?: string;
  productUrl?: string;
  affiliateUrl?: string;
  ownership: EquipmentOwnership;
  isPublic: boolean;
  isDefault: boolean;
  isFeatured?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type LiveEquipmentSelection = {
  equipmentId: string;
  isPrimary?: boolean;
  role?: "camera" | "audio" | "activity" | "streaming" | "accessory";
};

type LiveEquipmentSnapshot = {
  equipmentId?: string;
  brand: string;
  model: string;
  equipmentType?: string;
  category: EquipmentCategory;
  ownership?: EquipmentOwnership;
};
```

No Firebase migration has been implemented yet. The current system uses localStorage/demo data and is structured to migrate later to:

`users/{userId}/equipment/{equipmentId}`

and live documents with:

- `equipmentIds`
- `equipmentSnapshots`
- `equipmentConfirmed`
- `equipmentUpdatedAt`

## Equipment Feature Limitations Remaining

The following items are prepared visually/locally but not fully backend-persistent:

- Firebase equipment collection.
- Firebase security rules.
- Real sponsor inquiry route/form.
- Editing equipment during an actual live stream session with backend sync.
- Post-live equipment confirmation screen connected to a real completed live flow.
- Real similarity logic for previous setup by activity. Current logic falls back to default/last setup.

## Globe Work Context

The user had many issues with the globe:

- Actual globe disappeared while Lab globe worked.
- Lab globe tabs disappeared.
- Live points too big.
- Mobile had missing points.
- Globe markers needed category colors.
- Double click zoom behavior needed on Lab.
- Clicking live should zoom closer and stop rotation temporarily.

Current route behavior:

- `/globe` and `/map` use `GlobeTestPage mode="actual"` with the older MapLibre-style globe via `TestGlobe`.
- `/globe-test` is the test globe.
- `/globe-lab` is separate React/Three globe.
- Technical tabs for globe switching were re-enabled after the user asked to restore them.
- Clustering on current globe was disabled because mobile lost many points.
- Marker style was reduced and made smaller/pulsing.
- Marker colors should follow categories:
  - Air: blue
  - Land/Terre: green
  - Water/Eau: cyan

Potentially relevant files:

- `src/routes/GlobeTestPage.jsx`
- `src/routes/GlobeLabPage.jsx`
- `src/components/map/LiveMap.jsx`
- `src/routes/MapPage.jsx`
- `src/styles/pages/map.css`
- `src/data/mapStreams.js`

## Explore / Discover Context

User requested a small swipe animation in Discover. This was added previously.

User also reported POV images/videos disappeared. Current intended behavior:

- In local dev, mock POV videos/images should appear.
- In production, mock videos should not be deployed because they are too heavy.
- Poster images should still deploy.

Relevant files:

- `src/routes/ExplorePage.jsx`
- `vite.config.js`
- `firebase.json`

Current `vite.config.js` behavior:

- Keeps `public/` available in local dev.
- Removes mock media files from `dist` at build time:
  - `.mp4`
  - `.mov`
  - `.webm`
  - `.wav`
  - `.mp3`
  - `.m4a`

Current `firebase.json` ignores media extensions, not the entire video asset folder, so JPG posters can deploy.

## Category Logos

User wanted to replace `Air / Land / Water` text with logos that already existed. No PNGs were found, but SVG icons existed and were used. User accepted: "oui cest bon pour les logos".

Relevant icon assets:

- `src/assets/icons/air/drone.svg`
- `src/assets/icons/eau/eau.svg`
- `src/assets/icons/index.ts`
- `src/data/experienceTaxonomy.js`

## Past Lives Image Cropping

User showed a screenshot where past live images had visible white borders and were too large/badly cropped. This was adjusted before this handoff. If it regresses, inspect:

- `src/routes/ProfilePage.jsx`
- `src/styles/pages/profile.css`

Look for past live cards and avatar/thumbnail object-fit/border styles.

## Production Deploy State

Last known successful production deploy:

`https://vuvio-bf328.web.app`

Verified previously:

- `/profile/equipment` returned HTTP 200.
- `/profile?tab=equipment` returned HTTP 200.
- `/discover` returned HTTP 200.

After the latest `ChevronRight` import fix, build passed locally but deployment may need to be run again if production should include that exact fix.

## Console Warnings

These are currently non-blocking:

```text
Download the React DevTools for a better development experience
React Router Future Flag Warning: v7_startTransition
The deferred DOM Node could not be resolved to a valid node
```

The blocking errors to fix are actual `Uncaught ReferenceError` or import/export syntax errors.

## Testing Checklist

Use local dev URL:

`http://localhost:5174/`

Hard refresh after server restarts:

`Cmd + Shift + R`

Test profile equipment:

1. Open `/profile?tab=equipment`.
2. Verify tabs show `Lives / About / Equipment / Highlights`.
3. Click each equipment category.
4. Verify `Gear in this live` appears when demo live gear exists.
5. Open sponsorship modal.
6. Open `/profile/equipment`.
7. Add equipment with category, brand, model.
8. Toggle public/default status.
9. Edit and remove equipment.

Test live creation:

1. Tap center V button in bottom nav.
2. Enter live details until gear section appears.
3. Select gear.
4. Try `Use previous setup`.
5. Try `Your default setup`.
6. Try `Add equipment`.
7. Launch local live and verify equipment snapshots are stored.

Test viewer:

1. Open `/discover`.
2. Open a live card/viewer.
3. Tap the gear/camera button.
4. Verify `Gear in this live` sheet opens.
5. Use `View full setup`.

Test live page:

1. Open a live route if available.
2. Tap gear/camera button.
3. Verify sheet content and affiliate/sponsored labels.

Test globe:

1. Open `/globe`.
2. Confirm Actual globe has live points on desktop and mobile.
3. Confirm marker sizes are small and pulsing.
4. Confirm globe tabs are visible if still desired.
5. Confirm `/globe-lab` still works.

## Design Constraints To Preserve

- UI text in English.
- Mobile-first.
- No large product images for equipment yet.
- Use simple cards, icons, text, and existing Vuvio visual language.
- Do not create a second design system.
- Do not turn equipment into an e-commerce catalogue.
- Keep sponsor/affiliate transparency visible:
  - `Sponsored`
  - `Affiliate link`
  - `Provided by a brand`
- Do not modify unrelated pages unless necessary.
- Do not remove existing mock/demo data.

