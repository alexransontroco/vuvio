import { AnimatePresence, motion } from 'framer-motion';
import BrandMark from '../../../BrandMark.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function EnterLayer({ visible, onEnter, reducedMotion }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="introv2-enter"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.3 : 0.9, ease: EASE }}
        >
          <motion.div
            className="introv2-enter__halo"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={reducedMotion ? { opacity: 0.3 } : { opacity: [0, 0.45, 0.35], scale: [0.6, 1.1, 1] }}
            transition={{ duration: 2.2, ease: EASE, times: [0, 0.5, 1] }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 1.0, ease: EASE }}
          >
            <BrandMark size={72} showName useLegacy nameSize={36} gap={14} />
          </motion.div>
          <motion.h2
            className="introv2-enter__title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.9, ease: EASE }}
          >
            Your world.<br />A new perspective.
          </motion.h2>
          <motion.button
            type="button"
            className="introv2-enter__cta"
            onClick={onEnter}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.7, ease: EASE }}
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          >
            Enter Vuvio
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
