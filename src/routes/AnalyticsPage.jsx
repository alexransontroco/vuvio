import { ArrowUp, ArrowDown, Eye, Heart, Share2, Users, TrendingUp, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
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
      <td className="leaderboard-metric">{stream.viewStarts || 0}</td>
      <td className="leaderboard-metric">{Math.round((stream.retention30sRate || 0) * 100) / 100}%</td>
      <td className="leaderboard-metric">{Math.round(stream.engagementScore * 100) / 100}</td>
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

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    topStreams: [],
    topCreators: [],
    topCategories: [],
    totalViews: 0,
    totalEvents: 0,
    activeStreams: 0,
  });
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    // Redirect if not admin
    if (user && !user.email?.endsWith('@vuvio.app')) {
      window.location.href = '/';
      return;
    }

    loadAnalytics();
  }, [user, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Load top streams
      const streamsQ = query(
        collection(db, 'streamStats'),
        orderBy('engagementScore', 'desc'),
        limit(10)
      );
      const streamsSnap = await getDocs(streamsQ);
      const topStreams = streamsSnap.docs.map(doc => doc.data());

      // Load top creators
      const creatorsQ = query(
        collection(db, 'creatorStats'),
        orderBy('totalViews', 'desc'),
        limit(10)
      );
      const creatorsSnap = await getDocs(creatorsQ);
      const topCreators = creatorsSnap.docs.map(doc => doc.data());

      // Load top categories
      const categoriesQ = query(
        collection(db, 'categoryStats'),
        orderBy('totalViews', 'desc'),
        limit(10)
      );
      const categoriesSnap = await getDocs(categoriesQ);
      const topCategories = categoriesSnap.docs.map(doc => doc.data());

      // Calculate totals
      let totalViews = 0;
      let activeStreams = 0;
      topStreams.forEach(stream => {
        totalViews += stream.viewStarts || 0;
        if (stream.status === 'live') activeStreams += 1;
      });

      setStats({
        topStreams,
        topCreators,
        topCategories,
        totalViews,
        totalEvents: topStreams.reduce((sum, s) => sum + (s.impressions || 0), 0),
        activeStreams,
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
          label="Total Events"
          value={stats.totalEvents.toLocaleString()}
          color="var(--vuvio-blue)"
        />
        <StatCard
          icon={TrendingUp}
          label="Active Streams"
          value={stats.activeStreams}
          color="var(--vuvio-orange)"
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
          color="var(--vuvio-pink)"
        />
      </section>

      <section className="analytics-section">
        <h2>Top Streams</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="leaderboard-rank">#</th>
              <th>Stream</th>
              <th>Views</th>
              <th>30s Rate</th>
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

      <footer className="analytics-footer">
        <p>Data updates every 5 minutes. Last updated: {new Date().toLocaleTimeString()}</p>
      </footer>
    </section>
  );
}
