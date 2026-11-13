import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import SceneColdOpen from './scenes/SceneColdOpen.jsx';
import SceneWatch from './scenes/SceneWatch.jsx';
import SceneLive from './scenes/SceneLive.jsx';
import SceneEquipment from './scenes/SceneEquipment.jsx';
import SceneGlobe from './scenes/SceneGlobe.jsx';
import SceneStartLive from './scenes/SceneStartLive.jsx';

// Scenes with target duration in ms. Scene components can also call
// onComplete() themselves, but the duration drives the progress bar
// and the auto-advance timer.
const SCENES = [
  { id: 'cold',    duration: 7000,  Component: SceneColdOpen },
  { id: 'watch',   duration: 6500,  Component: SceneWatch },
  { id: 'live',    duration: 7000,  Component: SceneLive },
  { id: 'equip',   duration: 6500,  Component: SceneEquipment },
  { id: 'globe',   duration: 7500,  Component: SceneGlobe },
  { id: 'start',   duration: 9000,  Component: SceneStartLive },
];

export default function IntroOrchestrator() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Tick drives the progress bar fill. Reset on each scene change.
  const [, forceTick] = useReducer((n) => n + 1, 0);
  const sceneStartRef = useRef(Date.now());
  const rafRef = useRef(null);

  const currentScene = SCENES[index];
  const isLast = index === SCENES.length - 1;

  const exitIntro = useCallback(() => {
    navigate('/watch', { replace: true });
  }, [navigate]);

  const goNext = useCallback(() => {
    if (isLast) {
      exitIntro();
    } else {
      setIndex((i) => Math.min(i + 1, SCENES.length - 1));
    }
  }, [isLast, exitIntro]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Reset timer when scene changes
  useEffect(() => {
    sceneStartRef.current = Date.now();
  }, [index]);

  // RAF-driven progress tick (smoother than setInterval for the bar)
  useEffect(() => {
    if (paused) return undefined;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const elapsed = Date.now() - sceneStartRef.current;
      if (elapsed >= currentScene.duration) {
        if (!isLast) {
          setIndex((i) => Math.min(i + 1, SCENES.length - 1));
        }
        // On last scene, hold — user must click CTA (or Skip)
      } else {
        forceTick();
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [index, currentScene.duration, paused, isLast]);

  // Keyboard shortcuts: ← → to navigate, Esc to skip
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goBack();
      else if (e.key === 'Escape') exitIntro();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goBack, exitIntro]);

  const elapsed = Date.now() - sceneStartRef.current;
  const currentProgress = Math.min(1, elapsed / currentScene.duration);

  const SceneComponent = currentScene.Component;

  const reduced = prefersReducedMotion === true;

  const sceneVariants = useMemo(() => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 },
    animate: { opacity: 1, scale: 1 },
    exit:    reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 },
  }), [reduced]);

  return (
    <div className="intro-root" role="dialog" aria-label="Vuvio intro">
      <div className="intro-phone-stage">
        <div className="intro-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentScene.id}
              variants={sceneVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: reduced ? 0.25 : 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <SceneComponent
                reducedMotion={reduced}
                onComplete={goNext}
                onExit={exitIntro}
                isLast={isLast}
              />
            </motion.div>
          </AnimatePresence>

          {/* HUD: progress + skip */}
          <div className="intro-hud">
            <div className="intro-progress" aria-hidden="true">
              {SCENES.map((s, i) => {
                const fill = i < index ? 1 : i === index ? currentProgress : 0;
                return (
                  <div key={s.id} className="intro-progress__segment">
                    <div
                      className="intro-progress__segment-fill"
                      style={{ transform: `scaleX(${fill})` }}
                    />
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="intro-btn"
              onClick={exitIntro}
              aria-label="Skip intro"
            >
              Skip
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Bottom nav: back / next */}
          <div className="intro-nav">
            <button
              type="button"
              className="intro-nav__btn"
              onClick={goBack}
              disabled={index === 0}
              aria-label="Previous"
            >
              <ChevronLeft size={16} strokeWidth={2} />
              Back
            </button>
            <button
              type="button"
              className={isLast ? 'intro-nav__btn intro-nav__btn--primary' : 'intro-nav__btn'}
              onClick={goNext}
              aria-label={isLast ? 'Enter Vuvio' : 'Next'}
            >
              {isLast ? 'Enter Vuvio' : 'Next'}
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
