import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { INTRO_LIVES } from '../introLives.js';

const EASE = [0.22, 1, 0.36, 1];

const EARTH_TEXTURE = '/assets/globe/earth-night-threeglobe-4k.jpg';

export default function GlobeLayer({ visible, preload, reducedMotion, autoSelect, onSelectLive }) {
  const [GlobeComp, setGlobeComp] = useState(null);
  const [textureReady, setTextureReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [visualReady, setVisualReady] = useState(false);
  const [markerVisible, setMarkerVisible] = useState(false);
  const [selectedLive, setSelectedLive] = useState(null);
  const [size, setSize] = useState({ width: 390, height: 844 });
  const globeRef = useRef(null);
  const containerRef = useRef(null);
  const initializedRef = useRef(false);
  const markerRef = useRef(null);
  const clusterRefs = useRef(new Map());

  // Preload the module as soon as preload turns true
  useEffect(() => {
    if (!preload || GlobeComp) return;
    let cancelled = false;
    import('react-globe.gl').then((mod) => {
      if (!cancelled) setGlobeComp(() => mod.default);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [preload, GlobeComp]);

  // Preload the texture
  useEffect(() => {
    if (!preload || textureReady) return;
    const img = new Image();
    img.onload = () => setTextureReady(true);
    img.src = EARTH_TEXTURE;
  }, [preload, textureReady]);

  const ready = Boolean(GlobeComp) && textureReady;

  useEffect(() => {
    if (!preload || !containerRef.current) return undefined;
    const container = containerRef.current;
    const updateSize = () => setSize({ width: container.clientWidth, height: container.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [preload]);

  useEffect(() => {
    if (!globeReady || initializedRef.current) return;
    const globe = globeRef.current;
    if (!globe) return;
    initializedRef.current = true;
    const controls = globe.controls?.();
    if (controls) {
      controls.autoRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
    }
    globe.pointOfView({ lat: 20, lng: -55, altitude: 2.65 }, 0);
    const scene = globe.scene?.();
    if (scene && !scene.getObjectByName('introv2-ambient')) {
      const ambient = new THREE.AmbientLight(0xaac8ff, 9);
      ambient.name = 'introv2-ambient';
      const directional = new THREE.DirectionalLight(0x6688bb, 4);
      directional.position.set(1, 0.5, 1);
      scene.add(ambient, directional);
    }
    setShowContent(true);
  }, [globeReady]);

  useEffect(() => {
    if (!globeReady || !showContent || !textureReady) return undefined;
    const timer = setTimeout(() => {
      setVisualReady(true);
    }, 550);
    return () => clearTimeout(timer);
  }, [globeReady, showContent, textureReady]);

  useEffect(() => {
    if (!visible || !globeReady) return undefined;
    const timer = setTimeout(() => {
      globeRef.current?.pointOfView({ lat: 34.0522, lng: -118.2437, altitude: 0.78 }, reducedMotion ? 0 : 5000);
    }, reducedMotion ? 0 : 3800);
    return () => clearTimeout(timer);
  }, [visible, globeReady, reducedMotion]);

  useEffect(() => {
    if (!visible) {
      setMarkerVisible(false);
      setSelectedLive(null);
      return undefined;
    }
    if (!visualReady) return undefined;
    const revealTimer = setTimeout(() => setMarkerVisible(true), reducedMotion ? 0 : 750);
    return () => clearTimeout(revealTimer);
  }, [visible, visualReady, reducedMotion]);

  useEffect(() => {
    if (!visible || !autoSelect || selectedLive) return undefined;
    const timer = setTimeout(() => {
      if (markerRef.current) markerRef.current.click();
      else setSelectedLive(INTRO_LIVES[0]);
    }, reducedMotion ? 600 : 11200);
    return () => clearTimeout(timer);
  }, [visible, autoSelect, selectedLive, reducedMotion]);

  useEffect(() => {
    if (!visible || !selectedLive) return undefined;
    const timer = setTimeout(() => onSelectLive(selectedLive), reducedMotion ? 300 : 1800);
    return () => clearTimeout(timer);
  }, [visible, selectedLive, reducedMotion, onSelectLive]);

  useEffect(() => {
    if (!visible || !markerVisible || !globeReady) return undefined;
    let frame;
    const updateClusters = () => {
      const globe = globeRef.current;
      const camera = globe?.camera?.();
      if (globe && camera) {
        const radius = globe.getGlobeRadius();
        INTRO_LIVES.forEach((cluster) => {
          const element = clusterRefs.current.get(cluster.label);
          if (!element) return;
          const surface = globe.getCoords(cluster.lat, cluster.lng);
          const screen = globe.getScreenCoords(cluster.lat, cluster.lng, 0.02);
          const facingCamera = surface.x * camera.position.x + surface.y * camera.position.y + surface.z * camera.position.z > radius * radius;
          const onScreen = Number.isFinite(screen.x) && Number.isFinite(screen.y) && screen.x >= 0 && screen.x <= size.width && screen.y >= 0 && screen.y <= size.height;
          element.style.visibility = facingCamera && onScreen ? 'visible' : 'hidden';
          element.style.left = `${screen.x}px`;
          element.style.top = `${screen.y}px`;
        });
      }
      frame = requestAnimationFrame(updateClusters);
    };
    updateClusters();
    return () => cancelAnimationFrame(frame);
  }, [visible, markerVisible, globeReady, size.width, size.height]);

  const points = useMemo(() => showContent ? INTRO_LIVES : [], [showContent]);

  return (
    <AnimatePresence>
      {(visible || preload) && (
        <motion.div
          ref={containerRef}
          className={
            'introv2-globe' +
            (visible ? ' introv2-globe--visible' : ' introv2-globe--preload')
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: visible ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.2 : 1.3, ease: EASE }}
        >
          {/* starfield backdrop — visible instantly even before Globe loads */}
          <div className="introv2-globe__stars" />
          <div className="introv2-globe__vignette" />
          <img className="introv2-globe__fallback" src="/intro/earth-preview.png" alt="" />
          {ready && GlobeComp && (
            <div className={'introv2-globe__renderer' + (visualReady ? ' introv2-globe__renderer--ready' : '')}>
              <GlobeComp
              ref={globeRef}
              width={size.width}
              height={size.height}
              rendererConfig={{ antialias: false, powerPreference: 'high-performance' }}
              globeImageUrl={EARTH_TEXTURE}
              backgroundColor="rgba(0,0,0,0)"
              atmosphereColor="rgba(40,216,223,0.15)"
              atmosphereAltitude={0.09}
              showGlobe
              showAtmosphere
              animateIn={false}
              pointsData={points}
              pointLat={(d) => d.lat}
              pointLng={(d) => d.lng}
              pointColor={() => '#31BFD9'}
              pointAltitude={0.02}
              pointRadius={(d) => d.size * 0.35}
              pointResolution={16}
              pointsMerge={false}
              enablePointerInteraction={false}
              onGlobeReady={() => setGlobeReady(true)}
              />
            </div>
          )}
          {visible && markerVisible && INTRO_LIVES.map((cluster) => (
            <div
              key={cluster.label}
              ref={(element) => {
                if (element) clusterRefs.current.set(cluster.label, element);
                else clusterRefs.current.delete(cluster.label);
              }}
              className={'introv2-globe__cluster' + (cluster.featured ? ' introv2-globe__cluster--featured' : '') + (selectedLive?.id === cluster.id ? ' introv2-globe__cluster--selected' : '')}
            >
              <button
                ref={cluster.featured ? markerRef : undefined}
                type="button"
                className="introv2-globe__cluster-button"
                onClick={() => setSelectedLive(cluster)}
                aria-label={`Open ${cluster.label} live cluster with ${cluster.count} streams`}
              >
                <span className="introv2-globe__cluster-bubble">
                  <strong>{cluster.count}</strong>
                  <span>LIVE</span>
                </span>
                <span className="introv2-globe__cluster-stem" />
                <span className="introv2-globe__cluster-dot" />
              </button>
            </div>
          ))}

          <AnimatePresence>
            {visible && selectedLive && (
              <motion.div
                className="introv2-globe__live-card"
                initial={{ opacity: 0, y: 22, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: reducedMotion ? 0.2 : 0.55, ease: EASE }}
              >
                <img src={selectedLive.poster} alt={`${selectedLive.name} POV`} />
                <div className="introv2-globe__live-card-copy">
                  <span className="introv2-globe__live-card-status">LIVE · {selectedLive.viewers} watching</span>
                  <strong>{selectedLive.name}</strong>
                  <span>{selectedLive.category} · {selectedLive.location}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {visible && (
            <motion.div
              className="introv2-globe__pill"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: markerVisible ? 1 : 0, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              Demo · {INTRO_LIVES.length} POVs
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
