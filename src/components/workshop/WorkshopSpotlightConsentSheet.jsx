import { useTranslation } from 'react-i18next';
import { Radio, Shield, X } from 'lucide-react';

/**
 * Mutual-consent sheet for spotlight.
 *
 *  variant === 'participant-incoming' — host has requested spotlight.
 *    The participant must explicitly ALLOW public broadcast.
 *
 *  variant === 'host-incoming' — participant has raised their hand
 *    (already captured publicSpotlightAuthorized=true on their side).
 *    The host confirms + starts the spotlight.
 *
 *  variant === 'participant-confirm' — participant initiated spotlight
 *    and we show them a last-chance review sheet (not used in the mock
 *    flow, which auto-confirms, but reserved for future UX if the
 *    consent should be captured in two taps rather than one).
 */
export default function WorkshopSpotlightConsentSheet({
  variant = 'participant-incoming',
  participantName,
  onAccept,
  onDecline,
  onClose,
}) {
  const { t } = useTranslation();

  let title, body, acceptLabel, declineLabel;
  if (variant === 'host-incoming') {
    title = t('workshop.spotlight.hostIncomingTitle', { name: participantName || 'Participant' });
    body = t('workshop.spotlight.hostIncomingBody');
    acceptLabel = t('workshop.spotlight.hostAccept');
    declineLabel = t('workshop.spotlight.hostDecline');
  } else if (variant === 'participant-confirm') {
    title = t('workshop.spotlight.incomingTitle');
    body = t('workshop.spotlight.incomingRequestingBody');
    acceptLabel = t('workshop.spotlight.incomingAllow');
    declineLabel = t('workshop.spotlight.incomingDecline');
  } else {
    // default: participant-incoming
    title = t('workshop.spotlight.incomingTitle');
    body = t('workshop.spotlight.incomingHostBody');
    acceptLabel = t('workshop.spotlight.incomingAllow');
    declineLabel = t('workshop.spotlight.incomingDecline');
  }

  return (
    <section className="workshop-sheet workshop-spotlight-consent" aria-label={title}>
      <button type="button" className="workshop-sheet__backdrop" aria-label={t('common.close')} onClick={onClose} />
      <div className="workshop-sheet__panel">
        <span className="workshop-sheet__handle" aria-hidden="true" />
        <header className="workshop-sheet__header">
          <div className="workshop-sheet__title">
            <strong>
              <Radio size={14} strokeWidth={2} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {title}
            </strong>
            <span>{body}</span>
          </div>
          <button type="button" className="workshop-sheet__close" onClick={onClose} aria-label={t('common.close')}>
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        <div className="workshop-sheet__body workshop-spotlight-consent__body">
          <div className="workshop-privacy">
            <div className="workshop-privacy__row">
              <Shield size={16} strokeWidth={2} />
              <span>
                Accepting shares your POV publicly to <strong>everyone watching</strong> this Live.
              </span>
            </div>
            <div className="workshop-privacy__row">
              <Shield size={16} strokeWidth={2} />
              <span>You can stop anytime by tapping <strong>Stop sharing</strong>.</span>
            </div>
          </div>
          <p className="workshop-spotlight-consent__warn">
            Joining the workshop and allowing public broadcast are <strong>separate</strong>. This permission applies only to this request.
          </p>
        </div>

        <footer className="workshop-sheet__footer">
          <button type="button" className="workshop-btn is-ghost" onClick={() => { onDecline?.(); onClose?.(); }}>
            {declineLabel}
          </button>
          <button type="button" className="workshop-btn is-primary" onClick={() => { onAccept?.(); onClose?.(); }}>
            <Radio size={14} strokeWidth={2} />
            {acceptLabel}
          </button>
        </footer>
      </div>
    </section>
  );
}
