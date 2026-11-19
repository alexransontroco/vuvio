import { useEffect } from 'react';
import { Hand, Radio, UserPlus, X } from 'lucide-react';

const ICONS = {
  join: UserPlus,
  spotlight: Radio,
  hand: Hand,
};

export default function WorkshopToast({ icon = 'join', title, hint, onDismiss, autoHideMs = 4200 }) {
  useEffect(() => {
    if (!autoHideMs || !onDismiss) return undefined;
    const id = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(id);
  }, [autoHideMs, onDismiss]);

  const Icon = ICONS[icon] || UserPlus;

  return (
    <div className="workshop-toast" role="status" aria-live="polite">
      <span className="workshop-toast__icon" aria-hidden="true">
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <div className="workshop-toast__body">
        <strong>{title}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'rgba(245,250,252,0.5)', padding: 4 }}
        >
          <X size={12} strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}
