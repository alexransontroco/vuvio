import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed } from 'lucide-react';

const INITIAL_CENTER = [22, 18];
const GLOBE_ZOOM = 1.28;
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const AUTO_ROTATE_DEGREES_PER_SECOND = 1.45; // Slow, contemplative auto-rotation.
const TERRAIN_SOURCE_ID = 'vuvio-terrain';
const LIVE_COLOR = '#2BD9C8';
const UPCOMING_COLOR = '#3B82E6';
const MIXED_CLUSTER_COLOR = '#24C6F0';

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
  return Number.parseInt(stream.viewers.replace(/\D/g, ''), 10) || 0;
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

function focusStream(map, coordinates) {
  if (!coordinates) return;
  map.setProjection({ type: 'globe' });
  map.easeTo({ center: coordinates, zoom: 1.35, duration: 520, essential: true });
  window.setTimeout(() => {
    map.easeTo({ center: coordinates, zoom: 3.2, duration: 680, essential: true });
  }, 460);
  window.setTimeout(() => {
    map.setProjection({ type: 'globe' });
    map.easeTo({ center: coordinates, zoom: 5.05, duration: 820, essential: true });
  }, 1060);
}

export default function LiveMap({ streams, activeStatuses = ['live'], selectedId, onSelect, resetSignal = 0 }) {
  const containerRef = useRef(null);
  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const burstTimeoutRef = useRef(null);

  const visibleStreams = useMemo(() => {
    return streams.filter((stream) => activeStatuses.includes(stream.status));
  }, [streams, activeStatuses]);

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

      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        });
        map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.45 });
        map.addLayer(
          {
            id: 'vuvio-hillshade',
            type: 'hillshade',
            source: TERRAIN_SOURCE_ID,
            paint: {
              'hillshade-shadow-color': '#02070D',
              'hillshade-highlight-color': '#1B4B63',
              'hillshade-accent-color': '#0E2738',
              'hillshade-illumination-direction': 320,
              'hillshade-exaggeration': 0.36,
            },
          },
        );
      }

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

      map.addLayer({
        id: 'vuvio-city-light-aura',
        type: 'circle',
        source: 'vuvio-city-lights',
        paint: {
          'circle-color': '#F5A85B',
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 4, 1, 16],
          'circle-blur': 1,
          'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.02, 1, 0.12],
        },
      });

      map.addLayer({
        id: 'vuvio-city-light-glow',
        type: 'circle',
        source: 'vuvio-city-lights',
        paint: {
          'circle-color': '#E8B45B',
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 1.8, 1, 7],
          'circle-blur': 0.9,
          'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.05, 1, 0.22],
        },
      });

      map.addLayer({
        id: 'vuvio-city-light-points',
        type: 'circle',
        source: 'vuvio-city-lights',
        paint: {
          'circle-color': '#FFD48A',
          'circle-radius': [
            'case',
            ['==', ['get', 'core'], 1],
            ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.75, 1, 1.35],
            ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.28, 1, 0.72],
          ],
          'circle-blur': 0.2,
          'circle-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0.12, 0.12, 1, 0.58],
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
          'circle-color': statusColor,
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
          'circle-color': statusColor,
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            9,
            ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 5, 300, 6.5, 800, 8],
          ],
          'circle-stroke-color': ['case', ['==', ['get', 'id'], selectedId ?? ''], '#F2F7F6', 'rgba(43,217,200,0.38)'],
          'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 6],
          'circle-opacity': 0.96,
        },
      });

      map.addLayer({
        id: 'vuvio-live-particles',
        type: 'circle',
        source: 'vuvio-particles',
        paint: {
          'circle-color': statusColor,
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

      const selectedStream = visibleStreams.find((stream) => stream.id === selectedId);
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

    const tick = (time) => {
      const delta = Math.min(80, time - previousTime);
      previousTime = time;
      const pulseClock = (time % 2800) / 2800;

      if (map.getLayer('vuvio-live-pulse')) {
        map.setPaintProperty('vuvio-live-pulse', 'circle-radius', livePulseRadius(pulseClock));
        map.setPaintProperty('vuvio-live-pulse', 'circle-opacity', livePulseOpacity(pulseClock));
      }

      if (map.getLayer('vuvio-live-points')) {
        map.setPaintProperty('vuvio-live-points', 'circle-radius', livePointRadius(pulseClock, selectedId ?? ''));
      }

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
      'rgba(43,217,200,0.38)',
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
      <div className="live-map__controls" aria-label="Contrôles carte">
        <button type="button" onClick={recenter} aria-label="Recentrer">
          <LocateFixed size={19} />
        </button>
      </div>
    </div>
  );
}
