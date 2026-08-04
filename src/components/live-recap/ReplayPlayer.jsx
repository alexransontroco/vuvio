import { Expand, Gauge, Pause, Play, RotateCcw, RotateCw, Star } from 'lucide-react';
import BrandMark from '../BrandMark.jsx';

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function ReplayPlayer({ live, activeHighlight, playing, speed, onTogglePlay, onSeek, onNudge, onSpeed, onFullscreen }) {
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
