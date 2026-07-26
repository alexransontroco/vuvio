import { useMemo, useRef, useState } from 'react';
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

export default function LiveRecapPage() {
  const replayRef = useRef(null);
  const [activeId, setActiveId] = useState('chat');
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [drawerConversation, setDrawerConversation] = useState(null);
  const [modal, setModal] = useState(null);

  const activeHighlight = useMemo(
    () => liveRecap.highlights.find((item) => item.id === activeId) ?? liveRecap.highlights[0],
    [activeId],
  );
  const chatMessages = liveRecap.chatByHighlight[activeHighlight.id] ?? liveRecap.chatByHighlight.chat;

  const selectHighlight = (highlight) => {
    setActiveId(highlight.id);
    if (replayRef.current) {
      const rect = replayRef.current.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + rect.top - 96, behavior: 'smooth' });
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vuvio-live-recap-stats.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setModal(null);
  };

  return (
    <main className="live-recap-page">
      <LiveRecapSidebar />
      <div className="live-recap-main">
        <LiveRecapHero live={liveRecap} onShare={handleShare} onMenu={() => setModal('menu')} />
        <LiveAnalyticsBar stats={liveRecap.stats} />

        <div className="live-recap-insights">
          <ConversationInsights conversations={liveRecap.conversations} onOpen={setDrawerConversation} />
          <LiveHighlights highlights={liveRecap.highlights} activeId={activeId} onSelect={selectHighlight} />
        </div>

        <ReplayTimeline
          highlights={liveRecap.highlights}
          activeId={activeId}
          onSelect={selectHighlight}
          onOpenPlayer={() => setModal('player')}
        />

        <div className="live-recap-replay-grid" ref={replayRef}>
          <ReplayPlayer
            live={liveRecap}
            activeHighlight={activeHighlight}
            playing={playing}
            speed={speeds[speedIndex]}
            onTogglePlay={() => setPlaying((current) => !current)}
            onSeek={seekToSeconds}
            onNudge={(amount) => seekToSeconds(activeHighlight.seconds + amount)}
            onSpeed={() => setSpeedIndex((current) => (current + 1) % speeds.length)}
            onFullscreen={() => setModal('player')}
          />
          <SynchronizedChat messages={chatMessages} activeTime={activeHighlight.timestamp} />
        </div>

        <div className="live-recap-bottom-grid">
          <SmartSummary summary={liveRecap.summary} tags={liveRecap.tags} />
          <PostLiveActions onAction={handleAction} onFeedback={() => setModal('feedback')} />
        </div>
      </div>
      <div className="live-recap-mobile-nav">
        <BottomNav />
      </div>
      <ReplyDrawer open={Boolean(drawerConversation)} conversation={drawerConversation} onClose={() => setDrawerConversation(null)} />
      <SimpleModal type={modal} onClose={() => setModal(null)} onConfirm={modal === 'download' ? handleMockDownload : undefined} />
    </main>
  );
}
