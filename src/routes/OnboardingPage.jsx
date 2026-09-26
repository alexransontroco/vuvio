import {
  BatteryCharging, Bike, Camera, Check, Mic, Plus, Radio, Sparkles, X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { readImageFile } from '../services/profileService.js';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';
import { addEquipmentItem, initEquipmentService } from '../services/equipmentService.js';

const TOTAL_STEPS = 6;

/* ─── Equipment category meta ────────────────────── */
const GEAR_CATS_DEFS = [
  { id: 'recording',         labelKey: 'onboarding.gearCats.camera', icon: Camera },
  { id: 'audio',             labelKey: 'onboarding.gearCats.audio',  icon: Mic },
  { id: 'activity',          labelKey: 'onboarding.gearCats.gear',   icon: Bike },
  { id: 'streaming',         labelKey: 'onboarding.gearCats.stream', icon: Radio },
  { id: 'power_accessories', labelKey: 'onboarding.gearCats.power',  icon: BatteryCharging },
];
const gearCatIcon = (id) => { const c = GEAR_CATS_DEFS.find((g) => g.id === id); return c ? c.icon : Camera; };
const useGearCatLabel = () => {
  const { t } = useTranslation();
  return (id) => {
    const cat = GEAR_CATS_DEFS.find((g) => g.id === id);
    return cat ? t(cat.labelKey) : id;
  };
};

/* ─── Gear suggestions catalogue ────────────────── */
// activities: null = always shown, string[] = shown when any activity matches
const GEAR_SUGGESTIONS = [
  { id: 'sg-hero13',    brand: 'GoPro',  model: 'HERO13 Black',       category: 'recording',         equipmentType: 'Action Camera',      activities: null },
  { id: 'sg-dji-mic',  brand: 'DJI',    model: 'Mic 2',              category: 'audio',             equipmentType: 'Wireless Microphone', activities: null },
  { id: 'sg-power',    brand: 'Anker',  model: 'Power Bank',         category: 'power_accessories', equipmentType: 'Battery',            activities: null },
  { id: 'sg-chest',    brand: 'GoPro',  model: 'Chesty Mount',       category: 'recording',         equipmentType: 'Chest Mount',        activities: ['Mountain bike', 'Bicycle', 'Hiking', 'Motocross', 'Skateboarding'] },
  { id: 'sg-helmet-m', brand: 'GoPro',  model: 'Helmet Mount',       category: 'recording',         equipmentType: 'Helmet Mount',       activities: ['Mountain bike', 'Skiing', 'Snowboarding', 'Motocross'] },
  { id: 'sg-suction',  brand: 'GoPro',  model: 'Suction Cup Mount',  category: 'recording',         equipmentType: 'Car Mount',          activities: ['Transport', 'Tour'] },
  { id: 'sg-drone',    brand: 'DJI',    model: 'Mini 4 Pro',         category: 'recording',         equipmentType: 'Drone',              activities: ['Drone'] },
  { id: 'sg-wp',       brand: 'GoPro',  model: 'Waterproof Housing', category: 'recording',         equipmentType: 'Waterproof Case',    activities: ['Surfing', 'Kayak', 'Paddleboarding', 'Diving', 'Sailboat', 'Boat', 'Fishing'] },
  { id: 'sg-tripod',   brand: 'Joby',   model: 'GorillaPod',         category: 'recording',         equipmentType: 'Tripod',             activities: ['Concert', 'Cooking', 'Work', 'Construction', 'Agriculture'] },
  { id: 'sg-rode',     brand: 'RØDE',   model: 'VideoMicro',         category: 'audio',             equipmentType: 'Microphone',         activities: ['Concert', 'Cooking', 'Work', 'Agriculture'] },
  { id: 'sg-osmo',     brand: 'DJI',    model: 'Osmo Action 4',      category: 'recording',         equipmentType: 'Action Camera',      activities: ['Surfing', 'Diving', 'Paragliding', 'Wingsuit', 'Hiking', 'Walking'] },
  { id: 'sg-sd',       brand: 'SanDisk', model: 'Extreme Pro 256GB', category: 'power_accessories', equipmentType: 'Memory Card',        activities: null },
];

function getSuggestions(activities) {
  return GEAR_SUGGESTIONS.filter(
    (s) => s.activities === null || (activities.length > 0 && s.activities.some((a) => activities.includes(a))),
  );
}

/* ─── Progress dots ──────────────────────────────── */
function ProgressDots({ step }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-progress" aria-label={t('onboarding.stepXofY', { step, total: TOTAL_STEPS })}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`onboarding-progress__dot${i + 1 === step ? ' is-active' : i + 1 < step ? ' is-done' : ''}`}
        />
      ))}
    </div>
  );
}

/* ─── Step 1 — Profile ───────────────────────────── */
function StepProfile({ displayName, setDisplayName, avatarPreview, onSelectAvatar }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);

  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">{t('onboarding.stepLabel', { n: 1 })}</p>
        <h2 className="onboarding-step__title">{t('onboarding.step1.title')}</h2>
        <p className="onboarding-step__sub">{t('onboarding.step1.sub')}</p>
      </div>

      <div className="onboarding-avatar">
        <button type="button" className="onboarding-avatar__btn" onClick={() => fileRef.current?.click()} aria-label={t('onboarding.step1.uploadAria')}>
          {avatarPreview ? (
            <>
              <img src={avatarPreview} alt={t('onboarding.step1.previewAlt')} />
              <div className="onboarding-avatar__edit-icon"><Camera size={20} strokeWidth={1.8} color="#f4f7fa" /></div>
            </>
          ) : (
            <Camera size={24} strokeWidth={1.6} />
          )}
        </button>
        <span className="onboarding-avatar__label">{avatarPreview ? t('onboarding.step1.changePhoto') : t('onboarding.step1.addPhoto')}</span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onSelectAvatar} />
      </div>

      <div className="auth-field">
        <label className="auth-field__label" htmlFor="ob-name">{t('onboarding.step1.displayName')}</label>
        <div className="auth-field__control">
          <input id="ob-name" className="auth-field__input" type="text" autoComplete="name" placeholder={t('onboarding.step1.namePlaceholder')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2 — Interests ─────────────────────────── */
function StepInterests({ selected, onToggle }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">{t('onboarding.stepLabel', { n: 2 })}</p>
        <h2 className="onboarding-step__title">{t('onboarding.step2.title')}</h2>
        <p className="onboarding-step__sub">{t('onboarding.step2.sub')}</p>
      </div>
      <div className="onboarding-categories">
        {ACTIVITY_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selected.includes(cat.id);
          return (
            <button
              key={cat.id} type="button"
              className={`onboarding-category${isSelected ? ' is-selected' : ''}`}
              onClick={() => onToggle(cat.id)} aria-pressed={isSelected}
              style={isSelected ? { borderColor: `${cat.color}60`, backgroundColor: `${cat.color}18`, color: cat.color } : {}}
            >
              <Icon size={22} strokeWidth={1.7} aria-hidden="true" style={isSelected ? { color: cat.color } : {}} />
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 3 — Activities ────────────────────────── */
function StepActivities({ selectedCategories, activities, onToggle }) {
  const { t } = useTranslation();
  // Build activity pills from selected categories (or all if none selected)
  const sourceCats = selectedCategories.length > 0
    ? ACTIVITY_CATEGORIES.filter((c) => selectedCategories.includes(c.id))
    : ACTIVITY_CATEGORIES;

  // Deduplicated list preserving category color
  const seen = new Set();
  const items = sourceCats.flatMap((cat) =>
    cat.subcategories
      .filter((sub) => { if (seen.has(sub)) return false; seen.add(sub); return true; })
      .map((sub) => ({ name: sub, color: cat.color, catId: cat.id })),
  );

  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">{t('onboarding.stepLabel', { n: 3 })}</p>
        <h2 className="onboarding-step__title">{t('onboarding.step3.title')}</h2>
        <p className="onboarding-step__sub">
          {selectedCategories.length > 0
            ? t('onboarding.step3.subFiltered')
            : t('onboarding.step3.subAny')}
        </p>
      </div>
      <div className="onboarding-activities">
        {items.map(({ name, color }) => {
          const isSelected = activities.includes(name);
          return (
            <button
              key={name} type="button"
              className={`onboarding-activity${isSelected ? ' is-selected' : ''}`}
              onClick={() => onToggle(name)} aria-pressed={isSelected}
              style={isSelected ? { borderColor: `${color}55`, backgroundColor: `${color}15`, color } : {}}
            >
              {isSelected && <Check size={12} strokeWidth={2.5} style={{ color }} />}
              {name}
            </button>
          );
        })}
        {items.length === 0 && (
          <p style={{ color: 'rgba(111,130,148,0.7)', fontSize: 13 }}>
            {t('onboarding.step3.empty')}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Step 4 — Gear ──────────────────────────────── */
function StepGear({ activities, checkedSuggestions, onToggleSuggestion, customItems, onAddCustom, onRemoveCustom }) {
  const { t } = useTranslation();
  const gearCatLabel = useGearCatLabel();
  const [brand,    setBrand]    = useState('');
  const [model,    setModel]    = useState('');
  const [category, setCategory] = useState('recording');
  const [showForm, setShowForm] = useState(false);

  const suggestions = getSuggestions(activities);

  const handleAdd = () => {
    const b = brand.trim();
    const m = model.trim();
    if (!b && !m) return;
    onAddCustom({ id: `ob-gear-${Date.now()}`, brand: b, model: m, category, ownership: 'owned', isPublic: true, isDefault: false, provider: 'user', status: 'active', imageSource: 'placeholder', imageStatus: 'placeholder' });
    setBrand(''); setModel('');
  };

  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">{t('onboarding.stepLabel', { n: 4 })}</p>
        <h2 className="onboarding-step__title">{t('onboarding.step4.title')}</h2>
        <p className="onboarding-step__sub">
          {activities.length > 0
            ? t('onboarding.step4.subFiltered')
            : t('onboarding.step4.subAny')}
        </p>
      </div>

      <div className="onboarding-gear-v2">
        {/* Suggestions */}
        <ul className="onboarding-gear-v2__list">
          {suggestions.map((s) => {
            const Icon = gearCatIcon(s.category);
            const checked = checkedSuggestions.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`onboarding-gear-v2__row${checked ? ' is-checked' : ''}`}
                  onClick={() => onToggleSuggestion(s.id)}
                  aria-pressed={checked}
                >
                  <span className={`onboarding-gear-v2__checkbox${checked ? ' is-checked' : ''}`}>
                    {checked && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="onboarding-gear-v2__icon"><Icon size={14} strokeWidth={1.8} /></span>
                  <span className="onboarding-gear-v2__info">
                    <strong>{s.brand} {s.model}</strong>
                    <small>{s.equipmentType}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Custom items already added */}
        {customItems.length > 0 && (
          <ul className="onboarding-gear__list" style={{ marginTop: 8 }}>
            {customItems.map((item) => {
              const Icon = gearCatIcon(item.category);
              return (
                <li key={item.id} className="onboarding-gear__item">
                  <Icon size={14} strokeWidth={1.8} className="onboarding-gear__item-icon" />
                  <span className="onboarding-gear__item-label">{[item.brand, item.model].filter(Boolean).join(' ')}</span>
                  <span className="onboarding-gear__item-cat">{gearCatLabel(item.category)}</span>
                  <button type="button" className="onboarding-gear__item-remove" onClick={() => onRemoveCustom(item.id)} aria-label={t('common.remove')}>
                    <X size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Toggle add form */}
        <button type="button" className="onboarding-gear-v2__add-toggle" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} strokeWidth={2} />
          {t('onboarding.step4.addCustom')}
        </button>

        {showForm && (
          <div className="onboarding-gear__form" style={{ marginTop: 8 }}>
            {/* Category tabs */}
            <div className="onboarding-gear__cats" style={{ gridColumn: '1/-1', marginBottom: 4 }}>
              {GEAR_CATS_DEFS.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id} type="button"
                  className={`onboarding-gear__cat${category === id ? ' is-active' : ''}`}
                  onClick={() => setCategory(id)}
                >
                  <Icon size={13} strokeWidth={1.8} />{t(labelKey)}
                </button>
              ))}
            </div>
            <input className="auth-field__input onboarding-gear__input" type="text" placeholder={t('onboarding.step4.brand')} value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <input className="auth-field__input onboarding-gear__input" type="text" placeholder={t('onboarding.step4.model')} value={model} onChange={(e) => setModel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <button type="button" className="onboarding-gear__add-btn" onClick={handleAdd} disabled={!brand.trim() && !model.trim()} aria-label={t('onboarding.step4.add')}>
              <Plus size={18} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 5 — Bio ───────────────────────────────── */
function StepBio({ bio, setBio }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">{t('onboarding.stepLabel', { n: 5 })}</p>
        <h2 className="onboarding-step__title">{t('onboarding.step5.title')}</h2>
        <p className="onboarding-step__sub">{t('onboarding.step5.sub')}</p>
      </div>
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="ob-bio">{t('onboarding.step5.bioLabel')}</label>
        <div className="auth-field__control">
          <textarea id="ob-bio" className="auth-field__input" style={{ minHeight: '100px', resize: 'vertical' }} placeholder={t('onboarding.step5.bioPlaceholder')} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} maxLength={160} />
        </div>
        <span style={{ fontSize: '12px', color: 'rgba(111, 130, 148, 0.8)', marginTop: '4px' }}>{bio.length}/160</span>
      </div>
    </div>
  );
}

/* ─── Step 6 — Welcome ───────────────────────────── */
function StepWelcome({ displayName, selectedCategories, activities, checkedSuggestions, customItems }) {
  const { t } = useTranslation();
  const cats = ACTIVITY_CATEGORIES.filter((c) => selectedCategories.includes(c.id));
  const checkedGear = GEAR_SUGGESTIONS.filter((s) => checkedSuggestions.has(s.id));
  const allGear = [...checkedGear, ...customItems];

  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome__mark"><BrandMark size={36} /></div>
      <h2 className="onboarding-welcome__title">
        {displayName ? t('onboarding.step6.welcomeName', { name: displayName.split(' ')[0] }) : t('onboarding.step6.welcome')}
      </h2>
      <p className="onboarding-welcome__body">{t('onboarding.step6.body')}</p>

      {cats.length > 0 && (
        <div className="onboarding-welcome__interests">
          {cats.map((cat) => {
            const Icon = cat.icon;
            return (
              <span key={cat.id} className="onboarding-welcome__pill">
                <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
                {cat.label}
              </span>
            );
          })}
        </div>
      )}

      {activities.length > 0 && (
        <div className="onboarding-welcome__interests">
          {activities.map((a) => (
            <span key={a} className="onboarding-welcome__pill" style={{ borderColor: 'rgba(134,202,224,0.2)', background: 'rgba(134,202,224,0.06)', color: 'rgba(134,202,224,0.8)' }}>
              {a}
            </span>
          ))}
        </div>
      )}

      {allGear.length > 0 && (
        <div className="onboarding-welcome__interests">
          {allGear.map((g) => {
            const Icon = gearCatIcon(g.category);
            return (
              <span key={g.id} className="onboarding-welcome__pill" style={{ borderColor: 'rgba(86,180,140,0.24)', background: 'rgba(86,180,140,0.08)', color: 'rgba(86,180,140,0.9)' }}>
                <Icon size={12} strokeWidth={1.8} />
                {[g.brand, g.model].filter(Boolean).join(' ')}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────── */
export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, updateProfile, refreshUserProfile } = useAuth();
  const returnTo = location.state?.returnTo || '/watch';

  const [step,               setStep]               = useState(1);
  const [displayName,        setDisplayName]        = useState(userProfile?.displayName || user?.displayName || '');
  const [avatarPreview,      setAvatarPreview]      = useState(userProfile?.photoURL || '');
  const [avatarDataUrl,      setAvatarDataUrl]      = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [activities,         setActivities]         = useState([]);
  const [checkedSuggestions, setCheckedSuggestions] = useState(new Set());
  const [customItems,        setCustomItems]        = useState([]);
  const [bio,                setBio]                = useState(userProfile?.bio || '');
  const [busy,               setBusy]               = useState(false);
  const [error,              setError]              = useState('');

  const toggleCategory = (id) =>
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleActivity = (name) =>
    setActivities((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);

  const toggleSuggestion = (id) =>
    setCheckedSuggestions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addCustom = (item) => setCustomItems((prev) => [item, ...prev]);
  const removeCustom = (id) => setCustomItems((prev) => prev.filter((i) => i.id !== id));

  const handleSelectAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setAvatarPreview(dataUrl);
      setAvatarDataUrl(dataUrl);
    } catch { /* ignore */ }
    e.target.value = '';
  };

  const handleContinue = async () => {
    setError('');

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step < 5) { setStep((s) => s + 1); return; }

    if (step === 5) { setStep(6); return; }

    // Step 6 — save everything
    if (step === 6) {
      setBusy(true);
      try {
        if (!user?.uid) throw new Error('No user session');

        // Avatar upload
        let photoURL = userProfile?.photoURL || null;
        if (avatarDataUrl) {
          const ext = avatarDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
          const ref = storageRef(storage, `users/${user.uid}/profile/avatar.${ext}`);
          await uploadString(ref, avatarDataUrl, 'data_url', { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
          photoURL = await getDownloadURL(ref);
        }

        // Profile
        await updateProfile({
          displayName:        displayName.trim() || '',
          preferredCategories: selectedCategories,
          preferredActivities: activities,
          bio:                bio.trim() || '',
          onboardingCompleted: true,
          photoURL,
        });

        // Gear → creatorEquipment collection
        const checkedGear = GEAR_SUGGESTIONS.filter((s) => checkedSuggestions.has(s.id));
        const allGear = [...checkedGear, ...customItems];
        if (allGear.length > 0) {
          await initEquipmentService(user.uid);
          for (const item of allGear) {
            addEquipmentItem({ ...item, userId: user.uid, isPublic: true, isDefault: false, ownership: 'owned' });
          }
        }

        await refreshUserProfile();
        navigate(returnTo, { replace: true });
      } catch (e) {
        console.error('[Onboarding] error:', e);
        setError(e.message || t('common.error'));
        setBusy(false);
      }
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      if (!user?.uid) throw new Error(t('onboarding.errors.sessionLoading'));
      await updateProfile({ onboardingCompleted: true });
      await refreshUserProfile();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || t('onboarding.errors.finishFailed'));
      setBusy(false);
    }
  };

  const gearCount = checkedSuggestions.size + customItems.length;
  const ctaLabel =
    step === 6 ? t('onboarding.cta.explore') :
    step === 4 ? (gearCount > 0
      ? t('onboarding.cta.continueWithCount', { count: gearCount })
      : t('onboarding.cta.continue')) :
    t('onboarding.cta.continue');

  return (
    <div className="onboarding-screen">
      <div className="onboarding-header">
        <BrandMark size={28} showName />
        <ProgressDots step={step} />
        <button type="button" className="onboarding-skip" onClick={skip} disabled={busy}>
          {t('onboarding.skip')}
        </button>
      </div>

      <div className="onboarding-body">
        {step === 1 && (
          <StepProfile
            displayName={displayName} setDisplayName={setDisplayName}
            avatarPreview={avatarPreview} onSelectAvatar={handleSelectAvatar}
          />
        )}
        {step === 2 && <StepInterests selected={selectedCategories} onToggle={toggleCategory} />}
        {step === 3 && <StepActivities selectedCategories={selectedCategories} activities={activities} onToggle={toggleActivity} />}
        {step === 4 && (
          <StepGear
            activities={activities}
            checkedSuggestions={checkedSuggestions}
            onToggleSuggestion={toggleSuggestion}
            customItems={customItems}
            onAddCustom={addCustom}
            onRemoveCustom={removeCustom}
          />
        )}
        {step === 5 && <StepBio bio={bio} setBio={setBio} />}
        {step === 6 && (
          <StepWelcome
            displayName={displayName}
            selectedCategories={selectedCategories}
            activities={activities}
            checkedSuggestions={checkedSuggestions}
            customItems={customItems}
          />
        )}
      </div>

      <div className="onboarding-cta">
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button type="button" className="onboarding-cta-button" onClick={handleContinue} disabled={busy}>
          {busy
            ? <span className="auth-submit__spinner" aria-hidden="true" />
            : <Sparkles size={16} strokeWidth={2} aria-hidden="true" />}
          {busy ? 'Saving…' : ctaLabel}
        </button>
      </div>
    </div>
  );
}
