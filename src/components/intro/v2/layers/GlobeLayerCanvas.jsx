import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MapPin, MousePointer2, Play, X } from 'lucide-react';
import { CHEF_LIVE, FIREFIGHTER_LIVE, INTRO_LIVES } from '../introLives.js';
import IntroBottomNav from './IntroBottomNav.jsx';
import { useIntroCopy } from '../introCopy.js';

const EASE = [0.22, 1, 0.36, 1];
const CENTER_LAT = 25 * Math.PI / 180;
const START_LNG = -2;
const END_LNG = -95;
const FRAME_STEP = 1.5;
const FRAME_COUNT = Math.round((START_LNG - END_LNG) / FRAME_STEP);
const TEXTURE = '/assets/globe/earth-night-threeglobe-4k.jpg';
const GLOBE_PROJECTIONS = new WeakMap();
const EXTRA_POINTS = [
  { lat: 40.7128, lng: -74.006 },
  { lat: 64.1466, lng: -21.9426 },
  { lat: 48.8566, lng: 2.3522 },
  { lat: 45.4642, lng: 9.19 },
  { lat: -22.9068, lng: -43.1729 },
  { lat: 31.2304, lng: 121.4737 },
];
const GLOBE_LIVES = [
  ...INTRO_LIVES,
  { ...INTRO_LIVES[4], id: 'iceland-flight', lat: 64.14, lng: -21.94, count: 2, label: 'Reykjavík', name: 'North Atlantic flight', location: 'Reykjavík, Iceland' },
  { ...INTRO_LIVES[3], id: 'canada-alpine', lat: 51.18, lng: -115.57, count: 3, label: 'Banff', name: 'Rocky Mountain trail', location: 'Banff, Canada' },
  { ...INTRO_LIVES[1], id: 'paris-kitchen', lat: 48.86, lng: 2.35, count: 2, label: 'Paris', name: 'Kitchen POV', location: 'Paris, France' },
  { ...INTRO_LIVES[1], id: 'italy-kitchen', lat: 41.9, lng: 12.49, count: 4, label: 'Rome', name: 'Dinner service POV', location: 'Rome, Italy' },
  { ...INTRO_LIVES[2], id: 'istanbul-piano', lat: 41.01, lng: 28.98, count: 2, label: 'Istanbul', name: 'Piano session', location: 'Istanbul, Türkiye', marker: 'photo' },
  { ...INTRO_LIVES[3], id: 'morocco-ridge', lat: 31.06, lng: -7.92, count: 2, label: 'Atlas Mountains', name: 'Mountain ridge POV', location: 'Atlas Mountains, Morocco' },
  { ...INTRO_LIVES[1], id: 'lagos-kitchen', lat: 6.52, lng: 3.38, count: 4, label: 'Lagos', name: 'Chef POV', location: 'Lagos, Nigeria' },
  { ...INTRO_LIVES[3], id: 'kenya-trail', lat: -1.29, lng: 36.82, count: 2, label: 'Nairobi', name: 'Trail POV', location: 'Nairobi, Kenya', marker: 'photo' },
  { ...INTRO_LIVES[4], id: 'india-flight', lat: 28.61, lng: 77.21, count: 2, label: 'New Delhi', name: 'Flight POV', location: 'New Delhi, India', marker: 'photo' },
  { ...INTRO_LIVES[3], id: 'south-africa-trail', lat: -33.92, lng: 18.42, count: 2, label: 'Cape Town', name: 'Coastal trail POV', location: 'Cape Town, South Africa' },
  { ...INTRO_LIVES[2], id: 'tokyo-piano', lat: 35.68, lng: 139.69, count: 2, label: 'Tokyo', name: 'Piano POV', location: 'Tokyo, Japan', marker: 'photo' },
  { ...INTRO_LIVES[4], id: 'brazil-flight', lat: -22.91, lng: -43.17, count: 2, label: 'Rio de Janeiro', name: 'Flight POV', location: 'Rio de Janeiro, Brazil', marker: 'photo' },
];

function project(lat, lng, centerLng) {
  const latitude = lat * Math.PI / 180;
  const longitude = (lng - centerLng) * Math.PI / 180;
  return {
    x: Math.cos(latitude) * Math.sin(longitude),
    y: Math.cos(CENTER_LAT) * Math.sin(latitude) - Math.sin(CENTER_LAT) * Math.cos(latitude) * Math.cos(longitude),
    depth: Math.sin(CENTER_LAT) * Math.sin(latitude) + Math.cos(CENTER_LAT) * Math.cos(latitude) * Math.cos(longitude),
  };
}

function readTexture(image) {
  const source = document.createElement('canvas');
  source.width = 1024;
  source.height = 512;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, source.width, source.height);
  return { data: sourceContext.getImageData(0, 0, source.width, source.height).data, width: source.width, height: source.height };
}

function drawGlobe(canvas, texture, centerLng) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let projection = GLOBE_PROJECTIONS.get(canvas);
  if (!projection) {
    const radius = canvas.width / 2;
    const cosCenter = Math.cos(CENTER_LAT);
    const sinCenter = Math.sin(CENTER_LAT);
    const length = canvas.width * canvas.height;
    const longitudeOffsets = new Float32Array(length);
    const textureRows = new Uint32Array(length);
    const lights = new Float32Array(length);
    const alphas = new Uint8Array(length);
    for (let row = 0; row < canvas.height; row += 1) {
      const y = (radius - row - 0.5) / radius;
      for (let column = 0; column < canvas.width; column += 1) {
        const x = (column + 0.5 - radius) / radius;
        const distance = x * x + y * y;
        if (distance >= 1) continue;
        const z = Math.sqrt(1 - distance);
        const latitude = Math.asin(y * cosCenter + z * sinCenter);
        const index = row * canvas.width + column;
        longitudeOffsets[index] = Math.atan2(x, z * cosCenter - y * sinCenter);
        textureRows[index] = Math.min(texture.height - 1, Math.max(0, Math.floor((Math.PI / 2 - latitude) / Math.PI * texture.height))) * texture.width * 4;
        lights[index] = 0.58 + 0.62 * z;
        alphas[index] = Math.min(255, 255 * Math.min(1, (1 - distance) * 35));
      }
    }
    projection = { output: context.createImageData(canvas.width, canvas.height), longitudeOffsets, textureRows, lights, alphas };
    GLOBE_PROJECTIONS.set(canvas, projection);
  }
  const pixels = projection.output.data;
  const longitudeCenter = centerLng * Math.PI / 180;
  for (let index = 0; index < projection.alphas.length; index += 1) {
    const outputIndex = index * 4;
    const alpha = projection.alphas[index];
    if (!alpha) {
      pixels[outputIndex + 3] = 0;
      continue;
    }
    let longitude = longitudeCenter + projection.longitudeOffsets[index] + Math.PI;
    if (longitude < 0) longitude += Math.PI * 2;
    else if (longitude >= Math.PI * 2) longitude -= Math.PI * 2;
    const sourceIndex = projection.textureRows[index] + Math.floor(longitude * texture.width / (Math.PI * 2)) * 4;
    const light = projection.lights[index];
    pixels[outputIndex] = Math.min(255, texture.data[sourceIndex] * light + 5);
    pixels[outputIndex + 1] = Math.min(255, texture.data[sourceIndex + 1] * light + 12);
    pixels[outputIndex + 2] = Math.min(255, texture.data[sourceIndex + 2] * light + 25);
    pixels[outputIndex + 3] = alpha;
  }
  context.putImageData(projection.output, 0, 0);
}

export default function GlobeLayerCanvas({ phase, visible, preload, reducedMotion, autoSelect, onCloseChef, onSelectLive }) {
  const t = useIntroCopy();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textureRef = useRef(null);
  const centerLngRef = useRef(START_LNG);
  const markerRefs = useRef(new Map());
  const pointRefs = useRef([]);
  const framesRef = useRef(new Map());
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [size, setSize] = useState({ width: 390, height: 844 });
  const [textureReady, setTextureReady] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [selectedLive, setSelectedLive] = useState(null);
  const [pressingWatch, setPressingWatch] = useState(false);
  const hasShownRef = useRef(false);
  if (visible) hasShownRef.current = true;

  useEffect(() => {
    if (!preload || !canvasRef.current) return undefined;
    let cancelled = false;
    const image = new Image();
    let idleHandle;
    const scheduleFrame = window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback)
      : (callback) => window.setTimeout(callback, 40);
    const cancelFrame = window.cancelIdleCallback
      ? (handle) => window.cancelIdleCallback(handle)
      : (handle) => window.clearTimeout(handle);
    image.onload = async () => {
      if (cancelled || !canvasRef.current) return;
      textureRef.current = readTexture(image);
      drawGlobe(canvasRef.current, textureRef.current, START_LNG);
      setTextureReady(true);
      const firstFrame = await createImageBitmap(canvasRef.current);
      if (cancelled) {
        firstFrame.close();
        return;
      }
      framesRef.current.set(0, firstFrame);
      const workCanvas = document.createElement('canvas');
      workCanvas.width = canvasRef.current.width;
      workCanvas.height = canvasRef.current.height;
      let nextFrame = 1;
      const buildFrame = async () => {
        if (cancelled || visibleRef.current) return;
        if (nextFrame <= FRAME_COUNT) {
          drawGlobe(workCanvas, textureRef.current, START_LNG - nextFrame * FRAME_STEP);
          const bitmap = await createImageBitmap(workCanvas);
          if (cancelled) {
            bitmap.close();
            return;
          }
          framesRef.current.set(nextFrame, bitmap);
          nextFrame += 1;
        }
        if (nextFrame <= FRAME_COUNT) idleHandle = scheduleFrame(buildFrame);
      };
      idleHandle = scheduleFrame(buildFrame);
    };
    image.src = TEXTURE;
    return () => {
      cancelled = true;
      if (idleHandle) cancelFrame(idleHandle);
      framesRef.current.forEach((bitmap) => bitmap.close());
      framesRef.current.clear();
    };
  }, [preload]);

  useEffect(() => {
    if (!visible) {
      centerLngRef.current = START_LNG;
      return undefined;
    }
    const updateFrame = (longitude) => {
      centerLngRef.current = longitude;
      if (canvasRef.current && textureRef.current) {
        const target = Math.round((START_LNG - longitude) / FRAME_STEP);
        let cached = framesRef.current.get(target);
        if (!cached) {
          for (let distance = 1; distance <= FRAME_COUNT && !cached; distance += 1) {
            cached = framesRef.current.get(target - distance) ?? framesRef.current.get(target + distance);
          }
        }
        if (cached) {
          const context = canvasRef.current.getContext('2d');
          context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          context.drawImage(cached, 0, 0);
        }
      }
      GLOBE_LIVES.forEach((live) => {
        const element = markerRefs.current.get(live.id);
        if (!element) return;
        const position = project(live.lat, live.lng, longitude);
        element.style.left = `${50 + position.x * 50}%`;
        element.style.top = `${50 - position.y * 50}%`;
        element.style.visibility = position.depth > 0 ? 'visible' : 'hidden';
      });
      EXTRA_POINTS.forEach((point, index) => {
        const element = pointRefs.current[index];
        if (!element) return;
        const position = project(point.lat, point.lng, longitude);
        element.style.left = `${50 + position.x * 50}%`;
        element.style.top = `${50 - position.y * 50}%`;
        element.style.visibility = position.depth > 0 ? 'visible' : 'hidden';
      });
    };
    if (phase === 'globechef') {
      updateFrame(START_LNG);
      return undefined;
    }
    if (reducedMotion) {
      updateFrame(END_LNG);
      return undefined;
    }
    let frame;
    let startedAt;
    const rotate = (now) => {
      if (startedAt === undefined) startedAt = now;
      const progress = Math.min((now - startedAt) / 2350, 1);
      const eased = progress * progress * (3 - 2 * progress);
      updateFrame(START_LNG + (END_LNG - START_LNG) * eased);
      if (progress < 1) frame = requestAnimationFrame(rotate);
    };
    updateFrame(START_LNG);
    const rotationTimer = setTimeout(() => { frame = requestAnimationFrame(rotate); }, 650);
    return () => {
      clearTimeout(rotationTimer);
      cancelAnimationFrame(frame);
    };
  }, [phase, visible, reducedMotion]);

  useEffect(() => {
    if (!preload || !containerRef.current) return undefined;
    const container = containerRef.current;
    const measure = () => setSize({ width: container.clientWidth, height: container.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [preload]);

  useEffect(() => {
    if (!visible) {
      const resetTimer = setTimeout(() => {
        setZoomed(false);
        setSelectedLive(null);
        setPressingWatch(false);
      }, 900);
      return () => clearTimeout(resetTimer);
    }
    if (phase === 'globechef') {
      setSelectedLive(null);
      setPressingWatch(false);
      setZoomed(false);
      const zoomTimer = setTimeout(() => setZoomed(true), reducedMotion ? 0 : 650);
      const cardTimer = setTimeout(() => setSelectedLive(CHEF_LIVE), reducedMotion ? 150 : 2150);
      return () => {
        clearTimeout(zoomTimer);
        clearTimeout(cardTimer);
      };
    }
    setSelectedLive(null);
    setPressingWatch(false);
    setZoomed(false);
    if (!autoSelect) return undefined;
    const zoomTimer = setTimeout(() => setZoomed(true), reducedMotion ? 0 : 3100);
    return () => clearTimeout(zoomTimer);
  }, [phase, visible, reducedMotion, autoSelect]);

  useEffect(() => {
    if (phase !== 'globechef' || !autoSelect || selectedLive?.id !== CHEF_LIVE.id) return undefined;
    const timer = setTimeout(() => {
      setSelectedLive(null);
      onCloseChef();
    }, reducedMotion ? 700 : 3100);
    return () => clearTimeout(timer);
  }, [phase, autoSelect, selectedLive, reducedMotion, onCloseChef]);

  useEffect(() => {
    if (phase !== 'globe' || !autoSelect || !selectedLive || pressingWatch) return undefined;
    const timer = setTimeout(() => setPressingWatch(true), reducedMotion ? 200 : 650);
    return () => clearTimeout(timer);
  }, [phase, autoSelect, selectedLive, pressingWatch, reducedMotion]);

  useEffect(() => {
    if (phase !== 'globe' || !selectedLive || !pressingWatch) return undefined;
    const timer = setTimeout(() => onSelectLive(selectedLive), reducedMotion ? 200 : 550);
    return () => clearTimeout(timer);
  }, [phase, selectedLive, pressingWatch, reducedMotion, onSelectLive]);

  const diameter = Math.min(size.width * 1.15, 460);
  const focusLive = phase === 'globechef' ? CHEF_LIVE : selectedLive ?? FIREFIGHTER_LIVE;
  const focus = project(focusLive.lat, focusLive.lng, phase === 'globechef' ? START_LNG : END_LNG);
  const scale = reducedMotion ? 1.75 : phase === 'globechef' ? 1.7 : 2;
  const offsetX = -focus.x * diameter * scale / 2;
  const offsetY = -size.height * 0.06 + scale * (size.height * 0.04 + focus.y * diameter / 2);

  return (
    <AnimatePresence>
      {(visible || preload) && (
        <motion.div
          ref={containerRef}
          className={'introv2-globe' + (visible ? ' introv2-globe--visible' : ' introv2-globe--preload') + (zoomed ? ' introv2-globe--zoomed' : '')}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: visible ? 1 : 0, scale: visible || hasShownRef.current ? 1 : 0.94 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ duration: reducedMotion ? 0.2 : 0.8, ease: EASE }}
        >
          <div className="introv2-globe__stars" />
          {visible && (
            <div className="introv2-globe__tabs" aria-hidden="true">
              <span className="is-active">Live</span><span>{t.globe.recent}</span><span>{t.globe.upcoming}</span>
            </div>
          )}
          {phase === 'globechef' && visible && !selectedLive && (
            <motion.div
              className="introv2-globe__chef-location"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.3, duration: 0.4, ease: EASE }}
              aria-hidden="true"
            >
              <MapPin size={13} strokeWidth={2} /> Moody Rooster · Wolverhampton
            </motion.div>
          )}
          <motion.div
            className="introv2-globe__world"
            animate={zoomed ? { scale, x: offsetX, y: offsetY } : { scale: 1, x: 0, y: 0 }}
            transition={{ duration: reducedMotion ? 0.2 : 1.15, ease: [0.32, 0, 0.17, 1] }}
            onAnimationComplete={() => {
              if (phase === 'globe' && zoomed && !selectedLive) setSelectedLive(FIREFIGHTER_LIVE);
            }}
          >
            <div className="introv2-globe__orb" style={{ width: diameter, height: diameter }}>
              <canvas ref={canvasRef} width="300" height="300" className={textureReady ? 'is-ready' : ''} />
              <div className="introv2-globe__atmosphere" />
              {visible && EXTRA_POINTS.map((point, index) => {
                const position = project(point.lat, point.lng, centerLngRef.current);
                return <span key={index} ref={(element) => { pointRefs.current[index] = element; }} className="introv2-globe__point" style={{ left: `${50 + position.x * 50}%`, top: `${50 - position.y * 50}%`, visibility: position.depth > 0 ? 'visible' : 'hidden' }} />;
              })}
              {visible && GLOBE_LIVES.map((live) => {
                const position = project(live.lat, live.lng, centerLngRef.current);
                return (
                <div
                  key={live.id}
                  ref={(element) => { if (element) markerRefs.current.set(live.id, element); else markerRefs.current.delete(live.id); }}
                  className={'introv2-globe__cluster' + (live.featured ? ' introv2-globe__cluster--featured' : '') + (selectedLive?.id === live.id || (phase === 'globechef' && live.id === CHEF_LIVE.id) ? ' introv2-globe__cluster--selected' : '') + (live.marker === 'photo' || live.id === 'firefighter' || live.id === 'piano' || live.id === 'wingsuit' ? ' introv2-globe__cluster--photo' : '')}
                  style={{ left: `${50 + position.x * 50}%`, top: `${50 - position.y * 50}%`, visibility: position.depth > 0 ? 'visible' : 'hidden' }}
                >
                  <button
                    type="button"
                    className="introv2-globe__cluster-button"
                    onClick={() => {
                      if (phase === 'globe' && live.id === FIREFIGHTER_LIVE.id) setZoomed(true);
                      else setSelectedLive(live);
                    }}
                    aria-label={t.globe.cluster(live.label, live.count)}
                  >
                    {live.marker === 'photo' || live.id === 'firefighter' || live.id === 'piano' || live.id === 'wingsuit'
                      ? <span className="introv2-globe__cluster-thumb"><img src={live.poster} alt="" /></span>
                      : <span className="introv2-globe__cluster-bubble"><strong>{live.count}</strong><span>LIVE</span></span>}
                    <span className="introv2-globe__cluster-stem" />
                    <span className="introv2-globe__cluster-dot" />
                    {phase === 'globe' && live.id === FIREFIGHTER_LIVE.id && autoSelect && !zoomed && !reducedMotion && (
                      <motion.span
                        className="introv2-globe__fire-cursor"
                        initial={{ opacity: 0, x: 18, y: 18, scale: 1 }}
                        animate={{ opacity: [0, 1, 1], x: [18, 0, 0], y: [18, 0, 0], scale: [1, 1, 0.75] }}
                        transition={{ delay: 2.4, duration: 0.7, times: [0, 0.7, 1], ease: EASE }}
                      ><MousePointer2 size={22} fill="white" strokeWidth={1.5} /></motion.span>
                    )}
                  </button>
                </div>
              );
              })}
            </div>
          </motion.div>
          <div className="introv2-globe__vignette" />
          <AnimatePresence>
            {visible && selectedLive && (
              <motion.div
                className="introv2-globe__live-card"
                initial={{ opacity: 0, y: 22, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: reducedMotion ? 0.2 : 0.55, ease: EASE }}
              >
                <img className="introv2-globe__live-card-poster" src={selectedLive.poster} alt={`${selectedLive.name} POV`} />
                <div className="introv2-globe__live-card-copy">
                  <span className="introv2-globe__live-card-category"><span className="introv2-globe__live-card-dot" />{t.globe.categories[selectedLive.category] ?? selectedLive.category}</span>
                  <strong>{t.globe.title(selectedLive.id === 'firefighter' ? (t.globe.categories.Emergency) : selectedLive.name)}</strong>
                  <span className="introv2-globe__live-card-location">{selectedLive.name} · {selectedLive.location}</span>
                  <span className="introv2-globe__live-card-viewers">{t.globe.viewers(selectedLive.viewers)}</span>
                  <button type="button" className={'introv2-globe__live-card-watch' + (pressingWatch ? ' is-pressed' : '')} onClick={() => setPressingWatch(true)} aria-label={t.globe.watchLive(selectedLive.name)}>
                    <Play size={13} fill="currentColor" strokeWidth={0} /> {t.globe.watch}
                    {phase === 'globe' && <MousePointer2 size={16} strokeWidth={2.4} className="introv2-globe__live-card-cursor" />}
                  </button>
                </div>
                <button type="button" className="introv2-globe__live-card-close" onClick={() => {
                  setSelectedLive(null);
                  setPressingWatch(false);
                  if (phase === 'globechef') onCloseChef();
                }} aria-label={t.globe.close}>
                  <X size={15} strokeWidth={1.7} />
                  {phase === 'globechef' && autoSelect && !reducedMotion && (
                    <motion.span
                      className="introv2-globe__close-cursor"
                      initial={{ opacity: 0, x: 16, y: 18, scale: 1 }}
                      animate={{ opacity: [0, 1, 1, 1], x: [16, 16, 0, 0], y: [18, 18, 0, 0], scale: [1, 1, 1, 0.7] }}
                      transition={{ delay: 1.65, duration: 1.1, times: [0, 0.2, 0.75, 1], ease: EASE }}
                    ><MousePointer2 size={22} fill="white" strokeWidth={1.5} /></motion.span>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {visible && (
            <>
              <div className="introv2-globe__zoom-controls" aria-hidden="true"><span>+</span><span>−</span></div>
              {!selectedLive && <div className="introv2-globe__filters" aria-hidden="true">☷&nbsp; {t.globe.filters} <span>⌃</span></div>}
              <IntroBottomNav active="Globe" />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
