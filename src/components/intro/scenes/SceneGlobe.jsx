import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';

const Globe = lazy(() => import('react-globe.gl'));

const EASE = [0.22, 1, 0.36, 1];

// Demo POV points — clearly labeled as demonstration
const DEMO_POINTS = [
  { lat: 48.8566, lng:   2.3522, label: 'Paris',     name: 'Moody Rooster',  activity: 'Cooking' },
  { lat: 40.7128, lng: -74.0060, label: 'New York',  name: 'Downtown POV',   activity: 'Walking' },
  { lat: 35.6762, lng: 139.6503, label: 'Tokyo',     name: 'Shibuya Lights', activity: 'Walking' },
  { lat: -33.8688, lng: 151.2093, label: 'Sydney',   name: 'Bondi Session',  activity: 'Surfing' },
  { lat: 25.2048, lng:  55.2708, label: 'Dubai',     name: 'Skyline Drive',  activity: 'Driving' },
  { lat: -22.9068, lng: -43.1729, label: 'Rio',      name: 'Pedra do Sal',   activity: 'Live Music' },
  { lat: 45.4642, lng:   9.1900, label: 'Milan',     name: 'Pasta Workshop', activity: 'Cooking' },
];

// Classic flyover: planet view → zoom toward Paris
const CAMERA_KEYFRAMES = [
  { at:  200, lat:  20, lng:  10, altitude: 3.2, duration: 1800 },
  { at: 2600, lat:  38, lng:   2, altitude: 2.0, duration: 1600 },
  { at: 4400, lat: 48.85, lng: 2.35, altitude: 0.85, duration: 1800 },
];

function GlobeFallback() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: 12,
      }}
    >
      Loading globe…
    </div>
  );
}

export default function SceneGlobe({ reducedMotion }) {
  const globeRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 320, h: 640 });
  const [selectionVisible, setSelectionVisible] = useState(false);

  // Measure container for globe sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Globe initial config: disable interaction, set auto-rotate, animate camera
  const timers = useRef([]);
  const onGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    try {
      const controls = g.controls?.();
      if (controls) {
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableRotate = false;
        controls.autoRotate = !reducedMotion;
        controls.autoRotateSpeed = 0.3;
      }
      // Set a dark, moody background on the globe material if desired
      g.pointOfView({ lat: 10, lng: 0, altitude: 4 }, 0);

      CAMERA_KEYFRAMES.forEach((kf) => {
        const t = setTimeout(() => {
          g.pointOfView({ lat: kf.lat, lng: kf.lng, altitude: kf.altitude }, reducedMotion ? 0 : kf.duration);
        }, reducedMotion ? 0 : kf.at);
        timers.current.push(t);
      });
      // Reveal the "selection" card near the end
      const selT = setTimeout(() => setSelectionVisible(true), reducedMotion ? 300 : 6100);
      timers.current.push(selT);
    } catch (e) {
      // react-globe.gl is sensitive to StrictMode double-invokes; swallow and continue
      console.warn('[SceneGlobe] controls init', e);
    }
  };

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const pointsData = useMemo(() => DEMO_POINTS, []);

  return (
    <section className="intro-globe" aria-label="Live map">
      {/* Caption */}
      <motion.div
        className="intro-globe__caption"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <h3 className="intro-globe__caption-title">Live, everywhere.</h3>
        <p className="intro-globe__caption-sub">POVs from every corner of the world.</p>
      </motion.div>

      {/* Globe canvas */}
      <div ref={containerRef} className="intro-globe__canvas">
        <Suspense fallback={<GlobeFallback />}>
          <Globe
            ref={globeRef}
            width={dims.w}
            height={dims.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="/assets/globe/earth-night-threeglobe-4k.jpg"
            bumpImageUrl="/assets/globe/earth-bump.jpg"
            showAtmosphere
            atmosphereColor="#31BFD9"
            atmosphereAltitude={0.22}
            pointsData={pointsData}
            pointLat={(d) => d.lat}
            pointLng={(d) => d.lng}
            pointColor={() => '#31BFD9'}
            pointAltitude={0.02}
            pointRadius={0.35}
            pointsMerge={false}
            pointsTransitionDuration={600}
            onGlobeReady={onGlobeReady}
          />
        </Suspense>
      </div>

      {/* Demo pill */}
      <motion.div
        className="intro-globe__demo-pill"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5, ease: EASE }}
      >
        <span className="intro-globe__demo-pill-dot" />
        Demo · {DEMO_POINTS.length} POVs
      </motion.div>

      {/* Simulated selection card */}
      <AnimatePresence>
        {selectionVisible && (
          <motion.div
            className="intro-globe__selection"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          >
            <span className="intro-globe__selection-avatar">M</span>
            <div className="intro-globe__selection-body">
              <p className="intro-globe__selection-title">Friday service — Paris</p>
              <p className="intro-globe__selection-sub">@moodyroosterwlv · 2,847 watching</p>
            </div>
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', damping: 18, stiffness: 240 }}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#31BFD9', color: '#06162D',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Play size={14} strokeWidth={2.4} fill="currentColor" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
