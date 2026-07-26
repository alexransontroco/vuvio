import { BarChart3, Camera, Clapperboard, Expand, Flame, Info, MessageCircle, Star } from 'lucide-react';

const iconMap = {
  chart: BarChart3,
  star: Star,
  message: MessageCircle,
  flame: Flame,
  camera: Camera,
};

const DURATION = 2760; // 46 min in seconds

function toPercent(seconds) {
  return `${Math.min(96, Math.max(4, (seconds / DURATION) * 100)).toFixed(1)}%`;
}

export default function ReplayTimeline({ highlights, activeId, onSelect, onOpenPlayer }) {
  return (
    <section className="replay-timeline" aria-label="Replay timeline">
      <header className="replay-timeline__header">
        <div>
          <Clapperboard size={21} />
          <h2>Replay Timeline</h2>
          <Info size={16} strokeWidth={1.8} />
        </div>
        <button type="button" onClick={onOpenPlayer}>
          <Expand size={15} />
          <span>Open in full player</span>
        </button>
      </header>
      <div className="replay-timeline__track-wrap">
        <div className="replay-timeline__endcap">
          <strong>Start</strong>
          <span>07:32</span>
        </div>
        <div className="replay-timeline__track">
          {highlights.map((item) => {
            const Icon = iconMap[item.icon] ?? Star;
            return (
              <button
                key={item.id}
                type="button"
                className={`replay-marker replay-marker--${item.tone} ${activeId === item.id ? 'is-active' : ''}`}
                style={{ left: toPercent(item.seconds) }}
                onClick={() => onSelect(item)}
                aria-label={`${item.title} at ${item.timestamp}`}
              >
                <span><Icon size={18} /></span>
                <time>{item.timestamp}</time>
              </button>
            );
          })}
        </div>
        <div className="replay-timeline__endcap replay-timeline__endcap--right">
          <strong>End</strong>
          <span>08:18</span>
        </div>
      </div>
    </section>
  );
}
