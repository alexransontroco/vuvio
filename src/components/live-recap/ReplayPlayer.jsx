import Hls from 'hls.js';
import { Expand, Gauge, Loader, Pause, Play, RotateCcw, RotateCw, Star } from 'lucide-react';
import { useEffect, useRef } from 'react';
import BrandMark from '../BrandMark.jsx';

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function HlsVideo({ src, poster }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
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
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000', borderRadius: 12 }}
    />
  );
}

function ProcessingState() {
  return (
    <section className="replay-player" aria-label="Replay player" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#0a0a0f' }}>
      <Loader size={32} style={{ opacity: 0.5, animation: 'spin 1s linear infinite' }} />
      <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>Replay being processed…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

export default function ReplayPlayer({ live, activeHighlight, playing, speed, onTogglePlay, onSeek, onNudge, onSpeed, onFullscreen, src, poster }) {
  // Real replay available
  if (src) {
    return (
      <section className="replay-player" aria-label="Replay player" style={{ background: '#000' }}>
        <HlsVideo src={src} poster={poster} />
      </section>
    );
  }

  // Live data exists but replay not ready yet
  if (src === '') {
    return <ProcessingState />;
  }

  // No live context — show mock UI
  const progress = Math.min(100, Math.max(0, (activeHighlight.seconds / live.duration) * 100));

  return (
    <section className="replay-player" aria-label="Replay player">
      <img src={live.replayImage} alt="Replay frame from the mountain bike ride" />
      <div className="replay-player__shade" />
      <div className="replay-player__watermark">
        <BrandMark size={24} />
        <span>VUVIO</span>
      </div>
      <button type="button" className="replay-player__center" onClick={onTogglePlay} aria-label={playing ? 'Pause replay' : 'Play replay'}>
        {playing ? <Pause size={34} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>
      <div className="replay-player__skip replay-player__skip--back">
        <button type="button" onClick={() => onNudge(-10)} aria-label="Rewind 10 seconds">
          <RotateCcw size={25} />
          <span>10</span>
        </button>
      </div>
      <div className="replay-player__skip replay-player__skip--forward">
        <button type="button" onClick={() => onNudge(10)} aria-label="Forward 10 seconds">
          <RotateCw size={25} />
          <span>10</span>
        </button>
      </div>
      <div className="replay-player__controls">
        <div className="replay-player__time">
          <span>{activeHighlight.timestamp}</span>
          <span>/ 46:00</span>
        </div>
        <input
          type="range"
          min="0"
          max={live.duration}
          value={activeHighlight.seconds}
          onChange={(event) => onSeek(Number(event.target.value))}
          aria-label="Replay position"
        />
        <button type="button" aria-label="Save moment"><Star size={20} /></button>
        <button type="button" onClick={onSpeed} aria-label="Toggle playback speed">
          <Gauge size={17} />
          <span>{speed}x</span>
        </button>
        <button type="button" onClick={onFullscreen} aria-label="Fullscreen"><Expand size={19} /></button>
      </div>
    </section>
  );
}
