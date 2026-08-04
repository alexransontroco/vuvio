import { ImagePlus, Loader2, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { submitProblemReport } from '../services/reportProblemService.js';

const problemTypes = [
  'Connection issue',
  'Account issue',
  'Cannot start a live',
  'Poor video or sound quality',
  'Interrupted live stream',
  'Location issue',
  'Messaging issue',
  'Incorrect notification',
  'Payment or subscription',
  'Inappropriate content or behavior',
  'Security vulnerability',
  'Other issue',
];

const initialForm = {
  category: problemTypes[0],
  subject: '',
  description: '',
  steps: '',
  attachTechnicalInfo: true,
  email: 'hello@vuvio.app',
  screenshotName: '',
};

export default function ReportProblemForm() {
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
      setError('Enter a subject, description and valid email address.');
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
        <h2>Your report has been sent</h2>
        <p>Thanks for contacting us. Our team will review your request and reply to the email address linked to your account.</p>
        <strong>Reference: {reference}</strong>
        <button type="button" onClick={() => {
          setForm(initialForm);
          setStatus('initial');
          setReference('');
        }}>
          Send another report
        </button>
      </section>
    );
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <label>
        <span>What type of issue are you having?</span>
        <select value={form.category} onChange={(event) => update('category', event.target.value)}>
          {problemTypes.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>

      <label>
        <span>Subject</span>
        <input
          value={form.subject}
          onChange={(event) => update('subject', event.target.value)}
          placeholder="Cannot start a live"
          required
        />
      </label>

      <label>
        <span>Describe the issue</span>
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          placeholder="Describe what you were trying to do, what happened and any error message shown."
          required
          rows={5}
        />
      </label>

      <label>
        <span>Steps to reproduce the issue</span>
        <textarea
          value={form.steps}
          onChange={(event) => update('steps', event.target.value)}
          placeholder={'I open the page...\nI tap...\nThe app shows...'}
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
          <span>Add image</span>
        </label>
        {form.screenshotName ? <strong>{form.screenshotName}</strong> : null}
        <p>Avoid sending screenshots containing passwords, payment details or private information about another person.</p>
      </div>

      <label className="report-checkbox">
        <input
          type="checkbox"
          checked={form.attachTechnicalInfo}
          onChange={(event) => update('attachTechnicalInfo', event.target.checked)}
        />
        <span>
          <strong>Automatically attach useful technical information.</strong>
          <small>Vuvio version, device type, browser and operating system. Your password is never attached.</small>
        </span>
      </label>

      <label>
        <span>Reply email address</span>
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
        Send report
      </button>
    </form>
  );
}
