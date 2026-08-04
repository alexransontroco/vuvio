import LiveBadge from './LiveBadge.jsx';
import CreatorLink from './CreatorLink.jsx';

export default function StreamPreviewCard({ stream, onWatch }) {
  return (
    <article className="stream-preview">
      <div className="stream-preview__image">
        <img src={stream.image} alt={`${stream.role} POV`} />
        <LiveBadge compact />
      </div>
      <div className="stream-preview__body">
        <strong>{stream.name}</strong>
        <span>
          {stream.role} - {stream.place} - {stream.viewerLabel} watching
        </span>
        <CreatorLink creator={stream} compact />
      </div>
      <button type="button" onClick={onWatch}>
        Watch
      </button>
    </article>
  );
}
