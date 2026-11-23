import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe2, Eye, MessageCircle, Users, FileText, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMessagePreferences, updateMessagePreferences } from '../services/messagingService.js';
import { useLiveActivityPrivacy } from '../hooks/useLiveActivityPrivacy.js';

const STORAGE_KEY = 'vuvio:privacy-settings';

function loadPrivacySettings() {
  try { return { showFollowing: true, showOnGlobe: true, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }; }
  catch { return { showFollowing: true, showOnGlobe: true }; }
}

function savePrivacySettings(next) {
  const settings = { ...loadPrivacySettings(), ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div style={{ padding: '0 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon size={14} strokeWidth={1.8} style={{ color: 'var(--vuvio-cyan-soft)', flexShrink: 0 }} />
        <strong style={{ fontSize: 13, color: 'var(--vuvio-text-primary)' }}>{title}</strong>
      </div>
      {description && <p style={{ fontSize: 12, color: 'var(--profile-muted)', margin: 0, lineHeight: 1.5 }}>{description}</p>}
    </div>
  );
}

function ComingSoonBadge({ label }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color: 'var(--vuvio-cyan)',
      background: 'rgba(0,255,255,0.08)',
      border: '0.5px solid rgba(0,255,255,0.2)',
      borderRadius: 4,
      padding: '2px 6px',
      marginLeft: 8,
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function ToggleRow({ label, description, checked, onChange, comingSoon, comingSoonLabel }) {
  return (
    <label className="settings-toggle-row" style={{ opacity: comingSoon ? 0.6 : 1 }}>
      <div>
        <span>{label}{comingSoon && <ComingSoonBadge label={comingSoonLabel} />}</span>
        {description && <small style={{ display: 'block', marginTop: 2 }}>{description}</small>}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={comingSoon} />
    </label>
  );
}

function RadioRow({ label, value, name, checked, onChange, disabled = false, comingSoonLabel }) {
  return (
    <label className="settings-radio-row" style={disabled ? { opacity: 0.6 } : undefined}>
      <span>{label}{disabled && comingSoonLabel ? <ComingSoonBadge label={comingSoonLabel} /> : null}</span>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export default function PrivacySettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [privacy, setPrivacy] = useState(loadPrivacySettings);
  const [messagePrefs, setMessagePrefs] = useState(() => getMessagePreferences());
  const { liveActivityVisibility, showWatchingIndicator, setLiveActivityVisibility, setShowWatchingIndicator } = useLiveActivityPrivacy();

  const updatePrivacy = (next) => setPrivacy(savePrivacySettings(next));
  const updateMessage = (next) => setMessagePrefs(updateMessagePreferences(next));

  return (
    <section className="screen-scroll settings-screen" aria-label={t('privacySettings.title')}>
      <header className="settings-header">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>{t('privacySettings.title')}</h1>
        <span aria-hidden="true" />
      </header>

      <div className="settings-content">

        <section className="settings-group">
          <h2>{t('privacySettings.profileVisibility')}</h2>
          <div className="settings-card">
            <SectionHeader icon={Eye} title={t('privacySettings.whoCanSeeProfile')} />
            <RadioRow label={t('privacySettings.everyone')} value="public" name="profileVisibility" checked={true} onChange={() => {}} />
            <RadioRow label={t('privacySettings.followersOnly')} value="followers" name="profileVisibility" checked={false} onChange={() => {}} disabled comingSoonLabel={t('privacySettings.comingSoon')} />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />
            <ToggleRow
              label={t('privacySettings.showOnGlobe')}
              description={t('privacySettings.showOnGlobeDesc')}
              checked={privacy.showOnGlobe}
              onChange={(e) => updatePrivacy({ showOnGlobe: e.target.checked })}
            />
            <ToggleRow
              label={t('privacySettings.showInExplore')}
              description={t('privacySettings.showInExploreDesc')}
              checked={true}
              onChange={() => {}}
              comingSoon
              comingSoonLabel={t('privacySettings.comingSoon')}
            />
            <ToggleRow
              label={t('privacySettings.showFollowing')}
              description={t('privacySettings.showFollowingDesc')}
              checked={privacy.showFollowing}
              onChange={(e) => updatePrivacy({ showFollowing: e.target.checked })}
            />
          </div>
          <div style={{ padding: '8px 16px 0', fontSize: 11, color: 'var(--profile-muted)' }}>
            {t('privacySettings.platformNote')}
          </div>
        </section>

        <section className="settings-group">
          <h2>{t('privacySettings.privateMessages')}</h2>
          <div className="settings-card">
            <SectionHeader icon={MessageCircle} title={t('privacySettings.whoCanMessage')} />
            {[
              ['everyone', t('privacySettings.messageEveryone')],
              ['following', t('privacySettings.messageFollowing')],
              ['none', t('privacySettings.messageNobody')],
            ].map(([value, label]) => (
              <RadioRow
                key={value}
                label={label}
                value={value}
                name="whoCanMessage"
                checked={messagePrefs.whoCanMessage === value}
                onChange={() => updateMessage({ whoCanMessage: value })}
              />
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />
            <ToggleRow
              label={t('privacySettings.showOnlineStatus')}
              checked={Boolean(messagePrefs.showOnlineStatus)}
              onChange={(e) => updateMessage({ showOnlineStatus: e.target.checked })}
            />
            <ToggleRow
              label={t('privacySettings.readReceipts')}
              checked={Boolean(messagePrefs.readReceipts)}
              onChange={(e) => updateMessage({ readReceipts: e.target.checked })}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2>{t('privacySettings.watchingActivity')}</h2>
          <div className="settings-card">
            <SectionHeader
              icon={Activity}
              title={t('privacySettings.whoCanSeeWatching')}
              description={t('privacySettings.watchingControlDesc')}
            />
            {[
              ['friends', t('social.privacy.friends')],
              ['nobody', t('social.privacy.nobody')],
            ].map(([value, label]) => (
              <RadioRow
                key={value}
                label={label}
                value={value}
                name="liveActivityVisibility"
                checked={liveActivityVisibility === value}
                onChange={() => setLiveActivityVisibility(value)}
              />
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }} />
            <ToggleRow
              label={t('privacySettings.showWatchingIndicator')}
              description={t('privacySettings.showWatchingDesc')}
              checked={showWatchingIndicator}
              onChange={(e) => setShowWatchingIndicator(e.target.checked)}
            />
          </div>
        </section>

        <section className="settings-group">
          <h2>{t('privacySettings.dataLegal')}</h2>
          <div className="settings-card">
            <button type="button" className="settings-row" onClick={() => navigate('/privacy')}>
              <span className="settings-row__icon"><Globe2 size={17} strokeWidth={1.8} /></span>
              <span className="settings-row__copy"><strong>{t('privacySettings.privacyPolicy')}</strong></span>
              <span className="settings-row__chevron" style={{ fontSize: 11, color: 'var(--profile-muted)' }}>→</span>
            </button>
            <button type="button" className="settings-row" onClick={() => navigate('/terms')}>
              <span className="settings-row__icon"><FileText size={17} strokeWidth={1.8} /></span>
              <span className="settings-row__copy"><strong>{t('privacySettings.terms')}</strong></span>
              <span className="settings-row__chevron" style={{ fontSize: 11, color: 'var(--profile-muted)' }}>→</span>
            </button>
          </div>
        </section>

      </div>
    </section>
  );
}
