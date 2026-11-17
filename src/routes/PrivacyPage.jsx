import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import LegalInfoTable from '../components/LegalInfoTable.jsx';
import LegalSection from '../components/LegalSection.jsx';
import SettingsLegalPage from '../components/SettingsLegalPage.jsx';
import { legalConfig } from '../data/legalConfig.js';

export default function PrivacyPage() {
  const { t } = useTranslation();

  const purposes = useMemo(() => [
    { label: t('privacy.purposes.rows.account.label'), value: t('privacy.purposes.rows.account.value'), basis: t('privacy.purposes.rows.account.basis') },
    { label: t('privacy.purposes.rows.broadcast.label'), value: t('privacy.purposes.rows.broadcast.value'), basis: t('privacy.purposes.rows.broadcast.basis') },
    { label: t('privacy.purposes.rows.map.label'), value: t('privacy.purposes.rows.map.value'), basis: t('privacy.purposes.rows.map.basis') },
    { label: t('privacy.purposes.rows.messaging.label'), value: t('privacy.purposes.rows.messaging.value'), basis: t('privacy.purposes.rows.messaging.basis') },
    { label: t('privacy.purposes.rows.secure.label'), value: t('privacy.purposes.rows.secure.value'), basis: t('privacy.purposes.rows.secure.basis') },
    { label: t('privacy.purposes.rows.moderate.label'), value: t('privacy.purposes.rows.moderate.value'), basis: t('privacy.purposes.rows.moderate.basis') },
    { label: t('privacy.purposes.rows.support.label'), value: t('privacy.purposes.rows.support.value'), basis: t('privacy.purposes.rows.support.basis') },
    { label: t('privacy.purposes.rows.improve.label'), value: t('privacy.purposes.rows.improve.value'), basis: t('privacy.purposes.rows.improve.basis') },
    { label: t('privacy.purposes.rows.marketing.label'), value: t('privacy.purposes.rows.marketing.value'), basis: t('privacy.purposes.rows.marketing.basis') },
    { label: t('privacy.purposes.rows.legal.label'), value: t('privacy.purposes.rows.legal.value'), basis: t('privacy.purposes.rows.legal.basis') },
  ], [t]);

  const retention = useMemo(() => [
    { label: t('privacy.retention.rows.active.label'), value: t('privacy.retention.rows.active.value') },
    { label: t('privacy.retention.rows.deleted.label'), value: t('privacy.retention.rows.deleted.value') },
    { label: t('privacy.retention.rows.unsavedLives.label'), value: t('privacy.retention.rows.unsavedLives.value') },
    { label: t('privacy.retention.rows.replays.label'), value: t('privacy.retention.rows.replays.value') },
    { label: t('privacy.retention.rows.messages.label'), value: t('privacy.retention.rows.messages.value') },
    { label: t('privacy.retention.rows.logs.label'), value: t('privacy.retention.rows.logs.value') },
    { label: t('privacy.retention.rows.support.label'), value: t('privacy.retention.rows.support.value') },
    { label: t('privacy.retention.rows.consents.label'), value: t('privacy.retention.rows.consents.value') },
    { label: t('privacy.retention.rows.billing.label'), value: t('privacy.retention.rows.billing.value') },
  ], [t]);

  return (
    <SettingsLegalPage title={t('privacy.title')} label={t('privacy.label')}>
      <header className="legal-hero">
        <h1>{t('privacy.heroTitle')}</h1>
        <p>{t('privacy.lastUpdated', { date: legalConfig.lastUpdated })}</p>
      </header>

      <p className="legal-intro">{t('privacy.intro')}</p>

      <LegalSection id="privacy-controller" title={t('privacy.sections.controller.title')}>
        <ul>
          <li>{t('privacy.sections.controller.companyName', { value: legalConfig.companyName })}</li>
          <li>{t('privacy.sections.controller.address', { value: legalConfig.companyAddress })}</li>
          <li>{t('privacy.sections.controller.privacyEmail', { value: legalConfig.privacyEmail })}</li>
          <li>{t('privacy.sections.controller.dpo', { value: legalConfig.dpoName })}</li>
        </ul>
      </LegalSection>

      <LegalSection id="privacy-data" title={t('privacy.sections.data.title')}>
        <p>{t('privacy.sections.data.body')}</p>
      </LegalSection>

      <LegalSection id="privacy-purposes" title={t('privacy.sections.purposes.title')}>
        <LegalInfoTable rows={purposes} />
      </LegalSection>

      <LegalSection id="privacy-waitlist" title={t('privacy.sections.waitlist.title')}>
        <p>{t('privacy.sections.waitlist.body')}</p>
        <p>{t('privacy.sections.waitlist.retention')}</p>
        <p>{t('privacy.sections.waitlist.withdraw')} <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.</p>
      </LegalSection>

      <LegalSection id="privacy-location" title={t('privacy.sections.location.title')}>
        <p>{t('privacy.sections.location.body')}</p>
      </LegalSection>

      <LegalSection id="privacy-sharing" title={t('privacy.sections.sharing.title')}>
        <p>{t('privacy.sections.sharing.body')}</p>
      </LegalSection>

      <LegalSection id="privacy-retention" title={t('privacy.sections.retention.title')}>
        <LegalInfoTable rows={retention} />
      </LegalSection>

      <LegalSection id="privacy-rights" title={t('privacy.sections.rights.title')}>
        <p>{t('privacy.sections.rights.body')} <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>.</p>
      </LegalSection>

      <LegalSection id="privacy-security" title={t('privacy.sections.security.title')}>
        <p>{t('privacy.sections.security.body')}</p>
      </LegalSection>

      <LegalSection id="privacy-children" title={t('privacy.sections.children.title')}>
        <p>{t('privacy.sections.children.body')}</p>
      </LegalSection>

      <LegalSection id="privacy-changes" title={t('privacy.sections.changes.title')}>
        <p>{t('privacy.sections.changes.body')}</p>
      </LegalSection>
    </SettingsLegalPage>
  );
}
