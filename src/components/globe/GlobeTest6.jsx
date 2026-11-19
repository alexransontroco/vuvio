import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { mapStreams } from '../../data/mapStreams.js';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { getCreatedLives, subscribeToCreatedLives } from '../../services/createdLiveService.js';
import MapBottomSheet from '../map/MapBottomSheet.jsx';
import { LocateFixed, Minus, Plus, SlidersHorizontal, ChevronUp, X, Play, Bell, BellOff, RefreshCw, MapPin, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCountdownState, makeCountdownLabels } from '../../utils/countdown.js';
import { createNotification, getRemindedStreamIds } from '../../services/notificationService.js';
import { useAuth } from '../../context/AuthContext.jsx';

// ── Globe sharpening — GPU post-process unsharp mask ─────────────────────────
// Off by default: the 2-pass composer (render + sharpen + gamma) ~doubles GPU cost.
// Opt-in via URL ?sharpen=1
const ENABLE_GLOBE_SHARPENING = false;
const SHARPEN_STRENGTH = 0.35;        // 0=off  0.2=subtle  0.35=medium  0.5=strong

const UnsharpMaskShader = {
  uniforms: {
    tDiffuse:   { value: null },
    resolution: { value: new THREE.Vector2() },
    strength:   { value: SHARPEN_STRENGTH },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec2 texel = vec2(1.0) / resolution;
      vec4 center = texture2D(tDiffuse, vUv);
      vec4 neighbors =
        texture2D(tDiffuse, vUv + vec2(-texel.x, 0.0)) +
        texture2D(tDiffuse, vUv + vec2( texel.x, 0.0)) +
        texture2D(tDiffuse, vUv + vec2(0.0, -texel.y)) +
        texture2D(tDiffuse, vUv + vec2(0.0,  texel.y));
      vec4 sharpened = center + (center - neighbors * 0.25) * strength;
      gl_FragColor = clamp(sharpened, 0.0, 1.0);
    }
  `,
};

if (typeof window !== 'undefined') window.THREE = THREE;

// ── Clustering ────────────────────────────────────────────────────────────────

function getClusterPrecision(altitude) {
  if (altitude > 2.0) return 20;
  if (altitude > 1.0) return 8;
  if (altitude > 0.5) return 3;
  return 1;
}

function buildClusteredStreams(streams, expandedClusterId, precision = 20) {
  const groups = new Map();
  streams.forEach((stream) => {
    const [lng, lat] = stream.coordinates;
    const key = `${Math.round(lat / precision)}:${Math.round(lng / precision)}`;
    const current = groups.get(key) ?? [];
    current.push(stream);
    groups.set(key, current);
  });

  const items = [];
  groups.forEach((group, key) => {
    if (group.length < 2 || expandedClusterId === key) {
      group.forEach((stream) => {
        items.push({ ...stream, type: 'live', clusterId: key, displayCoordinates: stream.coordinates });
      });
      return;
    }

    let sumLat = 0, sumLng = 0, sumViewers = 0;
    group.forEach((s) => {
      sumLat += s.coordinates[1];
      sumLng += s.coordinates[0];
      sumViewers += parseInt(String(s.viewers ?? '0').replace(/\D/g, ''), 10) || 0;
    });

    items.push({
      id: `cluster-${key}`,
      type: 'cluster',
      clusterId: key,
      streams: group,
      count: group.length,
      viewers: sumViewers,
      coordinates: [sumLng / group.length, sumLat / group.length],
      displayCoordinates: [sumLng / group.length, sumLat / group.length],
    });
  });

  return items;
}

// ── Stars + shooting stars on 2D canvas overlay ─────────────────────────────

function drawStars(canvas, ctx, time, altitude) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = w / 2;
  const cy = h / 2;

  const globeRadius = h / (0.93 * (altitude + 1));
  const halfDiag = Math.hypot(cx, cy);
  const drawEnabled = globeRadius < halfDiag * 1.15 && altitude > 0.9;

  ctx.clearRect(0, 0, w, h);
  if (!drawEnabled) return;

  const t = time * 0.001;
  const exclusion = globeRadius * 1.08;
  const starCount = Math.max(180, Math.floor((w * h) / 8000));

  for (let i = 0; i < starCount; i += 1) {
    const seed = i * 97.37;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin((seed + 19.19) * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * w;
    const py = Math.abs(y) * h;
    if (Math.hypot(px - cx, py - cy) < exclusion) continue;

    const f1 = 0.18 + Math.abs(Math.sin(seed * 5.3)) * 0.55;
    const f2 = 0.52 + Math.abs(Math.sin(seed * 2.7)) * 0.90;
    const f3 = 1.10 + Math.abs(Math.sin(seed * 8.1)) * 1.40;
    const twinkle = 0.55
      + Math.sin(t * f1 + seed * 1.3) * 0.22
      + Math.sin(t * f2 + seed * 3.7) * 0.14
      + Math.sin(t * f3 + seed * 7.1) * 0.07;
    const size = 0.35 + Math.abs(Math.sin(seed * 0.17)) * 0.9;
    const opacity = Math.max(0.12, Math.min(1.0, twinkle));

    const r = 215 + Math.floor(Math.abs(Math.sin(seed * 3.1)) * 40);
    const g = 230 + Math.floor(Math.abs(Math.sin(seed * 2.3)) * 25);
    const b = 255;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();

    if (size > 1.0 && opacity > 0.78) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.35})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px - size * 2.8, py);
      ctx.lineTo(px + size * 2.8, py);
      ctx.moveTo(px, py - size * 2.8);
      ctx.lineTo(px, py + size * 2.8);
      ctx.stroke();
    }
  }

  const shootingSlots = altitude > 2.0 ? 2 : 1;
  for (let i = 0; i < shootingSlots; i++) {
    const ss = i * 214.7 + 31.9;
    const period = 22 + Math.abs(Math.sin(ss * 1.3)) * 24;
    const phase = (t + ss * 3.1) % period;
    const dur = 1.2 + Math.abs(Math.sin(ss * 4.1)) * 1.0;
    if (phase > dur) continue;

    const progress = phase / dur;
    const fade = progress < 0.10 ? progress / 0.10 : progress > 0.60 ? (1 - progress) / 0.40 : 1;
    const alpha = fade * 0.90;

    const cycleIndex = Math.floor((t + ss * 3.1) / period);
    const cs = ss + cycleIndex * 137.7;
    const edge = Math.floor(Math.abs(Math.sin(cs * 7.3)) * 3.999);
    const alongEdge = Math.abs(Math.sin(cs * 11.7));
    let sx, sy;
    if (edge === 0)      { sx = alongEdge * w; sy = 0; }
    else if (edge === 1) { sx = w;             sy = alongEdge * h; }
    else if (edge === 2) { sx = alongEdge * w; sy = h; }
    else                 { sx = 0;             sy = alongEdge * h; }

    const baseAngle = Math.atan2(cy - sy, cx - sx);
    const dirAngle = baseAngle + (Math.abs(Math.sin(cs * 2.1)) - 0.5) * 1.8;
    const len = (0.20 + Math.abs(Math.sin(cs * 5.7)) * 0.25) * Math.min(w, h);
    const ex = sx + Math.cos(dirAngle) * len;
    const ey = sy + Math.sin(dirAngle) * len;

    const dxL = ex - sx, dyL = ey - sy;
    const lenSq = dxL * dxL + dyL * dyL || 1;
    const tt = Math.max(0, Math.min(1, ((cx - sx) * dxL + (cy - sy) * dyL) / lenSq));
    const closestX = sx + tt * dxL;
    const closestY = sy + tt * dyL;
    if (Math.hypot(closestX - cx, closestY - cy) < globeRadius * 1.05) continue;

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

// ── GT6 — MapLibre layer (city/street-level handoff) ───────────────────────
// Second engine stacked on top of react-globe.gl, enabled only when the camera
// drops under a certain altitude. Uses the free CARTO Dark Matter vector style
// then repaints every layer with Vuvio's Midnight Blue palette for coherence
// with the Three.js globe texture. No API key required.
const GT6_MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

const GT6_PAL = {
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
  label:      '#D8E6F2',
  labelDim:   '#8EA3BA',
};

// Repaint every vector layer of the CARTO Dark Matter style to the Vuvio
// Midnight Blue palette. Copied from CurrentGlobe.jsx so GT6 stays isolated.
function brightenGT6BaseMap(map) {
  try {
    map.setFog?.({
      color: 'rgba(36, 139, 235, 0.22)',
      'high-color': 'rgba(36, 139, 235, 0.32)',
      'horizon-blend': 0.12,
      'space-color': GT6_PAL.space,
      'star-intensity': 0.88,
    });
    map.setSky?.({
      'sky-color': GT6_PAL.space,
      'horizon-color': '#0A2140',
      'fog-color': GT6_PAL.atmosphere,
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
        if (type === 'background') {
          map.setPaintProperty(layer.id, 'background-color', GT6_PAL.space);
          return;
        }
        if (type === 'fill' && (id.includes('water') || id.includes('ocean') || id.includes('sea') || sourceLayer.includes('water'))) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.ocean);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }
        if (type === 'line' && (id.includes('water') || id.includes('river') || id.includes('stream') || sourceLayer.includes('water'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.ocean);
          map.setPaintProperty(layer.id, 'line-opacity', 0.9);
          return;
        }
        if (type === 'fill' && (id.includes('park') || id.includes('wood') || id.includes('forest') || id.includes('green') || id.includes('grass') || id.includes('scrub') || id.includes('meadow') || id.includes('golf') || id.includes('pitch'))) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.park);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.78);
          return;
        }
        if (type === 'fill' && (id.includes('landcover') || id.includes('landuse'))) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.landLow);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.55);
          return;
        }
        if (type === 'fill' && (id.includes('residential') || id.includes('urban') || id.includes('builtup') || id.includes('industrial'))) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.landHigh);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.55);
          return;
        }
        if (type === 'fill' && (id.includes('land') || sourceLayer.includes('land'))) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.land);
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
          return;
        }
        if (type === 'fill' && id.includes('building')) {
          map.setPaintProperty(layer.id, 'fill-color', GT6_PAL.landHigh);
          map.setPaintProperty(layer.id, 'fill-opacity', 0.78);
          return;
        }
        if (type === 'fill-extrusion' && id.includes('building')) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          return;
        }
        if (type === 'line' && (id.includes('admin') || id.includes('boundary') || id.includes('border') || sourceLayer.includes('boundary'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.38);
          return;
        }
        if (type === 'line' && (id.includes('motorway') || id.includes('trunk'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.motorway);
          map.setPaintProperty(layer.id, 'line-opacity', 0.78);
          return;
        }
        if (type === 'line' && (id.includes('primary') || id.includes('secondary'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.7);
          return;
        }
        if (type === 'line' && (id.includes('road') || id.includes('street') || id.includes('tertiary') || id.includes('minor') || id.includes('service') || id.includes('path') || id.includes('track'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.roadMinor);
          map.setPaintProperty(layer.id, 'line-opacity', 0.55);
          return;
        }
        if (type === 'line' && (id.includes('rail') || id.includes('transit'))) {
          map.setPaintProperty(layer.id, 'line-color', GT6_PAL.road);
          map.setPaintProperty(layer.id, 'line-opacity', 0.32);
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
          } catch { /* noop */ }
          if (id.includes('country') || id.includes('continent')) {
            map.setPaintProperty(layer.id, 'text-color', GT6_PAL.label);
            map.setPaintProperty(layer.id, 'text-halo-color', GT6_PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
            return;
          }
          if (id.includes('water') || id.includes('ocean') || id.includes('sea') || id.includes('marine')) {
            map.setPaintProperty(layer.id, 'text-color', GT6_PAL.labelDim);
            map.setPaintProperty(layer.id, 'text-halo-color', GT6_PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
            return;
          }
          if (id.includes('city') || id.includes('place') || id.includes('town') || id.includes('village') || id.includes('suburb') || id.includes('neighbourhood') || id.includes('neighborhood')) {
            map.setPaintProperty(layer.id, 'text-color', GT6_PAL.label);
            map.setPaintProperty(layer.id, 'text-halo-color', GT6_PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1.2);
            return;
          }
          try {
            map.setPaintProperty(layer.id, 'text-color', GT6_PAL.labelDim);
            map.setPaintProperty(layer.id, 'text-halo-color', GT6_PAL.space);
            map.setPaintProperty(layer.id, 'text-halo-width', 1);
          } catch { /* noop */ }
        }
      } catch { /* noop */ }
    });
  } catch { /* noop */ }
}

// ── GT6 — Fictional Paris/Montmartre lives (prototype-only) ────────────────
// Public addresses only, no real broadcaster data.
const GT6_PARIS_MOCKS = [
  {
    id: 'gt6-montmartre-bistro',
    name: 'Chef Camille',
    subcategory: 'Bistro cuisine',
    experienceTitle: 'Service du soir, Montmartre',
    city: 'Paris',
    country: 'France',
    viewers: '1,284',
    status: 'live',
    family: 'earth',
    familyColor: '#28D8DF',
    coordinates: [2.3390, 48.8847],
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=70&auto=format&fit=crop',
  },
  {
    id: 'gt6-lapin-agile',
    name: 'Marie-Rose',
    subcategory: 'Cabaret cuisine',
    experienceTitle: 'Menu nostalgie, rue Saint-Vincent',
    city: 'Paris',
    country: 'France',
    viewers: '512',
    status: 'live',
    family: 'earth',
    familyColor: '#B47BFF',
    coordinates: [2.3413, 48.8884],
    image: 'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?w=400&q=70&auto=format&fit=crop',
  },
  {
    id: 'gt6-abbesses-table',
    name: 'Lucien Petit',
    subcategory: 'Neo-bistro',
    experienceTitle: 'Dîner place des Abbesses',
    city: 'Paris',
    country: 'France',
    viewers: '740',
    status: 'live',
    family: 'earth',
    familyColor: '#28D8DF',
    coordinates: [2.3381, 48.8841],
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&q=70&auto=format&fit=crop',
  },
  {
    id: 'gt6-rue-lepic',
    name: 'Bruno D.',
    subcategory: 'Wine & tapas',
    experienceTitle: 'Comptoir rue Lepic',
    city: 'Paris',
    country: 'France',
    viewers: '218',
    status: 'live',
    family: 'earth',
    familyColor: '#28D8DF',
    coordinates: [2.3367, 48.8864],
    image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=400&q=70&auto=format&fit=crop',
  },
];

// GT6 pre-set camera positions for the Paris scenario.
const GT6_VIEWS = {
  earth:     { lat: 10,      lng: 14,      altitude: 2.8 },
  france:    { lat: 46.8,    lng: 2.5,     altitude: 0.75 },
  paris:     { lat: 48.8566, lng: 2.3522,  altitude: 0.18 },
  montmartre:{ lat: 48.8867, lng: 2.3433,  altitude: 0.04 },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function GlobeTest6() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const globeRef = useRef();
  const containerRef = useRef();
  const starsCanvasRef = useRef(null);
  const pauseStarsRef = useRef(false);
  const animFrameRef = useRef();
  const composerRef = useRef(null);
  const userInteractedRef = useRef(false);
  const ignoredRequestedLiveRef = useRef(null);
  const navigatedToLiveRef = useRef(null);
  const handleClickRef = useRef(null);
  const altitudeRef = useRef(2.8);
  const clusterPrecisionRef = useRef(20);
  const requestedLiveId = searchParams.get('live');
  const [povSettled, setPovSettled] = useState(!requestedLiveId);
  const [globeReady, setGlobeReady] = useState(false);
  const [isClosingSelection, setIsClosingSelection] = useState(false);

  const [diagVisible, setDiagVisible] = useState(true);
  const [fpsState, setFpsState] = useState({ fps: 0, zoom: 0, altitude: 2.8, state: 'idle' });
  const fpsBufRef = useRef([]);
  const fpsLastSampleRef = useRef(0);

  // GT6 — Two-engine hybrid. 'globe' = react-globe.gl (Three.js), 'map' = MapLibre.
  // Phase 2: engine switch is manual (Force buttons in diag); Phase 3 will wire
  // altitude-based hysteresis. The MapLibre instance is lazy-created the first
  // time engineMode !== 'globe' to avoid paying the WebGL cost up-front.
  const [engineMode, setEngineMode] = useState('globe');
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const { user } = useAuth();
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);
  const [createdLives, setCreatedLives] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [remindedIds, setRemindedIds] = useState(new Set());
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const lastClickTimeRef = useRef(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [sheetState, setSheetState] = useState('closed');
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [clusterPrecision, setClusterPrecision] = useState(20);

  // ── Data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);
  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (user?.uid) getRemindedStreamIds(user.uid).then((ids) => setRemindedIds(new Set(ids))).catch(() => {});
  }, [user?.uid]);

  const toggleRemind = async (stream) => {
    if (!user?.uid) return;
    const isReminded = remindedIds.has(stream.id);
    setRemindedIds((prev) => {
      const next = new Set(prev);
      isReminded ? next.delete(stream.id) : next.add(stream.id);
      return next;
    });
    if (!isReminded) {
      await createNotification(user.uid, {
        type: 'remind_me',
        streamId: stream.id,
        streamTitle: stream.experienceTitle || stream.name,
        startsAt: stream.startsAt,
      }).catch(() => {});
    }
  };

  const enrichedMapStreams = useMemo(
    () => mapStreams.map(enrichExperience),
    [],
  );

  // GT6: Paris/Montmartre scenario mocks are concatenated so the camera presets
  // have meaningful markers to show when zooming into Paris.
  const enrichedParisMocks = useMemo(() => GT6_PARIS_MOCKS.map(enrichExperience), []);

  const enrichedStreams = useMemo(
    () => [...createdLives.map(enrichExperience), ...enrichedParisMocks, ...enrichedMapStreams],
    [createdLives, enrichedParisMocks, enrichedMapStreams],
  );

  const allLiveStreams = useMemo(
    () => enrichedStreams.filter((s) => activeStatuses.includes(s.status) && Array.isArray(s.coordinates)),
    [enrichedStreams, activeStatuses],
  );

  const liveStreams = useMemo(() => {
    const filtered = allLiveStreams.filter((s) => {
      if (activeFamily !== 'all' && s.family !== activeFamily) return false;
      if (activeActivities.length === 0) return true;
      return activeActivities.some((activityId) => {
        const activity = ACTIVITY_CATEGORIES.find((a) => a.id === activityId);
        return activity?.subcategories.includes(s.subcategory);
      });
    });
    const result = buildClusteredStreams(filtered, expandedClusterId, clusterPrecision);
    if (expandedClusterId) {
      const stillExists = result.some((s) => s.type === 'cluster' && s.clusterId === expandedClusterId);
      if (!stillExists) setExpandedClusterId(null);
    }
    return result;
  }, [allLiveStreams, activeFamily, activeActivities, expandedClusterId, clusterPrecision]);

  // htmlElementsData stays stable across selection changes — we hide non-selected
  // markers via CSS (.gt2-space-globe.has-selected .gt2-marker:not(.is-selected))
  // instead of filtering the array. Prevents CSS2DRenderer from rebuilding 150+
  // DOM nodes mid-animation on deselect (which caused dezoom lag).
  const displayedStreams = liveStreams;

  const streamCounts = useMemo(() => {
    const byFamily = { all: 0, air: 0, earth: 0, water: 0 };
    const byActivity = {};
    enrichedStreams.forEach((s) => {
      if (s.status !== 'live') return;
      byFamily.all += 1;
      if (s.family) byFamily[s.family] = (byFamily[s.family] ?? 0) + 1;
      ACTIVITY_CATEGORIES.forEach((a) => {
        if (a.subcategories.includes(s.subcategory)) {
          byActivity[a.id] = (byActivity[a.id] ?? 0) + 1;
        }
      });
    });
    return { total: byFamily.all, byFamily, byActivity };
  }, [enrichedStreams]);

  const selectFamily = (next) => {
    setActiveFamily(next);
    setExpandedClusterId(null);
    if (next !== 'all') setActiveActivities([]);
  };

  // ── Globe setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const searchParamsAtMount = new URLSearchParams(window.location.search);
    const sharpenParam = searchParamsAtMount.get('sharpen');
    const shouldSharpen = sharpenParam === '1' || (ENABLE_GLOBE_SHARPENING && sharpenParam !== '0');

    const requestedLiveIdAtMount = searchParamsAtMount.get('live');

    const timer = setTimeout(() => {
      const globe = globeRef.current;
      if (!globe) return;

      const controls = globe.controls?.();
      if (controls) {
        controls.autoRotate = !requestedLiveIdAtMount;
        controls.autoRotateSpeed = 0.4;
        controls.enableZoom = true;
        // GT6 — on descend bien plus bas que GT2 (minDistance 150 → alt ≈ 0.5)
        // pour atteindre l'échelle rue (Montmartre preset = alt 0.04 → dist 104).
        controls.minDistance = 102;
        controls.maxDistance = 800;
        // Molette/pinch plus progressif en bas (1 cran = -2 % de distance au
        // lieu des -5 % par défaut) pour ne pas coller au sol en un seul clic.
        controls.zoomSpeed = 0.7;
        // GT6 — première interaction user (zoom/pan/rotate) coupe le spin
        // définitivement. react-globe.gl ne le fait pas pour le zoom molette.
        controls.addEventListener('start', () => {
          userInteractedRef.current = true;
          controls.autoRotate = false;
        });
      }

      if (!requestedLiveIdAtMount) {
        globe.pointOfView({ lat: 10, lng: 14, altitude: 2.8 }, 0);
      }

      const renderer = globe.renderer?.();
      if (renderer) {
        const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
        const maxDpr = isCoarse ? 1.5 : 2;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      }

      // ── Fix texture filtering on all globe meshes ──────────────────────────
      // Runs immediately — textures are already loaded by the time this
      // 300ms timer fires; we also set a 1200ms fallback for slow networks.
      const applyTextureQuality = () => {
        const scene2 = globe.scene?.();
        const rend = globe.renderer?.();
        if (!scene2 || !rend) return;
        const maxAniso = rend.capabilities.getMaxAnisotropy();
        scene2.traverse((obj) => {
          if (!obj.isMesh || !obj.material?.map) return;
          const map = obj.material.map;
          // Trilinear filtering — sharpest standard mipmap mode
          map.minFilter = THREE.LinearMipmapLinearFilter;
          map.magFilter = THREE.LinearFilter;
          // Max anisotropy — reduces blur on oblique angles
          map.anisotropy = maxAniso;
          // Correct color space for Three.js r152+ (0.152+)
          map.colorSpace = THREE.SRGBColorSpace;
          map.generateMipmaps = true;
          map.needsUpdate = true;
        });
      };

      applyTextureQuality();
      const fallbackTimer = setTimeout(applyTextureQuality, 1200);


      // ── Custom lights ──────────────────────────────────────────────────────
      const scene = globe.scene?.();
      if (scene) {
        const ambient = new THREE.AmbientLight(0xaac8ff, 9.0);
        ambient.name = 'gt2-ambient';
        const dir = new THREE.DirectionalLight(0x6688bb, 4.0);
        dir.name = 'gt2-dir';
        dir.position.set(1, 0.5, 1);
        scene.add(ambient);
        scene.add(dir);
      }

      // ── Post-process sharpening (EffectComposer + UnsharpMask) ────────────
      if (shouldSharpen && renderer && scene) {
        const camera = globe.camera?.();
        if (camera) {
          // Force linear output so intermediate targets don't get gamma-encoded.
          // GammaCorrectionShader at the end re-applies gamma only once.
          renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

          const composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));

          const sharpPass = new ShaderPass(UnsharpMaskShader);
          sharpPass.uniforms.resolution.value.set(
            renderer.domElement.width,
            renderer.domElement.height,
          );
          sharpPass.uniforms.strength.value = SHARPEN_STRENGTH;
          composer.addPass(sharpPass);

          // Final pass: apply gamma once to the screen output
          composer.addPass(new ShaderPass(GammaCorrectionShader));

          composerRef.current = composer;

          // Override renderer.render so react-globe.gl's internal RAF uses
          // the composer instead of issuing a bare render call.
          // Guard flag prevents the composer's own RenderPass from re-entering
          // this override and causing infinite recursion.
          const originalRender = renderer.render.bind(renderer);
          let isComposing = false;
          renderer.render = (renderScene, renderCamera) => {
            if (composerRef.current && !isComposing) {
              isComposing = true;
              composerRef.current.render();
              isComposing = false;
            } else {
              originalRender(renderScene, renderCamera);
            }
          };
        }
      }

      return () => clearTimeout(fallbackTimer);
    }, 300);

    // ── Resize: keep composer resolution in sync ───────────────────────────
    const ro = new ResizeObserver(() => {
      const rend = globeRef.current?.renderer?.();
      if (!rend || !composerRef.current) return;
      composerRef.current.setSize(rend.domElement.width, rend.domElement.height);
      const sp = composerRef.current.passes.find((p) => p.uniforms?.resolution);
      if (sp) {
        sp.uniforms.resolution.value.set(
          rend.domElement.width,
          rend.domElement.height,
        );
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = !userInteractedRef.current && !selectedStream && !selectedCluster && !expandedClusterId;
  }, [selectedStream, selectedCluster, expandedClusterId]);


  useEffect(() => {
    if (!requestedLiveId) return;
    if (ignoredRequestedLiveRef.current === requestedLiveId) return;
    const target = allLiveStreams.find((s) => s.id === requestedLiveId);
    if (!target) return;
    if (activeFamily !== 'all') setActiveFamily('all');
    if (activeActivities.length) setActiveActivities([]);
    const [lng, lat] = target.coordinates;
    const p = clusterPrecisionRef.current;
    const targetClusterId = `${Math.round(lat / p)}:${Math.round(lng / p)}`;
    if (expandedClusterId !== targetClusterId) setExpandedClusterId(targetClusterId);
  }, [activeActivities.length, activeFamily, allLiveStreams, expandedClusterId, requestedLiveId]);

  useEffect(() => {
    if (!globeReady) return;
    if (!requestedLiveId) return;
    if (ignoredRequestedLiveRef.current === requestedLiveId) return;
    if (navigatedToLiveRef.current === requestedLiveId) return;
    const target = liveStreams.find((s) => s.type !== 'cluster' && s.id === requestedLiveId)
      || allLiveStreams.find((s) => s.id === requestedLiveId);
    if (!target) return;
    const coords = target.displayCoordinates || target.coordinates;
    if (!Array.isArray(coords)) return;

    const globe = globeRef.current;
    if (!globe) return;
    navigatedToLiveRef.current = requestedLiveId;
    const controls = globe.controls?.();
    if (controls) controls.autoRotate = false;
    // Snap to target at a far altitude, instant (hidden under opacity 0).
    globe.pointOfView({ lat: coords[1], lng: coords[0], altitude: 2.8 }, 0);
    // Reveal the globe on the next frame once the snap has been applied.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPovSettled(true));
    });
    // After a pause so user sees the full globe, animate a slow zoom in
    // (altitude only — no pan). Defer setSelectedStream until the end so
    // ringsData/markers don't disturb the camera tween.
    setTimeout(() => {
      const g = globeRef.current;
      if (!g) return;
      g.pointOfView({ lat: coords[1], lng: coords[0], altitude: 0.55 }, 900);
    }, 350);
    setTimeout(() => setSelectedStream(target), 1300);
  }, [globeReady, allLiveStreams, liveStreams, requestedLiveId]);

  useEffect(() => {
    if (!requestedLiveId) {
      ignoredRequestedLiveRef.current = null;
      navigatedToLiveRef.current = null;
    }
  }, [requestedLiveId]);

  // ── Click handler ───────────────────────────────────────────────────────────
  const handleObjectClick = useCallback((obj) => {
    const now = Date.now();
    const isDouble = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;

    // Brief tap feedback: expanding ring on the clicked marker
    const tappedEl = document.querySelector(`.gt2-marker[data-stream-id="${obj.id}"]`);
    if (tappedEl) {
      tappedEl.classList.remove('is-tapped');
      void tappedEl.offsetWidth;
      tappedEl.classList.add('is-tapped');
      setTimeout(() => tappedEl.classList.remove('is-tapped'), 450);
    }

    if (obj.type === 'cluster') {
      userInteractedRef.current = true;
      setSelectedStream(null);
      setSelectedCluster(obj);
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = false;
      const coords = obj.displayCoordinates || obj.coordinates;
      // Single click = aperçu de la zone ; double click = dive niveau rue
      // (dévoile les markers individuels car le clusterPrecision descend).
      const clusterAlt = isDouble ? 0.08 : 0.4;
      globeRef.current?.pointOfView(
        { lat: coords[1] - (isDouble ? 0 : 5), lng: coords[0], altitude: clusterAlt },
        isDouble ? 900 : 500,
      );
      return;
    }

    userInteractedRef.current = true;
    setSelectedCluster(null);
    setSelectedStream(obj);
    const currentAlt = globeRef.current?.pointOfView?.()?.altitude ?? 2.3;
    // Single click = focus Paris-level (0.18). Double click = street-level
    // (0.05), ce qui tombe dans la fenêtre d'opacité max de l'overlay tiles.
    const altitude = isDouble ? 0.05 : Math.min(0.18, currentAlt);
    const coords = obj.displayCoordinates || obj.coordinates;
    globeRef.current?.pointOfView({ lat: coords[1], lng: coords[0], altitude }, isDouble ? 900 : 700);
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = false;
  }, []);

  handleClickRef.current = handleObjectClick;

  useEffect(() => {
    document.querySelectorAll('.gt2-marker.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (!selectedStream?.id) return;
    const apply = () => {
      const el = document.querySelector(`.gt2-marker[data-stream-id="${selectedStream.id}"]`);
      if (el) el.classList.add('is-selected');
    };
    apply();
    const t = setTimeout(apply, 400);
    return () => clearTimeout(t);
  }, [selectedStream]);

  // ── HTML marker builder ─────────────────────────────────────────────────────
  const htmlElement = useCallback((d) => {
    const el = document.createElement('div');
    el.dataset.streamId = d.id;

    const markerColor = d.familyColor || '#28d8df';
    el.style.setProperty('--marker-color', markerColor);

    if (d.type === 'cluster') {
      el.className = 'gt2-marker gt2-marker--cluster';
      el.innerHTML = `
        <div class="gt2-marker__bubble">
          <span class="gt2-marker__count">${d.count}</span>
          <span class="gt2-marker__live-label">LIVE</span>
        </div>
        <div class="gt2-marker__stem"></div>
        <div class="gt2-marker__dot"></div>
      `;
    } else {
      const imgSrc = d.image || '';
      el.className = 'gt2-marker gt2-marker--avatar';
      el.innerHTML = imgSrc
        ? `<div class="gt2-marker__bubble"><img src="${imgSrc}" alt="" loading="lazy" /></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`
        : `<div class="gt2-marker__bubble"><span class="gt2-marker__initial">${(d.name || '?')[0].toUpperCase()}</span></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`;
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleClickRef.current?.(d);
    });

    return el;
  }, []);

  // ── RAF — stars + altitude-based precision ──────────────────────────────────
  // Precision changes rebuild clusters + all CSS2DRenderer DOM markers, which
  // stutters mid-zoom. Defer the state update until altitude has been stable
  // (>180ms with no change) so it only fires once the animation settles.
  useEffect(() => {
    let pendingPrecision = clusterPrecisionRef.current;
    let stableSince = performance.now();
    let lastAlt = altitudeRef.current;

    const animate = (now) => {
      const altitude = globeRef.current?.pointOfView?.()?.altitude ?? 2.3;
      altitudeRef.current = altitude;

      if (Math.abs(altitude - lastAlt) > 0.002) {
        lastAlt = altitude;
        stableSince = now;
      }

      const target = getClusterPrecision(altitude);
      if (target !== pendingPrecision) pendingPrecision = target;

      if (
        pendingPrecision !== clusterPrecisionRef.current &&
        now - stableSince > 180
      ) {
        clusterPrecisionRef.current = pendingPrecision;
        setClusterPrecision(pendingPrecision);
      }

      // Skip the heavy canvas-2D starfield while a close tween is running —
      // drawing ~180 arcs every frame competes with the camera animation.
      if (!pauseStarsRef.current) {
        const starsCanvas = starsCanvasRef.current;
        if (starsCanvas) {
          const ctx = starsCanvas.getContext('2d');
          drawStars(starsCanvas, ctx, now, altitude);
        }
      }

      // GT6 FPS sampler: push frame timestamps into a 60-entry ring buffer and
      // flush to React state every 500ms (keep main-thread work out of RAF).
      const buf = fpsBufRef.current;
      buf.push(now);
      while (buf.length > 60) buf.shift();
      if (now - fpsLastSampleRef.current > 500 && buf.length > 1) {
        fpsLastSampleRef.current = now;
        const span = buf[buf.length - 1] - buf[0];
        const fps = span > 0 ? Math.round(((buf.length - 1) * 1000) / span) : 0;
        setFpsState((prev) => ({
          ...prev,
          fps,
          altitude: Number(altitude.toFixed(3)),
          zoom: Math.round(Math.max(0, Math.min(16, 10 - Math.log2(Math.max(0.03, altitude)) * 2))),
        }));
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ── Resize ──────────────────────────────────────────────────────────────────
  // Measure synchronously before paint to avoid a tiny-globe flash on first render.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const applySize = (width, height) => {
      if (!width || !height) return;
      setDims({ w: width, h: height });
      const canvas = starsCanvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    const rect = el.getBoundingClientRect();
    applySize(rect.width, rect.height);
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      applySize(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomBy = (factor) => {
    const pov = globeRef.current?.pointOfView();
    if (!pov) return;
    globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.04, Math.min(5, pov.altitude * factor)) }, 400);
  };

  const recenter = () => {
    userInteractedRef.current = false;
    pauseStarsRef.current = true;
    // Shorter tween for a snappier dismiss.
    globeRef.current?.pointOfView({ lat: 10, lng: 14, altitude: 2.8 }, 500);
    // Hide ring + fade card instantly (ring is three.js material — animated
    // propagation competes with the camera tween on the GPU).
    setIsClosingSelection(true);
    setTimeout(() => {
      setSelectedStream(null);
      setSelectedCluster(null);
      setExpandedClusterId(null);
      setIsClosingSelection(false);
      pauseStarsRef.current = false;
      if (requestedLiveId) {
        ignoredRequestedLiveRef.current = requestedLiveId;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('live');
        setSearchParams(nextParams, { replace: true });
      }
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = true;
    }, 520);
  };

  const watchPath = (s) => `/watch?live=${encodeURIComponent(s.id)}`;

  // ── MapLibre — lazy init + palette repaint ─────────────────────────────────
  // The MapLibre instance stays null until the user switches engine to 'map'
  // (or future hysteresis triggers the handoff). Once created it persists in
  // the DOM but we flip pointer-events + visibility to hide it when 'globe' is
  // active. Mobile keeps both WebGL contexts alive only when strictly needed.
  useEffect(() => {
    if (engineMode !== 'map') return;
    if (mapRef.current) return;
    const container = mapContainerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: GT6_MAP_STYLE_URL,
      center: [2.3522, 48.8566],
      zoom: 11,
      attributionControl: false,
      pitchWithRotate: false,
      // Disable MapLibre native globe projection: we stay flat (mercator) because
      // the handoff from the Three.js globe is handled by our own crossfade.
      projection: 'mercator',
    });

    map.on('load', () => {
      brightenGT6BaseMap(map);
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      // Unmount removes the DOM, we tear down the map to free the GL context.
      try { map.remove(); } catch { /* noop */ }
      mapRef.current = null;
      setMapReady(false);
    };
  }, [engineMode]);

  // Resize MapLibre when the container dims change (once created).
  useEffect(() => {
    if (!mapRef.current) return;
    try { mapRef.current.resize(); } catch { /* noop */ }
  }, [dims.w, dims.h, engineMode]);

  return (
    <div
      ref={containerRef}
      className={`gt2-space-globe${selectedStream ? ' has-selected' : ''}`}
      style={{ position: 'relative', width: '100%', background: '#000011', overflow: 'hidden' }}
    >
      <canvas ref={starsCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

      {/* MapLibre layer — stacked above the Three.js globe; hidden until engineMode === 'map'. */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: engineMode === 'map' ? 2 : 0,
          opacity: engineMode === 'map' && mapReady ? 1 : 0,
          transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: engineMode === 'map' ? 'auto' : 'none',
        }}
      />

      {/* Top status bar */}
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

      <div
        className="gt2-globe-offset"
        style={{
          opacity: povSettled ? 1 : 0,
          transition: 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
      {dims.w > 0 && dims.h > 0 && (
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        animateIn={false}
        onGlobeReady={() => setGlobeReady(true)}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl='/assets/globe/earth-night-threeglobe-4k.jpg'
        showAtmosphere={true}
        atmosphereColor="rgba(40,216,223,0.15)"
        atmosphereAltitude={0.09}
        showGraticules={false}
        htmlElementsData={isClosingSelection ? [] : displayedStreams}
        htmlElement={htmlElement}
        htmlAltitude={0.01}
        htmlLat={(d) => (d.displayCoordinates || d.coordinates)[1]}
        htmlLng={(d) => (d.displayCoordinates || d.coordinates)[0]}
        ringsData={selectedStream && !isClosingSelection ? [selectedStream] : []}
        ringColor={() => 'rgba(40,216,223,0.55)'}
        ringMaxRadius={1.5}
        ringPropagationSpeed={0.8}
        ringRepeatPeriod={2200}
        ringAltitude={0.01}
        ringLat={(d) => (d.displayCoordinates || d.coordinates)[1]}
        ringLng={(d) => (d.displayCoordinates || d.coordinates)[0]}
        rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
      />
      )}
      </div>

      {/* Filters — compact pill when closed, full sheet when open */}
      {!selectedStream && !selectedCluster && sheetState === 'closed' && (
        <button
          type="button"
          className="gt2-filter-pill"
          onClick={() => setSheetState('half')}
        >
          <SlidersHorizontal size={13} strokeWidth={2} />
          <span>Filters</span>
          <ChevronUp size={14} strokeWidth={2} />
        </button>
      )}
      {!selectedStream && !selectedCluster && sheetState !== 'closed' && (
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

      {/* Controls */}
      <div className="test-old-globe__controls">
        <button type="button" onClick={() => zoomBy(0.7)} aria-label="Zoom in"><Plus size={19} /></button>
        <button type="button" onClick={() => zoomBy(1.43)} aria-label="Zoom out"><Minus size={19} /></button>
        <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
      </div>

      {/* Selected stream card */}
      {selectedStream && selectedStream.type !== 'cluster' && (
        <aside
          className={`test-globe-card${isClosingSelection ? ' is-closing' : ''}`}
          style={{ zIndex: 20 }}
        >
          <button type="button" className="test-globe-card__close" onClick={recenter}>
            <X size={14} strokeWidth={2} />
          </button>
          <img src={selectedStream.image} alt="" loading="lazy" />
          <div className="test-globe-card__body">
            <div className="test-globe-card__info">
              <span className="test-globe-card__tag" style={{ '--experience-color': selectedStream.familyColor }}>
                <i />{selectedStream.subcategory}
              </span>
              <h2>{selectedStream.experienceTitle || selectedStream.name}</h2>
              <p>{selectedStream.name} · {selectedStream.city}, {selectedStream.country}</p>
              {selectedStream.status === 'upcoming' ? (() => {
                const cd = getCountdownState(selectedStream.startsAt, now, cLabels);
                return (
                  <div className="gt2-card__countdown">
                    <span className="gt2-card__countdown-label">{cd.label}</span>
                    {cd.value && <strong className="gt2-card__countdown-value">{cd.value}</strong>}
                  </div>
                );
              })() : <strong>{selectedStream.viewers} viewers</strong>}
            </div>
            <div className="test-globe-card__actions">
              {selectedStream.status === 'upcoming' ? (
                <button
                  type="button"
                  className={`gt2-card__remind-btn${remindedIds.has(selectedStream.id) ? ' is-active' : ''}`}
                  onClick={() => toggleRemind(selectedStream)}
                >
                  {remindedIds.has(selectedStream.id)
                    ? <><BellOff size={13} strokeWidth={2} />Rappel activé</>
                    : <><Bell size={13} strokeWidth={2} />Me notifier</>}
                </button>
              ) : (
                <button type="button" className="test-globe-card__watch" onClick={() => navigate(watchPath(selectedStream))}>
                  <Play size={13} fill="currentColor" strokeWidth={1.8} />Watch
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Cluster sheet */}
      {selectedCluster && (
        <div className={`gt2-cluster-sheet${isClosingSelection ? ' is-closing' : ''}`}>
          <div className="gt2-cluster-sheet__handle" />
          <div className="gt2-cluster-sheet__header">
            <span className="gt2-cluster-sheet__title">
              {selectedCluster.count} live{selectedCluster.count > 1 ? 's' : ''}{selectedCluster.streams[0]?.city ? ` in ${selectedCluster.streams[0].city}` : ' nearby'}
            </span>
            <button
              type="button"
              className="gt2-cluster-sheet__close"
              onClick={() => recenter()}
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
                        : ` · ${s.viewers?.toLocaleString()} viewers`}
                    </span>
                  </button>
                  {s.status === 'upcoming' ? (
                    <span className="gt2-cluster-sheet__item-soon">À venir</span>
                  ) : (
                    <button
                      type="button"
                      className="gt2-cluster-sheet__item-watch"
                      onClick={() => { setSelectedCluster(null); navigate(watchPath(s)); }}
                    >Watch</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GT6 diagnostic panel ─────────────────────────────────────────── */}
      {diagVisible ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 50,
            background: 'rgba(5, 8, 22, 0.88)',
            border: '1px solid rgba(40, 216, 223, 0.35)',
            borderRadius: 10,
            padding: '10px 12px',
            color: '#d8e6f2',
            font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
            minWidth: 220,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong style={{ color: '#28d8df', letterSpacing: 0.4, fontSize: 10, textTransform: 'uppercase' }}>
              Globe Test 6 — Diag
            </strong>
            <button
              type="button"
              onClick={() => setDiagVisible(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(216, 230, 242, 0.25)',
                color: '#d8e6f2',
                borderRadius: 6,
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: 10,
              }}
            >
              <EyeOff size={11} strokeWidth={2} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 10 }}>
            <span style={{ color: '#8ea3ba' }}>Engine</span>
            <span style={{
              color: engineMode === 'map' ? '#B47BFF' : '#28d8df',
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontWeight: 600,
            }}>{engineMode === 'map' ? 'MapLibre' : 'Three.js'}</span>
            <span style={{ color: '#8ea3ba' }}>FPS</span>
            <span style={{
              color: fpsState.fps >= 50 ? '#36d9a0' : fpsState.fps >= 30 ? '#f5c66b' : '#ff5d6c',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>{fpsState.fps}</span>
            <span style={{ color: '#8ea3ba' }}>Alt</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fpsState.altitude}</span>
            <span style={{ color: '#8ea3ba' }}>Zoom≈</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fpsState.zoom}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setEngineMode('globe')}
              style={{
                padding: '5px 6px',
                background: engineMode === 'globe' ? 'rgba(40,216,223,0.18)' : 'rgba(216,230,242,0.06)',
                border: `1px solid ${engineMode === 'globe' ? '#28d8df' : 'rgba(216,230,242,0.18)'}`,
                color: engineMode === 'globe' ? '#28d8df' : '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Force Three
            </button>
            <button
              type="button"
              onClick={() => setEngineMode('map')}
              style={{
                padding: '5px 6px',
                background: engineMode === 'map' ? 'rgba(180,123,255,0.22)' : 'rgba(216,230,242,0.06)',
                border: `1px solid ${engineMode === 'map' ? '#B47BFF' : 'rgba(216,230,242,0.18)'}`,
                color: engineMode === 'map' ? '#B47BFF' : '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Force Map
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={() => globeRef.current?.pointOfView(GT6_VIEWS.earth, 1200)}
              style={{
                padding: '5px 6px',
                background: 'rgba(216,230,242,0.06)',
                border: '1px solid rgba(216,230,242,0.18)',
                color: '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={10} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Reset
            </button>
            <button
              type="button"
              onClick={() => globeRef.current?.pointOfView(GT6_VIEWS.france, 1400)}
              style={{
                padding: '5px 6px',
                background: 'rgba(216,230,242,0.06)',
                border: '1px solid rgba(216,230,242,0.18)',
                color: '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              France
            </button>
            <button
              type="button"
              onClick={() => globeRef.current?.pointOfView(GT6_VIEWS.paris, 1400)}
              style={{
                padding: '5px 6px',
                background: 'rgba(216,230,242,0.06)',
                border: '1px solid rgba(216,230,242,0.18)',
                color: '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <MapPin size={10} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Paris
            </button>
            <button
              type="button"
              onClick={() => globeRef.current?.pointOfView(GT6_VIEWS.montmartre, 1600)}
              style={{
                padding: '5px 6px',
                background: 'rgba(216,230,242,0.06)',
                border: '1px solid rgba(216,230,242,0.18)',
                color: '#d8e6f2',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              <MapPin size={10} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Montmartre
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDiagVisible(true)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 50,
            background: 'rgba(5, 8, 22, 0.85)',
            border: '1px solid rgba(40, 216, 223, 0.35)',
            color: '#28d8df',
            borderRadius: 999,
            padding: '6px 10px',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Eye size={11} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Diag
        </button>
      )}

    </div>
  );
}
