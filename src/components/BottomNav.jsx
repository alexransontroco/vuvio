import { CalendarPlus, Camera, ChevronLeft, Compass, Footprints, Globe2, ImagePlus, Pencil, Plane, Play, Sparkles, Tv2, UserRound, Video, Waves, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';
import { EquipmentSelector, QuickAddEquipmentForm } from './equipment/EquipmentKit.jsx';
import { EXPERIENCE_FAMILIES } from '../data/experienceTaxonomy.js';
import { SUBCATEGORY_EQUIPMENT_TYPES } from '../data/equipmentModel.js';
import { createLocalLive, registerCreatedLiveStream } from '../services/createdLiveService.js';
import {
  addEquipmentItem,
  buildEquipmentSnapshots,
  equipmentLabel,
  getDefaultEquipmentIds,
  getEquipmentLibrary,
  getEquipmentSelection,
  getLastLiveEquipmentIds,
  getLastLiveEquipmentIdsBySubcategory,
  getSuggestedEquipmentIds,
  rememberLiveEquipmentSetup,
  rememberLiveEquipmentSetupBySubcategory,
} from '../services/equipmentService.js';

const navItems = [
  { to: '/home', labelKey: 'navigation.watch', icon: Tv2 },
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
  location: 'Chamonix, France',
  privacy: 'Everyone',
  quality: '1080p',
  equipmentIds: [],
};

const privacyOptions = ['Everyone', 'Followers', 'Private'];
const qualityOptions = ['720p', '1080p', 'Auto'];

function LivePreview({ draft, selectedFamily, equipmentLibrary, onEditGear, onLaunch }) {
  const selectedItems = getEquipmentSelection(equipmentLibrary, draft.equipmentIds ?? []);
  const captureItems = selectedItems.filter((item) => item.category !== 'activity');
  const activityItems = selectedItems.filter((item) => item.category === 'activity');
  const FamilyIcon = selectedFamily ? { air: Plane, earth: Footprints, water: Waves }[selectedFamily.id] : null;

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const launchedRef = useRef(false);
  const [cameraState, setCameraState] = useState('pending');

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState(window.isSecureContext ? 'unavailable' : 'insecure');
      return undefined;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }))
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraState('active');
      })
      .catch(() => { if (active) setCameraState('denied'); });
    return () => {
      active = false;
      if (!launchedRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
    };
  }, []);

  const handleLaunch = () => {
    launchedRef.current = true;
    onLaunch(streamRef.current);
  };

  return (
    <div className="live-preview">
      <div className="live-preview__cover">
        {cameraState === 'active' ? (
          <video ref={videoRef} className="live-preview__camera" autoPlay muted playsInline />
        ) : (
          <>
            <video ref={videoRef} style={{ display: 'none' }} autoPlay muted playsInline />
            <Camera size={28} strokeWidth={1.5} />
            <span>{cameraState === 'denied' ? 'Camera access denied' : cameraState === 'insecure' ? 'Camera needs HTTPS or localhost' : cameraState === 'unavailable' ? 'No camera available' : 'Starting camera...'}</span>
          </>
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
        <p className="live-preview__desc">{draft.location} - {draft.privacy} - {draft.quality}</p>
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

export default function BottomNav({ collapsible = false, collapsed = false, onExpand, onCollapse }) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState('actions');
  const [draft, setDraft] = useState(initialLiveDraft);
  const [showPreview, setShowPreview] = useState(false);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState({ category: 'recording', brand: '', model: '' });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setShowPreview(false);
  }, [location.pathname]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateMode('actions');
    setDraft(initialLiveDraft);
    setShowPreview(false);
  };

  const selectedFamily = draft.family ? EXPERIENCE_FAMILIES[draft.family] : null;
  const launchStep = !draft.family ? 1 : !draft.subcategory ? 2 : !draft.description.trim() ? 3 : !draft.title.trim() ? 4 : showPreview ? 6 : 5;
  const canLaunch = draft.family && draft.subcategory && draft.description.trim() && draft.title.trim();

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const launchLive = (cameraStream = null) => {
    if (!canLaunch) return;
    const selectedIds = draft.equipmentIds ?? [];
    const live = createLocalLive({
      ...draft,
      hasCameraStream: Boolean(cameraStream),
      equipment: selectedIds.map((equipmentId) => ({ equipmentId })),
      equipmentSnapshots: buildEquipmentSnapshots(equipmentLibrary, selectedIds),
    });
    registerCreatedLiveStream(live.id, cameraStream);
    rememberLiveEquipmentSetup(draft.family, selectedIds);
    rememberLiveEquipmentSetupBySubcategory(draft.subcategory, selectedIds);
    closeCreate();
    navigate(`/home?live=${encodeURIComponent(live.id)}&broadcast=1`);
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
                <button type="button" onClick={() => { if (showPreview) { setShowPreview(false); } else { setCreateMode('actions'); } }} aria-label={t('common.back')}>
                  <ChevronLeft size={18} strokeWidth={1.9} />
                </button>
              ) : (
                <BrandMark size={22} showName />
              )}
              {createMode === 'launch' ? <strong>{showPreview ? 'Preview' : t('create.startLive')}</strong> : null}
              <button type="button" onClick={closeCreate} aria-label={t('common.close')}>
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
            {createMode === 'launch' ? (
              <div className="create-live-flow">
                <div className="create-live-flow__steps" aria-label={t('create.step', { step: launchStep })}>
                  {[1, 2, 3, 4, 5, 6].map((step) => (
                    <i key={step} className={step <= launchStep ? 'is-active' : ''} />
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
                          onClick={() => {
                            const previous = getLastLiveEquipmentIds(family.id);
                            const defaults = getDefaultEquipmentIds(equipmentLibrary);
                            setDraft({ ...draft, family: family.id, subcategory: '', equipmentIds: previous.length ? previous : defaults });
                          }}
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
                      {selectedFamily.subcategories.map((subcategory) => (
                        <button
                          key={subcategory}
                          type="button"
                          className={draft.subcategory === subcategory ? 'is-active' : ''}
                          onClick={() => updateDraft('subcategory', subcategory)}
                        >
                          {subcategory}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {draft.subcategory ? (
                  <section className="create-live-flow__section">
                  <h2>{t('create.whatShow')}</h2>
                  <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft('description', event.target.value)}
                      placeholder={t('create.descriptionPlaceholder')}
                      rows={3}
                    />
                  </section>
                ) : null}

                {draft.description.trim() ? (
                  <section className="create-live-flow__section">
                    <h2>{t('create.title')}</h2>
                    <input
                      value={draft.title}
                      onChange={(event) => updateDraft('title', event.target.value)}
                      placeholder={draft.description.trim().slice(0, 44)}
                    />
                    <div className="create-live-cover">
                      <span>
                        <Camera size={17} strokeWidth={1.8} />
                      </span>
                      <div>
                        <strong>{t('create.autoCover')}</strong>
                        <small>{t('create.autoCoverHint')}</small>
                      </div>
                      <Sparkles size={17} strokeWidth={1.7} />
                    </div>
                  </section>
                ) : null}

                {draft.title.trim() ? (
                  <>
                    <section className="create-live-flow__section">
                      <h2>Location</h2>
                      <input
                        value={draft.location}
                        onChange={(event) => updateDraft('location', event.target.value)}
                        placeholder="Chamonix, France"
                      />
                    </section>

                    <section className="create-live-flow__section">
                      <h2>Privacy</h2>
                      <div className="create-live-chip-row">
                        {privacyOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={draft.privacy === option ? 'is-active' : ''}
                            onClick={() => updateDraft('privacy', option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="create-live-flow__section">
                      <h2>Quality</h2>
                      <div className="create-live-chip-row">
                        {qualityOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={draft.quality === option ? 'is-active' : ''}
                            onClick={() => updateDraft('quality', option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}

                {draft.title.trim() && !showPreview ? (
                  <>
                    {quickAddOpen ? (
                      <QuickAddEquipmentForm
                        value={quickAddDraft}
                        onChange={setQuickAddDraft}
                        onCancel={() => setQuickAddOpen(false)}
                        onSave={saveQuickEquipment}
                        suggestedTypes={SUBCATEGORY_EQUIPMENT_TYPES[draft.subcategory] ?? []}
                      />
                    ) : (
                      <EquipmentSelector
                        items={equipmentLibrary}
                        selectedIds={draft.equipmentIds ?? []}
                        onToggle={toggleEquipment}
                        onUseSuggested={applySuggestedGear}
                        onUsePrevious={applyPreviousSetup}
                        onAdd={() => openQuickAdd('recording')}
                        onAddActivity={() => openQuickAdd('activity')}
                        onSkip={() => updateDraft('equipmentIds', [])}
                        subcategory={draft.subcategory}
                        hasPreviousSetup={getLastLiveEquipmentIdsBySubcategory(draft.subcategory).length > 0}
                      />
                    )}
                  </>
                ) : null}

                {showPreview ? (
                  <LivePreview
                    draft={draft}
                    selectedFamily={selectedFamily}
                    equipmentLibrary={equipmentLibrary}
                    onEditGear={() => setShowPreview(false)}
                    onLaunch={launchLive}
                  />
                ) : (
                  <button type="button" className="create-live-launch" disabled={!canLaunch} onClick={() => setShowPreview(true)}>
                    <Play size={17} fill="currentColor" strokeWidth={1.8} />
                    Preview
                  </button>
                )}
              </div>
            ) : (
              <div className="create-sheet__actions">
                {createActions.map(({ labelKey, icon: Icon, mode: actionMode }) => (
                  <button
                    key={labelKey}
                    type="button"
                    onClick={() => (actionMode === 'launch' ? setCreateMode('launch') : closeCreate())}
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
        <button type="button" className="bottom-nav__create" onClick={() => setCreateOpen(true)} aria-label={t('navigation.create')}>
          <BrandMark size={34} style={{ marginTop: 10 }} />
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
