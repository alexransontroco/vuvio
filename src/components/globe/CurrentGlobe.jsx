import { Bell, BellOff, ChevronUp, LocateFixed, Minus, Play, Plus, SlidersHorizontal, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { analyticsService } from '../../services/analytics/analyticsService.ts';
import { getCountdownState, makeCountdownLabels } from '../../utils/countdown.js';
import { createNotification, getRemindedStreamIds } from '../../services/notificationService.js';
import { useAuth } from '../../context/AuthContext.jsx';
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
  ocean:      '#0A2850',
  oceanDeep:  '#040E1F',
  land:       '#0f1e30',
  landLow:    '#0f1e30',
  landHigh:   '#0f1e30',
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
const INITIAL_ZOOM = 1.4;
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

function drawAtmosphericHalo(canvas, ctx, rotation, time, zoom = 1.4, globeCenter = null) {
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = globeCenter?.x ?? w / 2;
  const cy = globeCenter?.y ?? h / 2;
  // At zoom 1.4 the globe fills ~44% of the min dimension (measured empirically).
  // Each extra zoom level doubles the projected globe radius.
  const baseRadius = Math.min(w, h) * 0.44;
  const zoomScale = Math.pow(2, Math.max(0, zoom - 1.4));
  const globeRadius = baseRadius * zoomScale;
  // If the globe completely fills the canvas, skip all star drawing.
  const halfDiag = Math.hypot(cx, cy);
  const drawStars = globeRadius < halfDiag * 1.15 && zoom < 2.8;

  ctx.clearRect(0, 0, w, h);

  // Stars with multi-frequency twinkle — driven by RAF time (always animates)
  const t = time * 0.001; // seconds
  const starCount = drawStars ? Math.max(80, Math.floor((w * h) / 18000)) : 0;
  for (let i = 0; i < starCount; i += 1) {
    const seed = i * 97.37;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin((seed + 19.19) * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * w;
    const py = Math.abs(y) * h;
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

  // Cut stars from the exact projected horizon so the overlay cannot cover land.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  if (globeCenter?.map) {
    const map = globeCenter.map;
    const center = map.getCenter();
    const lat1 = center.lat * Math.PI / 180;
    const lng1 = center.lng * Math.PI / 180;
    const horizonRadius = 82 * Math.PI / 180;
    for (let i = 0; i <= 180; i += 1) {
      const bearing = i * 2 * Math.PI / 180;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(horizonRadius) + Math.cos(lat1) * Math.sin(horizonRadius) * Math.cos(bearing));
      const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(horizonRadius) * Math.cos(lat1), Math.cos(horizonRadius) - Math.sin(lat1) * Math.sin(lat2));
      const point = map.project([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.ellipse(cx, cy, globeRadius * 1.02, globeRadius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
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

function styleNativeGlobe(map) {
  const colors = {
    space: '#0B1020',
    oceanDeep: '#0B1020',
    oceanShallow: '#111B30',
    land: '#1A2036',
    natural: '#202943',
    mountain: '#303B55',
    boundary: '#53647F',
    atmosphere: '#235A84',
    road: '#4B82A9',
    minorRoad: '#2E5774',
    label: '#D8EBF8',
    labelDim: '#9BC2D7',
  };

  try {
    try {
      map.setSky?.({
        'sky-color': colors.space,
        'horizon-color': '#1C2541',
        'fog-color': '#0B1020',
        'sky-horizon-blend': 0.08,
        'horizon-fog-blend': 0.02,
        'fog-ground-blend': 0,
        'atmosphere-blend': 0.02,
      });
    } catch { /* sky options vary by MapLibre version */ }

    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      const type = layer.type;

      try {
        if (type === 'background') {
          map.setPaintProperty(layer.id, 'background-color', colors.space);
          return;
        }
        if (type === 'fill' && id === 'water') {
          map.setPaintProperty(layer.id, 'fill-color', [
            'match', ['get', 'kind'],
            ['lake', 'pond', 'reservoir', 'basin'], colors.oceanShallow,
            colors.oceanDeep,
          ]);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }
        if (id === 'landcover') {
          map.setPaintProperty(layer.id, 'fill-color', [
            'match', ['get', 'kind'],
            ['wood', 'forest', 'park', 'nature_reserve', 'national_park'], '#18263D',
            ['grass', 'grassland', 'meadow', 'farmland', 'garden', 'orchard', 'golf_course'], '#202B44',
            ['scrub', 'heath', 'recreation_ground', 'village_green'], '#1D283F',
            ['barren', 'desert', 'rock', 'scree'], '#2A3048',
            ['glacier', 'snow'], '#3A435A',
            colors.natural,
          ]);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }
        if (id === 'park_national_park' || id === 'park_nature_reserve' || id === 'landuse') {
          map.setPaintProperty(layer.id, 'fill-color', [
            'match', ['get', 'kind'],
            ['residential', 'retail'], '#1C293F',
            ['commercial', 'industrial', 'institutional', 'school', 'university', 'airport'], '#202C45',
            ['quarry', 'mine', 'landfill'], '#2A3048',
            ['park', 'nature_reserve', 'national_park', 'recreation_ground'], '#18263D',
            colors.natural,
          ]);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.94);
          return;
        }
        if (id === 'landuse_residential') {
          map.setPaintProperty(layer.id, 'fill-color', '#1C293F');
          map.setPaintProperty(layer.id, 'fill-opacity', 0.82);
          return;
        }
        if (id === 'building-top') {
          map.setPaintProperty(layer.id, 'fill-color', colors.mountain);
          map.setPaintProperty(layer.id, 'fill-outline-color', colors.land);
          map.setPaintProperty(layer.id, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 13, 0, 16, 0.55]);
          return;
        }
        if (type === 'line' && (id.includes('admin') || id.includes('boundary') || id.includes('border') || sourceLayer.includes('boundary'))) {
          map.setPaintProperty(layer.id, 'line-color', colors.boundary);
          map.setPaintProperty(layer.id, 'line-opacity', 0.58);
          map.setPaintProperty(layer.id, 'line-width', ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 9, 0.72, 13, 0.9]);
          return;
        }
        if (type === 'line' && (id.includes('water') || id.includes('river') || id.includes('stream') || sourceLayer.includes('water'))) {
          map.setPaintProperty(layer.id, 'line-color', colors.oceanShallow);
          map.setPaintProperty(layer.id, 'line-opacity', 0.7);
          return;
        }
        if (type === 'line' && (id.includes('_mot_') || id.includes('_trunk_') || id.includes('_pri_') || id.includes('_sec_') || id.includes('motorway') || id.includes('trunk') || id.includes('primary') || id.includes('secondary'))) {
          map.setPaintProperty(layer.id, 'line-color', colors.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.5);
          return;
        }
        if (type === 'line' && (id.includes('road') || id.includes('street') || id.includes('tertiary') || id.includes('minor') || id.includes('service') || id.includes('path'))) {
          map.setPaintProperty(layer.id, 'line-color', colors.minorRoad);
          map.setPaintProperty(layer.id, 'line-opacity', 0.34);
          return;
        }
        if (type === 'hillshade') {
          map.setPaintProperty(layer.id, 'hillshade-exaggeration', 0.24);
          map.setPaintProperty(layer.id, 'hillshade-shadow-color', '#10243A');
          map.setPaintProperty(layer.id, 'hillshade-highlight-color', colors.mountain);
          map.setPaintProperty(layer.id, 'hillshade-illumination-direction', 315);
          return;
        }
        if (type === 'symbol' && layer.layout?.['text-field']) {
          const isWater = id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('marine');
          map.setPaintProperty(layer.id, 'text-color', isWater ? colors.labelDim : colors.label);
          map.setPaintProperty(layer.id, 'text-halo-color', colors.space);
          map.setPaintProperty(layer.id, 'text-halo-width', 1.1);
        }
      } catch { /* style layers expose different paint properties */ }
    });

    if (map.getSource('protomaps') && !map.getLayer('vuvio-native-land')) {
      const firstFill = map.getStyle().layers?.find((layer) => layer.type === 'fill');
      map.addLayer({
        id: 'vuvio-native-land',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        filter: ['==', ['get', 'kind'], 'earth'],
        paint: {
          'fill-color': colors.land,
          'fill-opacity': 1,
        },
      }, firstFill?.id);
    }

    if (map.getSource('protomaps') && !map.getLayer('vuvio-native-city-glow')) {
      const largeCityFilter = [
        'all',
        ['==', ['get', 'kind'], 'locality'],
        ['==', ['get', 'kind_detail'], 'city'],
        ['>=', ['get', 'population_rank'], 13],
      ];

      map.addLayer({
        id: 'vuvio-native-city-glow',
        type: 'circle',
        source: 'protomaps',
        'source-layer': 'places',
        minzoom: 1,
        filter: largeCityFilter,
        paint: {
          'circle-color': '#D98A43',
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, ['interpolate', ['linear'], ['get', 'population_rank'], 13, 5.5, 17, 7],
            7, ['interpolate', ['linear'], ['get', 'population_rank'], 13, 7, 17, 9],
          ],
          'circle-blur': 0.9,
          'circle-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'vuvio-native-city-light-core',
        type: 'circle',
        source: 'protomaps',
        'source-layer': 'places',
        minzoom: 1,
        filter: largeCityFilter,
        paint: {
          'circle-color': '#EAB976',
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            1, ['interpolate', ['linear'], ['get', 'population_rank'], 13, 1.4, 17, 1.8],
            7, ['interpolate', ['linear'], ['get', 'population_rank'], 13, 1.8, 17, 2.4],
          ],
          'circle-opacity': 0.78,
        },
      });
    }

    if (!map.getContainer().querySelector('.maplibregl-ctrl-attrib')) {
      map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
    }
  } catch { /* style capabilities vary by MapLibre version */ }
}

function brightenBaseGlobe(map, includeHighResolutionImagery = false, useRasterTextures = true, customNativeStyle = false) {
  try {
    if (customNativeStyle) {
      styleNativeGlobe(map);
    } else {
      map.setSky?.({
        'sky-color': PAL.space,
        'horizon-color': '#071522',
        'fog-color': '#071522',
        'sky-horizon-blend': 0.18,
        'horizon-fog-blend': 0.24,
        'fog-ground-blend': 0.02,
        'atmosphere-blend': 0.035,
      });
    }

    if (useRasterTextures) map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const type = layer.type;

      try {
        if (type === 'background') {
          map.setPaintProperty(layer.id, 'background-color', PAL.space);
          return;
        }
        if (type === 'fill') {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }
        if (type === 'fill-extrusion' && id.includes('building')) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }
        if (type === 'line') {
          const isBoundary = id.includes('admin') || id.includes('boundary') || id.includes('border');
          const isWater = id.includes('water') || id.includes('river') || id.includes('stream');
          map.setPaintProperty(layer.id, 'line-color', isBoundary ? '#8BA8B5' : isWater ? '#102B3B' : '#365367');
          map.setPaintProperty(layer.id, 'line-opacity', isBoundary ? 0.2 : isWater ? 0.18 : 0.24);
          return;
        }

        if (type === 'circle') {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }

        if (type === 'symbol') {
          try {
            const iconImage = layer.layout?.['icon-image'];
            const hasText = !!layer.layout?.['text-field'];
            if (iconImage && !hasText) {
              map.setLayoutProperty(layer.id, 'visibility', 'none');
              return;
            }
          } catch { /* layout may be undefined */ }

          if (id.includes('country') || id.includes('continent')) {
            map.setPaintProperty(layer.id, 'text-color', '#B7C7D0');
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            return;
          }
          if (id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('marine')) {
            map.setPaintProperty(layer.id, 'text-color', '#728B9B');
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            return;
          }
          if (id.includes('city') || id.includes('place') || id.includes('town')
              || id.includes('village') || id.includes('suburb') || id.includes('neighbourhood')
              || id.includes('neighborhood')) {
            map.setPaintProperty(layer.id, 'text-color', '#B7C7D0');
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            return;
          }
          try {
            map.setPaintProperty(layer.id, 'text-color', '#728B9B');
            map.setPaintProperty(layer.id, 'text-halo-color', PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
          } catch { /* layer without text-color */ }
        }
      } catch { /* paint property may not exist on all layers */ }
    });

    if (useRasterTextures && !map.getSource('vuvio-earth-surface')) {
      map.addSource('vuvio-earth-surface', {
        type: 'raster',
        tiles: [`${window.location.origin}/assets/globe/maplibre-earth-night/{z}/{x}/{y}.jpg`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 4,
        scheme: 'xyz',
      });
      const underlay = map.getStyle().layers?.find((layer) => layer.type === 'line' || layer.type === 'symbol');
      map.addLayer({
        id: 'vuvio-earth-surface-raster',
        type: 'raster',
        source: 'vuvio-earth-surface',
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 0,
          'raster-saturation': -0.28,
          'raster-contrast': 0.08,
        },
      }, underlay?.id);
    }

    if (useRasterTextures && !map.getSource('vuvio-earth-detail')) {
      map.addSource('vuvio-earth-detail', {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 8,
        scheme: 'xyz',
        attribution: 'NASA GIBS — Blue Marble Next Generation',
      });
      const underlay = map.getStyle().layers?.find((layer) => layer.type === 'line' || layer.type === 'symbol');
      map.addLayer({
        id: 'vuvio-earth-detail-raster',
        type: 'raster',
        source: 'vuvio-earth-detail',
        minzoom: 2,
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0, 3, 0.025, 4, 0.05, 5, 0.07, 8, 0.08],
          'raster-fade-duration': 0,
          'raster-saturation': -0.48,
          'raster-contrast': 0.02,
          'raster-brightness-min': 0.01,
          'raster-brightness-max': 0.9,
        },
      }, underlay?.id);
    }

    if (useRasterTextures && includeHighResolutionImagery && !map.getSource('vuvio-earth-high-resolution')) {
      map.addSource('vuvio-earth-high-resolution', {
        type: 'raster',
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 21,
        scheme: 'xyz',
        attribution: '<a href="https://cloudless.eox.at/">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
      });
      const underlay = map.getStyle().layers?.find((layer) => layer.type === 'line' || layer.type === 'symbol');
      map.addLayer({
        id: 'vuvio-earth-high-resolution-raster',
        type: 'raster',
        source: 'vuvio-earth-high-resolution',
        minzoom: 1,
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.1, 2, 0.12, 3, 0.14, 4, 0.15, 5, 0.14, 6, 0.12, 7, 0.14, 8, 0.2, 9, 0.27, 10, 0.35, 11, 0.43, 12, 0.5, 14, 0.58, 16, 0.62],
          'raster-fade-duration': 0,
          'raster-saturation': -0.48,
          'raster-contrast': 0.02,
          'raster-brightness-min': 0,
          'raster-brightness-max': 1,
        },
      }, underlay?.id);
      map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
    }
  } catch {
    // Base style support can differ entre MapLibre versions/providers.
  }
}

export default function CurrentGlobe({ streams, onboarding = false, onOnboardingLiveSelect, variant = 'current' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const haloCanvasRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const dvMarkersRef = useRef({});
  const htmlMarkersRef = useRef({});
  const liveStreamsRef = useRef([]);
  const lastClusterSignatureRef = useRef('');
  const handleClickRef = useRef(null);
  const selectedIdRef = useRef(null);
  const selectionReturnViewRef = useRef(null);
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [sheetState, setSheetState] = useState('closed');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [displayedStreams, setDisplayedStreams] = useState([]);
  const [hoveredId, setHoveredId] = useState('');
  const [hoverStream, setHoverStream] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [pingRefreshTick, setPingRefreshTick] = useState(0);
  const [mapError, setMapError] = useState('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [fpsHud, setFpsHud] = useState({ fps: 0, zoom: 0, tiles: 0, mem: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [remindedIds, setRemindedIds] = useState(() => new Set());
  const lastHaloZoomRef = useRef(-1);
  const fpsBufRef = useRef([]);
  const fpsEnabled = searchParams.get('fps') === '1' || searchParams.get('fps') === 'true';
  const cLabels = useMemo(() => makeCountdownLabels(t), [t]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) { setRemindedIds(new Set()); return undefined; }
    let active = true;
    getRemindedStreamIds(user.uid)
      .then((ids) => { if (active) setRemindedIds(new Set(ids)); })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.uid]);

  const toggleRemind = useCallback(async (stream) => {
    if (!user?.uid || !stream?.id) return;
    const next = new Set(remindedIds);
    if (next.has(stream.id)) {
      next.delete(stream.id);
    } else {
      next.add(stream.id);
      try {
        await createNotification(user.uid, {
          type: 'remind_me',
          streamId: stream.id,
          creatorName: stream.name ?? stream.creatorName ?? '',
          title: stream.experienceTitle ?? stream.title ?? '',
          scheduledAt: stream.startsAt ?? null,
          image: stream.image ?? null,
        });
      } catch { /* non-blocking */ }
    }
    setRemindedIds(next);
  }, [remindedIds, user?.uid]);

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
  liveStreamsRef.current = liveStreams;

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
      minZoom: INITIAL_ZOOM,
      maxZoom: 16,
      maxPitch: 80,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: variant === 'maplibre-custom'
        ? Math.min(window.devicePixelRatio || 1, window.matchMedia?.('(pointer: coarse)').matches ? 1 : 1.1)
        : Math.min(window.devicePixelRatio || 1, window.matchMedia?.('(pointer: coarse)').matches ? 1 : 1.25),
    });

    mapRef.current = map;
    const globeSurface = containerRef.current.closest('.test-old-globe');
    const hideStarfieldOnZoom = () => globeSurface?.classList.add('is-zoomed');
    const syncStarfieldAfterZoom = () => {
      globeSurface?.classList.toggle('is-zoomed', map.getZoom() > INITIAL_ZOOM + 0.05);
    };
    if (variant === 'maplibre-custom') {
      map.on('zoomstart', hideStarfieldOnZoom);
      map.on('zoomend', syncStarfieldAfterZoom);
    }

    const resizeMap = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect?.width > 0 && rect?.height > 0) map.resize();
    };
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(containerRef.current);
    requestAnimationFrame(() => requestAnimationFrame(resizeMap));

    const resizeHaloCanvas = () => {
      const haloCanvas = haloCanvasRef.current;
      if (!haloCanvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      haloCanvas.width = rect.width * (window.devicePixelRatio || 1);
      haloCanvas.height = rect.height * (window.devicePixelRatio || 1);
      haloCanvas.style.width = `${rect.width}px`;
      haloCanvas.style.height = `${rect.height}px`;
      const ctx = haloCanvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    if (variant !== 'maplibre-custom') {
      const haloCanvas = document.createElement('canvas');
      haloCanvas.className = 'globe-atmospheric-halo';
      haloCanvas.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 1;';
      containerRef.current.appendChild(haloCanvas);
      haloCanvasRef.current = haloCanvas;
      resizeHaloCanvas();
      window.addEventListener('resize', resizeHaloCanvas);
    }
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

    let initializeMap = null;
    let mapInitialized = false;
    const loadedPoll = window.setInterval(() => {
      if (!mapInitialized && map.isStyleLoaded()) initializeMap?.();
      if (map.loaded() && map.getCanvas()?.width > 0 && map.getCanvas()?.height > 0) {
        map.once('idle', () => setIsMapLoaded(true));
        window.clearInterval(loadedPoll);
      }
    }, 150);

    const revealOnRender = () => {
      if (map.loaded() && map.getCanvas()?.width > 0 && map.getCanvas()?.height > 0) {
        map.once('idle', () => setIsMapLoaded(true));
        map.off('render', revealOnRender);
      }
    };
    map.on('render', revealOnRender);

    const revealNativeGlobe = () => {
      if (variant !== 'maplibre-custom') return;
      map.setProjection({ type: 'globe' });
      styleNativeGlobe(map);
      resizeMap();
      map.triggerRepaint();
      setIsMapLoaded(true);
    };
    if (variant === 'maplibre-custom') map.on('style.load', revealNativeGlobe);

    initializeMap = () => {
      if (mapInitialized || !map.isStyleLoaded()) return;
      mapInitialized = true;
      try {
        window.clearInterval(loadedPoll);
        map.setProjection({ type: 'globe' });
        resizeMap();
        if (variant === 'maplibre-custom') setIsMapLoaded(true);
        map.once('idle', () => setIsMapLoaded(true));
        brightenBaseGlobe(
          map,
          !onboarding && variant === 'current',
          variant === 'current',
          variant === 'maplibre-custom',
        );

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

        map.setPadding({ top: 0, bottom: 165, left: 0, right: 0 });

        map.addSource('vuvio-test-lives', {
          type: 'geojson',
          data: buildCollection(liveStreams),
          cluster: true,
          clusterRadius: 35,
          clusterMaxZoom: 15,
        });
        const styleLiveHalo = (value, scale) => (variant === 'maplibre-custom' ? ['*', value, scale] : value);

        map.addLayer({
          id: 'vuvio-test-cluster-anchor',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['has', 'point_count'],
          paint: { 'circle-radius': 1, 'circle-opacity': 0 },
        });

        map.addLayer({
          id: 'vuvio-test-point-anchor',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': 1, 'circle-opacity': 0 },
        });

        map.addLayer({
          id: 'vuvio-test-live-glow',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': styleLiveHalo(liveColorGlowRadius(0), 0.78),
            'circle-blur': variant === 'maplibre-custom' ? 4.2 : 5.5,
            'circle-opacity': styleLiveHalo(liveColorGlowOpacity(0), 0.68),
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
            'circle-blur': variant === 'maplibre-custom' ? 1.9 : 2.5,
            'circle-opacity': styleLiveHalo(liveBroadcastHaloOpacity(0, selectedId ?? ''), 0.72),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-crowd-halo',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': styleLiveHalo(liveCrowdHaloRadius(0), 0.78),
            'circle-blur': variant === 'maplibre-custom' ? 1.7 : 2.2,
            'circle-opacity': styleLiveHalo(liveCrowdHaloOpacity(0), 0.72),
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

        // Luminous core kept for ambient halo tying but hidden — avatar markers (HTML) render on top.
        map.addLayer({
          id: 'vuvio-test-live-points',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          layout: { visibility: 'none' },
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

        const selectStream = (stream) => {
          if (!stream) return;
          const coords = stream.coordinates;
          if (!coords) return;
          if (!selectedIdRef.current) {
            const center = map.getCenter();
            selectionReturnViewRef.current = {
              center: [center.lng, center.lat],
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            };
          }
          if (stream.type === 'cluster') {
            const source = map.getSource('vuvio-test-lives');
            if (!source) return;
            setSelectedId(null);
            selectedIdRef.current = null;
            pauseUntilRef.current = Date.now() + 8500;
            Promise.all([
              source.getClusterLeaves(stream.clusterId, stream.count, 0),
              source.getClusterExpansionZoom(stream.clusterId),
            ]).then(([features, zoom]) => {
              const ids = new Set(features.map((feature) => feature.properties?.id));
              setSelectedCluster({ ...stream, streams: liveStreamsRef.current.filter((live) => ids.has(live.id)) });

              let targetCoordinates = coords;
              if (variant === 'maplibre-custom') {
                const xyz = features.reduce((sum, feature) => {
                  const point = feature.geometry?.coordinates;
                  if (!Array.isArray(point)) return sum;
                  const longitude = (point[0] * Math.PI) / 180;
                  const latitude = (point[1] * Math.PI) / 180;
                  sum[0] += Math.cos(latitude) * Math.cos(longitude);
                  sum[1] += Math.cos(latitude) * Math.sin(longitude);
                  sum[2] += Math.sin(latitude);
                  return sum;
                }, [0, 0, 0]);
                if (features.length > 0) {
                  targetCoordinates = [
                    (Math.atan2(xyz[1], xyz[0]) * 180) / Math.PI,
                    (Math.atan2(xyz[2], Math.hypot(xyz[0], xyz[1])) * 180) / Math.PI,
                  ];
                }
              }
              const currentZoom = map.getZoom();
              const expansionZoom = Math.min(zoom + 0.25, currentZoom + 1.25);
              map.easeTo({
                center: targetCoordinates,
                zoom: Math.min(Math.max(expansionZoom, currentZoom + 0.9), map.getMaxZoom()),
                duration: 1000,
                easing: (t) => 1 - Math.pow(1 - t, 3),
                essential: true,
              });
            }).catch(() => {});
            return;
          }
          analyticsService.trackGlobePinClicked(
            stream.id,
            stream.creatorId || stream.id,
            coords[1],
            coords[0],
          );
          setSelectedCluster(null);
          selectedIdRef.current = stream.id;
          setSelectedId(stream.id);
          onOnboardingLiveSelect?.(stream.id);
          pauseUntilRef.current = Date.now() + 8500;
          const currentZoom = map.getZoom();
          const targetZoom = variant === 'maplibre-custom'
            ? Math.min(currentZoom + 1.5, map.getMaxZoom())
            : Math.min(Math.max(SELECTED_LIVE_ZOOM, currentZoom + 0.6), map.getMaxZoom());
          map.easeTo({
            center: coords,
            zoom: targetZoom,
            duration: 950,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
          });
        };

        handleClickRef.current = selectStream;

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
    };
    map.on('load', initializeMap);
    if (map.isStyleLoaded()) initializeMap();

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
      map.off('zoomstart', hideStarfieldOnZoom);
      map.off('zoomend', syncStarfieldAfterZoom);
      window.removeEventListener('resize', resizeHaloCanvas);
      map.off('render', revealOnRender);
      map.off('style.load', revealNativeGlobe);
      if (initializeMap) map.off('load', initializeMap);
      resizeObserver.disconnect();
      window.clearInterval(loadedPoll);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      for (const marker of Object.values(dvMarkersRef.current)) marker.remove();
      dvMarkersRef.current = {};
      for (const marker of Object.values(htmlMarkersRef.current)) marker.remove();
      htmlMarkersRef.current = {};
      if (haloCanvasRef.current?.parentNode) haloCanvasRef.current.parentNode.removeChild(haloCanvasRef.current);
      document.getElementById('vuvio-globe-svg-filters')?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const liveStreamsCollection = useMemo(() => buildCollection(liveStreams), [liveStreams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const update = () => map.getSource('vuvio-test-lives')?.setData(liveStreamsCollection);
    if (map.getSource('vuvio-test-lives')) update();
    else map.once('load', update);
    return () => map.off('load', update);
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

  // HTML avatar markers — look matches GlobeTest2 (.gt2-marker)
  const buildMarkerElement = useCallback((stream) => {
    const el = document.createElement('div');
    el._vuvioStream = stream;
    el.dataset.streamId = stream.id;
    el.style.setProperty('--marker-color', stream.familyColor || '#28d8df');

    if (stream.type === 'cluster') {
      el.className = 'gt2-marker gt2-marker--cluster';
      el.innerHTML = `
        <div class="gt2-marker__bubble">
          <span class="gt2-marker__count">${stream.count}</span>
          <span class="gt2-marker__live-label">LIVE</span>
        </div>
        <div class="gt2-marker__stem"></div>
        <div class="gt2-marker__dot"></div>
      `;
    } else {
      el.className = 'gt2-marker gt2-marker--avatar';
      const img = stream.image || '';
      const initial = (stream.name || stream.creatorName || '?')[0].toUpperCase();
      el.innerHTML = img
        ? `<div class="gt2-marker__bubble"><img src="${img}" alt="" loading="lazy" /></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`
        : `<div class="gt2-marker__bubble"><span class="gt2-marker__initial">${initial}</span></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`;
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleClickRef.current?.(el._vuvioStream);
    });
    return el;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const computeClusters = () => {
      if (!map.getLayer('vuvio-test-cluster-anchor') || !map.getLayer('vuvio-test-point-anchor')) return;
      if (!map.isSourceLoaded('vuvio-test-lives')) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const centerLatRad = (center.lat * Math.PI) / 180;
      const centerLngRad = (center.lng * Math.PI) / 180;
      const sinCLat = Math.sin(centerLatRad);
      const cosCLat = Math.cos(centerLatRad);
      const globeMode = zoom < 6;
      const byId = new Map(liveStreams.map((stream) => [String(stream.id), stream]));
      const seen = new Set();
      const next = [];
      const canvas = map.getCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const sourceFeatures = map.querySourceFeatures('vuvio-test-lives');
      const targetZoom = Math.floor(zoom);
      const tileZooms = [...new Set(sourceFeatures.map((feature) => feature._z))];
      tileZooms.sort((a, b) => Math.abs(a - targetZoom) - Math.abs(b - targetZoom));
      const features = sourceFeatures.filter((feature) => feature._z === tileZooms[0]);

      for (const feature of features) {
        const clusterId = feature.properties?.cluster_id;
        const isCluster = feature.properties?.point_count != null;
        const key = isCluster
          ? `cluster-${clusterId}-${feature.properties.point_count}`
          : String(feature.properties?.id);
        if (seen.has(key)) continue;

        const coords = feature.geometry?.coordinates;
        if (!Array.isArray(coords)) continue;
        const point = map.project(coords);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
          || point.x < -24 || point.x > width + 24
          || point.y < -24 || point.y > height + 24) continue;
        if (globeMode) {
          const latRad = (coords[1] * Math.PI) / 180;
          const lngRad = (coords[0] * Math.PI) / 180;
          const cosAngle = sinCLat * Math.sin(latRad)
            + cosCLat * Math.cos(latRad) * Math.cos(lngRad - centerLngRad);
          if (cosAngle < 0.42) continue;
        }
        seen.add(key);

        if (isCluster) {
          next.push({
            id: key,
            type: 'cluster',
            clusterId,
            count: Number(feature.properties.point_count),
            coordinates: coords,
          });
        } else {
          const stream = byId.get(String(feature.properties?.id));
          if (stream) next.push(stream);
        }
      }

      const nextSignature = next.map((item) => `${item.id}:${item.count ?? 1}:${item.coordinates.join(',')}`).sort().join(';');
      if (nextSignature === lastClusterSignatureRef.current) return;
      lastClusterSignatureRef.current = nextSignature;
      setDisplayedStreams(next);
    };

    let clusterRaf = 0;
    const scheduleClusters = () => {
      if (clusterRaf) return;
      clusterRaf = requestAnimationFrame(() => {
        clusterRaf = 0;
        computeClusters();
      });
    };

    lastClusterSignatureRef.current = '';
    scheduleClusters();
    map.on('render', scheduleClusters);
    map.on('sourcedata', scheduleClusters);
    map.on('moveend', scheduleClusters);
    return () => {
      cancelAnimationFrame(clusterRaf);
      map.off('render', scheduleClusters);
      map.off('sourcedata', scheduleClusters);
      map.off('moveend', scheduleClusters);
    };
  }, [liveStreams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    let cullRafPending = false;
    const cullVisCache = new WeakMap();
    const cullBackfaceMarkers = () => {
      if (cullRafPending) return;
      cullRafPending = true;
      requestAnimationFrame(() => {
        cullRafPending = false;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const centerLatRad = (center.lat * Math.PI) / 180;
        const centerLngRad = (center.lng * Math.PI) / 180;
        const sinCLat = Math.sin(centerLatRad);
        const cosCLat = Math.cos(centerLatRad);
        // Globe projection flattens past zoom ~6 → skip backface check once we're zoomed in.
        const globeMode = zoom < 6;
        const canvas = map.getCanvas();
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const margin = 24;

        for (const marker of Object.values(htmlMarkersRef.current)) {
          const el = marker.getElement();
          let hide = false;
          const ll = marker.getLngLat();
          if (globeMode) {
            const latRad = (ll.lat * Math.PI) / 180;
            const lngRad = (ll.lng * Math.PI) / 180;
            const cosAngle = sinCLat * Math.sin(latRad)
              + cosCLat * Math.cos(latRad) * Math.cos(lngRad - centerLngRad);
            // Hide markers more than ~65° from view center — the ones near
            // the horizon are heavily distorted and visually barely there.
            if (cosAngle < 0.42) hide = true;
          }
          if (!hide) {
            // Viewport frustum cull: hide markers outside the canvas rect.
            const p = map.project(ll);
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)
              || p.x < -margin || p.x > w + margin
              || p.y < -margin || p.y > h + margin) {
              hide = true;
            }
          }
          if (cullVisCache.get(el) !== hide) {
            cullVisCache.set(el, hide);
            el.style.visibility = hide ? 'hidden' : '';
            el.classList.toggle('is-culled', hide);
          }
        }
      });
    };

    const sync = () => {
      const currentIds = new Set(displayedStreams.map((s) => s.id));
      for (const [id, marker] of Object.entries(htmlMarkersRef.current)) {
        if (!currentIds.has(id)) {
          marker.remove();
          delete htmlMarkersRef.current[id];
        }
      }
      for (const stream of displayedStreams) {
        const existing = htmlMarkersRef.current[stream.id];
        if (existing) {
          existing.getElement()._vuvioStream = stream;
          existing.setLngLat(stream.coordinates);
          continue;
        }
        const el = buildMarkerElement(stream);
        htmlMarkersRef.current[stream.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(stream.coordinates)
          .addTo(map);
      }
      cullBackfaceMarkers();
    };

    sync();
    map.on('move', cullBackfaceMarkers);
    map.on('zoom', cullBackfaceMarkers);
    return () => {
      map.off('move', cullBackfaceMarkers);
      map.off('zoom', cullBackfaceMarkers);
    };
  }, [buildMarkerElement, displayedStreams]);

  useEffect(() => {
    document.querySelectorAll('.gt2-marker.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (!selectedId) return undefined;
    const el = document.querySelector(`.gt2-marker[data-stream-id="${selectedId}"]`);
    if (el) el.classList.add('is-selected');
    return undefined;
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (variant === 'maplibre-custom') {
      let rotationTimer = 0;
      let moveEndHandler = null;
      let cancelled = false;
      const rotate = () => {
        if (document.visibilityState === 'hidden'
          || Date.now() <= pauseUntilRef.current
          || selectedId
          || map.getZoom() > 2.5
          || map.isMoving()
          || !map.isStyleLoaded()) {
          rotationTimer = window.setTimeout(rotate, 300);
          return;
        }

        const center = map.getCenter();
        const delta = ROTATE_DEGREES_PER_SECOND * 2;
        moveEndHandler = () => {
          if (moveEndHandler) map.off('moveend', moveEndHandler);
          moveEndHandler = null;
          if (!cancelled) rotate();
        };
        map.on('moveend', moveEndHandler);
        map.easeTo({
          center: [center.lng + delta, center.lat],
          duration: 2000,
          easing: (progress) => progress,
          essential: true,
        });
      };

      rotate();
      return () => {
        cancelled = true;
        window.clearTimeout(rotationTimer);
        if (moveEndHandler) map.off('moveend', moveEndHandler);
      };
    }
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
      const center = map.getCenter();
      drawAtmosphericHalo(haloCanvas, ctx, totalRotation, time, zoom, { ...map.project([center.lng, center.lat]), map });
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedId, variant]);

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
    setSelectedCluster(null);
    selectedIdRef.current = null;
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
      className={`screen test-globe-screen test-globe-screen--maplibre test-globe-screen--actual test-globe-screen--${variant}${onboarding ? ' test-globe-screen--onboarding' : ''}`}
      data-sheet-state={sheetState}
      aria-label="Current Vuvio globe"
    >
      <div className={`test-old-globe${isMapLoaded ? ' is-loaded' : ''}`}>
        <div ref={containerRef} className="test-old-globe__canvas" />
        {!isMapLoaded && <div className="test-old-globe__loading-mask" aria-hidden="true" />}
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        {!onboarding && (
          <div className="gt2-status-bar">
            <button
              type="button"
              className={`gt2-status-btn${activeStatuses.includes('live') && !activeStatuses.includes('upcoming') ? ' gt2-status-btn--active' : ''}`}
              onClick={() => setActiveStatuses(['live'])}
            >Live</button>
            <button type="button" className="gt2-status-btn gt2-status-btn--dim" disabled>Recent</button>
            <button
              type="button"
              className={`gt2-status-btn${activeStatuses.includes('upcoming') && !activeStatuses.includes('live') ? ' gt2-status-btn--active' : ''}`}
              onClick={() => setActiveStatuses(['upcoming'])}
            >Upcoming</button>
          </div>
        )}

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
                {selectedLive.status === 'upcoming' ? (() => {
                  const cd = getCountdownState(selectedLive.startsAt, now, cLabels);
                  return (
                    <div className="gt2-card__countdown">
                      <span className="gt2-card__countdown-label">{cd.label}</span>
                      {cd.value && <strong className="gt2-card__countdown-value">{cd.value}</strong>}
                    </div>
                  );
                })() : <strong>{selectedLive.viewers} viewers</strong>}
              </div>
              <div className="test-globe-card__actions">
                {selectedLive.status === 'upcoming' ? (
                  <button
                    type="button"
                    className={`gt2-card__remind-btn${remindedIds.has(selectedLive.id) ? ' is-active' : ''}`}
                    onClick={() => toggleRemind(selectedLive)}
                  >
                    {remindedIds.has(selectedLive.id)
                      ? <><BellOff size={13} strokeWidth={2} />Rappel activé</>
                      : <><Bell size={13} strokeWidth={2} />Me notifier</>}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="test-globe-card__watch"
                    onClick={() => navigate(watchPathForLive(selectedLive))}
                  >
                    <Play size={13} fill="currentColor" strokeWidth={1.8} />
                    Watch
                  </button>
                )}
              </div>
            </div>
          </aside>
        ) : null}

        {!onboarding && selectedCluster && (
          <div className="gt2-cluster-sheet">
            <div className="gt2-cluster-sheet__handle" />
            <div className="gt2-cluster-sheet__header">
              <span className="gt2-cluster-sheet__title">
                {selectedCluster.count} live{selectedCluster.count > 1 ? 's' : ''}
                {selectedCluster.streams[0]?.city ? ` in ${selectedCluster.streams[0].city}` : ' nearby'}
              </span>
              <button
                type="button"
                className="gt2-cluster-sheet__close"
                onClick={recenter}
                aria-label="Close"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="gt2-cluster-sheet__list">
              {selectedCluster.streams.map((s) => {
                const profilePath = s.creatorUid ? `/profile/${s.creatorUid}` : null;
                return (
                  <div key={s.id} className="gt2-cluster-sheet__item">
                    <button
                      type="button"
                      className="gt2-cluster-sheet__item-left"
                      onClick={() => { if (profilePath) { setSelectedCluster(null); navigate(profilePath); } }}
                      aria-label={`View ${s.name}'s profile`}
                    >
                      <img src={s.image} alt="" loading="lazy" />
                    </button>
                    <button
                      type="button"
                      className="gt2-cluster-sheet__item-body"
                      onClick={() => { if (profilePath) { setSelectedCluster(null); navigate(profilePath); } }}
                    >
                      <span className="gt2-cluster-sheet__item-title">{s.experienceTitle || s.subcategory}</span>
                      <span className="gt2-cluster-sheet__item-creator">{s.name}</span>
                      <span className="gt2-cluster-sheet__item-meta">
                        {s.city}, {s.country}
                        {s.status === 'upcoming'
                          ? ` · ${s.day === 'TODAY' ? "Aujourd'hui" : 'Demain'} ${s.time}`
                          : ` · ${s.viewers?.toLocaleString?.() ?? s.viewers} viewers`}
                      </span>
                    </button>
                    {s.status === 'upcoming' ? (
                      <span className="gt2-cluster-sheet__item-soon">À venir</span>
                    ) : (
                      <button
                        type="button"
                        className="gt2-cluster-sheet__item-watch"
                        onClick={() => { setSelectedCluster(null); navigate(watchPathForLive(s)); }}
                      >Watch</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
