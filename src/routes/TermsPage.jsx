import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import LegalSection from '../components/LegalSection.jsx';
import SettingsLegalPage from '../components/SettingsLegalPage.jsx';
import { legalConfig } from '../data/legalConfig.js';

export default function TermsPage() {
  const { t } = useTranslation();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const termsSections = useMemo(() => [
    t('terms.sections.purpose.title'),
    t('terms.sections.publisher.title'),
    t('terms.sections.account.title'),
    t('terms.sections.age.title'),
    t('terms.sections.userContent.title'),
    t('terms.sections.imageRights.title'),
    t('terms.sections.safety.title'),
    t('terms.sections.forbidden.title'),
    t('terms.sections.moderation.title'),
    t('terms.sections.reports.title'),
    t('terms.sections.location.title'),
    t('terms.sections.availability.title'),
    t('terms.sections.paid.title'),
    t('terms.sections.advertising.title'),
    t('terms.sections.suspension.title'),
    t('terms.sections.liability.title'),
    t('terms.sections.changes.title'),
    t('terms.sections.law.title'),
    t('terms.sections.contact.title'),
  ], [t]);

  return (
    <SettingsLegalPage title={t('terms.title')} label={t('terms.label')}>
      <header className="legal-hero">
        <h1>{t('terms.heroTitle')}</h1>
        <p>{t('terms.lastUpdated', { date: legalConfig.lastUpdated })}</p>
      </header>

      <section className="legal-summary">
        <button type="button" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((value) => !value)}>
          {t('terms.summary')}
          <span aria-hidden="true">{summaryOpen ? '-' : '+'}</span>
        </button>
        {summaryOpen ? (
          <nav aria-label={t('terms.summaryAriaLabel')}>
            {termsSections.map((title, index) => (
              <a key={title} href={`#terms-${index + 1}`}>{index + 1}. {title}</a>
            ))}
          </nav>
        ) : null}
      </section>

      <LegalSection id="terms-1" title={`1. ${t('terms.sections.purpose.title')}`}>
        <p>{t('terms.sections.purpose.body1')}</p>
        <p>{t('terms.sections.purpose.body2')}</p>
      </LegalSection>

      <LegalSection id="terms-2" title={`2. ${t('terms.sections.publisher.title')}`}>
        <ul>
          <li>{t('terms.sections.publisher.legalName', { value: legalConfig.legalName })}</li>
          <li>{t('terms.sections.publisher.legalForm', { value: legalConfig.legalForm })}</li>
          <li>{t('terms.sections.publisher.address', { value: legalConfig.legalAddress })}</li>
          <li>{t('terms.sections.publisher.registration', { value: legalConfig.registrationNumber })}</li>
          <li>{t('terms.sections.publisher.email', { value: legalConfig.contactEmail })}</li>
          <li>{t('terms.sections.publisher.director', { value: legalConfig.publicationDirector })}</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-3" title={`3. ${t('terms.sections.account.title')}`}>
        <p>{t('terms.sections.account.body')}</p>
      </LegalSection>

      <LegalSection id="terms-4" title={`4. ${t('terms.sections.age.title')}`}>
        <p>{t('terms.sections.age.body', { age: legalConfig.minimumAge })}</p>
      </LegalSection>

      <LegalSection id="terms-5" title={`5. ${t('terms.sections.userContent.title')}`}>
        <p>{t('terms.sections.userContent.body')}</p>
      </LegalSection>

      <LegalSection id="terms-6" title={`6. ${t('terms.sections.imageRights.title')}`}>
        <p>{t('terms.sections.imageRights.body')}</p>
      </LegalSection>

      <LegalSection id="terms-7" title={`7. ${t('terms.sections.safety.title')}`}>
        <p>{t('terms.sections.safety.body')}</p>
      </LegalSection>

      <LegalSection id="terms-8" title={`8. ${t('terms.sections.forbidden.title')}`}>
        <p>{t('terms.sections.forbidden.body')}</p>
      </LegalSection>

      <LegalSection id="terms-9" title={`9. ${t('terms.sections.moderation.title')}`}>
        <p>{t('terms.sections.moderation.body')}</p>
      </LegalSection>

      <LegalSection id="terms-10" title={`10. ${t('terms.sections.reports.title')}`}>
        <p>{t('terms.sections.reports.body')}</p>
      </LegalSection>

      <LegalSection id="terms-11" title={`11. ${t('terms.sections.location.title')}`}>
        <p>{t('terms.sections.location.body')}</p>
      </LegalSection>

      <LegalSection id="terms-12" title={`12. ${t('terms.sections.availability.title')}`}>
        <p>{t('terms.sections.availability.body')}</p>
      </LegalSection>

      <LegalSection id="terms-13" title={`13. ${t('terms.sections.paid.title')}`}>
        <p>{t('terms.sections.paid.body')}</p>
      </LegalSection>

      <LegalSection id="terms-14" title={`14. ${t('terms.sections.advertising.title')}`}>
        <p>{t('terms.sections.advertising.body')}</p>
      </LegalSection>

      <LegalSection id="terms-15" title={`15. ${t('terms.sections.suspension.title')}`}>
        <p>{t('terms.sections.suspension.body')}</p>
      </LegalSection>

      <LegalSection id="terms-16" title={`16. ${t('terms.sections.liability.title')}`}>
        <p>{t('terms.sections.liability.body')}</p>
      </LegalSection>

      <LegalSection id="terms-17" title={`17. ${t('terms.sections.changes.title')}`}>
        <p>{t('terms.sections.changes.body')}</p>
      </LegalSection>

      <LegalSection id="terms-18" title={`18. ${t('terms.sections.law.title')}`}>
        <p>{t('terms.sections.law.body')}</p>
      </LegalSection>

      <LegalSection id="terms-19" title={`19. ${t('terms.sections.contact.title')}`}>
        <p>{t('terms.sections.contact.body')} <a href={`mailto:${legalConfig.contactEmail}`}>{legalConfig.contactEmail}</a></p>
      </LegalSection>
    </SettingsLegalPage>
  );
}
