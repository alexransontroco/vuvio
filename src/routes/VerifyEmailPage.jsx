import { Mail, ArrowRight, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resendEmailVerification } from '../services/authService.js';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const { user, userProfile } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkCount, setCheckCount] = useState(0);

  const userEmail = user?.email || userProfile?.email || 'your email';

  // Auto-check verification status every 3 seconds
  useEffect(() => {
    let interval;
    const checkVerification = async () => {
      try {
        // Reload user to get updated emailVerified status
        await user?.reload();
        if (user?.emailVerified) {
          setSuccess('✓ Email verified successfully!');
          setTimeout(() => {
            navigate('/profile', { replace: true });
          }, 1500);
        }
      } catch (err) {
        console.error('Error checking verification:', err);
      }
    };

    if (user && !user.emailVerified) {
      checkVerification();
      interval = setInterval(checkVerification, 3000);
    }

    return () => clearInterval(interval);
  }, [user, navigate]);

  const handleManualCheck = async () => {
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      await user?.reload();
      if (user?.emailVerified) {
        setSuccess('✓ Email verified! Redirecting...');
        setTimeout(() => navigate('/profile', { replace: true }), 1500);
      } else {
        setError('Email not verified yet. Check your inbox.');
      }
    } catch (err) {
      setError('Could not check verification status. Please try again.');
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await resendEmailVerification();
      setSuccess('✓ Verification email sent! Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message || 'Could not send verification email. Please try again.');
      console.error(err);
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="auth-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f4c3a 100%)' }}>
        <div className="auth-panel">
          <div className="auth-card" style={{
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            boxShadow: '0 0 40px rgba(74, 222, 128, 0.2), inset 0 0 40px rgba(74, 222, 128, 0.05)',
          }}>
            <div style={{
              fontSize: 64,
              marginBottom: 24,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              textShadow: '0 0 20px rgba(74, 222, 128, 0.6)',
            }}>✓</div>
            <h1 className="auth-card__title" style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #86efac 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Email verified!</h1>
            <p className="auth-card__subtitle" style={{
              color: '#86efac',
              fontSize: 15,
            }}>
              {success}
            </p>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-screen" style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f3a2f 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow effects */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '10%',
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '10%',
        right: '5%',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      <div className="auth-panel" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-brand" style={{
          marginBottom: 32,
          filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.2))',
        }}>
          <BrandMark size={34} showName />
        </div>

        <div className="auth-card" style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(30, 41, 59, 0.7) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.15), inset 0 0 30px rgba(59, 130, 246, 0.05)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              marginBottom: 20,
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.05) 100%)',
              borderRadius: '50%',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1)',
            }}>
              <Mail size={40} strokeWidth={1.5} style={{
                color: '#60a5fa',
                filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.6))',
              }} />
            </div>
            <h1 className="auth-card__title" style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 12,
            }}>Verify your email</h1>
            <p className="auth-card__subtitle" style={{
              color: '#cbd5e1',
              fontSize: 15,
            }}>
              We sent a verification link to<br />
              <strong style={{ color: '#e0e7ff', fontWeight: 600 }}>{userEmail}</strong>
            </p>
          </div>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          {success && !success.includes('successfully') ? (
            <p style={{ color: '#4ade80', marginBottom: 20, textAlign: 'center', fontSize: 14 }}>
              {success}
            </p>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              className="auth-submit"
              onClick={handleManualCheck}
              disabled={checking}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(96, 165, 250, 0.5)',
              }}
            >
              {checking ? (
                <span className="auth-submit__spinner" aria-hidden="true" />
              ) : (
                <ArrowRight size={16} strokeWidth={2} />
              )}
              {checking ? 'Checking…' : 'Already verified?'}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{
                padding: '12px 16px',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.08)',
                color: '#4ade80',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.3s',
                boxShadow: '0 0 15px rgba(34, 197, 94, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(34, 197, 94, 0.15)';
                e.target.style.borderColor = 'rgba(34, 197, 94, 0.6)';
                e.target.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(34, 197, 94, 0.08)';
                e.target.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                e.target.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.1)';
              }}
            >
              {resending ? (
                <span className="auth-submit__spinner" aria-hidden="true" />
              ) : (
                <RotateCcw size={16} strokeWidth={2} />
              )}
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>

          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              paddingLeft: 16,
              paddingRight: 16,
              paddingBottom: 16,
              borderTop: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.05)',
              fontSize: 13,
              color: '#cbd5e1',
              lineHeight: 1.6,
            }}
          >
            <p style={{ marginBottom: 10, color: '#93c5fd', fontWeight: 600 }}>
              💡 Didn't receive the email?
            </p>
            <ul style={{ margin: '0', paddingLeft: 20 }}>
              <li style={{ marginBottom: 6 }}>Check your spam or junk folder</li>
              <li style={{ marginBottom: 6 }}>Make sure you entered the correct email</li>
              <li>Click "Resend verification email" above</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
