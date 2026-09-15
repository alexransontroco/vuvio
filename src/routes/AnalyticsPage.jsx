import { ArrowUp, ArrowDown, Eye, Heart, Users, Radio, Activity, MapPin, Search, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/pages/analytics.css';

function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = typeof target === 'number' ? target : parseFloat(target) || 0;
    prev.current = to;
    if (from === to) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      const cur = from + (to - from) * eased;
      setDisplay(Number.isInteger(to) ? Math.round(cur) : parseFloat(cur.toFixed(1)));
      if (p < 1) requestAnimationFrame(tick);
      else setDisplay(to);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

function Skeleton() {
  return (
    <section className="analytics-screen">
      <header className="analytics-header">
        <div>
          <div className="skel skel--title" />
          <div className="skel skel--sub" />
        </div>
      </header>
      <section className="analytics-metrics">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card skel-card">
            <div className="skel skel--icon" />
            <div className="skel skel--label" />
            <div className="skel skel--value" />
          </div>
        ))}
      </section>
      <section className="analytics-section">
        <div className="skel skel--h2" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel skel--row" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </section>
    </section>
  );
}

function Sparkline({ data, color }) {
  if (!data?.length || data.every(v => v === 0)) return null;
  const W = 80, H = 28;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - 2 - ((v / max) * (H - 4));
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} ${pts.slice(1).map(p => `L${p}`).join(' ')} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function ActivityChart({ bars, prevBars, line, labels, barColor, lineColor, barLabel, lineLabel, timeRange }) {
  const hasPrev = prevBars?.some(v => v > 0);
  const maxBar = Math.max(...bars, ...(hasPrev ? prevBars : []), 1);
  const maxLine = Math.max(...line, 1);
  const n = bars.length;
  if (n === 0) return null;

  const showEvery = Math.ceil(n / 8);
  const prevLabel = timeRange === '1d' ? 'Previous 24h' : timeRange === '7d' ? 'Previous 7 days' : 'Previous 30 days';

  return (
    <div className="activity-chart">
      <div className="activity-chart__legend">
        <span style={{ color: barColor }}><span className="legend-dot" style={{ background: barColor }} />{barLabel}</span>
        {hasPrev && <span style={{ color: 'rgba(255,255,255,0.25)' }}><span className="legend-dot" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }} />{prevLabel}</span>}
        <span style={{ color: lineColor }}><span className="legend-dot" style={{ background: lineColor }} />{lineLabel}</span>
      </div>
      <div className="activity-chart__area">
        {bars.map((v, i) => (
          <div
            key={i}
            className="activity-chart__col"
            title={`${labels[i]} — Lives: ${v}${hasPrev ? ` (prev: ${prevBars[i]})` : ''}, Viewers: ${line[i]}`}
          >
            <div className="activity-chart__bar-wrap">
              {hasPrev && prevBars[i] > 0 && (
                <div
                  className="activity-chart__bar activity-chart__bar--prev"
                  style={{ height: `${(prevBars[i] / maxBar) * 100}%` }}
                />
              )}
              <div
                className="activity-chart__bar"
                style={{ height: `${(v / maxBar) * 100}%`, background: barColor }}
              />
              <div
                className="activity-chart__line-dot"
                style={{ bottom: `${(line[i] / maxLine) * 100}%`, background: lineColor }}
              />
            </div>
            {i % showEvery === 0 && (
              <span className="activity-chart__xlabel">{labels[i]}</span>
            )}
          </div>
        ))}
        <svg className="activity-chart__svg-line" preserveAspectRatio="none" viewBox={`0 0 ${n} 100`}>
          <polyline
            points={line.map((v, i) => `${i + 0.5},${100 - (v / maxLine) * 100}`).join(' ')}
            fill="none"
            stroke={lineColor}
            strokeWidth="0.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, format, trend, color, sparkData, pulse }) {
  const animated = useCountUp(value);
  const displayed = format ? format(animated) : animated.toLocaleString();
  const isPositive = trend > 0;
  return (
    <article className="stat-card" style={{ '--accent': color }}>
      <div className="stat-card__header">
        <div className={`stat-card__icon ${pulse ? 'stat-card__icon--pulse' : ''}`} style={{ color }}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className="stat-card__label">{label}</span>
        {pulse && <span className="stat-card__live-dot" />}
      </div>
      <div className="stat-card__body">
        <div>
          <div className="stat-card__value">{displayed}</div>
          {trend !== undefined && (
            <div className={`stat-card__trend ${isPositive ? 'is-positive' : 'is-negative'}`}>
              {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {sparkData && (
          <div className="stat-card__spark">
            <Sparkline data={sparkData} color={color} />
          </div>
        )}
      </div>
    </article>
  );
}

function BarCell({ value, max, color, formatted }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <td className="leaderboard-metric leaderboard-metric--bar">
      <span className="metric-value">{formatted ?? value}</span>
      <div className="metric-bar">
        <div className="metric-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </td>
  );
}

function StreamRow({ stream, rank, maxScore, maxViews }) {
  return (
    <tr className="leaderboard-row">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">{stream.title || stream.streamId}</td>
      <BarCell value={stream.impressions || 0} max={maxViews} color="var(--vuvio-pink)" />
      <BarCell value={stream.viewStarts || 0} max={maxViews} color="var(--vuvio-cyan)" />
      <td className="leaderboard-metric">{Math.round((stream.retention30sRate || 0) * 100) / 100}%</td>
      <td className="leaderboard-metric">{Math.round((stream.skipRate || 0) * 100) / 100}%</td>
      <td className="leaderboard-metric">{stream.averageWatchTimeSeconds || 0}s</td>
      <BarCell value={stream.engagementScore || 0} max={maxScore} color="#b47bff" formatted={Math.round((stream.engagementScore || 0) * 100) / 100} />
    </tr>
  );
}

function CreatorRow({ creator, rank, maxViews, isActive, onClick }) {
  return (
    <tr className={`leaderboard-row leaderboard-row--clickable ${isActive ? 'is-active' : ''}`} onClick={onClick} title="Filter Recent Lives">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">
        {creator.creatorName || creator.creatorId}
        {isActive && <span className="filter-badge">filtered</span>}
      </td>
      <BarCell value={creator.totalViews || 0} max={maxViews} color="var(--vuvio-blue)" />
      <td className="leaderboard-metric">{creator.uniqueViewers || 0}</td>
      <BarCell value={creator.engagementScore || 0} max={10} color="#b47bff" formatted={Math.round(creator.engagementScore * 100) / 100} />
    </tr>
  );
}

function CategoryRow({ category, rank, maxViews, isActive, onClick }) {
  return (
    <tr className={`leaderboard-row leaderboard-row--clickable ${isActive ? 'is-active' : ''}`} onClick={onClick} title="Filter Recent Lives">
      <td className="leaderboard-rank">{rank}</td>
      <td className="leaderboard-title">
        {category.category}
        {isActive && <span className="filter-badge">filtered</span>}
      </td>
      <BarCell value={category.totalViews || 0} max={maxViews} color="var(--vuvio-cyan)" />
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
  const d = timestampToDate(ts);
  if (!d) return '—';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timestampToDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts.toDate === 'function') {
    const d = ts.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.toMillis === 'function') {
    const d = new Date(ts.toMillis());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.seconds === 'number') {
    const d = new Date(ts.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts._seconds === 'number') {
    const d = new Date(ts._seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'string' && ts.trim()) {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getLiveDate(live) {
  const candidates = [
    live.startedAt,
    live.liveStartedAt,
    live.actualStartTime,
    live.createdAt,
    live.scheduledStartAt,
    live.scheduledStartTime,
    live.updatedAt,
    live.endedAt,
  ];
  const validDate = candidates.find((candidate) => timestampToDate(candidate));
  if (validDate) return validDate;
  const fromId = String(live.id ?? '').match(/^created-(\d+)$/)?.[1];
  return fromId ? Number(fromId) : null;
}

function LiveRow({ live }) {
  const isLive = live.status === 'live';
  const startedLabel = formatTs(getLiveDate(live));
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
        <small className="recent-live-date">Started {startedLabel}</small>
      </td>
      <td className="leaderboard-metric">{live.creatorName || live.creatorUid?.slice(0, 8) || '—'}</td>
      <td className="leaderboard-metric">
        {live.city ? <><MapPin size={10} style={{ opacity: 0.5, marginRight: 3 }} />{live.city}</> : '—'}
        {live.family ? <small style={{ opacity: 0.4, marginLeft: 4 }}>{live.family}</small> : null}
      </td>
      <td className="leaderboard-metric">{live.currentViewerCount ?? live.viewers ?? '—'}</td>
      <td className="leaderboard-metric">{formatDuration(durationSeconds)}</td>
      <td className="leaderboard-metric leaderboard-metric--date">{startedLabel}</td>
    </tr>
  );
}

function getTimeConfig(range) {
  const now = Date.now();
  if (range === '1d') {
    return {
      buckets: 24,
      msPerBucket: 3600000,
      start: new Date(now - 24 * 3600000),
      labelFn: (i) => `${i}h`,
    };
  }
  if (range === '7d') {
    return {
      buckets: 7,
      msPerBucket: 86400000,
      start: new Date(now - 7 * 86400000),
      labelFn: (i) => {
        const d = new Date(now - (6 - i) * 86400000);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      },
    };
  }
  return {
    buckets: 30,
    msPerBucket: 86400000,
    start: new Date(now - 30 * 86400000),
    labelFn: (i) => {
      const d = new Date(now - (29 - i) * 86400000);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    },
  };
}

function getLiveTs(live) {
  return timestampToDate(getLiveDate(live))?.getTime() ?? null;
}

function computeTrend(current, previous) {
  if (!previous) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

function computeSeries(lives, startMs, buckets, msPerBucket, labelFn) {
  const livesBuckets = new Array(buckets).fill(0);
  const viewsBuckets = new Array(buckets).fill(0);

  lives.forEach(live => {
    const ts = getLiveTs(live);
    if (ts === null) return;
    const idx = Math.floor((ts - startMs) / msPerBucket);
    if (idx >= 0 && idx < buckets) {
      livesBuckets[idx]++;
      viewsBuckets[idx] += live.currentViewerCount || live.viewers || 0;
    }
  });

  const labels = labelFn ? Array.from({ length: buckets }, (_, i) => labelFn(i)) : [];
  return { livesBuckets, viewsBuckets, labels };
}

export default function AnalyticsPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  const isLocalDev = import.meta.env.DEV || isLocalHost;
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
    livesTrend: undefined,
    viewsTrend: undefined,
    dailyLives: [],
    dailyViews: [],
    prevDailyLives: [],
    chartLabels: [],
  });
  const [timeRange, setTimeRange] = useState('7d');
  const [activeFilter, setActiveFilter] = useState(null); // { type: 'creator'|'category', value: string }
  const [liveSearch, setLiveSearch] = useState('');

  useEffect(() => {
    if (authLoading && !isLocalDev) return;
    if (!user && !isLocalDev) {
      navigate('/login', { replace: true });
      return;
    }
    const isAdmin = isLocalDev || user?.email?.endsWith('@vuvio.app') || user?.email === 'alexandre.ranson@gmail.com';
    if (!isAdmin) {
      navigate('/watch', { replace: true });
      return;
    }
    loadAnalytics();
  }, [user, authLoading, timeRange, isLocalDev]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const safe = (p) => p.catch(e => { console.warn('[Analytics]', e.message); return null; });
      const timeConfig = getTimeConfig(timeRange);

      const [streamsSnap, creatorsSnap, categoriesSnap, usersCount, allLivesSnap] = await Promise.all([
        safe(getDocs(query(collection(db, 'streamStats'), orderBy('engagementScore', 'desc'), limit(10)))),
        safe(getDocs(query(collection(db, 'creatorStats'), orderBy('totalViews', 'desc'), limit(10)))),
        safe(getDocs(query(collection(db, 'categoryStats'), orderBy('totalViews', 'desc'), limit(10)))),
        safe(getCountFromServer(collection(db, 'users'))),
        safe(getDocs(query(collection(db, 'activeLives'), orderBy('createdAt', 'desc'), limit(400)))),
      ]);

      const topStreams = streamsSnap?.docs.map(d => d.data()) ?? [];
      const topCreators = creatorsSnap?.docs.map(d => d.data()) ?? [];
      const topCategories = categoriesSnap?.docs.map(d => d.data()) ?? [];
      const allLives = allLivesSnap?.docs.map(d => d.data()) ?? [];
      const rawLives = allLives.slice(0, 30);

      const periodMs = timeConfig.buckets * timeConfig.msPerBucket;
      const startMs = timeConfig.start.getTime();
      const prevStartMs = startMs - periodMs;

      const currentPeriodLives = allLives.filter(l => { const ts = getLiveTs(l); return ts !== null && ts >= startMs; });
      const prevPeriodLives = allLives.filter(l => { const ts = getLiveTs(l); return ts !== null && ts >= prevStartMs && ts < startMs; });

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

      const currentViewers = currentPeriodLives.reduce((s, l) => s + (l.currentViewerCount || l.viewers || 0), 0);
      const prevViewers = prevPeriodLives.reduce((s, l) => s + (l.currentViewerCount || l.viewers || 0), 0);
      const livesTrend = computeTrend(currentPeriodLives.length, prevPeriodLives.length);
      const viewsTrend = computeTrend(currentViewers, prevViewers);

      const { livesBuckets, viewsBuckets, labels } = computeSeries(currentPeriodLives, startMs, timeConfig.buckets, timeConfig.msPerBucket, timeConfig.labelFn);
      const { livesBuckets: prevLivesBuckets } = computeSeries(prevPeriodLives, prevStartMs, timeConfig.buckets, timeConfig.msPerBucket);

      setStats({
        topStreams,
        topCreators,
        topCategories,
        recentLives,
        totalViews,
        totalEvents: topStreams.reduce((sum, s) => sum + (s.impressions || 0), 0),
        activeStreams: topStreams.filter(s => s.status === 'live').length,
        totalUsers: usersCount?.data().count ?? 0,
        liveNow,
        livesTrend,
        viewsTrend,
        dailyLives: livesBuckets,
        dailyViews: viewsBuckets,
        prevDailyLives: prevLivesBuckets,
        chartLabels: labels,
      });
    } catch (error) {
      console.error('[Analytics] Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user && !isLocalDev) {
    return (
      <section className="analytics-screen">
        <div className="analytics-loading">
          <p>Loading analytics...</p>
        </div>
      </section>
    );
  }

  if (loading) return <Skeleton />;

  return (
    <section className="analytics-screen">
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
          value={stats.totalViews}
          trend={stats.viewsTrend}
          color="var(--vuvio-cyan)"
          sparkData={stats.dailyViews}
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          color="var(--vuvio-blue)"
        />
        <StatCard
          icon={Radio}
          label="Live Now"
          value={stats.liveNow}
          trend={stats.livesTrend}
          color="var(--vuvio-orange)"
          sparkData={stats.dailyLives}
          pulse={stats.liveNow > 0}
        />
        <StatCard
          icon={Activity}
          label="Impressions"
          value={stats.totalEvents}
          color="var(--vuvio-pink)"
        />
        <StatCard
          icon={Heart}
          label="Engagement Avg"
          value={
            stats.topStreams.length > 0
              ? stats.topStreams.reduce((sum, s) => sum + (s.engagementScore || 0), 0) / stats.topStreams.length
              : 0
          }
          format={v => v.toFixed(1)}
          color="#b47bff"
        />
      </section>

      {stats.dailyLives.some(v => v > 0) && (
        <section className="analytics-section analytics-section--chart">
          <h2>Activity</h2>
          <ActivityChart
            bars={stats.dailyLives}
            prevBars={stats.prevDailyLives}
            line={stats.dailyViews}
            labels={stats.chartLabels}
            barColor="var(--vuvio-cyan)"
            lineColor="#b47bff"
            barLabel="Lives started"
            lineLabel="Peak viewers"
            timeRange={timeRange}
          />
        </section>
      )}

      {(() => {
        const maxScore = Math.max(...stats.topStreams.map(s => s.engagementScore || 0), 1);
        const maxStreamViews = Math.max(...stats.topStreams.map(s => s.impressions || 0), 1);
        return (
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
                  <StreamRow key={stream.streamId} stream={stream} rank={i + 1} maxScore={maxScore} maxViews={maxStreamViews} />
                ))}
              </tbody>
            </table>
          </section>
        );
      })()}

      {(() => {
        const maxCreatorViews = Math.max(...stats.topCreators.map(c => c.totalViews || 0), 1);
        const toggleCreator = (name) =>
          setActiveFilter(f => f?.type === 'creator' && f.value === name ? null : { type: 'creator', value: name });
        return (
          <section className="analytics-section">
            <h2>Top Creators <small className="section-hint">Click to filter lives</small></h2>
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
                  <CreatorRow
                    key={creator.creatorId}
                    creator={creator}
                    rank={i + 1}
                    maxViews={maxCreatorViews}
                    isActive={activeFilter?.type === 'creator' && activeFilter.value === (creator.creatorName || creator.creatorId)}
                    onClick={() => toggleCreator(creator.creatorName || creator.creatorId)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })()}

      {(() => {
        const maxCatViews = Math.max(...stats.topCategories.map(c => c.totalViews || 0), 1);
        const toggleCategory = (cat) =>
          setActiveFilter(f => f?.type === 'category' && f.value === cat ? null : { type: 'category', value: cat });
        return (
          <section className="analytics-section">
            <h2>Category Trends <small className="section-hint">Click to filter lives</small></h2>
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
                  <CategoryRow
                    key={category.category}
                    category={category}
                    rank={i + 1}
                    maxViews={maxCatViews}
                    isActive={activeFilter?.type === 'category' && activeFilter.value === category.category}
                    onClick={() => toggleCategory(category.category)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })()}

      {(() => {
        const q = liveSearch.trim().toLowerCase();
        const filteredLives = stats.recentLives
          .filter(live => {
            if (!activeFilter) return true;
            if (activeFilter.type === 'creator') return (live.creatorName || live.creatorUid?.slice(0, 8)) === activeFilter.value;
            if (activeFilter.type === 'category') return live.family === activeFilter.value || live.subcategory === activeFilter.value || live.category === activeFilter.value;
            return true;
          })
          .filter(live => {
            if (!q) return true;
            return (
              (live.title || '').toLowerCase().includes(q) ||
              (live.experienceTitle || '').toLowerCase().includes(q) ||
              (live.creatorName || '').toLowerCase().includes(q) ||
              (live.city || '').toLowerCase().includes(q) ||
              (live.subcategory || '').toLowerCase().includes(q)
            );
          });

        return (
          <section className="analytics-section">
            <div className="section-header">
              <h2>
                Recent Lives <small style={{ fontWeight: 400, opacity: 0.5, fontSize: '0.75em' }}>({filteredLives.length})</small>
              </h2>
              <div className="lives-controls">
                {activeFilter && (
                  <button className="filter-clear" onClick={() => setActiveFilter(null)}>
                    ✕ {activeFilter.value}
                  </button>
                )}
                <div className="lives-search">
                  <Search size={13} />
                  <input
                    type="text"
                    placeholder="Search title, creator, city…"
                    value={liveSearch}
                    onChange={e => setLiveSearch(e.target.value)}
                    className="lives-search__input"
                  />
                  {liveSearch && (
                    <button className="lives-search__clear" onClick={() => setLiveSearch('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {filteredLives.length === 0 ? (
              <p style={{ opacity: 0.4, padding: '16px 0' }}>No lives found.</p>
            ) : (
              <div className="leaderboard-scroll">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Title</th>
                      <th>Creator</th>
                      <th>Location</th>
                      <th>Viewers</th>
                      <th>Duration</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLives.map((live, i) => (
                      <LiveRow key={live.id || i} live={live} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

      <footer className="analytics-footer">
        <p>Data updates every 5 minutes. Last updated: {new Date().toLocaleTimeString()}</p>
      </footer>
    </section>
  );
}
