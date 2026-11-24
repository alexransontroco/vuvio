import { collection, getDocs, getCountFromServer, limit, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isAdminEmail } from '../constants/adminEmails.js';

const TIER_LABEL = { trusted: 'Top créateur', standard: 'Actif', new: 'Nouveau', 'at-risk': 'À surveiller', suspended: 'Suspendu' };
const TIER_COLOR = { trusted: '#89f0a8', standard: '#35e3dc', new: '#94a3b8', 'at-risk': '#ffd166', suspended: '#fca5a5' };

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min${s > 0 ? ` ${s}s` : ''}` : `${s}s`;
}

function BigStat({ value, label, sub, color = '#35e3dc' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '28px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ fontSize: 40, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{label}</span>
      {sub ? <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{sub}</span> : null}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', margin: '32px 0 12px' }}>
      {children}
    </h2>
  );
}

function CreatorCard({ creator }) {
  const tier = creator.trustTier || 'standard';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      {creator.photoURL
        ? <img src={creator.photoURL} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(53,227,220,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {creator.displayName || creator.creatorId?.slice(0, 10)}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {fmt(creator.totalViews || 0)} vues · {creator.totalStreams || 0} lives
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
        background: `${TIER_COLOR[tier]}18`, color: TIER_COLOR[tier],
        border: `1px solid ${TIER_COLOR[tier]}44`, whiteSpace: 'nowrap',
      }}>
        {TIER_LABEL[tier] || tier}
      </span>
    </div>
  );
}

function LiveRow({ live, isLive }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 12,
      background: isLive ? 'rgba(53,227,220,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isLive ? 'rgba(53,227,220,0.2)' : 'rgba(255,255,255,0.07)'}`,
    }}>
      {isLive && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4d4d', boxShadow: '0 0 6px #ff4d4d', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {live.title || live.note || 'Live sans titre'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {live.creatorName || '—'} · {live.category || '—'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isLive ? '#35e3dc' : 'rgba(255,255,255,0.6)' }}>
          {isLive ? `${live.currentViewerCount || 0} viewers` : fmtDuration(live.durationSeconds)}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
          {live.city ? `📍 ${live.city}` : live.countryCode || ''}
        </div>
      </div>
    </div>
  );
}

export default function AdminMarketingPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isAdmin = isLocalDev || isAdminEmail(user?.email);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, liveNow: 0, totalViews: 0, totalLives: 0 });
  const [creators, setCreators] = useState([]);
  const [liveLives, setLiveLives] = useState([]);
  const [recentLives, setRecentLives] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;

    async function load() {
      const safe = (p) => p.catch(() => null);
      const [creatorsSnap, usersCount, allLivesSnap, usersSnap] = await Promise.all([
        safe(getDocs(query(collection(db, 'creatorStats'), orderBy('totalViews', 'desc'), limit(12)))),
        safe(getCountFromServer(collection(db, 'users'))),
        safe(getDocs(query(collection(db, 'activeLives'), orderBy('createdAt', 'desc'), limit(100)))),
        safe(getDocs(query(collection(db, 'users'), limit(50)))),
      ]);

      const userMap = {};
      usersSnap?.docs.forEach((d) => { userMap[d.id] = d.data(); });

      const allCreators = (creatorsSnap?.docs ?? []).map((d) => {
        const data = d.data();
        const u = userMap[data.creatorId] ?? {};
        return { ...data, displayName: u.displayName || u.username || data.creatorId?.slice(0, 10), photoURL: u.photoURL || null, trustTier: u.trustTier || 'standard' };
      });

      const allLives = (allLivesSnap?.docs ?? []).map((d) => d.data());
      const live = allLives.filter((l) => l.status === 'live');
      const recent = allLives.filter((l) => l.status !== 'live').slice(0, 15);
      const totalViews = allLives.reduce((sum, l) => sum + (l.peakViewerCount || l.viewers || 0), 0);

      setStats({
        totalUsers: usersCount?.data().count ?? 0,
        liveNow: live.length,
        totalViews,
        totalLives: allLives.length,
      });
      setCreators(allCreators);
      setLiveLives(live);
      setRecentLives(recent);
      setLoading(false);
    }

    load();
  }, [authLoading, isAdmin]);

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <a href="/watch" title="Fermer" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>✕</a>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 14px', color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            ← Retour
          </button>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#35e3dc', marginBottom: 8 }}>
            Vuvio — Vue marketing
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Bonjour Cecilia 👋</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 8, fontSize: 15 }}>
            Voici l'activité de la plateforme en temps réel.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <a href="/admin/docs" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Admin complet →</a>
            <a href="/admin/analytics" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Analytics →</a>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.3)' }}>Chargement…</p>
        ) : (
          <>
            {/* Big stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <BigStat value={fmt(stats.totalUsers)} label="Membres" sub="total inscrits" color="#35e3dc" />
              <BigStat value={stats.liveNow} label="En live maintenant" sub={stats.liveNow === 0 ? 'Aucun stream actif' : 'streams actifs'} color={stats.liveNow > 0 ? '#ff6b6b' : '#94a3b8'} />
              <BigStat value={fmt(stats.totalLives)} label="Lives enregistrés" sub="depuis le début" color="#ffd166" />
              <BigStat value={fmt(stats.totalViews)} label="Viewers cumulés" sub="peak viewers total" color="#c4b5fd" />
            </div>

            {/* Lives en cours */}
            {liveLives.length > 0 && (
              <>
                <SectionTitle>🔴 En live maintenant</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {liveLives.map((l) => <LiveRow key={l.id || l.streamId} live={l} isLive />)}
                </div>
              </>
            )}

            {/* Top créateurs */}
            <SectionTitle>⭐ Top créateurs</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {creators.filter((c) => c.trustTier !== 'suspended').map((c) => (
                <CreatorCard key={c.creatorId} creator={c} />
              ))}
            </div>

            {/* Lives récents */}
            <SectionTitle>🎬 Lives récents</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLives.map((l) => <LiveRow key={l.id || l.streamId} live={l} isLive={false} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
