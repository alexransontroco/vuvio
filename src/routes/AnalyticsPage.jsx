import { ArrowUp, ArrowDown, Eye, Heart, Users, Radio, Activity, MapPin, Search, X, Globe, TrendingUp, Clock } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, getDoc, doc, getCountFromServer, where, Timestamp } from 'firebase/firestore';
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

function StatCard({ icon: Icon, label, value, format, trend, color, sparkData, pulse, onClick }) {
  const animated = useCountUp(value);
  const displayed = format ? format(animated) : animated.toLocaleString();
  const isPositive = trend > 0;
  const clickable = typeof onClick === 'function';

  const inner = (
    <>
      <div className="stat-card__header">
        <div className={`stat-card__icon ${pulse ? 'stat-card__icon--pulse' : ''}`} style={{ color }}>
          <Icon size={20} strokeWidth={1.8} />
        </div>
        <span className="stat-card__label">{label}</span>
        {pulse && <span className="stat-card__live-dot" />}
        {clickable && <span className="stat-card__chevron" aria-hidden="true">›</span>}
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
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="stat-card stat-card--clickable"
        style={{ '--accent': color }}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <article className="stat-card" style={{ '--accent': color }}>
      {inner}
    </article>
  );
}

function fmtTs(ts) {
  const d = ts?.toDate?.() ?? (ts?._seconds ? new Date(ts._seconds * 1000) : ts instanceof Date ? ts : null);
  if (!d) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function flagEmoji(code) {
  if (!code) return null;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function VisitorsDetailModal({ title, rows, kind, onClose, emptyHint }) {
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="visitors-modal__backdrop" onClick={onClose}>
      <div className="visitors-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="visitors-modal__header">
          <div>
            <h2>{title}</h2>
            <p className="visitors-modal__count">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          <button type="button" className="visitors-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="visitors-modal__body">
          {rows.length === 0 ? (
            <p className="visitors-modal__empty">{emptyHint || 'No entries to display.'}</p>
          ) : kind === 'users' ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id || u.uid} className="leaderboard-row">
                    <td className="leaderboard-title">{u.displayName || '—'}</td>
                    <td className="leaderboard-metric">{u.username ? `@${u.username}` : '—'}</td>
                    <td className="leaderboard-metric" style={{ opacity: 0.7 }}>{u.email || '—'}</td>
                    <td className="leaderboard-metric">{fmtTs(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Location</th>
                  <th>First seen</th>
                  <th>Last seen</th>
                  <th>Sessions</th>
                  <th>Type</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const isNew = v.firstSeenDate === v.lastSeenDate;
                  const flag = flagEmoji(v.countryCode);
                  return (
                    <tr key={v.anonymousId} className="leaderboard-row">
                      <td className="leaderboard-metric" style={{ fontFamily: 'monospace', opacity: 0.6 }}>{v.anonymousId?.slice(0, 8)}</td>
                      <td className="leaderboard-metric">
                        {flag ? <span title={v.country}>{flag} {v.city || v.country || '—'}</span> : <span style={{ opacity: 0.35 }}>—</span>}
                      </td>
                      <td className="leaderboard-metric">{fmtTs(v.firstSeenAt)}</td>
                      <td className="leaderboard-metric">{fmtTs(v.lastSeenAt)}</td>
                      <td className="leaderboard-metric">{v.totalSessions ?? 1}</td>
                      <td className="leaderboard-metric">
                        <span style={{ color: isNew ? 'var(--vuvio-cyan)' : '#b47bff', fontSize: '0.75rem' }}>
                          {isNew ? 'new' : 'returning'}
                        </span>
                      </td>
                      <td className="leaderboard-metric">
                        {v.userId
                          ? <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>✓ signed up</span>
                          : <span style={{ opacity: 0.35, fontSize: '0.75rem' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
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
    periodStartDate: null,
    // Website stats
    website: null,
  });
  const [timeRange, setTimeRange] = useState('7d');
  const [envFilter, setEnvFilter] = useState('production');
  const [activeFilter, setActiveFilter] = useState(null); // { type: 'creator'|'category', value: string }
  const [liveSearch, setLiveSearch] = useState('');
  const [detailModal, setDetailModal] = useState(null); // { kind: 'visitors'|'users', type, title }
  const [modalUsers, setModalUsers] = useState({}); // cache by key
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (authLoading && !isLocalDev) return;
    if (!user && !isLocalDev) {
      navigate('/login', { replace: true });
      return;
    }
    const isAdmin = isLocalDev || user?.email?.endsWith('@vuvio.app') || user?.email === 'alexandre.ranson@gmail.com' || user?.email === 'doug.benchetrit@gmail.com' || user?.email === 'cecilia.ranson@outlook.com';
    if (!isAdmin) {
      navigate('/watch', { replace: true });
      return;
    }
    loadAnalytics();
  }, [user, authLoading, timeRange, envFilter, isLocalDev]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const safe = (p) => p.catch(e => { console.warn('[Analytics]', e.message); return null; });
      const timeConfig = getTimeConfig(timeRange);

      // Build date keys for the selected period
      const dateKeys = [];
      const buckets = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30;
      for (let i = 0; i < buckets; i++) {
        const d = new Date(Date.now() - i * 86400000);
        dateKeys.push(d.toISOString().slice(0, 10));
      }
      const periodStartDate = dateKeys[dateKeys.length - 1]; // oldest date key

      const [streamsSnap, creatorsSnap, categoriesSnap, usersCount, allLivesSnap,
             uniqueVisitorsCount, newVisitorsCount, ...websiteDocs] = await Promise.all([
        safe(getDocs(query(collection(db, 'streamStats'), orderBy('engagementScore', 'desc'), limit(10)))),
        safe(getDocs(query(collection(db, 'creatorStats'), orderBy('totalViews', 'desc'), limit(10)))),
        safe(getDocs(query(collection(db, 'categoryStats'), orderBy('totalViews', 'desc'), limit(10)))),
        safe(getCountFromServer(collection(db, 'users'))),
        safe(getDocs(query(collection(db, 'activeLives'), orderBy('createdAt', 'desc'), limit(400)))),
        // Unique visitors = distinct anonymousIds with a session in the period
        safe(getCountFromServer(query(collection(db, 'visitorActivity'), where('lastSeenDate', '>=', periodStartDate)))),
        // New visitors = visitors whose first visit is in the period
        safe(getCountFromServer(query(collection(db, 'visitorActivity'), where('firstSeenDate', '>=', periodStartDate)))),
        ...dateKeys.map(k => safe(getDoc(doc(db, 'websiteStats', k)))),
      ]);

      // Recent visitor activity list
      const recentVisitorsSnap = await safe(getDocs(
        query(collection(db, 'visitorActivity'), orderBy('lastSeenAt', 'desc'), limit(30))
      ));
      const recentVisitors = recentVisitorsSnap?.docs.map(d => d.data()) ?? [];

      // Accurate unique visitor counts from visitorActivity collection
      const uniqueVisitors = uniqueVisitorsCount?.data().count ?? 0;
      const newVisitors = newVisitorsCount?.data().count ?? 0;
      const returningVisitors = Math.max(0, uniqueVisitors - newVisitors);

      // Aggregate websiteStats across the period
      const envSuffix = envFilter === 'production' ? '_prod' : envFilter === 'development' ? '_dev' : '';
      const website = {
        pageViews: 0, sessions: 0, signups: 0, logins: 0,
        uniqueVisitors, newVisitors, returningVisitors,
        sources: {}, pages: {}, devices: {}, countries: {},
        recentVisitors,
        totalSessionDurationSeconds: 0,
        sessionEndCount: 0,
        avgSessionDurationSeconds: 0,
        // Sparkline series (oldest → newest, matching dateKeys reversed)
        sparkUniqueVisitors: [],
        sparkNewVisitors: [],
        sparkPageViews: [],
        sparkSessions: [],
      };
      // websiteDocs are ordered newest-first (dateKeys[0] = today), reverse for sparklines
      const websiteDocsChron = [...websiteDocs].reverse();
      for (const snap of websiteDocsChron) {
        const d = snap?.exists() ? snap.data() : {};
        website.sparkUniqueVisitors.push((envSuffix ? d[`uniqueVisitors${envSuffix}`] : d.uniqueVisitors) || 0);
        website.sparkNewVisitors.push((envSuffix ? d[`newVisitors${envSuffix}`] : d.newVisitors) || 0);
        website.sparkPageViews.push((envSuffix ? d[`pageViews${envSuffix}`] : d.pageViews) || 0);
        website.sparkSessions.push((envSuffix ? d[`sessions${envSuffix}`] : d.sessions) || 0);
      }
      for (const snap of websiteDocs) {
        if (!snap?.exists()) continue;
        const d = snap.data();
        website.pageViews += (envSuffix ? d[`pageViews${envSuffix}`] : d.pageViews) || 0;
        website.sessions += (envSuffix ? d[`sessions${envSuffix}`] : d.sessions) || 0;
        website.signups += (envSuffix ? d[`signups${envSuffix}`] : d.signups) || 0;
        website.logins += (envSuffix ? d[`logins${envSuffix}`] : d.logins) || 0;
        website.totalSessionDurationSeconds += (envSuffix ? d[`totalSessionDurationSeconds${envSuffix}`] : d.totalSessionDurationSeconds) || 0;
        website.sessionEndCount += (envSuffix ? d[`sessionEndCount${envSuffix}`] : d.sessionEndCount) || 0;
        // Aggregate sources (always show all, not filtered by env for sources)
        for (const [k, v] of Object.entries(d)) {
          if (k.startsWith('source_') && typeof v === 'number') {
            const src = k.replace('source_', '');
            website.sources[src] = (website.sources[src] || 0) + v;
          }
          if (k.startsWith('pv_') && typeof v === 'number') {
            const page = k.replace('pv_', '');
            website.pages[page] = (website.pages[page] || 0) + v;
          }
          if (k.startsWith('device_') && typeof v === 'number') {
            const device = k.replace('device_', '');
            website.devices[device] = (website.devices[device] || 0) + v;
          }
          if (k.startsWith('country_') && typeof v === 'number') {
            const code = k.replace('country_', '').toUpperCase();
            website.countries[code] = (website.countries[code] || 0) + v;
          }
        }
      }
      if (website.sessionEndCount > 0) {
        website.avgSessionDurationSeconds = Math.round(website.totalSessionDurationSeconds / website.sessionEndCount);
      }

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
        periodStartDate,
        website,
      });
    } catch (error) {
      console.error('[Analytics] Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const openVisitorsModal = (type, title) => {
    setDetailModal({ kind: 'visitors', type, title });
  };

  const fetchUsers = async (cacheKey, scope) => {
    if (modalUsers[cacheKey]) return;
    setModalLoading(true);
    try {
      let qRef = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
      if (scope === 'period' && stats.periodStartDate) {
        const start = Timestamp.fromDate(new Date(`${stats.periodStartDate}T00:00:00Z`));
        qRef = query(collection(db, 'users'), where('createdAt', '>=', start), orderBy('createdAt', 'desc'), limit(100));
      }
      const snap = await getDocs(qRef);
      setModalUsers(prev => ({ ...prev, [cacheKey]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    } catch (e) {
      console.warn('[Analytics] users fetch failed:', e.message);
      setModalUsers(prev => ({ ...prev, [cacheKey]: [] }));
    } finally {
      setModalLoading(false);
    }
  };

  const openUsersModal = () => {
    setDetailModal({ kind: 'users', type: 'all', title: 'Registered Users' });
    fetchUsers('all', 'all');
  };

  const openSignupsModal = () => {
    setDetailModal({ kind: 'users', type: 'signups', title: `Sign-ups (${timeRange})` });
    fetchUsers('signups', 'period');
  };

  const getModalRows = () => {
    if (!detailModal) return [];
    if (detailModal.kind === 'users') return modalUsers[detailModal.type] ?? [];
    const visitors = stats.website?.recentVisitors ?? [];
    const periodStart = stats.periodStartDate;
    switch (detailModal.type) {
      case 'unique':
        return visitors.filter(v => !periodStart || v.lastSeenDate >= periodStart);
      case 'new':
        return visitors.filter(v => !periodStart || v.firstSeenDate >= periodStart);
      case 'returning':
        return visitors.filter(v => periodStart && v.firstSeenDate < periodStart && v.lastSeenDate >= periodStart);
      default:
        return visitors;
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
          <button type="button" onClick={() => navigate('/admin/docs')} className="analytics-refresh" title="Back">← Admin</button>
          <select value={envFilter} onChange={e => setEnvFilter(e.target.value)} className="analytics-select">
            <option value="production">Production</option>
            <option value="development">Development</option>
            <option value="all">All</option>
          </select>
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

      {/* ── WEBSITE ── */}
      <section className="analytics-section-label">WEBSITE</section>
      <section className="analytics-metrics">
        <StatCard icon={Globe} label="Unique Visitors" value={stats.website?.uniqueVisitors ?? 0} color="var(--vuvio-cyan)" sparkData={stats.website?.sparkUniqueVisitors} onClick={() => openVisitorsModal('unique', 'Unique Visitors')} />
        <StatCard icon={TrendingUp} label="New Visitors" value={stats.website?.newVisitors ?? 0} color="var(--vuvio-blue)" sparkData={stats.website?.sparkNewVisitors} onClick={() => openVisitorsModal('new', 'New Visitors')} />
        <StatCard icon={Activity} label="Returning Visitors" value={stats.website?.returningVisitors ?? 0} color="#b47bff" onClick={() => openVisitorsModal('returning', 'Returning Visitors')} />
        <StatCard icon={Eye} label="Sessions" value={stats.website?.sessions ?? 0} color="rgba(255,255,255,0.5)" sparkData={stats.website?.sparkSessions} onClick={() => openVisitorsModal('unique', 'Session Visitors')} />
        <StatCard icon={Eye} label="Page Views" value={stats.website?.pageViews ?? 0} color="rgba(255,255,255,0.4)" sparkData={stats.website?.sparkPageViews} />
        <StatCard icon={Users} label="Registered Users" value={stats.totalUsers} color="var(--vuvio-orange)" onClick={openUsersModal} />
        <StatCard icon={TrendingUp} label="Sign-ups" value={stats.website?.signups ?? 0} color="var(--vuvio-pink)" onClick={openSignupsModal} />
        <StatCard
          icon={Activity}
          label="Visitor → Signup"
          value={stats.website?.uniqueVisitors > 0 ? Math.round((stats.website.signups / stats.website.uniqueVisitors) * 100) : 0}
          format={v => `${v}%`}
          color="var(--vuvio-pink)"
        />
        <StatCard
          icon={Clock}
          label="Avg. Time on Site"
          value={stats.website?.avgSessionDurationSeconds ?? 0}
          format={v => {
            if (v < 60) return `${v}s`;
            const m = Math.floor(v / 60);
            const s = v % 60;
            return s > 0 ? `${m}m ${s}s` : `${m}m`;
          }}
          color="var(--vuvio-cyan)"
        />
      </section>

      {/* ── RECENT VISITORS ── */}
      {stats.website?.recentVisitors?.length > 0 && (
        <section className="analytics-section">
          <h2>Recent Visitors</h2>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Location</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Sessions</th>
                <th>Type</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {stats.website.recentVisitors.map((v) => {
                const firstTs = v.firstSeenAt?.toDate?.() ?? (v.firstSeenAt?._seconds ? new Date(v.firstSeenAt._seconds * 1000) : null);
                const lastTs = v.lastSeenAt?.toDate?.() ?? (v.lastSeenAt?._seconds ? new Date(v.lastSeenAt._seconds * 1000) : null);
                const isNew = v.firstSeenDate === v.lastSeenDate;
                const fmt = (d) => d ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                const flag = v.countryCode ? String.fromCodePoint(...[...v.countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : null;
                return (
                  <tr key={v.anonymousId} className="leaderboard-row">
                    <td className="leaderboard-metric" style={{ fontFamily: 'monospace', opacity: 0.6 }}>{v.anonymousId?.slice(0, 8)}</td>
                    <td className="leaderboard-metric">
                      {flag
                        ? <span title={v.country}>{flag} {v.city || v.country || '—'}</span>
                        : <span style={{ opacity: 0.35 }}>—</span>
                      }
                    </td>
                    <td className="leaderboard-metric">{fmt(firstTs)}</td>
                    <td className="leaderboard-metric">{fmt(lastTs)}</td>
                    <td className="leaderboard-metric">{v.totalSessions ?? 1}</td>
                    <td className="leaderboard-metric">
                      <span style={{ color: isNew ? 'var(--vuvio-cyan)' : '#b47bff', fontSize: '0.75rem' }}>
                        {isNew ? 'new' : 'returning'}
                      </span>
                    </td>
                    <td className="leaderboard-metric">
                      {v.userId
                        ? <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>✓ signed up</span>
                        : <span style={{ opacity: 0.35, fontSize: '0.75rem' }}>—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ── TOP COUNTRIES ── */}
      {stats.website && Object.keys(stats.website.countries).length > 0 && (
        <section className="analytics-section">
          <h2>Top Countries</h2>
          <table className="leaderboard-table">
            <thead><tr><th>Country</th><th>Visitors</th><th>%</th></tr></thead>
            <tbody>
              {Object.entries(stats.website.countries)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([code, count]) => {
                  const total = Object.values(stats.website.countries).reduce((s, v) => s + v, 0);
                  const flag = String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
                  return (
                    <tr key={code} className="leaderboard-row">
                      <td className="leaderboard-title">{flag} {code}</td>
                      <td className="leaderboard-metric">{count}</td>
                      <td className="leaderboard-metric">{total > 0 ? Math.round((count / total) * 100) : 0}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      {/* ── ACQUISITION ── */}
      {stats.website && (Object.keys(stats.website.sources).length > 0 || Object.keys(stats.website.pages).length > 0) && (
        <section className="analytics-section analytics-section--two-col">
          <div>
            <h2>Traffic Sources</h2>
            {Object.keys(stats.website.sources).length === 0 ? (
              <p className="no-data">No data yet</p>
            ) : (
              <table className="leaderboard-table">
                <thead><tr><th>Source</th><th>Sessions</th><th>%</th></tr></thead>
                <tbody>
                  {Object.entries(stats.website.sources)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([src, count]) => {
                      const total = Object.values(stats.website.sources).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={src} className="leaderboard-row">
                          <td className="leaderboard-title" style={{ textTransform: 'capitalize' }}>{src}</td>
                          <td className="leaderboard-metric">{count}</td>
                          <td className="leaderboard-metric">{total > 0 ? Math.round((count / total) * 100) : 0}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h2>Top Pages</h2>
            {Object.keys(stats.website.pages).length === 0 ? (
              <p className="no-data">No data yet</p>
            ) : (
              <table className="leaderboard-table">
                <thead><tr><th>Page</th><th>Views</th></tr></thead>
                <tbody>
                  {Object.entries(stats.website.pages)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([page, count]) => (
                      <tr key={page} className="leaderboard-row">
                        <td className="leaderboard-title">{page.replace(/_/g, ' ')}</td>
                        <td className="leaderboard-metric">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ── CONVERSION FUNNEL ── */}
      <section className="analytics-section">
        <h2>Conversion</h2>
        {stats.website?.sessions === 0 ? (
          <p className="no-data">No data yet</p>
        ) : (() => {
          const visitors = stats.website?.sessions ?? 0;
          const signups = stats.website?.signups ?? 0;
          const watched = stats.totalViews;
          const steps = [
            { label: 'Visitors', value: visitors, color: 'var(--vuvio-cyan)' },
            { label: 'Sign-ups', value: signups, color: 'var(--vuvio-blue)' },
            { label: 'Watched Live', value: watched, color: '#b47bff' },
          ];
          return (
            <div className="conversion-funnel">
              {steps.map((step, i) => {
                const prev = i > 0 ? steps[i - 1].value : null;
                const rate = prev && prev > 0 ? Math.round((step.value / prev) * 100) : null;
                return (
                  <div key={step.label} className="funnel-step">
                    {rate !== null && <div className="funnel-arrow">↓ {rate}%</div>}
                    <div className="funnel-bar" style={{ borderColor: step.color }}>
                      <span className="funnel-label">{step.label}</span>
                      <span className="funnel-value" style={{ color: step.color }}>{step.value.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* ── CONTENT ── */}
      <section className="analytics-section-label">CONTENT</section>
      <section className="analytics-metrics">
        <StatCard
          icon={Eye}
          label="Stream Views"
          value={stats.totalViews}
          trend={stats.viewsTrend}
          color="var(--vuvio-cyan)"
          sparkData={stats.dailyViews}
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

      <section className="analytics-section-label">LIVE ACTIVITY</section>
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

      {detailModal && (
        <VisitorsDetailModal
          title={detailModal.title}
          kind={detailModal.kind}
          rows={getModalRows()}
          emptyHint={
            detailModal.kind === 'users'
              ? (modalLoading ? 'Loading…' : 'No users in this period.')
              : 'No visitors matching this filter (last 30 recent are loaded).'
          }
          onClose={() => setDetailModal(null)}
        />
      )}
    </section>
  );
}
