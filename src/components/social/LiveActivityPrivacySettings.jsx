import { useTranslation } from 'react-i18next';
import { useLiveActivityPrivacy } from '../../hooks/useLiveActivityPrivacy.js';
import '../social/social.css';

/**
 * Live activity privacy settings control
 * Allows users to control whether their viewing activity is visible
 */
export function LiveActivityPrivacySettings() {
  const { t } = useTranslation();
  const {
    liveActivityVisibility,
    showWatchingIndicator,
    setLiveActivityVisibility,
    setShowWatchingIndicator,
  } = useLiveActivityPrivacy();

  const options = [
    ['friends', t('social.privacy.friends')],
    ['nobody', t('social.privacy.nobody')],
  ];

  return (
    <section className="settings-group live-activity-privacy-settings" aria-labelledby="settings-live-activity">
      <h2 id="settings-live-activity">{t('social.privacy.title')}</h2>

      <div className="settings-card">
        <div className="settings-privacy-copy">
          <strong>{t('social.privacy.whoCanSee')}</strong>
          <p>{t('social.privacy.whoCanSeeDesc')}</p>
        </div>

        {options.map(([value, label]) => (
          <label key={value} className="settings-radio-row">
            <span>{label}</span>
            <input
              type="radio"
              name="liveActivityVisibility"
              checked={liveActivityVisibility === value}
              onChange={() => setLiveActivityVisibility(value)}
            />
          </label>
        ))}

        <div style={{ height: '1px', background: 'rgba(134, 202, 224, 0.1)', margin: '12px 0' }} />

        <label className="settings-toggle-row">
          <div>
            <span>{t('social.privacy.showIndicator')}</span>
            <small style={{ display: 'block', marginTop: '2px' }}>
              {t('social.privacy.showIndicatorDesc')}
            </small>
          </div>
          <input
            type="checkbox"
            checked={showWatchingIndicator}
            onChange={(event) => setShowWatchingIndicator(event.target.checked)}
          />
        </label>
      </div>

      <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--vuvio-text-muted)', lineHeight: '1.5' }}>
        💡 <strong>{t('social.privacy.proTipLabel')}</strong> {t('social.privacy.proTipBody')}
      </div>
    </section>
  );
}
