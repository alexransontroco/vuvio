import { CheckCircle, Mail } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import SEO from '../components/SEO.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { sendReset } = useAuth();
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !email.trim()) { setError(t('auth.forgot.emailRequired')); return; }
    setError('');
    setSubmitting(true);
    const result = await sendReset(email.trim());
    setSubmitting(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || t('auth.forgot.genericError'));
    }
  };

  return (
    <div className="auth-screen">
      <SEO title="Mot de passe oublie | Vuvio" description="Reinitialisation du mot de passe Vuvio." canonical="/forgot-password" robots="noindex,follow" />
      <div className="auth-panel">
        <Link to="/home" className="auth-brand" aria-label={t('auth.forgot.brandAria')}>
          <BrandMark size={34} showName />
        </Link>

        <div className="auth-card">
          {sent ? (
            <div className="auth-success">
              <div className="auth-success__icon">
                <CheckCircle size={26} strokeWidth={1.8} />
              </div>
              <h1 className="auth-success__title">{t('auth.forgot.checkEmailTitle')}</h1>
              <p className="auth-success__body">
                <Trans
                  i18nKey="auth.forgot.checkEmailBody"
                  values={{ email }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <Link to="/login" className="auth-submit" style={{ textDecoration: 'none', marginTop: 8 }}>
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="auth-card__title">{t('auth.forgot.title')}</h1>
              <p className="auth-card__subtitle">
                {t('auth.forgot.subtitle')}
              </p>

              {error ? <p className="auth-error" role="alert">{error}</p> : null}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="forgot-email">{t('auth.forgot.emailLabel')}</label>
                  <div className="auth-field__control">
                    <input
                      id="forgot-email"
                      className="auth-field__input"
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth.forgot.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit" disabled={submitting || !email}>
                  {submitting
                    ? <><span className="auth-submit__spinner" aria-hidden="true" /> {t('auth.forgot.sending')}</>
                    : <><Mail size={17} strokeWidth={2} aria-hidden="true" /> {t('auth.forgot.sendResetLink')}</>
                  }
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">
          <Link to="/login">{t('auth.forgot.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
