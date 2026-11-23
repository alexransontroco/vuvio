import { LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { useNavigate, useSearchParams } from 'react-router-dom';

const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

const PARIS = [2.3522, 48.8566];
const MAP_MAX_ZOOM = 17;
const MAP_MIN_ZOOM = 2;
const MAP_HANDOFF_ZOOM = 6.2;        // Visually matches GLOBE_HANDOFF_ALTITUDE
const GLOBE_HANDOFF_ALTITUDE = 0.08;

/* ── Phases (navigation preset) ─────────────────────────────────────
 * Globe layer (react-globe.gl) uses `altitude`. Lower = closer.
 * Map layer (MapLibre) uses `zoom`. Higher = closer.
 * Phases A→C stay on the globe layer; D→F switch to the tiled map layer.
 */
const PHASES = [
  { key: 'A', label: 'Globe',      layer: 'globe', center: [10, 20],  altitude: 2.6, mapZoom: 2.5 },
  { key: 'B', label: 'Europe',     layer: 'globe', center: [8, 48],   altitude: 1.3, mapZoom: 3.6 },
  { key: 'C', label: 'France',     layer: 'globe', center: [2.5, 46.8], altitude: 0.75, mapZoom: 5.4 },
  { key: 'D', label: 'Paris',      layer: 'map',   center: PARIS,     altitude: 0.18, mapZoom: 11.2 },
  { key: 'E', label: 'Montmartre', layer: 'map',   center: [2.3433, 48.8867], altitude: 0.04, mapZoom: 14.6 },
  { key: 'F', label: 'Restaurant', layer: 'map',   center: [2.3390, 48.8847], altitude: 0.012, mapZoom: 17.2 },
];

const MOCK_LIVES = [
  { id: 'montmartre-bistro', name: 'Chef Camille', subcategory: 'Bistro cuisine', familyColor: '#28D8DF',
    city: 'Paris', country: 'France', viewers: '1,284', coordinates: [2.3390, 48.8847],
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Service du soir, Montmartre' },
  { id: 'sacre-coeur-painter', name: 'Jules Vernier', subcategory: 'Painting', familyColor: '#B47BFF',
    city: 'Paris', country: 'France', viewers: '412', coordinates: [2.3431, 48.8866],
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Peintre sur la butte' },
  { id: 'seine-boat', name: 'Marie Laurent', subcategory: 'River cruising', familyColor: '#5AB0FF',
    city: 'Paris', country: 'France', viewers: '832', coordinates: [2.3489, 48.8575],
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Croisière sur la Seine' },
  { id: 'ldn-skate', name: 'Nina K.', subcategory: 'Skateboarding', familyColor: '#28D8DF',
    city: 'London', country: 'UK', viewers: '218', coordinates: [-0.1276, 51.5074],
    image: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Southbank session' },
  { id: 'ber-club', name: 'DJ Felix', subcategory: 'Nightlife', familyColor: '#B47BFF',
    city: 'Berlin', country: 'Germany', viewers: '1,021', coordinates: [13.4050, 52.5200],
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Club Berghain warmup' },
  { id: 'nyc-streets', name: 'Alex T.', subcategory: 'Street photography', familyColor: '#28D8DF',
    city: 'New York', country: 'USA', viewers: '640', coordinates: [-74.006, 40.7128],
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=70&auto=format&fit=crop',
    experienceTitle: 'Brooklyn walk' },
];

function viewersNumber(stream) {
  if (!stream.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

function toFeature(stream) {
  return {
    type: 'Feature',
    properties: {
      id: stream.id,
      familyColor: stream.familyColor || '#28D8DF',
      viewersNumber: viewersNumber(stream),
    },
    geometry: { type: 'Point', coordinates: stream.coordinates },
  };
}

function buildCollection(streams) {
  return { type: 'FeatureCollection', features: streams.map(toFeature) };
}

function tweakDarkStyle(map) {
  try {
    map.setSky?.({
      'sky-color': '#0f1e33',
      'horizon-color': '#2d5a96',
      'fog-color': '#28D8DF',
      'sky-horizon-blend': 0.4,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.1,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 0.6, 10, 0],
    });
  } catch { /* older MapLibre */ }

  try {
    map.getStyle().layers?.forEach((layer) => {
      const id = layer.id.toLowerCase();
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#0f1e33');
      }
      if (layer.type === 'fill' && id.includes('water')) {
        map.setPaintProperty(layer.id, 'fill-color', '#1a3f6a');
      }
      if (layer.type === 'line' && id.includes('water')) {
        map.setPaintProperty(layer.id, 'line-color', '#3d7ea8');
      }
      if (layer.type === 'fill' && (id.includes('park') || id.includes('green') || id.includes('wood'))) {
        map.setPaintProperty(layer.id, 'fill-color', '#1e4a40');
      }
      if (layer.type === 'line' && (id.includes('road') || id.includes('street') || id.includes('highway'))) {
        map.setPaintProperty(layer.id, 'line-color', '#4d6a92');
        map.setPaintProperty(layer.id, 'line-opacity', 1);
      }
    });
  } catch { /* style shape varies */ }
}

/* ── Starfield canvas (shared, visible on globe layer only) ────────── */
function drawStars(canvas, ctx, time, altitude) {
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = w / 2;
  const cy = h / 2;
  const globeRadius = h / (0.93 * (altitude + 1));
  const halfDiag = Math.hypot(cx, cy);
  const showStars = globeRadius < halfDiag * 1.2;

  ctx.clearRect(0, 0, w, h);
  if (!showStars) return;

  const t = time * 0.001;
  const exclusion = globeRadius * 1.04;
  const starCount = Math.max(80, Math.floor((w * h) / 18000));

  for (let i = 0; i < starCount; i += 1) {
    const seed = i * 97.37;
    const x = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin((seed + 19.19) * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * w;
    const py = Math.abs(y) * h;
    if (Math.hypot(px - cx, py - cy) < exclusion) continue;
    const f1 = 0.18 + Math.abs(Math.sin(seed * 5.3)) * 0.55;
    const f2 = 0.52 + Math.abs(Math.sin(seed * 2.7)) * 0.9;
    const twinkle = 0.55 + Math.sin(t * f1 + seed * 1.3) * 0.22 + Math.sin(t * f2 + seed * 3.7) * 0.14;
    const size = 0.7 + Math.abs(Math.sin(seed * 0.17)) * 1.5;
    const opacity = Math.max(0.12, Math.min(1.0, twinkle));
    ctx.fillStyle = `rgba(220, 235, 255, ${opacity})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function GlobeTest5() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const shellRef = useRef(null);
  const globeRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const starCanvasRef = useRef(null);
  const starRafRef = useRef(null);
  const altitudeRef = useRef(PHASES[0].altitude);
  const fpsBufRef = useRef([]);
  const selectedIdRef = useRef(null);
  const layerRef = useRef('globe');
  const transitioningRef = useRef(false);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [layer, setLayer] = useState('globe'); // 'globe' | 'map'
  const [mapReady, setMapReady] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('A');
  const [selectedId, setSelectedId] = useState(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [diag, setDiag] = useState({ zoom: 0, tiles: 0, fps: 0, mem: 0 });

  /* Fire a brief dark-flash overlay that peaks exactly during the layer swap.
   * The human eye can't resolve detail behind a near-opaque flash, so the swap
   * feels invisible. Returns a promise that resolves when the flash is done.
   * Timeline: 0ms flash-in (260ms) → 260ms swap → 260ms flash-out → 520ms end. */
  const flashSwap = (doSwap) => {
    setIsFlashing(true);
    window.setTimeout(() => {
      doSwap();
      window.setTimeout(() => setIsFlashing(false), 60);
    }, 260);
  };

  const debugEnabled = searchParams.get('debug') === '1' || searchParams.get('debug') === 'true';

  const liveCollection = useMemo(() => buildCollection(MOCK_LIVES), []);
  const selectedLive = useMemo(() => MOCK_LIVES.find((s) => s.id === selectedId) ?? null, [selectedId]);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { layerRef.current = layer; }, [layer]);

  /* ── Measure container ─────────────────────────────────────────── */
  useLayoutEffect(() => {
    if (!shellRef.current) return undefined;
    const el = shellRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setDims({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  /* ── Globe layer: initial POV + onZoom tracking ───────────────── */
  useEffect(() => {
    if (!globeRef.current || dims.w === 0) return;
    const g = globeRef.current;
    const phase = PHASES[0];
    g.pointOfView({ lat: phase.center[1], lng: phase.center[0], altitude: phase.altitude }, 0);
    altitudeRef.current = phase.altitude;

    const controls = g.controls?.();
    if (controls) {
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.minDistance = 180;
      controls.maxDistance = 1200;
    }
  }, [dims.w]);

  /* ── Starfield RAF ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!starCanvasRef.current) return undefined;
    const canvas = starCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = dims.w * dpr;
      canvas.height = dims.h * dpr;
      canvas.style.width = `${dims.w}px`;
      canvas.style.height = `${dims.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const tick = (time) => {
      drawStars(canvas, ctx, time, altitudeRef.current);
      starRafRef.current = requestAnimationFrame(tick);
    };
    starRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (starRafRef.current) cancelAnimationFrame(starRafRef.current);
    };
  }, [dims.w, dims.h]);

  /* ── Map layer: lazy init, only when first switched to ───────── */
  const ensureMap = () => {
    if (mapRef.current || !mapContainerRef.current) return mapRef.current;
    const loadStart = performance.now();
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_STYLE_URL,
      center: PARIS,
      zoom: MAP_MIN_ZOOM,
      pitch: 0,
      bearing: 0,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      maxPitch: 0,
      pitchWithRotate: false,
      dragRotate: false,
      projection: { type: 'mercator' },
      attributionControl: false,
      renderWorldCopies: false,
      fadeDuration: 180,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();

    map.on('load', () => {
      tweakDarkStyle(map);
      map.addSource('vuvio-lives', { type: 'geojson', data: liveCollection });

      map.addLayer({
        id: 'vuvio-lives-glow',
        type: 'circle',
        source: 'vuvio-lives',
        paint: {
          'circle-color': ['get', 'familyColor'],
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 10, 1500, 22],
            8, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 22, 1500, 44],
            16, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 38, 1500, 74],
          ],
          'circle-blur': 1.1,
          'circle-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'vuvio-lives-core',
        type: 'circle',
        source: 'vuvio-lives',
        paint: {
          'circle-color': ['get', 'familyColor'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.9,
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 4, 1500, 8],
            10, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 7, 1500, 13],
            16, ['interpolate', ['linear'], ['get', 'viewersNumber'], 0, 11, 1500, 20],
          ],
        },
      });

      map.on('click', 'vuvio-lives-core', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        setSelectedId(feature.properties.id);
        map.easeTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 15.5),
          duration: 900,
          pitch: 0,
          essential: true,
        });
      });
      map.on('mouseenter', 'vuvio-lives-core', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'vuvio-lives-core', () => { map.getCanvas().style.cursor = ''; });

      // Auto-swap back to globe when user zooms out below the handoff zoom.
      // Guarded by layerRef (only when on map) and transitioningRef (no re-trigger during swap).
      map.on('zoom', () => {
        if (layerRef.current !== 'map') return;
        if (transitioningRef.current) return;
        const z = map.getZoom();
        if (z >= MAP_HANDOFF_ZOOM) return;

        transitioningRef.current = true;
        const center = map.getCenter();

        // Pre-position globe at handoff altitude (scale match) so crossfade is seamless
        globeRef.current?.pointOfView(
          { lat: center.lat, lng: center.lng, altitude: GLOBE_HANDOFF_ALTITUDE },
          0,
        );
        altitudeRef.current = GLOBE_HANDOFF_ALTITUDE;
        setSelectedId(null);

        // Flash masks the swap; then continue zoom-out on globe
        flashSwap(() => {
          setLayer('globe');
          window.setTimeout(() => {
            globeRef.current?.pointOfView(
              { lat: center.lat, lng: center.lng, altitude: 0.75 },
              1100,
            );
            altitudeRef.current = 0.75;
            transitioningRef.current = false;
          }, 60);
        });
      });

      setDiag((d) => ({ ...d, loadMs: Math.round(performance.now() - loadStart) }));
      setMapReady(true);
    });

    return map;
  };

  /* ── Diagnostic HUD ───────────────────────────────────────────── */
  useEffect(() => {
    if (!debugEnabled) return undefined;
    let raf = 0;
    const tick = (time) => {
      fpsBufRef.current.push(time);
      if (fpsBufRef.current.length > 60) fpsBufRef.current.shift();
      const samples = fpsBufRef.current;
      const fps = samples.length > 1
        ? Math.round((samples.length - 1) * 1000 / (samples[samples.length - 1] - samples[0]))
        : 0;
      const map = mapRef.current;
      let zoom = 0;
      let tiles = 0;
      if (map && layer === 'map') {
        zoom = map.getZoom();
        try {
          const srcs = map.getStyle()?.sources ? Object.keys(map.getStyle().sources) : [];
          srcs.forEach((srcId) => {
            const src = map.getSource(srcId);
            if (src?._tiles) tiles += Object.keys(src._tiles).length;
          });
        } catch { /* best-effort */ }
      } else {
        zoom = altitudeRef.current;
      }
      const mem = performance.memory?.usedJSHeapSize
        ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0;
      setDiag((d) => ({ ...d, zoom, tiles, fps, mem }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [debugEnabled, layer]);

  /* ── Phase navigation ─────────────────────────────────────────── */
  /* Seamless-zoom pattern:
   * globe→map: 1) zoom globe all the way down to altitude 0.08 (~city scale)
   *            2) pre-set map at matching apparent zoom (MAP_HANDOFF_ZOOM)
   *            3) at handoff moment, swap layers (fade is very short)
   *            4) map continues easeTo final phase zoom → feels like one zoom
   * map→globe: 1) map eases out toward handoff zoom
   *            2) at handoff, swap layers
   *            3) globe continues pointOfView to target altitude
   */
  const flyToPhase = (phaseKey) => {
    const phase = PHASES.find((p) => p.key === phaseKey);
    if (!phase) return;
    setCurrentPhase(phase.key);
    setSelectedId(null);

    if (phase.layer === 'globe' && layer === 'globe') {
      // Pure globe navigation
      globeRef.current?.pointOfView(
        { lat: phase.center[1], lng: phase.center[0], altitude: phase.altitude },
        1400,
      );
      altitudeRef.current = phase.altitude;
      return;
    }

    if (phase.layer === 'map' && layer === 'map') {
      // Pure map navigation
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({
        center: phase.center,
        zoom: phase.mapZoom,
        duration: 1200,
        essential: true,
      });
      return;
    }

    if (phase.layer === 'map' && layer === 'globe') {
      // ─── DIVE: globe → map ──────────────────────────────────────
      // Overlap: globe keeps zooming while map fades in and continues the zoom.
      // Crossfade = 650ms (CSS). We start the layer swap at 400ms so both layers
      // are visible together from 400–1050ms, hiding the texture/model boundary.
      const map = ensureMap();
      globeRef.current?.pointOfView(
        { lat: phase.center[1], lng: phase.center[0], altitude: GLOBE_HANDOFF_ALTITUDE },
        1100,
      );
      altitudeRef.current = GLOBE_HANDOFF_ALTITUDE;

      const prepareMap = () => {
        // Pre-position map at handoff zoom so when it fades in, scale already matches
        map.jumpTo({ center: phase.center, zoom: MAP_HANDOFF_ZOOM });
      };
      if (map.loaded()) prepareMap();
      else map.once('load', prepareMap);

      // Swap at 400ms — flash overlay masks the moment of the layer swap
      window.setTimeout(() => {
        flashSwap(() => {
          setLayer('map');
          const m = mapRef.current;
          if (!m) return;
          const continueZoom = () => {
            m.easeTo({
              center: phase.center,
              zoom: phase.mapZoom,
              duration: 1300,
              essential: true,
            });
          };
          if (m.loaded()) continueZoom();
          else m.once('load', continueZoom);
        });
      }, 400);
      return;
    }

    if (phase.layer === 'globe' && layer === 'map') {
      // ─── RISE: map → globe ─────────────────────────────────────
      // Block the auto zoom-out listener while we drive this transition
      transitioningRef.current = true;
      const map = mapRef.current;
      if (map) {
        map.easeTo({
          center: phase.center,
          zoom: MAP_HANDOFF_ZOOM,
          duration: 1100,
          essential: true,
        });
      }

      // Pre-position globe at handoff altitude so when it fades in, scale matches
      globeRef.current?.pointOfView(
        { lat: phase.center[1], lng: phase.center[0], altitude: GLOBE_HANDOFF_ALTITUDE },
        0,
      );
      altitudeRef.current = GLOBE_HANDOFF_ALTITUDE;

      // Swap at 400ms — flash overlay masks the moment of the layer swap
      window.setTimeout(() => {
        flashSwap(() => {
          setLayer('globe');
          globeRef.current?.pointOfView(
            { lat: phase.center[1], lng: phase.center[0], altitude: phase.altitude },
            1300,
          );
          altitudeRef.current = phase.altitude;
          window.setTimeout(() => { transitioningRef.current = false; }, 1400);
        });
      }, 400);
    }
  };

  const recenter = () => flyToPhase('A');

  /* ── Globe layer: zoom buttons ─────────────────────────────────── */
  const zoomGlobe = (direction) => {
    const g = globeRef.current;
    if (!g) return;
    const pov = g.pointOfView();
    const factor = direction === 'in' ? 0.6 : 1.7;
    const altitude = Math.max(0.08, Math.min(2.8, (pov.altitude ?? 1.5) * factor));
    g.pointOfView({ ...pov, altitude }, 500);
    altitudeRef.current = altitude;
  };

  /* ── Map layer: zoom buttons ────────────────────────────────── */
  const zoomMap = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      zoom: Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, map.getZoom() + delta)),
      duration: 450,
      essential: true,
    });
  };

  /* ── Keyboard shortcuts ───────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F' }[e.key];
      if (idx) flyToPhase(idx);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [layer]);

  /* ── Globe HTML marker element factory ────────────────────────── */
  /* Same visual as prod /globe (GlobeTest2): avatar bubble + stem + anchored dot */
  const makeGlobeMarker = (d) => {
    const el = document.createElement('div');
    el.className = 'gt2-marker gt2-marker--avatar';
    el.dataset.streamId = d.id;
    el.style.setProperty('--marker-color', d.familyColor || '#28d8df');
    const imgSrc = d.image || '';
    el.innerHTML = imgSrc
      ? `<div class="gt2-marker__bubble"><img src="${imgSrc}" alt="" loading="lazy" /></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`
      : `<div class="gt2-marker__bubble"><span class="gt2-marker__initial">${(d.name || '?')[0].toUpperCase()}</span></div><div class="gt2-marker__stem"></div><div class="gt2-marker__dot"></div>`;
    el.addEventListener('click', () => {
      const INTERMEDIATE_ALTITUDE = 0.4;
      const alreadySelected = selectedIdRef.current === d.id;

      if (!alreadySelected) {
        // ── First click: zoom in on the globe only, stay on the globe layer ──
        setSelectedId(d.id);
        globeRef.current?.pointOfView(
          { lat: d.coordinates[1], lng: d.coordinates[0], altitude: INTERMEDIATE_ALTITUDE },
          1000,
        );
        altitudeRef.current = INTERMEDIATE_ALTITUDE;
        return;
      }

      // ── Second click (same marker already selected): dive into the map layer ──
      const map = ensureMap();
      globeRef.current?.pointOfView(
        { lat: d.coordinates[1], lng: d.coordinates[0], altitude: GLOBE_HANDOFF_ALTITUDE },
        1100,
      );
      altitudeRef.current = GLOBE_HANDOFF_ALTITUDE;

      const prepare = () => {
        map.jumpTo({ center: d.coordinates, zoom: MAP_HANDOFF_ZOOM });
      };
      if (map.loaded()) prepare(); else map.once('load', prepare);

      window.setTimeout(() => {
        flashSwap(() => {
          setLayer('map');
          const m = mapRef.current;
          if (!m) return;
          const go = () => {
            m.easeTo({ center: d.coordinates, zoom: 15.8, duration: 1200, essential: true });
          };
          if (m.loaded()) go(); else m.once('load', go);
        });
      }, 400);
    });
    return el;
  };

  /* ── Cleanup map on unmount ───────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const showGlobe = layer === 'globe';
  const showMap = layer === 'map';

  return (
    <section className="globe5-screen" aria-label="Globe Test 5 — Paris Montmartre">
      <div ref={shellRef} className="globe5">
        {/* Shared starfield */}
        <canvas
          ref={starCanvasRef}
          className="globe5__stars"
          style={{ opacity: showGlobe ? 1 : 0 }}
          aria-hidden="true"
        />

        {/* Globe layer (react-globe.gl) */}
        <div
          className={`globe5__layer globe5__layer--globe${showGlobe ? ' is-visible' : ''}`}
          style={{ pointerEvents: showGlobe ? 'auto' : 'none' }}
        >
          {dims.w > 0 && dims.h > 0 && (
            <Globe
              ref={globeRef}
              width={dims.w}
              height={dims.h}
              animateIn={false}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="/assets/globe/earth-night-threeglobe-4k.jpg"
              showAtmosphere={true}
              atmosphereColor="#5aa8ff"
              atmosphereAltitude={0.22}
              showGraticules={false}
              htmlElementsData={MOCK_LIVES}
              htmlAltitude={0.01}
              htmlLat={(d) => d.coordinates[1]}
              htmlLng={(d) => d.coordinates[0]}
              htmlElement={makeGlobeMarker}
              rendererConfig={{ antialias: true, powerPreference: 'high-performance' }}
              onGlobeReady={() => {
                const g = globeRef.current;
                if (!g) return;
                const scene = g.scene?.();
                if (!scene) return;
                scene.traverse((obj) => {
                  if (obj.isAmbientLight) obj.intensity = 6.5;
                  if (obj.isDirectionalLight) obj.intensity = 3.2;
                });
              }}
            />
          )}
        </div>

        {/* Map layer (MapLibre) */}
        <div
          ref={mapContainerRef}
          className={`globe5__layer globe5__layer--map${showMap ? ' is-visible' : ''}${mapReady ? ' is-ready' : ''}`}
          style={{ pointerEvents: showMap ? 'auto' : 'none' }}
        />

        {/* Dark flash overlay — masks the layer swap moment */}
        <div
          className={`globe5__flash${isFlashing ? ' is-active' : ''}`}
          aria-hidden="true"
        />

        {/* Phase pills */}
        <div className="globe5__phases" aria-label="Zoom phases">
          {PHASES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`globe5__phase${currentPhase === p.key ? ' is-active' : ''}`}
              onClick={() => flyToPhase(p.key)}
            >
              <span className="globe5__phase-key">{p.key}</span>
              <span className="globe5__phase-label">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Controls — same style as prod /globe */}
        <div className="test-old-globe__controls" aria-label="Map controls">
          {showGlobe ? (
            <>
              <button type="button" onClick={() => zoomGlobe('in')} aria-label="Zoom in"><Plus size={19} /></button>
              <button type="button" onClick={() => zoomGlobe('out')} aria-label="Zoom out"><Minus size={19} /></button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => zoomMap(1)} aria-label="Zoom in"><Plus size={19} /></button>
              <button type="button" onClick={() => zoomMap(-1)} aria-label="Zoom out"><Minus size={19} /></button>
            </>
          )}
          <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
        </div>

        <div className="globe5__hint">
          <strong>Globe Test 5 — hybride</strong>
          <span>A/B/C = globe · D/E/F = carte haute résolution · 1→6 au clavier</span>
        </div>

        {debugEnabled && (
          <div className="globe5__diag" role="status">
            <div>Layer <b>{layer}</b></div>
            <div>FPS <b>{diag.fps}</b></div>
            <div>{layer === 'globe' ? 'Alt' : 'Zoom'} <b>{diag.zoom.toFixed(2)}</b></div>
            {layer === 'map' && <div>Tiles <b>{diag.tiles}</b></div>}
            {diag.mem > 0 && <div>Heap <b>{diag.mem}MB</b></div>}
          </div>
        )}

        {selectedLive ? (
          <aside className="test-globe-card" aria-label={`Live from ${selectedLive.name}`} style={{ zIndex: 20 }}>
            <button type="button" className="test-globe-card__close" onClick={() => setSelectedId(null)} aria-label="Close">
              <X size={14} strokeWidth={2} />
            </button>
            <img src={selectedLive.image} alt="" loading="lazy" />
            <div className="test-globe-card__body">
              <div className="test-globe-card__info">
                <span className="test-globe-card__tag" style={{ '--experience-color': selectedLive.familyColor }}>
                  <i />{selectedLive.subcategory}
                </span>
                <h2>{selectedLive.experienceTitle}</h2>
                <p>{selectedLive.name} · {selectedLive.city}, {selectedLive.country}</p>
                <strong>{selectedLive.viewers} viewers</strong>
              </div>
              <div className="test-globe-card__actions">
                <button
                  type="button"
                  className="test-globe-card__watch"
                  onClick={() => navigate(`/watch?live=${encodeURIComponent(selectedLive.id)}`)}
                >
                  <Play size={13} fill="currentColor" strokeWidth={1.8} />Watch
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
