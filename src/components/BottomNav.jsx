import { Bike, Briefcase, CalendarPlus, Camera, ChevronDown, ChevronLeft, Compass, Footprints, Globe2, ImagePlus, Mountain, MoreHorizontal, Pencil, Plane, Play, Radio, Tv2, UserRound, UtensilsCrossed, Video, Waves, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EquipmentSelector, QuickAddEquipmentForm } from './equipment/EquipmentKit.jsx';
import { EXPERIENCE_FAMILIES } from '../data/experienceTaxonomy.js';
import { SUBCATEGORY_EQUIPMENT_TYPES } from '../data/equipmentModel.js';
import { createLocalLive, registerCreatedLiveStream } from '../services/createdLiveService.js';
import { activateScheduledStream, getMyScheduledStreams, scheduleStream, startStream } from '../services/streamApi.ts';
import {
  addEquipmentItem,
  buildEquipmentSnapshots,
  getDefaultEquipmentIds,
  getEquipmentLibrary,
  getEquipmentLibraryWithProducts,
  getLastLiveEquipmentIds,
  getLastLiveEquipmentIdsBySubcategory,
  getSuggestedEquipmentIds,
  rememberLiveEquipmentSetup,
  rememberLiveEquipmentSetupBySubcategory,
} from '../services/equipmentService.js';

const navItems = [
  { to: '/watch', labelKey: 'navigation.watch', icon: Tv2 },
  { to: '/explore', labelKey: 'navigation.explore', icon: Compass },
  { to: '/globe', labelKey: 'navigation.globe', icon: Globe2 },
  { to: '/profile', labelKey: 'navigation.profile', icon: UserRound },
];

const createActions = [
  { labelKey: 'create.startLive', icon: Video, mode: 'launch' },
  { labelKey: 'create.scheduleLive', icon: CalendarPlus, mode: 'schedule' },
  { labelKey: 'create.addVideo', icon: ImagePlus },
];

const initialLiveDraft = {
  family: null,
  subcategory: '',
  description: '',
  title: '',
  location: '',
  privacy: 'Everyone',
  quality: '1080p',
  equipmentIds: [],
};

const privacyOptions = ['Everyone', 'Followers', 'Private'];
const qualityOptions = ['720p', '1080p', 'Auto'];

const privacyVisibilityMap = {
  Everyone: 'public',
  Followers: 'followers',
  Private: 'private',
};

const familyEnvironmentMap = {
  earth: 'land',
  water: 'water',
  air: 'air',
};

const QUICK_CATEGORIES = [
  { id: 'Walking',  label: 'Walking',  family: 'earth', subcategory: 'Walking',     icon: Footprints },
  { id: 'Cooking',  label: 'Cooking',  family: 'earth', subcategory: 'Cooking',     icon: UtensilsCrossed },
  { id: 'Work',     label: 'Work',     family: 'earth', subcategory: 'Work',        icon: Briefcase },
  { id: 'Hiking',   label: 'Hiking',   family: 'earth', subcategory: 'Hiking',      icon: Mountain },
  { id: 'Cycling',  label: 'Cycling',  family: 'earth', subcategory: 'Bicycle',     icon: Bike },
  { id: 'Surfing',  label: 'Surfing',  family: 'water', subcategory: 'Surfing',     icon: Waves },
  { id: 'Flying',   label: 'Flying',   family: 'air',   subcategory: 'Paragliding', icon: Plane },
];

function StartLiveFlow({
  draft, onUpdateDraft, onLaunch,
  autoCoverEnabled, onAutoCoverToggle,
  equipmentLibrary,
  onToggleEquipment, onUseSuggestedGear, onApplyPreviousSetup, onSkipEquipment,
  onOpenQuickAdd, quickAddOpen, quickAddDraft, onQuickAddChange, onSaveQuickEquipment, onCancelQuickAdd,
  hasPreviousSetup,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const launchedRef = useRef(false);
  const [cameraState, setCameraState] = useState('pending');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showFullCategories, setShowFullCategories] = useState(false);

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState(window.isSecureContext ? 'unavailable' : 'insecure');
      return undefined;
    }
    const requestCamera = async () => {
      const attempts = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: true },
        { video: { width: { ideal: 1280 } }, audio: true },
        { video: true, audio: true },
      ];
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCameraState('active');
          return;
        } catch (err) {
          console.warn('[StartLive] Camera attempt failed:', err.message);
        }
      }
      if (active) setCameraState('denied');
    };
    requestCamera();
    return () => {
      active = false;
      if (!launchedRef.current) streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const handleGoLive = () => {
    launchedRef.current = true;
    onLaunch(streamRef.current);
  };

  const cameraStatusText = {
    denied: 'Camera access denied',
    insecure: 'Camera needs HTTPS',
    unavailable: 'No camera available',
    pending: 'Starting camera…',
  }[cameraState] ?? '';

  return (
    <div className="start-live-flow">
      {/* Camera preview */}
      <div className="start-live-preview">
        <video
          ref={videoRef}
          className="start-live-preview__video"
          autoPlay
          muted
          playsInline
          style={cameraState !== 'active' ? { display: 'none' } : undefined}
        />
        {cameraState !== 'active' && (
          <div className="start-live-preview__status">
            <Camera size={24} strokeWidth={1.4} />
            <span>{cameraStatusText}</span>
          </div>
        )}
        <span className="start-live-preview__label">Preview</span>
      </div>

      {/* What are you doing? */}
      <div>
        <label className="start-live-label">What are you doing?</label>
        <div className="start-live-input-wrap">
          <Pencil size={15} strokeWidth={1.8} className="start-live-input-icon" />
          <input
            className="start-live-input"
            value={draft.title}
            onChange={(e) => {
              const v = e.target.value;
              onUpdateDraft('title', v);
              onUpdateDraft('description', v);
            }}
            placeholder="Walking around Montmartre"
            maxLength={120}
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="start-live-label">Choose a category</label>
        <div className="start-live-cats">
          {QUICK_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = draft.subcategory === cat.subcategory;
            return (
              <button
                key={cat.id}
                type="button"
                className={`start-live-cat${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  onUpdateDraft('family', cat.family);
                  onUpdateDraft('subcategory', cat.subcategory);
                  setShowFullCategories(false);
                }}
              >
                <CatIcon size={20} strokeWidth={1.6} />
                <span>{cat.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`start-live-cat${showFullCategories ? ' is-active' : ''}`}
            onClick={() => setShowFullCategories((v) => !v)}
          >
            <MoreHorizontal size={20} strokeWidth={1.6} />
            <span>More</span>
          </button>
        </div>

        {showFullCategories && (
          <div className="start-live-full-cats">
            {Object.values(EXPERIENCE_FAMILIES).map((family) => (
              <div key={family.id} className="start-live-full-cats__group">
                <span className="start-live-full-cats__group-label">{family.label}</span>
                <div className="start-live-full-cats__chips">
                  {family.subcategories.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      className={`start-live-full-cat-chip${draft.subcategory === sub ? ' is-active' : ''}`}
                      onClick={() => {
                        onUpdateDraft('family', family.id);
                        onUpdateDraft('subcategory', sub);
                        setShowFullCategories(false);
                      }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Go Live */}
      <button type="button" className="start-live-go" onClick={handleGoLive}>
        <Radio size={18} strokeWidth={2} />
        Go Live
      </button>

      {/* Quick settings */}
      <div className="start-live-quick">
        <div className="start-live-quick__item">
          <button
            type="button"
            className="start-live-quick__pill"
            onClick={() => setPrivacyOpen((v) => !v)}
          >
            <Globe2 size={14} strokeWidth={1.8} />
            <span>{draft.privacy}</span>
            <ChevronDown size={12} strokeWidth={2} />
          </button>
          {privacyOpen && (
            <div className="start-live-privacy-menu">
              {privacyOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={draft.privacy === opt ? 'is-active' : ''}
                  onClick={() => { onUpdateDraft('privacy', opt); setPrivacyOpen(false); }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="start-live-quick__item">
          <div className="start-live-quick__pill">
            <Camera size={14} strokeWidth={1.8} />
            <span>Auto cover</span>
            <button
              type="button"
              className={`start-live-toggle${autoCoverEnabled ? ' is-on' : ''}`}
              onClick={onAutoCoverToggle}
              aria-label="Toggle auto cover"
            />
          </div>
        </div>
      </div>

      {/* More options */}
      <button
        type="button"
        className="start-live-more-btn"
        onClick={() => setMoreOptionsOpen((v) => !v)}
      >
        More options
        <ChevronDown
          size={13}
          strokeWidth={2}
          style={{ transform: moreOptionsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {moreOptionsOpen && (
        <div className="start-live-more-panel">
          <section className="create-live-flow__section">
            <h2>Quality</h2>
            <div className="create-live-chip-row">
              {qualityOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={draft.quality === opt ? 'is-active' : ''}
                  onClick={() => onUpdateDraft('quality', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </section>
          <section className="create-live-flow__section">
            <h2>Equipment</h2>
            {quickAddOpen ? (
              <QuickAddEquipmentForm
                value={quickAddDraft}
                onChange={onQuickAddChange}
                onCancel={onCancelQuickAdd}
                onSave={onSaveQuickEquipment}
                suggestedTypes={SUBCATEGORY_EQUIPMENT_TYPES[draft.subcategory] ?? []}
              />
            ) : (
              <EquipmentSelector
                items={equipmentLibrary}
                selectedIds={draft.equipmentIds ?? []}
                onToggle={onToggleEquipment}
                onUseSuggested={onUseSuggestedGear}
                onUsePrevious={onApplyPreviousSetup}
                onAdd={() => onOpenQuickAdd('recording')}
                onAddActivity={() => onOpenQuickAdd('activity')}
                onSkip={onSkipEquipment}
                subcategory={draft.subcategory}
                hasPreviousSetup={hasPreviousSetup}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function nextLocalDateTime() {
  const date = new Date(Date.now() + 30 * 60 * 1000);
  date.setSeconds(0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function toScheduleIso(date, time) {
  if (!date || !time) return null;
  const scheduled = new Date(`${date}T${time}`);
  if (!Number.isFinite(scheduled.getTime())) return null;
  return scheduled.toISOString();
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  return null;
}

function formatScheduledStart(value) {
  const date = timestampToDate(value);
  if (!date || !Number.isFinite(date.getTime())) return 'Scheduled';
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ScheduledLiveList({ items, loading, startingId, onStart }) {
  if (loading || !items.length) return null;

  return (
    <div className="scheduled-live-list">
      <span className="scheduled-live-list__label">Scheduled</span>
      {items.slice(0, 3).map((item) => (
        <div key={item.id} className="scheduled-live-item">
          <div>
            <strong>{item.title || 'Scheduled live'}</strong>
            <small>{formatScheduledStart(item.scheduledStartAt)}</small>
          </div>
          <button type="button" disabled={startingId === item.id} onClick={() => onStart(item)}>
            {startingId === item.id ? 'Starting…' : 'Start now'}
          </button>
        </div>
      ))}
    </div>
  );
}

function ScheduleLiveFlow({ draft, onUpdateDraft, onSchedule, status, error }) {
  const initialDateTime = useRef(nextLocalDateTime());
  const [date, setDate] = useState(initialDateTime.current.date);
  const [time, setTime] = useState(initialDateTime.current.time);
  const [showFullCategories, setShowFullCategories] = useState(false);
  const scheduledIso = toScheduleIso(date, time);
  const isTooSoon = scheduledIso ? new Date(scheduledIso).getTime() < Date.now() + 5 * 60 * 1000 : true;
  const canSchedule = !isTooSoon && status !== 'saving';

  return (
    <div className="schedule-live-flow">
      <div>
        <label className="start-live-label">What are you planning?</label>
        <div className="start-live-input-wrap">
          <Pencil size={15} strokeWidth={1.8} className="start-live-input-icon" />
          <input
            className="start-live-input"
            value={draft.title}
            onChange={(e) => {
              const v = e.target.value;
              onUpdateDraft('title', v);
              onUpdateDraft('description', v);
            }}
            placeholder="Sunset walk in Lisbon"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label className="start-live-label">Date and time</label>
        <div className="schedule-datetime-row">
          <input type="date" value={date} min={initialDateTime.current.date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="start-live-label">Category</label>
        <div className="start-live-cats">
          {QUICK_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = draft.subcategory === cat.subcategory;
            return (
              <button
                key={cat.id}
                type="button"
                className={`start-live-cat${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  onUpdateDraft('family', cat.family);
                  onUpdateDraft('subcategory', cat.subcategory);
                  setShowFullCategories(false);
                }}
              >
                <CatIcon size={20} strokeWidth={1.6} />
                <span>{cat.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`start-live-cat${showFullCategories ? ' is-active' : ''}`}
            onClick={() => setShowFullCategories((v) => !v)}
          >
            <MoreHorizontal size={20} strokeWidth={1.6} />
            <span>More</span>
          </button>
        </div>
        {showFullCategories && (
          <div className="start-live-full-cats">
            {Object.values(EXPERIENCE_FAMILIES).map((family) => (
              <div key={family.id} className="start-live-full-cats__group">
                <span className="start-live-full-cats__group-label">{family.label}</span>
                <div className="start-live-full-cats__chips">
                  {family.subcategories.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      className={`start-live-full-cat-chip${draft.subcategory === sub ? ' is-active' : ''}`}
                      onClick={() => {
                        onUpdateDraft('family', family.id);
                        onUpdateDraft('subcategory', sub);
                        setShowFullCategories(false);
                      }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="start-live-quick">
        {privacyOptions.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`schedule-live-privacy${draft.privacy === opt ? ' is-active' : ''}`}
            onClick={() => onUpdateDraft('privacy', opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {isTooSoon ? <p className="schedule-error">Pick a time at least 5 minutes from now.</p> : null}
      {error ? <p className="schedule-error">{error}</p> : null}
      {status === 'saved' ? <p className="schedule-success">Live scheduled.</p> : null}

      <button type="button" className="start-live-go" disabled={!canSchedule} onClick={() => onSchedule(scheduledIso)}>
        <CalendarPlus size={18} strokeWidth={2} />
        {status === 'saving' ? 'Scheduling…' : 'Schedule Live'}
      </button>
    </div>
  );
}

export default function BottomNav({ collapsible = false, collapsed = false, onExpand, onCollapse }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState('actions');
  const [draft, setDraft] = useState(initialLiveDraft);
  const [autoCoverEnabled, setAutoCoverEnabled] = useState(true);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState({ category: 'recording', brand: '', model: '' });
  const [scheduleStatus, setScheduleStatus] = useState('idle');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduledLives, setScheduledLives] = useState([]);
  const [scheduledLivesLoading, setScheduledLivesLoading] = useState(false);
  const [startingScheduledId, setStartingScheduledId] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [userCoordinates, setUserCoordinates] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates([position.coords.longitude, position.coords.latitude]);
        setLocationStatus('ready');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    let active = true;
    getEquipmentLibraryWithProducts().then((items) => {
      if (active) setEquipmentLibrary(items);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const refreshScheduledLives = () => {
    if (!user) {
      setScheduledLives([]);
      return;
    }
    setScheduledLivesLoading(true);
    getMyScheduledStreams({ limit: 3 })
      .then(({ streams: items }) => setScheduledLives(Array.isArray(items) ? items : []))
      .catch(() => setScheduledLives([]))
      .finally(() => setScheduledLivesLoading(false));
  };

  useEffect(() => {
    if (!createOpen || createMode !== 'actions') return;
    refreshScheduledLives();
  }, [createOpen, createMode, user?.uid]);

  useEffect(() => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setScheduleStatus('idle');
    setScheduleError('');
  }, [location.pathname]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setScheduleStatus('idle');
    setScheduleError('');
  };

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const launchLive = (cameraStream = null) => {
    const effectiveDraft = {
      ...draft,
      family: draft.family || 'earth',
      subcategory: draft.subcategory || 'Walking',
      title: draft.title.trim() || 'Live stream',
      description: draft.description.trim() || draft.title.trim() || 'Live stream',
    };
    const selectedIds = effectiveDraft.equipmentIds ?? [];
    const live = createLocalLive({
      ...effectiveDraft,
      hasCameraStream: Boolean(cameraStream),
      equipment: selectedIds.map((equipmentId) => ({ equipmentId })),
      equipmentSnapshots: buildEquipmentSnapshots(equipmentLibrary, selectedIds),
    }, user?.uid, userCoordinates);
    registerCreatedLiveStream(live.id, cameraStream);
    rememberLiveEquipmentSetup(effectiveDraft.family, selectedIds);
    rememberLiveEquipmentSetupBySubcategory(effectiveDraft.subcategory, selectedIds);
    closeCreate();
    navigate(`/live/${encodeURIComponent(live.id)}`);
  };

  const scheduleLive = async (scheduledStartAt) => {
    if (scheduleStatus === 'saving') return;
    setScheduleStatus('saving');
    setScheduleError('');
    const family = draft.family || 'earth';
    const subcategory = draft.subcategory || 'Walking';
    try {
      await scheduleStream({
        title: draft.title.trim() || 'Scheduled live',
        description: draft.description.trim() || draft.title.trim() || 'Scheduled live',
        category: subcategory,
        subcategories: [subcategory],
        environment: familyEnvironmentMap[family] ?? 'other',
        visibility: privacyVisibilityMap[draft.privacy] ?? 'public',
        scheduledStartAt,
        approximateLocation: userCoordinates ? { longitude: userCoordinates[0], latitude: userCoordinates[1] } : undefined,
        gearIds: draft.equipmentIds ?? [],
      });
      setScheduleStatus('saved');
      refreshScheduledLives();
      setTimeout(closeCreate, 700);
    } catch (err) {
      setScheduleStatus('idle');
      setScheduleError(err instanceof Error ? err.message : 'Could not schedule this live');
    }
  };

  const startScheduledLive = async (item) => {
    if (startingScheduledId) return;
    setStartingScheduledId(item.id);
    try {
      const activated = await activateScheduledStream(item.id);
      await startStream(item.id);
      const stream = activated.stream ?? {};
      const ingest = activated.ingest ?? {};
      const family = item.environment === 'water' ? 'water' : item.environment === 'air' ? 'air' : 'earth';
      const subcategory = item.subcategories?.[0] || item.category || 'Walking';
      const live = createLocalLive({
        id: item.id,
        backendStreamId: item.id,
        family,
        subcategory,
        title: item.title || 'Scheduled live',
        description: item.description || item.title || 'Scheduled live',
        privacy: item.visibility === 'private' ? 'Private' : item.visibility === 'followers' ? 'Followers' : 'Everyone',
        quality: draft.quality || '1080p',
        location: [item.city, item.countryCode].filter(Boolean).join(', '),
        hasCameraStream: true,
        cloudflareLiveInputId: stream.cloudflareLiveInputId || null,
        hlsManifestUrl: stream.hlsManifestUrl || null,
        playbackUrl: stream.playbackUrl || null,
        webRTCUrl: ingest.webRTCUrl || null,
        streamKey: ingest.streamKey || null,
      }, user?.uid, item.approximateLocation ? [item.approximateLocation.longitude, item.approximateLocation.latitude] : userCoordinates);
      closeCreate();
      navigate(`/live/${encodeURIComponent(live.id)}`);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not start this live');
    } finally {
      setStartingScheduledId(null);
    }
  };

  const applyPreviousSetup = () => {
    const previous = getLastLiveEquipmentIds(draft.family);
    const defaults = getDefaultEquipmentIds(equipmentLibrary);
    updateDraft('equipmentIds', previous.length ? previous : defaults);
  };

  const applySuggestedGear = () => {
    const compatibleTypes = SUBCATEGORY_EQUIPMENT_TYPES[draft.subcategory] ?? [];
    const ids = getSuggestedEquipmentIds(equipmentLibrary, draft.subcategory, compatibleTypes);
    updateDraft('equipmentIds', ids);
  };

  const toggleEquipment = (id) => {
    setDraft((current) => {
      const selected = new Set(current.equipmentIds ?? []);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { ...current, equipmentIds: [...selected] };
    });
  };

  const openQuickAdd = (category = 'recording') => {
    const suggestedTypes = category === 'activity' ? (SUBCATEGORY_EQUIPMENT_TYPES[draft.subcategory] ?? []) : [];
    setQuickAddDraft({ category, brand: '', model: '', equipmentType: suggestedTypes[0] ?? '' });
    setQuickAddOpen(true);
  };

  const saveQuickEquipment = () => {
    if (!quickAddDraft.brand.trim() || !quickAddDraft.model.trim()) return;
    const fallbackType = quickAddDraft.category === 'audio'
      ? 'Microphone'
      : quickAddDraft.category === 'activity'
        ? 'Activity Gear'
        : 'Equipment';
    const item = addEquipmentItem({
      ...quickAddDraft,
      equipmentType: quickAddDraft.equipmentType?.trim() || fallbackType,
      compatibleActivityIds: quickAddDraft.category === 'activity' && draft.subcategory ? [draft.subcategory] : undefined,
      isPublic: true,
      isDefault: false,
    });
    const nextLibrary = getEquipmentLibrary();
    setEquipmentLibrary(nextLibrary);
    getEquipmentLibraryWithProducts().then(setEquipmentLibrary).catch(() => {});
    setDraft((current) => ({ ...current, equipmentIds: [...new Set([...(current.equipmentIds ?? []), item.id])] }));
    setQuickAddDraft({ category: 'recording', brand: '', model: '' });
    setQuickAddOpen(false);
  };

  if (collapsible && collapsed) {
    return (
      <button type="button" className="bottom-nav-peek" onClick={onExpand} aria-label={t('navigation.showNavigation')}>
        <span />
      </button>
    );
  }

  return (
    <>
      {createOpen ? (
        <div className="create-sheet" role="dialog" aria-label={t('create.dialog')}>
          <div className="create-sheet__panel">
            <div className="create-sheet__header">
              {createMode === 'launch' ? (
                <button type="button" onClick={() => setCreateMode('actions')} aria-label={t('common.back')}>
                  <ChevronLeft size={18} strokeWidth={1.9} />
                </button>
              ) : (
                <BrandMark size={22} showName useLegacy />
              )}
              {createMode === 'launch' ? <strong>Start a live</strong> : null}
              {createMode === 'schedule' ? <strong>Schedule a live</strong> : null}
              <button type="button" onClick={closeCreate} aria-label={t('common.close')}>
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
            {createMode === 'launch' ? (
              <StartLiveFlow
                draft={draft}
                onUpdateDraft={updateDraft}
                onLaunch={launchLive}
                autoCoverEnabled={autoCoverEnabled}
                onAutoCoverToggle={() => setAutoCoverEnabled((v) => !v)}
                equipmentLibrary={equipmentLibrary}
                onToggleEquipment={toggleEquipment}
                onUseSuggestedGear={applySuggestedGear}
                onApplyPreviousSetup={applyPreviousSetup}
                onSkipEquipment={() => updateDraft('equipmentIds', [])}
                onOpenQuickAdd={openQuickAdd}
                quickAddOpen={quickAddOpen}
                quickAddDraft={quickAddDraft}
                onQuickAddChange={setQuickAddDraft}
                onSaveQuickEquipment={saveQuickEquipment}
                onCancelQuickAdd={() => setQuickAddOpen(false)}
                hasPreviousSetup={getLastLiveEquipmentIdsBySubcategory(draft.subcategory).length > 0}
              />
            ) : createMode === 'schedule' ? (
              <ScheduleLiveFlow
                draft={draft}
                onUpdateDraft={updateDraft}
                onSchedule={scheduleLive}
                status={scheduleStatus}
                error={scheduleError}
              />
            ) : (
              <div className="create-sheet__actions">
                {createActions.map(({ labelKey, icon: Icon, mode: actionMode }) => (
                  <button
                    key={labelKey}
                    type="button"
                    onClick={() => (actionMode ? setCreateMode(actionMode) : closeCreate())}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{t(labelKey)}</span>
                  </button>
                ))}
                <ScheduledLiveList
                  items={scheduledLives}
                  loading={scheduledLivesLoading}
                  startingId={startingScheduledId}
                  onStart={startScheduledLive}
                />
                {scheduleError ? <p className="schedule-error">{scheduleError}</p> : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <nav className={collapsible ? 'bottom-nav bottom-nav--floating' : 'bottom-nav'} aria-label={t('navigation.main')}>
        {collapsible ? (
          <button type="button" className="bottom-nav__collapse" onClick={onCollapse} aria-label={t('navigation.collapseNavigation')}>
            <span />
          </button>
        ) : null}
        {navItems.slice(0, 2).map(({ to, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} className="bottom-nav__item" aria-label={t(labelKey)} onClick={() => setCreateOpen(false)}>
            <span className="bottom-nav__icon">
              <Icon size={23} strokeWidth={1.9} />
            </span>
            <span className="bottom-nav__label">{t(labelKey)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={createOpen ? 'bottom-nav__create is-active' : 'bottom-nav__create'}
          onClick={() => setCreateOpen(true)}
          aria-label={t('navigation.create')}
        >
          <BrandMark size={40} withCircle={false} useLegacy style={{ marginTop: 10 }} />
          <span className="bottom-nav__create-badge" aria-hidden="true">+</span>
        </button>
        {navItems.slice(2).map(({ to, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} className="bottom-nav__item" aria-label={t(labelKey)} onClick={() => setCreateOpen(false)}>
            <span className="bottom-nav__icon">
              <Icon size={23} strokeWidth={1.9} />
            </span>
            <span className="bottom-nav__label">{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
