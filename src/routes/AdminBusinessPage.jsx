import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminEmail } from '../constants/adminEmails.js';
import { ChevronLeft, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';

export default function AdminBusinessPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isAdmin = isLocalDev || isAdminEmail(user?.email);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [year, setYear] = useState('2027');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/financial/data', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();

        if (!res.ok) {
          setError(result.message || 'Failed to load financial data');
          return;
        }

        setData(result.data);
        if (result.data?.last_sync) {
          setLastSync(new Date(result.data.last_sync));
        }
      } catch (err) {
        setError(err.message || 'Network error');
      } finally {
        setLoading(false);
      }
    };

    if (user) loadData();
  }, [user]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/financial/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || result.message || 'Sync failed');
        return;
      }

      setData(result.data);
      setLastSync(new Date(result.data.last_sync));
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const openGoogleSheets = () => {
    window.open(
      'https://docs.google.com/spreadsheets/d/1EUZoBWJPwiBJ0jwYGgRBHcXwvurTz24-Uhb-RYM1c74/edit',
      '_blank',
    );
  };

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

  const yearIndex = ['2027', '2028', '2029'].indexOf(year) + 1;
  const rows = (data?.dashboard || []).slice(5).filter((row) => row?.[0] && row?.[yearIndex]);
  const highlights = rows.filter((row) => [
    'Utilisateurs actifs mensuels moyens',
    'Chiffre d’affaires',
    'Résultat net',
    'Trésorerie de clôture',
    'Besoin de financement additionnel',
  ].includes(row[0]));

  const displayValue = (row) => {
    const value = row[yearIndex];
    if (row[0] === 'Utilisateurs actifs mensuels moyens') return value;
    if (value.includes('%')) return value;
    return `${value} €`;
  };

  return (
    <div className="admin-business-page">
      <div className="admin-business-header">
        <button
          type="button"
          className="admin-business-back"
          onClick={() => navigate(-1)}
          aria-label="Retour"
        >
          <ChevronLeft size={20} strokeWidth={1.9} />
        </button>
        <div className="admin-business-title-group">
          <h1>Financial Dashboard</h1>
          <p className="admin-business-subtitle">Prévisionnel & métriques financières</p>
        </div>
      </div>

      <div className="admin-business-controls">
        <button
          type="button"
          className="admin-business-btn-sync"
          onClick={handleSync}
          disabled={syncing}
          title="Synchroniser les données depuis Google Sheets"
        >
          <RefreshCw size={16} strokeWidth={1.9} />
          {syncing ? 'Synchronisation...' : 'Sync Now'}
        </button>
        <button
          type="button"
          className="admin-business-btn-sheets"
          onClick={openGoogleSheets}
          title="Ouvrir le classeur Google Sheets"
        >
          <ExternalLink size={16} strokeWidth={1.9} />
          Ouvrir dans Sheets
        </button>
      </div>

      {lastSync && (
        <div className="admin-business-status">
          Dernière synchronisation : {lastSync.toLocaleString('fr-FR')}
        </div>
      )}

      {error && (
        <div className="admin-business-error">
          <AlertCircle size={18} strokeWidth={1.9} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="admin-business-loading">
          <span />
          Chargement des données financières...
        </div>
      )}

      {!loading && !error && data && (
        <div className="admin-business-content">
          <div className="admin-business-years" role="group" aria-label="Année du prévisionnel">
            {['2027', '2028', '2029'].map((option) => (
              <button key={option} type="button" className={year === option ? 'active' : ''} onClick={() => setYear(option)}>
                {option}
              </button>
            ))}
          </div>
          <p className="admin-business-note">Prévisions simulées à partir des hypothèses du business plan.</p>
          <div className="admin-business-metrics">
            {highlights.map((row) => (
              <div className="admin-business-metric" key={row[0]}>
                <span>{row[0]}</span>
                <strong>{displayValue(row)}</strong>
              </div>
            ))}
          </div>
          <div className="admin-business-table-wrap">
            <h2>Comparaison 2027–2029</h2>
            <table>
              <thead><tr><th>Indicateur</th><th>2027</th><th>2028</th><th>2029</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]}><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="admin-business-empty">
          <p>Pas encore de données synchronisées.</p>
          <p className="admin-business-empty-hint">
            Cliquez sur "Sync Now" pour importer les données depuis Google Sheets.
          </p>
        </div>
      )}
    </div>
  );
}
