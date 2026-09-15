import {
  Check,
  ChevronLeft,
  Copy,
  Eye,
  MapPin,
  MoreHorizontal,
  Share2,
  Sliders,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/components/share-live.css';

// ─── Social platform icons (inline SVG) ──────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 0C5.374 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.626 0 12-4.974 12-11.111C24 4.975 18.626 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.733 8.1l3.13 3.259L19.752 8.1l-6.559 6.863z" />
    </svg>
  );
}

// ─── VuvioLogomark ────────────────────────────────────────────────────────────

function VuvioMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="rgba(53,227,220,0.15)" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="14" fontWeight="700" fill="#35e3dc" fontFamily="system-ui">V</text>
    </svg>
  );
}

// ─── Avatar placeholder ───────────────────────────────────────────────────────

function AvatarPlaceholder({ name = '', size = 32 }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div
      className="sls-avatar-placeholder"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ─── SharePreviewCard ─────────────────────────────────────────────────────────

export function SharePreviewCard({ live, wide = false }) {
  const creatorName = live?.streamer ?? live?.name ?? 'Creator';
  const title = live?.title ?? live?.description ?? 'Live experience';
  const activity = live?.subcategory ?? live?.job ?? '';
  const location = live?.locationLabel ?? (live?.city ? `${live.city}${live.country ? `, ${live.country}` : ''}` : '');
  const viewers = live?.viewers ?? live?.viewerLabel ?? '0';
  const thumbnail = live?.coverImageUrl ?? live?.thumbnailUrl ?? live?.image ?? live?.video ?? null;

  if (wide) {
    return (
      <div className="sls-preview-card sls-preview-card--wide">
        <div className="sls-preview-card__image">
          {thumbnail ? (
            <img src={thumbnail} alt={title} loading="lazy" />
          ) : (
            <div className="sls-preview-card__image-fallback" />
          )}
          <div className="sls-preview-card__image-overlay">
            <span className="sls-live-badge">
              <span className="sls-live-dot" aria-hidden="true" />
              LIVE
            </span>
            <div className="sls-preview-card__viewers">
              <Eye size={11} strokeWidth={2} />
              <span>{viewers}</span>
            </div>
          </div>
        </div>
        <div className="sls-preview-card__body">
          <div className="sls-preview-card__creator-row">
            <AvatarPlaceholder name={creatorName} size={28} />
            <span className="sls-preview-card__creator-name">{creatorName}</span>
          </div>
          <p className="sls-preview-card__title">{title}</p>
          <div className="sls-preview-card__meta-row">
            {activity && <span className="sls-preview-card__activity">{activity}</span>}
            {location && (
              <span className="sls-preview-card__location-inline">
                <MapPin size={10} strokeWidth={2} />
                {location}
              </span>
            )}
          </div>
          <div className="sls-preview-card__footer">
            <VuvioMark size={13} />
            <span>Vuvio</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sls-preview-card">
      <div className="sls-preview-card__thumb">
        {thumbnail ? (
          <img src={thumbnail} alt={title} loading="lazy" />
        ) : (
          <div className="sls-preview-card__thumb-fallback" />
        )}
        <span className="sls-live-badge">LIVE</span>
        <div className="sls-preview-card__viewers">
          <Eye size={10} strokeWidth={2} />
          <span>{viewers}</span>
        </div>
      </div>
      <div className="sls-preview-card__info">
        <div className="sls-preview-card__creator-row">
          <AvatarPlaceholder name={creatorName} size={26} />
          <span className="sls-preview-card__creator-name">{creatorName}</span>
        </div>
        <p className="sls-preview-card__title">{title}</p>
        {activity && <p className="sls-preview-card__meta">{activity}</p>}
        {location && (
          <p className="sls-preview-card__location">
            <MapPin size={10} strokeWidth={2} />
            {location}
          </p>
        )}
        <div className="sls-preview-card__footer">
          <VuvioMark size={14} />
          <span>Watch live on Vuvio</span>
        </div>
      </div>
    </div>
  );
}

// ─── Social option button ─────────────────────────────────────────────────────

function SocialOption({ icon: Icon, label, color, onClick }) {
  return (
    <button type="button" className="sls-social-btn" onClick={onClick} aria-label={label}>
      <span className="sls-social-btn__icon" style={{ background: color }}>
        <Icon />
      </span>
      <span className="sls-social-btn__label">{label}</span>
    </button>
  );
}

// ─── Style card (named preset) ────────────────────────────────────────────────

const STYLE_CONFIGS = {
  minimal: {
    label: 'Minimal',
    tint: 'rgba(255,255,255,0.03)',
    accent: 'rgba(200,220,230,0.6)',
    veilStrength: 0.55,
    previewBg: 'linear-gradient(160deg, rgba(40,60,80,0.9), rgba(10,25,38,1))',
    previewAccent: '#a8becb',
  },
  adventure: {
    label: 'Adventure',
    tint: 'rgba(255,140,60,0.22)',
    accent: '#ff9d4d',
    veilStrength: 0.65,
    previewBg: 'linear-gradient(160deg, rgba(80,40,10,0.9), rgba(20,10,4,1))',
    previewAccent: '#ff9d4d',
  },
  dark: {
    label: 'Dark',
    tint: 'rgba(0,0,0,0.42)',
    accent: '#35e3dc',
    veilStrength: 0.82,
    previewBg: 'linear-gradient(160deg, rgba(5,15,25,1), rgba(0,5,10,1))',
    previewAccent: '#35e3dc',
  },
};

function StyleCard({ styleKey, active, onClick }) {
  const config = STYLE_CONFIGS[styleKey];
  return (
    <button
      type="button"
      className={`sls-style-card${active ? ' sls-style-card--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Style: ${config.label}`}
    >
      <div className="sls-style-card__preview" style={{ background: config.previewBg }}>
        <div className="sls-style-card__preview-tint" style={{ background: config.tint }} />
        <div className="sls-style-card__preview-bar" style={{ background: config.previewAccent }} />
        <div className="sls-style-card__preview-lines">
          <span style={{ background: config.previewAccent, opacity: 0.7 }} />
          <span style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        {active && (
          <div className="sls-style-card__check">
            <Check size={9} strokeWidth={2.8} />
          </div>
        )}
      </div>
      <span className="sls-style-card__label">{config.label}</span>
    </button>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="sls-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`sls-toggle ${checked ? 'sls-toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="sls-toggle__thumb" />
      </button>
    </label>
  );
}

// ─── Story card preview (9:16) ────────────────────────────────────────────────

function StoryPreview({ live, styleKey = 'minimal', showViewers, showLocation, showActivity, showTitle }) {
  const creatorName = live?.streamer ?? live?.name ?? 'Creator';
  const title = live?.title ?? live?.description ?? '';
  const activity = live?.subcategory ?? live?.job ?? 'Mountain biking';
  const location = live?.locationLabel ?? (live?.city ? `${live.city}${live.country ? `, ${live.country}` : ''}` : 'Chamonix, France');
  const thumbnail = live?.coverImageUrl ?? live?.thumbnailUrl ?? live?.image ?? live?.video ?? null;
  const config = STYLE_CONFIGS[styleKey] ?? STYLE_CONFIGS.minimal;

  return (
    <div className="sls-story-preview">
      {thumbnail ? (
        <img src={thumbnail} alt="" className="sls-story-preview__bg" />
      ) : (
        <div className="sls-story-preview__bg-fallback" />
      )}
      <div className="sls-story-preview__veil" style={{ '--veil-opacity': config.veilStrength }} />
      <div className="sls-story-preview__tint" style={{ background: config.tint }} />

      <header className="sls-story-preview__header">
        <div className="sls-story-preview__live-badge">
          <span className="sls-story-dot" />
          LIVE NOW
        </div>
        {showViewers && live?.viewers && (
          <div className="sls-story-viewers">
            <Eye size={11} strokeWidth={2} />
            <span>{live.viewers}</span>
          </div>
        )}
      </header>

      <footer className="sls-story-preview__footer">
        <div className="sls-story-preview__creator-row">
          <AvatarPlaceholder name={creatorName} size={34} />
          <div>
            <p className="sls-story-preview__is-live">{creatorName} is live on Vuvio</p>
            {showActivity && activity && (
              <p className="sls-story-preview__activity" style={{ color: config.accent }}>{activity}</p>
            )}
          </div>
        </div>
        {showTitle && title && (
          <p className="sls-story-preview__title-text">{title}</p>
        )}
        {showLocation && location && (
          <p className="sls-story-preview__location">
            <MapPin size={11} strokeWidth={2} />
            {location}
          </p>
        )}
        <div className="sls-story-preview__brand">
          <VuvioMark size={18} />
          <span style={{ color: config.accent }}>Vuvio</span>
        </div>
      </footer>
    </div>
  );
}

// ─── Screen 1: Share sheet ────────────────────────────────────────────────────

const toPublicLiveId = (id) => (id ?? 'demo').replace(/^created-/, '');
const getShareWatchUrl = (id) => {
  const liveId = toPublicLiveId(id);
  return `${window.location.origin}/watch?live=${encodeURIComponent(liveId)}&mode=view`;
};

function ShareSheet({ live, onClose, onCustomize, onShare }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = getShareWatchUrl(live?.id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [live?.id]);

  const handleNativeShare = useCallback(async () => {
    const url = getShareWatchUrl(live?.id);
    const text = `I'm live on Vuvio — ${live?.title ?? live?.description ?? 'Come join me.'}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Watch live on Vuvio', text, url });
        onShare?.();
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
      onShare?.();
    }
  }, [live, onShare, handleCopy]);

  const socialOptions = [
    {
      icon: () => copied ? <Check size={20} strokeWidth={2.2} /> : <Copy size={19} strokeWidth={1.9} />,
      label: copied ? 'Copied!' : 'Copy link',
      color: 'rgba(53,227,220,0.12)',
      onClick: handleCopy,
    },
    { icon: WhatsAppIcon, label: 'WhatsApp', color: 'rgba(37,211,102,0.13)', onClick: handleNativeShare },
    { icon: InstagramIcon, label: 'Instagram', color: 'rgba(225,48,108,0.13)', onClick: handleNativeShare },
    { icon: MessagesIcon, label: 'Messages', color: 'rgba(53,227,220,0.10)', onClick: handleNativeShare },
    { icon: MessengerIcon, label: 'Messenger', color: 'rgba(0,120,255,0.13)', onClick: handleNativeShare },
    { icon: XIcon, label: 'X', color: 'rgba(255,255,255,0.07)', onClick: handleNativeShare },
    { icon: MoreHorizontal, label: 'More', color: 'rgba(168,190,203,0.10)', onClick: handleNativeShare },
  ];

  return (
    <div className="sls-sheet" role="dialog" aria-modal="true" aria-label="Share your live">
      <button type="button" className="sls-backdrop" onClick={onClose} aria-label="Close" />
      <div className="sls-panel">
        <span className="sls-handle" aria-hidden="true" />

        <div className="sls-header">
          <div>
            <h2 className="sls-header__title">Share your live</h2>
            <p className="sls-header__sub">Invite people before your best moments happen.</p>
          </div>
          <button type="button" className="sls-close-btn" onClick={onClose} aria-label="Close">
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="sls-preview-wrap">
          <SharePreviewCard live={live} wide />
        </div>

        <div className="sls-quote">
          <p>"I'm live on Vuvio.<br />Come join me."</p>
        </div>

        <div className="sls-social-grid">
          {socialOptions.map((opt) => (
            <SocialOption key={opt.label} {...opt} />
          ))}
        </div>

        <button type="button" className="sls-primary-btn" onClick={handleNativeShare}>
          <Share2 size={16} strokeWidth={2} />
          Share now
        </button>

        <button type="button" className="sls-customize-link" onClick={onCustomize}>
          <Sliders size={13} strokeWidth={2} />
          Customize
        </button>
      </div>
    </div>
  );
}

// ─── Screen 2: Customize ─────────────────────────────────────────────────────

function CustomizeScreen({ live, onBack, onShare }) {
  const [activeStyle, setActiveStyle] = useState('minimal');
  const [showViewers, setShowViewers] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = getShareWatchUrl(live?.id);
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [live?.id]);

  const handleShare = useCallback(async () => {
    const url = getShareWatchUrl(live?.id);
    const text = `I'm live on Vuvio — ${live?.title ?? live?.description ?? 'Come join me.'}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Watch live on Vuvio', text, url }); } catch { /* cancelled */ }
    }
    onShare?.();
  }, [live, onShare]);

  return (
    <div className="sls-customize" role="dialog" aria-modal="true" aria-label="Customize share">
      <button type="button" className="sls-customize__backdrop" onClick={onBack} aria-label="Back" />
      <div className="sls-customize__panel">
        <div className="sls-customize__nav">
          <button type="button" className="sls-back-btn" onClick={onBack} aria-label="Back">
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <span className="sls-customize__nav-title">Customize</span>
          <div style={{ width: 36 }} />
        </div>

        <div className="sls-customize__scroll">
          <div className="sls-customize__preview-wrap">
            <StoryPreview
              live={live}
              styleKey={activeStyle}
              showViewers={showViewers}
              showLocation={showLocation}
              showActivity={showActivity}
              showTitle={showTitle}
            />
          </div>

          <div className="sls-customize__section">
            <p className="sls-customize__section-label">Style</p>
            <div className="sls-style-cards">
              {Object.keys(STYLE_CONFIGS).map((key) => (
                <StyleCard
                  key={key}
                  styleKey={key}
                  active={activeStyle === key}
                  onClick={() => setActiveStyle(key)}
                />
              ))}
            </div>
          </div>

          <div className="sls-customize__section sls-customize__toggles">
            <ToggleRow label="Title" checked={showTitle} onChange={setShowTitle} />
            <ToggleRow label="Activity" checked={showActivity} onChange={setShowActivity} />
            <ToggleRow label="Location" checked={showLocation} onChange={setShowLocation} />
            <ToggleRow label="Viewer count" checked={showViewers} onChange={setShowViewers} />
          </div>
        </div>

        <div className="sls-customize__actions">
          <button type="button" className="sls-primary-btn" onClick={handleShare}>
            <Share2 size={15} strokeWidth={2} />
            Share now
          </button>
          <button type="button" className="sls-secondary-btn" onClick={handleCopy}>
            {copied ? <Check size={15} strokeWidth={2.2} /> : <Copy size={15} strokeWidth={1.9} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen 3: Success ────────────────────────────────────────────────────────

function ShareSuccessScreen({ onShareAgain, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`sls-confirm ${visible ? 'sls-confirm--visible' : ''}`} role="dialog" aria-modal="true" aria-label="Shared!">
      <button type="button" className="sls-backdrop" onClick={onClose} aria-label="Close" />
      <div className="sls-confirm__panel">
        <div className="sls-confirm__icon-wrap">
          <div className="sls-confirm__icon">
            <Check size={28} strokeWidth={2.5} />
          </div>
          <div className="sls-confirm__ring" aria-hidden="true" />
          <div className="sls-confirm__ring sls-confirm__ring--delay" aria-hidden="true" />
        </div>
        <h2 className="sls-confirm__title">Shared</h2>
        <p className="sls-confirm__sub">Your live is ready to be discovered.</p>
        <div className="sls-confirm__actions">
          <button type="button" className="sls-primary-btn" onClick={onShareAgain}>
            Share again
          </button>
          <button type="button" className="sls-confirm__back-btn" onClick={onClose}>
            Back to live
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root: ShareLiveSheet ─────────────────────────────────────────────────────

export default function ShareLiveSheet({ live, onClose }) {
  const [step, setStep] = useState('share'); // 'share' | 'customize' | 'success'

  const handleShare = useCallback(() => setStep('success'), []);
  const handleShareAgain = useCallback(() => setStep('share'), []);

  if (step === 'success') {
    return <ShareSuccessScreen onShareAgain={handleShareAgain} onClose={onClose} />;
  }

  if (step === 'customize') {
    return <CustomizeScreen live={live} onBack={() => setStep('share')} onShare={handleShare} />;
  }

  return (
    <ShareSheet
      live={live}
      onClose={onClose}
      onCustomize={() => setStep('customize')}
      onShare={handleShare}
    />
  );
}
