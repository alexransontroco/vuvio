import { Camera, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isUsernameAvailable, reserveUsername, updateUserProfile } from '../services/authService.js';
import { readImageFile } from '../services/profileService.js';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';
import { validateUsername } from '../services/authService.js';

const TOTAL_STEPS = 3;

function ProgressDots({ step }) {
  return (
    <div className="onboarding-progress" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`onboarding-progress__dot${i + 1 === step ? ' is-active' : i + 1 < step ? ' is-done' : ''}`}
        />
      ))}
    </div>
  );
}

/* ─── Step 1 — Profile setup ─────────────────────── */
function StepProfile({ displayName, setDisplayName, username, setUsername, usernameError, setUsernameError, avatarPreview, onSelectAvatar }) {
  const fileRef = useRef(null);

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/\s/g, '');
    setUsername(val);
    const err = validateUsername(val);
    setUsernameError(err || '');
  };

  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">Step 1</p>
        <h2 className="onboarding-step__title">Set up your profile</h2>
        <p className="onboarding-step__sub">Add a photo and choose your creator name.</p>
      </div>

      <div className="onboarding-avatar">
        <button
          type="button"
          className="onboarding-avatar__btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload profile photo"
        >
          {avatarPreview ? (
            <>
              <img src={avatarPreview} alt="Preview" />
              <div className="onboarding-avatar__edit-icon">
                <Camera size={20} strokeWidth={1.8} color="#f4f7fa" />
              </div>
            </>
          ) : (
            <Camera size={24} strokeWidth={1.6} />
          )}
        </button>
        <span className="onboarding-avatar__label">
          {avatarPreview ? 'Change photo' : 'Add a photo (optional)'}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={onSelectAvatar}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="ob-name">Display name</label>
          <div className="auth-field__control">
            <input
              id="ob-name"
              className="auth-field__input"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="ob-username">
            Username <span style={{ color: 'rgba(111,130,148,0.7)', fontWeight: 430, fontSize: 11 }}>3–24 chars, letters · numbers · _ ·</span>
          </label>
          <div className="auth-field__control">
            <input
              id="ob-username"
              className={`auth-field__input${usernameError ? ' has-error' : ''}`}
              type="text"
              autoComplete="username"
              placeholder="yourhandle"
              value={username}
              onChange={handleUsernameChange}
              maxLength={24}
            />
          </div>
          {usernameError ? <span className="auth-field__error">{usernameError}</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2 — Interests ─────────────────────────── */
function StepInterests({ selected, onToggle }) {
  return (
    <div className="onboarding-step">
      <div>
        <p className="onboarding-step__eyebrow">Step 2</p>
        <h2 className="onboarding-step__title">What are you into?</h2>
        <p className="onboarding-step__sub">Choose a few to personalize your experience.</p>
      </div>

      <div className="onboarding-categories">
        {ACTIVITY_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selected.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              className={`onboarding-category${isSelected ? ' is-selected' : ''}`}
              onClick={() => onToggle(cat.id)}
              aria-pressed={isSelected}
              style={isSelected ? {
                borderColor: `${cat.color}60`,
                backgroundColor: `${cat.color}18`,
                color: cat.color,
              } : {}}
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

/* ─── Step 3 — Welcome ───────────────────────────── */
function StepWelcome({ displayName, selected }) {
  const selectedCategories = ACTIVITY_CATEGORIES.filter((c) => selected.includes(c.id));

  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome__mark">
        <BrandMark size={36} />
      </div>
      <h2 className="onboarding-welcome__title">
        Welcome{displayName ? `, ${displayName.split(' ')[0]}` : ''}!
      </h2>
      <p className="onboarding-welcome__body">
        You're all set. Start exploring live perspectives from around the world.
      </p>
      {selectedCategories.length > 0 ? (
        <div className="onboarding-welcome__interests">
          {selectedCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <span key={cat.id} className="onboarding-welcome__pill">
                <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
                {cat.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────── */
export default function OnboardingPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, userProfile, updateProfile, refreshUserProfile } = useAuth();
  const returnTo  = location.state?.returnTo || '/watch';

  const [step,         setStep]         = useState(1);
  const [displayName,  setDisplayName]  = useState(userProfile?.displayName || user?.displayName || '');
  const [username,     setUsername]     = useState('');
  const [usernameError,setUsernameError]= useState('');
  const [avatarPreview,setAvatarPreview]= useState(userProfile?.photoURL || '');
  const [avatarDataUrl,setAvatarDataUrl]= useState('');
  const [selected,     setSelected]     = useState([]);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');

  const toggleCategory = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
    console.log('[Onboarding] Continue clicked, step:', step);
    setError('');

    if (step === 1) {
      if (username) {
        const err = validateUsername(username);
        if (err) {
          console.log('[Onboarding] Username error:', err);
          setUsernameError(err);
          return;
        }
        setUsernameError('');
      }

      setBusy(true);
      try {
        if (username) {
          const avail = await isUsernameAvailable(username);
          if (!avail) {
            setUsernameError('Username taken');
            setBusy(false);
            return;
          }
        }
        console.log('[Onboarding] Step 1 OK, moving to step 2');
        setStep(2);
        setBusy(false);
      } catch (e) {
        console.error('[Onboarding] Step 1 error:', e);
        setError(e.message || 'Error');
        setBusy(false);
      }
      return;
    }

    if (step === 2) {
      console.log('[Onboarding] Moving to step 3');
      setStep(3);
      return;
    }

    if (step === 3) {
      setBusy(true);
      try {
        if (!user?.uid) throw new Error('No user session');

        let photoURL = userProfile?.photoURL || null;
        if (avatarDataUrl && user.uid) {
          try {
            const ext = avatarDataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
            const ref = storageRef(storage, `users/${user.uid}/profile/avatar.${ext}`);
            await uploadString(ref, avatarDataUrl, 'data_url');
            photoURL = await getDownloadURL(ref);
          } catch (e) {
            console.warn('[Onboarding] Avatar upload failed:', e);
          }
        }

        if (username) {
          await reserveUsername(user.uid, username);
        }

        await updateProfile({
          displayName: displayName.trim() || '',
          preferredCategories: selected,
          onboardingCompleted: true,
          photoURL,
        });

        await refreshUserProfile();
        console.log('[Onboarding] Complete, navigating to:', returnTo);
        navigate(returnTo, { replace: true });
      } catch (e) {
        console.error('[Onboarding] Step 3 error:', e);
        setError(e.message || 'Error');
        setBusy(false);
      }
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      if (!user?.uid) {
        throw new Error('Your session is still loading. Please try again.');
      }
      await updateProfile({ onboardingCompleted: true });
      await refreshUserProfile();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not finish onboarding. Please try again.');
      setBusy(false);
    }
  };

  const ctaLabel = step === 3 ? 'Explore Vuvio' : 'Continue';

  return (
    <div className="onboarding-screen">
      <div className="onboarding-header">
        <BrandMark size={28} showName />
        <ProgressDots step={step} />
        <button type="button" className="onboarding-skip" onClick={skip} disabled={busy}>
          Skip for now
        </button>
      </div>

      <div className="onboarding-body">
        {step === 1 ? (
          <StepProfile
            displayName={displayName}
            setDisplayName={setDisplayName}
            username={username}
            setUsername={setUsername}
            usernameError={usernameError}
            setUsernameError={setUsernameError}
            avatarPreview={avatarPreview}
            onSelectAvatar={handleSelectAvatar}
          />
        ) : null}
        {step === 2 ? (
          <StepInterests selected={selected} onToggle={toggleCategory} />
        ) : null}
        {step === 3 ? (
          <StepWelcome displayName={displayName} selected={selected} />
        ) : null}
      </div>

      <div className="onboarding-cta">
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button
          type="button"
          className="onboarding-cta-button"
          onClick={handleContinue}
          disabled={busy}
        >
          {busy ? <span className="auth-submit__spinner" aria-hidden="true" /> : <Sparkles size={16} strokeWidth={2} aria-hidden="true" />}
          {busy ? 'Saving…' : ctaLabel}
        </button>
      </div>
    </div>
  );
}
