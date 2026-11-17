import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CameraOff, HandHelping, LogOut, Mic, MicOff, Radio, Hand, Lightbulb } from 'lucide-react';

/**
 * Participant HUD — compact toolbar + camera preview.
 *
 * SIMULATION: Camera preview uses local getUserMedia if the user grants
 * access AND they've toggled camera on. Otherwise a neutral placeholder
 * is shown. No remote transport — the stream never leaves the device.
 * The spotlight is a UI simulation: when active, the host card displays
 * a thumbnail of the participant's local preview.
 */
export default function WorkshopParticipantHUD({
  myParticipant,
  session,
  spotlightParticipant,
  pendingSpotlight,
  onToggleCamera,
  onToggleMic,
  onNeedFeedback,
  onRequestSpotlight,
  onStopSharing,
  onLeave,
  localStreamRef,
}) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [permissionError, setPermissionError] = useState(null);
  const [localStream, setLocalStream] = useState(() => localStreamRef?.current || null);

  const cameraOn = Boolean(myParticipant?.cameraOn);
  const micOn = Boolean(myParticipant?.micOn);
  const feedbackPending = Boolean(myParticipant?.pendingFeedback);
  const amSpotlighted = spotlightParticipant?.id === myParticipant?.id;
  const spotlightPending = Boolean(pendingSpotlight);

  // Grab local media when camera is turned on. Release when turned off.
  // getUserMedia is only called on explicit user interaction (see onClick below).
  useEffect(() => {
    if (!cameraOn && localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      if (localStreamRef) localStreamRef.current = null;
    }
  }, [cameraOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Honor mic toggle on existing audio track without re-prompting.
  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => { track.enabled = micOn; });
  }, [micOn, localStream]);

  const handleCameraClick = async () => {
    if (cameraOn) {
      onToggleCamera?.(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Media API unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: micOn });
      stream.getAudioTracks().forEach((track) => { track.enabled = micOn; });
      setLocalStream(stream);
      if (localStreamRef) localStreamRef.current = stream;
      setPermissionError(null);
      onToggleCamera?.(true);
    } catch (err) {
      console.warn('[workshop] camera permission denied:', err?.message);
      setPermissionError(err?.message || 'denied');
    }
  };

  const handleMicClick = async () => {
    const next = !micOn;
    if (next && !localStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        if (localStreamRef) localStreamRef.current = stream;
      } catch (err) {
        console.warn('[workshop] mic permission denied:', err?.message);
        setPermissionError(err?.message || 'denied');
        return;
      }
    }
    onToggleMic?.(next);
  };

  if (!myParticipant) return null;

  return (
    <div className="workshop-participant-hud" data-sim="simulated-participant-hud">
      {amSpotlighted ? (
        <div className="workshop-participant-hud__spotlight-note">
          <Radio size={12} strokeWidth={2.4} />
          {t('workshop.participant.youAreLive')}
        </div>
      ) : spotlightPending ? (
        <div className="workshop-participant-hud__spotlight-note">
          <Lightbulb size={12} strokeWidth={2.4} />
          {t('workshop.spotlight.incomingTitle')}
        </div>
      ) : null}

      <div className="workshop-participant-hud__preview" aria-label={t('workshop.participant.yourPreview')}>
        {cameraOn && localStream ? (
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <div className="workshop-participant-hud__preview-placeholder">
            <CameraOff size={16} strokeWidth={1.8} />
            <span>{cameraOn ? 'Starting…' : t('workshop.participant.yourPreview')}</span>
            {permissionError ? <small style={{ color: '#ff9aa4' }}>{permissionError}</small> : null}
          </div>
        )}
        <span className={`workshop-participant-hud__preview-label${amSpotlighted ? ' workshop-participant-hud__preview-label--live' : ''}`}>
          {amSpotlighted ? <Radio size={11} strokeWidth={2.4} /> : null}
          {amSpotlighted ? 'LIVE' : t('workshop.participant.yourPreview')}
        </span>
      </div>

      <div className="workshop-participant-hud__bar" role="toolbar" aria-label={t('workshop.participant.label')}>
        <button
          type="button"
          className={`workshop-participant-hud__btn${cameraOn ? ' is-active' : ''}`}
          onClick={handleCameraClick}
          aria-pressed={cameraOn}
          aria-label={cameraOn ? t('workshop.participant.cameraOff') : t('workshop.participant.cameraOn')}
        >
          {cameraOn ? <Camera size={14} strokeWidth={2} /> : <CameraOff size={14} strokeWidth={2} />}
          {cameraOn ? 'On' : 'Cam'}
        </button>
        <button
          type="button"
          className={`workshop-participant-hud__btn${micOn ? ' is-active' : ''}`}
          onClick={handleMicClick}
          aria-pressed={micOn}
          aria-label={micOn ? t('workshop.participant.micOff') : t('workshop.participant.micOn')}
        >
          {micOn ? <Mic size={14} strokeWidth={2} /> : <MicOff size={14} strokeWidth={2} />}
          {micOn ? 'On' : 'Mic'}
        </button>
        <button
          type="button"
          className={`workshop-participant-hud__btn${feedbackPending ? ' is-active' : ''}`}
          onClick={() => onNeedFeedback?.()}
          disabled={feedbackPending}
        >
          <HandHelping size={14} strokeWidth={2} />
          {feedbackPending ? t('workshop.participant.feedbackSent') : t('workshop.participant.needFeedback')}
        </button>
        {amSpotlighted ? (
          <button
            type="button"
            className="workshop-participant-hud__btn is-danger"
            onClick={onStopSharing}
          >
            <Radio size={14} strokeWidth={2} />
            {t('workshop.participant.stopSharing')}
          </button>
        ) : (
          <button
            type="button"
            className={`workshop-participant-hud__btn${spotlightPending ? ' is-active' : ''}`}
            onClick={onRequestSpotlight}
            disabled={!cameraOn || spotlightPending}
          >
            <Hand size={14} strokeWidth={2} />
            {t('workshop.participant.requestSpotlight')}
          </button>
        )}
        <button type="button" className="workshop-participant-hud__btn is-danger" onClick={onLeave}>
          <LogOut size={14} strokeWidth={2} />
          {t('workshop.participant.leave')}
        </button>
      </div>
    </div>
  );
}
