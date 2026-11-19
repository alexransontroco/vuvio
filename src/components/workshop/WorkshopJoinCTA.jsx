import { useTranslation } from 'react-i18next';
import { Hand, Users } from 'lucide-react';

/**
 * Entry button rendered at the bottom of the WatchPage viewer UI when a
 * live is configured as participation !== 'off'.
 * Keeps the classic .live-actions stack intact: it sits ABOVE them on its
 * own anchor (see .workshop-cta in workshop.css).
 */
export default function WorkshopJoinCTA({
  mode,
  participationConfig,
  myParticipant,
  myJoinRequest,
  participantCount = 0,
  maxParticipants = 0,
  onOpen,
}) {
  const { t } = useTranslation();
  if (mode === 'off' || !mode) return null;

  const isParticipating = Boolean(myParticipant);
  const isPending = myJoinRequest?.status === 'pending' && !isParticipating;

  let label = t('workshop.joinCta');
  let cls = 'workshop-cta__btn';
  if (isParticipating) {
    label = t('workshop.joinCtaActive');
    cls += ' is-active';
  } else if (isPending) {
    label = t('workshop.joinCtaPending');
    cls += ' is-pending';
  }

  return (
    <div className="workshop-cta">
      <button type="button" className={cls} onClick={onOpen}>
        {isParticipating ? <Users size={16} strokeWidth={2.2} /> : <Hand size={16} strokeWidth={2.2} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {participationConfig?.activityTitle || label}
        </span>
        {maxParticipants > 0 ? (
          <span className="workshop-cta__badge">
            <Users size={11} strokeWidth={2.2} />
            {participantCount}/{maxParticipants}
          </span>
        ) : null}
      </button>
    </div>
  );
}
