import LiveBadge from './LiveBadge.jsx';
import CreatorLink from './CreatorLink.jsx';
import { Bookmark, Eye } from 'lucide-react';

export default function PovCard({ stream, onClick }) {
  return (
    <article className="pov-card">
      <button className="pov-card__open" type="button" onClick={onClick} aria-label={`Open ${stream.name}'s live`}>
        <img src={stream.image} alt={`${stream.role} POV`} />
        <span className="pov-card__shade" />
        <span className="pov-card__top">
          <LiveBadge compact />
          <span className="pov-card__top-actions">
            <span className="viewer-pill">
              <Eye size={13} strokeWidth={1.8} />
              {stream.viewerLabel}
            </span>
            <span className="pov-card__save" aria-hidden="true">
              <Bookmark size={17} strokeWidth={1.8} />
            </span>
          </span>
        </span>
        <span className="pov-card__meta">
          <strong>{stream.note ?? stream.role}</strong>
          <em>{stream.role}</em>
          <small>{stream.place}</small>
        </span>
      </button>
      <CreatorLink creator={stream} className="pov-card__creator" compact stopPropagation />
    </article>
  );
}
