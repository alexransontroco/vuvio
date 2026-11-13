import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ChevronLeft, Radio, Eye, Users, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatCompact(v = 0) {
  if (v >= 1000000) return `${(v / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (v >= 1000) return `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return String(v);
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>
        <Icon size={16} strokeWidth={1.8} />
        <span style={{ fontSize: 11, fontWeight: 440, color: 'var(--profile-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <strong style={{ fontSize: 26, fontWeight: 640, letterSpacing: '-0.03em', color: 'var(--vuvio-text-primary)' }}>{value}</strong>
    </div>
  );
}

export default function CreatorStatsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const q = query(
          collection(db, 'activeLives'),
          where('creatorUid', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50),
        );
        const snap = await getDocs(q);
        setLives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('[CreatorStats]', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const totalViews = lives.reduce((s, l) => s + (l.currentViewerCount || l.viewers || 0), 0);
  const totalSeconds = lives.reduce((s, l) => {
    const dur = l.durationSeconds || (l.endedAt && l.createdAt
      ? Math.round((l.endedAt.toDate?.() - l.createdAt.toDate?.()) / 1000)
      : 0);
    return s + (dur || 0);
  }, 0);
  const totalHours = Math.round(totalSeconds / 3600);
  const followers = userProfile?.followersCount ?? 0;
  const liveCount = userProfile?.liveCount ?? lives.length;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--vuvio-bg)', paddingBottom: 40 }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vuvio-text-primary)', padding: 4 }}
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('creatorStats.title')}</h1>
      </header>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <StatCard icon={Radio} label={t('profile.statsLives')} value={formatCompact(liveCount)} color="var(--vuvio-cyan)" />
          <StatCard icon={Users} label={t('creatorStats.statFollowers')} value={formatCompact(followers)} color="#a78bfa" />
          <StatCard icon={Eye} label={t('creatorStats.statViews')} value={formatCompact(totalViews)} color="#fb923c" />
          <StatCard icon={Clock} label={t('creatorStats.statHours')} value={`${totalHours} h`} color="#34d399" />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--profile-muted)', fontSize: 13, paddingTop: 20 }}>
            {t('creatorStats.loading')}
          </div>
        ) : lives.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--profile-muted)', fontSize: 13, paddingTop: 20 }}>
            {t('creatorStats.noLives')}
          </div>
        ) : (
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 500, color: 'var(--profile-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('creatorStats.recentLives')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {lives.map((live) => {
                const dur = live.durationSeconds || (live.endedAt && live.createdAt
                  ? Math.round((live.endedAt.toDate?.() - live.createdAt.toDate?.()) / 1000)
                  : null);
                const views = live.currentViewerCount || live.viewers || 0;
                const isLive = live.status === 'live';
                return (
                  <div key={live.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isLive && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--vuvio-cyan)', background: 'rgba(0,255,255,0.1)', borderRadius: 4, padding: '2px 6px' }}>
                            LIVE
                          </span>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vuvio-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {live.title || live.experienceTitle || live.subcategory || t('creatorStats.untitled')}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--profile-muted)', marginTop: 2, display: 'block' }}>
                        {formatDate(live.createdAt)}
                        {live.city ? ` · ${live.city}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginLeft: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vuvio-text-primary)' }}>{formatCompact(views)}</div>
                        <div style={{ fontSize: 10, color: 'var(--profile-muted)' }}>{t('creatorStats.views')}</div>
                      </div>
                      {dur && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--vuvio-text-primary)' }}>{formatDuration(dur)}</div>
                          <div style={{ fontSize: 10, color: 'var(--profile-muted)' }}>{t('creatorStats.duration')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
