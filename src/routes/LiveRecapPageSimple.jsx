import Hls from 'hls.js';
import { Check, ChevronDown, ChevronLeft, Clock, Download, Eye, HelpCircle, Loader, MapPin, MessageSquare, Play, Reply, Share2, Sparkles, Star, Users, X } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot, collection, getDocs, query } from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { db } from '../firebase.js';
import { endLive } from '../services/createdLiveService.js';
import { getOrCreateConversation } from '../services/messagingService.js';
import { deleteReplay, requestReplayDownload } from '../services/streamApi.ts';
import { useAuth } from '../context/AuthContext.jsx';
import SEO, { SITE_URL } from '../components/SEO.jsx';

function ReplayPlayer({ src, poster }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      let hls = null;
      let retryTimer = null;
      let destroyed = false;

      const load = () => {
        if (destroyed) return;
        hls = new Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.muted = false; });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal && data.response?.code === 424) {
            hls.destroy();
            hls = null;
            retryTimer = setTimeout(load, 5000);
          }
        });
      };

      load();
      return () => {
        destroyed = true;
        clearTimeout(retryTimer);
        hls?.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      poster={poster}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

const STAT_DEFS = [
  { key: 'duration',  label: 'Duration',      Icon: Clock,         color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  { key: 'peak',      label: 'Peak viewers',  Icon: Users,         color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
  { key: 'total',     label: 'Total viewers', Icon: Eye,           color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  { key: 'messages',  label: 'Messages',      Icon: MessageSquare, color: '#35e3dc', bg: 'rgba(53,227,220,0.12)'  },
  { key: 'stars',     label: 'Stars',         Icon: Star,          color: '#f59e0b', bg: 'rgba(245,158,11,0.13)'  },
  { key: 'questions', label: 'Questions',     Icon: HelpCircle,    color: '#ec4899', bg: 'rgba(236,72,153,0.13)'  },
];

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'audience',   label: 'Audience' },
  { key: 'engagement', label: 'Engagement' },
];

const CLOUDFARE_REPLAY_DISABLED_TEXT = 'Cloudflare replay is disabled for this live input or account.';

function AudienceChart({ peak, duration, comments }) {
  const W = 320, H = 120;
  const buckets = 24;
  const counts = new Array(buckets).fill(0);
  if (duration > 0 && comments?.length > 0) {
    comments.forEach((c) => {
      const t = c.liveElapsedSeconds ?? 0;
      const i = Math.min(buckets - 1, Math.max(0, Math.floor((t / duration) * buckets)));
      counts[i] += 1;
    });
  }
  const maxCount = Math.max(1, ...counts);
  const effectivePeak = Math.max(1, peak || 0);
  const points = counts.map((c, i) => {
    const t = i / (buckets - 1);
    const bell = Math.max(0, 1 - Math.pow((t - 0.5) * 1.8, 2));
    const base = effectivePeak * (0.25 + 0.75 * bell);
    const spike = (c / maxCount) * effectivePeak * 0.25;
    const v = Math.min(effectivePeak, base + spike);
    const x = t * W;
    const y = H - 8 - (v / effectivePeak) * (H - 16);
    return [x, y];
  });
  if (points.length === 0) return null;
  let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const cx = (px + x) / 2;
    d += ` Q ${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${((py + y) / 2).toFixed(1)} T ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  const area = `${d} L ${W.toFixed(1)},${H.toFixed(1)} L 0,${H.toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lrs-aud-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(53,227,220,0.42)" />
          <stop offset="100%" stopColor="rgba(53,227,220,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lrs-aud-grad)" />
      <path d={d} fill="none" stroke="var(--vuvio-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function pickHighlights(comments, duration) {
  if (!comments || comments.length === 0 || duration <= 0) return [];
  // Bucket comments into windows, pick top 3 most active windows as highlights
  const buckets = 12;
  const bucketCounts = new Array(buckets).fill(0);
  const bucketSamples = new Array(buckets).fill(null).map(() => []);
  comments.forEach((c) => {
    const t = c.liveElapsedSeconds ?? 0;
    const i = Math.min(buckets - 1, Math.max(0, Math.floor((t / duration) * buckets)));
    bucketCounts[i] += 1;
    if (bucketSamples[i].length < 1 && c.text) bucketSamples[i].push(c);
  });
  const ranked = bucketCounts
    .map((count, i) => ({ i, count }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i);

  if (ranked.length === 0) {
    return [{ id: 'hl-0', label: 'Full recap', time: formatTime(Math.floor(duration / 2)) }];
  }
  return ranked.map((r) => {
    const sample = bucketSamples[r.i][0];
    const time = sample?.liveElapsedSeconds ?? Math.floor((r.i / buckets) * duration + duration / (buckets * 2));
    const label = sample?.text
      ? truncate(sample.text, 24)
      : r.i < buckets / 3
        ? 'Opening buzz'
        : r.i > (buckets * 2) / 3
          ? 'Grand finale'
          : 'Peak moment';
    return { id: `hl-${r.i}`, label, time: formatTime(time) };
  });
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function truncate(text, n) {
  const clean = String(text || '').trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

function RecapCard({ liveData, statValues, cardRef, coverDataUrl }) {
  const cover = coverDataUrl ?? liveData?.coverImageUrl ?? liveData?.thumbnailUrl ?? liveData?.image;
  const cardStats = STAT_DEFS.slice(0, 4);
  return (
    <div ref={cardRef} style={SC.card}>
      {cover && <img src={cover} alt="" style={SC.bgImg} />}
      <div style={SC.bgOverlay} />
      <div style={SC.inner}>
        <div style={SC.badge}>RECAP</div>
        <div style={SC.thumbBox}>
          {cover ? (
            <img src={cover} alt="" style={SC.thumb} />
          ) : (
            <div style={{ ...SC.thumb, background: '#0c1e34' }} />
          )}
        </div>
        <p style={SC.title}>{liveData.title || 'Live stream'}</p>
        {liveData.location && <p style={SC.location}>{liveData.location}</p>}
        <div style={SC.statsRow}>
          {cardStats.map(({ key, label, Icon, color }) => (
            <div key={key} style={SC.stat}>
              <Icon size={14} color={color} strokeWidth={2} />
              <strong style={SC.statVal}>{statValues[key]}</strong>
              <span style={SC.statLbl}>{label}</span>
            </div>
          ))}
        </div>
        <div style={SC.branding}>
          <span style={SC.brandDot} />
          <span style={SC.brandName}>VU·VIO</span>
        </div>
      </div>
    </div>
  );
}

const SC = {
  card: {
    position: 'relative',
    width: 340,
    borderRadius: 24,
    overflow: 'hidden',
    background: '#08111e',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    flexShrink: 0,
  },
  bgImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.18,
    filter: 'blur(20px)',
    transform: 'scale(1.1)',
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(8,17,30,0.3) 0%, rgba(8,17,30,0.85) 60%, #08111e 100%)',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 20px 24px',
    gap: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 6,
    padding: '3px 9px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.5,
    color: '#fff',
    marginBottom: 14,
  },
  thumbBox: {
    width: '100%',
    aspectRatio: '9/16',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  title: {
    margin: '0 0 4px',
    fontSize: 20,
    fontWeight: 800,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  location: {
    margin: '0 0 16px',
    fontSize: 13,
    color: 'rgba(226,234,244,0.5)',
    textAlign: 'center',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
    marginBottom: 20,
    padding: '14px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  },
  statLbl: {
    fontSize: 9,
    fontWeight: 600,
    color: 'rgba(226,234,244,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    display: 'inline-block',
  },
  brandName: {
    fontSize: 13,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2,
  },
};

export default function LiveRecapPageSimple() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [comments, setComments] = useState([]);
  const [dataOpen, setDataOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [cardModal, setCardModal] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [pctComplete, setPctComplete] = useState(null);
  const [replayState, setReplayState] = useState('processing');
  const [replayPollInfo, setReplayPollInfo] = useState(null);
  const [coverDataUrl, setCoverDataUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [downloadingReplay, setDownloadingReplay] = useState(false);
  const liveDataRef = useRef(null);
  const cardRef = useRef(null);
  const pollCountRef = useRef(0);
  const emptyPollStreakRef = useRef(0);
  const downloadPollRef = useRef(null);

  useEffect(() => {
    const url = liveData?.coverImageUrl ?? liveData?.thumbnailUrl ?? liveData?.image;
    if (!url || url.startsWith('data:')) { setCoverDataUrl(url ?? null); return; }
    let cancelled = false;
    fetch(url, { mode: 'cors' })
      .then((r) => r.blob())
      .then((blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }))
      .then((dataUrl) => { if (!cancelled) setCoverDataUrl(dataUrl); })
      .catch(() => { if (!cancelled) setCoverDataUrl(url); });
    return () => { cancelled = true; };
  }, [liveData?.coverImageUrl, liveData?.thumbnailUrl, liveData?.image]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const original = meta.getAttribute('content');
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
      requestAnimationFrame(() => meta.setAttribute('content', original));
    }
  }, []);

  useEffect(() => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) return;

    if (location.state?.liveData?.broadcastIngestMode === 'whip') {
      setReplayState('no_footage');
      return;
    }

    const replayStateRef = { current: 'processing' };
    const poll = async () => {
      if (liveDataRef.current?.replayUrl) return;
      if (replayStateRef.current !== 'processing') return;
      pollCountRef.current += 1;
      if (pollCountRef.current > 80) {
        replayStateRef.current = 'timeout';
        setReplayState('timeout');
        setReplayPollInfo((prev) => prev ? { ...prev, recordingStatus: 'timeout', state: 'timeout', checkedAt: Date.now() } : prev);
        return;
      }
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(liveId)}/replay-status`);
        if (res.ok) {
          const data = await res.json();
          setReplayPollInfo({
            pollCount: pollCountRef.current,
            recordingStatus: data.recordingStatus || 'processing',
            state: data.state || 'processing',
            liveInputUid: data.liveInputUid || '',
            cloudflareUid: data.cloudflareUid || data.cloudflareVideoId || '',
            videosFound: data.videosFound ?? null,
            pctComplete: data.pctComplete ?? null,
            readyToStream: data.readyToStream === true,
            checkedAt: Date.now(),
          });
          if (data.replayUrl) {
            liveDataRef.current = { ...liveDataRef.current, replayUrl: data.replayUrl, recordingStatus: 'ready' };
            setLiveData(prev => prev ? { ...prev, replayUrl: data.replayUrl, recordingStatus: 'ready' } : prev);
          } else if (data.recordingStatus === 'processing_failed') {
            replayStateRef.current = 'no_footage';
            setReplayState('no_footage');
          } else if ((data.videosFound ?? 1) === 0) {
            emptyPollStreakRef.current += 1;
            if (emptyPollStreakRef.current >= 20) {
              replayStateRef.current = 'no_footage';
              setReplayState('no_footage');
            }
          } else {
            emptyPollStreakRef.current = 0;
            if (data.pctComplete != null) setPctComplete(data.pctComplete);
          }
        }
      } catch (err) {
        console.warn('[LiveRecapSimple] poll failed:', err.message);
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  useEffect(() => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) { setLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, 'activeLives', liveId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          liveDataRef.current = data;
          setLiveData(data);
        } else if (location.state?.liveData) {
          setLiveData(location.state.liveData);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[LiveRecapSimple] snapshot error:', err);
        if (location.state?.liveData) setLiveData(location.state.liveData);
        setLoading(false);
      },
    );

    return unsub;
  }, [location.pathname, location.state?.liveData]);

  useEffect(() => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) return;
    getDocs(query(collection(db, `activeLives/${liveId}/comments`)))
      .then((snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const ta = a.liveElapsedSeconds ?? (a.timestamp?.toMillis?.() ?? 0);
          const tb = b.liveElapsedSeconds ?? (b.timestamp?.toMillis?.() ?? 0);
          return ta - tb;
        });
        setComments(docs);
      })
      .catch((err) => console.warn('[LiveRecapSimple] comments fetch failed:', err.message));
  }, [location.pathname]);

  const exportCardImage = async () => {
    if (!cardRef.current) return null;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      return dataUrl;
    } catch (err) {
      console.warn('[RecapCard] export failed:', err);
      return null;
    }
  };

  const handleReply = async (comment) => {
    if (!user || !comment.userId || comment.userId === user.uid) return;
    setReplyingTo({ userId: comment.userId, displayName: comment.userDisplayName || 'Viewer' });
    setReplyLoading(true);
    try {
      const conv = await getOrCreateConversation(comment.userId, { currentUser: user });
      navigate(`/messages/${conv.id}`);
    } catch (err) {
      console.warn('[Recap] Failed to open DM:', err.message);
    } finally {
      setReplyLoading(false);
      setReplyingTo(null);
    }
  };

  const handleShare = () => setCardModal('share');

  const handleShareConfirm = async () => {
    setExporting(true);
    const dataUrl = await exportCardImage();
    setExporting(false);
    if (!dataUrl) return;

    const liveId = location.pathname.split('/')[2];
    const shareUrl = `${window.location.origin}/share/live/${liveId}/recap`;
    const title = liveData?.title || 'Vuvio Live Recap';

    if (navigator.share && navigator.canShare) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'recap.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title, files: [file], url: shareUrl });
          setCardModal(null);
          return;
        }
      } catch {}
    }
    if (navigator.share) {
      await navigator.share({ title, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    setCardModal(null);
  };

  const handleSave = () => setCardModal('save');

  const handleSaveConfirm = async () => {
    setExporting(true);
    const dataUrl = await exportCardImage();
    setExporting(false);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `recap-${liveData?.title || 'live'}.png`;
    a.click();
    setCardModal(null);
  };

  const handleDownloadReplay = async () => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId || downloadingReplay) return;
    setDownloadingReplay(true);
    try {
      const result = await requestReplayDownload(liveId);
      if (result.url) {
        const a = document.createElement('a');
        a.href = result.url;
        a.download = `replay-${liveData?.title || liveId}.mp4`;
        a.target = '_blank';
        a.click();
        setDownloadingReplay(false);
        return;
      }
      // Poll until url is ready
      const poll = async () => {
        try {
          const r = await requestReplayDownload(liveId);
          if (r.url) {
            clearInterval(downloadPollRef.current);
            downloadPollRef.current = null;
            const a = document.createElement('a');
            a.href = r.url;
            a.download = `replay-${liveData?.title || liveId}.mp4`;
            a.target = '_blank';
            a.click();
            setDownloadingReplay(false);
          }
        } catch {
          clearInterval(downloadPollRef.current);
          downloadPollRef.current = null;
          setDownloadingReplay(false);
        }
      };
      downloadPollRef.current = setInterval(poll, 3000);
    } catch (err) {
      console.error('[LiveRecapSimple] Download failed:', err);
      setDownloadingReplay(false);
    }
  };

  const handleFinish = async () => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) return;
    setFinishing(true);
    try {
      // Delete Cloudflare recording + clean Firestore before navigating away
      if (liveData?.replayUrl || liveData?.cloudflareVideoId || liveData?.recordingUid) {
        try { await deleteReplay(liveId); } catch (e) { console.warn('[LiveRecapSimple] deleteReplay failed (non-fatal):', e); }
      }
      await endLive(liveId);
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        const original = meta.getAttribute('content');
        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
        requestAnimationFrame(() => meta.setAttribute('content', original));
      }
      window.scrollTo(0, 0);
      navigate('/watch', { replace: true });
    } catch (err) {
      console.error('[LiveRecapSimple] Finish failed:', err);
      setFinishing(false);
    }
  };

  const duration = liveData?.durationSeconds || 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const peakCount = liveData?.peakViewerCount ?? liveData?.peakConcurrentViewers ?? 0;
  const totalCount = liveData?.totalUniqueViewers
    ?? liveData?.totalViewerCount
    ?? liveData?.viewerCount
    ?? peakCount;
  const msgCount = liveData?.commentCount ?? comments.length ?? 0;
  const questionCount = liveData?.questionCount ?? 0;

  const highlights = useMemo(
    () => pickHighlights(comments, duration),
    [comments, duration],
  );

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.centeredState}>
          Loading recap…
        </div>
      </main>
    );
  }

  if (!liveData) {
    return (
      <main style={S.page}>
        <SEO title="Replay introuvable | Vuvio" description="Ce replay Vuvio n existe pas ou n est plus disponible." canonical={location.pathname} robots="noindex,follow" />
        <div style={S.centeredState}>
          No data found
        </div>
      </main>
    );
  }

  if (liveData.creatorUid && user?.uid !== liveData.creatorUid) {
    return (
      <main style={S.page}>
        <SEO title="Replay prive | Vuvio" description="Ce replay Vuvio est prive." canonical={location.pathname} robots="noindex,follow" />
        <div style={{ ...S.centeredState, flexDirection: 'column', gap: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 36 }}>🔒</span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vuvio-text-primary)' }}>Private recap</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--vuvio-text-muted)' }}>Only the broadcaster can view this recap.</p>
          <button type="button" style={S.backToVuvioBtn} onClick={() => navigate('/watch', { replace: true })}>
            Back to Vuvio
          </button>
        </div>
      </main>
    );
  }

  const isProcessing = !liveData.replayUrl && replayState === 'processing';
  const replayStatus = liveData.replayUrl
    ? { tone: '#22c55e', label: 'Replay ready', detail: 'Your recording is ready to watch and share.' }
    : replayState === 'no_footage'
      ? { tone: '#f97316', label: 'No recording found', detail: CLOUDFARE_REPLAY_DISABLED_TEXT }
      : replayState === 'timeout'
        ? { tone: '#f97316', label: 'Processing timeout', detail: 'Cloudflare did not expose the recording in time.' }
        : replayPollInfo?.videosFound === 0
          ? { tone: '#38bdf8', label: 'Recording finalizing', detail: 'Cloudflare has not listed the replay video yet.' }
          : { tone: '#38bdf8', label: 'Processing replay', detail: 'Waiting for Cloudflare to make the replay streamable.' };
  const replayDebugRows = [
    ['Status', replayPollInfo?.recordingStatus || liveData.recordingStatus || (liveData.replayUrl ? 'ready' : 'processing')],
    ['Live input', replayPollInfo?.liveInputUid || liveData.cloudflareLiveInputId || liveData.liveInputId || 'missing'],
    ['Video ID', replayPollInfo?.cloudflareUid || liveData.recordingUid || liveData.cloudflareVideoId || 'pending'],
    ['Videos found', replayPollInfo?.videosFound ?? 'unknown'],
    ['Poll', replayPollInfo?.pollCount ? `#${replayPollInfo.pollCount}` : 'waiting'],
  ];

  const statValues = {
    duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
    peak: peakCount,
    total: totalCount,
    messages: msgCount,
    stars: liveData.starCount ?? 0,
    questions: questionCount,
  };

  const insightDetail = msgCount > 0
    ? `${msgCount} viewer${msgCount !== 1 ? 's' : ''} interacted — great conversation!`
    : 'Keep it up — your audience is growing!';
  const liveId = location.pathname.split('/')[2];
  const recapTitle = `${liveData.title || 'Live replay'} - Replay | Vuvio`;
  const recapDescription = [
    liveData.description,
    liveData.title,
    liveData.location,
    duration ? `${Math.floor(duration / 60)} min` : null,
  ].filter(Boolean).join(' - ').slice(0, 180) || 'Replay public Vuvio.';
  const recapImage = liveData.coverImageUrl ?? liveData.thumbnailUrl ?? liveData.image ?? '/assets/icons/icon-512.png';
  const recapJsonLd = liveData.replayUrl ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: liveData.title || 'Vuvio replay',
    description: recapDescription,
    thumbnailUrl: recapImage ? [recapImage.startsWith('http') ? recapImage : `${SITE_URL}${recapImage}`] : undefined,
    contentUrl: liveData.replayUrl,
    embedUrl: `${SITE_URL}/live/${encodeURIComponent(liveId)}/recap`,
    duration: duration ? `PT${duration}S` : undefined,
    uploadDate: liveData.endedAt?.toDate?.()?.toISOString?.() || liveData.createdAt?.toDate?.()?.toISOString?.() || undefined,
  } : null;

  const statsToRender = activeTab === 'overview'
    ? STAT_DEFS
    : activeTab === 'audience'
      ? STAT_DEFS.filter((s) => ['duration', 'peak', 'total'].includes(s.key))
      : STAT_DEFS.filter((s) => ['messages', 'stars', 'questions'].includes(s.key));

  const showHighlights = activeTab === 'overview' && !!liveData?.replayUrl && highlights.length > 0;
  const showChart = activeTab === 'overview' || activeTab === 'audience';
  const showInsight = activeTab === 'overview' || activeTab === 'audience';
  const showMessages = (activeTab === 'overview' || activeTab === 'engagement') && comments.length > 0;
  const showShareCta = activeTab === 'overview';

  return (
    <main style={S.page}>
      <SEO title={recapTitle} description={recapDescription} canonical={`/live/${encodeURIComponent(liveId)}/recap`} image={recapImage} jsonLd={recapJsonLd} />
      <style>{`
        @keyframes lrs-spin { to { transform: rotate(360deg); } }
        .lrs-stat-btn:hover { border-color: var(--vuvio-border-strong) !important; }
        .lrs-btn-outline:hover { background: rgba(134,202,224,0.08) !important; border-color: var(--vuvio-border-strong) !important; }
        .lrs-btn-primary:hover { opacity: 0.88; }
        .lrs-card:hover { border-color: var(--vuvio-border-strong) !important; }
        .lrs-highlight:hover { transform: translateY(-2px); border-color: var(--vuvio-border-strong) !important; }
        .lrs-share-cta-btn:hover { opacity: 0.9; }
        .lrs-tab:hover { color: var(--vuvio-text-primary) !important; }
        .lrs-highlights-strip {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .lrs-highlights-strip::-webkit-scrollbar { display: none; }
        @media (min-width: 760px) {
          .lrs-body { max-width: 720px; margin: 0 auto; width: 100%; }
          .lrs-stats-6 { grid-template-columns: repeat(3, 1fr) !important; }
          .lrs-stats-3 { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 759px) {
          .lrs-stats-6 { grid-template-columns: repeat(2, 1fr) !important; }
          .lrs-stats-3 { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <button type="button" style={S.iconBtn} onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 style={S.headerTitle}>Live Recap</h1>
        <button type="button" style={S.iconBtn} onClick={handleShare} aria-label="Share">
          <Share2 size={18} strokeWidth={2} />
        </button>
      </header>

      {/* Tabs */}
      <nav style={S.tabsRow} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className="lrs-tab"
            style={{
              ...S.tab,
              ...(activeTab === tab.key ? S.tabActive : null),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div style={S.body} className="lrs-body">

        {/* Hero — thumbnail + title/meta (always visible) */}
        <section style={S.heroBlock}>
          <div style={S.thumbWrap}>
            {liveData.image && (
              <img src={liveData.image} alt="" style={S.thumbBg} />
            )}
            {!liveData.replayUrl && liveData.image && (
              <img src={liveData.image} alt="" style={S.thumbFg} />
            )}
            {liveData.replayUrl && (
              <ReplayPlayer src={liveData.replayUrl} poster={liveData.image} />
            )}
            <div style={S.recapBadge}>RECAP</div>
            {!liveData.replayUrl && (
              <div style={S.playBtn}>
                <Play size={20} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />
              </div>
            )}
          </div>

          <div style={S.thumbMeta}>
            <p style={S.streamTitle}>{liveData.title || 'Untitled'}</p>
            <div style={S.tagsRow}>
              {liveData.location && (
                <span style={S.tag}>
                  <MapPin size={11} strokeWidth={2} />
                  {liveData.location}
                </span>
              )}
              <span style={S.tag}>
                <Clock size={11} strokeWidth={2} />
                {`${minutes}:${String(seconds).padStart(2, '0')}`}
              </span>
            </div>
          </div>
        </section>

        {/* Stats grid — 2x3 mobile, 3x2 desktop */}
        <section
          style={S.statsGrid}
          className={activeTab === 'overview' ? 'lrs-stats-6' : 'lrs-stats-3'}
        >
          {statsToRender.map(({ key, label, Icon, color, bg }) => (
            <div key={key} style={S.statCard} className="lrs-stat-btn lrs-card">
              <div style={{ ...S.statIconWrap, background: bg }}>
                <Icon size={16} color={color} strokeWidth={1.8} />
              </div>
              <strong style={S.statValue}>{statValues[key]}</strong>
              <span style={S.statLabel}>{label}</span>
            </div>
          ))}
        </section>

        {/* Audience chart */}
        {showChart && (
          <section style={S.chartCard} className="lrs-card">
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>Audience over time</h2>
              <span style={S.sectionHint}>Peak {peakCount}</span>
            </div>
            <div style={S.chartBox}>
              <AudienceChart peak={peakCount} duration={duration} comments={comments} />
            </div>
            <div style={S.chartAxis}>
              <span>0:00</span>
              <span>{`${minutes}:${String(seconds).padStart(2, '0')}`}</span>
            </div>
          </section>
        )}

        {/* Insight card — Great reach */}
        {showInsight && (
          <section style={S.insightCard} className="lrs-card">
            <div style={S.insightIcon}>
              <Sparkles size={16} color="var(--vuvio-cyan)" strokeWidth={1.8} />
            </div>
            <div style={S.insightBody}>
              <p style={S.insightHeadline}>
                <span style={S.insightAccent}>Great reach!</span>
                {' '}{peakCount} {peakCount === 1 ? 'person' : 'people'} joined your live
              </p>
              <p style={S.insightDetail}>{insightDetail}</p>
            </div>
          </section>
        )}

        {/* Highlights strip */}
        {showHighlights && (
          <section style={S.highlightsSection}>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>Highlights</h2>
              <span style={S.sectionHint}>Auto-picked moments</span>
            </div>
            <div style={S.highlightsStrip} className="lrs-highlights-strip">
              {highlights.map((h) => (
                <article key={h.id} style={S.highlightCard} className="lrs-card lrs-highlight">
                  <div style={S.highlightThumb}>
                    {liveData.image ? (
                      <img src={liveData.image} alt="" style={S.highlightImg} />
                    ) : (
                      <div style={{ ...S.highlightImg, background: 'linear-gradient(135deg, #0c1e34, #1a2f4a)' }} />
                    )}
                    <div style={S.highlightTimePill}>{h.time}</div>
                    <div style={S.highlightPlay}>
                      <Play size={12} fill="currentColor" strokeWidth={0} style={{ marginLeft: 1 }} />
                    </div>
                  </div>
                  <span style={S.highlightLabel}>{h.label}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Share replay CTA — big outlined card */}
        {showShareCta && (
          <section style={S.shareCta} className="lrs-card">
            <div style={S.shareCtaBody}>
              <p style={S.shareCtaTitle}>
                Your live reached <strong style={S.shareCtaAccent}>{peakCount}</strong> {peakCount === 1 ? 'person' : 'people'}!
              </p>
              <p style={S.shareCtaSub}>Share your replay to reach even more.</p>
            </div>
            <button type="button" style={S.shareCtaBtn} className="lrs-share-cta-btn" onClick={handleShare}>
              <Share2 size={16} strokeWidth={2.2} />
              Share replay
            </button>
          </section>
        )}

        {/* Replay status */}
        {(liveData.replayUrl || isProcessing) && (
          <div style={S.card} className="lrs-card">
            <div style={S.replayStatusHeader}>
              <span style={{ ...S.replayStatusDot, background: replayStatus.tone }} />
              <div>
                <h3 style={S.cardTitleNoMargin}>{replayStatus.label}</h3>
                <p style={S.replayStatusDetail}>{replayStatus.detail}</p>
              </div>
            </div>
            {isProcessing && pctComplete != null && (
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${Math.max(0, Math.min(100, pctComplete))}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {showMessages && (
          <div style={S.card} className="lrs-card">
            <div style={S.cardHeader}>
              <h3 style={S.cardTitle}>
                <MessageSquare size={14} strokeWidth={2} style={{ color: 'var(--vuvio-cyan)', opacity: 0.85 }} />
                Messages ({comments.length})
              </h3>
            </div>
            <div style={S.messagesList}>
              {comments.map((c, i) => {
                let secs = c.liveElapsedSeconds ?? null;
                if ((secs === null || secs === 0) && c.timestamp && liveData.startedAt) {
                  const tMs = c.timestamp?.toMillis?.() ?? 0;
                  const sMs = liveData.startedAt?.toMillis?.() ?? 0;
                  if (tMs > sMs) secs = Math.round((tMs - sMs) / 1000);
                }
                secs = secs ?? 0;
                const mm = String(Math.floor(secs / 60)).padStart(2, '0');
                const ss = String(secs % 60).padStart(2, '0');
                const initial = (c.userDisplayName || '?').slice(0, 1).toUpperCase();
                return (
                  <div key={c.id ?? i} style={{ ...S.messageRow, borderTop: i > 0 ? '1px solid var(--vuvio-border)' : 'none', paddingTop: i > 0 ? 12 : 0 }}>
                    <div style={S.avatar}>{initial}</div>
                    <div style={S.messageBody}>
                      <div style={S.messageNameRow}>
                        <strong style={S.messageName}>{c.userDisplayName || 'Viewer'}</strong>
                        <span style={S.messageMeta}>{mm}:{ss}</span>
                      </div>
                      <span style={S.messageText}>{c.text}</span>
                    </div>
                    {c.userId && c.userId !== user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleReply(c)}
                        disabled={replyLoading && replyingTo?.userId === c.userId}
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                          background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
                          opacity: replyLoading && replyingTo?.userId === c.userId ? 0.5 : 1,
                        }}
                      >
                        <Reply size={11} strokeWidth={2} />
                        Reply
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Raw data — only on Overview to keep other tabs clean */}
        {activeTab === 'overview' && (
          <div style={S.rawCard}>
            <button type="button" style={S.dataToggle} onClick={() => setDataOpen((v) => !v)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.5 }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Raw data
              </span>
              <ChevronDown
                size={15}
                style={{
                  transform: dataOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 200ms',
                  opacity: 0.4,
                }}
              />
            </button>
            {dataOpen && (
              <>
                <div style={{ ...S.replayDebugGrid, margin: '12px 0' }}>
                  {replayDebugRows.map(([label, value]) => (
                    <div key={label} style={S.replayDebugRow}>
                      <span>{label}</span>
                      <strong style={S.replayDebugValue}>{String(value)}</strong>
                    </div>
                  ))}
                </div>
                <pre style={S.dataPre}>{JSON.stringify(liveData, null, 2)}</pre>
              </>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div style={S.actions}>
          <button type="button" style={S.btnOutline} className="lrs-btn-outline" onClick={handleShare} disabled={finishing}>
            <Share2 size={15} />
            Share
          </button>
          <button type="button" style={S.btnOutline} className="lrs-btn-outline" onClick={handleSave} disabled={finishing}>
            <Download size={15} />
            Save card
          </button>
          {liveData?.replayUrl && (
            <button type="button" style={S.btnOutline} className="lrs-btn-outline" onClick={handleDownloadReplay} disabled={finishing || downloadingReplay}>
              {downloadingReplay ? (
                <Loader size={15} style={{ animation: 'lrs-spin 1s linear infinite' }} />
              ) : (
                <Download size={15} />
              )}
              {downloadingReplay ? 'Preparing…' : 'Download MP4'}
            </button>
          )}
          <button type="button" style={S.btnPrimary} className="lrs-btn-primary" onClick={handleFinish} disabled={finishing}>
            {finishing ? (
              <Loader size={15} style={{ animation: 'lrs-spin 1s linear infinite' }} />
            ) : (
              <Check size={15} strokeWidth={2.5} />
            )}
            {finishing ? 'Finishing…' : 'Done'}
          </button>
        </div>
      </div>

      {/* Recap Card Modal */}
      {cardModal && (
        <div style={SM.overlay} onClick={() => setCardModal(null)}>
          <div style={SM.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={SM.sheetHeader}>
              <span style={SM.sheetTitle}>
                {cardModal === 'share' ? 'Share your recap' : 'Save your recap'}
              </span>
              <button type="button" style={SM.closeBtn} onClick={() => setCardModal(null)}>
                <X size={17} />
              </button>
            </div>
            <div style={SM.cardScroll}>
              <RecapCard liveData={liveData} statValues={statValues} cardRef={cardRef} coverDataUrl={coverDataUrl} />
            </div>
            <button
              type="button"
              style={SM.confirmBtn}
              disabled={exporting}
              onClick={cardModal === 'share' ? handleShareConfirm : handleSaveConfirm}
            >
              {exporting ? (
                <Loader size={16} style={{ animation: 'lrs-spin 1s linear infinite' }} />
              ) : cardModal === 'share' ? (
                <><Share2 size={16} /> Share image</>
              ) : (
                <><Download size={16} /> Download image</>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    height: '100%',
    overflowY: 'auto',
    background: 'var(--vuvio-bg)',
    color: 'var(--vuvio-text-primary)',
    fontFamily: 'inherit',
  },
  centeredState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: 'var(--vuvio-text-secondary)',
    fontSize: 15,
  },
  backToVuvioBtn: {
    marginTop: 4,
    padding: '10px 24px',
    borderRadius: 10,
    background: 'rgba(53,227,220,0.10)',
    border: '1px solid rgba(53,227,220,0.22)',
    color: 'var(--vuvio-cyan)',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--vuvio-border)',
    background: 'var(--vuvio-bg)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
    letterSpacing: 0.2,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(134,202,224,0.07)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: '50%',
    width: 36,
    height: 36,
    color: 'var(--vuvio-text-primary)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '0 16px',
    borderBottom: '1px solid var(--vuvio-border)',
    background: 'var(--vuvio-bg)',
    position: 'sticky',
    top: 60,
    zIndex: 9,
  },
  tab: {
    position: 'relative',
    background: 'none',
    border: 'none',
    padding: '14px 0',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--vuvio-text-muted)',
    cursor: 'pointer',
    transition: 'color 150ms',
    letterSpacing: 0.2,
  },
  tabActive: {
    color: 'var(--vuvio-text-primary)',
    boxShadow: 'inset 0 -2px 0 0 var(--vuvio-cyan)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '18px 16px 40px',
    flex: 1,
  },
  heroBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  },
  thumbBg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.3,
    filter: 'blur(10px)',
    transform: 'scale(1.08)',
  },
  thumbFg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    background: 'rgba(13,38,54,0.72)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.4,
    color: 'var(--vuvio-text-primary)',
  },
  playBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(13,38,54,0.75)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--vuvio-border-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--vuvio-text-primary)',
    cursor: 'pointer',
  },
  thumbMeta: {
    padding: '14px 2px 0',
  },
  streamTitle: {
    margin: '0 0 8px',
    fontSize: 22,
    fontWeight: 750,
    color: 'var(--vuvio-text-primary)',
    lineHeight: 1.2,
    letterSpacing: -0.2,
  },
  tagsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 9px',
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--vuvio-text-muted)',
    letterSpacing: 0.1,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: '14px 14px 16px',
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'border-color 150ms',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--vuvio-text-primary)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--vuvio-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: '0 2px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
    letterSpacing: 0.1,
  },
  sectionHint: {
    fontSize: 11,
    color: 'var(--vuvio-text-muted)',
    fontWeight: 500,
    letterSpacing: 0.3,
  },
  chartCard: {
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '14px 16px 12px',
    transition: 'border-color 150ms',
  },
  chartBox: {
    width: '100%',
    marginTop: 4,
  },
  chartAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 6,
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--vuvio-text-muted)',
    letterSpacing: 0.4,
  },
  insightCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'border-color 150ms',
  },
  insightIcon: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(53,227,220,0.10)',
    border: '1px solid rgba(53,227,220,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBody: {
    flex: 1,
    minWidth: 0,
  },
  insightHeadline: {
    margin: '0 0 3px',
    fontSize: 14,
    fontWeight: 650,
    color: 'var(--vuvio-text-primary)',
    lineHeight: 1.3,
  },
  insightAccent: {
    color: 'var(--vuvio-cyan)',
    fontWeight: 750,
  },
  insightDetail: {
    margin: 0,
    fontSize: 12,
    color: 'var(--vuvio-text-muted)',
    lineHeight: 1.4,
  },
  highlightsSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  highlightsStrip: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    padding: '2px 2px 6px',
    marginLeft: -2,
    marginRight: -2,
    scrollSnapType: 'x mandatory',
  },
  highlightCard: {
    flexShrink: 0,
    width: 148,
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 150ms, border-color 150ms',
    display: 'flex',
    flexDirection: 'column',
    scrollSnapAlign: 'start',
  },
  highlightThumb: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    overflow: 'hidden',
    background: '#0c1e34',
  },
  highlightImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  highlightTimePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    background: 'rgba(8,17,30,0.72)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.2,
  },
  highlightPlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(8,17,30,0.75)',
    border: '1px solid rgba(255,255,255,0.14)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  highlightLabel: {
    padding: '9px 10px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--vuvio-text-primary)',
    lineHeight: 1.3,
    letterSpacing: 0.1,
  },
  shareCta: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px 18px',
    background: 'linear-gradient(135deg, rgba(53,227,220,0.08), rgba(59,130,246,0.04))',
    border: '1px solid rgba(53,227,220,0.22)',
    borderRadius: 'var(--radius-md)',
    transition: 'border-color 150ms',
  },
  shareCtaBody: {
    flex: 1,
    minWidth: 0,
  },
  shareCtaTitle: {
    margin: '0 0 4px',
    fontSize: 14,
    fontWeight: 650,
    color: 'var(--vuvio-text-primary)',
    lineHeight: 1.35,
  },
  shareCtaAccent: {
    color: 'var(--vuvio-cyan)',
    fontWeight: 800,
  },
  shareCtaSub: {
    margin: 0,
    fontSize: 12,
    color: 'var(--vuvio-text-muted)',
    lineHeight: 1.4,
  },
  shareCtaBtn: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    background: 'var(--vuvio-cyan)',
    border: 'none',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-ink)',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(53,227,220,0.3)',
    transition: 'opacity 150ms',
  },
  card: {
    background: 'var(--vuvio-bg-elevated)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '14px 16px',
    transition: 'border-color 150ms',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  cardTitleNoMargin: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
  },
  replayStatusHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  replayStatusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginTop: 4,
    flexShrink: 0,
    boxShadow: '0 0 12px currentColor',
  },
  replayStatusDetail: {
    margin: '4px 0 0',
    color: 'var(--vuvio-text-muted)',
    fontSize: 12,
    lineHeight: 1.4,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, var(--vuvio-blue), var(--vuvio-cyan))',
  },
  messagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  messageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  avatar: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  messageBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  messageNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  messageName: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
  },
  messageMeta: {
    fontSize: 11,
    color: 'var(--vuvio-text-muted)',
  },
  messageText: {
    fontSize: 13,
    color: 'var(--vuvio-text-secondary)',
    lineHeight: 1.4,
  },
  rawCard: {
    background: 'transparent',
    border: '1px solid var(--vuvio-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
  },
  dataToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--vuvio-text-muted)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    letterSpacing: 0.3,
  },
  replayDebugGrid: {
    display: 'grid',
    gap: 7,
  },
  replayDebugRow: {
    display: 'grid',
    gridTemplateColumns: '88px minmax(0, 1fr)',
    gap: 10,
    alignItems: 'baseline',
    fontSize: 11,
    color: 'var(--vuvio-text-muted)',
  },
  replayDebugValue: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--vuvio-text-secondary)',
    fontWeight: 600,
  },
  dataPre: {
    marginTop: 10,
    fontSize: 10,
    color: 'var(--vuvio-text-muted)',
    overflow: 'auto',
    maxHeight: 280,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  btnOutline: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '13px 10px',
    background: 'rgba(134,202,224,0.05)',
    border: '1px solid var(--vuvio-border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--vuvio-text-primary)',
    cursor: 'pointer',
    transition: 'background 150ms, border-color 150ms',
  },
  btnPrimary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '13px 10px',
    background: 'var(--vuvio-cyan)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-ink)',
    cursor: 'pointer',
    transition: 'opacity 150ms',
    boxShadow: '0 4px 16px rgba(53,227,220,0.25)',
  },
};

const SM = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--vuvio-bg-elevated)',
    borderRadius: '24px 24px 0 0',
    border: '1px solid var(--vuvio-border)',
    borderBottom: 'none',
    padding: '20px 20px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--vuvio-text-primary)',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(134,202,224,0.07)',
    border: '1px solid var(--vuvio-border)',
    borderRadius: '50%',
    width: 32,
    height: 32,
    color: 'var(--vuvio-text-primary)',
    cursor: 'pointer',
  },
  cardScroll: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    overflowX: 'auto',
    paddingBottom: 4,
  },
  confirmBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 20px',
    background: 'var(--vuvio-cyan)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-ink)',
    cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(53,227,220,0.22)',
  },
};
