import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase.js';
import '../styles/pages/admin-docs.css';

async function waitlistRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required');
  const response = await fetch(`/api/waitlist/admin${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...options.headers },
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'Admin access required' : 'Request failed');
  return response;
}

export default function AdminWaitlistPage() {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextCursor = null) => {
    setLoading(true);
    setError('');
    try {
      const suffix = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : '';
      const result = await (await waitlistRequest(suffix)).json();
      setData(result);
      setEntries((current) => nextCursor ? [...current, ...result.entries] : result.entries);
      setCursor(result.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (entry) => {
    if (!window.confirm(`Remove ${entry.email} from the launch waitlist?`)) return;
    setError('');
    try {
      await waitlistRequest(`/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setData((current) => current && { ...current, total: Math.max(0, current.total - 1) });
    } catch (e) {
      setError(e.message);
    }
  };

  const exportCsv = async () => {
    setError('');
    try {
      const response = await waitlistRequest('/export');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vuvio-launch-waitlist.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="admin-docs" aria-label="Launch Waitlist">
      <header className="admin-docs-hero">
        <div className="admin-docs-hero__copy">
          <p>VUVIO ADMIN</p>
          <h1>Launch Waitlist</h1>
          <p>Private launch notifications · consent version launch-v1</p>
        </div>
        <div className="admin-docs-hero__side">
          <div className="admin-docs-actions">
            <Link to="/admin/docs">Docs</Link>
            <Link to="/admin/marketing">Marketing</Link>
            <Link to="/admin/waitlist" className="is-active">Waitlist</Link>
            <button type="button" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
      </header>
      <main className="admin-docs-dashboard">
        {error && <p role="alert">{error}</p>}
        <section className="admin-docs-metrics" aria-label="Waitlist metrics">
          {[
            ['Active subscriptions', data?.total],
            ['Last 7 days', data?.last7Days],
            ['Last 30 days', data?.last30Days],
          ].map(([label, value]) => (
            <article className="admin-docs-metric" key={label}>
              <span>{label}</span>
              <strong>{value ?? '—'}</strong>
            </article>
          ))}
        </section>
        <section className="admin-docs-panel">
          <h2>Subscriptions</h2>
          <div className="admin-waitlist-table-wrap">
            <table className="admin-waitlist-table">
              <thead><tr><th>Email</th><th>Joined</th><th>Language</th><th>Source</th><th>Action</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.email}</td>
                    <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</td>
                    <td>{entry.locale?.toUpperCase()}</td>
                    <td>{entry.source}</td>
                    <td><button type="button" onClick={() => remove(entry)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p role="status">Loading…</p>}
          {!loading && entries.length === 0 && <p>No subscriptions yet.</p>}
          {cursor && <button type="button" onClick={() => load(cursor)} disabled={loading}>Load more</button>}
        </section>
      </main>
    </section>
  );
}
