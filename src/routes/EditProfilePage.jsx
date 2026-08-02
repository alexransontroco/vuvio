import { Camera, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readImageFile, saveOwnCreatorProfile } from '../services/profileService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isValidSpotifyPlaylistUrl } from '../services/spotifyService.js';

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
    avatarUrl: profile.avatarUrl ?? null,
    coverUrl: profile.coverUrl ?? null,
    languages: profile.languages ?? [],
    categories: profile.categories ?? [],
    playlists: profile.playlists ?? [],
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

function PlaylistsEditor({ playlists, onChange }) {
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addError, setAddError] = useState('');

  const handleAdd = () => {
    setAddError('');

    const nameError = !newPlaylistName.trim()
      ? 'Playlist name is required'
      : newPlaylistName.trim().length > 100
        ? 'Name must be 100 characters or less'
        : '';

    if (nameError) {
      setAddError(nameError);
      return;
    }

    if (!newPlaylistUrl.trim()) {
      setAddError('Spotify playlist URL is required');
      return;
    }

    if (!isValidSpotifyPlaylistUrl(newPlaylistUrl)) {
      setAddError('Enter a valid Spotify playlist URL (e.g., https://open.spotify.com/playlist/...)');
      return;
    }

    const updated = [
      ...playlists,
      {
        id: `playlist-${Date.now()}`,
        name: newPlaylistName.trim(),
        spotifyUrl: newPlaylistUrl.trim(),
        platform: 'Spotify',
      },
    ];

    onChange(updated);
    setNewPlaylistName('');
    setNewPlaylistUrl('');
  };

  const handleRemove = (id) => {
    onChange(playlists.filter((p) => p.id !== id));
  };

  return (
    <section className="edit-form-section">
      <h2>Playlists</h2>
      <p style={{ fontSize: '13px', color: 'rgba(242, 247, 246, 0.62)', marginBottom: '16px' }}>
        Add Spotify playlists to your profile. We'll fetch the playlist image and song count automatically.
      </p>

      {addError && <p style={{ color: '#ff6b6b', marginBottom: '12px', fontSize: '13px' }}>{addError}</p>}

      <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(242, 247, 246, 0.92)' }}>Playlist name</span>
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="My favorite songs"
            maxLength={100}
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '0.5px solid rgba(43, 217, 200, 0.2)',
              color: 'rgba(242, 247, 246, 0.92)',
              fontSize: '14px',
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(242, 247, 246, 0.92)' }}>Spotify playlist URL</span>
          <input
            type="url"
            value={newPlaylistUrl}
            onChange={(e) => setNewPlaylistUrl(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '0.5px solid rgba(43, 217, 200, 0.2)',
              color: 'rgba(242, 247, 246, 0.92)',
              fontSize: '14px',
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(43, 217, 200, 0.12)',
            border: '0.5px solid rgba(43, 217, 200, 0.3)',
            color: '#2bd9c8',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(43, 217, 200, 0.18)';
            e.target.style.borderColor = 'rgba(43, 217, 200, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(43, 217, 200, 0.12)';
            e.target.style.borderColor = 'rgba(43, 217, 200, 0.3)';
          }}
        >
          <Plus size={16} strokeWidth={2} />
          Add playlist
        </button>
      </div>

      {playlists.length > 0 && (
        <div style={{ display: 'grid', gap: '8px' }}>
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '0.5px solid rgba(43, 217, 200, 0.15)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '600', color: 'rgba(242, 247, 246, 0.92)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {playlist.name}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(242, 247, 246, 0.52)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {playlist.spotifyUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(playlist.id)}
                style={{
                  marginLeft: '12px',
                  padding: '8px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(255, 107, 107, 0.15)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(255, 107, 107, 0.1)'}
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
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
  const { user, userProfile, profileLoading, refreshUserProfile } = useAuth();

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
  const [saveError, setSaveError] = useState('');
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
      ? ''
      : usernamePattern.test(form.username.replace(/^@+/, ''))
        ? ''
        : 'Username can only contain letters, numbers, dots and underscores.',
    profession: '',
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
    setSaveError('');
    try {
      const cleanUsername = form.username.replace(/^@+/, '').trim();
      const updated = await saveOwnCreatorProfile({
        ...form,
        id: user?.uid || form.id,
        uid: user?.uid || form.uid,
        name: form.displayName,
        username: cleanUsername,
        usernameNormalized: cleanUsername ? cleanUsername.toLowerCase() : null,
      });
      const built = buildForm(updated);
      setForm(built);
      setInitialSnapshot(JSON.stringify(built));
      await refreshUserProfile?.();
      setToast('Profile updated');
      window.setTimeout(() => navigate('/profile'), 450);
    } catch (err) {
      setSaveError(err.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
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
      {saveError ? <p className="edit-profile-error" role="alert">{saveError}</p> : null}

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
      <PlaylistsEditor playlists={form.playlists} onChange={(value) => update('playlists', value)} />
      <SocialLinksFields form={form} update={update} errors={errors} />

      {showConfirm ? <UnsavedChangesDialog onCancel={() => setShowConfirm(false)} onDiscard={() => navigate('/profile')} /> : null}
      {toast ? <div className="profile-toast" role="status">{toast}</div> : null}
    </section>
  );
}
