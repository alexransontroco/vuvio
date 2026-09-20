import {
  Bell,
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
  Siren,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMessagePreferences, updateMessagePreferences } from '../services/messagingService.js';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { LiveActivityPrivacySettings } from '../components/social/LiveActivityPrivacySettings.jsx';

const getSettingGroups = (userEmail) => [
  {
    id: 'about',
    title: 'About',
    items: [
      { label: 'What is Vuvio?', value: 'Platform overview', icon: Info, to: '/help', state: { scrollTo: 'what-is-vuvio' } },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      { label: 'E-mail', value: userEmail, icon: Mail, readOnly: true },
      { label: 'Password', value: 'Edit', icon: Lock },
      { label: 'Public profile', value: 'Edit your profile', icon: UserRound, to: '/profile/edit' },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferences',
    items: [
      { label: 'Notifications', value: 'Lives, messages and reminders', icon: Bell },
      { label: 'Privacy', value: 'Visibility and security', icon: Shield },
      { label: 'Private messages', value: 'Who can message you', icon: MessageCircle, action: 'message-privacy' },
      { label: 'Streaming quality', value: 'Automatic', icon: MonitorUp },
      { label: 'Data and storage', value: 'Cache and downloads', icon: Database },
      { label: 'App language', value: 'English', icon: Languages },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      { label: 'Help center', icon: HelpCircle, to: '/help' },
      { label: 'Report a problem', icon: Siren, to: '/report-problem' },
      { label: 'Terms of use', icon: FileText, to: '/terms' },
      { label: 'Privacy policy', icon: Globe2, to: '/privacy' },
    ],
  },
  {
    id: 'security',
    title: 'Account and security',
    items: [
      { label: 'Sign out', value: 'End the session on this device', icon: LogOut, action: 'sign-out' },
      { label: 'Delete my account', value: 'Permanent action', icon: Trash2, action: 'delete-account', danger: true },
    ],
  },
];

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="settings-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="settings-confirm-title">
      <button type="button" className="settings-confirm-modal__backdrop" onClick={onCancel} aria-label="Cancel" />
      <div className="settings-confirm-modal__panel">
        <h3 id="settings-confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="settings-confirm-modal__actions">
          <button type="button" className="settings-confirm-modal__cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className={`settings-confirm-modal__confirm${danger ? ' is-danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [messagePreferences, setMessagePreferences] = useState(() => getMessagePreferences());
  const [pendingAction, setPendingAction] = useState(null);
  const userEmail = user?.email ?? '';

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
      // Firebase Auth not wired yet — placeholder
    }
  };

  const updateMessageSetting = (next) => {
    setMessagePreferences(updateMessagePreferences(next));
  };

  return (
    <>
    {pendingAction === 'sign-out' && (
      <ConfirmModal
        title="Sign out"
        message="End the session on this device?"
        confirmLabel="Sign out"
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    )}
    {pendingAction === 'delete-account' && (
      <ConfirmModal
        title="Delete account"
        message="This will permanently delete your Vuvio account. This action cannot be undone."
        confirmLabel="Delete account"
        danger
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    )}
    <section className="screen-scroll settings-screen" aria-label="Settings">
      <header className="settings-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <h1>Settings</h1>
        <span aria-hidden="true" />
      </header>

      <div className="settings-content">
        <section className="settings-group" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance">Appearance</h2>
          <div className="settings-card">
            <div className="settings-theme-row">
              <span className="settings-row__icon" aria-hidden="true">
                <Palette size={17} strokeWidth={1.8} />
              </span>
              <span className="settings-row__copy"><strong>Theme</strong></span>
              <div className="settings-theme-swatches">
                <button
                  type="button"
                  className={`theme-swatch${theme === 'default' ? ' is-active' : ''}`}
                  style={{ background: '#071c2b' }}
                  onClick={() => setTheme('default')}
                  aria-label="Dark theme"
                  title="Dark"
                />
                <button
                  type="button"
                  className={`theme-swatch${theme === 'midnight-sky' ? ' is-active' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #0A1E3A 0%, #123F63 100%)' }}
                  onClick={() => setTheme('midnight-sky')}
                  aria-label="Midnight Sky theme"
                  title="Midnight Sky"
                />
              </div>
            </div>
          </div>
        </section>

        {getSettingGroups(userEmail).map((group) => (
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
          <h2 id="settings-message-privacy">Private messages</h2>
          <div className="settings-card">
            <div className="settings-privacy-copy">
              <strong>Who can send me messages?</strong>
              <p>Messages from people you do not follow will appear in your requests.</p>
            </div>
            {[
              ['everyone', 'Everyone'],
              ['following', 'People I follow'],
              ['none', 'Nobody'],
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
              ['showOnlineStatus', 'Show my online status'],
              ['readReceipts', 'Read receipts'],
              ['messageNotifications', 'Message notifications'],
              ['requestNotifications', 'Request notifications'],
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
          <span>Version 0.1.0</span>
        </footer>
      </div>
    </section>
    </>
  );
}
