import Globe from 'react-globe.gl';
import { Eye, LocateFixed, Minus, Plus, Radio, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import airIconRaw from '../../assets/icons/air/drone.svg?raw';
import earthIconRaw from '../../assets/icons/terre/terre.svg?raw';
import waterIconRaw from '../../assets/icons/eau/eau.svg?raw';
import { EXPERIENCE_FILTERS, enrichExperience, getFamily, getPovType } from '../../data/experienceTaxonomy.js';
import { worldCountries } from '../../data/worldCountries.js';
import { borderConfig, createBorderConfig } from '../../config/borderConfig.js';
import { resolveCreatorProfile } from '../../services/profileService.js';

const familyFilterIcons = {
  air: airIconRaw,
  earth: earthIconRaw,
  water: waterIconRaw,
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
  const family = getFamily(live.family);
  const pov = getPovType(live.povType);
  const profile = resolveCreatorProfile(live);

  return (
    <aside className="globe-lab-card" aria-label={`Selected live: ${live.experienceTitle}`}>
      <button type="button" className="globe-lab-card__close" onClick={onClose} aria-label="Close card">
        x
      </button>
      <header>
        <img src={live.image || '/assets/icons/icon-192.png'} alt="" />
        <div>
          <strong>{live.name}</strong>
          <small>
            {live.city}, {live.country}
          </small>
        </div>
      </header>
      <span className="globe-lab-card__badge is-live" style={{ '--experience-color': family.color }}>
        <i className={`is-${family.shape}`} />
        {live.subcategory} · {pov.label}
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

export default function VuvioGlobeLab({ streams }) {
  const navigate = useNavigate();
  const globeRef = useRef(null);
  const shellRef = useRef(null);
  const rotationResumeTimerRef = useRef(null);
  const { width, height } = useElementSize(shellRef);
  const [activeFamily, setActiveFamily] = useState('all');
  const [selectedLive, setSelectedLive] = useState(null);

  // Lab border controls
  const [borderSettings, setBorderSettings] = useState(borderConfig);
  const [showBorderControls, setShowBorderControls] = useState(false);

  const livePoints = useMemo(() => {
    return streams
      .map(enrichExperience)
      .filter((stream) => stream.status === 'live')
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .map((stream) => {
        const family = getFamily(stream.family);
        return {
          ...stream,
          lat: stream.coordinates[1],
          lng: stream.coordinates[0],
          color: family.color,
        };
      });
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
    renderer?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2.5));

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
    pauseAndMove({ lat: live.lat, lng: live.lng, altitude: 0.34 }, 1250, 6500);
  };

  const showGlobeSwitcher = true;


  return (
    <section className="globe-lab-screen" aria-label="Prototype react-globe.gl Vuvio">
      <div className="globe-lab-shell" ref={shellRef}>
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/globe/earth-night.jpg"
          bumpImageUrl="/globe/earth-bump.jpg"
          showAtmosphere
          atmosphereColor="#4ba3d8"
          atmosphereAltitude={0.25}
          pointsData={livePoints}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={(live) => (live.family === 'air' ? 0.038 : live.family === 'water' ? 0.020 : 0.024)}
          pointRadius={(live) => Math.min(0.38, 0.118 + viewersNumber(live) / 8600)}
          pointColor={(live) => live.color}
          pointResolution={36}
          pointsTransitionDuration={200}
          pointsMerge={false}
          ringsData={livePoints}
          ringLat="lat"
          ringLng="lng"
          ringAltitude={0.016}
          ringColor={(live) => (time) => `${live.color}${time < 0.48 ? 'aa' : '28'}`}
          ringMaxRadius={(live) => (live.family === 'air' ? 2.8 : 2.1)}
          ringPropagationSpeed={1.65}
          ringRepeatPeriod={1350}
          polygonsData={borderSettings.enabled ? worldCountries.features : []}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={() => borderSettings.fillColor}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => borderSettings.color}
          polygonAltitude={borderSettings.altitude}
          polygonsTransitionDuration={borderSettings.transitionDuration}
          onPointClick={selectLive}
          enablePointerInteraction
        />
        <div className="globe-lab-overlay" aria-hidden="true" />

        {showGlobeSwitcher ? (
          <div className="map-engine-switch globe-lab-switch" role="group" aria-label="Choose globe">
            <button type="button" onClick={() => navigate('/globe?switch=1')} aria-pressed="false">
              Current
            </button>
            <button type="button" className="is-active" aria-pressed="true">
              Lab
            </button>
            <button type="button" onClick={() => navigate('/globe-cesium?switch=1')} aria-pressed="false">
              Cesium
            </button>
            <button type="button" onClick={() => navigate('/globe-test?switch=1')} aria-pressed="false">
              Test
            </button>
            <button type="button" onClick={() => navigate('/globe-test-2?switch=1')} aria-pressed="false">
              Test 2
            </button>
          </div>
        ) : null}

        {/* Border Lab Controls */}
        <button
          type="button"
          className="globe-lab-border-toggle"
          onClick={() => setShowBorderControls(!showBorderControls)}
          aria-label="Toggle border controls"
          title="Border Lab Controls"
        >
          ⚙️
        </button>

        {showBorderControls && (
          <div className="globe-lab-border-controls">
            <div className="border-control-group">
              <label>
                <input
                  type="checkbox"
                  checked={borderSettings.enabled}
                  onChange={(e) => setBorderSettings({ ...borderSettings, enabled: e.target.checked })}
                />
                <span>Show Borders</span>
              </label>
            </div>

            <div className="border-control-group">
              <label>
                Opacity:
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={parseFloat(borderSettings.color.match(/[\d.]+/g)?.[3] || 0.32)}
                  onChange={(e) => {
                    const opacity = parseFloat(e.target.value);
                    const [r, g, b] = borderSettings.color.match(/\d+/g).map(Number);
                    setBorderSettings({
                      ...borderSettings,
                      color: `rgba(${r}, ${g}, ${b}, ${opacity})`
                    });
                  }}
                />
              </label>
            </div>

            <div className="border-control-group">
              <label>
                Color:
                <input
                  type="color"
                  value={`#${borderSettings.color.match(/\d+/g).slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('')}`.toUpperCase()}
                  onChange={(e) => {
                    const hex = e.target.value.slice(1);
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    const opacity = parseFloat(borderSettings.color.match(/[\d.]+/g)?.[3] || 0.32);
                    setBorderSettings({
                      ...borderSettings,
                      color: `rgba(${r}, ${g}, ${b}, ${opacity})`
                    });
                  }}
                />
              </label>
            </div>

            <div className="border-control-group">
              <label>
                Altitude:
                <input
                  type="range"
                  min="0"
                  max="0.02"
                  step="0.001"
                  value={borderSettings.altitude}
                  onChange={(e) =>
                    setBorderSettings({ ...borderSettings, altitude: parseFloat(e.target.value) })
                  }
                />
                <span className="value">{borderSettings.altitude.toFixed(4)}</span>
              </label>
            </div>

            <div className="border-control-group">
              <label>
                <input
                  type="checkbox"
                  checked={borderSettings.fillColor !== 'rgba(0, 0, 0, 0)'}
                  onChange={(e) => {
                    setBorderSettings({
                      ...borderSettings,
                      fillColor: e.target.checked ? 'rgba(100, 180, 255, 0.08)' : 'rgba(0, 0, 0, 0)'
                    });
                  }}
                />
                <span>Fill Countries</span>
              </label>
            </div>

            <div className="border-control-reset">
              <button
                type="button"
                onClick={() => setBorderSettings(borderConfig)}
                className="reset-btn"
              >
                Reset to Default
              </button>
            </div>
          </div>
        )}

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
          {EXPERIENCE_FILTERS.map((item) => {
            const isAll = item.id === 'all';
            const color = isAll ? 'rgba(242,247,246,0.76)' : item.color;
            const iconSvg = familyFilterIcons[item.id];
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
                {isAll ? (
                  <span className="map-filter-all" aria-hidden="true">All</span>
                ) : (
                  <span className="map-filter-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg }} />
                )}
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
