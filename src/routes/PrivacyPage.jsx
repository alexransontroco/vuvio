import LegalInfoTable from '../components/LegalInfoTable.jsx';
import LegalSection from '../components/LegalSection.jsx';
import SettingsLegalPage from '../components/SettingsLegalPage.jsx';
import { legalConfig } from '../data/legalConfig.js';

const purposes = [
  { label: 'Create and manage your account', value: 'Account data', basis: 'Contract performance' },
  { label: 'Enable broadcasting and viewing', value: 'Content, activity and technical data', basis: 'Contract performance' },
  { label: 'Show live streams on the map', value: 'Chosen location data', basis: 'Service performance or consent' },
  { label: 'Provide messaging and interactions', value: 'Messages and activity', basis: 'Contract performance' },
  { label: 'Secure Vuvio', value: 'Logs, IP addresses and reports', basis: 'Legitimate interest' },
  { label: 'Moderate content', value: 'Content, reports and activity', basis: 'Legitimate interest and legal obligations' },
  { label: 'Reply to support requests', value: 'Contact details and request content', basis: 'Contract performance' },
  { label: 'Improve the app', value: 'Technical and analytics data', basis: 'Legitimate interest or consent' },
  { label: 'Send marketing communications', value: 'Email and preferences', basis: 'Consent where required' },
  { label: 'Comply with legal obligations', value: 'Required data', basis: 'Legal obligation' },
];

const retention = [
  { label: 'Active account', value: 'For the duration of account use' },
  { label: 'Deleted account', value: 'Deletion or anonymization within a reasonable period' },
  { label: 'Unsaved live streams', value: 'Technical duration required for broadcasting' },
  { label: 'Published replays', value: 'Until deleted by the user or Vuvio' },
  { label: 'Messages', value: 'While the account or conversation remains active' },
  { label: 'Security logs', value: 'Up to 12 months unless a specific need applies' },
  { label: 'Support requests', value: 'Up to 3 years after closure' },
  { label: 'Consents', value: 'As long as needed to keep proof' },
  { label: 'Billing', value: 'As required by applicable law' },
];

export default function PrivacyPage() {
  return (
    <SettingsLegalPage title="Privacy" label="Privacy policy">
      <header className="legal-hero">
        <h1>Vuvio Privacy Policy</h1>
        <p>Last updated: {legalConfig.lastUpdated}</p>
      </header>

      <p className="legal-intro">This policy explains how Vuvio collects, uses, stores and protects personal data when you use the app, website or services.</p>

      <LegalSection id="privacy-controller" title="1. Controller">
        <ul>
          <li>Company name: {legalConfig.companyName}</li>
          <li>Address: {legalConfig.companyAddress}</li>
          <li>Privacy email: {legalConfig.privacyEmail}</li>
          <li>Data protection contact: {legalConfig.dpoName}</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-data" title="2. Data We May Collect">
        <p>We may collect account data, profile data, content and activity, messages, reports, device information, approximate or precise location depending on your choices, and technical logs required to operate and secure Vuvio.</p>
      </LegalSection>

      <LegalSection id="privacy-purposes" title="3. Purposes and Legal Bases">
        <LegalInfoTable rows={purposes} />
      </LegalSection>

      <LegalSection id="privacy-location" title="4. Location Data">
        <p>Location access depends on your device permissions and product choices. You can disable it in your device or browser settings. Precise location should only be shared when you intentionally choose to do so.</p>
      </LegalSection>

      <LegalSection id="privacy-sharing" title="5. Data Sharing">
        <p>We may share data with hosting, analytics, moderation, payment, security or support providers when needed to operate the service. We may also share data when required by law.</p>
      </LegalSection>

      <LegalSection id="privacy-retention" title="6. Retention">
        <LegalInfoTable rows={retention} />
      </LegalSection>

      <LegalSection id="privacy-rights" title="7. Your Rights">
        <p>Depending on applicable law, you may request access, correction, deletion, restriction, portability or objection. Contact us at <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.</p>
      </LegalSection>

      <LegalSection id="privacy-security" title="8. Security">
        <p>Vuvio uses technical and organizational safeguards to protect data, but no system can be guaranteed to be completely secure.</p>
      </LegalSection>

      <LegalSection id="privacy-children" title="9. Children">
        <p>Some features may be restricted for minors. Parental authorization may be required where applicable.</p>
      </LegalSection>

      <LegalSection id="privacy-changes" title="10. Changes">
        <p>This policy may change as Vuvio evolves. Material updates will be communicated where required.</p>
      </LegalSection>
    </SettingsLegalPage>
  );
}
