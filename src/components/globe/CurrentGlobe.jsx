import { Bell, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { analyticsService } from '../../services/analytics/analyticsService.ts';
import MapBottomSheet from '../map/MapBottomSheet.jsx';

const MARKER_TYPES = {
  standard: 'standard',
  sponsored: 'sponsored',
  vuvio: 'vuvio',
};

const INITIAL_CENTER = [14, 10];
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

/* Vuvio Midnight Blue palette — applied to all vector layers after style.load */
const PAL = {
  space:      '#030816',
  ocean:      '#07182E',
  oceanDeep:  '#040E1F',
  land:       '#102B46',
  landLow:    '#0B1F35',
  landHigh:   '#17375C',
  park:       '#164A49',
  road:       '#41617C',
  roadMinor:  '#2B445C',
  motorway:   '#5A7EA0',
  atmosphere: '#248BEB',
  marker:     '#36D9A0',
  label:      '#D8E6F2',
  labelDim:   '#8EA3BA',
};
const LIVE_COLOR = '#ff0066';
const UPCOMING_COLOR = '#0099ff';
const ROTATE_DEGREES_PER_SECOND = 1.8;
const ACTUAL_ROTATION_INTERVAL = 48;
const INITIAL_ZOOM = 1.15;
const SELECTED_LIVE_ZOOM = 4.0;
const REQUESTED_LIVE_ZOOM = 4.2;
const PING_COLOR = '#ff8a1f';
const PING_TTL_MS = 12000;
const PULSE_INTERVAL = 480;

const statusColor = [
  'case',
  ['==', ['get', 'status'], 'upcoming'],
  UPCOMING_COLOR,
  LIVE_COLOR,
];

const categoryColor = ['coalesce', ['get', 'familyColor'], statusColor];
const sponsoredColor = ['case', ['==', ['get', 'markerType'], MARKER_TYPES.sponsored], '#FFB04A', categoryColor];
const vuvioColor = ['case', ['==', ['get', 'markerType'], MARKER_TYPES.vuvio], '#B47BFF', categoryColor];

function markerStrokeColorExpression() {
  return ['case', ['==', ['get', 'markerType'], MARKER_TYPES.sponsored], '#FFC36C', ['==', ['get', 'markerType'], MARKER_TYPES.vuvio], '#C89AFF', '#F2F7F6'];
}

function markerColorExpression() {
  return ['case', ['==', ['get', 'markerType'], MARKER_TYPES.sponsored], sponsoredColor, ['==', ['get', 'markerType'], MARKER_TYPES.vuvio], vuvioColor, categoryColor];
}

function viewersNumber(stream) {
  if (!stream.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

function pulseSeed(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1000;
  }
  return hash / 1000;
}

function pingTimestamp(stream) {
  const value = stream.latestPing?.createdAt;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value?.seconds) return value.seconds * 1000;
  return 0;
}

function matchesFilters(stream, activeFamily, activeActivities, activeStatuses) {
  if (!activeStatuses.includes(stream.status)) return false;
  if (activeFamily !== 'all' && stream.family !== activeFamily) return false;
  if (activeActivities.length === 0) return true;
  return activeActivities.some((activityId) => {
    const activity = ACTIVITY_CATEGORIES.find((a) => a.id === activityId);
    return activity?.subcategories.includes(stream.subcategory);
  });
}

function getMarkerType(stream) {
  if (stream.markerType === MARKER_TYPES.sponsored) return MARKER_TYPES.sponsored;
  if (stream.markerType === MARKER_TYPES.vuvio) return MARKER_TYPES.vuvio;
  return MARKER_TYPES.standard;
}

// Subtle breathing animation for live markers
function breathingWave(clock) {
  return [
    'let',
    'phase',
    ['%', ['+', ['get', 'pulseSeed'], clock], 1],
    [
      'let',
      'wave',
      ['case', ['<', ['var', 'phase'], 0.5], ['*', ['var', 'phase'], 2], ['*', ['-', 1, ['var', 'phase']], 2]],
      ['*', ['var', 'wave'], ['var', 'wave'], ['-', 3, ['*', 2, ['var', 'wave']]]]
    ]
  ];
}

function livePointOpacity(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 0.72, ['*', wave, 0.28]],
    ['+', 0.38, ['*', wave, 0.62]],
  ];
}

// Luminous core for live markers — flashy pulsing effect with huge size contrast
function livePointRadius(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    [
      'case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.6, 300, 5.6, 800, 10.0, 1500, 16.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.4, 800, 2.2, 1500, 3.0]]],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.8, 300, 6.0, 800, 10.8, 1500, 17.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.5, 800, 2.3, 1500, 3.1]]],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.2, 300, 5.2, 800, 9.5, 1500, 15.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.2, 800, 2.0, 1500, 2.8]]],
    ],
    [
      'case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.0, 300, 4.8, 800, 8.5, 1500, 13.5], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.2, 800, 1.8, 1500, 2.6]]],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.2, 300, 5.0, 800, 9.0, 1500, 14.5], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.3, 800, 1.9, 1500, 2.7]]],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.7, 300, 4.4, 800, 8.0, 1500, 12.8], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 1.6, 1500, 2.4]]],
    ],
  ];
}

function liveColorGlowRadius(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 8.0, 300, 12.0, 800, 18.0, 1500, 26.0],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 9.0, 300, 13.0, 800, 19.0, 1500, 28.0],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 7.0, 300, 11.0, 800, 17.0, 1500, 25.0],
    ],
    ['*', wave, ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 2.0, 1500, 3.0],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.2, 800, 2.5, 1500, 4.0],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 2.0, 1500, 3.0],
    ]],
  ];
}

function liveColorGlowOpacity(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.42, 300, 0.56, 800, 0.70, 1500, 0.82],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.46, 300, 0.60, 800, 0.74, 1500, 0.86],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.40, 300, 0.54, 800, 0.68, 1500, 0.80],
    ],
    ['*', wave, ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.14, 800, 0.22, 1500, 0.28],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.16, 800, 0.24, 1500, 0.30],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.12, 800, 0.20, 1500, 0.26],
    ]],
  ];
}

function liveCrowdHaloRadius(clock) {
  const wave = breathingWave((clock * 1.35) % 1);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 3, 1500, 4.5],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 2.0, 1500, 3.5]],
  ];
}

function liveCrowdHaloOpacity(clock) {
  const wave = breathingWave((clock * 1.35) % 1);
  return [
    '*',
    ['-', 1, wave],
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 0.02, 1500, 0.04],
  ];
}

function livePingRippleRadius(clock) {
  const wave = breathingWave(clock);
  return ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 4, 800, 6, 1500, 8], ['*', wave, 10]];
}

function livePingRippleOpacity(clock) {
  const wave = breathingWave(clock);
  return ['*', ['-', 1, wave], ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.10, 800, 0.13, 1500, 0.16]];
}

function liveBroadcastHaloRadius(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.5, 300, 1.8, 800, 2.2, 1500, 2.5], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.3, 800, 2.0, 1500, 2.6]]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.2, 300, 1.4, 800, 1.8, 1500, 2.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 1.7, 1500, 2.2]]],
  ];
}

function liveBroadcastHaloOpacity(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['*', ['-', 1, wave], ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.06, 800, 0.09, 1500, 0.11]],
    ['*', ['-', 1, wave], ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.04, 800, 0.06, 1500, 0.08]],
  ];
}

function drawAtmosphericHalo(canvas, ctx, rotation, time, zoom = 1.4) {
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = w / 2;
  const cy = h / 2;
  // At zoom 1.4 the globe fills ~38% of the min dimension.
  // Each extra zoom level doubles the projected globe radius.
  const baseRadius = Math.min(w, h) * 0.38;
  const zoomScale = Math.pow(2, Math.max(0, zoom - 1.4));
  const globeRadius = baseRadius * zoomScale;
  // If the globe completely fills the canvas, skip all star drawing.
  const halfDiag = Math.hypot(cx, cy);
  const drawStars = globeRadius < halfDiag * 1.15 && zoom < 2.8;

  ctx.clearRect(0, 0, w, h);

  // Stars with multi-frequency twinkle — driven by RAF time (always animates)
  const t = time * 0.001; // seconds
  const exclusion = globeRadius * 1.08;
  const starCount = drawStars ? Math.max(80, Math.floor((w * h) / 18000)) : 0;
  for (let i = 0; i < starCount; i += 1) {
    const seed = i * 97.37;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin((seed + 19.19) * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * w;
    const py = Math.abs(y) * h;
    const distanceFromGlobe = Math.hypot(px - cx, py - cy);

    if (distanceFromGlobe < exclusion) continue;

    // Each star has its own irregular multi-frequency twinkle
    const f1 = 0.18 + Math.abs(Math.sin(seed * 5.3)) * 0.55;
    const f2 = 0.52 + Math.abs(Math.sin(seed * 2.7)) * 0.90;
    const f3 = 1.10 + Math.abs(Math.sin(seed * 8.1)) * 1.40;
    const twinkle = 0.55
      + Math.sin(t * f1 + seed * 1.3) * 0.22
      + Math.sin(t * f2 + seed * 3.7) * 0.14
      + Math.sin(t * f3 + seed * 7.1) * 0.07;
    const size = 0.7 + Math.abs(Math.sin(seed * 0.17)) * 1.6;
    const opacity = Math.max(0.12, Math.min(1.0, twinkle));

    const r = 215 + Math.floor(Math.abs(Math.sin(seed * 3.1)) * 40);
    const g = 230 + Math.floor(Math.abs(Math.sin(seed * 2.3)) * 25);
    const b = 255;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();

    // Bright stars get a cross-shaped spike
    if (size > 1.8 && opacity > 0.78) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.40})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(px - size * 2.8, py);
      ctx.lineTo(px + size * 2.8, py);
      ctx.moveTo(px, py - size * 2.8);
      ctx.lineTo(px, py + size * 2.8);
      ctx.stroke();
    }
  }

  // Shooting stars from screen edges
  if (drawStars) {
    const shootingSlots = zoom < 2.4 ? 4 : 2;
    for (let i = 0; i < shootingSlots; i++) {
      const ss = i * 214.7 + 31.9;
      const period = 8 + Math.abs(Math.sin(ss * 1.3)) * 14;
      const phase = (t + ss * 3.1) % period;
      const dur = 1.2 + Math.abs(Math.sin(ss * 4.1)) * 1.0;

      if (phase > dur) continue;

      const progress = phase / dur;
      const fade = progress < 0.10 ? progress / 0.10 : progress > 0.60 ? (1 - progress) / 0.40 : 1;
      const alpha = fade * 0.90;

      // Start from a screen edge (top or right side), travel diagonally down-left
      const edgeSeed = Math.abs(Math.sin(ss * 7.3));
      let sx, sy;
      if (edgeSeed < 0.5) {
        sx = (Math.abs(Math.sin(ss * 3.7)) * 0.8 + 0.1) * w;
        sy = 0;
      } else {
        sx = w;
        sy = Math.abs(Math.sin(ss * 5.1)) * h * 0.55;
      }
      const dirAngle = Math.PI * 0.60 + (Math.abs(Math.sin(ss * 2.1)) - 0.5) * 0.35;
      const len = (0.25 + Math.abs(Math.sin(ss * 5.7)) * 0.25) * Math.min(w, h);
      const ex = sx + Math.cos(dirAngle) * len;
      const ey = sy + Math.sin(dirAngle) * len;

      const headX = sx + (ex - sx) * progress;
      const headY = sy + (ey - sy) * progress;
      const tailProgress = Math.max(0, progress - 0.25);
      const tailX = sx + (ex - sx) * tailProgress;
      const tailY = sy + (ey - sy) * tailProgress;

      const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
      grad.addColorStop(0, `rgba(210, 235, 255, 0)`);
      grad.addColorStop(0.5, `rgba(235, 248, 255, ${alpha * 0.55})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();

      const headGrad = ctx.createRadialGradient(headX, headY, 0, headX, headY, 3.5);
      headGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      headGrad.addColorStop(1, `rgba(190, 225, 255, 0)`);
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Thin elegant ring for selected marker — one refined subtle ring only
function liveRingRadius(clock, selectedId = '', hoveredId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 4.0, ['*', wave, 0.3]],
    ['==', ['get', 'id'], hoveredId],
    ['+', 3.2, ['*', wave, 0.2]],
    0,
  ];
}

// Subtle ring opacity — refined and restrained
function liveRingOpacity(selectedId = '', hoveredId = '') {
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    0.54,
    ['==', ['get', 'id'], hoveredId],
    0.32,
    0,
  ];
}

function toFeature(stream) {
  const latestPingAt = pingTimestamp(stream);
  return {
    type: 'Feature',
    properties: {
      id: stream.id,
      status: stream.status,
      viewers: stream.viewers ?? '',
      viewersNumber: viewersNumber(stream),
      pulseSeed: pulseSeed(stream.id),
      pingActive: latestPingAt > 0 && Date.now() - latestPingAt < PING_TTL_MS,
      pingSeed: pulseSeed(stream.latestPing?.id ?? `${stream.id}-ping`),
      family: stream.family,
      familyColor: stream.familyColor,
      markerType: getMarkerType(stream),
      sponsoredReason: stream.sponsoredReason ?? '',
      featuredReason: stream.featuredReason ?? '',
    },
    geometry: {
      type: 'Point',
      coordinates: stream.coordinates,
    },
  };
}

function buildCollection(streams) {
  return {
    type: 'FeatureCollection',
    features: streams.map(toFeature),
  };
}

function brightenBaseGlobe(map) {
  try {
    /* Atmospheric cyan halo + midnight space */
    map.setFog?.({
      color: 'rgba(36, 139, 235, 0.22)',
      'high-color': 'rgba(36, 139, 235, 0.32)',
      'horizon-blend': 0.12,
      'space-color': PAL.space,
      'star-intensity': 0.88,
    });
    map.setSky?.({
      'sky-color': PAL.space,
      'horizon-color': '#0A2140',
      'fog-color': PAL.atmosphere,
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.05,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 0.7, 10, 0.1],
    });

    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      const type = layer.type;

      try {
        /* Background — outer space */
        if (type === 'background') {
          map.setPaintProperty(layer.id, 'background-color', PAL.space);
          return;
        }

        /* Water (fills + lines for rivers) */
        if (type === 'fill' && (id.includes('water') || id.includes('ocean') || id.includes('sea')
            || sourceLayer.includes('water'))) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.ocean);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }
        if (type === 'line' && (id.includes('water') || id.includes('river') || id.includes('stream')
            || sourceLayer.includes('water'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.ocean);
          map.setPaintProperty(layer.id, 'line-opacity', 0.9);
          return;
        }

        /* Parks / forest / green */
        if (type === 'fill' && (id.includes('park') || id.includes('wood') || id.includes('forest')
            || id.includes('green') || id.includes('grass') || id.includes('scrub')
            || id.includes('meadow') || id.includes('golf') || id.includes('pitch'))) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.park);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.78);
          return;
        }

        /* Land / landcover / landuse — tiered */
        if (type === 'fill' && (id.includes('landcover') || id.includes('landuse'))) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.landLow);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.55);
          return;
        }
        if (type === 'fill' && (id.includes('residential') || id.includes('urban')
            || id.includes('builtup') || id.includes('industrial'))) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.landHigh);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.55);
          return;
        }
        if (type === 'fill' && (id.includes('land') || sourceLayer.includes('land'))) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.land);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }

        /* Buildings — subtle highlight */
        if (type === 'fill' && id.includes('building')) {
          map.setPaintProperty(layer.id, 'fill-color', PAL.landHigh);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.78);
          return;
        }
        if (type === 'fill-extrusion' && id.includes('building')) {
          /* Fill-extrusion is expensive at close zoom — hide instead of paint */
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }

        /* Admin boundaries */
        if (type === 'line' && (id.includes('admin') || id.includes('boundary')
            || id.includes('border') || sourceLayer.includes('boundary'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.38);
          return;
        }

        /* Roads tiered */
        if (type === 'line' && (id.includes('motorway') || id.includes('trunk'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.motorway);
          map.setPaintProperty(layer.id, 'line-opacity', 0.78);
          return;
        }
        if (type === 'line' && (id.includes('primary') || id.includes('secondary'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.7);
          return;
        }
        if (type === 'line' && (id.includes('road') || id.includes('street')
            || id.includes('tertiary') || id.includes('minor') || id.includes('service')
            || id.includes('path') || id.includes('track'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.roadMinor);
          map.setPaintProperty(layer.id, 'line-opacity', 0.55);
          return;
        }

        /* Rail */
        if (type === 'line' && (id.includes('rail') || id.includes('transit'))) {
          map.setPaintProperty(layer.id, 'line-color', PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.32);
          return;
        }

        /* Hide base-style city/POI circles (conflict with Vuvio Live markers) */
        if (type === 'circle') {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }

        /* Labels (symbols) — keep visible, repaint in Vuvio palette for progressive reveal */
        if (type === 'symbol') {
          /* Hide icon-only POI markers to avoid clutter against Live markers */
          try {
            const iconImage = layer.layout?.['icon-image'];
            const hasText = !!layer.layout?.['text-field'];
            if (iconImage && !hasText) {
              map.setLayoutProperty(layer.id, 'visibility', 'none');
              return;
            }
          } catch { /* layout may be undefined */ }

          if (id.includes('country') || id.includes('continent')) {
            map.setPaintProperty(layer.id, 'text-color', PAL.label);
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
            return;
          }
          if (id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('marine')) {
            map.setPaintProperty(layer.id, 'text-color', PAL.labelDim);
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            return;
          }
          if (id.includes('city') || id.includes('place') || id.includes('town')
              || id.includes('village') || id.includes('suburb') || id.includes('neighbourhood')
              || id.includes('neighborhood')) {
            map.setPaintProperty(layer.id, 'text-color', PAL.label);
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1.2);
            return;
          }
          /* Any remaining text label: dim (streets, POI names at close zoom) */
          try {
            map.setPaintProperty(layer.id, 'text-color', PAL.labelDim);
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
          } catch { /* layer without text-color */ }
        }
      } catch { /* paint property may not exist on all layers */ }
    });
  } catch {
    // Base style support can differ entre MapLibre versions/providers.
  }
}

export default function CurrentGlobe({ streams, onboarding = false, onOnboardingLiveSelect, variant = 'current' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const haloCanvasRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const dvMarkersRef = useRef({});
  const selectedIdRef = useRef(null);
  const selectionReturnViewRef = useRef(null);
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [sheetState, setSheetState] = useState('closed');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState('');
  const [hoverStream, setHoverStream] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [pingRefreshTick, setPingRefreshTick] = useState(0);
  const [mapError, setMapError] = useState('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [fpsHud, setFpsHud] = useState({ fps: 0, zoom: 0, tiles: 0, mem: 0 });
  const lastHaloZoomRef = useRef(-1);
  const fpsBufRef = useRef([]);
  const fpsEnabled = searchParams.get('fps') === '1' || searchParams.get('fps') === 'true';

  const enrichedStreams = useMemo(() => streams.map(enrichExperience), [streams]);
  const requestedLiveId = searchParams.get('live') ?? '';
  const requestedLive = useMemo(() => {
    if (!requestedLiveId) return null;
    return enrichedStreams.find((stream) => stream.id === requestedLiveId) ?? null;
  }, [enrichedStreams, requestedLiveId]);

  const statusLiveStreams = useMemo(() => {
    void pingRefreshTick;
    return enrichedStreams.filter((stream) => activeStatuses.includes(stream.status));
  }, [activeActivities, activeFamily, activeStatuses, enrichedStreams, pingRefreshTick]);

  const standardStreams = useMemo(() => {
    return statusLiveStreams.filter((stream) => matchesFilters(stream, activeFamily, activeActivities, activeStatuses));
  }, [activeActivities, activeFamily, activeStatuses, statusLiveStreams]);

  const liveStreams = standardStreams;

  const selectedLive = enrichedStreams.find((stream) => stream.id === selectedId) ?? null;
  const watchPathForLive = (live) => {
    const target = encodeURIComponent(live.id);
    return `/watch?live=${target}`;
  };

  useEffect(() => {
    if (selectedLive) import('../../routes/WatchPage.jsx');
  }, [selectedLive]);

  useEffect(() => {
    if (!enrichedStreams.some((stream) => pingTimestamp(stream) > 0)) return undefined;
    const timer = window.setInterval(() => setPingRefreshTick((value) => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [enrichedStreams]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [hoveredId, selectedId]);

  const streamCounts = useMemo(() => {
    const byFamily = { all: 0, air: 0, earth: 0, water: 0 };
    const byActivity = {};
    enrichedStreams.forEach((stream) => {
      if (stream.status !== 'live') return;
      byFamily.all += 1;
      if (stream.family) byFamily[stream.family] = (byFamily[stream.family] ?? 0) + 1;
      ACTIVITY_CATEGORIES.forEach((activity) => {
        if (activity.subcategories.includes(stream.subcategory)) {
          byActivity[activity.id] = (byActivity[activity.id] ?? 0) + 1;
        }
      });
    });
    return { total: standardStreams.length, byFamily, byActivity };
  }, [enrichedStreams, standardStreams.length]);

  const selectFamily = (nextFamily) => {
    setActiveFamily(nextFamily);
    if (nextFamily !== 'all') {
      setActiveActivities([]);
      const sel = enrichedStreams.find((s) => s.id === selectedIdRef.current);
      if (sel && sel.family !== nextFamily) setSelectedId(null);
    }
    // switching to 'all' preserves current selection
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: 35,
      bearing: 0,
      minZoom: 0,
      maxZoom: 6,
      maxPitch: 80,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: Math.min(window.devicePixelRatio || 1, window.matchMedia?.('(pointer: coarse)').matches ? 1 : 1.25),
    });

    mapRef.current = map;

    // Setup atmospheric halo canvas
    const haloCanvas = document.createElement('canvas');
    haloCanvas.className = 'globe-atmospheric-halo';
    haloCanvas.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 1;';
    containerRef.current.appendChild(haloCanvas);
    haloCanvasRef.current = haloCanvas;

    const resizeHaloCanvas = () => {
      const rect = containerRef.current.getBoundingClientRect();
      haloCanvas.width = rect.width * (window.devicePixelRatio || 1);
      haloCanvas.height = rect.height * (window.devicePixelRatio || 1);
      haloCanvas.style.width = `${rect.width}px`;
      haloCanvas.style.height = `${rect.height}px`;
      const ctx = haloCanvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resizeHaloCanvas();
    window.addEventListener('resize', resizeHaloCanvas);
    map.touchZoomRotate.disableRotation();

    const pauseInteraction = () => {
      pauseUntilRef.current = Number.POSITIVE_INFINITY;
    };
    const resumeInteraction = () => {
      pauseUntilRef.current = 0;
      const center = map.getCenter();
      map.jumpTo({ center: [center.lng + 0.0001, center.lat] });
    };

    map.getCanvas().addEventListener('pointerdown', pauseInteraction);
    map.getCanvas().addEventListener('pointerup', resumeInteraction);
    map.getCanvas().addEventListener('pointercancel', resumeInteraction);
    map.getCanvas().addEventListener('lostpointercapture', resumeInteraction);
    map.getCanvas().addEventListener('touchend', resumeInteraction, { passive: true });
    map.getCanvas().addEventListener('wheel', resumeInteraction, { passive: true });
    map.on('dragstart', pauseInteraction);
    map.on('zoomstart', pauseInteraction);
    map.on('dragend', resumeInteraction);
    map.on('zoomend', resumeInteraction);
    map.on('error', (event) => {
      const message = event?.error?.message ?? event?.message ?? '';
      if (!message || /tile|glyph|sprite|network|abort/i.test(message)) return;
      setMapError(message);
    });

    map.on('load', () => {
      try {
        setIsMapLoaded(true);
        map.setProjection({ type: 'globe' });
        brightenBaseGlobe(map);

        // PERF: SVG unsharp-mask disabled — was re-filtering the whole WebGL canvas
        // every frame via CSS filter, costing 30-50% of frame time. Opt-in with ?sharpen=1.
        if (searchParams.get('sharpen') === '1') {
          if (!document.getElementById('vuvio-globe-svg-filters')) {
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.id = 'vuvio-globe-svg-filters';
            svgEl.setAttribute('width', '0');
            svgEl.setAttribute('height', '0');
            svgEl.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;';
            svgEl.innerHTML = '<defs><filter id="vuvio-globe-sharpen" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" edgeMode="none"/></filter></defs>';
            document.body.appendChild(svgEl);
          }
          map.getCanvas().style.filter = 'url(#vuvio-globe-sharpen) contrast(1.08)';
        }

        if (searchParams.get('filter') === 'nearby' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 5.5, duration: 1400 });
            },
            () => {},
            { timeout: 5000 },
          );
        }

        map.setPadding({ top: 0, bottom: 135, left: 0, right: 0 });

        map.addSource('vuvio-test-lives', {
          type: 'geojson',
          data: buildCollection(liveStreams),
          cluster: false,
        });

        map.addLayer({
          id: 'vuvio-test-live-glow',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': liveColorGlowRadius(0),
            'circle-blur': 5.5,
            'circle-opacity': liveColorGlowOpacity(0),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-broadcast-halo',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['case', ['==', ['get', 'markerType'], MARKER_TYPES.sponsored], '#FFD489', ['==', ['get', 'markerType'], MARKER_TYPES.vuvio], '#DAB2FF', '#F8FFFF'],
            'circle-radius': liveBroadcastHaloRadius(0, selectedId ?? ''),
            'circle-blur': 2.5,
            'circle-opacity': liveBroadcastHaloOpacity(0, selectedId ?? ''),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-crowd-halo',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': liveCrowdHaloRadius(0),
            'circle-blur': 2.2,
            'circle-opacity': liveCrowdHaloOpacity(0),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-ping-ripple',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'pingActive'], true]],
          paint: {
            'circle-color': PING_COLOR,
            'circle-radius': livePingRippleRadius(0),
            'circle-blur': 0.78,
            'circle-opacity': livePingRippleOpacity(0),
            'circle-stroke-color': 'rgba(255, 202, 130, 0.82)',
            'circle-stroke-width': 0.7,
            'circle-stroke-opacity': livePingRippleOpacity(0),
          },
        });

        // Luminous core for live markers — soft light point, no hard edge
        map.addLayer({
          id: 'vuvio-test-live-points',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': livePointRadius(0, selectedId ?? ''),
            'circle-blur': 0.75,
            'circle-opacity': livePointOpacity(0, selectedId ?? ''),
          },
        });

        // Thin elegant ring for selected markers — very restrained
        map.addLayer({
          id: 'vuvio-test-live-selection-ring',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': 'rgba(43,217,200,0)',
            'circle-radius': liveRingRadius(0, selectedId ?? '', hoveredId),
            'circle-stroke-color': markerStrokeColorExpression(),
            'circle-stroke-width': 0.8,
            'circle-stroke-opacity': liveRingOpacity(selectedId ?? '', hoveredId),
            'circle-opacity': 0,
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-hit',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': 'rgba(43,217,200,0.01)',
            'circle-radius': ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 18, 300, 22, 800, 28, 1500, 34],
            'circle-opacity': 0.01,
          },
        });

        const selectFeature = (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          if (!selectedIdRef.current) {
            const center = map.getCenter();
            selectionReturnViewRef.current = {
              center: [center.lng, center.lat],
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            };
          }
          const nextSelectedId = feature.properties.id;
          const stream = enrichedStreams.find((s) => s.id === nextSelectedId);
          if (stream) {
            analyticsService.trackGlobePinClicked(
              stream.id,
              stream.creatorId || stream.id,
              feature.geometry.coordinates[1],
              feature.geometry.coordinates[0]
            );
          }
          selectedIdRef.current = nextSelectedId;
          setSelectedId(nextSelectedId);
          onOnboardingLiveSelect?.(nextSelectedId);
          pauseUntilRef.current = Date.now() + 8500;
          map.easeTo({
            center: feature.geometry.coordinates,
            zoom: SELECTED_LIVE_ZOOM,
            duration: 820,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
          });
        };

        map.on('click', 'vuvio-test-live-hit', selectFeature);
        map.on('click', 'vuvio-test-live-points', selectFeature);

        // OPTIMIZATION 2: Cluster click handler removed
        // map.on('click', 'vuvio-test-clusters', (event) => {
        //   const feature = event.features?.[0];
        //   const clusterId = feature?.properties?.cluster_id;
        //   if (!feature || clusterId === undefined) return;
        //   const source = map.getSource('vuvio-test-lives');
        //   source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        //     if (error) return;
        //     pauseUntilRef.current = Date.now() + 2400;
        //     map.easeTo({
        //       center: feature.geometry.coordinates,
        //       zoom: Math.min(zoom + 0.35, SELECTED_LIVE_ZOOM),
        //       duration: 650,
        //       essential: true,
        //     });
        //   });
        // });

        map.on('mouseenter', 'vuvio-test-live-hit', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        // OPTIMIZATION 2: Cluster mouse handlers removed
        // map.on('mouseenter', 'vuvio-test-clusters', () => {
        //   map.getCanvas().style.cursor = 'pointer';
        // });
        map.on('mousemove', 'vuvio-test-live-hit', (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id ?? '';
          setHoveredId(id);
          if (id && !selectedIdRef.current) {
            const stream = enrichedStreams.find((s) => s.id === id) ?? null;
            setHoverStream(stream);
            setHoverPos({ x: event.point.x, y: event.point.y });
          } else {
            setHoverStream(null);
          }
        });
        map.on('mouseleave', 'vuvio-test-live-hit', () => {
          map.getCanvas().style.cursor = '';
          setHoveredId('');
          setHoverStream(null);
        });
        // OPTIMIZATION 2: Cluster mouse leave handler removed
        // map.on('mouseleave', 'vuvio-test-clusters', () => {
        //   map.getCanvas().style.cursor = '';
        // });
      } catch (error) {
        setMapError(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      map.getCanvas().removeEventListener('pointerdown', pauseInteraction);
      map.getCanvas().removeEventListener('pointerup', resumeInteraction);
      map.getCanvas().removeEventListener('pointercancel', resumeInteraction);
      map.getCanvas().removeEventListener('lostpointercapture', resumeInteraction);
      map.getCanvas().removeEventListener('touchend', resumeInteraction);
      map.getCanvas().removeEventListener('wheel', resumeInteraction);
      map.off('dragstart', pauseInteraction);
      map.off('zoomstart', pauseInteraction);
      map.off('dragend', resumeInteraction);
      map.off('zoomend', resumeInteraction);
      window.removeEventListener('resize', resizeHaloCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      for (const marker of Object.values(dvMarkersRef.current)) marker.remove();
      dvMarkersRef.current = {};
      if (haloCanvasRef.current?.parentNode) haloCanvasRef.current.parentNode.removeChild(haloCanvasRef.current);
      document.getElementById('vuvio-globe-svg-filters')?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const liveStreamsCollection = useMemo(() => buildCollection(liveStreams), [liveStreams]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('vuvio-test-lives');
    if (!source) return;
    source.setData(liveStreamsCollection);
  }, [liveStreamsCollection]);

  useEffect(() => {
    if (!requestedLive || !Array.isArray(requestedLive.coordinates)) return undefined;

    const map = mapRef.current;
    if (!map) return undefined;

    let cancelled = false;
    const focusRequestedLive = () => {
      if (cancelled) return;

      setActiveFamily('all');
      setActiveActivities([]);
      setActiveStatuses((current) => (current.includes(requestedLive.status) ? current : [...current, requestedLive.status]));
      setSelectedId(requestedLive.id);
      setHoveredId('');

      pauseUntilRef.current = Date.now() + 9000;
      map.stop();
      map.setProjection({ type: 'globe' });
      map.easeTo({
        center: requestedLive.coordinates,
        zoom: REQUESTED_LIVE_ZOOM,
        bearing: 0,
        pitch: 18,
        duration: 1050,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    };

    if (map.loaded() && map.getSource('vuvio-test-lives')) {
      focusRequestedLive();
    } else {
      map.once('load', focusRequestedLive);
    }

    return () => {
      cancelled = true;
    };
  }, [requestedLive]);

  // OPTIMIZATION 8: DOM markers disabled
  // Double-V pulse markers (test mode only) - removed for performance
  // These SVG overlays duplicate canvas rendering and add DOM overhead
  // useEffect(() => {
  //   const map = mapRef.current;
  //   if (!map) return;
  //
  //   const sync = () => {
  //     const currentIds = new Set(liveStreams.map((s) => s.id));
  //     for (const [id, marker] of Object.entries(dvMarkersRef.current)) {
  //       if (!currentIds.has(id)) { marker.remove(); delete dvMarkersRef.current[id]; }
  //     }
  //     for (const stream of liveStreams) {
  //       if (dvMarkersRef.current[stream.id]) continue;
  //       const color = stream.familyColor || '#2BD9C8';
  //       const delay = (pulseSeed(stream.id) * 2.2).toFixed(2);
  //       const el = document.createElement('div');
  //       el.className = 'vuvio-dv-pulse';
  //       el.style.cssText = `--dv-color:${color};--dv-delay:${delay}s`;
  //       el.innerHTML = '<svg viewBox="-16 -15 32 28" width="32" height="28" aria-hidden="true"><circle cx="0" cy="-9" r="2" fill="currentColor" opacity="0.9"/><path d="M-9,-4 L-5.5,5 L0,-1 L5.5,5 L9,-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  //       dvMarkersRef.current[stream.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
  //         .setLngLat(stream.coordinates)
  //         .addTo(map);
  //     }
  //   };
  //
  //   if (map.loaded()) sync(); else map.once('load', sync);
  // }, [liveStreams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    let lastRotationTime = performance.now();
    let lastPulseTime = 0;
    const initialCenter = map.getCenter();
    let lastRotationLng = initialCenter.lng;
    let lastRotationLat = initialCenter.lat;
    let totalRotation = 0;

    const tick = (time) => {
      const zoom = map.getZoom();
      const isZoomed = zoom > 2.5;

      // Skip pulse animations when zoomed in — markers barely visible, save CPU/GPU.
      if (zoom < 3 && time - lastPulseTime >= PULSE_INTERVAL) {
        lastPulseTime = time;
        const clock = (time % 2400) / 2400;
        try {
          if (map.getLayer('vuvio-test-live-glow')) {
            map.setPaintProperty('vuvio-test-live-glow', 'circle-radius', liveColorGlowRadius(clock));
            map.setPaintProperty('vuvio-test-live-glow', 'circle-opacity', liveColorGlowOpacity(clock));
          }
          if (map.getLayer('vuvio-test-live-broadcast-halo')) {
            map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-radius', liveBroadcastHaloRadius(clock, selectedId ?? ''));
            map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-opacity', liveBroadcastHaloOpacity(clock, selectedId ?? ''));
          }
          if (map.getLayer('vuvio-test-live-crowd-halo')) {
            map.setPaintProperty('vuvio-test-live-crowd-halo', 'circle-radius', liveCrowdHaloRadius(clock));
            map.setPaintProperty('vuvio-test-live-crowd-halo', 'circle-opacity', liveCrowdHaloOpacity(clock));
          }
          if (map.getLayer('vuvio-test-live-ping-ripple')) {
            map.setPaintProperty('vuvio-test-live-ping-ripple', 'circle-radius', livePingRippleRadius(clock));
            map.setPaintProperty('vuvio-test-live-ping-ripple', 'circle-opacity', livePingRippleOpacity(clock));
            map.setPaintProperty('vuvio-test-live-ping-ripple', 'circle-stroke-opacity', livePingRippleOpacity(clock));
          }
          if (map.getLayer('vuvio-test-live-points')) {
            map.setPaintProperty('vuvio-test-live-points', 'circle-radius', livePointRadius(clock, selectedId ?? ''));
            map.setPaintProperty('vuvio-test-live-points', 'circle-opacity', livePointOpacity(clock, selectedId ?? ''));
          }
          if (map.getLayer('vuvio-test-live-selection-ring')) {
            map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-radius', liveRingRadius(clock, selectedId ?? '', hoveredId));
            map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-stroke-opacity', liveRingOpacity(selectedId ?? '', hoveredId));
          }
        } catch {
          // Style/layers can be unavailable during route transitions.
        }
      }

      if (document.visibilityState === 'hidden' || Date.now() <= pauseUntilRef.current || selectedId || isZoomed) {
        lastRotationTime = time;
        const center = map.getCenter();
        lastRotationLng = center.lng;
        lastRotationLat = center.lat;
      } else {
        const elapsed = time - lastRotationTime;
        if (elapsed >= ACTUAL_ROTATION_INTERVAL) {
          lastRotationTime = time;
          lastRotationLng += (ROTATE_DEGREES_PER_SECOND * Math.min(elapsed, 50)) / 1000;
          totalRotation += (ROTATE_DEGREES_PER_SECOND * Math.min(elapsed, 50)) / 1000;
          map.jumpTo({ center: [lastRotationLng, lastRotationLat] });
        }
      }

      // Skip halo redraw at high zoom — stars invisible, globe fills viewport
      const haloCanvas = haloCanvasRef.current;
      if (haloCanvas && (zoom < 4.0 || Math.abs(zoom - lastHaloZoomRef.current) > 0.05)) {
        lastHaloZoomRef.current = zoom;
        const ctx = haloCanvas.getContext('2d');
        drawAtmosphericHalo(haloCanvas, ctx, totalRotation, time, zoom);
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedId]);

  /* FPS HUD — visible via ?fps=1 to diagnose perf without devtools */
  useEffect(() => {
    if (!fpsEnabled) return undefined;
    let raf = 0;
    let lastUpdate = 0;
    const tick = (time) => {
      fpsBufRef.current.push(time);
      if (fpsBufRef.current.length > 90) fpsBufRef.current.shift();
      if (time - lastUpdate > 250) {
        lastUpdate = time;
        const samples = fpsBufRef.current;
        const fps = samples.length > 1
          ? Math.round((samples.length - 1) * 1000 / (samples[samples.length - 1] - samples[0]))
          : 0;
        const map = mapRef.current;
        let zoom = 0;
        let tiles = 0;
        if (map) {
          zoom = map.getZoom();
          try {
            const srcs = Object.keys(map.getStyle()?.sources ?? {});
            srcs.forEach((srcId) => {
              const src = map.getSource(srcId);
              if (src?._tiles) tiles += Object.keys(src._tiles).length;
            });
          } catch { /* best-effort */ }
        }
        const mem = performance.memory?.usedJSHeapSize
          ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0;
        setFpsHud({ fps, zoom, tiles, mem });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fpsEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer('vuvio-test-live-points')) {
        map.setPaintProperty('vuvio-test-live-points', 'circle-radius', livePointRadius(0.18, selectedId ?? ''));
      }
      if (map.getLayer('vuvio-test-live-broadcast-halo')) {
        map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-radius', liveBroadcastHaloRadius(0.18, selectedId ?? ''));
        map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-opacity', liveBroadcastHaloOpacity(0.18, selectedId ?? ''));
      }
      if (map.getLayer('vuvio-test-live-selection-ring')) {
        map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-radius', liveRingRadius(0.18, selectedId ?? '', hoveredId));
        map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-stroke-opacity', liveRingOpacity(selectedId ?? '', hoveredId));
      }
    } catch {
      // The map can be between style states during navigation.
    }
  }, [hoveredId, selectedId]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setProjection({ type: 'globe' });
    setSelectedId(null);
    setHoveredId('');
    pauseUntilRef.current = Date.now() + 2200;

    const fly = (center, zoom) => {
      map.easeTo({
        center,
        zoom,
        bearing: 0,
        pitch: 35,
        duration: 1350,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
    };

    fly(INITIAL_CENTER, INITIAL_ZOOM);
  };

  const tiltBy = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      pitch: Math.max(0, Math.min(80, map.getPitch() + delta)),
      duration: 400,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
  };

  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: 620,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
    pauseUntilRef.current = Date.now() + 1200;
  };

  const closeSelectedLive = () => {
    const map = mapRef.current;
    const previousView = selectionReturnViewRef.current;

    setSelectedId(null);
    setHoveredId('');
    selectedIdRef.current = null;
    selectionReturnViewRef.current = null;
    pauseUntilRef.current = Date.now() + 1800;

    if (!map || !previousView) return;
    map.easeTo({
      ...previousView,
      duration: 720,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
  };

  return (
    <section
      className={`screen test-globe-screen test-globe-screen--maplibre test-globe-screen--actual${onboarding ? ' test-globe-screen--onboarding' : ''}`}
      data-sheet-state={sheetState}
      aria-label="Current Vuvio globe"
    >
      <div className={`test-old-globe${isMapLoaded ? ' is-loaded' : ''}`}>
        <div ref={containerRef} className="test-old-globe__canvas" />
        {!isMapLoaded && <div className="test-old-globe__loading-mask" aria-hidden="true" />}
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        {fpsEnabled && (
          <div
            role="status"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 20,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(3, 8, 22, 0.86)',
              border: `1px solid ${fpsHud.fps >= 50 ? '#36D9A0' : fpsHud.fps >= 30 ? '#f0b400' : '#ff5a5f'}`,
              color: '#E8FFF5',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 11,
              lineHeight: 1.45,
              minWidth: 96,
              pointerEvents: 'none',
              textAlign: 'left',
            }}
          >
            <div>FPS <b style={{ color: '#fff' }}>{fpsHud.fps}</b></div>
            <div>Zoom <b style={{ color: '#fff' }}>{fpsHud.zoom.toFixed(2)}</b></div>
            <div>Tiles <b style={{ color: '#fff' }}>{fpsHud.tiles}</b></div>
            {fpsHud.mem > 0 && <div>Heap <b style={{ color: '#fff' }}>{fpsHud.mem}MB</b></div>}
          </div>
        )}

        {!onboarding ? (
        <div className="test-old-globe__controls" aria-label="Map controls">
          <button type="button" onClick={() => zoomBy(0.72)} aria-label="Zoom in">
            <Plus size={19} />
          </button>
          <button type="button" onClick={() => zoomBy(-0.72)} aria-label="Zoom out">
            <Minus size={19} />
          </button>
          <button type="button" onClick={recenter} aria-label="Recenter">
            <LocateFixed size={19} />
          </button>
        </div>
        ) : null}


        {hoverStream && !selectedLive && !onboarding && (
          <div
            className="globe-hover-tooltip"
            style={{ left: hoverPos.x, top: hoverPos.y }}
            aria-hidden="true"
          >
            <span className="globe-hover-tooltip__tag" style={{ '--exp-color': hoverStream.familyColor }}>
              <i />{hoverStream.subcategory}
            </span>
            <strong>{hoverStream.name || hoverStream.streamer}</strong>
            <span className="globe-hover-tooltip__viewers">{hoverStream.viewers} viewers</span>
          </div>
        )}

        {!onboarding && !selectedLive && (
          <MapBottomSheet
            sheetState={sheetState}
            onSheetStateChange={setSheetState}
            activeFamily={activeFamily}
            onFamilyChange={selectFamily}
            activeActivities={activeActivities}
            onActivitiesChange={setActiveActivities}
            activeStatuses={activeStatuses}
            onStatusChange={setActiveStatuses}
            streamCounts={streamCounts}
          />
        )}

        {!onboarding && selectedLive ? (
          <aside className="test-globe-card" aria-label={`Live from ${selectedLive.name}`}>
            <button type="button" className="test-globe-card__close" onClick={closeSelectedLive} aria-label="Close">
              <X size={14} strokeWidth={2} />
            </button>
            <img src={selectedLive.image} alt="" loading="lazy" />
            <div className="test-globe-card__body">
              <div className="test-globe-card__info">
                <span className="test-globe-card__tag" style={{ '--experience-color': selectedLive.familyColor }}>
                  <i />
                  {selectedLive.subcategory}
                </span>
                <h2>{selectedLive.experienceTitle}</h2>
                <p>{selectedLive.name} · {selectedLive.city}, {selectedLive.country}</p>
                <strong>{selectedLive.viewers} viewers</strong>
              </div>
              <div className="test-globe-card__actions">
                <button
                  type="button"
                  className="test-globe-card__watch"
                  onClick={() => navigate(watchPathForLive(selectedLive))}
                >
                  <Play size={13} fill="currentColor" strokeWidth={1.8} />
                  Watch
                </button>
                <button
                  type="button"
                  className="test-globe-card__profile"
                  onClick={() => navigate(`/profile/${selectedLive.creatorId ?? selectedLive.id}`)}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className="test-globe-card__notify"
                  aria-label="Notify me"
                >
                  <Bell size={14} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </aside>
        ) : null}

      </div>
    </section>
  );
}
