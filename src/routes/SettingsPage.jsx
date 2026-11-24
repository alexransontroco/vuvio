import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Globe2,
  HelpCircle,
  Info,
  Languages,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MonitorUp,
  Palette,
  Shield,
  ShieldCheck,
  Siren,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMessagePreferences, updateMessagePreferences } from '../services/messagingService.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { LiveActivityPrivacySettings } from '../components/social/LiveActivityPrivacySettings.jsx';
import LanguageSheet from '../components/LanguageSheet.jsx';

const buildGroups = (t, userEmail, languageLabel, isAdmin) => [
  {
    id: 'about',
    title: t('settings.groups.about'),
    items: [
      { label: t('settings.items.whatIsVuvio'), value: t('settings.items.platformOverview'), icon: Info, to: '/help', state: { scrollTo: 'what-is-vuvio' } },
    ],
  },
  {
    id: 'account',
    title: t('settings.groups.account'),
    items: [
      { label: t('settings.items.email'), value: userEmail, icon: Mail, readOnly: true },
      { label: t('settings.items.password'), value: t('common.edit'), icon: Lock },
      { label: t('settings.items.publicProfile'), value: t('settings.items.editYourProfile'), icon: UserRound, to: '/profile/edit' },
    ],
  },
  {
    id: 'preferences',
    title: t('settings.groups.preferences'),
    items: [
      { label: t('settings.items.notifications'), value: t('settings.items.notificationsValue'), icon: Bell },
      { label: t('settings.items.privacy'), value: t('settings.items.privacyValue'), icon: Shield, to: '/settings/privacy' },
      { label: t('settings.items.privateMessages'), value: t('settings.items.privateMessagesValue'), icon: MessageCircle, action: 'message-privacy' },
      { label: t('settings.items.streamingQuality'), value: t('settings.items.streamingQualityValue'), icon: MonitorUp },
      { label: t('settings.items.dataStorage'), value: t('settings.items.dataStorageValue'), icon: Database },
      { label: t('settings.items.appLanguage'), value: languageLabel, icon: Languages, action: 'language' },
    ],
  },
  {
    id: 'support',
    title: t('settings.groups.support'),
    items: [
      { label: t('settings.items.helpCenter'), icon: HelpCircle, to: '/help' },
      { label: t('settings.items.reportProblem'), icon: Siren, to: '/report-problem' },
      { label: t('settings.items.communityGuidelines'), icon: BookOpen, to: '/guidelines' },
      { label: t('settings.items.terms'), icon: FileText, to: '/terms' },
      { label: t('settings.items.privacyPolicy'), icon: Globe2, to: '/privacy' },
    ],
  },
  ...(isAdmin ? [{
    id: 'admin',
    title: 'Admin',
    items: [
      { label: 'Admin console', value: 'Internal tools, docs & analytics', icon: ShieldCheck, to: '/admin' },
    ],
  }] : []),
  {
    id: 'security',
    title: t('settings.groups.security'),
    items: [
      { label: t('settings.items.signOut'), value: t('settings.items.signOutValue'), icon: LogOut, action: 'sign-out' },
      { label: t('settings.items.deleteAccount'), value: t('settings.items.permanentAction'), icon: Trash2, action: 'delete-account', danger: true },
    ],
  },
];

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <div className="settings-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="settings-confirm-title">
      <button type="button" className="settings-confirm-modal__backdrop" onClick={onCancel} aria-label={t('common.cancel')} />
      <div className="settings-confirm-modal__panel">
        <h3 id="settings-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="settings-confirm-modal__actions">
          <button type="button" className="settings-confirm-modal__cancel" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className={`settings-confirm-modal__confirm${danger ? ' is-danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, mode } = useLanguage();
  const [messagePreferences, setMessagePreferences] = useState(() => getMessagePreferences());
  const [pendingAction, setPendingAction] = useState(null);
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const userEmail = user?.email ?? '';
  const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isAdmin = isLocalDev
    || userEmail.endsWith('@vuvio.app')
    || userEmail === 'alexandre.ranson@gmail.com'
    || userEmail === 'doug.benchetrit@gmail.com'
    || userEmail === 'cecilia.ranson@outlook.com'
    || userEmail === 'christophe.ranson@gmail.com';

  const languageLabel = mode === 'auto'
    ? `${t(language === 'fr' ? 'settings.language.optionFr' : 'settings.language.optionEn')} · ${t('settings.language.autoBadge')}`
    : t(language === 'fr' ? 'settings.language.optionFr' : 'settings.language.optionEn');

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleItemClick = (item) => {
    if (item.readOnly) return;

    if (item.to) {
      navigate(item.to, { state: item.state });
      return;
    }

    if (item.action === 'sign-out') {
      setPendingAction('sign-out');
      return;
    }

    if (item.action === 'message-privacy') {
      document.getElementById('settings-message-privacy')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (item.action === 'language') {
      setShowLanguageSheet(true);
      return;
    }

    if (item.action === 'delete-account') {
      setPendingAction('delete-account');
    }
  };

  const handleConfirm = async () => {
    if (pendingAction === 'sign-out') {
      setPendingAction(null);
      await handleSignOut();
    } else if (pendingAction === 'delete-account') {
      setPendingAction(null);
    }
  };

  const updateMessageSetting = (next) => {
    setMessagePreferences(updateMessagePreferences(next));
  };

  return (
    <>
    {pendingAction === 'sign-out' && (
      <ConfirmModal
        title={t('settings.confirm.signOutTitle')}
        message={t('settings.confirm.signOutMessage')}
        confirmLabel={t('settings.items.signOut')}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    )}
    {pendingAction === 'delete-account' && (
      <ConfirmModal
        title={t('settings.confirm.deleteTitle')}
        message={t('settings.confirm.deleteMessage')}
        confirmLabel={t('settings.items.deleteAccount')}
        danger
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    )}
    {showLanguageSheet && (
      <LanguageSheet onClose={() => setShowLanguageSheet(false)} />
    )}
    <section className="screen-scroll settings-screen" aria-label={t('settings.title')}>
      <header className="settings-header">
        <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>{t('settings.title')}</h1>
        <span aria-hidden="true" />
      </header>

      <div className="settings-content">
        <section className="settings-group" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">{t('settings.groups.appearance')}</h2>
          <div className="settings-card">
            <div className="settings-theme-row">
              <span className="settings-row__icon" aria-hidden="true">
                <Palette size={17} strokeWidth={1.8} />
              </span>
              <span className="settings-row__copy"><strong>{t('settings.items.theme')}</strong></span>
              <div className="settings-theme-swatches">
                <button
                  type="button"
                  className={`theme-swatch${theme === 'midnight-sky' ? ' is-active' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #0A1E3A 0%, #123F63 100%)' }}
                  onClick={() => setTheme('midnight-sky')}
                  aria-label={t('settings.themes.midnight')}
                  title={t('settings.themes.midnight')}
                />
                <button
                  type="button"
                  className={`theme-swatch${theme === 'default' ? ' is-active' : ''}`}
                  style={{ background: '#071c2b' }}
                  onClick={() => setTheme('default')}
                  aria-label={t('settings.themes.dark')}
                  title={t('settings.themes.dark')}
                />
                <button
                  type="button"
                  className={`theme-swatch${theme === 'azure-sky' ? ' is-active' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #124077 0%, #2372c8 100%)' }}
                  onClick={() => setTheme('azure-sky')}
                  aria-label={t('settings.themes.azure')}
                  title={t('settings.themes.azure')}
                />
              </div>
            </div>
          </div>
        </section>

        {buildGroups(t, userEmail, languageLabel, isAdmin).map((group) => (
          <section key={group.id} className="settings-group" aria-labelledby={`settings-${group.id}`}>
            <h2 id={`settings-${group.id}`}>{group.title}</h2>
            <div className="settings-card">
              {group.items.map((item) => {
                const Icon = item.icon;
                const opens = Boolean(item.to || item.action);

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={item.danger ? 'settings-row is-danger' : 'settings-row'}
                    onClick={() => handleItemClick(item)}
                    disabled={item.readOnly}
                  >
                    <span className="settings-row__icon" aria-hidden="true">
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <span className="settings-row__copy">
                      <strong>{item.label}</strong>
                      {item.value ? <small>{item.value}</small> : null}
                    </span>
                    {opens && !item.readOnly ? (
                      <ChevronRight className="settings-row__chevron" size={17} strokeWidth={1.8} aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="settings-group message-privacy-settings" aria-labelledby="settings-message-privacy">
          <h2 id="settings-message-privacy">{t('settings.items.privateMessages')}</h2>
          <div className="settings-card">
            <div className="settings-privacy-copy">
              <strong>{t('settings.privacy.whoCanSend')}</strong>
              <p>{t('settings.privacy.whoCanSendHint')}</p>
            </div>
            {[
              ['everyone', t('settings.privacy.everyone')],
              ['following', t('settings.privacy.peopleIFollow')],
              ['none', t('settings.privacy.nobody')],
            ].map(([value, label]) => (
              <label key={value} className="settings-radio-row">
                <span>{label}</span>
                <input
                  type="radio"
                  name="whoCanMessage"
                  checked={messagePreferences.whoCanMessage === value}
                  onChange={() => updateMessageSetting({ whoCanMessage: value })}
                />
              </label>
            ))}
            {[
              ['showOnlineStatus', t('settings.privacy.showOnlineStatus')],
              ['readReceipts', t('settings.privacy.readReceipts')],
              ['messageNotifications', t('settings.privacy.messageNotifications')],
              ['requestNotifications', t('settings.privacy.requestNotifications')],
            ].map(([key, label]) => (
              <label key={key} className="settings-toggle-row">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(messagePreferences[key])}
                  onChange={(event) => updateMessageSetting({ [key]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        </section>

        <LiveActivityPrivacySettings />

        <footer className="settings-footer">
          <strong>Vuvio</strong>
          <span>{t('settings.version', { version: '0.1.0' })}</span>
        </footer>
      </div>
    </section>
    </>
  );
}
