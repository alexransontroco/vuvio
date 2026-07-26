import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function GoogleIcon() {
  return (
    <svg className="auth-google__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const ok = password.length >= 8;
  return (
    <span className={`auth-field__hint${ok ? '' : ' auth-field__error'}`}>
      {ok ? '✓ At least 8 characters' : 'At least 8 characters required'}
    </span>
  );
}

export default function SignupPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { signUp, signInWithGoogle } = useAuth();
  const returnTo  = location.state?.returnTo || '/home';

  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [googleBusy,  setGoogleBusy]  = useState(false);

  const validate = () => {
    const errs = {};
    if (!displayName.trim()) errs.displayName = 'Display name is required.';
    if (!email.trim())        errs.email       = 'Email is required.';
    if (password.length < 8)  errs.password    = 'At least 8 characters required.';
    if (password !== confirmPw) errs.confirmPw = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setSubmitting(true);
    const result = await signUp(email.trim(), password, displayName.trim());
    setSubmitting(false);
    if (result.success) {
      navigate('/profile', { replace: true });
    } else {
      setError(result.error);
    }
  };

  const handleGoogle = async () => {
    if (googleBusy) return;
    setError('');
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (result.success) {
      navigate('/profile', { replace: true });
    } else if (result.error) {
      setError(result.error);
    }
  };

  const busy = submitting || googleBusy;

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <Link to="/home" className="auth-brand" aria-label="Vuvio home">
          <BrandMark size={34} showName />
        </Link>

        <div className="auth-card">
          <h1 className="auth-card__title">Create account</h1>
          <p className="auth-card__subtitle">Join Vuvio and explore live perspectives.</p>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="signup-name">Display name</label>
              <div className="auth-field__control">
                <input
                  id="signup-name"
                  className={`auth-field__input${fieldErrors.displayName ? ' has-error' : ''}`}
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={busy}
                />
              </div>
              {fieldErrors.displayName ? <span className="auth-field__error">{fieldErrors.displayName}</span> : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="signup-email">Email</label>
              <div className="auth-field__control">
                <input
                  id="signup-email"
                  className={`auth-field__input${fieldErrors.email ? ' has-error' : ''}`}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              {fieldErrors.email ? <span className="auth-field__error">{fieldErrors.email}</span> : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="signup-password">Password</label>
              <div className="auth-field__control">
                <input
                  id="signup-password"
                  className={`auth-field__input${fieldErrors.password ? ' has-error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="auth-field__toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
                </button>
              </div>
              <PasswordStrength password={password} />
              {fieldErrors.password ? <span className="auth-field__error">{fieldErrors.password}</span> : null}
            </div>

            <div className="auth-field">
              <label className="auth-field__label" htmlFor="signup-confirm">Confirm password</label>
              <div className="auth-field__control">
                <input
                  id="signup-confirm"
                  className={`auth-field__input${fieldErrors.confirmPw ? ' has-error' : ''}`}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="auth-field__toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
                </button>
              </div>
              {fieldErrors.confirmPw ? <span className="auth-field__error">{fieldErrors.confirmPw}</span> : null}
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={busy || !email || !password || !displayName}
            >
              {submitting ? <span className="auth-submit__spinner" aria-hidden="true" /> : <UserPlus size={17} strokeWidth={2} aria-hidden="true" />}
              {submitting ? 'Creating account…' : 'Create account'}
            </button>

            <div className="auth-divider">or</div>

            <button type="button" className="auth-google" onClick={handleGoogle} disabled={busy}>
              {googleBusy
                ? <span className="auth-submit__spinner" aria-hidden="true" />
                : <GoogleIcon />
              }
              Continue with Google
            </button>

            <p className="auth-legal">
              By creating an account, you agree to Vuvio's{' '}
              <Link to="/terms">Terms</Link> and{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </form>
        </div>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" state={{ returnTo }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
