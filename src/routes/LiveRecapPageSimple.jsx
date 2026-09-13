import Hls from 'hls.js';
import { Check, ChevronDown, ChevronLeft, Clock, Download, Loader, MessageSquare, Share2, Star, Users, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot, collection, getDocs, query } from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { db } from '../firebase.js';
import { endLive } from '../services/createdLiveService.js';
import { useAuth } from '../context/AuthContext.jsx';

function ReplayPlayer({ src, poster }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.muted = false; });
      return () => hls.destroy();
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
  { key: 'duration',    label: 'DURATION',     Icon: Clock,         color: '#3b82f6', bg: 'rgba(59,130,246,0.18)' },
  { key: 'peak',        label: 'PEAK VIEWERS', Icon: Users,         color: '#818cf8', bg: 'rgba(129,140,248,0.18)' },
  { key: 'messages',    label: 'MESSAGES',     Icon: MessageSquare, color: '#22c55e', bg: 'rgba(34,197,94,0.18)'  },
  { key: 'stars',       label: 'STARS',        Icon: Star,          color: '#eab308', bg: 'rgba(234,179,8,0.18)'  },
];

const CLOUDFARE_REPLAY_DISABLED_TEXT = 'Cloudflare replay is disabled for this live input or account.';

function RecapCard({ liveData, statValues, cardRef }) {
  return (
    <div ref={cardRef} style={SC.card}>
      {/* Background image */}
      {liveData.image && (
        <img src={liveData.image} alt="" style={SC.bgImg} crossOrigin="anonymous" />
      )}
      <div style={SC.bgOverlay} />

      {/* Content */}
      <div style={SC.inner}>
        {/* Badge */}
        <div style={SC.badge}>RECAP</div>

        {/* Thumbnail */}
        <div style={SC.thumbBox}>
          {liveData.image ? (
            <img src={liveData.image} alt="" style={SC.thumb} crossOrigin="anonymous" />
          ) : (
            <div style={{ ...SC.thumb, background: '#0c1e34' }} />
          )}
        </div>

        {/* Title */}
        <p style={SC.title}>{liveData.title || 'Live stream'}</p>
        {liveData.location && <p style={SC.location}>{liveData.location}</p>}

        {/* Stats row */}
        <div style={SC.statsRow}>
          {STAT_DEFS.map(({ key, label, Icon, color }) => (
            <div key={key} style={SC.stat}>
              <Icon size={14} color={color} strokeWidth={2} />
              <strong style={SC.statVal}>{statValues[key]}</strong>
              <span style={SC.statLbl}>{label}</span>
            </div>
          ))}
        </div>

        {/* Branding */}
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
  const [cardModal, setCardModal] = useState(null); // 'share' | 'save' | null
  const [exporting, setExporting] = useState(false);
  const [pctComplete, setPctComplete] = useState(null);
  const [replayState, setReplayState] = useState('processing'); // 'processing' | 'no_footage' | 'timeout'
  const liveDataRef = useRef(null);
  const cardRef = useRef(null);
  const pollCountRef = useRef(0);
  const emptyPollStreakRef = useRef(0);

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

    const replayStateRef = { current: 'processing' };
    const poll = async () => {
      if (liveDataRef.current?.replayUrl) return;
      if (replayStateRef.current !== 'processing') return;
      pollCountRef.current += 1;
      // ~20 minutes timeout (80 × 15s)
      if (pollCountRef.current > 80) {
        replayStateRef.current = 'timeout';
        setReplayState('timeout');
        return;
      }
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(liveId)}/replay-status`);
        if (res.ok) {
          const data = await res.json();
          console.log('[LiveRecapSimple] poll #' + pollCountRef.current + ':', data.recordingStatus, data.replayUrl || '', '| liveInputUid:', data.liveInputUid || 'MISSING', '| cloudflareUid:', data.cloudflareUid || 'none', '| pctComplete:', data.pctComplete ?? '—', '| state:', data.state || '—', '| videosFound:', data.videosFound ?? '—');
          if (data.replayUrl) {
            liveDataRef.current = { ...liveDataRef.current, replayUrl: data.replayUrl, recordingStatus: 'ready' };
            setLiveData(prev => prev ? { ...prev, replayUrl: data.replayUrl, recordingStatus: 'ready' } : prev);
          } else if (data.recordingStatus === 'processing_failed') {
            replayStateRef.current = 'no_footage';
            setReplayState('no_footage');
          } else if ((data.videosFound ?? 1) === 0) {
            emptyPollStreakRef.current += 1;
            // After 20 consecutive polls (5 min) with no Cloudflare videos at all → no footage
            // Cloudflare needs several minutes after WHIP stream ends to finalize the recording
            if (emptyPollStreakRef.current >= 20) {
              replayStateRef.current = 'no_footage';
              setReplayState('no_footage');
            }
          } else {
            // Videos found — still processing
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
        const docs = snap.docs.map((d) => d.data());
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

  const handleFinish = async () => {
    const liveId = location.pathname.split('/')[2];
    if (!liveId) return;
    setFinishing(true);
    try {
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

  if (loading) {
    return (
      <main style={S.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#86cae0', fontSize: 18 }}>
          Loading recap...
        </div>
      </main>
    );
  }

  if (!liveData) {
    return (
      <main style={S.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#86cae0', fontSize: 18 }}>
          No data found
        </div>
      </main>
    );
  }

  // Only the broadcaster can see the recap
  if (liveData.creatorUid && user?.uid !== liveData.creatorUid) {
    return (
      <main style={S.page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: '100%', padding: 32, textAlign: 'center', color: '#86cae0' }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e2eaf4' }}>Private recap</p>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.6 }}>Only the broadcaster can view this recap.</p>
          <button type="button" style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, background: 'rgba(43,217,200,0.15)', border: '1px solid rgba(43,217,200,0.3)', color: '#2bd9c8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/watch', { replace: true })}>
            Back to Vuvio
          </button>
        </div>
      </main>
    );
  }

  const duration = liveData.durationSeconds || 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const isProcessing = !liveData.replayUrl && replayState === 'processing';

  const statValues = {
    duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
    peak: liveData.peakViewerCount ?? 0,
    messages: liveData.commentCount ?? comments.length ?? 0,
    stars: liveData.starCount ?? 0,
  };

  return (
    <main style={S.page}>
      <style>{`
        @keyframes lrs-spin { to { transform: rotate(360deg); } }
        @media (min-width: 700px) {
          .lrs-body { flex-direction: row !important; align-items: flex-start !important; }
          .lrs-left { width: 300px !important; flex-shrink: 0 !important; }
          .lrs-right { flex: 1 !important; }
          .lrs-stats { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (max-width: 699px) {
          .lrs-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {/* Header */}
      <header style={S.header}>
        <button type="button" style={S.backBtn} onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 style={S.headerTitle}>Live Recap</h1>
        <button type="button" style={S.shareHeaderBtn} onClick={handleShare}>
          <Share2 size={18} strokeWidth={2} />
        </button>
      </header>

      {/* Body */}
      <div style={S.body} className="lrs-body">
        {/* Left — thumbnail */}
        <div style={S.left} className="lrs-left">
          <div style={S.thumbWrap}>
            {liveData.replayUrl ? null : replayState === 'no_footage' ? (
              <>
                {liveData.image && <img src={liveData.image} alt="" style={S.thumbBg} />}
                <div style={S.processingOverlay}>
                  <X size={28} color="rgba(226,234,244,0.4)" />
                  <p style={S.processingTitle}>Replay unavailable</p>
                  <span style={S.processingSubtitle}>{CLOUDFARE_REPLAY_DISABLED_TEXT}</span>
                </div>
              </>
            ) : replayState === 'timeout' ? (
              <>
                {liveData.image && <img src={liveData.image} alt="" style={S.thumbBg} />}
                <div style={S.processingOverlay}>
                  <X size={28} color="rgba(226,234,244,0.4)" />
                  <p style={S.processingTitle}>Replay unavailable</p>
                  <span style={S.processingSubtitle}>Cloudflare took too long to process the recording.</span>
                </div>
              </>
            ) : isProcessing ? (
              <>
                {liveData.image && (
                  <img src={liveData.image} alt="" style={S.thumbBg} />
                )}
                <div style={S.processingOverlay}>
                  <Loader size={28} style={S.spinner} />
                  <p style={S.processingTitle}>Replay processing…</p>
                  <span style={S.processingSubtitle}>
                    {pctComplete != null ? `${pctComplete}% done` : 'Usually ready in a few minutes'}
                  </span>
                </div>
              </>
            ) : null}
            {liveData.replayUrl ? (
              <ReplayPlayer src={liveData.replayUrl} poster={liveData.image} />
            ) : null}
            {/* LIVE badge */}
            <div style={S.recapBadge}>RECAP</div>
          </div>
          {/* Title + meta below thumb */}
          <div style={S.thumbMeta}>
            <p style={S.streamTitle}>{liveData.title || 'Untitled'}</p>
            <span style={S.streamLabel}>
              {liveData.location ? `${liveData.location}` : 'Live stream'}
            </span>
          </div>
        </div>

        {/* Right — stats + messages + actions */}
        <div style={S.right} className="lrs-right">
          {/* Stat cards */}
          <div style={S.statsRow} className="lrs-stats">
            {STAT_DEFS.map(({ key, label, Icon, color, bg }) => (
              <div key={key} style={S.statCard}>
                <div style={{ ...S.statIcon, background: bg }}>
                  <Icon size={20} color={color} strokeWidth={1.8} />
                </div>
                <strong style={S.statValue}>{statValues[key]}</strong>
                <span style={S.statLabel}>{label}</span>
              </div>
            ))}
          </div>

          {/* Messages */}
          {comments.length > 0 && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>
                <MessageSquare size={15} strokeWidth={2} style={{ opacity: 0.7 }} />
                Messages
              </h3>
              <div style={S.messagesList}>
                {comments.slice(0, 5).map((c, i) => {
                  const secs = c.liveElapsedSeconds ?? 0;
                  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
                  const ss = String(secs % 60).padStart(2, '0');
                  const initial = (c.userDisplayName || '?').slice(0, 1).toUpperCase();
                  return (
                    <div key={i} style={S.messageRow}>
                      <div style={S.avatar}>{initial}</div>
                      <div style={S.messageBody}>
                        <strong style={S.messageName}>{c.userDisplayName || 'Viewer'}</strong>
                        <span style={S.messageMeta}>{mm}:{ss}</span>
                        <span style={S.messageText}>{c.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data Details collapsible */}
          <div style={S.card}>
            <button type="button" style={S.dataToggle} onClick={() => setDataOpen((v) => !v)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Raw data
              </span>
              <ChevronDown size={16} style={{ transform: dataOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', opacity: 0.5 }} />
            </button>
            {dataOpen && (
              <pre style={S.dataPre}>{JSON.stringify(liveData, null, 2)}</pre>
            )}
          </div>

          {/* Actions */}
          <div style={S.actions}>
            <button type="button" style={S.btnOutline} onClick={handleShare} disabled={finishing}>
              <Share2 size={16} />
              Share
            </button>
            <button type="button" style={S.btnOutline} onClick={handleSave} disabled={finishing}>
              <Download size={16} />
              Save
            </button>
            <button type="button" style={S.btnPrimary} onClick={handleFinish} disabled={finishing}>
              <Check size={16} />
              {finishing ? 'Finishing…' : 'Done'}
            </button>
          </div>
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
                <X size={18} />
              </button>
            </div>

            {/* The card */}
            <div style={SM.cardScroll}>
              <RecapCard liveData={liveData} statValues={statValues} cardRef={cardRef} />
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
    background: '#08111e',
    color: '#e2eaf4',
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(8,17,30,0.95)',
    backdropFilter: 'blur(12px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.3,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    color: '#e2eaf4',
    cursor: 'pointer',
  },
  shareHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.07)',
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    color: '#e2eaf4',
    cursor: 'pointer',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '20px 16px 40px',
    flex: 1,
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '9 / 16',
    borderRadius: 18,
    overflow: 'hidden',
    background: '#0c1e34',
    boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
  },
  thumbBg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.35,
    filter: 'blur(8px)',
  },
  processingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    textAlign: 'center',
    background: 'rgba(8,17,30,0.5)',
  },
  processingTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  processingSubtitle: {
    fontSize: 13,
    color: 'rgba(226,234,244,0.5)',
    lineHeight: 1.4,
  },
  spinner: {
    color: '#86cae0',
    animation: 'lrs-spin 1.2s linear infinite',
  },
  recapBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: '#fff',
  },
  thumbMeta: {
    padding: '14px 2px 0',
  },
  streamTitle: {
    margin: '0 0 4px',
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.25,
  },
  streamLabel: {
    fontSize: 13,
    color: 'rgba(226,234,244,0.45)',
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '16px 16px 18px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'rgba(226,234,244,0.45)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '16px 18px',
  },
  cardTitle: {
    margin: '0 0 14px',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  messagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },
  messageBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  messageName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },
  messageMeta: {
    fontSize: 11,
    color: 'rgba(226,234,244,0.4)',
  },
  messageText: {
    fontSize: 13,
    color: 'rgba(226,234,244,0.75)',
    lineHeight: 1.4,
  },
  dataToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(226,234,244,0.55)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  dataPre: {
    marginTop: 14,
    fontSize: 11,
    color: 'rgba(226,234,244,0.45)',
    overflow: 'auto',
    maxHeight: 300,
  },
  actions: {
    display: 'flex',
    gap: 10,
    marginTop: 2,
  },
  btnOutline: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '13px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: '#e2eaf4',
    cursor: 'pointer',
  },
  btnPrimary: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '13px 12px',
    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  },
};

const SM = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    background: '#0f1f35',
    borderRadius: '24px 24px 0 0',
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
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    borderRadius: '50%',
    width: 32,
    height: 32,
    color: '#e2eaf4',
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
    padding: '15px 20px',
    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
    border: 'none',
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
  },
};
