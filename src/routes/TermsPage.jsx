import { useState } from 'react';
import LegalSection from '../components/LegalSection.jsx';
import SettingsLegalPage from '../components/SettingsLegalPage.jsx';
import { legalConfig } from '../data/legalConfig.js';

const termsSections = [
  'Purpose',
  'Service publisher',
  'Account creation',
  'Minimum age',
  'User content',
  'Image rights and permissions',
  'Safety during live streams',
  'Forbidden content',
  'Moderation',
  'Reports and appeals',
  'Location',
  'Service availability',
  'Paid features',
  'Advertising and partnerships',
  'Account suspension and deletion',
  'Liability',
  'Changes to the Terms',
  'Applicable law',
  'Contact',
];

export default function TermsPage() {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <SettingsLegalPage title="Terms" label="Terms of use">
      <header className="legal-hero">
        <h1>Vuvio Terms of Use</h1>
        <p>Last updated: {legalConfig.lastUpdated}</p>
      </header>

      <section className="legal-summary">
        <button type="button" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((value) => !value)}>
          Summary
          <span aria-hidden="true">{summaryOpen ? '-' : '+'}</span>
        </button>
        {summaryOpen ? (
          <nav aria-label="Terms summary">
            {termsSections.map((title, index) => (
              <a key={title} href={`#terms-${index + 1}`}>{index + 1}. {title}</a>
            ))}
          </nav>
        ) : null}
      </section>

      <LegalSection id="terms-1" title="1. Purpose">
        <p>These Terms define the rules for accessing and using Vuvio.</p>
        <p>Vuvio lets users watch live or recorded videos, broadcast their own live streams, publish content, follow other users, exchange messages and discover live streams through maps and categories.</p>
      </LegalSection>

      <LegalSection id="terms-2" title="2. Service Publisher">
        <ul>
          <li>Legal name: {legalConfig.legalName}</li>
          <li>Legal form: {legalConfig.legalForm}</li>
          <li>Address: {legalConfig.legalAddress}</li>
          <li>Registration number: {legalConfig.registrationNumber}</li>
          <li>Email: {legalConfig.contactEmail}</li>
          <li>Publication director: {legalConfig.publicationDirector}</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-3" title="3. Account Creation">
        <p>Some Vuvio features require an account. You must provide accurate information, keep it up to date, protect your credentials and notify Vuvio of any unauthorized use.</p>
      </LegalSection>

      <LegalSection id="terms-4" title="4. Minimum Age">
        <p>You must be at least {legalConfig.minimumAge} to create a Vuvio account. Some features may be limited for minors.</p>
      </LegalSection>

      <LegalSection id="terms-5" title="5. User Content">
        <p>You remain responsible for the content you publish, including live streams, replays, titles, descriptions, comments, messages and profile information.</p>
      </LegalSection>

      <LegalSection id="terms-6" title="6. Image Rights and Permissions">
        <p>You must respect other people’s privacy and image rights. Do not broadcast private places or identifiable people without the required permission.</p>
      </LegalSection>

      <LegalSection id="terms-7" title="7. Safety During Live Streams">
        <p>Do not put yourself or others at risk to create content. Vuvio may restrict or remove content that appears dangerous or illegal.</p>
      </LegalSection>

      <LegalSection id="terms-8" title="8. Forbidden Content">
        <p>Illegal, hateful, violent, harassing, sexually exploitative, misleading or privacy-invasive content is not allowed.</p>
      </LegalSection>

      <LegalSection id="terms-9" title="9. Moderation">
        <p>Vuvio may moderate, limit, remove or disable access to content or accounts when necessary to protect users or comply with the law.</p>
      </LegalSection>

      <LegalSection id="terms-10" title="10. Reports and Appeals">
        <p>Users can report content or behavior. Vuvio reviews reports and may provide appeal options where required.</p>
      </LegalSection>

      <LegalSection id="terms-11" title="11. Location">
        <p>Location display depends on your choices and device permissions. Avoid sharing a precise private location publicly unless you clearly intend to do so.</p>
      </LegalSection>

      <LegalSection id="terms-12" title="12. Service Availability">
        <p>Vuvio aims to keep the service available but interruptions may occur because of maintenance, network issues, third-party providers or force majeure.</p>
      </LegalSection>

      <LegalSection id="terms-13" title="13. Paid Features">
        <p>If paid features are introduced, pricing, renewal, cancellation and refund terms will be shown before purchase.</p>
      </LegalSection>

      <LegalSection id="terms-14" title="14. Advertising and Partnerships">
        <p>Sponsored content or partnerships must be identified where required by law.</p>
      </LegalSection>

      <LegalSection id="terms-15" title="15. Account Suspension and Deletion">
        <p>Vuvio may suspend or delete accounts that violate these Terms. Users may request account deletion from Settings.</p>
      </LegalSection>

      <LegalSection id="terms-16" title="16. Liability">
        <p>Vuvio is not responsible for user-generated content, network failures, third-party services or misuse of the platform, except where required by applicable law.</p>
      </LegalSection>

      <LegalSection id="terms-17" title="17. Changes to the Terms">
        <p>Vuvio may update these Terms to reflect product, legal or security changes. Material changes will be communicated where required.</p>
      </LegalSection>

      <LegalSection id="terms-18" title="18. Applicable Law">
        <p>These Terms are governed by the applicable law specified for the service and by mandatory consumer protection rules where relevant.</p>
      </LegalSection>

      <LegalSection id="terms-19" title="19. Contact">
        <p>Contact: <a href={`mailto:${legalConfig.contactEmail}`}>{legalConfig.contactEmail}</a></p>
      </LegalSection>
    </SettingsLegalPage>
  );
}
