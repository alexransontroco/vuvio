import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BIKING_LIVE, CHEF_LIVE, FIREFIGHTER_LIVE } from '../introLives.js';

// Phase layouts — the POV container morphs between these shapes.
// framer-motion `layout` prop animates the geometry when className swaps.
// We also apply a conceptual "camera depth" via scale so it feels 3D.
const PHASE_CLASSES = {
  welcome:   'introv2-pov introv2-pov--welcome',
  watch:     'introv2-pov introv2-pov--watch-card',
  live:      'introv2-pov introv2-pov--live',
  equipment: 'introv2-pov introv2-pov--live',  // stays fullscreen behind sheet
  returnlive: 'introv2-pov introv2-pov--live',
  globechef: 'introv2-pov introv2-pov--globe-exit',
  globe:     'introv2-pov introv2-pov--globe-exit',
  globelive: 'introv2-pov introv2-pov--live',
  startlive: 'introv2-pov introv2-pov--live',
  enter:     'introv2-pov introv2-pov--hidden',
};

export default function PovLayer({ phase, videoRef, reducedMotion, soundEnabled, fireAudioEnding, selectedLive }) {
  const className = PHASE_CLASSES[phase] || PHASE_CLASSES.welcome;
  const pianoRef = useRef(null);
  const motoRef = useRef(null);
  const alpineRef = useRef(null);
  const wingsuitRef = useRef(null);
  const fireStartedAtRef = useRef(null);
  const firePressedAtRef = useRef(null);
  const [openingStage, setOpeningStage] = useState(phase === 'welcome' ? 'full' : 'main');
  const [globeBackdropReady, setGlobeBackdropReady] = useState(false);
  const activeLive = phase === 'startlive' || phase === 'enter' ? BIKING_LIVE : phase === 'globelive' || (phase === 'globe' && globeBackdropReady) ? selectedLive ?? FIREFIGHTER_LIVE : CHEF_LIVE;
  const originalAudioEnabled = soundEnabled && !reducedMotion && (
    phase === 'watch' || phase === 'live' || phase === 'equipment' || phase === 'returnlive' || phase === 'globelive' ||
    (phase === 'welcome' && openingStage === 'main')
  );

  useEffect(() => {
    if (phase !== 'globe') {
      setGlobeBackdropReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setGlobeBackdropReady(true), reducedMotion ? 0 : 900);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    fireStartedAtRef.current = phase === 'globelive' ? performance.now() : null;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'globelive') firePressedAtRef.current = null;
    else if (fireAudioEnding && firePressedAtRef.current === null) firePressedAtRef.current = performance.now();
  }, [phase, fireAudioEnding]);

  useLayoutEffect(() => {
    if (phase !== 'globelive') return undefined;
    const fireVideo = videoRef.current;
    return () => {
      if (!fireVideo) return;
      fireVideo.volume = 0;
      fireVideo.muted = true;
      fireVideo.pause();
    };
  }, [phase, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (phase === 'globelive') {
      video.volume = 0;
      video.muted = !originalAudioEnabled;
      if (!originalAudioEnabled) return;
      let frame;
      const updateVolume = () => {
        const elapsed = performance.now() - fireStartedAtRef.current;
        const fadeIn = Math.min(1, elapsed / 650);
        const fadeOut = Math.max(0, Math.min(1, (7600 - elapsed) / 1400));
        const pressFade = firePressedAtRef.current === null ? 1 : Math.max(0, 1 - (performance.now() - firePressedAtRef.current) / 450);
        video.volume = 0.14 * Math.min(fadeIn, fadeOut, pressFade);
        if (elapsed < 7600 && pressFade > 0) frame = requestAnimationFrame(updateVolume);
      };
      frame = requestAnimationFrame(updateVolume);
      return () => cancelAnimationFrame(frame);
    }
    video.muted = !originalAudioEnabled;
    video.volume = 0.14;
  }, [videoRef, phase, originalAudioEnabled]);

  useEffect(() => {
    const piano = pianoRef.current;
    const moto = motoRef.current;
    const alpine = alpineRef.current;
    const wingsuit = wingsuitRef.current;
    if (!piano || !moto || !alpine || !wingsuit) return undefined;

    if (phase !== 'welcome' || reducedMotion) {
      setOpeningStage('main');
      piano.pause();
      moto.pause();
      alpine.pause();
      wingsuit.pause();
      return undefined;
    }

    setOpeningStage('full');
    piano.currentTime = 0;
    moto.currentTime = 0;
    alpine.currentTime = 0;
    wingsuit.currentTime = 0;
    piano.playbackRate = 1;
    moto.playbackRate = 0.78;
    piano.play().catch(() => {});

    const splitTimer = setTimeout(() => {
      setOpeningStage('split');
      moto.play().catch(() => {});
    }, 3000);
    const quadTimer = setTimeout(() => {
      setOpeningStage('quad');
      alpine.play().catch(() => {});
      wingsuit.play().catch(() => {});
    }, 6300);
    const finishTimer = setTimeout(() => setOpeningStage('main'), 10200);

    return () => {
      clearTimeout(splitTimer);
      clearTimeout(quadTimer);
      clearTimeout(finishTimer);
    };
  }, [phase, reducedMotion]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 1;
    if (reducedMotion || phase === 'globe' || phase === 'globechef' || phase === 'enter' || (phase === 'welcome' && openingStage !== 'main')) {
      v.pause();
      return;
    }
    if (phase === 'globelive') v.currentTime = 0;
    const tryPlay = async () => {
      try { await v.play(); } catch {
        setTimeout(() => v.play().catch(() => {}), 200);
      }
    };
    tryPlay();
  }, [videoRef, reducedMotion, phase, openingStage]);

  return (
    <>
      <div className={className}>
        <video
          key={activeLive.id}
          ref={videoRef}
          src={activeLive.video}
          poster={activeLive.poster}
          className="introv2-pov__video"
          muted={phase === 'globelive' || !originalAudioEnabled}
          playsInline
          autoPlay={phase !== 'welcome'}
          loop={activeLive.id !== 'chef'}
          preload="auto"
          webkit-playsinline="true"
          disablePictureInPicture
          disableRemotePlayback
        />
        <div className="introv2-pov__tint" />
        <div className="introv2-pov__glow" />
      </div>
      {(phase === 'equipment' || phase === 'globe') && <video src={FIREFIGHTER_LIVE.video} preload="auto" muted playsInline style={{ display: 'none' }} />}
      <div className={`introv2-opening introv2-opening--${openingStage}`} aria-hidden="true">
        <div className="introv2-opening__first introv2-opening__first--piano">
          <video ref={pianoRef} src="/pov/used/pov-piano-dubai.mp4" poster="/pov/used/pov-piano-dubai.jpg" muted playsInline preload="auto" disablePictureInPicture />
        </div>
        <div className="introv2-opening__second">
          <video ref={motoRef} src="/pov/used/pov-moto-opening.mp4" muted playsInline preload="auto" disablePictureInPicture />
        </div>
        <div className="introv2-opening__third">
          <video ref={alpineRef} src="/pov/used/pov-alpine-ridge.mp4" poster="/pov/used/pov-alpine-ridge.jpg" muted playsInline preload="auto" disablePictureInPicture />
        </div>
        <div className="introv2-opening__fourth">
          <video ref={wingsuitRef} src="/pov/used/pov-wingsuit.mp4" poster="/pov/used/pov-wingsuit.jpg" muted playsInline preload="auto" disablePictureInPicture />
        </div>
      </div>
    </>
  );
}
