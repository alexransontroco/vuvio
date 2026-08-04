import ReportProblemForm from '../components/ReportProblemForm.jsx';
import SettingsPageHeader from '../components/SettingsPageHeader.jsx';

export default function ReportProblemPage() {
  return (
    <section className="screen-scroll support-screen" aria-label="Report a problem">
      <SettingsPageHeader title="Report a problem" />
      <div className="support-content">
        <p className="support-intro">Describe the issue you encountered. The more precise your report is, the more effectively we can help.</p>
        <aside className="support-alert">
          <strong>Do you want to report a live stream, video or user?</strong>
          <p>Use the Report button directly on the relevant content first. This lets us automatically collect the information needed for review.</p>
          <p>The Digital Services Act requires users to be able to report content they believe is illegal easily.</p>
        </aside>
        <ReportProblemForm />
      </div>
    </section>
  );
}
