import { CheckCircle, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const { sendReset } = useAuth();
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !email.trim()) return;
    setError('');
    setSubmitting(true);
    const result = await sendReset(email.trim());
    setSubmitting(false);
    if (result.success) {
      setSent(true);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <Link to="/home" className="auth-brand" aria-label="Vuvio home">
          <BrandMark size={34} showName />
        </Link>

        <div className="auth-card">
          {sent ? (
            <div className="auth-success">
              <div className="auth-success__icon">
                <CheckCircle size={26} strokeWidth={1.8} />
              </div>
              <h1 className="auth-success__title">Check your email</h1>
              <p className="auth-success__body">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent.
              </p>
              <Link to="/login" className="auth-submit" style={{ textDecoration: 'none', marginTop: 8 }}>
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="auth-card__title">Reset password</h1>
              <p className="auth-card__subtitle">
                Enter your email and we'll send you a link to reset your password.
              </p>

              {error ? <p className="auth-error" role="alert">{error}</p> : null}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="forgot-email">Email</label>
                  <div className="auth-field__control">
                    <input
                      id="forgot-email"
                      className="auth-field__input"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                </div>

                <button type="submit" className="auth-submit" disabled={submitting || !email}>
                  {submitting
                    ? <><span className="auth-submit__spinner" aria-hidden="true" /> Sending…</>
                    : <><Mail size={17} strokeWidth={2} aria-hidden="true" /> Send reset link</>
                  }
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
