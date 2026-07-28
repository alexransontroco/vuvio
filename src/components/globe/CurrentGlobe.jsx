import { Bell, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import MapBottomSheet from '../map/MapBottomSheet.jsx';

const INITIAL_CENTER = [14, 20];
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const LIVE_COLOR = '#2BD9C8';
const UPCOMING_COLOR = '#3B82E6';
const ROTATE_DEGREES_PER_SECOND = 3.5;
const ACTUAL_ROTATION_INTERVAL = 16;
const SELECTED_LIVE_ZOOM = 4.05;
const REQUESTED_LIVE_ZOOM = 4.2;
const SELECTED_RING_COLOR = '#2BD9C8';

const statusColor = [
  'case',
  ['==', ['get', 'status'], 'upcoming'],
  UPCOMING_COLOR,
  LIVE_COLOR,
];

const categoryColor = ['coalesce', ['get', 'familyColor'], statusColor];

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

// Luminous core for live markers — subtle pulsing effect
function livePointRadius(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 4.2, 300, 5.0, 800, 5.9, 1500, 6.7], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.34, 800, 0.54, 1500, 0.70]]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.45, 300, 3.25, 800, 4.4, 1500, 5.1], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.20, 800, 0.34, 1500, 0.44]]],
  ];
}

function liveColorGlowRadius(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 6.0, 300, 8.5, 800, 12.5, 1500, 17.0],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.0, 800, 3.5, 1500, 5.5]],
  ];
}

function liveColorGlowOpacity(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.06, 300, 0.09, 800, 0.15, 1500, 0.20],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.03, 800, 0.11, 1500, 0.17]],
  ];
}

function liveCrowdHaloRadius(clock) {
  const wave = breathingWave((clock * 1.35) % 1);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 14, 1500, 20],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 9, 1500, 17]],
  ];
}

function liveCrowdHaloOpacity(clock) {
  const wave = breathingWave((clock * 1.35) % 1);
  return [
    '*',
    ['-', 1, wave],
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0, 500, 0, 800, 0.09, 1500, 0.16],
  ];
}

function liveBroadcastHaloRadius(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5.4, 300, 6.4, 800, 8.0, 1500, 9.0], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5.2, 800, 8.2, 1500, 10.4]]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.9, 300, 4.8, 800, 6.3, 1500, 7.2], ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 4.0, 800, 6.8, 1500, 8.8]]],
  ];
}

function liveBroadcastHaloOpacity(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['*', ['-', 1, wave], ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.24, 800, 0.32, 1500, 0.39]],
    ['*', ['-', 1, wave], ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.14, 800, 0.21, 1500, 0.29]],
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

  // Main diffuse arc with rotation
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);

  // Arc 1: Primary orbital band
  const grad1 = ctx.createRadialGradient(0, -baseRadius * 0.12, baseRadius * 0.18, 0, -baseRadius * 0.12, baseRadius * 1.15);
  grad1.addColorStop(0, 'rgba(80, 170, 230, 0.14)');
  grad1.addColorStop(0.3, 'rgba(100, 180, 240, 0.11)');
  grad1.addColorStop(0.6, 'rgba(90, 160, 220, 0.06)');
  grad1.addColorStop(1, 'rgba(80, 140, 200, 0)');
  ctx.fillStyle = grad1;
  ctx.beginPath();
  ctx.arc(0, -baseRadius * 0.12, baseRadius * 1.08, 0, Math.PI * 2);
  ctx.fill();

  // Arc 2: Secondary subtle band
  const grad2 = ctx.createRadialGradient(baseRadius * 0.28, baseRadius * 0.38, baseRadius * 0.14, baseRadius * 0.28, baseRadius * 0.38, baseRadius * 1.38);
  grad2.addColorStop(0, 'rgba(100, 170, 230, 0.09)');
  grad2.addColorStop(0.4, 'rgba(110, 180, 240, 0.05)');
  grad2.addColorStop(1, 'rgba(100, 160, 230, 0)');
  ctx.fillStyle = grad2;
  ctx.beginPath();
  ctx.arc(baseRadius * 0.28, baseRadius * 0.38, baseRadius * 1.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Asymmetric haze behind globe
  const haze = ctx.createRadialGradient(cx, cy * 0.78, baseRadius * 0.48, cx, cy * 0.78, baseRadius * 1.6);
  haze.addColorStop(0, 'rgba(70, 150, 200, 0.05)');
  haze.addColorStop(0.5, 'rgba(60, 140, 180, 0.02)');
  haze.addColorStop(1, 'rgba(60, 140, 180, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);

  // Fine dust particles with parallax
  const dustCount = Math.max(8, Math.floor((w * h) / 120000));
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < dustCount; i++) {
    const seed = i * 13.7;
    const x = (cx + Math.cos(rotation * 0.012 + seed) * w * 0.32) % w;
    const y = (cy + Math.sin(rotation * 0.009 + seed) * h * 0.32) % h;
    const size = 0.5 + Math.sin(rotation * 0.006 + seed) * 0.3;
    ctx.fillStyle = `rgba(160, 210, 255, ${0.15 + Math.sin(seed) * 0.1})`;
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
  return {
    type: 'Feature',
    properties: {
      id: stream.id,
      status: stream.status,
      viewers: stream.viewers ?? '',
      viewersNumber: viewersNumber(stream),
      pulseSeed: pulseSeed(stream.id),
      family: stream.family,
      familyColor: stream.familyColor,
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
      color: 'rgba(8, 28, 52, 0.62)',
      'high-color': 'rgba(40, 100, 158, 0.54)',
      'horizon-blend': 0.08,
      'space-color': '#030c16',
      'star-intensity': 0.18,
    });

    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#060f1a');
      }
      if (layer.type === 'fill' && (id.includes('water') || sourceLayer.includes('water'))) {
        map.setPaintProperty(layer.id, 'fill-color', '#083548');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.94);
      }
      if (layer.type === 'line' && (id.includes('boundary') || id.includes('admin') || sourceLayer.includes('boundary'))) {
        map.setPaintProperty(layer.id, 'line-color', 'rgba(81, 167, 218, 0.42)');
        map.setPaintProperty(layer.id, 'line-opacity', 0.52);
      }
    });
  } catch {
    // Base style support can differ between MapLibre versions/providers.
  }
}

export default function CurrentGlobe({ streams }) {
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
  const [mapError, setMapError] = useState('');

  // Performance diagnostics
  const perfRef = useRef({
    rafCalls: 0,
    paintCalls: 0,
    jumpToCalls: 0,
    startTime: performance.now(),
    lastReportTime: performance.now(),
  });

  const enrichedStreams = useMemo(() => streams.map(enrichExperience), [streams]);
  const requestedLiveId = searchParams.get('live') ?? '';
  const requestedLive = useMemo(() => {
    if (!requestedLiveId) return null;
    return enrichedStreams.find((stream) => stream.id === requestedLiveId) ?? null;
  }, [enrichedStreams, requestedLiveId]);

  const liveStreams = useMemo(() => {
    return enrichedStreams
      .filter((stream) => activeStatuses.includes(stream.status))
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .filter((stream) => {
        if (activeActivities.length === 0) return true;
        return activeActivities.some((activityId) => {
          const activity = ACTIVITY_CATEGORIES.find((a) => a.id === activityId);
          return activity?.subcategories.includes(stream.subcategory);
        });
      });
  }, [activeActivities, activeFamily, activeStatuses, enrichedStreams]);

  const selectedLive = enrichedStreams.find((stream) => stream.id === selectedId) ?? null;

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
    return { total: liveStreams.length, byFamily, byActivity };
  }, [enrichedStreams, liveStreams.length]);

  const selectFamily = (nextFamily) => {
    setActiveFamily(nextFamily);
    setSelectedId(null);
    if (nextFamily !== 'all') setActiveActivities([]);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: 1.35,
      minZoom: 0,
      maxZoom: 9,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.35),
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

    const pause = () => {
      pauseUntilRef.current = Date.now() + 1800;
    };

    map.getCanvas().addEventListener('pointerdown', pause);
    map.getCanvas().addEventListener('wheel', pause, { passive: true });
    map.on('dragstart', pause);
    map.on('zoomstart', pause);
    map.on('error', (event) => {
      const message = event?.error?.message ?? event?.message ?? '';
      if (!message || /tile|glyph|sprite|network|abort/i.test(message)) return;
      setMapError(message);
    });

    map.on('load', () => {
      try {
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

        map.setPadding({ top: 46, bottom: 48, left: 0, right: 0 });

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
            'circle-color': categoryColor,
            'circle-radius': liveColorGlowRadius(0),
            'circle-blur': 0.72,
            'circle-opacity': liveColorGlowOpacity(0),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-broadcast-halo',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#F8FFFF',
            'circle-radius': liveBroadcastHaloRadius(0, selectedId ?? ''),
            'circle-blur': 0.92,
            'circle-opacity': liveBroadcastHaloOpacity(0, selectedId ?? ''),
          },
        });

        map.addLayer({
          id: 'vuvio-test-live-crowd-halo',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': categoryColor,
            'circle-radius': liveCrowdHaloRadius(0),
            'circle-blur': 0.96,
            'circle-opacity': liveCrowdHaloOpacity(0),
          },
        });

        // Luminous core for live markers
        map.addLayer({
          id: 'vuvio-test-live-points',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': categoryColor,
            'circle-radius': livePointRadius(0, selectedId ?? ''),
            'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', 'rgba(242,247,246,0.34)'],
            'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 1.05, 0.55],
            'circle-opacity': ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.88, 0.72],
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
            'circle-stroke-color': SELECTED_RING_COLOR,
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
          selectedIdRef.current = nextSelectedId;
          setSelectedId(nextSelectedId);
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
      map.getCanvas().removeEventListener('pointerdown', pause);
      map.getCanvas().removeEventListener('wheel', pause);
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
    const PULSE_INTERVAL = 50;

    const tick = (time) => {
      perfRef.current.rafCalls++;
      if (time - lastPulseTime >= PULSE_INTERVAL) {
        lastPulseTime = time;
        const clock = (time % 1550) / 1550;
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
          if (map.getLayer('vuvio-test-live-points')) {
            map.setPaintProperty('vuvio-test-live-points', 'circle-radius', livePointRadius(clock, selectedId ?? ''));
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
    <section className="screen test-globe-screen test-globe-screen--maplibre test-globe-screen--actual" data-sheet-state={sheetState} aria-label="Current Vuvio globe">
      <div className="test-old-globe">
        <div ref={containerRef} className="test-old-globe__canvas" />
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        <div className="map-engine-switch test-globe-switch" role="group" aria-label="Choose globe">
          <button type="button" className="is-active" aria-pressed="true">
            Current
          </button>
          <button type="button" onClick={() => navigate('/globe-lab?switch=1')} aria-pressed="false">
            Lab
          </button>
          <button type="button" onClick={() => navigate('/globe-cesium?switch=1')} aria-pressed="false">
            Cesium
          </button>
          <button type="button" onClick={() => navigate('/globe-test?switch=1')} aria-pressed="false">
            Test
          </button>
        </div>

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

        {!selectedLive && (
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

        {selectedLive ? (
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
                  onClick={() => navigate(`/discover?live=${encodeURIComponent(selectedLive.id)}`)}
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
