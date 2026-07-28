import { LocateFixed, Minus, Play, Plus, SlidersHorizontal, Star, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { createGlobeTest2Lives, globeTest2Config } from '../../data/globeTest2Data.js';

const SOURCE_CLUSTER = 'vuvio-test2-cluster-source';
const SOURCE_PRIORITY = 'vuvio-test2-priority-source';
const SOURCE_PREVIEW = 'vuvio-test2-preview-source';
const SOURCE_PARTICLES = 'vuvio-test2-particle-source';
const ROTATE_DEGREES_PER_SECOND = 3.5;
const ROTATE_INTERVAL = 16;

const FAMILY_META = {
  earth: { id: 'earth', label: 'Land', color: globeTest2Config.colors.land },
  water: { id: 'water', label: 'Water', color: globeTest2Config.colors.water },
  air: { id: 'air', label: 'Air', color: globeTest2Config.colors.air },
};

function viewersNumber(live) {
  if (!live?.viewers) return 0;
  return Number.parseInt(String(live.viewers).replace(/\D/g, ''), 10) || 0;
}

function formatCompact(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

function stableSeed(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  return hash / 9973;
}

function distanceScore(a, b) {
  const lngDistance = Math.abs((((a[0] - b[0]) + 540) % 360) - 180);
  const latDistance = Math.abs(a[1] - b[1]);
  return Math.max(0, 1 - Math.sqrt(lngDistance * lngDistance + latDistance * latDistance) / 95);
}

// Local ranking hook for Test 2. Replace this function with a backend/Firebase rank
// while keeping the same signature when server-side scoring becomes available.
export function getLivePriorityScore(live, cameraState, activeFilters) {
  const viewers = Math.min(1, viewersNumber(live) / 5000);
  const quality = live.qualityScore ?? 0.65;
  const proximity = distanceScore(live.coordinates, cameraState.center);
  const recency = Math.max(0, 1 - (live.startedMinutesAgo ?? 120) / 240);
  const filterMatch = activeFilters.families[live.family] ? 0.12 : -0.35;
  const featuredBoost = live.featured ? 0.72 : 0;

  return featuredBoost + viewers * 0.28 + quality * 0.26 + proximity * 0.22 + recency * 0.12 + filterMatch;
}

function normalizeLive(live) {
  const enriched = enrichExperience(live);
  const family = enriched.family === 'earth' || enriched.family === 'water' || enriched.family === 'air' ? enriched.family : 'earth';
  return {
    ...enriched,
    family,
    familyColor: FAMILY_META[family].color,
    viewersNumber: viewersNumber(enriched),
    pulseSeed: stableSeed(enriched.id),
    title: enriched.title ?? enriched.experienceTitle,
    streamer: enriched.streamer ?? enriched.name,
  };
}

function passesActiveFilters(live, activeFilters) {
  const hasFamily = Object.values(activeFilters.families).some(Boolean);
  const familyMatches = activeFilters.families[live.family];

  // Featured is a spotlight filter, not an environment. When it is the only
  // enabled filter it narrows to featured lives; with environments enabled it
  // keeps those lives visible and boosts/highlights featured matches.
  if (!hasFamily) return activeFilters.featured ? live.featured : false;
  return familyMatches;
}

function separatedCoordinates(lives, zoom) {
  if (zoom < globeTest2Config.zoomLevels.close) return new Map(lives.map((live) => [live.id, live.coordinates]));
  const groups = new Map();
  lives.forEach((live) => {
    const key = `${live.coordinates[0].toFixed(3)}:${live.coordinates[1].toFixed(3)}`;
    const list = groups.get(key) ?? [];
    list.push(live);
    groups.set(key, list);
  });

  const output = new Map();
  groups.forEach((group) => {
    group.forEach((live, index) => {
      if (group.length === 1) {
        output.set(live.id, live.coordinates);
        return;
      }
      const angle = (Math.PI * 2 * index) / group.length;
      const radius = Math.min(0.018, 0.006 + group.length * 0.0012);
      output.set(live.id, [
        Number((live.coordinates[0] + Math.cos(angle) * radius).toFixed(5)),
        Number((live.coordinates[1] + Math.sin(angle) * radius).toFixed(5)),
      ]);
    });
  });
  return output;
}

function toCollection(lives, displayCoords) {
  return {
    type: 'FeatureCollection',
    features: lives.map((live) => ({
      type: 'Feature',
      properties: {
        id: live.id,
        family: live.family,
        familyColor: live.familyColor,
        featured: Boolean(live.featured),
        viewersNumber: live.viewersNumber,
        qualityScore: live.qualityScore ?? 0.6,
        pulseSeed: live.pulseSeed,
      },
      geometry: {
        type: 'Point',
        coordinates: displayCoords?.get(live.id) ?? live.coordinates,
      },
    })),
  };
}

function toParticleCollection(lives, displayCoords) {
  const features = [];
  lives.forEach((live) => {
    const coords = displayCoords?.get(live.id) ?? live.coordinates;
    const particleCount = live.featured || live.viewersNumber > 1800 ? 3 : 1;
    for (let index = 0; index < particleCount; index += 1) {
      const seed = (live.pulseSeed + index * 0.331) % 1;
      const angle = seed * Math.PI * 2;
      const radius = 0.018 + index * 0.011;
      features.push({
        type: 'Feature',
        properties: {
          id: `${live.id}-p${index}`,
          familyColor: live.familyColor,
          featured: Boolean(live.featured),
          particleSeed: seed,
          viewersNumber: live.viewersNumber,
        },
        geometry: {
          type: 'Point',
          coordinates: [
            Number((coords[0] + Math.cos(angle) * radius).toFixed(5)),
            Number((coords[1] + Math.sin(angle) * radius).toFixed(5)),
          ],
        },
      });
    }
  });

  return { type: 'FeatureCollection', features };
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
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#060f1a');
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
    // MapLibre base styles can expose slightly different layer names.
  }
}

function clusterColorExpression() {
  const { land, water, air, mixed } = globeTest2Config.colors;
  return [
    'case',
    ['==', ['get', 'point_count'], ['get', 'landCount']],
    land,
    ['==', ['get', 'point_count'], ['get', 'waterCount']],
    water,
    ['==', ['get', 'point_count'], ['get', 'airCount']],
    air,
    mixed,
  ];
}

function breathWave(clock, seedProperty = 'pulseSeed') {
  return [
    'let',
    'phase',
    ['%', ['+', ['get', seedProperty], clock], 1],
    [
      'let',
      'wave',
      ['case', ['<', ['var', 'phase'], 0.5], ['*', ['var', 'phase'], 2], ['*', ['-', 1, ['var', 'phase']], 2]],
      ['*', ['var', 'wave'], ['var', 'wave'], ['-', 3, ['*', 2, ['var', 'wave']]]],
    ],
  ];
}

function pointCoreRadiusExpression(clock, selectedId, hoverId) {
  const wave = breathWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 4.6, ['*', wave, 0.55]],
    ['==', ['get', 'id'], hoverId],
    ['+', 3.4, ['*', wave, 0.34]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 1.35, 900, 1.9, 2600, 2.35], ['*', wave, 0.16]],
  ];
}

function pointAuraRadiusExpression(clock, selectedId) {
  const wave = breathWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 18, ['*', wave, 2.4]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5.6, 900, 8.4, 2600, 11.5], ['*', wave, 1.15]],
  ];
}

function pointAuraOpacityExpression(clock, selectedId) {
  const wave = [
    '-',
    1,
    ['*', breathWave(clock), 0.32],
  ];
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['*', wave, 0.2],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.045, 900, 0.08, 2600, 0.115]],
  ];
}

function particleRadiusExpression(clock) {
  const wave = breathWave(clock, 'particleSeed');
  return ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.55, 2600, 0.92], ['*', wave, 0.16]];
}

function particleOpacityExpression(clock) {
  return ['*', ['-', 1, ['*', breathWave(clock, 'particleSeed'), 0.45]], ['case', ['==', ['get', 'featured'], true], 0.34, 0.2]];
}

function featuredRingRadiusExpression(clock, selectedId) {
  const wave = breathWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 9.4, ['*', wave, 0.65]],
    ['==', ['get', 'featured'], true],
    ['+', 5.6, ['*', wave, 0.32]],
    0,
  ];
}

function featuredRingOpacityExpression(selectedId) {
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    0.62,
    ['==', ['get', 'featured'], true],
    0.34,
    0,
  ];
}

function selectionRingRadiusExpression(clock, selectedId, hoverId) {
  const wave = breathWave(clock);
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 12.6, ['*', wave, 1.25]],
    ['==', ['get', 'id'], hoverId],
    ['+', 7.8, ['*', wave, 0.55]],
    0,
  ];
}

function selectionRingOpacityExpression(selectedId, hoverId) {
  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    0.42,
    ['==', ['get', 'id'], hoverId],
    0.28,
    0,
  ];
}

function clusterRadiusExpression() {
  return [
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    1,
    12,
    70,
    15,
    350,
    18,
    1200,
    22,
  ];
}

function clusterHaloRadiusExpression() {
  return [
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    1,
    17,
    70,
    22,
    350,
    27,
    1200,
    32,
  ];
}

function clusterOpacityByZoom() {
  return ['interpolate', ['linear'], ['zoom'], 1.4, 0.88, 4.8, 0.58, 5.35, 0.18];
}

function clusterOpacityFactorByZoom(factorExpression) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    1.4,
    ['*', 0.88, factorExpression],
    4.8,
    ['*', 0.58, factorExpression],
    5.35,
    ['*', 0.18, factorExpression],
  ];
}

function pointOpacityByZoom() {
  return ['interpolate', ['linear'], ['zoom'], 2.2, 0.58, 4.7, 0.78, 6.6, 0.9];
}

function pointOpacityFactorByZoom(factorExpression) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    2.2,
    ['*', 0.58, factorExpression],
    4.7,
    ['*', 0.78, factorExpression],
    6.6,
    ['*', 0.9, factorExpression],
  ];
}

function particleOpacityByZoom(clock) {
  const opacity = particleOpacityExpression(clock);
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    3.4,
    0,
    4.8,
    ['*', opacity, 0.72],
    7,
    opacity,
  ];
}

function selectedLiveCard(live, closeSelectedLive, navigate) {
  if (!live) return null;
  return (
    <aside className={`globe-test2-card ${live.featured ? 'is-featured' : ''}`} aria-label={`Selected live: ${live.title}`}>
      <button type="button" className="globe-test2-card__close" onClick={closeSelectedLive} aria-label="Close">
        <X size={14} strokeWidth={2} />
      </button>
      <img src={live.image || '/icons/icon-192.png'} alt="" loading="lazy" />
      <div className="globe-test2-card__body">
        <div className="globe-test2-card__badges">
          <span className="globe-test2-live-badge">Live</span>
          {live.featured ? <span className="globe-test2-featured-badge">Featured</span> : null}
          <span style={{ '--test2-family-color': live.familyColor }}>{FAMILY_META[live.family].label}</span>
        </div>
        <h2>{live.title}</h2>
        <p>{live.streamer} · {live.city}, {live.country}</p>
        <strong>{formatCompact(live.viewersNumber)} watching</strong>
        <button type="button" onClick={() => navigate(`/discover?live=${encodeURIComponent(live.id)}`)}>
          <Play size={13} fill="currentColor" strokeWidth={1.8} />
          Watch Live
        </button>
      </div>
    </aside>
  );
}

export default function GlobeTest2({ streams }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const selectedIdRef = useRef('');
  const hoverIdRef = useRef('');
  const liveByIdRef = useRef(new Map());
  const previousViewRef = useRef(null);
  const cameraStateRef = useRef({ center: globeTest2Config.initialCenter, zoom: globeTest2Config.initialZoom });
  const [density, setDensity] = useState('medium');
  const [activeFilters, setActiveFilters] = useState({
    families: { earth: true, water: true, air: true },
    featured: false,
  });
  const [cameraState, setCameraState] = useState(cameraStateRef.current);
  const [selectedId, setSelectedId] = useState('');
  const [hoverId, setHoverId] = useState('');
  const [mapError, setMapError] = useState('');

  const allLives = useMemo(() => createGlobeTest2Lives(density, streams).map(normalizeLive), [density, streams]);
  const filteredLives = useMemo(() => allLives.filter((live) => passesActiveFilters(live, activeFilters)), [activeFilters, allLives]);
  const scoredLives = useMemo(() => {
    return filteredLives
      .map((live) => ({ live, score: getLivePriorityScore(live, cameraState, activeFilters) }))
      .sort((a, b) => b.score - a.score);
  }, [activeFilters, cameraState, filteredLives]);

  const maxPriorityPoints = useMemo(() => {
    const desktop = window.matchMedia?.('(min-width: 760px)').matches;
    if (cameraState.zoom < globeTest2Config.zoomLevels.world) return 0;
    if (cameraState.zoom < globeTest2Config.zoomLevels.region) return desktop ? 34 : 20;
    return desktop ? 120 : 72;
  }, [cameraState.zoom]);

  const priorityLives = useMemo(() => scoredLives.slice(0, maxPriorityPoints).map((item) => item.live), [maxPriorityPoints, scoredLives]);
  const priorityIds = useMemo(() => new Set(priorityLives.map((live) => live.id)), [priorityLives]);
  const clusteredLives = useMemo(() => filteredLives.filter((live) => !priorityIds.has(live.id)), [filteredLives, priorityIds]);
  const displayCoords = useMemo(() => separatedCoordinates(filteredLives, cameraState.zoom), [cameraState.zoom, filteredLives]);
  const clusterCollection = useMemo(() => toCollection(clusteredLives, displayCoords), [clusteredLives, displayCoords]);
  const priorityCollection = useMemo(() => toCollection(priorityLives, displayCoords), [priorityLives, displayCoords]);
  const particleCollection = useMemo(() => toParticleCollection(priorityLives, displayCoords), [displayCoords, priorityLives]);
  const selectedLive = useMemo(() => allLives.find((live) => live.id === selectedId) ?? null, [allLives, selectedId]);
  const previewLives = useMemo(() => {
    const limit = window.matchMedia?.('(min-width: 760px)').matches ? globeTest2Config.maxPreviewCards.desktop : globeTest2Config.maxPreviewCards.mobile;
    if (selectedLive) return [selectedLive];
    if (hoverId) {
      const hovered = allLives.find((live) => live.id === hoverId);
      return hovered ? [hovered] : [];
    }
    return cameraState.zoom >= globeTest2Config.zoomLevels.close ? priorityLives.slice(0, limit) : [];
  }, [allLives, cameraState.zoom, hoverId, priorityLives, selectedLive]);
  const previewCollection = useMemo(() => toCollection(previewLives, displayCoords), [displayCoords, previewLives]);

  const counts = useMemo(() => {
    return allLives.reduce(
      (acc, live) => {
        acc.total += 1;
        acc[live.family] += 1;
        if (live.featured) acc.featured += 1;
        return acc;
      },
      { total: 0, earth: 0, water: 0, air: 0, featured: 0 },
    );
  }, [allLives]);

  useEffect(() => {
    liveByIdRef.current = new Map(allLives.map((live) => [live.id, live]));
  }, [allLives]);

  const syncSources = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getSource(SOURCE_CLUSTER)?.setData(clusterCollection);
    map.getSource(SOURCE_PRIORITY)?.setData(priorityCollection);
    map.getSource(SOURCE_PREVIEW)?.setData(previewCollection);
    map.getSource(SOURCE_PARTICLES)?.setData(particleCollection);
  }, [clusterCollection, particleCollection, previewCollection, priorityCollection]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    hoverIdRef.current = hoverId;
  }, [hoverId, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncSources();
  }, [syncSources]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: globeTest2Config.styleUrl,
      center: globeTest2Config.initialCenter,
      zoom: globeTest2Config.initialZoom,
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
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const pause = () => {
      pauseUntilRef.current = Date.now() + 1800;
    };
    const updateCamera = () => {
      const center = map.getCenter();
      const next = { center: [center.lng, center.lat], zoom: map.getZoom() };
      cameraStateRef.current = next;
      setCameraState(next);
    };

    map.getCanvas().addEventListener('pointerdown', pause);
    map.getCanvas().addEventListener('wheel', pause, { passive: true });
    map.on('dragstart', pause);
    map.on('zoomstart', pause);
    map.on('moveend', updateCamera);
    map.on('zoomend', updateCamera);
    map.on('error', (event) => {
      const message = event?.error?.message ?? event?.message ?? '';
      if (!message || /tile|glyph|sprite|network|abort/i.test(message)) return;
      setMapError(message);
    });

    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' });
        brightenBaseGlobe(map);
        map.setPadding({ top: 0, bottom: 48, left: 0, right: 0 });

        map.addSource(SOURCE_CLUSTER, {
          type: 'geojson',
          data: clusterCollection,
          cluster: true,
          clusterRadius: 54,
          clusterMaxZoom: 5.35,
          clusterProperties: {
            landCount: ['+', ['case', ['==', ['get', 'family'], 'earth'], 1, 0]],
            waterCount: ['+', ['case', ['==', ['get', 'family'], 'water'], 1, 0]],
            airCount: ['+', ['case', ['==', ['get', 'family'], 'air'], 1, 0]],
            featuredCount: ['+', ['case', ['==', ['get', 'featured'], true], 1, 0]],
          },
        });
        map.addSource(SOURCE_PRIORITY, { type: 'geojson', data: priorityCollection });
        map.addSource(SOURCE_PREVIEW, { type: 'geojson', data: previewCollection });
        map.addSource(SOURCE_PARTICLES, { type: 'geojson', data: particleCollection });

        map.addLayer({
          id: 'vuvio-test2-cluster-halo',
          type: 'circle',
          source: SOURCE_CLUSTER,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ['case', ['>', ['get', 'featuredCount'], 0], globeTest2Config.colors.featured, clusterColorExpression()],
            'circle-radius': clusterHaloRadiusExpression(),
            'circle-blur': 0.9,
            'circle-opacity': clusterOpacityFactorByZoom(['case', ['>', ['get', 'featuredCount'], 0], 0.12, 0.075]),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-clusters',
          type: 'circle',
          source: SOURCE_CLUSTER,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': 'rgba(5, 15, 25, 0.42)',
            'circle-radius': clusterRadiusExpression(),
            'circle-opacity': clusterOpacityByZoom(),
            'circle-stroke-color': ['case', ['>', ['get', 'featuredCount'], 0], globeTest2Config.colors.featured, 'rgba(226,246,255,0.58)'],
            'circle-stroke-width': ['case', ['>', ['get', 'featuredCount'], 0], 1.05, 0.72],
            'circle-stroke-opacity': clusterOpacityFactorByZoom(['case', ['>', ['get', 'featuredCount'], 0], 0.56, 0.32]),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-cluster-core',
          type: 'circle',
          source: SOURCE_CLUSTER,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': clusterColorExpression(),
            'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 1, 1.15, 70, 1.7, 350, 2.2, 1200, 2.8],
            'circle-blur': 0.45,
            'circle-opacity': clusterOpacityFactorByZoom(0.42),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-cluster-count',
          type: 'symbol',
          source: SOURCE_CLUSTER,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': ['interpolate', ['linear'], ['get', 'point_count'], 1, 10, 350, 11.5, 1200, 13],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': 'rgba(248,255,255,0.88)',
            'text-opacity': clusterOpacityByZoom(),
            'text-halo-color': 'rgba(1,4,8,0.66)',
            'text-halo-width': 1,
          },
        });

        map.addLayer({
          id: 'vuvio-test2-low-points',
          type: 'circle',
          source: SOURCE_CLUSTER,
          minzoom: 5.05,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'familyColor'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 0.85, 7, 1.25, 9, 1.65],
            'circle-blur': 0.48,
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.18, 7, 0.34],
          },
        });
        map.addLayer({
          id: 'vuvio-test2-priority-aura',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          paint: {
            'circle-color': ['get', 'familyColor'],
            'circle-radius': pointAuraRadiusExpression(0, ''),
            'circle-blur': 0.86,
            'circle-opacity': pointOpacityFactorByZoom(pointAuraOpacityExpression(0, '')),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-featured-warmth',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          filter: ['==', ['get', 'featured'], true],
          paint: {
            'circle-color': globeTest2Config.colors.featured,
            'circle-radius': ['+', pointAuraRadiusExpression(0, ''), 2.4],
            'circle-blur': 0.92,
            'circle-opacity': pointOpacityFactorByZoom(0.055),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-particles',
          type: 'circle',
          source: SOURCE_PARTICLES,
          minzoom: 3.4,
          paint: {
            'circle-color': ['case', ['==', ['get', 'featured'], true], globeTest2Config.colors.featured, ['get', 'familyColor']],
            'circle-radius': particleRadiusExpression(0),
            'circle-blur': 0.34,
            'circle-opacity': particleOpacityByZoom(0),
          },
        });
        map.addLayer({
          id: 'vuvio-test2-priority-points',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          paint: {
            'circle-color': ['get', 'familyColor'],
            'circle-radius': pointCoreRadiusExpression(0, '', ''),
            'circle-opacity': pointOpacityByZoom(),
            'circle-stroke-color': 'rgba(248,255,255,0.78)',
            'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedIdRef.current], 0.62, 0.28],
            'circle-stroke-opacity': ['case', ['==', ['get', 'id'], selectedIdRef.current], 0.48, 0.18],
          },
        });
        map.addLayer({
          id: 'vuvio-test2-featured-ring',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          paint: {
            'circle-color': 'rgba(0,0,0,0)',
            'circle-radius': featuredRingRadiusExpression(0, ''),
            'circle-stroke-color': globeTest2Config.colors.featured,
            'circle-stroke-width': 0.72,
            'circle-stroke-opacity': featuredRingOpacityExpression(''),
            'circle-opacity': 0,
          },
        });
        map.addLayer({
          id: 'vuvio-test2-selection-ring',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          paint: {
            'circle-color': 'rgba(0,0,0,0)',
            'circle-radius': selectionRingRadiusExpression(0, '', ''),
            'circle-stroke-color': 'rgba(230,250,255,0.92)',
            'circle-stroke-width': 0.68,
            'circle-stroke-opacity': selectionRingOpacityExpression('', ''),
            'circle-opacity': 0,
          },
        });
        map.addLayer({
          id: 'vuvio-test2-hit',
          type: 'circle',
          source: SOURCE_PRIORITY,
          minzoom: 2.2,
          paint: {
            'circle-color': 'rgba(255,255,255,0.01)',
            'circle-radius': 24,
            'circle-opacity': 0.01,
          },
        });

        map.addLayer({
          id: 'vuvio-test2-preview-glow',
          type: 'circle',
          source: SOURCE_PREVIEW,
          minzoom: 5.6,
          paint: {
            'circle-color': ['get', 'familyColor'],
            'circle-radius': 10.5,
            'circle-blur': 0.68,
            'circle-opacity': 0.1,
          },
        });

        const selectFeature = (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const live = liveByIdRef.current.get(feature.properties.id);
          if (!live) return;
          if (!selectedIdRef.current) {
            const center = map.getCenter();
            previousViewRef.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
          }
          selectedIdRef.current = live.id;
          setSelectedId(live.id);
          setHoverId('');
          pauseUntilRef.current = Date.now() + 8500;
          map.easeTo({
            center: live.coordinates,
            zoom: Math.max(5.7, map.getZoom()),
            duration: 780,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
          });
        };

        map.on('click', 'vuvio-test2-hit', selectFeature);
        map.on('click', 'vuvio-test2-priority-points', selectFeature);
        map.on('click', 'vuvio-test2-clusters', (event) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (!feature || clusterId === undefined) return;
          const source = map.getSource(SOURCE_CLUSTER);
          if (!source) return;
          const zoomToCluster = (zoom) => {
            pauseUntilRef.current = Date.now() + 2800;
            setSelectedId('');
            map.easeTo({
              center: feature.geometry.coordinates,
              zoom: Math.min(zoom + 0.45, 6.4),
              duration: 760,
              easing: (t) => 1 - Math.pow(1 - t, 3),
              essential: true,
            });
          };
          try {
            const expansion = source.getClusterExpansionZoom(clusterId);
            if (typeof expansion?.then === 'function') {
              expansion.then(zoomToCluster).catch(() => {});
              return;
            }
          } catch {
            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (!error) zoomToCluster(zoom);
            });
            return;
          }
          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (!error) zoomToCluster(zoom);
          });
        });
        map.on('mouseenter', 'vuvio-test2-hit', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseenter', 'vuvio-test2-clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mousemove', 'vuvio-test2-hit', (event) => {
          setHoverId(event.features?.[0]?.properties?.id ?? '');
        });
        map.on('mouseleave', 'vuvio-test2-hit', () => {
          map.getCanvas().style.cursor = '';
          setHoverId('');
        });
        map.on('mouseleave', 'vuvio-test2-clusters', () => {
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
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    let lastRotationTime = performance.now();
    let lastPulseTime = 0;
    const initialCenter = map.getCenter();
    let lastLng = initialCenter.lng;
    let lastLat = initialCenter.lat;

    const tick = (time) => {
      if (time - lastPulseTime >= 82) {
        lastPulseTime = time;
        const clock = (time % 4200) / 4200;
        try {
          if (map.getLayer('vuvio-test2-priority-aura')) {
            map.setPaintProperty('vuvio-test2-priority-aura', 'circle-radius', pointAuraRadiusExpression(clock, selectedIdRef.current));
            map.setPaintProperty('vuvio-test2-priority-aura', 'circle-opacity', pointOpacityFactorByZoom(pointAuraOpacityExpression(clock, selectedIdRef.current)));
          }
          if (map.getLayer('vuvio-test2-featured-warmth')) {
            map.setPaintProperty('vuvio-test2-featured-warmth', 'circle-radius', ['+', pointAuraRadiusExpression(clock, selectedIdRef.current), 2.4]);
          }
          if (map.getLayer('vuvio-test2-particles')) {
            map.setPaintProperty('vuvio-test2-particles', 'circle-radius', particleRadiusExpression(clock));
            map.setPaintProperty('vuvio-test2-particles', 'circle-opacity', particleOpacityByZoom(clock));
          }
          if (map.getLayer('vuvio-test2-priority-points')) {
            map.setPaintProperty('vuvio-test2-priority-points', 'circle-radius', pointCoreRadiusExpression(clock, selectedIdRef.current, hoverIdRef.current));
            map.setPaintProperty('vuvio-test2-priority-points', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedIdRef.current], 0.62, 0.28]);
          }
          if (map.getLayer('vuvio-test2-featured-ring')) {
            map.setPaintProperty('vuvio-test2-featured-ring', 'circle-radius', featuredRingRadiusExpression(clock, selectedIdRef.current));
            map.setPaintProperty('vuvio-test2-featured-ring', 'circle-stroke-opacity', featuredRingOpacityExpression(selectedIdRef.current));
          }
          if (map.getLayer('vuvio-test2-selection-ring')) {
            map.setPaintProperty('vuvio-test2-selection-ring', 'circle-radius', selectionRingRadiusExpression(clock, selectedIdRef.current, hoverIdRef.current));
            map.setPaintProperty('vuvio-test2-selection-ring', 'circle-stroke-opacity', selectionRingOpacityExpression(selectedIdRef.current, hoverIdRef.current));
          }
        } catch {
          // Layers can disappear during unmount.
        }
      }

      if (document.visibilityState === 'hidden' || Date.now() <= pauseUntilRef.current || selectedIdRef.current) {
        lastRotationTime = time;
        const center = map.getCenter();
        lastLng = center.lng;
        lastLat = center.lat;
      } else {
        const elapsed = time - lastRotationTime;
        if (elapsed >= ROTATE_INTERVAL) {
          lastRotationTime = time;
          lastLng += (ROTATE_DEGREES_PER_SECOND * Math.min(elapsed, 50)) / 1000;
          map.jumpTo({ center: [lastLng, lastLat] });
        }
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const toggleFamily = (family) => {
    setSelectedId('');
    setActiveFilters((current) => ({
      ...current,
      families: { ...current.families, [family]: !current.families[family] },
    }));
  };

  const toggleFeatured = () => {
    setSelectedId('');
    setActiveFilters((current) => ({ ...current, featured: !current.featured }));
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedId('');
    setHoverId('');
    pauseUntilRef.current = Date.now() + 2200;
    map.easeTo({
      center: globeTest2Config.initialCenter,
      zoom: globeTest2Config.initialZoom,
      bearing: 0,
      pitch: 0,
      duration: 1350,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
  };

  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    pauseUntilRef.current = Date.now() + 1400;
    map.easeTo({
      zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)),
      duration: 620,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true,
    });
  };

  const closeSelectedLive = () => {
    const map = mapRef.current;
    const previousView = previousViewRef.current;
    selectedIdRef.current = '';
    previousViewRef.current = null;
    setSelectedId('');
    setHoverId('');
    pauseUntilRef.current = Date.now() + 1800;
    if (map && previousView) map.easeTo({ ...previousView, duration: 720, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
  };

  return (
    <section className="screen test-globe-screen test-globe-screen--maplibre test-globe-screen--actual globe-test2-screen" aria-label="Vuvio globe Test 2">
      <div className="test-old-globe">
        <div ref={containerRef} className="test-old-globe__canvas" />
        <div className="test-old-globe__vignette" />
        {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

        <div className="map-engine-switch globe-lab-switch globe-test2-switch" role="group" aria-label="Choose globe">
          <button type="button" onClick={() => navigate('/globe?switch=1')} aria-pressed="false">Current</button>
          <button type="button" onClick={() => navigate('/globe-lab?switch=1')} aria-pressed="false">Lab</button>
          <button type="button" onClick={() => navigate('/globe-cesium?switch=1')} aria-pressed="false">Cesium</button>
          <button type="button" onClick={() => navigate('/globe-test?switch=1')} aria-pressed="false">Test</button>
          <button type="button" className="is-active" aria-pressed="true">Test 2</button>
        </div>

        <div className="globe-test2-filterbar" role="group" aria-label="Filter lives">
          {Object.values(FAMILY_META).map((family) => (
            <button
              key={family.id}
              type="button"
              className={activeFilters.families[family.id] ? 'is-active' : ''}
              style={{ '--test2-family-color': family.color }}
              onClick={() => toggleFamily(family.id)}
              aria-pressed={activeFilters.families[family.id]}
            >
              <span />
              {family.label}
            </button>
          ))}
          <button
            type="button"
            className={`is-featured ${activeFilters.featured ? 'is-active' : ''}`}
            onClick={toggleFeatured}
            aria-pressed={activeFilters.featured}
          >
            <Star size={16} strokeWidth={1.9} />
            Featured
          </button>
        </div>

        <div className="globe-test2-density" aria-label="Demo density">
          <SlidersHorizontal size={15} strokeWidth={1.8} />
          <select value={density} onChange={(event) => setDensity(event.target.value)}>
            {globeTest2Config.densityOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label} · {option.count.toLocaleString('en-US')}</option>
            ))}
          </select>
        </div>

        <div className="test-old-globe__controls" aria-label="Map controls">
          <button type="button" onClick={() => zoomBy(0.72)} aria-label="Zoom in"><Plus size={19} /></button>
          <button type="button" onClick={() => zoomBy(-0.72)} aria-label="Zoom out"><Minus size={19} /></button>
          <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
        </div>

        {selectedLive ? selectedLiveCard(selectedLive, closeSelectedLive, navigate) : null}
      </div>
    </section>
  );
}
