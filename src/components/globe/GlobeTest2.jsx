import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
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
import { LocateFixed, Minus, Plus, SlidersHorizontal, ChevronUp, X, Play, Bell, BellOff } from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────────────────────

export default function GlobeTest2() {
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

  const enrichedStreams = useMemo(
    () => [...createdLives.map(enrichExperience), ...enrichedMapStreams],
    [createdLives, enrichedMapStreams],
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
        controls.minDistance = 150;
        controls.maxDistance = 800;
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
      globeRef.current?.pointOfView({ lat: coords[1] - 5, lng: coords[0], altitude: 0.5 }, 500);
      return;
    }

    userInteractedRef.current = true;
    setSelectedCluster(null);
    setSelectedStream(obj);
    const currentAlt = globeRef.current?.pointOfView?.()?.altitude ?? 2.3;
    const altitude = isDouble ? 0.4 : Math.min(1.2, currentAlt);
    const coords = obj.displayCoordinates || obj.coordinates;
    globeRef.current?.pointOfView({ lat: coords[1], lng: coords[0], altitude }, isDouble ? 500 : 700);
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
    globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.3, Math.min(5, pov.altitude * factor)) }, 400);
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

  return (
    <div
      ref={containerRef}
      className={`gt2-space-globe${selectedStream ? ' has-selected' : ''}`}
      style={{ position: 'relative', width: '100%', background: '#000011', overflow: 'hidden' }}
    >
      <canvas ref={starsCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />

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
        style={{ opacity: povSettled ? 1 : 0, transition: 'opacity 220ms ease-out' }}
      >
      {dims.w > 0 && dims.h > 0 && (
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        animateIn={false}
        onGlobeReady={() => setGlobeReady(true)}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="/assets/globe/earth-night-threeglobe-4k.jpg"
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
    </div>
  );
}
