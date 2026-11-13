import { AnimatePresence, motion } from 'framer-motion';
import BrandMark from '../../../BrandMark.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function WelcomeLayer({ visible, reducedMotion }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="introv2-welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.3 : 0.9, ease: EASE }}
        >
          {/* cyan radial halo */}
          <motion.div
            className="introv2-welcome__halo"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={reducedMotion ? { opacity: 0.4 } : { opacity: [0, 0.5, 0.35], scale: [0.5, 1.15, 1] }}
            transition={{ duration: 2.6, ease: EASE, times: [0, 0.4, 1] }}
          />

          <motion.div
            className="introv2-welcome__logo"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: [0, 1, 1], scale: [0.85, 1, 1], y: [20, 0, 0] }}
            transition={{ delay: 0.1, duration: 1.2, times: [0, 0.6, 1], ease: EASE }}
          >
            <BrandMark size={96} useLegacy showName={false} />
          </motion.div>

          <motion.p
            className="introv2-welcome__tagline"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: [0, 1, 1], y: [14, 0, 0] }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ delay: 0.5, duration: 1.2, times: [0, 0.6, 1], ease: EASE }}
          >
            See the world through their eyes.
          </motion.p>

          <div className="introv2-welcome__activity-wrap">
            {[
              { text: 'Live · Piano Dubai POV', delay: 0.25, duration: 2.45 },
              { text: 'Live · Road POV', delay: 3.05, duration: 2.85 },
              { text: 'Live · Alpine ridge POV', delay: 6.4, duration: 1.8 },
              { text: 'Live · Wingsuit POV', delay: 8.3, duration: 1.8 },
              { text: 'Live · Moody Rooster', delay: 9.5, duration: 2.3 },
            ].map((label) => (
              <motion.span
                key={label.text}
                className="introv2-welcome__activity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
                transition={{
                  delay: label.delay,
                  duration: label.duration,
                  ease: EASE,
                  times: [0, 0.2, 0.8, 1],
                }}
              >
                {label.text}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
