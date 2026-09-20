# Globe Test Premium — Changes

Status: Globe experiment note, partially current  
Last reviewed: 2026-09-18  
Read before coding: Use for visual/history context, not as production route source of truth.

> GlobeTest2 remains experimental unless explicitly promoted. Production `/globe` must be checked in current routes before changing navigation. Clustering needs incremental validation (previous count/zoom bugs existed).

---

## What Was Done

Transformed Globe Test (mode="test") into a premium 3D globe using `react-globe.gl` with Three.js.

### New component: `src/components/globe/GlobeTestPremium.jsx`

**Color theme (`TEST_GLOBE_THEME`):**
```javascript
oceanColor: '#020B15',
landColor: '#16465E',
landHighlight: '#27677C',
borderColor: 'rgba(83, 185, 216, 0.55)',
coastlineColor: 'rgba(97, 211, 232, 0.72)',
atmosphereColor: '#26A9C5',
atmosphereIntensity: 0.18,
```

All colors are in the `TEST_GLOBE_THEME` object at the top — adjust there, no need to touch component logic.

**Features:** auto-rotation with manual pause, smooth zoom (+/- + keyboard), double-click zoom, recenter, live marker selection with focus animation, Air/Earth/Water filter.

**Performance:** pixel ratio capped at 2.0, shadow mapping disabled, smooth damping, proper cleanup on unmount.

### Modified: `src/components/globe/TestGlobe.jsx`
Uses `GlobeTestPremium` for mode="test", keeps MapLibre GL for mode="actual". Early return prevents MapLibre initialization for test mode.

### Modified: `src/styles/pages/globe-lab.css`
Canvas filters: `brightness: 1.32`, `contrast: 1.18`, `saturate: 1.14`, `hue-rotate: 2deg`.  
Added `.globe-lab-shell::before` — radial gradient cyan halo using screen blend mode.

---

## What Remains Unchanged

- `/globe` (production MapLibre mode)
- `/globe-lab` (react-globe.gl lab mode)
- Live data streams and interactions
- Responsive layout and theme colors
