import { Bell, ChevronDown, ChevronRight, Radio, UsersRound, Video, VideoOff, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MapBottomSheet from '../components/map/MapBottomSheet.jsx';
import LiveMap from '../components/map/LiveMap.jsx';
import SelectedLiveCard from '../components/map/SelectedLiveCard.jsx';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import { enrichExperience, getFamily, getPovType } from '../data/experienceTaxonomy.js';
import { mapStreams } from '../data/mapStreams.js';
import { getCreatedLives, subscribeToCreatedLives } from '../services/createdLiveService.js';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

function YouAreLivePanel({ live, onEnd }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camActive, setCamActive] = useState(false);
  const [viewers, setViewers] = useState(1);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamActive(true);
      })
      .catch(() => {});
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const grow = () => {
      setViewers((v) => v + Math.floor(Math.random() * 4));
    };
    const id = window.setInterval(grow, 3500);
    return () => window.clearInterval(id);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamActive(false);
  };

  return (
    <div className="you-are-live">
      <div className="you-are-live__cam">
        <video ref={videoRef} autoPlay muted playsInline className={camActive ? '' : 'is-hidden'} />
        {!camActive && <Video size={20} strokeWidth={1.6} />}
      </div>
      <div className="you-are-live__info">
        <span className="you-are-live__badge">● LIVE</span>
        <strong className="you-are-live__title">{live.experienceTitle || live.job}</strong>
        <span className="you-are-live__viewers">{viewers} watching</span>
      </div>
      <div className="you-are-live__actions">
        <button type="button" onClick={camActive ? stopCamera : undefined} aria-label="Toggle camera">
          {camActive ? <Video size={16} strokeWidth={1.8} /> : <VideoOff size={16} strokeWidth={1.8} />}
        </button>
        <button type="button" className="is-end" onClick={onEnd}>End</button>
      </div>
    </div>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLiveId = searchParams.get('live');
  const [activeStatuses, setActiveStatuses] = useState(['live']);
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeSubcategory, setActiveSubcategory] = useState('all');
  const [activeActivities, setActiveActivities] = useState([]);
  const [sheetState, setSheetState] = useState('closed');
  const [selectedId, setSelectedId] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [notifications, setNotifications] = useState({ 'surgeon-simulation': true });
  const [loading, setLoading] = useState(true);
  const [createdLives, setCreatedLives] = useState([]);

  useEffect(() => {
    getCreatedLives().then((created) => {
      setCreatedLives(created);
      if (!selectedId && requestedLiveId) {
        const allInitial = [...created, ...mapStreams];
        const requested = allInitial.find((stream) => stream.id === requestedLiveId && stream.status === 'live');
        setSelectedId(requested?.id ?? null);
      }
    }).catch(() => setCreatedLives([]));

    const q = query(collection(db, 'activeLives'), where('status', '==', 'live'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      getCreatedLives().then((created) => {
        setCreatedLives(created);
      }).catch(() => setCreatedLives([]));
    }, (err) => {
      console.error('[MapPage] Firestore listener:', err.message);
    });

    return unsubscribe;
  }, []);
  const [sheetMode, setSheetMode] = useState('compact');

  const allStreams = useMemo(() => [...createdLives, ...mapStreams], [createdLives]);
  const experiences = useMemo(() => allStreams.map(enrichExperience), [allStreams]);

  const visibleStreams = useMemo(() => {
    return experiences
      .filter((stream) => activeStatuses.includes(stream.status))
      .filter((stream) => activeFamily === 'all' || stream.family === activeFamily)
      .filter((stream) => activeSubcategory === 'all' || stream.subcategory === activeSubcategory)
      .filter((stream) => {
        if (activeActivities.length === 0) return true;
        return activeActivities.some((activityId) => {
          const activity = ACTIVITY_CATEGORIES.find((a) => a.id === activityId);
          return activity?.subcategories.includes(stream.subcategory);
        });
      });
  }, [activeActivities, activeFamily, activeStatuses, activeSubcategory, experiences]);

  const selected = experiences.find((stream) => stream.id === selectedId) ?? null;
  const selectedFamily = selected ? getFamily(selected.family) : null;
  const selectedPov = selected ? getPovType(selected.povType) : null;
  const storyStreams = selected?.storyGroup
    ? experiences
        .filter((stream) => stream.storyGroup === selected.storyGroup && stream.status === 'live')
        .sort((a, b) => (a.storyStep ?? 0) - (b.storyStep ?? 0))
    : [];

  const userLive = requestedLiveId ? createdLives.find((l) => l.id === requestedLiveId) : null;
  const [userLiveEnded, setUserLiveEnded] = useState(false);

  const activeFamilyConfig = activeFamily === 'all' ? null : getFamily(activeFamily);
  const streamCounts = useMemo(() => {
    const byFamily = { all: 0, air: 0, earth: 0, water: 0 };
    const byActivity = {};
    experiences.forEach((stream) => {
      if (stream.status !== 'live') return;
      byFamily.all += 1;
      if (stream.family) byFamily[stream.family] = (byFamily[stream.family] ?? 0) + 1;
      ACTIVITY_CATEGORIES.forEach((activity) => {
        if (activity.subcategories.includes(stream.subcategory)) {
          byActivity[activity.id] = (byActivity[activity.id] ?? 0) + 1;
        }
      });
    });
    return { total: visibleStreams.length, byFamily, byActivity };
  }, [experiences, visibleStreams.length]);

  useEffect(() => {
    const requested = allStreams.find((stream) => stream.id === requestedLiveId && stream.status === 'live');
    if (!requested) return;
    setActiveStatuses((current) => (current.includes('live') ? current : [...current, 'live']));
    setSelectedId(requested.id);
  }, [allStreams, requestedLiveId]);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
    }
  }, [selected, selectedId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return subscribeToCreatedLives(setCreatedLives);
  }, []);

  const selectStream = (id) => {
    setSelectedId(id);
    setSheetMode('compact');
  };

  const selectFamily = (nextFamily) => {
    setActiveFamily(nextFamily);
    setActiveSubcategory('all');
    setSelectedId(null);
    if (nextFamily !== 'all') setActiveActivities([]);
  };

  const setGlobeMode = (nextMode) => {
    if (nextMode === 'lab') {
      navigate('/globe-lab');
      return;
    }
    if (nextMode === 'test') {
      navigate('/globe-test');
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('globe');
    setSelectedId(null);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <section className="screen map-screen" data-sheet-state={sheetState} aria-label="VuVio live map">
      {userLive && !userLiveEnded ? (
        <YouAreLivePanel live={userLive} onEnd={() => setUserLiveEnded(true)} />
      ) : null}
      <LiveMap
        key="actual-globe"
        streams={allStreams}
        activeStatuses={activeStatuses}
        activeFamily={activeFamily}
        activeSubcategory={activeSubcategory}
        selectedId={selectedId}
        focusId={requestedLiveId}
        onSelect={selectStream}
        resetSignal={resetSignal}
      />

      <div className="map-engine-switch" role="group" aria-label="Choose globe">
        <button
          type="button"
          className="is-active"
          onClick={() => setGlobeMode('maplibre')}
          aria-pressed="true"
        >
          Current
        </button>
        <button
          type="button"
          onClick={() => setGlobeMode('lab')}
          aria-pressed="false"
        >
          Lab
        </button>
        <button
          type="button"
          onClick={() => setGlobeMode('test')}
          aria-pressed="false"
        >
          Test
        </button>
      </div>

      {!selected && (
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

      {selected ? (
        <SelectedLiveCard
          selected={selected}
          selectedFamily={selectedFamily}
          selectedPov={selectedPov}
          storyStreams={storyStreams}
          sheetMode={sheetMode}
          setSheetMode={setSheetMode}
          onClose={() => {
            setSelectedId(null);
            setResetSignal((value) => value + 1);
          }}
          onWatch={(id) => navigate(`/discover?live=${encodeURIComponent(id)}`)}
          notifications={notifications}
          onToggleNotification={(id) => setNotifications((state) => ({ ...state, [id]: !state[id] }))}
        />
      ) : null}

      {loading ? (
        <div className="page-skeleton page-skeleton--map" aria-label="Loading globe">
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </section>
  );
}
