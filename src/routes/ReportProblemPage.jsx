import { useTranslation } from 'react-i18next';
import ReportProblemForm from '../components/ReportProblemForm.jsx';
import SettingsPageHeader from '../components/SettingsPageHeader.jsx';

export default function ReportProblemPage() {
  const { t } = useTranslation();

  return (
    <section className="screen-scroll support-screen" aria-label={t('reportProblem.ariaLabel')}>
      <SettingsPageHeader title={t('reportProblem.title')} />
      <div className="support-content">
        <p className="support-intro">{t('reportProblem.intro')}</p>
        <aside className="support-alert">
          <strong>{t('reportProblem.alert.title')}</strong>
          <p>{t('reportProblem.alert.p1')}</p>
          <p>{t('reportProblem.alert.p2')}</p>
        </aside>
        <ReportProblemForm />
      </div>
    </section>
  );
}
