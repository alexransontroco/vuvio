import { useTranslation } from 'react-i18next';
import LiveBadge from './LiveBadge.jsx';
import CreatorLink from './CreatorLink.jsx';

export default function StreamPreviewCard({ stream, onWatch }) {
  const { t } = useTranslation();
  return (
    <article className="stream-preview">
      <div className="stream-preview__image">
        <img src={stream.image} alt={t('streamPreview.povAlt', { role: stream.role })} />
        <LiveBadge compact />
      </div>
      <div className="stream-preview__body">
        <strong>{stream.name}</strong>
        <span>
          {t('streamPreview.summary', { role: stream.role, place: stream.place, viewers: stream.viewerLabel })}
        </span>
        <CreatorLink creator={stream} compact />
      </div>
      <button type="button" onClick={onWatch}>
        {t('common.watch')}
      </button>
    </article>
  );
}
