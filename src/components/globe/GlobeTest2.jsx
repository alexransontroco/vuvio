import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { mapStreams } from '../../data/mapStreams.js';
import { ACTIVITY_CATEGORIES } from '../../data/activityCategories.js';
import { getCreatedLives, subscribeToCreatedLives } from '../../services/createdLiveService.js';
import MapBottomSheet from '../map/MapBottomSheet.jsx';
import { LocateFixed, Minus, Plus, X, Play } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

// Expose our THREE so globe.gl's bundled deps pick up the same instance
if (typeof window !== 'undefined') window.THREE = THREE;

// ── Shared Three.js resources — created once at module level ──────────────────

const FAMILY_COLORS = {
  air:   '#4f8dff',
  earth: '#45e56a',
  water: '#27ddeb',
};
const DEFAULT_COLOR = '#27ddeb';

let CORE_GEO = null;
let coreMaterials = null;
let GLOW_TEXTURE = null;
let RING_TEXTURE = null;

// Force reinit on HMR
if (import.meta.hot) import.meta.hot.accept(() => { CORE_GEO = null; });

// Reusable scratch vectors for per-frame back-face visibility test
const _tmpCam    = new THREE.Vector3();
const _tmpMarker = new THREE.Vector3();

function clusterKeyForCoordinates(coordinates) {
  const [lng, lat] = coordinates;
  return `${Math.round(lat * 10) / 10}:${Math.round(lng * 10) / 10}`;
}

function buildClusteredStreams(streams, expandedClusterId) {
  const groups = new Map();
  streams.forEach((stream) => {
    const key = clusterKeyForCoordinates(stream.coordinates);
    const current = groups.get(key) ?? [];
    current.push(stream);
    groups.set(key, current);
  });

  const items = [];
  groups.forEach((group, key) => {
    if (group.length < 2 || expandedClusterId === key) {
      group.forEach((stream) => {
        items.push({ ...stream, type: 'live', displayCoordinates: stream.coordinates, clusterId: key });
      });
      return;
    }

    const center = group.reduce((acc, stream) => {
      acc.lng += stream.coordinates[0];
      acc.lat += stream.coordinates[1];
      acc.viewers += Number.parseInt(String(stream.viewers ?? '0').replace(/\D/g, ''), 10) || 0;
      return acc;
    }, { lng: 0, lat: 0, viewers: 0 });
    center.lng /= group.length;
    center.lat /= group.length;

    items.push({
      id: `cluster-${key}`,
      type: 'cluster',
      clusterId: key,
      streams: group,
      count: group.length,
      viewers: center.viewers,
      family: 'default',
      familyColor: DEFAULT_COLOR,
      coordinates: [center.lng, center.lat],
      displayCoordinates: [center.lng, center.lat],
      name: `${group.length} lives`,
    });
  });

  return items.map((stream) => {
    if (stream.type === 'cluster') return stream;
    const [lng, lat] = stream.coordinates;
    const key = clusterKeyForCoordinates(stream.coordinates);
    const group = groups.get(key) ?? [];
    if (group.length < 2) return { ...stream, displayCoordinates: stream.coordinates, compactMarker: false };

    const index = group.findIndex((item) => item.id === stream.id);
    const ring = Math.floor(index / 8);
    const slot = index % 8;
    const angle = (slot / Math.min(8, group.length)) * Math.PI * 2 + ring * 0.38;
    const radius = 0.18 + ring * 0.08;
    const latOffset = Math.sin(angle) * radius;
    const lngOffset = (Math.cos(angle) * radius) / Math.max(0.35, Math.cos((lat * Math.PI) / 180));

    return {
      ...stream,
      displayCoordinates: [lng + lngOffset, lat + latOffset],
      sourceCoordinates: stream.coordinates,
      nearbyCount: group.length,
      compactMarker: expandedClusterId === key,
    };
  });
}

function initThreeResources() {
  if (CORE_GEO) return;
  CORE_GEO = new THREE.SphereGeometry(1.0, 10, 8);
  coreMaterials = {
    air:     new THREE.MeshBasicMaterial({ color: '#4f8dff', transparent: true, opacity: 1 }),
    earth:   new THREE.MeshBasicMaterial({ color: '#45e56a', transparent: true, opacity: 1 }),
    water:   new THREE.MeshBasicMaterial({ color: '#27ddeb', transparent: true, opacity: 1 }),
    default: new THREE.MeshBasicMaterial({ color: '#27ddeb', transparent: true, opacity: 1 }),
  };
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0,    'rgba(255,255,255,1.0)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.70)');
  g.addColorStop(0.5,  'rgba(255,255,255,0.30)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.08)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  GLOW_TEXTURE = new THREE.CanvasTexture(canvas);

  // Spoke texture — 8 radiating lines like an antenna signal
  const rSize = 128;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rSize; rCanvas.height = rSize;
  const rCtx = rCanvas.getContext('2d');
  const cx2 = rSize / 2;
  const numSpokes = 8;
  for (let i = 0; i < numSpokes; i++) {
    const angle = (i / numSpokes) * Math.PI * 2;
    const innerR = rSize * 0.32;
    const outerR = rSize * 0.42;
    const x1 = cx2 + Math.cos(angle) * innerR;
    const y1 = cx2 + Math.sin(angle) * innerR;
    const x2 = cx2 + Math.cos(angle) * outerR;
    const y2 = cx2 + Math.sin(angle) * outerR;
    const sg = rCtx.createLinearGradient(x1, y1, x2, y2);
    sg.addColorStop(0,   'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.50)');
    sg.addColorStop(1,   'rgba(255,255,255,0.70)');
    rCtx.strokeStyle = sg;
    rCtx.lineWidth = 1.5;
    rCtx.lineCap = 'round';
    rCtx.beginPath();
    rCtx.moveTo(x1, y1);
    rCtx.lineTo(x2, y2);
    rCtx.stroke();
  }
  RING_TEXTURE = new THREE.CanvasTexture(rCanvas);
}

// ── Stars + shooting stars on 2D canvas overlay ─────────────────────────────

function drawStars(canvas, ctx, time, altitude) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cx = w / 2;
  const cy = h / 2;

  // Estimate globe screen radius from altitude (react-globe.gl FOV ~50°)
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

  // Shooting stars from any edge, random direction, avoiding the globe
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

    // New random pick each cycle so successive shooting stars vary edges & angles
    const cycleIndex = Math.floor((t + ss * 3.1) / period);
    const cs = ss + cycleIndex * 137.7;
    const edge = Math.floor(Math.abs(Math.sin(cs * 7.3)) * 3.999); // 0..3
    const alongEdge = Math.abs(Math.sin(cs * 11.7));
    let sx, sy;
    if (edge === 0)      { sx = alongEdge * w; sy = 0; }
    else if (edge === 1) { sx = w;             sy = alongEdge * h; }
    else if (edge === 2) { sx = alongEdge * w; sy = h; }
    else                 { sx = 0;             sy = alongEdge * h; }

    // Random direction (biased away from the starting edge to stay on screen)
    const baseAngle = Math.atan2(cy - sy, cx - sx);
    const dirAngle = baseAngle + (Math.abs(Math.sin(cs * 2.1)) - 0.5) * 1.8;
    const len = (0.20 + Math.abs(Math.sin(cs * 5.7)) * 0.25) * Math.min(w, h);
    const ex = sx + Math.cos(dirAngle) * len;
    const ey = sy + Math.sin(dirAngle) * len;

    // Skip if trajectory crosses the globe (line-segment ↔ circle test)
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

// ─────────────────────────────────────────────────────────────────────────────

export default function GlobeTest2() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const [searchParams, setSearchParams]= useSearchParams();
  const globeRef      = useRef();
  const containerRef  = useRef();
  const starsCanvasRef= useRef(null);
  const markerRefs    = useRef([]);
  const animFrameRef  = useRef();
  const showGlowRef   = useRef(true);
  const userInteractedRef = useRef(false);
  const ignoredRequestedLiveRef = useRef(null);
  const requestedLiveId = searchParams.get('live');

  const [createdLives, setCreatedLives] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const lastClickTimeRef = useRef(0);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [sheetState, setSheetState] = useState('closed');
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [expandedClusterId, setExpandedClusterId] = useState(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([]));
  }, []);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  const enrichedStreams = useMemo(
    () => [...createdLives, ...mapStreams].map(enrichExperience),
    [createdLives],
  );

  const allLiveStreams = useMemo(
    () => enrichedStreams.filter((s) => activeStatuses.includes(s.status) && Array.isArray(s.coordinates)),
    [enrichedStreams, activeStatuses],
  );

  const liveStreams = useMemo(() => {
    markerRefs.current = [];
    const filtered = allLiveStreams.filter((s) => {
      if (activeFamily !== 'all' && s.family !== activeFamily) return false;
      if (activeActivities.length === 0) return true;
      return activeActivities.some((activityId) => {
        const activity = ACTIVITY_CATEGORIES.find((a) => a.id === activityId);
        return activity?.subcategories.includes(s.subcategory);
      });
    });
    const result = buildClusteredStreams(filtered, expandedClusterId);
    // Clear expandedClusterId if the cluster no longer exists after data refresh
    if (expandedClusterId) {
      const stillExists = result.some((s) => s.type === 'cluster' && s.clusterId === expandedClusterId);
      if (!stillExists) setExpandedClusterId(null);
    }
    return result;
  }, [allLiveStreams, activeFamily, activeActivities, expandedClusterId]);

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

  // ── Globe controls + scene lighting setup ───────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const globe = globeRef.current;
      if (!globe) return;

      const controls = globe.controls?.();
      if (controls) {
        controls.autoRotate      = true;
        controls.autoRotateSpeed = 0.4;
        controls.enableZoom      = true;
        controls.minDistance     = 150;
        controls.maxDistance     = 800;
      }

      if (!requestedLiveId) {
        globe.pointOfView({ lat: 10, lng: 14, altitude: 3.4 }, 0);
      }

      const renderer = globe.renderer?.();
      if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Fix texture anisotropy after texture loads
      setTimeout(() => {
        const scene2 = globe.scene?.();
        if (scene2 && renderer) {
          const maxAniso = renderer.capabilities.getMaxAnisotropy();
          scene2.traverse((obj) => {
            if (obj.isMesh && obj.material?.map) {
              obj.material.map.anisotropy = maxAniso;
              obj.material.map.needsUpdate = true;
            }
          });
        }
      }, 1500);

      // Brighten the scene with extra ambient light
      const scene = globe.scene?.();
      if (scene) {
        const ambient = new THREE.AmbientLight(0xaac8ff, 9.0);
        ambient.name = 'gt2-ambient';
        scene.add(ambient);
        const dir = new THREE.DirectionalLight(0x6688bb, 4.0);
        dir.name = 'gt2-dir';
        dir.position.set(1, 0.5, 1);
        scene.add(dir);
        ambient.name = 'gt2-ambient';
        scene.add(ambient);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = !userInteractedRef.current && !selectedStream && !selectedCluster && !expandedClusterId;
  }, [selectedStream, selectedCluster, expandedClusterId]);

  useEffect(() => {
    if (!requestedLiveId) return;
    if (ignoredRequestedLiveRef.current === requestedLiveId) return;
    const target = allLiveStreams.find((stream) => stream.id === requestedLiveId);
    if (!target) return;

    if (activeFamily !== 'all') setActiveFamily('all');
    if (activeActivities.length) setActiveActivities([]);

    const targetClusterId = clusterKeyForCoordinates(target.coordinates);
    if (expandedClusterId !== targetClusterId) setExpandedClusterId(targetClusterId);
  }, [activeActivities.length, activeFamily, allLiveStreams, expandedClusterId, requestedLiveId]);

  useEffect(() => {
    if (!requestedLiveId) return;
    if (ignoredRequestedLiveRef.current === requestedLiveId) return;

    const target = liveStreams.find((stream) => stream.type !== 'cluster' && stream.id === requestedLiveId)
      || allLiveStreams.find((stream) => stream.id === requestedLiveId);
    const globe = globeRef.current;
    if (!target || !globe) return;

    setSelectedStream(target);
    const controls = globe.controls?.();
    if (controls) controls.autoRotate = false;

    const focusCoordinates = target.displayCoordinates || target.coordinates;
    globe.pointOfView(
      { lat: focusCoordinates[1], lng: focusCoordinates[0], altitude: 0.45 },
      850,
    );
  }, [allLiveStreams, liveStreams, requestedLiveId]);

  useEffect(() => {
    if (!requestedLiveId) ignoredRequestedLiveRef.current = null;
  }, [requestedLiveId]);

  // ── Marker builder ──────────────────────────────────────────────────────────
  const objectThreeObject = useCallback((stream) => {
    initThreeResources();

    const isCluster = stream.type === 'cluster';
    const family  = stream.family ?? 'default';
    const color   = FAMILY_COLORS[family] ?? DEFAULT_COLOR;
    const mat     = coreMaterials[family] ?? coreMaterials.default;
    const viewers = parseInt(String(stream.viewers ?? '0').replace(/\D/g, ''), 10) || 0;

    const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
    const viewerT = Math.min(viewers, 2000) / 2000;
    const coreScale = lerp(1.1, 2.2, viewerT);
    const baseScale = lerp(4.0, 5.5, viewerT);
    const markerCoreScale = stream.compactMarker ? coreScale * 0.52 : coreScale;
    const markerBaseScale = stream.compactMarker ? baseScale * 0.48 : baseScale;

    const core = new THREE.Mesh(CORE_GEO, mat.clone());
    core.scale.setScalar(isCluster ? Math.max(2.8, coreScale + 1.4) : markerCoreScale);

    const glowMat = new THREE.SpriteMaterial({
      map:         GLOW_TEXTURE,
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     0.65,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(isCluster ? Math.max(10, baseScale + 3) : markerBaseScale);

    // Outer ripple halo — ring that expands and fades
    const haloMat = new THREE.SpriteMaterial({
      map:         RING_TEXTURE,
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     0,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(baseScale);

    const group = new THREE.Group();
    group.add(core);
    group.add(glow);
    group.add(halo);

    if (isCluster) {
      // No glow/halo on clusters — clean bubble look
      glow.material.opacity = 0;
      halo.material.opacity = 0;

      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 128;
      labelCanvas.height = 128;
      const ctx = labelCanvas.getContext('2d');

      // Outer subtle glow ring
      const glowGrad = ctx.createRadialGradient(64, 64, 28, 64, 64, 64);
      glowGrad.addColorStop(0,   'rgba(39, 221, 235, 0.18)');
      glowGrad.addColorStop(0.7, 'rgba(39, 221, 235, 0.06)');
      glowGrad.addColorStop(1,   'rgba(39, 221, 235, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, Math.PI * 2);
      ctx.fill();

      // Dark bubble fill
      ctx.fillStyle = 'rgba(4, 14, 26, 0.92)';
      ctx.beginPath();
      ctx.arc(64, 64, 38, 0, Math.PI * 2);
      ctx.fill();

      // Cyan border
      ctx.strokeStyle = 'rgba(39, 221, 235, 0.90)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Count number
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 40px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(stream.count), 64, 65);

      const texture = new THREE.CanvasTexture(labelCanvas);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }));
      label.position.z = 0.8;
      label.scale.setScalar(14);
      group.add(label);
    }

    const phase = Math.random() * Math.PI * 2;
    markerRefs.current.push({
      group,
      core,
      glow,
      halo,
      phase,
      isCluster,
      baseScale: isCluster ? Math.max(10, baseScale + 3) : markerBaseScale,
    });

    return group;
  }, []);

  // ── Breathing animation (RAF — no React state) ──────────────────────────────
  useEffect(() => {
    let t = 0;
    const animate = (now) => {
      t += 0.016;

      const altitude = globeRef.current?.pointOfView?.()?.altitude ?? 3.4;
      const zoomScale = Math.max(0.22, Math.min(2.6, altitude / 3.4));

      const camera = globeRef.current?.camera?.();
      let hasCam = false;
      if (camera) {
        _tmpCam.copy(camera.position).normalize();
        hasCam = true;
      }

      for (const ref of markerRefs.current) {
        let visFactor = 1;
        if (hasCam) {
          ref.group.getWorldPosition(_tmpMarker);
          const dot = _tmpCam.dot(_tmpMarker.normalize());
          visFactor = Math.max(0, Math.min(1, (dot + 0.03) / 0.22));
        }

        if (visFactor < 0.02) {
          ref.group.visible = false;
          continue;
        }
        ref.group.visible = true;
        ref.group.scale.setScalar(zoomScale);

        // Clusters have no animated glow/halo
        if (ref.isCluster) continue;

        const glowVis = visFactor * visFactor;

        const blinkCycle = ((t * 0.9 + ref.phase / (Math.PI * 2)) % 1);
        const blink = blinkCycle < 0.22 ? 1 - (blinkCycle / 0.22) : 0;
        ref.glow.material.opacity = showGlowRef.current ? (0.22 + blink * 0.78) * glowVis : 0;
        ref.glow.scale.setScalar(ref.baseScale * (0.46 + blink * 0.24));

        // Core dot blinks: full brightness on blink peak, dims between pulses
        ref.core.material.opacity = (0.55 + blink * 0.45) * visFactor;

        const ripple = ((t * 0.25 + ref.phase / (Math.PI * 2)) % 1);
        ref.halo.scale.setScalar(ref.baseScale * (1.0 + ripple * 0.9));
        ref.halo.material.opacity = showGlowRef.current ? Math.max(0, 0.30 * Math.sin(ripple * Math.PI)) * glowVis : 0;
      }

      // Draw stars + shooting stars overlay
      const starsCanvas = starsCanvasRef.current;
      if (starsCanvas) {
        const ctx = starsCanvas.getContext('2d');
        drawStars(starsCanvas, ctx, now, altitude);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
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
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const zoomBy = (factor) => {
    const pov = globeRef.current?.pointOfView();
    if (!pov) return;
    const altitude = Math.max(0.3, Math.min(5, pov.altitude * factor));
    globeRef.current.pointOfView({ ...pov, altitude }, 400);
  };

  const recenter = () => {
    userInteractedRef.current = false;
    setSelectedStream(null);
    setSelectedCluster(null);
    setExpandedClusterId(null);
    if (requestedLiveId) {
      ignoredRequestedLiveRef.current = requestedLiveId;
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('live');
      setSearchParams(nextParams, { replace: true });
    }
    globeRef.current?.pointOfView({ lat: 10, lng: 14, altitude: 3.4 }, 1600);
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = true;
  };

  const handleObjectClick = (obj) => {
    const now = Date.now();
    const isDouble = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;

    if (obj.type === 'cluster') {
      userInteractedRef.current = true;
      setSelectedStream(null);
      setSelectedCluster(obj);
      const controls = globeRef.current?.controls?.();
      if (controls) controls.autoRotate = false;
      const focusCoordinates = obj.displayCoordinates || obj.coordinates;
      globeRef.current?.pointOfView(
        { lat: focusCoordinates[1], lng: focusCoordinates[0], altitude: 0.5 },
        500,
      );
      return;
    }

    userInteractedRef.current = true;
    setSelectedCluster(null);
    setSelectedStream(obj);
    const altitude = isDouble ? 0.4 : 1.2;
    const focusCoordinates = obj.displayCoordinates || obj.coordinates;
    globeRef.current?.pointOfView(
      { lat: focusCoordinates[1], lng: focusCoordinates[0], altitude },
      isDouble ? 500 : 700,
    );
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = false;
  };

  const watchPath = (s) => `/watch?live=${encodeURIComponent(s.id)}`;
  const currentGlobePath = `${location.pathname.startsWith('/map') ? '/map-current' : '/globe-current'}${location.search}`;

  return (
    <div
      ref={containerRef}
      className="gt2-space-globe"
      style={{ position: 'relative', width: '100%', height: '100dvh', background: '#060d16', overflow: 'hidden' }}
    >
      <canvas
        ref={starsCanvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
      />
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        globeImageUrl="/assets/globe/earth-night-threeglobe-4k.jpg"
        showAtmosphere={true}
        atmosphereColor="#55d8ff"
        atmosphereAltitude={0.20}
        showGraticules={false}
        objectsData={liveStreams}
        objectThreeObject={objectThreeObject}
        objectAltitude={0.01}
        objectLat={(d) => (d.displayCoordinates || d.coordinates)[1]}
        objectLng={(d) => (d.displayCoordinates || d.coordinates)[0]}
        objectLabel={(d) => d.name || d.streamer || ''}
        onObjectClick={handleObjectClick}
        ringsData={selectedStream ? [selectedStream] : []}
        ringColor={() => '#32d8e5'}
        ringMaxRadius={3}
        ringPropagationSpeed={1}
        ringRepeatPeriod={2500}
        ringAltitude={0.01}
        ringLat={(d) => (d.displayCoordinates || d.coordinates)[1]}
        ringLng={(d) => (d.displayCoordinates || d.coordinates)[0]}
        rendererConfig={{ antialias: true, powerPreference: 'high-performance' }}
      />

      <div className="gt2-mode-pill" role="tablist" aria-label="Globe mode">
        <Link
          role="tab"
          to={currentGlobePath}
          className="gt2-mode-pill__tab"
        >
          Current
        </Link>
        <span className="gt2-mode-pill__sep" aria-hidden="true" />
        <span
          role="tab"
          aria-selected="true"
          className="gt2-mode-pill__tab gt2-mode-pill__tab--active"
        >
          Test 2
        </span>
      </div>

      {!selectedStream && !selectedCluster && (
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

      <div className="test-old-globe__controls" aria-label="Map controls">
        <button type="button" onClick={() => zoomBy(0.7)} aria-label="Zoom in"><Plus size={19} /></button>
        <button type="button" onClick={() => zoomBy(1.43)} aria-label="Zoom out"><Minus size={19} /></button>
        <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
      </div>

      {selectedStream && selectedStream.type !== 'cluster' && (
        <aside className="test-globe-card" style={{ zIndex: 20 }}>
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
              <strong>{selectedStream.viewers} viewers</strong>
            </div>
            <div className="test-globe-card__actions">
              <button type="button" className="test-globe-card__watch" onClick={() => navigate(watchPath(selectedStream))}>
                <Play size={13} fill="currentColor" strokeWidth={1.8} />Watch
              </button>
            </div>
          </div>
        </aside>
      )}

      {selectedCluster && (
        <div className="gt2-cluster-sheet">
          <div className="gt2-cluster-sheet__handle" />
          <div className="gt2-cluster-sheet__header">
            <span className="gt2-cluster-sheet__title">
              {selectedCluster.count} lives nearby
            </span>
            <button
              type="button"
              className="gt2-cluster-sheet__close"
              onClick={() => { setSelectedCluster(null); const c = globeRef.current?.controls?.(); if (c) c.autoRotate = false; }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="gt2-cluster-sheet__list">
            {selectedCluster.streams.map((s) => (
              <button
                key={s.id}
                type="button"
                className="gt2-cluster-sheet__item"
                onClick={() => { setSelectedCluster(null); navigate(watchPath(s)); }}
              >
                <img src={s.image} alt="" loading="lazy" />
                <div className="gt2-cluster-sheet__item-body">
                  <span className="gt2-cluster-sheet__item-name">{s.experienceTitle || s.name}</span>
                  <span className="gt2-cluster-sheet__item-meta">{s.city}, {s.country} · {s.viewers} viewers</span>
                </div>
                <div className="gt2-cluster-sheet__item-play">
                  <Play size={12} fill="currentColor" strokeWidth={0} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
