import SettingsPageHeader from './SettingsPageHeader.jsx';

export default function SettingsLegalPage({ title, label, children }) {
  return (
    <section className="screen-scroll support-screen legal-page" aria-label={label ?? title}>
      <SettingsPageHeader title={title} />
      <div className="support-content legal-content">
        {children}
      </div>
    </section>
  );
}
