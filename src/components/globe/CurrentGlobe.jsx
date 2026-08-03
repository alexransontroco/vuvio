import { Bell, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { MARKER_TYPES, decorateGlobeTest3Streams, isRelevantOutsideFilter, shouldFeatureEditorially } from '../../data/globeTest3Data.js';
import { analyticsService } from '../../services/analytics/analyticsService.ts';
import MapBottomSheet from '../map/MapBottomSheet.jsx';
import { ISSLiveCard } from './ISSLiveCard.jsx';
import '../../styles/components/iss-globe.css';

const INITIAL_CENTER = [14, 20];
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const STYLE_URL_GREEN = 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json';
const LIVE_COLOR = '#ff0066';
const UPCOMING_COLOR = '#0099ff';
const ROTATE_DEGREES_PER_SECOND = 1.8;
const ACTUAL_ROTATION_INTERVAL = 24;
const SELECTED_LIVE_ZOOM = 4.05;
const REQUESTED_LIVE_ZOOM = 4.2;
const PING_COLOR = '#ff8a1f';
const PING_TTL_MS = 12000;
const PULSE_INTERVAL = 160;

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
    ['+', 0.90, ['*', wave, 0.05]],
    ['+', 0.82, ['*', wave, 0.10]],
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
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.0, 300, 5.0, 800, 10.0, 1500, 16.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 1.5, 1500, 1.9]]],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.2, 300, 5.5, 800, 11.0, 1500, 17.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.1, 800, 1.6, 1500, 2.0]]],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.8, 300, 4.5, 800, 9.0, 1500, 15.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.9, 800, 1.4, 1500, 1.8]]],
    ],
    [
      'case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.5, 300, 3.5, 800, 7.0, 1500, 12.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.7, 800, 1.0, 1500, 1.3]]],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.7, 300, 4.0, 800, 8.0, 1500, 13.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.76, 800, 1.1, 1500, 1.4]]],
      ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.3, 300, 3.0, 800, 6.0, 1500, 11.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.6, 800, 0.9, 1500, 1.2]]],
    ],
  ];
}

function liveColorGlowRadius(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 6.5, 300, 8.5, 800, 12.0, 1500, 16.0],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 7.0, 300, 9.0, 800, 13.0, 1500, 18.0],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 6.0, 300, 8.0, 800, 11.0, 1500, 15.0],
    ],
    ['*', wave, ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.0, 800, 4.5, 1500, 7.0],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.5, 800, 5.0, 1500, 8.0],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.0, 800, 4.5, 1500, 7.0],
    ]],
  ];
}

function liveColorGlowOpacity(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.08, 300, 0.11, 800, 0.16, 1500, 0.20],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.09, 300, 0.12, 800, 0.18, 1500, 0.22],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.07, 300, 0.10, 800, 0.15, 1500, 0.19],
    ],
    ['*', wave, ['case',
      ['==', ['get', 'markerType'], MARKER_TYPES.sponsored],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.03, 800, 0.07, 1500, 0.09],
      ['==', ['get', 'markerType'], MARKER_TYPES.vuvio],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.04, 800, 0.08, 1500, 0.10],
      ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.03, 800, 0.07, 1500, 0.09],
    ]],
  ];
}

function liveCrowdHaloRadius(clock) {
  const wave = breathingWave((clock * 1.35) % 1);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 7, 1500, 10],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 4.5, 1500, 8.5]],
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
  return ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 8, 800, 11, 1500, 14], ['*', wave, 19]];
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
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.7, 300, 3.2, 800, 4.0, 1500, 4.5], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.6, 800, 4.1, 1500, 5.2]]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.0, 300, 2.4, 800, 3.2, 1500, 3.6], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.0, 800, 3.4, 1500, 4.4]]],
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

function drawAtmosphericHalo(canvas, ctx, rotation) {
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.38;

  ctx.clearRect(0, 0, w, h);

  const starCount = Math.max(40, Math.floor((w * h) / 42000));
  for (let i = 0; i < starCount; i += 1) {
    const seed = i * 97.37;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin((seed + 19.19) * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * w;
    const py = Math.abs(y) * h;
    const distanceFromGlobe = Math.hypot(px - cx, py - cy);

    if (distanceFromGlobe < baseRadius * 1.08) continue;

    const twinkle = 0.45 + Math.sin(rotation * 0.075 + seed) * 0.28;
    const size = 0.3 + Math.abs(Math.sin(seed * 0.17)) * 0.5;
    const opacity = Math.max(0.12, Math.min(0.88, twinkle));

    ctx.fillStyle = `rgba(230, 244, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);

  const grad1 = ctx.createRadialGradient(0, -baseRadius * 0.12, baseRadius * 0.18, 0, -baseRadius * 0.12, baseRadius * 1.15);
  grad1.addColorStop(0, 'rgba(80, 170, 230, 0.08)');
  grad1.addColorStop(1, 'rgba(80, 140, 200, 0)');
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.arc(0, -baseRadius * 0.12, baseRadius * 1.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  const haze = ctx.createRadialGradient(cx, cy * 0.78, baseRadius * 0.48, cx, cy * 0.78, baseRadius * 1.6);
  haze.addColorStop(0, 'rgba(70, 150, 200, 0.02)');
  haze.addColorStop(1, 'rgba(60, 140, 180, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  const dustCount = Math.max(2, Math.floor((w * h) / 480000));
  ctx.globalAlpha = 0.015;
  for (let i = 0; i < dustCount; i++) {
    const seed = i * 13.7;
    const x = (cx + Math.cos(rotation * 0.012 + seed) * w * 0.32) % w;
    const y = (cy + Math.sin(rotation * 0.009 + seed) * h * 0.32) % h;
    const size = 0.3 + Math.sin(rotation * 0.006 + seed) * 0.15;
    ctx.fillStyle = `rgba(160, 210, 255, ${0.08 + Math.sin(seed) * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Thin elegant ring for selected marker — one refined subtle ring only
function liveRingRadius(clock, selectedId = '', hoveredId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 7.6, ['*', wave, 0.6]],
    ['==', ['get', 'id'], hoveredId],
    ['+', 6.2, ['*', wave, 0.4]],
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
    map.setFog?.({
      color: 'rgba(8, 15, 28, 0.78)',
      'high-color': 'rgba(20, 50, 90, 0.35)',
      'horizon-blend': 0.08,
      'space-color': '#0a0f1a',
      'star-intensity': 0.88,
    });

    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#0a0f1a');
      }
      if ((layer.type === 'fill' || layer.type === 'line' || layer.type === 'symbol') && (id.includes('water') || sourceLayer.includes('water'))) {
        if (layer.type === 'fill') {
          map.setPaintProperty(layer.id, 'fill-color', '#1155ff');
          map.setPaintProperty(layer.id, 'fill-opacity', 1);
        }
      }
      if (layer.type === 'fill' && (id.includes('land') || sourceLayer.includes('land'))) {
        map.setPaintProperty(layer.id, 'fill-color', '#ff9933');
        map.setPaintProperty(layer.id, 'fill-opacity', 1);
      }
      if (layer.type === 'line' && (id.includes('boundary') || id.includes('admin') || sourceLayer.includes('boundary'))) {
        map.setPaintProperty(layer.id, 'line-color', 'rgba(100, 160, 220, 0.35)');
        map.setPaintProperty(layer.id, 'line-opacity', 0.4);
      }
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
  const [pingRefreshTick, setPingRefreshTick] = useState(0);
  const [mapError, setMapError] = useState('');
  const [showISSCard, setShowISSCard] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Performance diagnostics
  const perfRef = useRef({
    rafCalls: 0,
    paintCalls: 0,
    jumpToCalls: 0,
    startTime: performance.now(),
    lastReportTime: performance.now(),
  });

  const enrichedStreams = useMemo(() => {
    if (variant === 'test3') return decorateGlobeTest3Streams(streams);
    return streams.map(enrichExperience);
  }, [streams, variant]);
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

  const liveStreams = useMemo(() => {
    if (variant !== 'test3') return standardStreams;

    const userContext = { interests: activeActivities };
    const sponsoredLives = statusLiveStreams
      .filter((stream) => stream.markerType === MARKER_TYPES.sponsored)
      .filter((stream) => matchesFilters(stream, activeFamily, activeActivities, activeStatuses) || isRelevantOutsideFilter(stream, userContext))
      .slice(0, MAX_SPONSORED_VISIBLE);
    const vuvioLives = statusLiveStreams
      .filter((stream) => stream.markerType === MARKER_TYPES.vuvio)
      .filter((stream) => matchesFilters(stream, activeFamily, activeActivities, activeStatuses) || shouldFeatureEditorially(stream, userContext))
      .slice(0, MAX_VUVIO_VISIBLE);

    const merged = new Map();
    [...standardStreams, ...sponsoredLives, ...vuvioLives].forEach((stream) => {
      merged.set(stream.id, stream);
    });
    return [...merged.values()];
  }, [activeActivities, activeFamily, activeStatuses, standardStreams, statusLiveStreams, variant]);

  const selectedLive = enrichedStreams.find((stream) => stream.id === selectedId) ?? null;
  const watchPathForLive = (live) => {
    const target = encodeURIComponent(live.id);
    return `/watch?live=${target}`;
  };

  useEffect(() => {
    if (!enrichedStreams.some((stream) => pingTimestamp(stream) > 0)) return undefined;
    const timer = window.setInterval(() => setPingRefreshTick((value) => value + 1), 1000);
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
    setSelectedId(null);
    if (nextFamily !== 'all') setActiveActivities([]);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: variant === 'test3' ? STYLE_URL_GREEN : STYLE_URL,
      center: INITIAL_CENTER,
      zoom: 1.35,
      minZoom: 0,
      maxZoom: 9,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.0),
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
    map.dragRotate.disable();
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

        if (searchParams.get('filter') === 'nearby' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 7.5, duration: 1400 });
            },
            () => {},
            { timeout: 5000 },
          );
        }

        const isMobile = window.innerHeight < 900;
        map.setPadding({ top: isMobile ? 40 : -30, bottom: isMobile ? 80 : 180, left: 0, right: 0 });

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
            'circle-blur': 1.2,
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
            'circle-blur': 1.0,
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
            'circle-blur': 1.02,
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

        // Luminous core for live markers
        map.addLayer({
          id: 'vuvio-test-live-points',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': markerColorExpression(),
            'circle-radius': livePointRadius(0, selectedId ?? ''),
            'circle-blur': 0.4,
            'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', 'rgba(242,247,246,0.34)'],
            'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 1.05, 0.55],
            'circle-opacity': ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.50, 0.35],
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
            'circle-stroke-width': 0.7,
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
          setHoveredId(feature?.properties?.id ?? '');
        });
        map.on('mouseleave', 'vuvio-test-live-hit', () => {
          map.getCanvas().style.cursor = '';
          setHoveredId('');
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
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('vuvio-test-lives');
    if (!source) return;
    source.setData(buildCollection(liveStreams));
  }, [liveStreams]);

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
        pitch: 0,
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
      perfRef.current.rafCalls++;
      if (time - lastPulseTime >= PULSE_INTERVAL) {
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
          perfRef.current.paintCalls++;
        } catch {
          // Style/layers can be unavailable during route transitions.
        }
      }

      if (document.visibilityState === 'hidden' || Date.now() <= pauseUntilRef.current || selectedId) {
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
          perfRef.current.jumpToCalls++;
          map.jumpTo({ center: [lastRotationLng, lastRotationLat] });
        }
      }

      // Render atmospheric halo
      const haloCanvas = haloCanvasRef.current;
      if (haloCanvas) {
        const ctx = haloCanvas.getContext('2d');
        drawAtmosphericHalo(haloCanvas, ctx, totalRotation);
      }

      // Track zoom for ISS visibility
      const zoom = map.getZoom();
      if (Math.abs(zoom - currentZoom) > 0.1) {
        setCurrentZoom(zoom);
      }

      // Report perf every 3 seconds
      if (time - perfRef.current.lastReportTime > 3000) {
        const elapsed = (time - perfRef.current.lastReportTime) / 1000;
        const rafPerSec = (perfRef.current.rafCalls / elapsed).toFixed(1);
        const paintPerSec = (perfRef.current.paintCalls / elapsed).toFixed(1);
        const jumpPerSec = (perfRef.current.jumpToCalls / elapsed).toFixed(1);
        console.log(`📊 PERF: RAF ${rafPerSec}/s | Paint ${paintPerSec}/s | Jump ${jumpPerSec}/s | Points: ${liveStreams.length}`);
        perfRef.current.rafCalls = 0;
        perfRef.current.paintCalls = 0;
        perfRef.current.jumpToCalls = 0;
        perfRef.current.lastReportTime = time;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer('vuvio-test-live-points')) {
        perfRef.current.paintCalls++;
        map.setPaintProperty('vuvio-test-live-points', 'circle-radius', livePointRadius(0.18, selectedId ?? ''));
        map.setPaintProperty('vuvio-test-live-points', 'circle-stroke-color', ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', 'rgba(242,247,246,0.34)']);
        map.setPaintProperty('vuvio-test-live-points', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? ''], 1.05, 0.55]);
      }
      if (map.getLayer('vuvio-test-live-broadcast-halo')) {
        perfRef.current.paintCalls++;
        map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-radius', liveBroadcastHaloRadius(0.18, selectedId ?? ''));
        map.setPaintProperty('vuvio-test-live-broadcast-halo', 'circle-opacity', liveBroadcastHaloOpacity(0.18, selectedId ?? ''));
      }
      if (map.getLayer('vuvio-test-live-selection-ring')) {
        perfRef.current.paintCalls++;
        map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-radius', liveRingRadius(0.18, selectedId ?? '', hoveredId));
        map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-stroke-opacity', liveRingOpacity(selectedId ?? '', hoveredId));
      }
    } catch {
      // The map can be between style states during navigation.
    }
  }, [hoveredId, selectedId]);

  const recenter = () => {
    mapRef.current?.setProjection({ type: 'globe' });
    mapRef.current?.easeTo({
      center: INITIAL_CENTER,
      zoom: 1.35,
      bearing: 0,
      pitch: 0,
      duration: 1350,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
    pauseUntilRef.current = Date.now() + 2200;
    setSelectedId(null);
    setHoveredId('');
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
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        {!onboarding ? (
        <div className="map-engine-switch test-globe-switch" role="group" aria-label="Choose globe">
          <button type="button" className={variant === 'current' ? 'is-active' : ''} onClick={() => navigate('/globe?switch=1')} aria-pressed={variant === 'current'}>
            Current
          </button>
          <button type="button" className={variant === 'lab' ? 'is-active' : ''} onClick={() => navigate('/globe-lab?switch=1')} aria-pressed={variant === 'lab'}>
            Lab
          </button>
          <button type="button" className={variant === 'cesium' ? 'is-active' : ''} onClick={() => navigate('/globe-cesium?switch=1')} aria-pressed={variant === 'cesium'}>
            Cesium
          </button>
          <button type="button" className={variant === 'test' ? 'is-active' : ''} onClick={() => navigate('/globe-test?switch=1')} aria-pressed={variant === 'test'}>
            Test
          </button>
          <button type="button" className={variant === 'test2' ? 'is-active' : ''} onClick={() => navigate('/globe-test-2?switch=1')} aria-pressed={variant === 'test2'}>
            Test 2
          </button>
          <button type="button" className={variant === 'test3' ? 'is-active' : ''} onClick={() => navigate('/globe-test-3?switch=1')} aria-pressed={variant === 'test3'}>
            Test 3
          </button>
        </div>
        ) : null}

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

        {!onboarding && variant === 'test3' ? (
          <div className="test-globe-legend" aria-label="Marker legend">
            <span><i className="is-standard" /> Standard live</span>
            <span><i className="is-sponsored" /> Sponsored</span>
            <span><i className="is-vuvio" /> Vuvio selection</span>
          </div>
        ) : null}

        {false && !onboarding && variant === 'current' && currentZoom < 3.5 ? (
          <div className="iss-globe-orbit-container">
            <button
              type="button"
              className="iss-globe-floating"
              onClick={() => setShowISSCard(true)}
              aria-label="International Space Station"
              title="ISS Live"
            >
              <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="22" width="3" height="16" fill="#2B7F8F" opacity="0.9"/>
                <rect x="5" y="20" width="10" height="2" fill="#1B5F6F" opacity="1"/>
                <rect x="5" y="38" width="10" height="2" fill="#1B5F6F" opacity="1"/>
                <rect x="49" y="22" width="3" height="16" fill="#2B7F8F" opacity="0.9"/>
                <rect x="45" y="20" width="10" height="2" fill="#1B5F6F" opacity="1"/>
                <rect x="45" y="38" width="10" height="2" fill="#1B5F6F" opacity="1"/>
                <rect x="22" y="18" width="16" height="24" rx="2" fill="#1A5F7F" stroke="#2B8FAF" strokeWidth="0.5"/>
                <rect x="28" y="10" width="4" height="40" fill="#0F4F6F" opacity="0.8"/>
                <circle cx="28" cy="26" r="1.5" fill="#2BD9C8" opacity="1"/>
                <circle cx="32" cy="26" r="1.5" fill="#2BD9C8" opacity="1"/>
                <circle cx="28" cy="34" r="1.5" fill="#2BD9C8" opacity="0.9"/>
                <circle cx="32" cy="34" r="1.5" fill="#2BD9C8" opacity="0.9"/>
              </svg>
            </button>
          </div>
        ) : null}

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
                {variant === 'test3' && selectedLive.markerType && selectedLive.markerType !== MARKER_TYPES.standard ? (
                  <span className={`test-globe-card__marker-badge is-${selectedLive.markerType}`}>
                    {selectedLive.markerType === MARKER_TYPES.sponsored
                      ? (selectedLive.sponsoredReason || 'Sponsored')
                      : (selectedLive.featuredReason || 'Vuvio selection')}
                  </span>
                ) : null}
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

        {false && !onboarding && showISSCard && variant === 'current' ? (
          <ISSLiveCard onClose={() => setShowISSCard(false)} />
        ) : null}
      </div>
    </section>
  );
}
