import { Bike, Briefcase, CalendarPlus, Camera, Check, ChevronDown, ChevronLeft, Compass, Footprints, Globe2, ImagePlus, Mountain, MoreHorizontal, Pencil, Plane, Play, Radio, Sparkles, Tv2, UserRound, UtensilsCrossed, Video, Waves, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { EquipmentSelector, QuickAddEquipmentForm } from './equipment/EquipmentKit.jsx';
import { EXPERIENCE_FAMILIES } from '../data/experienceTaxonomy.js';
import { SUBCATEGORY_EQUIPMENT_TYPES } from '../data/equipmentModel.js';
import { createLocalLive, registerCreatedLiveStream } from '../services/createdLiveService.js';
import { createStream } from '../services/streamApi.ts';
import {
  addEquipmentItem,
  buildEquipmentSnapshots,
  equipmentLabel,
  getDefaultEquipmentIds,
  getEquipmentLibrary,
  getEquipmentLibraryWithProducts,
  getEquipmentSelection,
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
  { labelKey: 'create.scheduleLive', icon: CalendarPlus },
  { labelKey: 'create.addVideo', icon: ImagePlus },
];

const familyIcons = {
  air: Plane,
  earth: Footprints,
  water: Waves,
};

const initialLiveDraft = {
  family: null,
  subcategory: '',
  description: '',
  title: '',
  privacy: 'Everyone',
  quality: '1080p',
  equipmentIds: [],
};

const initialScheduleDraft = {
  family: null,
  subcategory: '',
  description: '',
  title: '',
  privacy: 'Everyone',
  date: '',
  time: '',
};

const privacyOptions = ['Everyone', 'Followers', 'Private'];
const qualityOptions = ['720p', '1080p', 'Auto'];

const QUICK_CATEGORIES = [
  { id: 'Walking',  label: 'Walking',  family: 'earth', subcategory: 'Walking',  icon: Footprints },
  { id: 'Cooking',  label: 'Cooking',  family: 'earth', subcategory: 'Cooking',  icon: UtensilsCrossed },
  { id: 'Work',     label: 'Work',     family: 'earth', subcategory: 'Work',     icon: Briefcase },
  { id: 'Hiking',   label: 'Hiking',   family: 'earth', subcategory: 'Hiking',   icon: Mountain },
  { id: 'Cycling',  label: 'Cycling',  family: 'earth', subcategory: 'Bicycle',  icon: Bike },
  { id: 'Surfing',  label: 'Surfing',  family: 'water', subcategory: 'Surfing',  icon: Waves },
  { id: 'Flying',   label: 'Flying',   family: 'air',   subcategory: 'Paragliding', icon: Plane },
];

function captureFrameFromVideo(videoEl) {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return null;
  const w = Math.min(720, videoEl.videoWidth);
  const h = Math.round(w * (videoEl.videoHeight / videoEl.videoWidth));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function LivePreview({ draft, selectedFamily, equipmentLibrary, onEditGear, onLaunch, manualCoverPhoto, onCoverPhoto, userGeoCity, userGeoCountry, locationStatus }) {
  const selectedItems = getEquipmentSelection(equipmentLibrary, draft.equipmentIds ?? []);
  const captureItems = selectedItems.filter((item) => item.category !== 'activity');
  const activityItems = selectedItems.filter((item) => item.category === 'activity');
  const FamilyIcon = selectedFamily ? { air: Plane, earth: Footprints, water: Waves }[selectedFamily.id] : null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const launchedRef = useRef(false);
  const [cameraState, setCameraState] = useState('pending');
  const [photoMode, setPhotoMode] = useState('idle'); // 'idle' | 'countdown' | 'review'
  const [countdown, setCountdown] = useState(3);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [flashActive, setFlashActive] = useState(false);

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
        { video: true, audio: false },
      ];

      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCameraState('active');
          return;
        } catch (err) {
          console.warn('[LivePreview] Camera attempt failed:', err.message);
        }
      }

      if (active) setCameraState('denied');
    };

    requestCamera();

    return () => {
      active = false;
      if (!launchedRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (photoMode !== 'countdown') return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    const dataUrl = captureFrameFromVideo(videoRef.current);
    setCapturedPhoto(dataUrl);
    setFlashActive(true);
    const flashTimer = setTimeout(() => setFlashActive(false), 280);
    setPhotoMode('review');
    return () => clearTimeout(flashTimer);
  }, [photoMode, countdown]);

  const startCountdown = () => {
    setCapturedPhoto(null);
    setCountdown(3);
    setPhotoMode('countdown');
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCountdown(3);
    setPhotoMode('idle');
  };

  const handleUsePhoto = () => {
    onCoverPhoto(capturedPhoto);
    setCapturedPhoto(null);
    setCountdown(3);
    setPhotoMode('idle');
  };

  const handleLaunch = () => {
    launchedRef.current = true;
    onLaunch(streamRef.current);
  };

  const inReview = photoMode === 'review';
  const inCountdown = photoMode === 'countdown';
  const hasCover = Boolean(manualCoverPhoto);

  return (
    <div className="live-preview">
      <div className="live-preview__cover">
        <video
          ref={videoRef}
          className="live-preview__camera"
          autoPlay
          muted
          playsInline
          style={cameraState !== 'active' || inReview ? { display: 'none' } : undefined}
        />

        {cameraState !== 'active' && !inReview && (
          <>
            <Camera size={28} strokeWidth={1.5} />
            <span>{cameraState === 'denied' ? 'Camera access denied' : cameraState === 'insecure' ? 'Camera needs HTTPS or localhost' : cameraState === 'unavailable' ? 'No camera available' : 'Starting camera...'}</span>
          </>
        )}

        {inReview && capturedPhoto && (
          <img src={capturedPhoto} alt="Cover photo preview" className="live-preview__camera" />
        )}

        {flashActive && (
          <div className="live-preview__flash" />
        )}

        {inCountdown && (
          <div className="live-preview__countdown-overlay">
            <span className="live-preview__countdown-number">{countdown || ''}</span>
          </div>
        )}

        {inReview && (
          <div className="live-preview__photo-actions">
            <button type="button" className="live-preview__photo-btn live-preview__photo-btn--ghost" onClick={handleRetake}>
              Retake
            </button>
            <button type="button" className="live-preview__photo-btn live-preview__photo-btn--accent" onClick={handleUsePhoto}>
              Use photo
            </button>
          </div>
        )}

        {!inReview && !inCountdown && hasCover && (
          <div className="live-preview__cover-badge">
            <img src={manualCoverPhoto} alt="" className="live-preview__cover-thumb" />
            <span className="live-preview__cover-badge-label">
              <Check size={10} strokeWidth={3} />
              Cover set
            </span>
            <button type="button" className="live-preview__cover-retake" onClick={startCountdown}>
              Retake
            </button>
          </div>
        )}

        {!inReview && !inCountdown && !hasCover && cameraState === 'active' && (
          <button type="button" className="live-preview__take-photo" onClick={startCountdown}>
            <Camera size={12} strokeWidth={2} />
            Take cover photo
          </button>
        )}
      </div>

      <div className="live-preview__meta">
        {selectedFamily && FamilyIcon ? (
          <span className="live-preview__tag" style={{ '--experience-color': selectedFamily.color }}>
            <FamilyIcon size={11} strokeWidth={2} />
            {draft.subcategory}
          </span>
        ) : null}
        <h3 className="live-preview__title">{draft.title}</h3>
        {draft.description ? <p className="live-preview__desc">{draft.description}</p> : null}
        <p className="live-preview__desc">
          {locationStatus === 'loading' ? 'Detecting location…' : locationStatus === 'denied' ? 'Location unavailable' : [userGeoCity, userGeoCountry].filter(Boolean).join(', ') || 'Location unavailable'}
          {' '}&middot; {draft.privacy} &middot; {draft.quality}
        </p>
      </div>
      <div className="live-preview__gear">
        {captureItems.length > 0 && (
          <div className="live-preview__gear-group">
            <span className="live-preview__gear-label">Capture setup</span>
            <span className="live-preview__gear-items">{captureItems.map(equipmentLabel).join(' · ')}</span>
          </div>
        )}
        {activityItems.length > 0 && (
          <div className="live-preview__gear-group">
            <span className="live-preview__gear-label">Activity equipment</span>
            <span className="live-preview__gear-items">{activityItems.map(equipmentLabel).join(' · ')}</span>
          </div>
        )}
        {!selectedItems.length && (
          <span className="live-preview__gear-none">No equipment selected</span>
        )}
        <button type="button" className="live-preview__edit-gear" onClick={onEditGear}>
          <Pencil size={12} strokeWidth={2} />
          Edit gear
        </button>
      </div>
      <button type="button" className="create-live-launch" onClick={handleLaunch}>
        <Play size={17} fill="currentColor" strokeWidth={1.8} />
        Start live
      </button>
    </div>
  );
}

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
        { video: true, audio: false },
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
          <div className="start-live-full-cats start-live-full-cats--flat">
            {Object.values(EXPERIENCE_FAMILIES)
              .flatMap((family) => family.subcategories.map((sub) => ({ sub, familyId: family.id })))
              .sort((a, b) => a.sub.localeCompare(b.sub))
              .map(({ sub, familyId }) => (
                <button
                  key={sub}
                  type="button"
                  className={`start-live-full-cat-chip${draft.subcategory === sub ? ' is-active' : ''}`}
                  onClick={() => {
                    onUpdateDraft('family', familyId);
                    onUpdateDraft('subcategory', sub);
                    setShowFullCategories(false);
                  }}
                >
                  {sub}
                </button>
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

function ScheduleFlow({ draft, onUpdate, status, error, canSubmit, onSubmit, onRetry, onDone }) {
  const { t } = useTranslation();
  const scheduleStep = !draft.family ? 1 : !draft.subcategory ? 2 : !draft.title.trim() ? 3 : !draft.date || !draft.time ? 4 : 5;
  const selectedFamily = draft.family ? EXPERIENCE_FAMILIES[draft.family] : null;

  const today = new Date().toISOString().split('T')[0];

  if (status === 'success') {
    return (
      <div className="schedule-success">
        <div className="schedule-success__icon">
          <CalendarPlus size={28} strokeWidth={1.6} />
        </div>
        <strong>{t('create.scheduleLive')}</strong>
        <p>
          {draft.title} &middot; {draft.date} {draft.time}
        </p>
        <button type="button" className="create-live-launch" onClick={onDone}>
          <Check size={17} strokeWidth={2} />
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="create-live-flow">
      <div className="create-live-flow__steps" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[1, 2, 3, 4].map((step) => (
          <i key={step} className={step <= scheduleStep ? 'is-active' : ''} />
        ))}
      </div>

      <section className="create-live-flow__section">
        <h2>{t('create.family')}</h2>
        <div className="create-live-family-grid">
          {Object.values(EXPERIENCE_FAMILIES).map((family) => {
            const Icon = familyIcons[family.id];
            return (
              <button
                key={family.id}
                type="button"
                className={draft.family === family.id ? 'is-active' : ''}
                style={{ '--experience-color': family.color }}
                onClick={() => onUpdate('family', family.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{family.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedFamily ? (
        <section className="create-live-flow__section">
          <h2>{t('create.subcategory')}</h2>
          <div className="create-live-chip-row">
            {selectedFamily.subcategories.map((sub) => (
              <button
                key={sub}
                type="button"
                className={draft.subcategory === sub ? 'is-active' : ''}
                onClick={() => onUpdate('subcategory', sub)}
              >
                {sub}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {draft.subcategory ? (
        <section className="create-live-flow__section">
          <h2>{t('create.title')}</h2>
          <input
            value={draft.title}
            onChange={(e) => onUpdate('title', e.target.value)}
            placeholder="Title of your live…"
            maxLength={120}
          />
        </section>
      ) : null}

      {draft.title.trim() ? (
        <>
          <section className="create-live-flow__section">
            <h2>Date &amp; time</h2>
            <div className="schedule-datetime-row">
              <input
                type="date"
                value={draft.date}
                min={today}
                onChange={(e) => onUpdate('date', e.target.value)}
              />
              <input
                type="time"
                value={draft.time}
                onChange={(e) => onUpdate('time', e.target.value)}
              />
            </div>
          </section>

          <section className="create-live-flow__section">
            <h2>Privacy</h2>
            <div className="create-live-chip-row">
              {privacyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={draft.privacy === option ? 'is-active' : ''}
                  onClick={() => onUpdate('privacy', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {error ? <p className="schedule-error">{error}</p> : null}

      <button
        type="button"
        className="create-live-launch"
        disabled={!canSubmit || status === 'submitting'}
        onClick={status === 'error' ? onRetry : onSubmit}
      >
        <CalendarPlus size={17} strokeWidth={1.8} />
        {status === 'submitting' ? 'Scheduling…' : status === 'error' ? 'Retry' : 'Schedule live'}
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
  const [showPreview, setShowPreview] = useState(false);
  const [manualCoverPhoto, setManualCoverPhoto] = useState(null);
  const [autoCoverEnabled, setAutoCoverEnabled] = useState(true);
  const [scheduleDraft, setScheduleDraft] = useState(initialScheduleDraft);
  const [scheduleStatus, setScheduleStatus] = useState('form'); // 'form' | 'submitting' | 'success' | 'error'
  const [scheduleError, setScheduleError] = useState(null);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState({ category: 'recording', brand: '', model: '' });
  const [locationStatus, setLocationStatus] = useState('loading');
  const [userCoordinates, setUserCoordinates] = useState(null);
  const [userGeoCity, setUserGeoCity] = useState(null);
  const [userGeoCountry, setUserGeoCountry] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserCoordinates([longitude, latitude]);
        setLocationStatus('ready');
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, {
          headers: { 'Accept-Language': 'en' },
        })
          .then((r) => r.json())
          .then((data) => {
            const addr = data?.address ?? {};
            setUserGeoCity(addr.city ?? addr.town ?? addr.village ?? addr.county ?? null);
            setUserGeoCountry(addr.country ?? null);
          })
          .catch(() => {});
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
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setShowPreview(false);
    setManualCoverPhoto(null);
  }, [location.pathname]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setShowPreview(false);
    setManualCoverPhoto(null);
    setScheduleDraft(initialScheduleDraft);
    setScheduleStatus('form');
    setScheduleError(null);
  };

  const selectedFamily = draft.family ? EXPERIENCE_FAMILIES[draft.family] : null;
  const launchStep = !draft.family ? 1 : !draft.subcategory ? 2 : !draft.description.trim() ? 3 : !draft.title.trim() ? 4 : showPreview ? 6 : 5;
  const canLaunch = draft.family && draft.subcategory && draft.description.trim() && draft.title.trim();

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const launchLive = (cameraStream = null) => {
    const fallbackTitle = userGeoCity ? `Live from ${userGeoCity}` : 'Live stream';
    const effectiveDraft = {
      ...draft,
      family: draft.family || 'earth',
      subcategory: draft.subcategory || 'Walking',
      title: draft.title.trim() || fallbackTitle,
      description: draft.description.trim() || draft.title.trim() || fallbackTitle,
    };
    const selectedIds = effectiveDraft.equipmentIds ?? [];
    const live = createLocalLive({
      ...effectiveDraft,
      manualCoverDataUrl: manualCoverPhoto || null,
      hasCameraStream: Boolean(cameraStream),
      equipment: selectedIds.map((equipmentId) => ({ equipmentId })),
      equipmentSnapshots: buildEquipmentSnapshots(equipmentLibrary, selectedIds),
      geoCity: userGeoCity,
      geoCountry: userGeoCountry,
    }, user?.uid, userCoordinates);
    registerCreatedLiveStream(live.id, cameraStream);
    rememberLiveEquipmentSetup(effectiveDraft.family, selectedIds);
    rememberLiveEquipmentSetupBySubcategory(effectiveDraft.subcategory, selectedIds);
    closeCreate();
    navigate(`/live/${encodeURIComponent(live.id)}`);
  };

  const updateScheduleDraft = (key, value) => {
    setScheduleDraft((current) => ({ ...current, [key]: value }));
  };

  const canSchedule = scheduleDraft.family && scheduleDraft.subcategory && scheduleDraft.title.trim() && scheduleDraft.date && scheduleDraft.time;

  const submitSchedule = async () => {
    if (!canSchedule) return;
    const scheduledStartAt = new Date(`${scheduleDraft.date}T${scheduleDraft.time}:00`).toISOString();
    const selectedFamily = EXPERIENCE_FAMILIES[scheduleDraft.family];
    const environment = selectedFamily?.environment ?? 'land';
    setScheduleStatus('submitting');
    setScheduleError(null);
    try {
      await createStream({
        title: scheduleDraft.title.trim(),
        description: scheduleDraft.description.trim() || undefined,
        category: scheduleDraft.subcategory,
        subcategories: [scheduleDraft.subcategory],
        environment,
        visibility: scheduleDraft.privacy === 'Followers' ? 'followers' : scheduleDraft.privacy === 'Private' ? 'private' : 'public',
        city: userGeoCity ?? undefined,
        scheduledStartAt,
      });
      setScheduleStatus('success');
    } catch (err) {
      setScheduleStatus('error');
      setScheduleError(err.message ?? 'Failed to schedule live');
    }
  };

  const applyPreviousSetup = () => {
    const previous = getLastLiveEquipmentIds(draft.family);
    const defaults  = getDefaultEquipmentIds(equipmentLibrary);
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
              {createMode === 'launch' || createMode === 'schedule' ? (
                <button type="button" onClick={() => setCreateMode('actions')} aria-label={t('common.back')}>
                  <ChevronLeft size={18} strokeWidth={1.9} />
                </button>
              ) : (
                <BrandMark size={22} showName useLegacy />
              )}
              {createMode === 'launch' ? <strong>Start a live</strong> : null}
              {createMode === 'schedule' ? <strong>{t('create.scheduleLive')}</strong> : null}
              <button type="button" onClick={closeCreate} aria-label={t('common.close')}>
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
            {createMode === 'schedule' ? (
              <ScheduleFlow
                draft={scheduleDraft}
                onUpdate={updateScheduleDraft}
                status={scheduleStatus}
                error={scheduleError}
                canSubmit={canSchedule}
                onSubmit={submitSchedule}
                onRetry={() => { setScheduleStatus('form'); setScheduleError(null); }}
                onDone={closeCreate}
              />
            ) : createMode === 'launch' ? (
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
            ) : (
              <div className="create-sheet__actions">
                {createActions.map(({ labelKey, icon: Icon, mode: actionMode }) => (
                  <button
                    key={labelKey}
                    type="button"
                    onClick={() => {
                      if (actionMode === 'launch') setCreateMode('launch');
                      else if (labelKey === 'create.scheduleLive') setCreateMode('schedule');
                      else closeCreate();
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{t(labelKey)}</span>
                  </button>
                ))}
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
