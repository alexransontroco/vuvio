import { ArrowUp, ArrowDown, Eye, Heart, Users, Radio, Activity, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, where, getDocs, getDoc, doc, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/pages/analytics.css';

function StatCard({ icon: Icon, label, value, trend, color }) {
  const isPositive = trend > 0;
  return (
    <article className="stat-card" style={{ '--accent': color }}>
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ color }}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className="stat-card__label">{label}</span>
      </div>
      <div className="stat-card__value">{value}</div>
      {trend !== undefined && (
        <div className={`stat-card__trend ${isPositive ? 'is-positive' : 'is-negative'}`}>
          {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </article>
  );
}

function StreamRow({ stream, rank }) {
  return (
    <tr className="leaderboard-row">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">{stream.title || stream.streamId}</td>
      <td className="leaderboard-metric">{stream.impressions || 0}</td>
      <td className="leaderboard-metric">{stream.viewStarts || 0}</td>
      <td className="leaderboard-metric">{Math.round((stream.retention30sRate || 0) * 100) / 100}%</td>
      <td className="leaderboard-metric">{Math.round((stream.skipRate || 0) * 100) / 100}%</td>
      <td className="leaderboard-metric">{stream.averageWatchTimeSeconds || 0}s</td>
      <td className="leaderboard-metric">{Math.round((stream.engagementScore || 0) * 100) / 100}</td>
    </tr>
  );
}

function CreatorRow({ creator, rank }) {
  return (
    <tr className="leaderboard-row">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">{creator.creatorName || creator.creatorId}</td>
      <td className="leaderboard-metric">{creator.totalViews || 0}</td>
      <td className="leaderboard-metric">{creator.uniqueViewers || 0}</td>
      <td className="leaderboard-metric">{Math.round(creator.engagementScore * 100) / 100}</td>
    </tr>
  );
}

function CategoryRow({ category, rank }) {
  return (
    <tr className="leaderboard-row">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">{category.category}</td>
      <td className="leaderboard-metric">{category.totalViews || 0}</td>
      <td className="leaderboard-metric">{category.activeStreams || 0}</td>
      <td className="leaderboard-metric">{category.averageViewsPerStream || 0}</td>
    </tr>
  );
}

function formatDuration(seconds) {
  if (!seconds || seconds < 1) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function LiveRow({ live }) {
  const isLive = live.status === 'live';
  const durationSeconds = live.durationSeconds
    || (live.endedAt && live.createdAt
      ? Math.round((live.endedAt.toDate?.() - live.createdAt.toDate?.()) / 1000)
      : null);

  return (
    <tr className="leaderboard-row">
      <td className="leaderboard-metric">
        <span className={`analytics-status-badge ${isLive ? 'is-live' : 'is-ended'}`}>
          {isLive ? '● LIVE' : 'Ended'}
        </span>
      </td>
      <td className="leaderboard-title">
        <span>{live.title || live.experienceTitle || live.subcategory || '—'}</span>
        {live.subcategory ? <small style={{ opacity: 0.5, marginLeft: 6 }}>{live.subcategory}</small> : null}
      </td>
      <td className="leaderboard-metric">{live.creatorName || live.creatorUid?.slice(0, 8) || '—'}</td>
      <td className="leaderboard-metric">
        {live.city ? <><MapPin size={10} style={{ opacity: 0.5, marginRight: 3 }} />{live.city}</> : '—'}
        {live.family ? <small style={{ opacity: 0.4, marginLeft: 4 }}>{live.family}</small> : null}
      </td>
      <td className="leaderboard-metric">{live.currentViewerCount ?? live.viewers ?? '—'}</td>
      <td className="leaderboard-metric">{formatDuration(durationSeconds)}</td>
      <td className="leaderboard-metric">{formatTs(live.createdAt)}</td>
    </tr>
  );
}

export default function AnalyticsPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    topStreams: [],
    topCreators: [],
    topCategories: [],
    recentLives: [],
    totalViews: 0,
    totalEvents: 0,
    activeStreams: 0,
    totalUsers: 0,
    liveNow: 0,
  });
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const isAdmin = user.email?.endsWith('@vuvio.app') || user.email === 'alexandre.ranson@gmail.com';
    if (!isAdmin) {
      navigate('/watch', { replace: true });
      return;
    }
    loadAnalytics();
  }, [user, authLoading, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const [streamsSnap, creatorsSnap, categoriesSnap, usersCount, recentLivesSnap] = await Promise.all([
        getDocs(query(collection(db, 'streamStats'), orderBy('engagementScore', 'desc'), limit(10))),
        getDocs(query(collection(db, 'creatorStats'), orderBy('totalViews', 'desc'), limit(10))),
        getDocs(query(collection(db, 'categoryStats'), orderBy('totalViews', 'desc'), limit(10))),
        getCountFromServer(collection(db, 'users')),
        getDocs(query(collection(db, 'activeLives'), orderBy('createdAt', 'desc'), limit(30))),
      ]);

      const topStreams = streamsSnap.docs.map(d => d.data());
      const topCreators = creatorsSnap.docs.map(d => d.data());
      const topCategories = categoriesSnap.docs.map(d => d.data());
      const rawLives = recentLivesSnap.docs.map(d => d.data());

      // Fetch creator display names for lives that don't have creatorName
      const uidsToFetch = [...new Set(
        rawLives.filter(l => !l.creatorName && l.creatorUid).map(l => l.creatorUid)
      )];
      const creatorNameMap = {};
      await Promise.all(uidsToFetch.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const d = snap.data();
            creatorNameMap[uid] = d.displayName || d.username || uid.slice(0, 8);
          }
        } catch { /* ignore */ }
      }));

      const recentLives = rawLives.map(l => ({
        ...l,
        creatorName: l.creatorName || creatorNameMap[l.creatorUid] || l.creatorUid?.slice(0, 8),
      }));

      const liveNow = rawLives.filter(l => l.status === 'live').length;
      let totalViews = 0;
      topStreams.forEach(s => { totalViews += s.viewStarts || 0; });

      setStats({
        topStreams,
        topCreators,
        topCategories,
        recentLives,
        totalViews,
        totalEvents: topStreams.reduce((sum, s) => sum + (s.impressions || 0), 0),
        activeStreams: topStreams.filter(s => s.status === 'live').length,
        totalUsers: usersCount.data().count,
        liveNow,
      });
    } catch (error) {
      console.error('[Analytics] Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <section className="screen analytics-screen">
        <div className="analytics-loading">
          <p>Loading analytics...</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="screen analytics-screen">
        <div className="analytics-loading">
          <p>Fetching data...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen analytics-screen">
      <header className="analytics-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Real-time metrics and insights</p>
        </div>
        <div className="analytics-controls">
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="analytics-select">
            <option value="1d">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <button type="button" onClick={loadAnalytics} className="analytics-refresh">
            <span>↻</span> Refresh
          </button>
        </div>
      </header>

      <section className="analytics-metrics">
        <StatCard
          icon={Eye}
          label="Total Views"
          value={stats.totalViews.toLocaleString()}
          color="var(--vuvio-cyan)"
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          color="var(--vuvio-blue)"
        />
        <StatCard
          icon={Radio}
          label="Live Now"
          value={stats.liveNow}
          color="var(--vuvio-orange)"
        />
        <StatCard
          icon={Activity}
          label="Impressions"
          value={stats.totalEvents.toLocaleString()}
          color="var(--vuvio-pink)"
        />
        <StatCard
          icon={Heart}
          label="Engagement Avg"
          value={
            stats.topStreams.length > 0
              ? (
                  stats.topStreams.reduce((sum, s) => sum + (s.engagementScore || 0), 0) /
                  stats.topStreams.length
                ).toFixed(1)
              : '0'
          }
          color="#b47bff"
        />
      </section>

      <section className="analytics-section">
        <h2>Top Streams</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="leaderboard-rank">#</th>
              <th>Stream</th>
              <th>Impressions</th>
              <th>Views</th>
              <th>30s Rate</th>
              <th>Skip Rate</th>
              <th>Avg Watch</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {stats.topStreams.map((stream, i) => (
              <StreamRow key={stream.streamId} stream={stream} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </section>

      <section className="analytics-section">
        <h2>Top Creators</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="leaderboard-rank">#</th>
              <th>Creator</th>
              <th>Views</th>
              <th>Unique</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {stats.topCreators.map((creator, i) => (
              <CreatorRow key={creator.creatorId} creator={creator} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </section>

      <section className="analytics-section">
        <h2>Category Trends</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="leaderboard-rank">#</th>
              <th>Category</th>
              <th>Views</th>
              <th>Active</th>
              <th>Avg Views</th>
            </tr>
          </thead>
          <tbody>
            {stats.topCategories.map((category, i) => (
              <CategoryRow key={category.category} category={category} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </section>

      <section className="analytics-section">
        <h2>Recent Lives <small style={{ fontWeight: 400, opacity: 0.5, fontSize: '0.75em' }}>({stats.recentLives.length})</small></h2>
        {stats.recentLives.length === 0 ? (
          <p style={{ opacity: 0.4, padding: '16px 0' }}>No lives found.</p>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Title</th>
                <th>Creator</th>
                <th>Location</th>
                <th>Viewers</th>
                <th>Duration</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLives.map((live, i) => (
                <LiveRow key={live.id || i} live={live} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="analytics-footer">
        <p>Data updates every 5 minutes. Last updated: {new Date().toLocaleTimeString()}</p>
      </footer>
    </section>
  );
}
