import { Bell, LocateFixed, Minus, Play, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EXPERIENCE_FILTERS, enrichExperience } from '../../data/experienceTaxonomy.js';
import MapBottomSheet from '../map/MapBottomSheet.jsx';

// Load Cesium from CDN (avoid Vite bundling issues)
const loadCesium = () => {
  return new Promise((resolve) => {
    if (window.Cesium) {
      resolve(window.Cesium);
    } else {
      const link = document.createElement('link');
      link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js';
      script.onload = () => {
        window.Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
        resolve(window.Cesium);
      };
      document.head.appendChild(script);
    }
  });
};

// Will be initialized after Cesium loads
let INITIAL_CENTER, LIVE_COLOR, UPCOMING_COLOR;

function viewersNumber(stream) {
  if (!stream.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

export default function CesiumGlobe({ streams, mode = 'cesium' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const entitiesRef = useRef({});
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState('');
  const [mapError, setMapError] = useState('');
  const [sheetState, setSheetState] = useState('closed');

  // Performance diagnostics
  const perfRef = useRef({
    renderCount: 0,
    lastReportTime: performance.now(),
  });

  const initRef = useRef(false);
  const enrichedStreams = useMemo(() => streams.map(enrichExperience), [streams]);
  const requestedLiveId = searchParams.get('live') ?? '';
  const requestedLive = useMemo(() => {
    if (!requestedLiveId) return null;
    return enrichedStreams.find((stream) => stream.id === requestedLiveId) ?? null;
  }, [enrichedStreams, requestedLiveId]);

  const liveStreams = useMemo(() => {
    return enrichedStreams
      .filter((stream) => activeStatuses.includes(stream.status))
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .filter((stream) => {
        if (activeActivities.length === 0) return true;
        return activeActivities.some((activityId) => {
          const activity = EXPERIENCE_FILTERS.find((a) => a.id === activityId);
          return activity?.subcategories.includes(stream.subcategory);
        });
      });
  }, [activeActivities, activeFamily, activeStatuses, enrichedStreams]);

  const selectedLive = enrichedStreams.find((stream) => stream.id === selectedId) ?? null;

  const streamCounts = useMemo(() => {
    const byFamily = { all: 0, air: 0, earth: 0, water: 0 };
    const byActivity = {};
    enrichedStreams.forEach((stream) => {
      if (stream.status !== 'live') return;
      byFamily.all += 1;
      if (stream.family) byFamily[stream.family] = (byFamily[stream.family] ?? 0) + 1;
      EXPERIENCE_FILTERS.forEach((activity) => {
        if (activity.subcategories?.includes(stream.subcategory)) {
          byActivity[activity.id] = (byActivity[activity.id] ?? 0) + 1;
        }
      });
    });
    return { total: liveStreams.length, byFamily, byActivity };
  }, [enrichedStreams, liveStreams.length]);

  // Initialize Cesium viewer
  useEffect(() => {
    if (initRef.current || !containerRef.current || viewerRef.current) return undefined;
    initRef.current = true;

    loadCesium().then((Cesium) => {
      // Initialize constants on first load
      if (!INITIAL_CENTER) {
        INITIAL_CENTER = Cesium.Cartesian3.fromDegrees(14, 20, 15000000);
        LIVE_COLOR = Cesium.Color.fromCssColorString('#2BD9C8');
        UPCOMING_COLOR = Cesium.Color.fromCssColorString('#3B82E6');
      }

      try {
        const viewer = new Cesium.Viewer(containerRef.current, {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        selectionIndicator: true,
      });

      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.shadows = Cesium.ShadowMode.RECEIVE;

      viewer.camera.flyTo({ destination: INITIAL_CENTER, duration: 0 });

      viewerRef.current = viewer;

      // Performance monitoring
      const onTick = () => {
        perfRef.current.renderCount++;
        if (performance.now() - perfRef.current.lastReportTime > 3000) {
          const elapsed = (performance.now() - perfRef.current.lastReportTime) / 1000;
          const fps = (perfRef.current.renderCount / elapsed).toFixed(1);
          console.log(`📊 CESIUM PERF: ${fps} FPS | Points: ${liveStreams.length}`);
          perfRef.current.renderCount = 0;
          perfRef.current.lastReportTime = performance.now();
        }
      };

        viewer.scene.postRender.addEventListener(onTick);

        return () => {
          viewer.scene.postRender.removeEventListener(onTick);
          viewer.destroy();
          viewerRef.current = null;
          initRef.current = false;
        };
      } catch (error) {
        setMapError(error instanceof Error ? error.message : String(error));
      }
    }).catch((error) => {
      setMapError('Failed to load Cesium: ' + error.message);
    });
  }, []);

  // Auto-rotate globe when no live is selected
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || selectedId) return;

    const ROTATION_SPEED = 0.5; // degrees per second
    let lastTime = performance.now();
    let animationId;

    const rotate = () => {
      const now = performance.now();
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      try {
        viewer.camera.rotate(Cesium.Axis.Z, Cesium.Math.toRadians(ROTATION_SPEED * deltaSeconds));
      } catch (e) {
        // Rotation might fail during camera transition
      }

      animationId = requestAnimationFrame(rotate);
    };

    animationId = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(animationId);
  }, [selectedId]);

  // Update live streams on viewer
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove old entities
    Object.entries(entitiesRef.current).forEach(([id, entity]) => {
      if (!liveStreams.find((s) => s.id === id)) {
        viewer.entities.remove(entity);
        delete entitiesRef.current[id];
      }
    });

    // Add/update entities
    liveStreams.forEach((stream) => {
      if (entitiesRef.current[stream.id]) return; // Already exists

      const color = stream.status === 'live' ? LIVE_COLOR : UPCOMING_COLOR;
      const position = Cesium.Cartesian3.fromDegrees(
        stream.coordinates[0],
        stream.coordinates[1],
        0
      );

      const transparentColor = color.withAlpha(0.4);
      const glowColor = color.withAlpha(0.2);

      const entity = viewer.entities.add({
        id: stream.id,
        position,
        point: {
          pixelSize: 12,
          color: transparentColor,
          outlineColor: color.withAlpha(0.8),
          outlineWidth: 2.5,
          heightReference: Cesium.HeightReference.NONE,
        },
        properties: {
          id: stream.id,
          name: stream.name,
          city: stream.city,
          country: stream.country,
          title: stream.experienceTitle,
          viewers: stream.viewers,
          status: stream.status,
        },
      });

      const glowEntity = viewer.entities.add({
        position,
        point: {
          pixelSize: 24,
          color: glowColor,
          heightReference: Cesium.HeightReference.NONE,
        },
      });

      entitiesRef.current[stream.id] = entity;
    });
  }, [liveStreams]);

  // Handle click on points and double-click zoom
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((event) => {
      const pickedObject = viewer.scene.pick(event.position);
      if (!Cesium.defined(pickedObject) || !Cesium.defined(pickedObject.id)) return;

      const entity = pickedObject.id;
      if (entity.properties?.id) {
        const streamId = entity.properties.id;
        setSelectedId(streamId);
        const stream = enrichedStreams.find((s) => s.id === streamId);
        if (stream && stream.coordinates) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              stream.coordinates[0],
              stream.coordinates[1],
              1500000
            ),
            duration: 1.5,
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      zoomBy(-0.5);
    }, Cesium.ScreenSpaceEventType.DOUBLE_CLICK);

    return () => handler.destroy();
  }, [enrichedStreams]);

  // Focus on requested live
  useEffect(() => {
    if (!requestedLive) return;

    const viewer = viewerRef.current;
    if (!viewer) return;

    setActiveFamily('all');
    setActiveActivities([]);
    setActiveStatuses((current) =>
      current.includes(requestedLive.status) ? current : [...current, requestedLive.status]
    );
    setSelectedId(requestedLive.id);

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        requestedLive.coordinates[0],
        requestedLive.coordinates[1],
        1500000
      ),
      duration: 2,
    });
  }, [requestedLive]);

  const selectFamily = (nextFamily) => {
    setActiveFamily(nextFamily);
    setSelectedId(null);
    if (nextFamily !== 'all') setActiveActivities([]);
  };

  const selectActivities = (activityId) => {
    setActiveActivities((current) =>
      current.includes(activityId) ? current.filter((id) => id !== activityId) : [...current, activityId]
    );
  };

  const selectStatuses = (status) => {
    setActiveStatuses((current) =>
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status]
    );
  };

  const recenter = () => {
    const viewer = viewerRef.current;
    if (!viewer || !INITIAL_CENTER) return;

    setSelectedId(null);
    viewer.camera.flyTo({
      destination: INITIAL_CENTER,
      duration: 2,
    });
  };

  const zoomBy = (delta) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.camera.target) return;

    const camera = viewer.camera;
    const currentDistance = Cesium.Cartesian3.distance(camera.position, camera.target);
    const newDistance = Math.max(1000000, Math.min(50000000, currentDistance + delta * 1000000));

    const direction = Cesium.Cartesian3.subtract(
      camera.position,
      camera.target,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(direction, direction);
    Cesium.Cartesian3.multiplyByScalar(direction, newDistance, direction);

    camera.flyTo({
      destination: Cesium.Cartesian3.add(camera.target, direction, new Cesium.Cartesian3()),
      duration: 0.5,
    });
  };

  return (
    <section className="test-globe-screen" aria-label="Cesium Globe">
      <div className="test-globe-shell" ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Globe Switcher */}
      <div className="map-engine-switch globe-lab-switch test-globe-switch" role="group" aria-label="Choose globe">
        <button type="button" onClick={() => navigate('/globe')} aria-pressed="false">
          Current
        </button>
        <button type="button" onClick={() => navigate('/globe-lab')} aria-pressed="false">
          Lab
        </button>
        <button type="button" className="is-active" aria-pressed="true">
          Cesium
        </button>
        <button type="button" onClick={() => navigate('/globe-test')} aria-pressed="false">
          Test
        </button>
      </div>

      {!selectedLive && (
        <MapBottomSheet
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
          activeFamily={activeFamily}
          onFamilyChange={selectFamily}
          activeActivities={activeActivities}
          onActivitiesChange={selectActivities}
          activeStatuses={activeStatuses}
          onStatusChange={selectStatuses}
          streamCounts={streamCounts}
        />
      )}

      {selectedLive && (
        <aside className="test-globe-card" aria-label={`Live from ${selectedLive.name}`}>
          <button
            type="button"
            className="test-globe-card__close"
            onClick={() => setSelectedId(null)}
            aria-label="Close"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <img src={selectedLive.image} alt="" loading="lazy" />
          <div className="test-globe-card__body">
            <div className="test-globe-card__info">
              <span className="test-globe-card__tag" style={{ '--experience-color': selectedLive.familyColor }}>
                <i />
                {selectedLive.subcategory}
              </span>
              <h2>{selectedLive.experienceTitle}</h2>
              <p>
                {selectedLive.name} · {selectedLive.city}, {selectedLive.country}
              </p>
              <strong>{selectedLive.viewers} viewers</strong>
            </div>
            <div className="test-globe-card__actions">
              <button
                type="button"
                className="test-globe-card__watch"
                onClick={() => navigate(`/discover?live=${encodeURIComponent(selectedLive.id)}`)}
              >
                <Play size={13} fill="currentColor" strokeWidth={1.8} />
                Watch
              </button>
              <button
                type="button"
                className="test-globe-card__profile"
                onClick={() => navigate(`/profile/${selectedLive.creatorId ?? selectedLive.id}`)}
              >
                Profile
              </button>
              <button type="button" className="test-globe-card__notify" aria-label="Notify me">
                <Bell size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="test-globe-controls" aria-label="Globe controls">
        <button type="button" onClick={recenter} aria-label="Recenter">
          <LocateFixed size={19} />
        </button>
      </div>

      {mapError && <div className="test-globe-error">{mapError}</div>}
    </section>
  );
}
