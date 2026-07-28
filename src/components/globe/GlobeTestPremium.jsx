import Globe from 'react-globe.gl';
import { Eye, LocateFixed, Minus, Plus, Radio, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { worldCountries } from '../../data/worldCountries.js';
import { resolveCreatorProfile } from '../../services/profileService.js';

// Premium theme configuration
const TEST_GLOBE_THEME = {
  oceanColor: '#031827',
  oceanSecondary: '#052B36',
  landColor: '#1D6E79',
  landHighlight: '#55E7DA',
  borderColor: 'rgba(132, 240, 244, 0.68)',
  coastlineColor: 'rgba(97, 211, 232, 0.72)',
  atmosphereColor: '#56F3E9',
  atmosphereIntensity: 0.28,
  landBrightness: 1.08,
  borderOpacity: 0.68,
};

function viewersNumber(stream) {
  if (!stream.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

function formatViewers(stream) {
  const viewers = viewersNumber(stream);
  if (viewers >= 1000) return `${(viewers / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return viewers.toLocaleString('fr-FR');
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 390, height: 620 });

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(320, width), height: Math.max(480, height) });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function GlobeLiveCard({ live, onClose, onWatch }) {
  if (!live) return null;
  const profile = resolveCreatorProfile(live);

  return (
    <aside className="globe-lab-card" aria-label={`Selected live: ${live.experienceTitle}`}>
      <button type="button" className="globe-lab-card__close" onClick={onClose} aria-label="Close card">
        x
      </button>
      <header>
        <img src={live.image || '/icons/icon-192.png'} alt="" />
        <div>
          <strong>{live.name}</strong>
          <small>
            {live.city}, {live.country}
          </small>
        </div>
      </header>
      <span className="globe-lab-card__badge is-live">
        {live.subcategory}
      </span>
      <h2>{live.experienceTitle}</h2>
      <p>
        <Eye size={13} strokeWidth={1.8} />
        {formatViewers(live)} viewers
      </p>
      <footer>
        <button type="button" onClick={() => onWatch(`/profile/${encodeURIComponent(profile.id)}`)}>
          <UserRound size={15} strokeWidth={1.8} />
          Profile
        </button>
        <button type="button" className="is-primary" onClick={() => onWatch(`/discover?live=${encodeURIComponent(live.id)}`)}>
          <Radio size={15} strokeWidth={1.8} />
          Watch
        </button>
      </footer>
    </aside>
  );
}

export default function GlobeTestPremium({ streams, mode = 'test' }) {
  const navigate = useNavigate();
  const globeRef = useRef(null);
  const shellRef = useRef(null);
  const rotationResumeTimerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const { width, height } = useElementSize(shellRef);
  const [activeFamily, setActiveFamily] = useState('all');
  const [selectedLive, setSelectedLive] = useState(null);
  const [hoveredLive, setHoveredLive] = useState(null);
  const isActualMode = mode === 'actual';
  const isTestMode = mode === 'test';

  const livePoints = useMemo(() => {
    return streams
      .map(enrichExperience)
      .filter((stream) => stream.status === 'live')
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .map((stream) => ({
        ...stream,
        lat: stream.coordinates[1],
        lng: stream.coordinates[0],
        color: stream.familyColor || '#2BD9C8',
      }));
  }, [activeFamily, streams]);

  const familyCounts = useMemo(() => {
    return streams.map(enrichExperience).reduce(
      (counts, stream) => {
        if (stream.status !== 'live') return counts;
        counts.all += 1;
        counts[stream.family] = (counts[stream.family] ?? 0) + 1;
        return counts;
      },
      { all: 0, air: 0, earth: 0, water: 0 },
    );
  }, [streams]);

  const topLive = useMemo(() => {
    return [...livePoints].sort((a, b) => viewersNumber(b) - viewersNumber(a))[0] ?? null;
  }, [livePoints]);

  const spotlightArcs = useMemo(() => {
    if (!topLive) return [];
    return livePoints
      .filter((live) => live.id !== topLive.id)
      .slice(0, 5)
      .map((live) => ({
        ...live,
        startLat: topLive.lat,
        startLng: topLive.lng,
        endLat: live.lat,
        endLng: live.lng,
      }));
  }, [livePoints, topLive]);

  // Setup globe controls and rendering
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return undefined;

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.34;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 145;
    controls.maxDistance = 470;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.6;

    const renderer = globe.renderer();
    rendererRef.current = renderer;
    renderer?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2.5));

    const scene = globe.scene();
    sceneRef.current = scene;

    // Improve rendering quality
    if (renderer) {
      renderer.setClearColor?.(0x020b15, 0);
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = false; // Disable shadow mapping for performance
      }
    }

    globe.pointOfView({ lat: 18, lng: 26, altitude: 2.05 }, 0);

    const pauseRotation = () => {
      controls.autoRotate = false;
      window.clearTimeout(rotationResumeTimerRef.current);
      rotationResumeTimerRef.current = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 2000);
    };

    const zoomOnDoubleClick = (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const coords = globe.toGlobeCoords(event.clientX - rect.left, event.clientY - rect.top);
      if (!coords) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedLive(null);
      controls.autoRotate = false;
      window.clearTimeout(rotationResumeTimerRef.current);
      const current = globe.pointOfView();
      globe.pointOfView(
        {
          lat: coords.lat,
          lng: coords.lng,
          altitude: Math.max(0.34, current.altitude * 0.46),
        },
        720,
      );
      rotationResumeTimerRef.current = window.setTimeout(() => {
        controls.autoRotate = true;
      }, 1800);
    };

    const canvas = globe.renderer()?.domElement;
    canvas?.addEventListener('pointerdown', pauseRotation);
    canvas?.addEventListener('wheel', pauseRotation, { passive: true });
    canvas?.addEventListener('dblclick', zoomOnDoubleClick);

    return () => {
      window.clearTimeout(rotationResumeTimerRef.current);
      canvas?.removeEventListener('pointerdown', pauseRotation);
      canvas?.removeEventListener('wheel', pauseRotation);
      canvas?.removeEventListener('dblclick', zoomOnDoubleClick);
    };
  }, []);

  const pauseAndMove = (pointOfView, duration = 620, resumeDelay = 1400) => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = false;
    globe.pointOfView(pointOfView, duration);
    window.clearTimeout(rotationResumeTimerRef.current);
    rotationResumeTimerRef.current = window.setTimeout(() => {
      controls.autoRotate = true;
    }, duration + resumeDelay);
  };

  const recenter = () => {
    setSelectedLive(null);
    pauseAndMove({ lat: 18, lng: 26, altitude: 2.05 }, 760);
  };

  const zoomBy = (delta) => {
    const globe = globeRef.current;
    if (!globe) return;
    const current = globe.pointOfView();
    pauseAndMove({
      lat: current.lat,
      lng: current.lng,
      altitude: Math.max(0.34, Math.min(3.2, current.altitude + delta)),
    });
  };

  const selectLive = (live) => {
    setSelectedLive(live);
    setHoveredLive(null);
    pauseAndMove({ lat: live.lat, lng: live.lng, altitude: 0.34 }, 1250, 6500);
  };

  return (
    <section className="globe-lab-screen" aria-label="Test Vuvio globe premium">
      <div className="globe-lab-shell" ref={shellRef}>
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/globe/earth-night.jpg"
          bumpImageUrl="/globe/earth-bump.jpg"
          showAtmosphere
          atmosphereColor={TEST_GLOBE_THEME.atmosphereColor}
          atmosphereAltitude={0.28}
          arcsData={spotlightArcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(live) => [topLive?.color || '#56F3E9', live.color]}
          arcAltitude={0.22}
          arcStroke={0.52}
          arcDashLength={0.34}
          arcDashGap={0.74}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={4600}
          pointsData={livePoints}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={(live) => (live.family === 'air' ? 0.058 : live.family === 'water' ? 0.030 : 0.036)}
          pointRadius={(live) => {
            const isFocused = selectedLive?.id === live.id || hoveredLive?.id === live.id;
            return Math.min(isFocused ? 0.72 : 0.56, (isFocused ? 0.28 : 0.18) + viewersNumber(live) / 7600);
          }}
          pointColor={(live) => live.color}
          pointResolution={36}
          pointsTransitionDuration={260}
          pointsMerge={false}
          ringsData={livePoints}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.026}
          ringColor={(live) => (time) => `${live.color}${time < 0.36 ? 'ee' : time < 0.74 ? '88' : '22'}`}
          ringMaxRadius={(live) => (live.family === 'air' ? 3.35 : live.family === 'water' ? 2.85 : 2.45)}
          ringPropagationSpeed={2.05}
          ringRepeatPeriod={1120}
          polygonsData={worldCountries.features}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => TEST_GLOBE_THEME.landColor}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => TEST_GLOBE_THEME.borderColor}
          polygonAltitude={0.012}
          polygonsTransitionDuration={0}
          onPointClick={selectLive}
          onPointHover={(live) => setHoveredLive(live || null)}
          enablePointerInteraction
        />
        <div className="globe-lab-overlay" aria-hidden="true" />

        <div className="globe-lab-status" aria-label={`${familyCounts.all} lives now`}>
          <span>
            <Sparkles size={14} strokeWidth={1.9} />
            Live now
          </span>
          <strong>{familyCounts.all}</strong>
        </div>

        <div className="map-engine-switch globe-lab-switch" role="group" aria-label="Choose globe">
          <button type="button" className={isActualMode ? 'is-active' : ''} onClick={() => navigate('/globe?switch=1')} aria-pressed={isActualMode}>
            Current
          </button>
          <button type="button" onClick={() => navigate('/globe-lab?switch=1')} aria-pressed="false">
            Lab
          </button>
          <button type="button" onClick={() => navigate('/globe-cesium?switch=1')} aria-pressed="false">
            Cesium
          </button>
          <button type="button" className={isTestMode ? 'is-active' : ''} onClick={() => navigate('/globe-test?switch=1')} aria-pressed={isTestMode}>
            Test
          </button>
          <button type="button" onClick={() => navigate('/globe-test-2?switch=1')} aria-pressed="false">
            Test 2
          </button>
        </div>

        <div className="globe-lab-controls" aria-label="Globe controls">
          <button type="button" onClick={() => zoomBy(-0.36)} aria-label="Zoom in">
            <Plus size={19} />
          </button>
          <button type="button" onClick={() => zoomBy(0.36)} aria-label="Zoom out">
            <Minus size={19} />
          </button>
          <button type="button" onClick={recenter} aria-label="Recenter">
            <LocateFixed size={19} />
          </button>
        </div>

        <div className="map-filter-bar globe-lab-filter" role="group" aria-label="Filter experiences">
          {[
            { id: 'all', label: 'All', color: 'rgba(242,247,246,0.76)' },
            { id: 'air', label: 'Air', color: '#00D4FF' },
            { id: 'earth', label: 'Earth', color: '#52D926' },
            { id: 'water', label: 'Water', color: '#FF6B2C' },
          ].map((item) => {
            const isAll = item.id === 'all';
            const color = isAll ? item.color : item.color;
            return (
              <button
                key={item.id}
                type="button"
                className={`${activeFamily === item.id ? 'is-active' : ''} is-${item.id}`}
                style={{ '--experience-color': color }}
                onClick={() => {
                  setActiveFamily(item.id);
                  setSelectedLive(null);
                }}
                aria-pressed={activeFamily === item.id}
                aria-label={item.label}
              >
                {isAll ? <span className="map-filter-all">{item.label}</span> : <span>{item.label}</span>}
                <small>{familyCounts[item.id] ?? 0}</small>
              </button>
            );
          })}
        </div>

        <GlobeLiveCard
          live={selectedLive}
          onClose={recenter}
          onWatch={(path) => navigate(path)}
        />
      </div>
    </section>
  );
}
