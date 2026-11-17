import { useTranslation } from 'react-i18next';
import { Camera, CheckCircle2, Clock, Shield, Users, X } from 'lucide-react';

/**
 * Viewer-facing sheet with the explicit "join" consent flow.
 * - Explains that joining DOES NOT share POV publicly.
 * - Fires onRequestJoin / onCancel. All other states are derived from
 *   myJoinRequest / myParticipant.
 */
export default function WorkshopJoinSheet({
  participationConfig,
  participantCount = 0,
  maxParticipants = 0,
  myParticipant,
  myJoinRequest,
  onRequestJoin,
  onCancel,
  onOpenParticipantHUD,
  onClose,
}) {
  const { t } = useTranslation();

  const isFull = maxParticipants > 0 && participantCount >= maxParticipants;
  const status = myJoinRequest?.status || null;
  const isParticipating = Boolean(myParticipant);

  let statusBlock = null;
  if (isParticipating) {
    statusBlock = (
      <div className="workshop-status">
        <CheckCircle2 size={16} strokeWidth={2} />
        {t('workshop.joinSheet.accepted')}
      </div>
    );
  } else if (status === 'pending') {
    statusBlock = (
      <div className="workshop-status">
        <Clock size={16} strokeWidth={2} />
        {t('workshop.joinSheet.pending')}
      </div>
    );
  } else if (status === 'declined') {
    const reason = myJoinRequest?.reason === 'full'
      ? t('workshop.joinSheet.full')
      : t('workshop.joinSheet.declined');
    statusBlock = (
      <div className="workshop-status is-danger">
        <X size={16} strokeWidth={2} />
        {reason}
      </div>
    );
  } else if (status === 'cancelled') {
    statusBlock = (
      <div className="workshop-status is-neutral">
        <X size={16} strokeWidth={2} />
        {t('workshop.joinSheet.cancelled')}
      </div>
    );
  } else if (isFull) {
    statusBlock = (
      <div className="workshop-status is-neutral">
        <Users size={16} strokeWidth={2} />
        {t('workshop.joinSheet.full')}
      </div>
    );
  }

  return (
    <section className="workshop-sheet" aria-label={t('workshop.joinSheet.title')}>
      <button type="button" className="workshop-sheet__backdrop" aria-label={t('common.close')} onClick={onClose} />
      <div className="workshop-sheet__panel">
        <span className="workshop-sheet__handle" aria-hidden="true" />
        <header className="workshop-sheet__header">
          <div className="workshop-sheet__title">
            <strong>{participationConfig?.activityTitle || t('workshop.joinSheet.title')}</strong>
            <span>
              {t('workshop.joinSheet.intro')}
              {maxParticipants > 0 ? ` · ${participantCount}/${maxParticipants}` : ''}
            </span>
          </div>
          <button type="button" className="workshop-sheet__close" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        <div className="workshop-sheet__body">
          <div className="workshop-privacy">
            <div className="workshop-privacy__row">
              <Camera size={16} strokeWidth={2} />
              <span>{t('workshop.joinSheet.privacy1')}</span>
            </div>
            <div className="workshop-privacy__row">
              <Users size={16} strokeWidth={2} />
              <span>{t('workshop.joinSheet.privacy2')}</span>
            </div>
            <div className="workshop-privacy__row">
              <Shield size={16} strokeWidth={2} />
              <span>{t('workshop.joinSheet.privacy3')}</span>
            </div>
          </div>
          {statusBlock}
        </div>

        <footer className="workshop-sheet__footer">
          {isParticipating ? (
            <button type="button" className="workshop-btn is-primary" onClick={onOpenParticipantHUD}>
              {t('workshop.joinCtaActive')}
            </button>
          ) : status === 'pending' ? (
            <button type="button" className="workshop-btn is-ghost" onClick={() => onCancel?.(myJoinRequest.id)}>
              {t('workshop.joinSheet.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className="workshop-btn is-primary"
              onClick={onRequestJoin}
              disabled={isFull}
            >
              {t('workshop.joinSheet.request')}
            </button>
          )}
        </footer>
      </div>
    </section>
  );
}
