import Globe from 'react-globe.gl';
import { LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { enrichExperience } from '../../data/experienceTaxonomy.js';
import { analyticsService } from '../../services/analytics/analyticsService.ts';

const INITIAL_POV = { lat: 28, lng: 14, altitude: 1.8 };

const FAMILY_COLORS = {
  earth: '#18F064',
  water: '#18D9D1',
  air: '#1677FF',
};

const TRAIL_KEYWORDS = ['cycling', 'hiking', 'sailing', 'kayak', 'ski', 'boat', 'run', 'board'];

function viewersNumber(stream) {
  if (!stream.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

function familyColor(live) {
  return FAMILY_COLORS[live.family] ?? '#2BD9C8';
}

function clusterLives(lives, altitude) {
  if (altitude < 0.9) {
    const individuals = lives.slice(0, 100).sort((a, b) => viewersNumber(b) - viewersNumber(a));
    return { clusters: [], individuals };
  }

  const gridDeg = altitude > 1.5 ? 18 : 8;

  const cells = new Map();
  for (const live of lives) {
    const cellLat = Math.floor(live.lat / gridDeg) * gridDeg + gridDeg / 2;
    const cellLng = Math.floor(live.lng / gridDeg) * gridDeg + gridDeg / 2;
    const key = `${cellLat}|${cellLng}`;
    if (!cells.has(key)) {
      cells.set(key, { lat: cellLat, lng: cellLng, lives: [] });
    }
    cells.get(key).lives.push(live);
  }

  const clusters = [];
  const individuals = [];

  for (const [, cell] of cells) {
    if (cell.lives.length >= 2) {
      const sorted = cell.lives.slice().sort((a, b) => viewersNumber(b) - viewersNumber(a));
      clusters.push({
        id: `cluster-${cell.lat}-${cell.lng}`,
        lat: cell.lat,
        lng: cell.lng,
        count: cell.lives.length,
        lives: cell.lives,
        rep: sorted[0],
      });
    } else {
      individuals.push(cell.lives[0]);
    }
  }

  const cappedIndividuals = individuals
    .slice()
    .sort((a, b) => viewersNumber(b) - viewersNumber(a))
    .slice(0, 100);

  return { clusters, individuals: cappedIndividuals };
}

function hasTrail(live, index) {
  const sub = (live.subcategory ?? '').toLowerCase();
  const matches = TRAIL_KEYWORDS.some((k) => sub.includes(k));
  return matches && index % 5 === 0;
}

function trailBearing(live) {
  return ((live.lat * 37 + live.lng * 61) % 360 + 360) % 360;
}

function trailArcForLive(live) {
  const bearing = trailBearing(live);
  const dist = 0.9;
  const radBearing = (bearing * Math.PI) / 180;
  const startLat = live.lat - Math.cos(radBearing) * dist;
  const startLng = live.lng - Math.sin(radBearing) * dist;
  const color = familyColor(live);
  return {
    id: `trail-${live.id}`,
    startLat,
    startLng,
    endLat: live.lat,
    endLng: live.lng,
    color: [`${color}00`, `${color}cc`],
  };
}

export default function GlobeCinematic({ streams, onboarding = false, onOnboardingLiveSelect }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const globeRef = useRef(null);
  const shellRef = useRef(null);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [altitude, setAltitude] = useState(INITIAL_POV.altitude);
  const [selectedLive, setSelectedLive] = useState(null);
  const [mode, setMode] = useState('live');

  const selectLiveRef = useRef(null);
  const handleClusterClickRef = useRef(null);

  const enrichedStreams = useMemo(() => {
    return streams
      .filter((s) => Array.isArray(s.coordinates) && s.coordinates.length >= 2)
      .map((s) => {
        const enriched = enrichExperience(s);
        return {
          ...enriched,
          lat: s.coordinates[1],
          lng: s.coordinates[0],
        };
      });
  }, [streams]);

  const filteredStreams = useMemo(() => {
    if (mode === 'live') return enrichedStreams.filter((s) => s.status === 'live');
    if (mode === 'recent') return enrichedStreams.filter((s) => s.status === 'ended' || s.status === 'live');
    if (mode === 'upcoming') return enrichedStreams.filter((s) => s.status === 'upcoming' || s.status === 'live');
    return enrichedStreams;
  }, [enrichedStreams, mode]);

  const { clusters, individuals } = useMemo(() => clusterLives(filteredStreams, altitude), [filteredStreams, altitude]);

  const trailArcs = useMemo(() => {
    const arcs = [];
    filteredStreams.forEach((live, i) => {
      if (hasTrail(live, i)) arcs.push(trailArcForLive(live));
    });
    return arcs;
  }, [filteredStreams]);

  const htmlElementsData = useMemo(() => {
    const clusterItems = clusters.map((c) => ({ ...c, _type: 'cluster' }));
    const individualItems = individuals.map((l) => ({ ...l, _type: 'individual' }));
    return [...clusterItems, ...individualItems];
  }, [clusters, individuals]);

  const ringsData = useMemo(() => individuals.slice(0, 150), [individuals]);

  // Update refs to avoid stale closures in htmlElement callback
  const selectLive = useCallback((live) => {
    analyticsService.trackGlobePinClicked(
      live.id,
      live.creatorUid ?? live.creatorId ?? live.creator ?? live.id ?? '',
      live.lat,
      live.lng,
    );
    setSelectedLive(live);
    onOnboardingLiveSelect?.(live.id);
    globeRef.current?.pointOfView({ lat: live.lat, lng: live.lng, altitude: 0.6 }, 800);
  }, [onOnboardingLiveSelect]);

  const handleClusterClick = useCallback((cluster) => {
    const globe = globeRef.current;
    if (!globe) return;
    const current = globe.pointOfView();
    globe.pointOfView({ lat: cluster.lat, lng: cluster.lng, altitude: current.altitude * 0.45 }, 800);
  }, []);

  useEffect(() => {
    selectLiveRef.current = selectLive;
  }, [selectLive]);

  useEffect(() => {
    handleClusterClickRef.current = handleClusterClick;
  }, [handleClusterClick]);

  // Stable htmlElement callback using refs
  const htmlElement = useCallback((item) => {
    const el = document.createElement('div');

    el.style.pointerEvents = 'auto';

    if (item._type === 'cluster') {
      el.className = 'cine-cluster';
      el.innerHTML = `<span class="cine-cluster__count">${item.count}</span><span class="cine-cluster__label">LIVE</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleClusterClickRef.current?.(item);
      });
    } else {
      const color = familyColor(item);
      el.className = 'cine-avatar';
      el.style.setProperty('--cine-color', color);
      el.innerHTML = `
        <div class="cine-avatar__halo"></div>
        <div class="cine-avatar__ring"></div>
        <img class="cine-avatar__img" src="${item.image ?? ''}" alt="" loading="lazy" />
        <span class="cine-avatar__badge">LIVE</span>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectLiveRef.current?.(item);
      });
    }

    return el;
  }, []);

  // Altitude tracking
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return undefined;

    const controls = globe.controls();
    if (!controls) return undefined;

    const onControlChange = () => {
      const pov = globe.pointOfView();
      if (pov?.altitude !== undefined) {
        setAltitude((prev) => (Math.abs(prev - pov.altitude) > 0.12 ? pov.altitude : prev));
      }
    };

    controls.addEventListener('change', onControlChange);
    return () => controls.removeEventListener('change', onControlChange);
  }, []);

  // Configure controls after mount
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    if (!controls) return;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 120;
    controls.maxDistance = 550;
  }, []);

  // ResizeObserver
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  // Handle requested live from URL
  useEffect(() => {
    const requestedId = searchParams.get('live');
    if (!requestedId) return;
    const live = enrichedStreams.find((s) => s.id === requestedId);
    if (live) {
      setSelectedLive(live);
      globeRef.current?.pointOfView({ lat: live.lat, lng: live.lng, altitude: 0.6 }, 800);
    }
  }, [enrichedStreams, searchParams]);

  const recenter = () => {
    globeRef.current?.pointOfView(INITIAL_POV, 1200);
    setSelectedLive(null);
  };

  const zoomBy = (delta) => {
    const globe = globeRef.current;
    if (!globe) return;
    const pov = globe.pointOfView();
    const nextAlt = Math.max(0.05, Math.min(10, pov.altitude - delta));
    globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: nextAlt }, 500);
  };

  const ringColorFn = useCallback((live) => {
    const color = familyColor(live);
    return (t) => (t < 0.5 ? `${color}aa` : `${color}22`);
  }, []);

  return (
    <section
      className="screen test-globe-screen test-globe-screen--maplibre test-globe-screen--actual globe-cinematic-screen"
      aria-label="Globe cinématographique"
    >
      <div ref={shellRef} className="test-old-globe globe-cinematic">
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeImageUrl="/assets/globe/earth-night.jpg"
          bumpImageUrl="/assets/globe/earth-bump.jpg"
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#1a4270"
          atmosphereAltitude={0.35}
          pointOfView={INITIAL_POV}
          // HTML markers
          htmlElementsData={htmlElementsData}
          htmlLat={(d) => d.lat}
          htmlLng={(d) => d.lng}
          htmlAltitude={0.001}
          htmlElement={htmlElement}
          htmlTransitionDuration={0}
          // Rings
          ringsData={ringsData}
          ringLat={(d) => d.lat}
          ringLng={(d) => d.lng}
          ringColor={ringColorFn}
          ringMaxRadius={3}
          ringPropagationSpeed={1.8}
          ringRepeatPeriod={1600}
          ringAltitude={0.001}
          // Trail arcs
          arcsData={trailArcs}
          arcStartLat={(d) => d.startLat}
          arcStartLng={(d) => d.startLng}
          arcEndLat={(d) => d.endLat}
          arcEndLng={(d) => d.endLng}
          arcColor={(d) => d.color}
          arcAltitude={0.001}
          arcDashAnimateTime={1800}
          arcStroke={0.5}
          // Globe click
          onGlobeClick={() => setSelectedLive(null)}
        />

        <div className="vuvio-shooting-stars" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="test-old-globe__vignette globe-cinematic__vignette" />
        <div className="globe-cinematic__atmosphere" aria-hidden="true" />

        {!onboarding ? (
          <div className="map-engine-switch test-globe-switch" role="group" aria-label="Choose globe">
            <button type="button" onClick={() => navigate('/globe')} aria-pressed={false}>Current</button>
            <button type="button" className="is-active" onClick={() => navigate('/globe-test-2')} aria-pressed={true}>Test 2</button>
            <button type="button" onClick={() => navigate('/globe-lab')} aria-pressed={false}>Lab</button>
            <button type="button" onClick={() => navigate('/globe-cesium')} aria-pressed={false}>Cesium</button>
            <button type="button" onClick={() => navigate('/globe-test')} aria-pressed={false}>Test</button>
          </div>
        ) : null}

        {!onboarding ? (
          <div className="cine-modebar" role="group" aria-label="Mode filter">
            <button
              type="button"
              className={mode === 'live' ? 'is-active' : ''}
              onClick={() => setMode('live')}
            >
              LIVE
            </button>
            <button
              type="button"
              className={mode === 'recent' ? 'is-active' : ''}
              onClick={() => setMode('recent')}
            >
              RECENT
            </button>
            <button
              type="button"
              className={mode === 'upcoming' ? 'is-active' : ''}
              onClick={() => setMode('upcoming')}
            >
              UPCOMING
            </button>
          </div>
        ) : null}

        {!onboarding ? (
          <div className="test-old-globe__controls" aria-label="Map controls">
            <button type="button" onClick={() => zoomBy(0.4)} aria-label="Zoom in"><Plus size={19} /></button>
            <button type="button" onClick={() => zoomBy(-0.4)} aria-label="Zoom out"><Minus size={19} /></button>
            <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={19} /></button>
          </div>
        ) : null}

        {selectedLive ? (
          <aside className="test-globe-card" aria-label={`Live from ${selectedLive.name ?? ''}`}>
            <button
              type="button"
              className="test-globe-card__close"
              onClick={() => setSelectedLive(null)}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2} />
            </button>
            <img src={selectedLive.image ?? ''} alt="" loading="lazy" />
            <div className="test-globe-card__body">
              <div className="test-globe-card__info">
                <span
                  className="test-globe-card__tag"
                  style={{ '--experience-color': selectedLive.familyColor }}
                >
                  <i />
                  {selectedLive.subcategory}
                </span>
                <h2>{selectedLive.experienceTitle}</h2>
                <p>{selectedLive.name} · {selectedLive.city}, {selectedLive.country}</p>
                <strong>{selectedLive.viewers} viewers</strong>
              </div>
              <div className="test-globe-card__actions">
                <button
                  type="button"
                  className="test-globe-card__watch"
                  onClick={() => navigate(`/watch?live=${encodeURIComponent(selectedLive.id)}&mode=view`)}
                >
                  <Play size={13} fill="currentColor" strokeWidth={1.8} />
                  Watch Live
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
