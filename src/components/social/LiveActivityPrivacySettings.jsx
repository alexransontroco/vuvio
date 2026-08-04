import { useLiveActivityPrivacy } from '../../hooks/useLiveActivityPrivacy.js';
import '../social/social.css';

/**
 * Live activity privacy settings control
 * Allows users to control whether their viewing activity is visible
 */
export function LiveActivityPrivacySettings() {
  const {
    liveActivityVisibility,
    showWatchingIndicator,
    setLiveActivityVisibility,
    setShowWatchingIndicator,
  } = useLiveActivityPrivacy();

  return (
    <section className="settings-group live-activity-privacy-settings" aria-labelledby="settings-live-activity">
      <h2 id="settings-live-activity">Live activity</h2>

      <div className="settings-card">
        <div className="settings-privacy-copy">
          <strong>Who can see what I'm watching?</strong>
          <p>Friends may see the live you are currently watching and join you.</p>
        </div>

        {[
          ['friends', 'Friends'],
          ['nobody', 'Nobody (private)'],
        ].map(([value, label]) => (
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
            <span>Show presence indicator</span>
            <small style={{ display: 'block', marginTop: '2px' }}>
              Friends see when you're watching a live
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
        💡 <strong>Pro tip:</strong> Your presence is only visible while actively watching a live. It disappears after you leave or the live ends.
      </div>
    </section>
  );
}
