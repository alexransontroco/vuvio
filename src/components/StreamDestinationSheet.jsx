import { ChevronLeft, Eye, EyeOff, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteStreamDestination, saveStreamDestination } from '../services/streamDestinationsService.js';
import { useAuth } from '../context/AuthContext.jsx';

const PROVIDERS = {
  instagram: {
    label: 'Instagram',
    logo: '📸',
    placeholder: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    hint: 'Instagram may generate a new stream key for each Live.',
    urlLabel: 'Stream URL',
    keyLabel: 'Stream Key',
  },
  youtube: {
    label: 'YouTube',
    logo: '▶',
    placeholder: 'rtmp://a.rtmp.youtube.com/live2/',
    hint: 'Use your YouTube Studio stream key.',
    urlLabel: 'Stream URL',
    keyLabel: 'Stream Key',
  },
  custom: {
    label: 'Custom RTMP',
    logo: '📡',
    placeholder: 'rtmps://...',
    hint: 'Any RTMP/RTMPS compatible destination.',
    urlLabel: 'RTMP URL',
    keyLabel: 'Stream Key',
  },
};

export default function StreamDestinationSheet({ provider, savedDest, onSave, onRemove, onClose }) {
  const { user } = useAuth();
  const meta = PROVIDERS[provider] ?? PROVIDERS.custom;
  const inputRef = useRef(null);

  const [url, setUrl] = useState(savedDest?.streamUrl ?? '');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!user) { setError('You must be logged in.'); return; }
    if (!url.trim()) { setError('Stream URL is required.'); return; }
    if (!key.trim()) { setError('Stream Key is required. It is only stored for this session.'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await saveStreamDestination(user.uid, {
        id: savedDest?.id,
        provider,
        name: meta.label,
        streamUrl: url.trim(),
        enabled: true,
      });
      onSave({ ...saved, streamKey: key.trim() });
    } catch (err) {
      setError(err.message ?? 'Could not save destination.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!savedDest?.id) { onRemove(); return; }
    try {
      await deleteStreamDestination(user.uid, savedDest.id);
      onRemove();
    } catch {
      onRemove();
    }
  };

  return (
    <div className="dest-sheet" role="dialog" aria-modal="true">
      <div className="dest-sheet__backdrop" onClick={onClose} />
      <div className="dest-sheet__panel">
        <div className="dest-sheet__header">
          <button type="button" onClick={onClose} aria-label="Close" className="dest-sheet__back">
            <ChevronLeft size={18} strokeWidth={1.9} />
          </button>
          <span className="dest-sheet__title">
            {meta.logo} {meta.label} Live
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="dest-sheet__close">
            <X size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="dest-sheet__body">
          <p className="dest-sheet__subtitle">
            Stream your Vuvio Live simultaneously on {meta.label}.
          </p>

          <label className="dest-sheet__label">{meta.urlLabel}</label>
          <input
            ref={inputRef}
            type="url"
            className="dest-sheet__input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={meta.placeholder}
            autoComplete="off"
          />

          <label className="dest-sheet__label">{meta.keyLabel}</label>
          <div className="dest-sheet__key-row">
            <input
              type={showKey ? 'text' : 'password'}
              className="dest-sheet__input dest-sheet__input--key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={savedDest?.id ? '••••••••  (re-enter to update)' : 'Paste your stream key'}
              autoComplete="off"
            />
            <button type="button" className="dest-sheet__eye" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide' : 'Show'}>
              {showKey ? <EyeOff size={16} strokeWidth={1.7} /> : <Eye size={16} strokeWidth={1.7} />}
            </button>
          </div>

          <p className="dest-sheet__hint">{meta.hint}</p>
          <p className="dest-sheet__security-note">Your stream key is only kept in memory during this session — it is never saved.</p>

          {error && <p className="dest-sheet__error">{error}</p>}

          <button
            type="button"
            className="dest-sheet__save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Connecting…' : `Connect ${meta.label}`}
          </button>

          {savedDest?.id && (
            <button type="button" className="dest-sheet__remove" onClick={handleRemove}>
              Remove destination
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
