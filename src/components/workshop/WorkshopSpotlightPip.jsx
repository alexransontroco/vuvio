import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, RefreshCw, X } from 'lucide-react';

/**
 * Small picture-in-picture bubble showing the spotlighted participant
 * on top of the main POV. In the mock we feed it the participant's
 * local MediaStream (shared via a ref). If no stream is available we
 * fall back to an avatar.
 *
 * SIMULATION: in production this will be a WHEP/WebRTC subscription
 * to the participant's own Cloudflare Live Input, gated by
 * publicSpotlightAuthorized on the backend.
 */
export default function WorkshopSpotlightPip({
  participant,
  mediaStream,
  onEnd,
  onSwap,
  swapped = false,
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  if (!participant) return null;

  const initial = (participant.userName || '?')[0]?.toUpperCase();

  return (
    <div className="workshop-spotlight-pip" data-sim="simulated-spotlight-pip" data-swapped={swapped || undefined}>
      <div className="workshop-spotlight-pip__media">
        {mediaStream ? (
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f5fafb',
            fontSize: 28,
            fontWeight: 700,
          }}>
            {initial}
          </div>
        )}
        <span className="workshop-spotlight-pip__name">
          <Radio size={11} strokeWidth={2.4} />
          {participant.userName}
        </span>
      </div>
      <div className="workshop-spotlight-pip__actions">
        {onSwap ? (
          <button type="button" onClick={onSwap} aria-label={t('workshop.spotlight.swap')}>
            <RefreshCw size={11} strokeWidth={2.2} />
            Swap
          </button>
        ) : null}
        <button type="button" className="is-danger" onClick={onEnd} aria-label={t('workshop.creator.endSpotlight')}>
          <X size={11} strokeWidth={2.4} />
          End
        </button>
      </div>
    </div>
  );
}
