import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminEmail } from '../constants/adminEmails.js';
import { ChevronLeft, RefreshCw, ExternalLink, AlertCircle, AlertTriangle } from 'lucide-react';

function parseNum(str) {
  if (str == null || str === '') return null;
  const cleaned = String(str).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function safeDisplayValue(row, yearIndex) {
  const raw = row[yearIndex];
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (row[0] === 'Utilisateurs actifs mensuels moyens') return s;
  if (s.includes('%') || s.includes('€')) return s;
  const n = parseNum(s);
  if (n == null) return s;
  return `${s} €`;
}

function RevenueChart({ rows }) {
  const KPI_LABELS = ["Chiffre d'affaires", 'Résultat net'];
  const COLORS = ['rgba(53,227,220,0.75)', 'rgba(99,179,237,0.65)'];
  const kpis = KPI_LABELS.map((label) => rows.find((r) => r[0] === label)).filter(Boolean);
  if (!kpis.length) return null;

  const allVals = kpis.flatMap((r) => [1, 2, 3].map((i) => parseNum(r[i]))).filter((v) => v != null && v > 0);
  if (allVals.length < 2) return null;
  const max = Math.max(...allVals);

  const W = 300;
  const H = 110;
  const PAD = { top: 20, bottom: 24, left: 4, right: 4 };
  const chartH = H - PAD.top - PAD.bottom;
  const YEARS = ['2027', '2028', '2029'];
  const groupW = (W - PAD.left - PAD.right) / YEARS.length;
  const barW = groupW / (kpis.length + 1);

  return (
    <div className="admin-business-chart">
      <h2>Évolution 2027–2029</h2>
      <div className="admin-business-chart-legend">
        {kpis.map((r, i) => (
          <span key={r[0]}>
            <svg width="10" height="10" aria-hidden="true">
              <rect width="10" height="10" fill={COLORS[i]} rx="2" />
            </svg>
            {r[0]}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="admin-business-chart-svg" aria-hidden="true">
        {YEARS.map((yr, gi) => {
          const gx = PAD.left + gi * groupW;
          return (
            <g key={yr}>
              {kpis.map((kpi, ki) => {
                const val = parseNum(kpi[gi + 1]);
                if (val == null || val <= 0) return null;
                const barH = Math.max(2, (val / max) * chartH);
                const x = gx + (ki + 0.5) * barW;
                const y = PAD.top + chartH - barH;
                return (
                  <rect key={ki} x={x} y={y} width={barW - 2} height={barH} fill={COLORS[ki]} rx="2" />
                );
              })}
              <text
                x={gx + groupW / 2}
                y={H - 5}
                textAnchor="middle"
                fill="rgba(255,255,255,0.45)"
                fontSize={10}
              >
                {yr}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SheetTable({ title, sheetData }) {
  const rows = (sheetData || []).filter((r) => r?.length && r.some((c) => c != null && c !== ''));
  if (!rows.length) return null;
  const colCount = Math.max(...rows.map((r) => r.length));
  const [header, ...dataRows] = rows;

  return (
    <div className="admin-business-table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            {Array.from({ length: colCount }, (_, i) => (
              <th key={i}>{header?.[i] ?? ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: colCount }, (_, i) =>
                i === 0
                  ? <th key={i}>{row[i] ?? ''}</th>
                  : <td key={i}>{row[i] ?? ''}</td>,
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminBusinessPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isAdmin = isLocalDev || isAdminEmail(user?.email);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [stale, setStale] = useState(false);
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
        setStale(result.stale ?? false);
        if (result.data?.last_sync) setLastSync(new Date(result.data.last_sync));
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
      setStale(false);
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

  // Skip title/meta rows at the top of the Dashboard sheet (same as before)
  const yearIndex = ['2027', '2028', '2029'].indexOf(year) + 1;
  const dashRows = (data?.dashboard || [])
    .slice(5)
    .filter((row) => row?.[0] && row?.[yearIndex]);
  const highlights = dashRows.filter((row) =>
    [
      'Utilisateurs actifs mensuels moyens',
      "Chiffre d'affaires",
      'Résultat net',
      'Trésorerie de clôture',
      'Besoin de financement additionnel',
    ].includes(row[0]),
  );

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
          {stale && (
            <span className="admin-business-stale">
              <AlertTriangle size={13} strokeWidth={2} />
              Données périmées — synchronisez pour rafraîchir
            </span>
          )}
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
              <button
                key={option}
                type="button"
                className={year === option ? 'active' : ''}
                onClick={() => setYear(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <p className="admin-business-note">
            Données importées depuis le business plan Google Sheets.
          </p>

          <div className="admin-business-metrics">
            {highlights.map((row) => (
              <div className="admin-business-metric" key={row[0]}>
                <span>{row[0]}</span>
                <strong>{safeDisplayValue(row, yearIndex)}</strong>
              </div>
            ))}
          </div>

          <RevenueChart rows={dashRows} />

          <div className="admin-business-table-wrap">
            <h2>Comparaison 2027–2029</h2>
            <table>
              <thead>
                <tr>
                  <th>Indicateur</th>
                  <th>2027</th>
                  <th>2028</th>
                  <th>2029</th>
                </tr>
              </thead>
              <tbody>
                {dashRows.map((row) => (
                  <tr key={row[0]}>
                    <th>{row[0]}</th>
                    <td>{row[1] ?? '—'}</td>
                    <td>{row[2] ?? '—'}</td>
                    <td>{row[3] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SheetTable title="Coûts unitaires" sheetData={data.costs} />

          <SheetTable title="Trésorerie" sheetData={data.cashflow} />
        </div>
      )}

      {!loading && !error && !data && (
        <div className="admin-business-empty">
          <p>Pas encore de données synchronisées.</p>
          <p className="admin-business-empty-hint">
            Cliquez sur &ldquo;Sync Now&rdquo; pour importer les données depuis Google Sheets.
          </p>
        </div>
      )}
    </div>
  );
}
