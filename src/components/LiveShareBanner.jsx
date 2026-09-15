import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import '../styles/components/share-live.css';

export default function LiveShareBanner({ onShare, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`lsb-banner${visible ? ' lsb-banner--visible' : ''}`} role="status" aria-live="polite">
      <div className="lsb-banner__inner">
        <div className="lsb-banner__left">
          <span className="lsb-banner__emoji" aria-hidden="true">🚀</span>
          <div className="lsb-banner__text">
            <p className="lsb-banner__title">Invite people to your live</p>
            <p className="lsb-banner__sub">Grow your audience right now</p>
          </div>
        </div>
        <div className="lsb-banner__actions">
          <button type="button" className="lsb-banner__share-btn" onClick={onShare}>
            Share live
          </button>
          <button type="button" className="lsb-banner__dismiss" onClick={onDismiss} aria-label="Dismiss banner">
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
