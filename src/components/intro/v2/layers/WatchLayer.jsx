import { AnimatePresence, motion } from 'framer-motion';
import { Search, Flame } from 'lucide-react';
import BrandMark from '../../../BrandMark.jsx';
import IntroBottomNav from './IntroBottomNav.jsx';

const EASE = [0.22, 1, 0.36, 1];

// Watch layer appears during 'watch' phase, fades (partial) during 'live' to blend transition
export default function WatchLayer({ phase, reducedMotion }) {
  const visible = phase === 'watch';
  // When we move to live, the Watch chrome quickly fades but spotlight ring on card may remain briefly
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="introv2-watch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.25 : 0.55, ease: EASE }}
        >
          {/* Dim overlay so Watch UI is legible over the moving POV */}
          <div className="introv2-watch__dim" />

          {/* Header */}
          <motion.header
            className="introv2-watch__header"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          >
            <div className="introv2-watch__header-left">
              <BrandMark size={22} useLegacy withCircle={false} />
              <span className="introv2-watch__header-title">Watch</span>
            </div>
            <div className="introv2-watch__header-right">
              <Search size={18} strokeWidth={2} />
            </div>
          </motion.header>

          {/* Category chips */}
          <motion.div
            className="introv2-watch__cats"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
          >
            {['All', 'Cooking', 'Riding', 'Hiking', 'Travel'].map((c, i) => (
              <span
                key={c}
                className={'introv2-watch__cat' + (c === 'Cooking' ? ' introv2-watch__cat--active' : '')}
              >
                {c === 'Cooking' && <Flame size={11} strokeWidth={2} style={{ marginRight: 4 }} />}
                {c}
              </span>
            ))}
          </motion.div>

          {/* Spotlight ring around the POV card — appears briefly before Live */}
          <motion.div
            className="introv2-watch__spotlight"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={reducedMotion
              ? { opacity: 0.6, scale: 1 }
              : { opacity: [0, 0.9, 0.65, 0.9], scale: [0.98, 1.02, 1, 1.02] }}
            transition={{ duration: 2.4, ease: EASE, delay: 1.2, repeat: Infinity, repeatType: 'reverse' }}
          />

          {/* Meta row under the POV card: badge, title, viewers */}
          <motion.div
            className="introv2-watch__meta"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.5 }}
          >
            <span className="introv2-watch__live-pill">
              <span className="introv2-watch__live-dot" />
              LIVE
            </span>
            <span className="introv2-watch__title">Busy Friday — behind the pass</span>
            <span className="introv2-watch__viewers">3,210 watching</span>
          </motion.div>

          {/* Simulated "tap" pulse on the card at the end of watch phase */}
          <motion.div
            className="introv2-watch__tap"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={reducedMotion
              ? { opacity: 0 }
              : { opacity: [0, 0.9, 0], scale: [0.4, 1.4, 1.6] }}
            transition={{ duration: 1.2, ease: EASE, delay: 3.4 }}
          />

          {/* Bottom nav preview */}
          <motion.div
            className="introv2-watch__nav-reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.3 }}
          >
            <IntroBottomNav />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
