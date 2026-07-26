import { Camera, ChevronLeft, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readImageFile, saveOwnCreatorProfile } from '../services/profileService.js';
import { useAuth } from '../context/AuthContext.jsx';

const languageOptions = ['French', 'English', 'Spanish', 'Italian', 'German', 'Portuguese', 'Arabic', 'Japanese', 'Other'];
const categoryOptions = ['Craft', 'Cooking', 'Agriculture', 'Sport', 'Transport', 'Music', 'Nature', 'Science', 'Education', 'Construction', 'Creation', 'Other'];
const usernamePattern = /^[a-zA-Z0-9._]{3,30}$/;

function buildForm(profile) {
  return {
    ...profile,
    displayName: profile.displayName ?? profile.name ?? '',
    username: profile.username ?? '',
    profession: profile.profession ?? '',
    city: profile.city ?? '',
    country: profile.country ?? '',
    bio: profile.bio ?? '',
    websiteUrl: profile.websiteUrl ?? '',
    instagramUrl: profile.instagramUrl ?? '',
    youtubeUrl: profile.youtubeUrl ?? '',
    languages: profile.languages ?? [],
    categories: profile.categories ?? [],
  };
}

function EditProfileHeader({ canSave, saving, onBack, onSave }) {
  return (
    <header className="edit-profile-header">
      <button type="button" onClick={onBack} aria-label="Back">
        <ChevronLeft size={20} strokeWidth={1.9} />
      </button>
      <h1>Edit my profile</h1>
      <button type="button" className="edit-profile-header__save" disabled={!canSave || saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </header>
  );
}

function ProfileImagesEditor({ form, onImageChange, onError }) {
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const onFile = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const previewUrl = await readImageFile(file);
      onImageChange(field, previewUrl);
      onError('');
    } catch (error) {
      onError(error.message);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="edit-image-editor" aria-label="Profile images">
      <div className="edit-image-editor__cover" style={!form.coverUrl ? { background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 100%)' } : undefined}>
        {form.coverUrl ? <img src={form.coverUrl} alt="Cover preview" /> : null}
        <button type="button" onClick={() => coverInputRef.current?.click()}>
          <Camera size={15} strokeWidth={1.9} />
          Edit cover
        </button>
      </div>
      <div className="edit-image-editor__avatar">
        <img src={form.avatarUrl || '/icons/icon-192.png'} alt="Avatar preview" />
        <button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Edit avatar">
          <Camera size={15} strokeWidth={2} />
        </button>
      </div>
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event, 'coverUrl')} />
      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event, 'avatarUrl')} />
    </section>
  );
}

function Field({ label, value, onChange, error, required = false, prefix, maxLength, multiline = false, type = 'text' }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  const Input = multiline ? 'textarea' : 'input';

  return (
    <label className={error ? 'edit-field has-error' : 'edit-field'} htmlFor={id}>
      <span>
        {label}
        {required ? <small> required</small> : null}
      </span>
      <div className="edit-field__control">
        {prefix ? <em>{prefix}</em> : null}
        <Input
          id={id}
          type={multiline ? undefined : type}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {maxLength ? <small className="edit-field__count">{value.length} / {maxLength}</small> : null}
      {error ? <strong>{error}</strong> : null}
    </label>
  );
}

function ChipSelector({ title, options, value, onChange }) {
  const toggle = (item) => {
    onChange(value.includes(item) ? value.filter((current) => current !== item) : [...value, item]);
  };

  return (
    <section className="edit-choice-section">
      <h2>{title}</h2>
      <div className="edit-chip-row">
        {options.map((item) => (
          <button key={item} type="button" className={value.includes(item) ? 'is-active' : ''} onClick={() => toggle(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function SocialLinksFields({ form, update, errors }) {
  return (
    <section className="edit-form-section">
      <h2>Links</h2>
      <Field label="Website" value={form.websiteUrl} onChange={(value) => update('websiteUrl', value)} error={errors.websiteUrl} type="url" />
      <Field label="Instagram" value={form.instagramUrl} onChange={(value) => update('instagramUrl', value)} error={errors.instagramUrl} />
      <Field label="YouTube" value={form.youtubeUrl} onChange={(value) => update('youtubeUrl', value)} error={errors.youtubeUrl} />
    </section>
  );
}

function UnsavedChangesDialog({ onCancel, onDiscard }) {
  return (
    <div className="edit-confirm" role="dialog" aria-modal="true" aria-label="Discard changes?">
      <div className="edit-confirm__panel">
        <button type="button" className="edit-confirm__close" onClick={onCancel} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>
        <h2>Discard changes?</h2>
        <p>Unsaved changes will be lost.</p>
        <button type="button" onClick={onCancel}>Keep editing</button>
        <button type="button" className="is-danger" onClick={onDiscard}>Discard</button>
      </div>
    </div>
  );
}

function isValidOptionalUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^https?:\/\//i.test(trimmed)) return /^[^\s]+\.[^\s]+$/.test(trimmed);

  try {
    const url = new URL(trimmed);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidInstagram(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed)) return isValidOptionalUrl(trimmed);
  return /^@?[a-zA-Z0-9._]{1,30}$/.test(trimmed);
}

export default function EditProfilePage() {
  console.count('[EditProfilePage] render');
  const navigate = useNavigate();
  const { user, userProfile, profileLoading } = useAuth();

  console.log('[EditProfilePage] state:', {
    profileLoading,
    profileLoaded: !!userProfile,
    userUid: user?.uid.slice(0, 8),
  });

  const [form, setForm] = useState(() => buildForm({}));
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profileLoading && userProfile && !hasInitialized && user?.uid === userProfile.uid) {
      console.log('[EditProfilePage] initializing form from profile');
      const built = buildForm(userProfile);
      setForm(built);
      setInitialSnapshot(JSON.stringify(built));
      setHasInitialized(true);
    }
  }, [profileLoading, userProfile, hasInitialized, user?.uid]);

  useEffect(() => {
    console.log('[EditProfilePage] UID changed, resetting form');
    setHasInitialized(false);
    setForm(buildForm({}));
    setInitialSnapshot('');
  }, [user?.uid]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const errors = {
    displayName: form.displayName.trim().length < 2 || form.displayName.trim().length > 50
      ? 'The display name must contain 2 to 50 characters.'
      : '',
    username: !form.username.trim()
      ? 'Username is required.'
      : usernamePattern.test(form.username.replace(/^@+/, ''))
        ? ''
        : 'Username can only contain letters, numbers, dots and underscores.',
    profession: form.profession.trim() ? '' : 'Profession or activity is required.',
    websiteUrl: isValidOptionalUrl(form.websiteUrl) ? '' : 'Enter a valid URL.',
    instagramUrl: isValidInstagram(form.instagramUrl) ? '' : 'Enter a valid Instagram handle or URL.',
    youtubeUrl: isValidOptionalUrl(form.youtubeUrl) ? '' : 'Enter a valid URL.',
  };

  const dirty = JSON.stringify(form) !== initialSnapshot;
  const canSave = dirty && !Object.values(errors).some(Boolean) && !saving;

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const back = () => {
    if (dirty) {
      setShowConfirm(true);
      return;
    }
    navigate('/profile');
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const updated = await saveOwnCreatorProfile({
      ...form,
      name: form.displayName,
      username: form.username.replace(/^@+/, ''),
    });
    setForm(buildForm(updated));
    setToast('Profile updated');
    window.setTimeout(() => navigate('/profile'), 450);
  };

  if (profileLoading) {
    return (
      <section className="screen-scroll edit-profile-screen" aria-label="Edit my profile">
        <EditProfileHeader canSave={false} saving={true} onBack={() => navigate('/profile')} onSave={() => {}} />
        <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          Loading profile…
        </div>
      </section>
    );
  }

  return (
    <section className="screen-scroll edit-profile-screen" aria-label="Edit my profile">
      <EditProfileHeader canSave={canSave} saving={saving} onBack={back} onSave={save} />
      <ProfileImagesEditor form={form} onImageChange={update} onError={setImageError} />
      {imageError ? <p className="edit-profile-error">{imageError}</p> : null}

      <section className="edit-form-section">
        <h2>Public information</h2>
        <Field label="Display name" value={form.displayName} onChange={(value) => update('displayName', value)} error={errors.displayName} required />
        <Field label="Username" value={form.username.replace(/^@+/, '')} onChange={(value) => update('username', value)} error={errors.username} required prefix="@" />
        <Field label="Profession or activity" value={form.profession} onChange={(value) => update('profession', value)} error={errors.profession} required />
        <Field label="City" value={form.city} onChange={(value) => update('city', value)} />
        <Field label="Country" value={form.country} onChange={(value) => update('country', value)} />
        <Field label="Bio" value={form.bio} onChange={(value) => update('bio', value)} maxLength={160} multiline />
      </section>

      <ChipSelector title="Spoken languages" options={languageOptions} value={form.languages} onChange={(value) => update('languages', value)} />
      <ChipSelector title="Categories" options={categoryOptions} value={form.categories} onChange={(value) => update('categories', value)} />
      <SocialLinksFields form={form} update={update} errors={errors} />

      {showConfirm ? <UnsavedChangesDialog onCancel={() => setShowConfirm(false)} onDiscard={() => navigate('/profile')} /> : null}
      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
    </section>
  );
}
