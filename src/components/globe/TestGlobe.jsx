import { Bell, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import MapBottomSheet from '../map/MapBottomSheet.jsx';

const INITIAL_CENTER = [14, 20];
const INITIAL_ZOOM = 1.28;
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const TERRAIN_SOURCE_ID = 'vuvio-test-terrain';
const LIVE_COLOR = '#2BD9C8';
const UPCOMING_COLOR = '#3B82E6';
const MIXED_CLUSTER_COLOR = '#24C6F0';
const ROTATE_DEGREES_PER_SECOND = 1.35;
const SELECTED_LIVE_ZOOM = 5.15;
const REQUESTED_LIVE_ZOOM = 6.35;
const SELECTED_RING_COLOR = '#2BD9C8';

const cityLights = [
  [-0.1276, 51.5072, 0.95],
  [2.3522, 48.8566, 1],
  [4.9041, 52.3676, 0.72],
  [9.19, 45.4642, 0.78],
  [12.4964, 41.9028, 0.76],
  [13.405, 52.52, 0.72],
  [18.0686, 59.3293, 0.52],
  [28.9784, 41.0082, 0.82],
  [31.2357, 30.0444, 0.7],
  [37.6173, 55.7558, 0.86],
  [55.2708, 25.2048, 0.78],
  [72.8777, 19.076, 0.92],
  [77.1025, 28.7041, 0.96],
  [103.8198, 1.3521, 0.86],
  [100.5018, 13.7563, 0.75],
  [114.1694, 22.3193, 0.94],
  [121.4737, 31.2304, 1],
  [116.4074, 39.9042, 0.95],
  [139.6917, 35.6895, 1],
  [126.978, 37.5665, 0.88],
  [151.2093, -33.8688, 0.72],
  [144.9631, -37.8136, 0.64],
  [-74.006, 40.7128, 1],
  [-118.2437, 34.0522, 0.92],
  [-87.6298, 41.8781, 0.82],
  [-99.1332, 19.4326, 0.86],
  [-46.6333, -23.5505, 0.9],
  [-58.3816, -34.6037, 0.78],
  [18.4241, -33.9249, 0.56],
  [36.8219, -1.2921, 0.58],
  [3.3792, 6.5244, 0.74],
];

const statusColor = [
  'case',
  ['==', ['get', 'status'], 'upcoming'],
  UPCOMING_COLOR,
  LIVE_COLOR,
];

const categoryColor = ['coalesce', ['get', 'familyColor'], statusColor];

const clusterColor = [
  'case',
  ['all', ['>', ['get', 'upcomingCount'], 0], ['>', ['get', 'liveCount'], 0]],
  MIXED_CLUSTER_COLOR,
  ['>', ['get', 'upcomingCount'], 0],
  UPCOMING_COLOR,
  LIVE_COLOR,
];

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
      ['*', ['var', 'wave'], ['var', 'wave'], ['-', 3, ['*', 2, ['var', 'wave']]]],
    ],
  ];
}

// Subtle glow layer for marker — very restrained
function markerGlowRadius(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 9, 300, 11, 800, 13],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.6, 300, 0.8, 800, 1]],
  ];
}

// Soft glow opacity — very subtle breathing
function markerGlowOpacity(clock) {
  const wave = breathingWave(clock);
  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.08, 300, 0.10, 800, 0.12],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.04, 300, 0.05, 800, 0.06]],
  ];
}

// Small luminous core for live markers
function livePointRadius(clock, selectedId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 4.2, ['*', wave, 0.4]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 2.4, 300, 3.0, 800, 3.6], ['*', wave, 0.35]],
  ];
}

// Thin elegant ring for selected marker — one refined ring only
function liveRingRadius(clock, selectedId = '', hoveredId = '') {
  const wave = breathingWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 8.4, ['*', wave, 0.8]],
    ['==', ['get', 'id'], hoveredId],
    ['+', 6.8, ['*', wave, 0.5]],
    0,
  ];
}

function liveRingOpacity(selectedId = '', hoveredId = '') {
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    0.82,
    ['==', ['get', 'id'], hoveredId],
    0.52,
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

function buildCityLightCollection() {
  const offsets = [
    [0, 0, 1],
    [0.34, 0.12, 0.58],
    [-0.3, 0.18, 0.46],
    [0.16, -0.26, 0.4],
    [-0.18, -0.16, 0.32],
    [0.58, -0.06, 0.24],
    [-0.54, 0.02, 0.2],
    [0.08, 0.42, 0.18],
    [0.38, -0.38, 0.16],
  ];

  return {
    type: 'FeatureCollection',
    features: cityLights.flatMap(([lng, lat, intensity], cityIndex) =>
      offsets.map(([lngOffset, latOffset, weight], pointIndex) => ({
        type: 'Feature',
        properties: {
          id: `city-light-${cityIndex}-${pointIndex}`,
          intensity: intensity * weight,
          core: pointIndex === 0 ? 1 : 0,
        },
        geometry: {
          type: 'Point',
          coordinates: [lng + lngOffset, lat + latOffset],
        },
      })),
    ),
  };
}

function brightenBaseGlobe(map, isActual = false) {
  try {
    map.setFog?.({
      color: isActual ? 'rgba(8, 28, 52, 0.62)' : 'rgba(11, 31, 42, 0.58)',
      'high-color': isActual ? 'rgba(40, 100, 158, 0.54)' : 'rgba(32, 86, 105, 0.44)',
      'horizon-blend': 0.08,
      'space-color': isActual ? '#030c16' : '#050b13',
      'star-intensity': 0.18,
    });

    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      const sourceLayer = String(layer['source-layer'] ?? '').toLowerCase();
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', isActual ? '#060f1a' : '#07131e');
      }
      if (layer.type === 'fill' && (id.includes('water') || sourceLayer.includes('water'))) {
        map.setPaintProperty(layer.id, 'fill-color', isActual ? '#083548' : '#0a2130');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.94);
      }
      if (layer.type === 'line' && (id.includes('boundary') || id.includes('admin') || sourceLayer.includes('boundary'))) {
        map.setPaintProperty(layer.id, 'line-color', isActual ? 'rgba(81, 167, 218, 0.42)' : 'rgba(126, 190, 205, 0.34)');
        map.setPaintProperty(layer.id, 'line-opacity', isActual ? 0.52 : 0.42);
      }
    });
  } catch {
    // Base style layer ids differ between providers; ignore unsupported paint properties.
  }
}

export default function TestGlobe({ streams, mode = 'test' }) {
  const isActualMode = mode === 'actual';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const dvMarkersRef = useRef({});
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [sheetState, setSheetState] = useState('closed');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState('');
  const [mapError, setMapError] = useState('');

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
      zoom: isActualMode ? 1.35 : INITIAL_ZOOM,
      minZoom: 0,
      maxZoom: 9,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: isActualMode ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio,
    });

    mapRef.current = map;
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
        brightenBaseGlobe(map, isActualMode);

        if (searchParams.get('filter') === 'nearby' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 7.5, duration: 1400 });
            },
            () => {},
            { timeout: 5000 },
          );
        }

        if (!isActualMode && !map.getSource(TERRAIN_SOURCE_ID)) {
          map.addSource(TERRAIN_SOURCE_ID, {
            type: 'raster-dem',
            url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
            tileSize: 256,
          });
          map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.45 });
          map.addLayer({
            id: 'vuvio-test-hillshade',
            type: 'hillshade',
            source: TERRAIN_SOURCE_ID,
            paint: {
              'hillshade-shadow-color': '#02070D',
              'hillshade-highlight-color': '#1B4B63',
              'hillshade-accent-color': '#0E2738',
              'hillshade-illumination-direction': 320,
              'hillshade-exaggeration': 0.36,
            },
          });
        }

        if (isActualMode) {
          map.setPadding({ top: 0, bottom: 48, left: 0, right: 0 });
        }

        map.addSource('vuvio-test-lives', {
          type: 'geojson',
          data: buildCollection(liveStreams),
          cluster: isActualMode,
          clusterMaxZoom: 5,
          clusterMinPoints: 3,
          clusterRadius: 52,
          clusterProperties: {
            upcomingCount: ['+', ['case', ['==', ['get', 'status'], 'upcoming'], 1, 0]],
            liveCount: ['+', ['case', ['==', ['get', 'status'], 'live'], 1, 0]],
          },
        });
        map.addSource('vuvio-test-city-lights', {
          type: 'geojson',
          data: buildCityLightCollection(),
        });

        map.addLayer({
          id: 'vuvio-test-city-light-aura',
          type: 'circle',
          source: 'vuvio-test-city-lights',
          paint: {
            'circle-color': '#F5A85B',
            'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 2.4, 1, 8.5],
            'circle-blur': 1,
            'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, isActualMode ? 0.022 : 0.016, 1, isActualMode ? 0.095 : 0.075],
          },
        });

        map.addLayer({
          id: 'vuvio-test-city-light-glow',
          type: 'circle',
          source: 'vuvio-test-city-lights',
          paint: {
            'circle-color': '#E8B45B',
            'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.9, 1, 3.4],
            'circle-blur': 0.9,
            'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, isActualMode ? 0.05 : 0.04, 1, isActualMode ? 0.20 : 0.16],
          },
        });

        map.addLayer({
          id: 'vuvio-test-city-light-points',
          type: 'circle',
          source: 'vuvio-test-city-lights',
          paint: {
            'circle-color': '#FFD48A',
            'circle-radius': [
              'case',
              ['==', ['get', 'core'], 1],
              ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.45, 1, 0.9],
              ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.18, 1, 0.42],
            ],
            'circle-blur': 0.2,
            'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, isActualMode ? 0.12 : 0.1, 1, isActualMode ? 0.56 : 0.46],
          },
        });

        map.addLayer({
          id: 'vuvio-test-clusters',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': clusterColor,
            'circle-opacity': 0.14,
            'circle-stroke-color': clusterColor,
            'circle-stroke-opacity': 0.62,
            'circle-stroke-width': 1,
            'circle-radius': isActualMode
              ? ['step', ['get', 'point_count'], 13, 3, 15, 6, 17]
              : ['step', ['get', 'point_count'], 10, 3, 12, 6, 14],
          },
        });

        map.addLayer({
          id: 'vuvio-test-cluster-glow',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': clusterColor,
            'circle-radius': isActualMode
              ? ['step', ['get', 'point_count'], 18, 3, 22, 6, 26]
              : ['step', ['get', 'point_count'], 15, 3, 19, 6, 23],
            'circle-blur': 0.95,
            'circle-opacity': 0.08,
          },
        });

        map.addLayer({
          id: 'vuvio-test-cluster-count',
          type: 'symbol',
          source: 'vuvio-test-lives',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 10,
            'text-font': ['Open Sans Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#F2F7F6',
            'text-halo-color': 'rgba(6, 13, 22, 0.72)',
            'text-halo-width': 0.8,
          },
        });

        // Soft outer glow layer for live markers
        map.addLayer({
          id: 'vuvio-test-live-glow',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': categoryColor,
            'circle-radius': markerGlowRadius(0),
            'circle-blur': 0.88,
            'circle-opacity': markerGlowOpacity(0),
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
            'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', 'rgba(242,247,246,0.15)'],
            'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 1.0, 0.3],
            'circle-opacity': ['case', ['==', ['get', 'id'], selectedId ?? ''], 1.0, 0.94],
          },
        });

        // Thin elegant ring for selected markers
        map.addLayer({
          id: 'vuvio-test-live-selection-ring',
          type: 'circle',
          source: 'vuvio-test-lives',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': 'rgba(43,217,200,0)',
            'circle-radius': liveRingRadius(0, selectedId ?? '', hoveredId),
            'circle-stroke-color': SELECTED_RING_COLOR,
            'circle-stroke-width': 0.9,
            'circle-stroke-opacity': liveRingOpacity(selectedId ?? '', hoveredId),
            'circle-opacity': 0,
          },
        });

        map.on('click', 'vuvio-test-live-points', (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          setSelectedId(feature.properties.id);
          pauseUntilRef.current = Date.now() + 8500;
          map.stop();
          map.setProjection({ type: 'globe' });
          map.easeTo({
            center: feature.geometry.coordinates,
            zoom: SELECTED_LIVE_ZOOM,
            bearing: 0,
            pitch: 0,
            duration: 1350,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
          });
        });

        map.on('click', 'vuvio-test-clusters', (event) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (!feature || clusterId === undefined) return;
          const source = map.getSource('vuvio-test-lives');
          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error) return;
            pauseUntilRef.current = Date.now() + 2400;
            map.easeTo({
              center: feature.geometry.coordinates,
              zoom: Math.min(zoom + 0.35, SELECTED_LIVE_ZOOM),
              duration: 650,
              essential: true,
            });
          });
        });

        map.on('mouseenter', 'vuvio-test-live-points', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseenter', 'vuvio-test-clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mousemove', 'vuvio-test-live-points', (event) => {
          const feature = event.features?.[0];
          setHoveredId(feature?.properties?.id ?? '');
        });
        map.on('mouseleave', 'vuvio-test-live-points', () => {
          map.getCanvas().style.cursor = '';
          setHoveredId('');
        });
        map.on('mouseleave', 'vuvio-test-clusters', () => {
          map.getCanvas().style.cursor = '';
        });
      } catch (error) {
        setMapError(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      map.getCanvas().removeEventListener('pointerdown', pause);
      map.getCanvas().removeEventListener('wheel', pause);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      for (const marker of Object.values(dvMarkersRef.current)) marker.remove();
      dvMarkersRef.current = {};
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

  // Double-V pulse markers (test mode only)
  useEffect(() => {
    if (isActualMode) return;
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      const currentIds = new Set(liveStreams.map((s) => s.id));
      for (const [id, marker] of Object.entries(dvMarkersRef.current)) {
        if (!currentIds.has(id)) { marker.remove(); delete dvMarkersRef.current[id]; }
      }
      for (const stream of liveStreams) {
        if (dvMarkersRef.current[stream.id]) continue;
        const color = stream.familyColor || '#2BD9C8';
        const delay = (pulseSeed(stream.id) * 2.2).toFixed(2);
        const el = document.createElement('div');
        el.className = 'vuvio-dv-pulse';
        el.style.cssText = `--dv-color:${color};--dv-delay:${delay}s`;
        el.innerHTML = '<svg viewBox="-16 -15 32 28" width="32" height="28" aria-hidden="true"><circle cx="0" cy="-9" r="2" fill="currentColor" opacity="0.9"/><path d="M-9,-4 L-5.5,5 L0,-1 L5.5,5 L9,-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        dvMarkersRef.current[stream.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(stream.coordinates)
          .addTo(map);
      }
    };

    if (map.loaded()) sync(); else map.once('load', sync);
  }, [isActualMode, liveStreams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    let previousTime = performance.now();
    let lastPaintTime = 0;
    const PAINT_INTERVAL = 33; // ~30fps for expensive setPaintProperty calls

    const tick = (time) => {
      const delta = Math.min(80, time - previousTime);
      previousTime = time;

      // Rotation runs every frame (cheap jumpTo)
      if (Date.now() > pauseUntilRef.current && !selectedId) {
        const center = map.getCenter();
        map.jumpTo({ center: [center.lng + (ROTATE_DEGREES_PER_SECOND * delta) / 1000, center.lat] });
      }

      // Breathing animation updates throttled to 30fps
      if (time - lastPaintTime >= PAINT_INTERVAL) {
        lastPaintTime = time;
        const breathingClock = (time % 2800) / 2800; // 2.8s breathing cycle

        if (map.getLayer('vuvio-test-live-glow')) {
          map.setPaintProperty('vuvio-test-live-glow', 'circle-radius', markerGlowRadius(breathingClock));
          map.setPaintProperty('vuvio-test-live-glow', 'circle-opacity', markerGlowOpacity(breathingClock));
        }
        if (map.getLayer('vuvio-test-live-points')) {
          map.setPaintProperty('vuvio-test-live-points', 'circle-radius', livePointRadius(breathingClock, selectedId ?? ''));
        }
        if (map.getLayer('vuvio-test-live-selection-ring')) {
          map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-radius', liveRingRadius(breathingClock, selectedId ?? '', hoveredId));
          map.setPaintProperty('vuvio-test-live-selection-ring', 'circle-stroke-opacity', liveRingOpacity(selectedId ?? '', hoveredId));
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [hoveredId, selectedId]);

  const recenter = () => {
    mapRef.current?.setProjection({ type: 'globe' });
    mapRef.current?.easeTo({
      center: INITIAL_CENTER,
      zoom: isActualMode ? 1.35 : INITIAL_ZOOM,
      bearing: 0,
      pitch: 0,
      duration: 620,
      essential: true,
    });
    pauseUntilRef.current = Date.now() + 1200;
    setSelectedId(null);
    setHoveredId('');
  };

  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: 420,
      essential: true,
    });
    pauseUntilRef.current = Date.now() + 1200;
  };

  const showGlobeSwitcher = true;

  return (
    <section className={`screen test-globe-screen test-globe-screen--maplibre${isActualMode ? ' test-globe-screen--actual' : ''}`} aria-label={isActualMode ? 'Current Vuvio globe' : 'Test Vuvio globe'}>
      <div className="test-old-globe">
        <div ref={containerRef} className="test-old-globe__canvas" />
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        {showGlobeSwitcher ? (
          <div className="map-engine-switch test-globe-switch" role="group" aria-label="Choose globe">
            <button
              type="button"
              className={isActualMode ? 'is-active' : ''}
              onClick={() => {
                if (!isActualMode) navigate('/globe');
              }}
              aria-pressed={isActualMode}
            >
              Current
            </button>
            <button type="button" onClick={() => navigate('/globe-lab?switch=1')} aria-pressed="false">
              Lab
            </button>
            <button
              type="button"
              className={isActualMode ? '' : 'is-active'}
              onClick={() => {
                if (isActualMode) navigate('/globe-test?switch=1');
              }}
              aria-pressed={!isActualMode}
            >
              Test
            </button>
          </div>
        ) : null}

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
            <button type="button" className="test-globe-card__close" onClick={recenter} aria-label="Close">
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
