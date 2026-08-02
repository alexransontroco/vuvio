import { ArrowLeft, BarChart3, Camera, Flame, MessageCircle, MoreHorizontal, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import BottomNav from '../components/BottomNav.jsx';
import ConversationInsights from '../components/live-recap/ConversationInsights.jsx';
import LiveAnalyticsBar from '../components/live-recap/LiveAnalyticsBar.jsx';
import LiveHighlights from '../components/live-recap/LiveHighlights.jsx';
import LiveRecapHero from '../components/live-recap/LiveRecapHero.jsx';
import LiveRecapSidebar from '../components/live-recap/LiveRecapSidebar.jsx';
import { SimpleModal } from '../components/live-recap/LiveRecapModals.jsx';
import PostLiveActions from '../components/live-recap/PostLiveActions.jsx';
import ReplayPlayer from '../components/live-recap/ReplayPlayer.jsx';
import ReplayTimeline from '../components/live-recap/ReplayTimeline.jsx';
import ReplyDrawer from '../components/live-recap/ReplyDrawer.jsx';
import SmartSummary from '../components/live-recap/SmartSummary.jsx';
import SynchronizedChat from '../components/live-recap/SynchronizedChat.jsx';
import { liveRecap } from '../data/liveRecapMock.js';

const speeds = [1, 1.2, 1.5, 2];

const chipIconMap = {
  camera: MessageCircle,
  downhill: Star,
  trail: BarChart3,
  unanswered: MessageCircle,
};

const momentIconMap = {
  chart: BarChart3,
  star: Star,
  message: MessageCircle,
  flame: Flame,
  camera: Camera,
};

function ConversationChip({ item, onOpen }) {
  const Icon = chipIconMap[item.id] ?? MessageCircle;
  return (
    <article className={`conversation-chip conversation-chip--${item.tone}`}>
      <span className="conversation-chip__label">
        <Icon size={12} style={{ display: 'inline', marginRight: 4 }} />
        {item.label}
      </span>
      <p className="conversation-chip__text">{item.text}</p>
      <div className="conversation-chip__meta">
        <span className="conversation-chip__count">{item.count}</span>
        <button type="button" className="conversation-chip__cta" onClick={() => onOpen(item)}>
          {item.action}
        </button>
      </div>
    </article>
  );
}

function MomentCard({ item, active, onSelect }) {
  const Icon = momentIconMap[item.icon] ?? Star;
  return (
    <button
      type="button"
      className={`moment-card ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(item)}
      aria-label={`${item.title} at ${item.timestamp}`}
    >
      <div className="moment-card__thumb">
        {item.thumbnail === 'chart' ? (
          <svg viewBox="0 0 92 48" style={{ width: '100%', height: '100%', padding: 8 }} aria-hidden="true">
            <path d="M2 38 L11 34 L18 36 L25 28 L33 31 L41 22 L50 26 L58 18 L67 21 L75 13 L90 9" fill="none" stroke="#8ebcff" strokeWidth="2" />
            <line x1="2" x2="90" y1="38" y2="38" stroke="rgba(142,188,255,0.22)" />
          </svg>
        ) : (
          <img src={item.thumbnail} alt="" />
        )}
        <span className={`moment-card__icon moment-card__icon--${item.tone}`}><Icon size={14} /></span>
      </div>
      <strong className="moment-card__title">{item.title}</strong>
      <span className="moment-card__text">{item.text}</span>
      <time className="moment-card__time">{item.timestamp}</time>
    </button>
  );
}

export default function LiveRecapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const replayRef = useRef(null);
  const [activeId, setActiveId] = useState('chat');
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [drawerConversation, setDrawerConversation] = useState(null);
  const [modal, setModal] = useState(null);

  // Cleanup Cloudflare live input when leaving recap page
  useEffect(() => {
    const liveId = location.state?.liveId;
    if (!liveId) return;

    return () => {
      // When user leaves the recap page, delete the Cloudflare live input
      (async () => {
        try {
          const liveRef = doc(db, 'activeLives', liveId);
          const liveSnap = await getDoc(liveRef);
          const liveInputId = liveSnap.data()?.liveInputId;

          if (liveInputId) {
            await fetch('/api/cloudflare/delete-input', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ liveInputId }),
            });
            console.log('[LiveRecapPage] Cloudflare live input deleted:', liveInputId);
          }
        } catch (err) {
          console.error('[LiveRecapPage] Cleanup failed:', err.message);
        }
      })();
    };
  }, [location.state?.liveId]);

  const activeHighlight = useMemo(
    () => liveRecap.highlights.find((item) => item.id === activeId) ?? liveRecap.highlights[0],
    [activeId],
  );
  const chatMessages = liveRecap.chatByHighlight[activeHighlight.id] ?? liveRecap.chatByHighlight.chat;

  const selectHighlight = (highlight) => {
    setActiveId(highlight.id);
    if (replayRef.current) {
      const rect = replayRef.current.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
    }
  };

  const seekToSeconds = (seconds) => {
    const closest = liveRecap.highlights.reduce((best, item) => (
      Math.abs(item.seconds - seconds) < Math.abs(best.seconds - seconds) ? item : best
    ), liveRecap.highlights[0]);
    setActiveId(closest.id);
  };

  const handleAction = (id) => {
    if (id === 'reply') {
      setDrawerConversation(liveRecap.conversations[3]);
      return;
    }
    setModal(id);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: liveRecap.title, text: 'Vuvio live recap', url: window.location.href }).catch(() => {});
      return;
    }
    setModal('share');
  };

  const handleMockDownload = () => {
    const csv = 'metric,value\nAvg Viewers,842\nPeak Viewers,1600\nStars Received,3215\nNew Followers,124\nTotal Messages,287\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vuvio-live-recap-stats.csv';
    a.click();
    URL.revokeObjectURL(url);
    setModal(null);
  };

  return (
    <main className="live-recap-page">

      {/* ── Mobile sticky header ──────────────────────────────── */}
      <header className="live-recap-header live-recap--mobile-only">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>Live Recap</h1>
        <button type="button" onClick={() => setModal('menu')} aria-label="More options">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <LiveRecapSidebar />

      <div className="live-recap-main">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <LiveRecapHero live={liveRecap} onShare={handleShare} onMenu={() => setModal('menu')} />

        {/* ── Creator message (mobile only) ─────────────────── */}
        <div className="live-recap-message live-recap--mobile-only">
          <h2>Your live is ready to review</h2>
          <p>See what viewers asked, revisit key moments and reply when you're available.</p>
        </div>

        {/* ── Analytics ─────────────────────────────────────────── */}
        <LiveAnalyticsBar stats={liveRecap.stats} />

        {/* ── Priority: unanswered (mobile only) ────────────── */}
        <div className="live-recap-priority live-recap--mobile-only">
          <div className="live-recap-priority__content">
            <span className="live-recap-priority__icon"><MessageCircle size={20} /></span>
            <div>
              <strong>12 unanswered questions</strong>
              <p>Some viewers asked similar questions during your ride.</p>
            </div>
          </div>
          <button type="button" onClick={() => setDrawerConversation(liveRecap.conversations[3])}>
            <MessageCircle size={15} />
            Review questions
          </button>
        </div>

        {/* ── Conversations carousel (mobile only) ──────────── */}
        <div className="live-recap-section live-recap--mobile-only">
          <div className="live-recap-section-heading">
            <h2>Messages</h2>
            <button type="button" onClick={() => setDrawerConversation(liveRecap.conversations[0])}>View all</button>
          </div>
          <div className="live-recap-scroll-track">
            {liveRecap.conversations.slice(0, 3).map((item) => (
              <ConversationChip key={item.id} item={item} onOpen={setDrawerConversation} />
            ))}
          </div>
        </div>

        {/* ── Key moments carousel (mobile only) ────────────── */}
        <div className="live-recap-section live-recap--mobile-only">
          <div className="live-recap-section-heading">
            <h2>Key moments</h2>
          </div>
          <div className="live-recap-scroll-track">
            {liveRecap.highlights.map((item) => (
              <MomentCard key={item.id} item={item} active={item.id === activeId} onSelect={selectHighlight} />
            ))}
          </div>
        </div>

        {/* ── Desktop two-column insights ────────────────────── */}
        <div className="live-recap-insights live-recap--desktop-only">
          <ConversationInsights conversations={liveRecap.conversations} onOpen={setDrawerConversation} />
          <LiveHighlights highlights={liveRecap.highlights} activeId={activeId} onSelect={selectHighlight} />
        </div>

        {/* ── Replay section ────────────────────────────────────── */}
        <div className="live-recap-section" style={{ marginTop: 28 }}>
          <div className="live-recap-section-heading live-recap--mobile-only">
            <h2>Replay</h2>
            <span className="live-recap-replay-expiry">Available for 24 hours</span>
          </div>

          <div className="live-recap-replay-wrap" ref={replayRef}>
            <ReplayTimeline
              highlights={liveRecap.highlights}
              activeId={activeId}
              onSelect={selectHighlight}
              onOpenPlayer={() => setModal('player')}
            />
            <div className="live-recap-replay-inner">
              <ReplayPlayer
                live={liveRecap}
                activeHighlight={activeHighlight}
                playing={playing}
                speed={speeds[speedIndex]}
                onTogglePlay={() => setPlaying((v) => !v)}
                onSeek={seekToSeconds}
                onNudge={(amount) => seekToSeconds(activeHighlight.seconds + amount)}
                onSpeed={() => setSpeedIndex((v) => (v + 1) % speeds.length)}
                onFullscreen={() => setModal('player')}
              />
              <SynchronizedChat messages={chatMessages} activeTime={activeHighlight.timestamp} />
            </div>
          </div>
        </div>

        {/* ── Bottom section ────────────────────────────────────── */}
        <div className="live-recap-bottom-grid" style={{ marginTop: 20 }}>
          <SmartSummary summary={liveRecap.summary} tags={liveRecap.tags} />
          <PostLiveActions onAction={handleAction} onFeedback={() => setModal('feedback')} />
        </div>

      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <div className="live-recap-mobile-nav">
        <BottomNav />
      </div>

      {/* ── Sticky reply CTA (mobile only) ────────────────────── */}
      <div className="live-recap-sticky-cta live-recap--mobile-only">
        <button type="button" onClick={() => setDrawerConversation(liveRecap.conversations[3])}>
          <MessageCircle size={18} />
          Reply to 12 questions
        </button>
      </div>

      {/* ── Drawers & Modals ──────────────────────────────────── */}
      <ReplyDrawer
        open={Boolean(drawerConversation)}
        conversation={drawerConversation}
        onClose={() => setDrawerConversation(null)}
      />
      <SimpleModal
        type={modal}
        onClose={() => setModal(null)}
        onConfirm={modal === 'download' ? handleMockDownload : undefined}
      />
    </main>
  );
}
