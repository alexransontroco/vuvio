import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed } from 'lucide-react';
import { enrichExperience } from '../../data/experienceTaxonomy.js';

const INITIAL_CENTER = [22, 18];
const GLOBE_ZOOM = 1.28;
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const AUTO_ROTATE_DEGREES_PER_SECOND = 1.95; // Faster, more engaging rotation
const TERRAIN_SOURCE_ID = 'vuvio-terrain';
const LIVE_COLOR = '#2BD9C8';
const UPCOMING_COLOR = '#3B82E6';
const MIXED_CLUSTER_COLOR = '#24C6F0';

// Minimal city lights - only major cities for performance
const cityLights = [
  [-0.1276, 51.5072, 0.95],  // London
  [2.3522, 48.8566, 1],      // Paris
  [37.6173, 55.7558, 0.86],  // Moscow
  [72.8777, 19.076, 0.92],   // Mumbai
  [121.4737, 31.2304, 1],    // Shanghai
  [139.6917, 35.6895, 1],    // Tokyo
  [-74.006, 40.7128, 1],     // New York
  [-118.2437, 34.0522, 0.92],// Los Angeles
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

function toFeature(stream) {
  return {
    type: 'Feature',
    properties: {
      id: stream.id,
      status: stream.status,
      name: stream.name,
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

function livePulseWave(clock) {
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

function livePulseRadius(clock) {
  const wave = livePulseWave(clock);

  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 14, 300, 20, 800, 28],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 3.5, 300, 5, 800, 6.5]],
  ];
}

function livePulseOpacity(clock) {
  const wave = livePulseWave(clock);

  return [
    '+',
    ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.12, 300, 0.2, 800, 0.28],
    ['*', wave, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 0.08, 300, 0.1, 800, 0.12]],
  ];
}

function livePointRadius(clock, selectedId = '') {
  const wave = livePulseWave(clock);

  return [
    'case',
    ['==', ['get', 'id'], selectedId],
    ['+', 9, ['*', wave, 0.85]],
    ['+', ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5, 300, 6.5, 800, 8], ['*', wave, 0.9]],
  ];
}

function buildCollection(streams) {
  return {
    type: 'FeatureCollection',
    features: streams.map(toFeature),
  };
}

function buildParticleCollection(streams) {
  const features = streams.flatMap((stream) => {
    const viewers = viewersNumber(stream);
    if (viewers < 300) return [];
    const offsets = [
      [0.32, 0.12],
      [-0.26, 0.18],
      [0.18, -0.22],
      [-0.16, -0.18],
    ];
    return offsets.map(([lngOffset, latOffset], index) => ({
      type: 'Feature',
      properties: {
        id: `${stream.id}-particle-${index}`,
        status: stream.status,
        family: stream.family,
        familyColor: stream.familyColor,
      },
      geometry: {
        type: 'Point',
        coordinates: [stream.coordinates[0] + lngOffset, stream.coordinates[1] + latOffset],
      },
    }));
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

function buildCityLightCollection() {
  // Reduced from 9 to 5 offsets per city for performance
  const offsets = [
    [0, 0, 1],
    [0.34, 0.12, 0.58],
    [-0.3, 0.18, 0.46],
    [0.16, -0.26, 0.4],
    [-0.18, -0.16, 0.32],
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

function focusStream(map, coordinates) {
  if (!coordinates) return;
  map.stop();
  map.setProjection({ type: 'globe' });
  map.easeTo({
    center: coordinates,
    zoom: 5.15,
    bearing: 0,
    pitch: 0,
    duration: 1350,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    essential: true,
  });
}

export default function LiveMap({
  streams,
  activeStatuses = ['live'],
  activeFamily = 'all',
  activeSubcategory = 'all',
  selectedId,
  focusId,
  onSelect,
  resetSignal = 0,
}) {
  const containerRef = useRef(null);
  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const burstTimeoutRef = useRef(null);

  const visibleStreams = useMemo(() => {
    return streams
      .map(enrichExperience)
      .filter((stream) => activeStatuses.includes(stream.status))
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .filter((stream) => activeSubcategory === 'all' || stream.subcategory === activeSubcategory);
  }, [activeFamily, activeStatuses, activeSubcategory, streams]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: GLOBE_ZOOM,
      minZoom: 0,
      maxZoom: 9,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
    });

    mapRef.current = map;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const pauseAutoRotation = () => {
      pauseUntilRef.current = Date.now() + 1800;
    };

    map.getCanvas().addEventListener('pointerdown', pauseAutoRotation);
    map.getCanvas().addEventListener('wheel', pauseAutoRotation, { passive: true });
    map.on('dragstart', pauseAutoRotation);
    map.on('zoomstart', pauseAutoRotation);
    map.on('zoomend', () => {
      if (map.getZoom() <= 2.05 && map.getProjection?.().type !== 'globe') {
        map.setProjection({ type: 'globe' });
      }
    });

    map.on('error', () => {
      // Tile, glyph or terrain requests can fail transiently while the WebGL globe remains usable.
    });
    map.on('load', () => {
      map.setProjection({ type: 'globe' });
      // Terrain disabled for performance - it's very costly on globe
      // Re-enable if needed: map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.45 });

      map.addSource('vuvio-lives', {
        type: 'geojson',
        data: buildCollection(visibleStreams),
        cluster: true,
        clusterMaxZoom: 5,
        clusterRadius: 46,
        clusterProperties: {
          liveCount: ['+', ['case', ['==', ['get', 'status'], 'live'], 1, 0]],
          upcomingCount: ['+', ['case', ['==', ['get', 'status'], 'upcoming'], 1, 0]],
        },
      });
      map.addSource('vuvio-particles', {
        type: 'geojson',
        data: buildParticleCollection(visibleStreams),
      });
      map.addSource('vuvio-city-lights', {
        type: 'geojson',
        data: buildCityLightCollection(),
      });

      // Optimized: Single layer instead of 3 separate layers for city lights
      map.addLayer({
        id: 'vuvio-city-light-glow',
        type: 'circle',
        source: 'vuvio-city-lights',
        paint: {
          'circle-color': '#FFD48A',
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 3.5, 1, 9],
          'circle-blur': 0.8,
          'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.06, 1, 0.28],
        },
      });

      map.addLayer({
        id: 'vuvio-clusters',
        type: 'circle',
        source: 'vuvio-lives',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': clusterColor,
          'circle-opacity': 0.05,
          'circle-stroke-color': clusterColor,
          'circle-stroke-opacity': 0.86,
          'circle-stroke-width': 1.8,
          'circle-radius': ['step', ['get', 'point_count'], 18, 3, 23, 6, 29],
        },
      });

      map.addLayer({
        id: 'vuvio-cluster-glow',
        type: 'circle',
        source: 'vuvio-lives',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': clusterColor,
          'circle-radius': ['step', ['get', 'point_count'], 30, 3, 40, 6, 52],
          'circle-blur': 0.95,
          'circle-opacity': 0.16,
        },
      });

      map.addLayer({
        id: 'vuvio-cluster-count',
        type: 'symbol',
        source: 'vuvio-lives',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Open Sans Bold'],
        },
        paint: {
          'text-color': clusterColor,
        },
      });

      map.addLayer({
        id: 'vuvio-live-pulse',
        type: 'circle',
        source: 'vuvio-lives',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': categoryColor,
          'circle-radius': livePulseRadius(0),
          'circle-blur': 0.65,
          'circle-opacity': livePulseOpacity(0),
        },
      });

      map.addLayer({
        id: 'vuvio-live-points',
        type: 'circle',
        source: 'vuvio-lives',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': categoryColor,
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            9,
            ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5, 300, 6.5, 800, 8],
          ],
          'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', categoryColor],
          'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 6],
          'circle-opacity': 0.96,
        },
      });

      map.addLayer({
        id: 'vuvio-live-particles',
        type: 'circle',
        source: 'vuvio-particles',
        paint: {
          'circle-color': categoryColor,
          'circle-radius': 2.2,
          'circle-blur': 0.25,
          'circle-opacity': 0.62,
        },
      });

      map.on('click', 'vuvio-live-points', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        onSelect(feature.properties.id);
        pauseUntilRef.current = Date.now() + 6000;
        focusStream(map, feature.geometry.coordinates);
      });

      map.on('click', 'vuvio-clusters', async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const source = map.getSource('vuvio-lives');
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        rootRef.current?.classList.add('is-bursting');
        if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
        pauseUntilRef.current = Date.now() + 2200;
        map.easeTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(zoom + 0.35, map.getZoom() + 1.15),
          duration: 920,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
        burstTimeoutRef.current = window.setTimeout(() => {
          rootRef.current?.classList.remove('is-bursting');
        }, 980);
      });

      map.on('mouseenter', 'vuvio-live-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'vuvio-live-points', () => {
        map.getCanvas().style.cursor = '';
      });

      const selectedStream = visibleStreams.find((stream) => stream.id === (focusId ?? selectedId));
      if (selectedStream) {
        pauseUntilRef.current = Date.now() + 6000;
        focusStream(map, selectedStream.coordinates);
      }
    });

    return () => {
      map.getCanvas().removeEventListener('pointerdown', pauseAutoRotation);
      map.getCanvas().removeEventListener('wheel', pauseAutoRotation);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let previousTime = performance.now();
    let lastPaintTime = 0;
    const PAINT_INTERVAL = 50; // 20fps for paint updates (not 60fps)

    const tick = (time) => {
      const delta = Math.min(80, time - previousTime);
      previousTime = time;
      const pulseClock = (time % 2800) / 2800;

      // Throttle paint updates to 20fps
      if (time - lastPaintTime >= PAINT_INTERVAL) {
        lastPaintTime = time;

        if (map.getLayer('vuvio-live-pulse')) {
          map.setPaintProperty('vuvio-live-pulse', 'circle-radius', livePulseRadius(pulseClock));
          map.setPaintProperty('vuvio-live-pulse', 'circle-opacity', livePulseOpacity(pulseClock));
        }

        if (map.getLayer('vuvio-live-points')) {
          map.setPaintProperty('vuvio-live-points', 'circle-radius', livePointRadius(pulseClock, selectedId ?? ''));
        }
      }

      // Auto-rotation runs cheaper (every tick but optimized)
      if (Date.now() > pauseUntilRef.current && !selectedId) {
        const center = map.getCenter();
        map.jumpTo({
          center: [center.lng + (AUTO_ROTATE_DEGREES_PER_SECOND * delta) / 1000, center.lat],
        });
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
    const source = map?.getSource('vuvio-lives');
    if (!source) return;
    source.setData(buildCollection(visibleStreams));
    map.getSource('vuvio-particles')?.setData(buildParticleCollection(visibleStreams));
  }, [visibleStreams]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer('vuvio-live-points')) return;
    map.setPaintProperty('vuvio-live-points', 'circle-radius', ['case', ['==', ['get', 'id'], selectedId ?? ''], 9, 7]);
    map.setPaintProperty('vuvio-live-points', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      '#F2F7F6',
      categoryColor,
    ]);
    map.setPaintProperty('vuvio-live-points', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 6]);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    if (!map?.loaded()) return;
    const selectedStream = visibleStreams.find((stream) => stream.id === selectedId);
    if (!selectedStream) return;
    pauseUntilRef.current = Date.now() + 6000;
    focusStream(map, selectedStream.coordinates);
  }, [selectedId, visibleStreams]);

  useEffect(() => {
    if (!focusId) return;
    const map = mapRef.current;
    if (!map?.loaded()) return;
    const focusedStream = visibleStreams.find((stream) => stream.id === focusId);
    if (!focusedStream) return;
    pauseUntilRef.current = Date.now() + 7000;
    focusStream(map, focusedStream.coordinates);
  }, [focusId, visibleStreams]);

  const recenter = () => {
    mapRef.current?.setProjection({ type: 'globe' });
    mapRef.current?.easeTo({
      center: INITIAL_CENTER,
      zoom: GLOBE_ZOOM,
      bearing: 0,
      pitch: 0,
      duration: 620,
      essential: true,
    });
    pauseUntilRef.current = Date.now() + 1200;
  };

  useEffect(() => {
    if (!resetSignal) return;
    recenter();
  }, [resetSignal]);

  return (
    <div ref={rootRef} className="live-map live-map--globe">
      <div ref={containerRef} className="live-map__canvas" />
      <div className="live-map__vignette" />
      <div className="live-map__controls" aria-label="Map controls">
        <button type="button" onClick={recenter} aria-label="Recenter">
          <LocateFixed size={19} />
        </button>
      </div>
    </div>
  );
}
