import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Backpack, ChevronLeft, ChevronRight, X } from 'lucide-react';

import PovLayer from './layers/PovLayer.jsx';
import WelcomeLayer from './layers/WelcomeLayer.jsx';
import WatchLayer from './layers/WatchLayer.jsx';
import LiveLayer from './layers/LiveLayer.jsx';
import EquipmentLayer from './layers/EquipmentLayer.jsx';
import GlobeLayer from './layers/GlobeLayerCanvas.jsx';
import StartLiveLayer from './layers/StartLiveLayer.jsx';
import EnterLayer from './layers/EnterLayer.jsx';
import NarrationPill from './layers/NarrationPill.jsx';
import { FIREFIGHTER_LIVE } from './introLives.js';
import { useIntroCopy } from './introCopy.js';

// V2 phases. Each drives:
//  - Pov layer layout preset (via className suffix)
//  - UI layer visibility
//  - Narration caption
//  - Duration before auto-advance
const PHASES = [
  { id: 'welcome',   duration: 12000, caption: null },
  { id: 'watch',     duration: 4200,  caption: 'watch' },
  { id: 'live',      duration: 4000,  caption: 'live' },
  { id: 'equipment', duration: 5200,  caption: 'equipment' },
  { id: 'returnlive', duration: 3800, fallbackDuration: 4800, caption: null },
  { id: 'globechef', duration: 5600, fallbackDuration: 7000, caption: null },
  { id: 'globe',     duration: 6200, fallbackDuration: 7500, caption: 'globe' },
  { id: 'globelive', duration: 7600, fallbackDuration: 8500, caption: null },
  { id: 'startlive', duration: 6000, fallbackDuration: 12000, caption: null },
  { id: 'enter',     duration: 5200,  caption: null },
];

export default function IntroOrchestratorV2({ initialPhase, autoAdvance = false }) {
  const t = useIntroCopy();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion === true;

  const [index, setIndex] = useState(() => Math.max(0, PHASES.findIndex((phase) => phase.id === initialPhase)));
  const [paused] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [fireAudioEnding, setFireAudioEnding] = useState(false);
  const [selectedIntroLive, setSelectedIntroLive] = useState(FIREFIGHTER_LIVE);
  const scoreRef = useRef(null);

  // POV video shared ref — kept mounted across all phases to preserve playback
  const povVideoRef = useRef(null);

  const globeShouldPreload = index >= 1;

  const currentPhase = PHASES[index];
  const isLast = index === PHASES.length - 1;
  const phaseId = currentPhase.id;

  useEffect(() => {
    if (phaseId !== 'globelive') setFireAudioEnding(false);
  }, [phaseId]);

  const beginFireAudioExit = useCallback(() => setFireAudioEnding(true), []);

  useEffect(() => {
    const score = scoreRef.current;
    if (!score || !soundEnabled) return undefined;
    let frame;
    let holdTimer;
    let startTime;
    const fadeTo = (target, duration, onComplete) => {
      const from = score.volume;
      const step = (time) => {
        if (startTime === undefined) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const eased = (1 - Math.cos(Math.PI * progress)) / 2;
        score.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
        if (progress < 1) frame = requestAnimationFrame(step);
        else onComplete?.();
      };
      frame = requestAnimationFrame(step);
    };

    if (exiting) {
      fadeTo(0, phaseId === 'enter' ? 2400 : 550, () => score.pause());
    } else if (phaseId === 'enter') {
      holdTimer = setTimeout(() => fadeTo(0, 5000, () => score.pause()), 1500);
    } else {
      if (score.paused) {
        score.volume = 0;
        score.play().catch(() => {});
      }
      fadeTo(phaseId === 'globe' || phaseId === 'globechef' ? 0.34 : phaseId === 'welcome' ? 0.2 : 0.27, 700);
    }

    return () => {
      clearTimeout(holdTimer);
      cancelAnimationFrame(frame);
    };
  }, [soundEnabled, phaseId, exiting]);

  useEffect(() => {
    if (soundEnabled) return undefined;
    const score = scoreRef.current;
    if (!score) return undefined;
    score.volume = 0;
    const enableSound = () => score.play().then(() => setSoundEnabled(true)).catch(() => {});
    enableSound();
    window.addEventListener('pointerdown', enableSound);
    window.addEventListener('keydown', enableSound);
    return () => {
      window.removeEventListener('pointerdown', enableSound);
      window.removeEventListener('keydown', enableSound);
    };
  }, [soundEnabled]);

  const exitIntro = useCallback(() => {
    setExiting(true);
    setTimeout(() => navigate('/watch', { replace: true }), phaseId === 'enter' ? 2450 : 620);
  }, [navigate, phaseId]);

  const goNext = useCallback(() => {
    if (!isLast) setIndex((i) => Math.min(i + 1, PHASES.length - 1));
  }, [isLast]);

  const skipToEnter = useCallback(() => {
    setIndex(PHASES.length - 1);
  }, []);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (paused || exiting || isLast || (initialPhase && !autoAdvance)) return undefined;
    const timer = setTimeout(() => setIndex((current) => Math.min(current + 1, PHASES.length - 1)), currentPhase.fallbackDuration ?? currentPhase.duration);
    return () => clearTimeout(timer);
  }, [index, currentPhase.duration, currentPhase.fallbackDuration, paused, isLast, exiting, initialPhase, autoAdvance]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goBack();
      else if (e.key === 'Escape') skipToEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goBack, skipToEnter]);

  return (
    <div className="introv2-root" data-phase={phaseId} role="dialog" aria-label={t.dialog}>
      <audio ref={scoreRef} src="/intro/vuviointromusic.mp3" loop preload="auto" />
      <div className="introv2-phone-stage">
        <div className="introv2-stage">

          {/* Persistent POV video — driven by phase class */}
          <PovLayer
            phase={phaseId}
            videoRef={povVideoRef}
            reducedMotion={reduced}
            soundEnabled={soundEnabled}
            fireAudioEnding={fireAudioEnding}
            selectedLive={selectedIntroLive}
          />

          {/* Welcome overlays (logo + slogan + welcome pov fullscreen framing) */}
          <WelcomeLayer visible={phaseId === 'welcome'} reducedMotion={reduced} />

          {/* Watch UI around the POV card */}
          <WatchLayer phase={phaseId} reducedMotion={reduced} />

          {/* Live UI around the POV fullscreen */}
          <LiveLayer phase={phaseId} reducedMotion={reduced} selectedLive={selectedIntroLive} autoOpenGlobe={!initialPhase || autoAdvance} onOpenGlobe={goNext} autoCreate={!initialPhase || autoAdvance} onCreatePress={beginFireAudioExit} onCreate={goNext} />

          {/* Equipment sheet slides up over Live */}
          <EquipmentLayer visible={phaseId === 'equipment'} reducedMotion={reduced} />

          <AnimatePresence>
            {(phaseId === 'live' || phaseId === 'equipment' || phaseId === 'returnlive') && (
              <motion.div
                layout
                className={'introv2-gear-bridge' + (phaseId === 'equipment' ? ' introv2-gear-bridge--docked' : '')}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ layout: { duration: reduced ? 0.2 : 1.45, ease: [0.4, 0, 0.6, 1] }, opacity: { duration: 0.55, delay: phaseId === 'live' && !reduced ? 1.15 : 0 }, scale: { duration: 0.55 } }}
                aria-hidden="true"
              >
                <Backpack size={phaseId === 'equipment' ? 24 : 18} strokeWidth={2} />
              </motion.div>
            )}
          </AnimatePresence>

          <GlobeLayer
            phase={phaseId}
            visible={phaseId === 'globechef' || phaseId === 'globe'}
            preload={globeShouldPreload}
            reducedMotion={reduced}
            autoSelect={!initialPhase || autoAdvance}
            onCloseChef={goNext}
            onSelectLive={(live) => {
              setSelectedIntroLive(live);
              goNext();
            }}
          />

          {/* Start Live (phone shell + go live button) */}
          <StartLiveLayer
            phase={phaseId}
            reducedMotion={reduced}
            autoLaunch={!initialPhase || autoAdvance}
            onLaunch={goNext}
          />

          {/* Final enter screen */}
          <EnterLayer
            visible={phaseId === 'enter'}
            onEnter={exitIntro}
            reducedMotion={reduced}
          />

          {/* Narration pill */}
          <NarrationPill text={t.captions[currentPhase.caption] ?? null} phaseId={phaseId} />

          {/* Exit reveal mask */}
          {exiting && (
            <motion.div
              className="introv2-exit-mask"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 28, opacity: 1 }}
              transition={{ duration: phaseId === 'enter' ? 2.45 : 0.62, ease: [0.4, 0, 0.2, 1] }}
            />
          )}

          {/* HUD */}
          {!exiting && (
            <>
              <div className="introv2-hud">
                <div className="introv2-progress" aria-hidden="true">
                  {PHASES.map((p, i) => {
                    return (
                      <div key={p.id} className="introv2-progress__segment">
                        <div
                          key={`${p.id}-${index}`}
                          className={'introv2-progress__segment-fill' + (i === index ? ' introv2-progress__segment-fill--active' : '')}
                          style={{ transform: `scaleX(${i < index ? 1 : 0})`, animationDuration: `${p.fallbackDuration ?? p.duration}ms` }}
                        />
                      </div>
                    );
                  })}
                </div>
                {!isLast && (
                  <button
                    type="button"
                    className="introv2-btn"
                    onClick={skipToEnter}
                    aria-label={t.skip}
                  >
                    {t.skip}
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>

              <div className="introv2-nav">
                <button
                  type="button"
                  className="introv2-nav__btn"
                  onClick={goBack}
                  disabled={index === 0}
                  aria-label={t.previous}
                >
                  <ChevronLeft size={16} strokeWidth={2} />
                  {t.back}
                </button>
                {!isLast && (
                  <button
                    type="button"
                    className="introv2-nav__btn"
                    onClick={goNext}
                    aria-label={t.next}
                  >
                    {t.next}
                    <ChevronRight size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
