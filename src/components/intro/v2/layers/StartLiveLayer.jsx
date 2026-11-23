import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bike, Briefcase, ChevronDown, ChevronLeft, Footprints,
  Globe2, MoreHorizontal, Mountain, MousePointer2, Pencil, Plane, Radio,
  UtensilsCrossed, Waves, X,
} from 'lucide-react';
import { BIKING_LIVE } from '../introLives.js';
import IntroBottomNav from './IntroBottomNav.jsx';
import { useIntroCopy } from '../introCopy.js';

const EASE = [0.22, 1, 0.36, 1];
const CATEGORIES = [Footprints, UtensilsCrossed, Briefcase, Mountain, Bike, Waves, Plane, MoreHorizontal];
export default function StartLiveLayer({ phase, reducedMotion, autoLaunch, onLaunch }) {
  const t = useIntroCopy();
  const [launching, setLaunching] = useState(false);
  const launchTimerRef = useRef(null);
  const triggerLaunch = useCallback(() => {
    if (phase !== 'startlive' || launching) return;
    setLaunching(true);
    launchTimerRef.current = setTimeout(onLaunch, reducedMotion ? 2350 : 3100);
  }, [phase, launching, onLaunch, reducedMotion]);

  useEffect(() => {
    if (phase === 'startlive') return;
    clearTimeout(launchTimerRef.current);
    setLaunching(false);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'startlive' || !autoLaunch || launching) return undefined;
    const timer = setTimeout(triggerLaunch, reducedMotion ? 900 : 3330);
    return () => clearTimeout(timer);
  }, [phase, autoLaunch, launching, reducedMotion, triggerLaunch]);

  useEffect(() => () => clearTimeout(launchTimerRef.current), []);

  return (
    <AnimatePresence>
      {phase === 'startlive' && (
        <motion.div
          className={'introv2-start' + (launching ? ' introv2-start--launching' : '')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.25 : 0.55, ease: EASE }}
        >
          <div className="introv2-start__backdrop" />
          <motion.div
            className="introv2-start__panel"
            initial={{ opacity: 0, y: reducedMotion ? 0 : 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0.25 : 0.7, ease: EASE }}
          >
            <div className="create-sheet__header">
              <span className="introv2-start__header-icon"><ChevronLeft size={18} /></span>
              <strong>{t.start.title}</strong>
              <span className="introv2-start__header-icon"><X size={17} /></span>
            </div>
            <div className="start-live-flow">
              <div className="start-live-preview">
                <video src={BIKING_LIVE.video} poster={BIKING_LIVE.poster} autoPlay muted playsInline loop preload="auto" />
                <span className="start-live-preview__label">{t.start.preview}</span>
              </div>
              <div>
                <span className="start-live-label">{t.start.activity}</span>
                <div className="start-live-input-wrap">
                  <Pencil size={15} strokeWidth={1.8} className="start-live-input-icon" />
                  <div className="start-live-input introv2-start__input-value">{t.start.activityValue}</div>
                </div>
              </div>
              <div>
                <span className="start-live-label">{t.start.category}</span>
                <div className="start-live-cats">
                  {CATEGORIES.map((Icon, i) => (
                    <div key={i} className={'start-live-cat' + (i === 4 ? ' is-active' : '')}>
                      <Icon size={18} strokeWidth={1.6} />
                      <span>{t.start.categories[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="start-live-broadcast">
                <span className="start-live-label">{t.start.broadcast}</span>
                <div className="start-live-broadcast__list">
                  <div className="start-live-dest start-live-dest--vuvio">
                    <span className="start-live-dest__dot start-live-dest__dot--on" />
                    <span className="start-live-dest__name">Vuvio</span>
                    <span className="start-live-dest__badge">{t.start.alwaysOn}</span>
                  </div>
                </div>
              </div>
              <div className="introv2-start__go-wrap">
                <button type="button" className="start-live-go introv2-start__go" onClick={triggerLaunch} disabled={launching}>
                  <Radio size={18} strokeWidth={2} /> {t.start.goLive}
                </button>
                {autoLaunch && !reducedMotion && !launching && (
                  <motion.span
                    className="introv2-start__cursor"
                    initial={{ opacity: 0, x: 46, y: 30, scale: 1 }}
                    animate={{ opacity: [0, 1, 1, 1, 1], x: [46, 46, 0, 0, 0], y: [30, 30, 0, 0, 0], scale: [1, 1, 1, 0.72, 0.72] }}
                    transition={{ delay: 2.4, duration: 1.1, times: [0, 0.12, 0.7, 0.83, 1], ease: EASE }}
                    aria-hidden="true"
                  >
                    <MousePointer2 size={24} fill="white" strokeWidth={1.5} />
                  </motion.span>
                )}
              </div>
              <p className="introv2-start__guidelines">{t.start.guidelines} <span>{t.start.communityGuidelines}</span></p>
              <div className="introv2-start__quick"><Globe2 size={14} /> {t.start.everyone} <ChevronDown size={12} /></div>
            </div>
          </motion.div>
          <IntroBottomNav createActive />
          {launching && (
            <motion.div
              className="introv2-start__launch-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reducedMotion ? 0.15 : 0.45 }}
              aria-hidden="true"
            >
              <motion.div
                className="introv2-start__launch-label"
                initial={{ scale: 0.65, y: 160 }}
                animate={{ scale: reducedMotion ? 1 : 1.3, y: 0 }}
                transition={{ duration: reducedMotion ? 0.3 : 1.05, ease: EASE }}
              >
                <Radio size={24} strokeWidth={2} />
                {t.start.goLive}
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
