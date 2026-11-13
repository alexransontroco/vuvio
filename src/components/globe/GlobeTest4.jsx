import { Bell, BellOff, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getCountdownState, makeCountdownLabels } from '../../utils/countdown.js';
import { createNotification, getRemindedStreamIds } from '../../services/notificationService.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const STYLE_URL = `https://api.maptiler.com/maps/01a0ef23-4483-77b2-9bfb-a2c369aedc88/style.json?key=ZyE5t313YRj7bz6OqZpO&t=${Date.now()}`;
const INITIAL_CENTER = [14, 10];
const INITIAL_ZOOM = 1.15;
const SELECTED_LIVE_ZOOM = 4.0;
const ROTATE_DEGREES_PER_SECOND = 1.8;
const ACTUAL_ROTATION_INTERVAL = 24;
const PULSE_INTERVAL = 240;

// ─── Clustering ───────────────────────────────────────────────────────────────

function getClusterPrecision(zoom) {
  if (zoom < 2) return 20;
  if (zoom < 4) return 8;
  if (zoom < 5) return 3;
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

// ─── MapLibre animated circle layer helpers ───────────────────────────────────

function pulseSeed(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return hash / 1000;
}

// ─── Stars + shooting stars on 2D canvas overlay ────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobeTest4({ streams }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const starsCanvasRef = useRef(null);
  const markersRef = useRef({});
  const pauseUntilRef = useRef(0);
  const animationRef = useRef(null);
  const selectedIdRef = useRef(null);
  const selectionReturnViewRef = useRef(null);
  const handleMarkerClickRef = useRef(null);
  const clusterPrecisionRef = useRef(20);

  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [clusterPrecision, setClusterPrecision] = useState(20);
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [remindedIds, setRemindedIds] = useState(new Set());

  // ── Clock for countdown ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Reminded notification IDs ──────────────────────────────────────────────
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

  // ── Enriched & filtered streams ────────────────────────────────────────────
  const enrichedStreams = useMemo(() => streams.map(enrichExperience), [streams]);

  const allLiveStreams = useMemo(
    () => enrichedStreams.filter((s) => activeStatuses.includes(s.status) && Array.isArray(s.coordinates)),
    [enrichedStreams, activeStatuses],
  );

  const clusteredStreams = useMemo(() => {
    const result = buildClusteredStreams(allLiveStreams, expandedClusterId, clusterPrecision);
    if (expandedClusterId) {
      const stillExists = result.some((s) => s.type === 'cluster' && s.clusterId === expandedClusterId);
      if (!stillExists) setExpandedClusterId(null);
    }
    return result;
  }, [allLiveStreams, expandedClusterId, clusterPrecision]);

  // ── HTML marker builder ────────────────────────────────────────────────────
  const buildMarkerElement = useCallback((d) => {
    const el = document.createElement('div');
    el.dataset.streamId = d.id;
    const markerColor = d.familyColor || '#28d8df';
    el.style.setProperty('--marker-color', markerColor);
    const delay = `${(pulseSeed(d.id) * 2.2).toFixed(2)}s`;
    el.style.setProperty('--gt2-delay', delay);

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
      handleMarkerClickRef.current?.(d);
    });

    return el;
  }, []);

  // ── Marker click handler ───────────────────────────────────────────────────
  const handleMarkerClick = useCallback((d) => {
    const map = mapRef.current;
    if (!map) return;

    if (d.type === 'cluster') {
      setSelectedStream(null);
      setSelectedCluster(d);
      pauseUntilRef.current = Number.POSITIVE_INFINITY;
      const coords = d.displayCoordinates || d.coordinates;
      map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 1.5, 5.5), duration: 600, essential: true });
      return;
    }

    pauseUntilRef.current = Date.now() + 8500;
    setSelectedCluster(null);
    setSelectedStream(d);
    selectedIdRef.current = d.id;

    if (!selectionReturnViewRef.current) {
      const center = map.getCenter();
      selectionReturnViewRef.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
    }

    const coords = d.displayCoordinates || d.coordinates;
    map.easeTo({ center: coords, zoom: SELECTED_LIVE_ZOOM, duration: 820, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
  }, []);

  handleMarkerClickRef.current = handleMarkerClick;

  // ── Sync is-selected CSS class ─────────────────────────────────────────────
  useEffect(() => {
    document.querySelectorAll('.gt2-marker.is-selected').forEach((el) => el.classList.remove('is-selected'));
    if (!selectedStream?.id) return;
    const apply = () => {
      const el = document.querySelector(`.gt2-marker[data-stream-id="${selectedStream.id}"]`);
      if (el) el.classList.add('is-selected');
    };
    apply();
    const timer = setTimeout(apply, 400);
    return () => clearTimeout(timer);
  }, [selectedStream]);

  // ── Sync HTML markers to map ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const currentIds = new Set(clusteredStreams.map((s) => s.id));

    // Remove stale markers
    for (const [id, marker] of Object.entries(markersRef.current)) {
      if (!currentIds.has(id)) { marker.remove(); delete markersRef.current[id]; }
    }

    // Add new markers
    for (const stream of clusteredStreams) {
      if (markersRef.current[stream.id]) continue;
      const el = buildMarkerElement(stream);
      const coords = stream.displayCoordinates || stream.coordinates;
      markersRef.current[stream.id] = new maplibregl.Marker({ element: el, anchor: 'bottom', occludedOpacity: 0 })
        .setLngLat(coords)
        .addTo(map);
    }
  }, [clusteredStreams, isMapLoaded, buildMarkerElement]);

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: 0,
      bearing: 0,
      minZoom: 0,
      maxZoom: 8,
      maxPitch: 80,
      projection: { type: 'globe' },
      attributionControl: false,
      logoPosition: 'bottom-left',
      renderWorldCopies: false,
      fadeDuration: 0,
      pixelRatio: Math.min(window.devicePixelRatio || 1, window.matchMedia?.('(pointer: coarse)').matches ? 1.5 : 2),
    });

    mapRef.current = map;

    map.touchZoomRotate.disableRotation();

    const pauseInteraction = () => { pauseUntilRef.current = Number.POSITIVE_INFINITY; };
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

        map.setFog?.({
          color: 'rgb(20, 35, 60)',
          'high-color': 'rgb(30, 55, 90)',
          'horizon-blend': 0.06,
          'space-color': '#060810',
          'star-intensity': 0.88,
        });

        // Hide symbol layers + fill layers that cause zoom artifacts
        map.getStyle().layers?.forEach((layer) => {
          if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
          if (layer.type === 'fill') {
            const id = layer.id || '';
            if (/countri|nation|land|boundary|admin|border/i.test(id)) {
              map.setLayoutProperty(layer.id, 'visibility', 'none');
            }
          }
          // Lift shadows on base raster layers (8K satellite is darker than 4K)
          if (layer.type === 'raster') {
            map.setPaintProperty(layer.id, 'raster-brightness-min', 0.12);
          }
        });

        // City lights — ESRI VIIRS Earth at Night
        map.addSource('city-lights', {
          type: 'raster',
          tiles: ['https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/ViirsEarthAtNight2012/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 8,
        });
        map.addLayer({
          id: 'city-lights-layer',
          type: 'raster',
          source: 'city-lights',
          paint: { 'raster-opacity': 0.20, 'raster-fade-duration': 0 },
        });

        map.setPadding({ top: 0, bottom: 135, left: 0, right: 0 });

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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      for (const marker of Object.values(markersRef.current)) marker.remove();
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Stars canvas resize observer ──────────────────────────────────────────
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const canvas = starsCanvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Animation loop: auto-rotation + stars ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    let lastRotationTime = performance.now();
    let lastPulseTime = 0;
    const initialCenter = map.getCenter();
    let lastRotationLng = initialCenter.lng;
    let lastRotationLat = initialCenter.lat;

    const tick = (time) => {
      if (time - lastPulseTime >= PULSE_INTERVAL) {
        lastPulseTime = time;
        const zoom = map.getZoom();
        const newPrecision = getClusterPrecision(zoom);
        if (newPrecision !== clusterPrecisionRef.current) {
          clusterPrecisionRef.current = newPrecision;
          setClusterPrecision(newPrecision);
        }
      }

      const zoom = map.getZoom();
      const isZoomed = zoom > 2.5;
      const shouldRotate = document.visibilityState !== 'hidden'
        && Date.now() > pauseUntilRef.current
        && !selectedStream
        && !selectedCluster
        && !isZoomed;

      if (shouldRotate) {
        const elapsed = time - lastRotationTime;
        if (elapsed >= ACTUAL_ROTATION_INTERVAL) {
          lastRotationTime = time;
          lastRotationLng += (ROTATE_DEGREES_PER_SECOND * Math.min(elapsed, 50)) / 1000;
          map.jumpTo({ center: [lastRotationLng, lastRotationLat] });
        }
      } else {
        lastRotationTime = time;
        const center = map.getCenter();
        lastRotationLng = center.lng;
        lastRotationLat = center.lat;
      }

      // Stars canvas
      const starsCanvas = starsCanvasRef.current;
      if (starsCanvas) {
        const ctx = starsCanvas.getContext('2d');
        const altitudeProxy = Math.max(0.3, 3.5 - zoom * 0.6);
        drawStars(starsCanvas, ctx, time, altitudeProxy);
      }

      // Manually control marker visibility — MapLibre's horizon fade creates half-transparent markers
      const centerLng = map.getCenter().lng * Math.PI / 180;
      const centerLat = map.getCenter().lat * Math.PI / 180;
      const cx = Math.cos(centerLat) * Math.cos(centerLng);
      const cy = Math.cos(centerLat) * Math.sin(centerLng);
      const cz = Math.sin(centerLat);

      for (const [, marker] of Object.entries(markersRef.current)) {
        const lngLat = marker.getLngLat();
        const lng = lngLat.lng * Math.PI / 180;
        const lat = lngLat.lat * Math.PI / 180;
        const dot = cx * Math.cos(lat) * Math.cos(lng) + cy * Math.cos(lat) * Math.sin(lng) + cz * Math.sin(lat);
        const el = marker.getElement();
        if (el) el.style.visibility = dot > 0.15 ? 'visible' : 'hidden';
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [selectedStream, selectedCluster]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const zoomBy = (delta) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)), duration: 620, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
    pauseUntilRef.current = Date.now() + 1200;
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setProjection({ type: 'globe' });
    setSelectedStream(null);
    setSelectedCluster(null);
    setExpandedClusterId(null);
    selectedIdRef.current = null;
    selectionReturnViewRef.current = null;
    pauseUntilRef.current = Date.now() + 2200;
    map.easeTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, bearing: 0, pitch: 0, duration: 1350, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
  };

  const closeSelectedStream = () => {
    const map = mapRef.current;
    setSelectedStream(null);
    selectedIdRef.current = null;
    selectionReturnViewRef.current = null;
    pauseUntilRef.current = Date.now() + 2200;
    if (map) {
      map.easeTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, bearing: 0, pitch: 0, duration: 1350, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
    }
  };

  const watchPath = (s) => `/watch?live=${encodeURIComponent(s.id)}`;

  return (
    <div
      className={`gt2-space-globe${selectedStream ? ' has-selected' : ''}`}
      style={{ position: 'relative', width: '100%', height: 'calc(100dvh - var(--nav-height, 62px))', background: 'transparent', overflow: 'hidden' }}
    >
      <canvas ref={starsCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

      <div className="gt2-globe-offset" style={{ transform: 'none' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'rgb(8, 15, 28)' }} />
      </div>

      {mapError ? <div className="test-old-globe__error">Error: {mapError}</div> : null}

      {/* Top status bar — Live / Upcoming */}
      <div className="gt2-status-bar">
        <button
          type="button"
          className={`gt2-status-btn${activeStatuses.includes('live') && !activeStatuses.includes('upcoming') ? ' gt2-status-btn--active' : ''}`}
          onClick={() => { setActiveStatuses(['live']); setSelectedStream(null); setSelectedCluster(null); }}
        >Live</button>
        <button type="button" className="gt2-status-btn gt2-status-btn--dim" disabled>Recent</button>
        <button
          type="button"
          className={`gt2-status-btn${activeStatuses.includes('upcoming') && !activeStatuses.includes('live') ? ' gt2-status-btn--active' : ''}`}
          onClick={() => { setActiveStatuses(['upcoming']); setSelectedStream(null); setSelectedCluster(null); }}
        >Upcoming</button>
      </div>

      {/* Map controls */}
      <div className="test-old-globe__controls" aria-label="Map controls" style={{ bottom: 'calc(var(--nav-height, 62px) + var(--safe-bottom, 0px) + 12px)' }}>
        <button type="button" onClick={() => zoomBy(0.72)} aria-label="Zoom in"><Plus size={19} /></button>
        <button type="button" onClick={() => zoomBy(-0.72)} aria-label="Zoom out"><Minus size={19} /></button>
        <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
      </div>

      {/* Selected stream card */}
      {selectedStream && selectedStream.type !== 'cluster' && (
        <aside className="test-globe-card" style={{ zIndex: 20 }}>
          <button type="button" className="test-globe-card__close" onClick={closeSelectedStream}>
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
        <div className="gt2-cluster-sheet">
          <div className="gt2-cluster-sheet__handle" />
          <div className="gt2-cluster-sheet__header">
            <span className="gt2-cluster-sheet__title">
              {selectedCluster.count} live{selectedCluster.count > 1 ? 's' : ''}{selectedCluster.streams[0]?.city ? ` in ${selectedCluster.streams[0].city}` : ' nearby'}
            </span>
            <button
              type="button"
              className="gt2-cluster-sheet__close"
              onClick={() => {
                setSelectedCluster(null);
                selectedIdRef.current = null;
                selectionReturnViewRef.current = null;
                pauseUntilRef.current = Date.now() + 2200;
                mapRef.current?.easeTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, bearing: 0, pitch: 0, duration: 1350, easing: (t) => 1 - Math.pow(1 - t, 3), essential: true });
              }}
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
    </div>
  );
}
