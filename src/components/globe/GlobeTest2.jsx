import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { mapStreams } from '../../data/mapStreams.js';
import { LocateFixed, Minus, Plus, X, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Expose our THREE so globe.gl's bundled deps pick up the same instance
if (typeof window !== 'undefined') window.THREE = THREE;

// ── Shared Three.js resources — created once at module level ──────────────────

const FAMILY_COLORS = {
  air:   '#438cff',
  earth: '#56df70',
  water: '#32d8e5',
};
const DEFAULT_COLOR = '#32d8e5';

let CORE_GEO = null;
let coreMaterials = null;
let GLOW_TEXTURE = null;
let RING_TEXTURE = null;

function initThreeResources() {
  if (CORE_GEO) return;
  CORE_GEO = new THREE.SphereGeometry(1.0, 10, 8);
  coreMaterials = {
    air:     new THREE.MeshBasicMaterial({ color: '#438cff' }),
    earth:   new THREE.MeshBasicMaterial({ color: '#56df70' }),
    water:   new THREE.MeshBasicMaterial({ color: '#32d8e5' }),
    default: new THREE.MeshBasicMaterial({ color: '#32d8e5' }),
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

  // Ring texture for ripple — transparent center, bright ring edge
  const rSize = 128;
  const rCanvas = document.createElement('canvas');
  rCanvas.width = rSize; rCanvas.height = rSize;
  const rCtx = rCanvas.getContext('2d');
  const rg = rCtx.createRadialGradient(rSize/2, rSize/2, rSize*0.28, rSize/2, rSize/2, rSize/2);
  rg.addColorStop(0,    'rgba(255,255,255,0)');
  rg.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  rg.addColorStop(0.75, 'rgba(255,255,255,0.75)');
  rg.addColorStop(0.88, 'rgba(255,255,255,0.40)');
  rg.addColorStop(1,    'rgba(255,255,255,0)');
  rCtx.fillStyle = rg;
  rCtx.fillRect(0, 0, rSize, rSize);
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
  const starCount = Math.max(80, Math.floor((w * h) / 18000));

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
  const globeRef      = useRef();
  const containerRef  = useRef();
  const starsCanvasRef= useRef(null);
  const markerRefs    = useRef([]);
  const animFrameRef  = useRef();
  const showGlowRef   = useRef(true);
  const fpsRef        = useRef({ frames: 0, last: performance.now(), fps: 60 });

  const [selectedStream, setSelectedStream] = useState(null);
  const lastClickTimeRef = useRef(0);
  const [fps,        setFps]        = useState(60);
  const [showGlow,   setShowGlow]   = useState(true);
  const [showAtm,    setShowAtm]    = useState(true);
  const [devVisible, setDevVisible] = useState(true);
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  // ── Globe material ──────────────────────────────────────────────────────────
  const globeMaterial = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial();
    mat.color             = new THREE.Color('#0a1e3a');
    mat.emissive          = new THREE.Color('#061020');
    mat.emissiveIntensity = 0.15;
    mat.shininess         = 6;
    return mat;
  }, []);

  // ── Data ────────────────────────────────────────────────────────────────────
  const enrichedStreams = useMemo(() => mapStreams.map(enrichExperience), []);

  const liveStreams = useMemo(() => {
    markerRefs.current = [];
    return enrichedStreams.filter((s) => s.status === 'live' && Array.isArray(s.coordinates));
  }, [enrichedStreams]);

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

      globe.pointOfView({ lat: 10, lng: 14, altitude: 4.2 }, 0);

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
    if (controls) controls.autoRotate = !selectedStream;
  }, [selectedStream]);

  // ── Marker builder ──────────────────────────────────────────────────────────
  const objectThreeObject = useCallback((stream) => {
    initThreeResources();

    const family  = stream.family ?? 'default';
    const color   = FAMILY_COLORS[family] ?? DEFAULT_COLOR;
    const mat     = coreMaterials[family] ?? coreMaterials.default;
    const viewers = parseInt(String(stream.viewers ?? '0').replace(/\D/g, ''), 10) || 0;

    // Interpolate size based on viewer count
    const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
    const viewerT = Math.min(viewers, 2000) / 2000;
    const coreScale = lerp(0.7, 1.8, viewerT);
    const baseScale = lerp(6.5, 10.5, viewerT);

    const core = new THREE.Mesh(CORE_GEO, mat.clone());
    core.scale.setScalar(coreScale);

    const glowMat = new THREE.SpriteMaterial({
      map:         GLOW_TEXTURE,
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     0.65,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(baseScale);

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

    const phase = Math.random() * Math.PI * 2;
    markerRefs.current.push({ group, glow, halo, phase, baseScale });

    return group;
  }, []);

  // ── Breathing animation (RAF — no React state) ──────────────────────────────
  useEffect(() => {
    let t = 0;
    const animate = (now) => {
      t += 0.016;

      fpsRef.current.frames++;
      if (now - fpsRef.current.last >= 1000) {
        fpsRef.current.fps    = fpsRef.current.frames;
        fpsRef.current.frames = 0;
        fpsRef.current.last   = now;
        setFps(fpsRef.current.fps);
      }

      // Zoom compensation: keep apparent size roughly constant across altitudes
      const altitude = globeRef.current?.pointOfView?.()?.altitude ?? 3.5;
      const zoomScale = Math.max(0.22, Math.min(2.6, altitude / 4.2));

      for (const ref of markerRefs.current) {
        ref.group.scale.setScalar(zoomScale);

        // Inner glow — pulsing
        const v = 0.5 + 0.5 * Math.sin(t * 1.2 + ref.phase);
        ref.glow.material.opacity = showGlowRef.current ? (0.35 + v * 0.50) : 0;
        ref.glow.scale.setScalar(ref.baseScale * (0.85 + v * 0.28));

        // Outer ripple — slow, very light
        const ripple = ((t * 0.25 + ref.phase / (Math.PI * 2)) % 1);
        ref.halo.scale.setScalar(ref.baseScale * (1.0 + ripple * 1.7));
        ref.halo.material.opacity = showGlowRef.current ? Math.max(0, 0.28 * (1 - ripple)) : 0;
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
    globeRef.current.pointOfView({ ...pov, altitude: Math.max(0.3, Math.min(5, pov.altitude * factor)) }, 400);
  };

  const recenter = () => {
    setSelectedStream(null);
    globeRef.current?.pointOfView({ lat: 10, lng: 14, altitude: 4.2 }, 800);
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = true;
  };

  const handleObjectClick = (obj) => {
    const now = Date.now();
    const isDouble = now - lastClickTimeRef.current < 300;
    lastClickTimeRef.current = now;
    setSelectedStream(obj);
    const altitude = isDouble ? 0.4 : 1.2;
    globeRef.current?.pointOfView(
      { lat: obj.coordinates[1], lng: obj.coordinates[0], altitude },
      isDouble ? 500 : 700,
    );
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = false;
  };

  const watchPath = (s) => `/watch?live=${encodeURIComponent(s.id)}`;

  return (
    <div
      ref={containerRef}
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
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
        showAtmosphere={showAtm}
        atmosphereColor="#55d8ff"
        atmosphereAltitude={0.20}
        showGraticules={false}
        objectsData={liveStreams}
        objectThreeObject={objectThreeObject}
        objectAltitude={0.01}
        objectLat={(d) => d.coordinates[1]}
        objectLng={(d) => d.coordinates[0]}
        objectLabel={(d) => d.name || d.streamer || ''}
        onObjectClick={handleObjectClick}
        ringsData={selectedStream ? [selectedStream] : []}
        ringColor={() => '#32d8e5'}
        ringMaxRadius={3}
        ringPropagationSpeed={1}
        ringRepeatPeriod={2500}
        ringAltitude={0.01}
        ringLat={(d) => d.coordinates[1]}
        ringLng={(d) => d.coordinates[0]}
        rendererConfig={{ antialias: true, powerPreference: 'high-performance' }}
      />

      <div className="test-old-globe__controls" aria-label="Map controls">
        <button type="button" onClick={() => zoomBy(0.7)} aria-label="Zoom in"><Plus size={19} /></button>
        <button type="button" onClick={() => zoomBy(1.43)} aria-label="Zoom out"><Minus size={19} /></button>
        <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
      </div>

      {selectedStream && (
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

      {devVisible && (
        <div style={{
          position: 'fixed', top: 60, right: 12, zIndex: 100,
          background: 'rgba(0,0,0,0.82)', color: '#e0f0ff', fontSize: 11,
          padding: '8px 10px', borderRadius: 8, fontFamily: 'monospace',
          display: 'flex', flexDirection: 'column', gap: 5,
          border: '1px solid rgba(100,170,220,0.2)', minWidth: 170,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>GlobeTest2 dev</div>
          <div>FPS: {fps} | Lives: {liveStreams.length}</div>
          <div>Objects: {markerRefs.current.length} | DPR: {Math.min(window.devicePixelRatio, 1.5).toFixed(1)}</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showGlow} onChange={(e) => { setShowGlow(e.target.checked); showGlowRef.current = e.target.checked; }} />
            Glow
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showAtm} onChange={(e) => setShowAtm(e.target.checked)} />
            Atmosphere
          </label>
          <button
            onClick={() => setDevVisible(false)}
            style={{ fontSize: 10, marginTop: 2, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
          >
            Hide
          </button>
        </div>
      )}
    </div>
  );
}
