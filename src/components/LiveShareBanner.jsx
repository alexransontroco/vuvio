import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/components/share-live.css';

export default function LiveShareBanner({ onShare, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`lsb-banner${visible ? ' lsb-banner--visible' : ''}`} role="status" aria-live="polite">
      <div className="lsb-banner__inner">
        <div className="lsb-banner__left">
          <span className="lsb-banner__emoji" aria-hidden="true">🚀</span>
          <div className="lsb-banner__text">
            <p className="lsb-banner__title">{t('shareLive.bannerTitle')}</p>
            <p className="lsb-banner__sub">{t('shareLive.bannerSub')}</p>
          </div>
        </div>
        <div className="lsb-banner__actions">
          <button type="button" className="lsb-banner__share-btn" onClick={onShare}>
            {t('shareLive.shareLive')}
          </button>
          <button type="button" className="lsb-banner__dismiss" onClick={onDismiss} aria-label={t('shareLive.dismissBanner')}>
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
