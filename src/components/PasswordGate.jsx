import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'vuvio-gate-ok';
const EXPECTED_HASH = 'deea46f5f6cc606f';
const HOSTNAMES_GATED = ['vuvio.app', 'www.vuvio.app'];

function quickHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 16);
}

function isGated() {
  if (typeof window === 'undefined') return false;
  return HOSTNAMES_GATED.includes(window.location.hostname);
}

export default function PasswordGate({ children }) {
  const location = useLocation();
  const isPublicIntro = location.pathname === '/' || location.pathname === '/intro-preview';
  const [unlocked, setUnlocked] = useState(() => {
    if (!isGated()) return true;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isGated() || unlocked || isPublicIntro) return;
    document.body.style.background = '#000011';
  }, [unlocked, isPublicIntro]);

  if (unlocked || isPublicIntro) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (quickHash(value) === EXPECTED_HASH) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
      setUnlocked(true);
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.logo}>vuvio</div>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          placeholder="Password"
          style={{
            ...styles.input,
            borderColor: error ? '#ff5a68' : 'rgba(40, 216, 223, 0.35)',
          }}
        />
        <button type="submit" style={styles.btn}>Enter</button>
        {error && <div style={styles.err}>Wrong password</div>}
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: '#000011',
    zIndex: 9999,
    color: '#f2f7f6',
    fontFamily: 'Inter, -apple-system, sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: 'min(320px, 90vw)',
  },
  logo: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: '-0.02em',
    color: '#28d8df',
    marginBottom: 12,
  },
  input: {
    padding: '12px 16px',
    borderRadius: 999,
    border: '1px solid rgba(40, 216, 223, 0.35)',
    background: 'rgba(8, 20, 34, 0.8)',
    color: '#f2f7f6',
    fontSize: 15,
    outline: 'none',
  },
  btn: {
    padding: '12px 16px',
    borderRadius: 999,
    border: 0,
    background: '#28d8df',
    color: '#04121e',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  err: {
    color: '#ff5a68',
    fontSize: 13,
    textAlign: 'center',
  },
};
