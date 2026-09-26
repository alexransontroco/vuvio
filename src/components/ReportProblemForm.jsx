import { ImagePlus, Loader2, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitProblemReport } from '../services/reportProblemService.js';

export default function ReportProblemForm() {
  const { t } = useTranslation();

  const problemTypes = useMemo(() => [
    t('reportProblem.form.types.connection'),
    t('reportProblem.form.types.account'),
    t('reportProblem.form.types.cannotStart'),
    t('reportProblem.form.types.poorQuality'),
    t('reportProblem.form.types.interrupted'),
    t('reportProblem.form.types.location'),
    t('reportProblem.form.types.messaging'),
    t('reportProblem.form.types.notification'),
    t('reportProblem.form.types.payment'),
    t('reportProblem.form.types.inappropriate'),
    t('reportProblem.form.types.security'),
    t('reportProblem.form.types.other'),
  ], [t]);

  const initialForm = useMemo(() => ({
    category: problemTypes[0],
    subject: '',
    description: '',
    steps: '',
    attachTechnicalInfo: true,
    email: 'hello@vuvio.app',
    screenshotName: '',
  }), [problemTypes]);

  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('initial');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  const canSubmit = useMemo(() => (
    form.subject.trim().length > 2 && form.description.trim().length > 8 && form.email.includes('@')
  ), [form.description, form.email, form.subject]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (status === 'error') setStatus('initial');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setError(t('reportProblem.form.errors.invalid'));
      setStatus('error');
      return;
    }

    setStatus('sending');
    setError('');

    try {
      const result = await submitProblemReport(form);
      setReference(result.reference);
      setStatus('success');
    } catch (submissionError) {
      setError(submissionError.message);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <section className="report-success" aria-live="polite">
        <h2>{t('reportProblem.form.success.title')}</h2>
        <p>{t('reportProblem.form.success.body')}</p>
        <strong>{t('reportProblem.form.success.reference', { reference })}</strong>
        <button type="button" onClick={() => {
          setForm(initialForm);
          setStatus('initial');
          setReference('');
        }}>
          {t('reportProblem.form.success.sendAnother')}
        </button>
      </section>
    );
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <label>
        <span>{t('reportProblem.form.fields.category')}</span>
        <select value={form.category} onChange={(event) => update('category', event.target.value)}>
          {problemTypes.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>

      <label>
        <span>{t('reportProblem.form.fields.subject')}</span>
        <input
          value={form.subject}
          onChange={(event) => update('subject', event.target.value)}
          placeholder={t('reportProblem.form.placeholders.subject')}
          required
        />
      </label>

      <label>
        <span>{t('reportProblem.form.fields.description')}</span>
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          placeholder={t('reportProblem.form.placeholders.description')}
          required
          rows={5}
        />
      </label>

      <label>
        <span>{t('reportProblem.form.fields.steps')}</span>
        <textarea
          value={form.steps}
          onChange={(event) => update('steps', event.target.value)}
          placeholder={t('reportProblem.form.placeholders.steps')}
          rows={4}
        />
      </label>

      <div className="report-upload">
        <label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => update('screenshotName', event.target.files?.[0]?.name ?? '')}
          />
          <ImagePlus size={18} strokeWidth={1.8} />
          <span>{t('reportProblem.form.upload.addImage')}</span>
        </label>
        {form.screenshotName ? <strong>{form.screenshotName}</strong> : null}
        <p>{t('reportProblem.form.upload.notice')}</p>
      </div>

      <label className="report-checkbox">
        <input
          type="checkbox"
          checked={form.attachTechnicalInfo}
          onChange={(event) => update('attachTechnicalInfo', event.target.checked)}
        />
        <span>
          <strong>{t('reportProblem.form.tech.title')}</strong>
          <small>{t('reportProblem.form.tech.body')}</small>
        </span>
      </label>

      <label>
        <span>{t('reportProblem.form.fields.email')}</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          required
        />
      </label>

      {status === 'error' ? <p className="report-error" role="alert">{error}</p> : null}

      <button type="submit" className="support-primary-button" disabled={status === 'sending'}>
        {status === 'sending' ? <Loader2 size={17} strokeWidth={1.9} /> : <Send size={17} strokeWidth={1.9} />}
        {t('reportProblem.form.submit')}
      </button>
    </form>
  );
}
