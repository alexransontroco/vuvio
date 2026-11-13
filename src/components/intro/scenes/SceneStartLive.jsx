import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Compass, Footprints, Mountain, Plus, Radio, Tv2, UserRound, UtensilsCrossed } from 'lucide-react';
import BrandMark from '../../BrandMark.jsx';
import IntroVideo from '../IntroVideo.jsx';

const EASE = [0.22, 1, 0.36, 1];

const CATEGORIES = [
  { icon: Footprints,       label: 'Walking' },
  { icon: UtensilsCrossed,  label: 'Cooking', active: true },
  { icon: Bike,             label: 'Cycling' },
  { icon: Mountain,         label: 'Hiking' },
];

export default function SceneStartLive({ reducedMotion, onExit }) {
  // Two-phase scene: Start Live UI → final tagline + CTA
  const [phase, setPhase] = useState('form');

  useEffect(() => {
    const t = setTimeout(() => setPhase('final'), reducedMotion ? 1500 : 5200);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  return (
    <section className="intro-start" aria-label="Start Live">
      {/* Dim backdrop video */}
      <IntroVideo
        src="/intro/povs-montage.mp4"
        poster="/intro/povs-poster.jpg"
        className="intro-start__video-bg"
        loop
      />
      <div className="intro-start__dim" />

      <div className="intro-start__content">
        <motion.h3
          className="intro-start__title"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          Start a live
        </motion.h3>

        {/* Camera preview placeholder (static poster — no real camera access) */}
        <motion.div
          className="intro-start__preview"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: EASE }}
        >
          <img
            src="/intro/povs-poster.jpg"
            alt=""
            className="intro-start__preview-video"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <span className="intro-start__preview-label">Preview</span>
        </motion.div>

        <motion.div
          className="intro-start__field"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        >
          Friday service — behind the pass
        </motion.div>

        <motion.div
          className="intro-start__cats"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: EASE }}
        >
          {CATEGORIES.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.span
                key={cat.label}
                className={'intro-start__cat' + (cat.active ? ' intro-start__cat--active' : '')}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.07, type: 'spring', damping: 20, stiffness: 240 }}
              >
                <Icon size={13} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                {cat.label}
              </motion.span>
            );
          })}
        </motion.div>

        <motion.div
          className="intro-start__golive"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.9, type: 'spring', damping: 22, stiffness: 180 }}
        >
          <Radio size={16} strokeWidth={2} />
          Go Live
        </motion.div>
      </div>

      {/* Fake bottom nav with spotlighted + button */}
      <div className="intro-start__nav">
        {[
          { Icon: Tv2,       label: 'Watch' },
          { Icon: Compass,   label: 'Explore' },
        ].map((item) => (
          <div key={item.label} className="intro-start__nav-item">
            <item.Icon size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
          </div>
        ))}
        <motion.div
          className="intro-start__nav-create"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 18, stiffness: 240 }}
        >
          <BrandMark size={24} withCircle={false} useLegacy />
          <motion.div
            className="intro-start__nav-highlight"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={!reducedMotion ? {
              opacity: [0, 0.9, 0.5, 0.9],
              scale: [0.9, 1, 1.05, 1],
            } : { opacity: 0.7, scale: 1 }}
            transition={{ delay: 0.5, duration: 2.0, ease: EASE, times: [0, 0.3, 0.7, 1], repeat: Infinity, repeatType: 'reverse' }}
          />
        </motion.div>
        {[
          { Icon: Plus,       label: 'Globe' },
          { Icon: UserRound,  label: 'Profile' },
        ].map((item) => (
          <div key={item.label} className="intro-start__nav-item">
            <item.Icon size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Phase 2 — final tagline + CTA */}
      <AnimatePresence>
        {phase === 'final' && (
          <motion.div
            className="intro-start__final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <IntroVideo
              src="/intro/povs-montage.mp4"
              poster="/intro/povs-poster.jpg"
              className="intro-start__final-video"
              loop
            />
            <div className="intro-start__final-dim" />
            <div className="intro-start__final-content">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.8, ease: EASE }}
              >
                <BrandMark size={72} showName useLegacy nameSize={36} gap={14} />
              </motion.div>
              <motion.h2
                className="intro-start__final-title"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
              >
                Your world.<br />A new perspective.
              </motion.h2>
              <motion.button
                type="button"
                className="intro-start__final-cta"
                onClick={onExit}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.6, ease: EASE }}
              >
                Enter Vuvio
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
